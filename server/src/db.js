import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
export const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'janapriya.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'frontdesk',
  employee_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ================= ROOMS =================
CREATE TABLE IF NOT EXISTS room_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  base_rate REAL NOT NULL DEFAULT 0,
  max_adults INTEGER NOT NULL DEFAULT 2,
  max_children INTEGER NOT NULL DEFAULT 1,
  size_sqm INTEGER,
  amenities TEXT DEFAULT '[]',
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  floor INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nic_passport TEXT,
  nationality TEXT DEFAULT 'Sri Lankan',
  address TEXT,
  notes TEXT,
  vip INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER REFERENCES rooms(id),
  room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  adults INTEGER NOT NULL DEFAULT 2,
  children INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'walkin',
  rate REAL NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  special_requests TEXT,
  created_by INTEGER,
  checked_in_at TEXT,
  checked_out_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS booking_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  ref_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id INTEGER,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  note TEXT,
  received_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'cleaning',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- ================= RESTAURANT & BAR =================
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'restaurant',
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'free',
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  shape TEXT DEFAULT 'square'
);

CREATE TABLE IF NOT EXISTS table_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  phone TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'food',
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  cost REAL DEFAULT 0,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  portion_qty REAL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  tags TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'dine_in',
  status TEXT NOT NULL DEFAULT 'open',
  covers INTEGER DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  service_charge REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  waiter_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ================= INVENTORY =================
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category TEXT DEFAULT 'general',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_size REAL DEFAULT 0,
  qty_on_hand REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  returnable_bottle INTEGER NOT NULL DEFAULT 0,
  bottle_deposit REAL NOT NULL DEFAULT 0,
  empties_on_hand REAL NOT NULL DEFAULT 0,
  location TEXT DEFAULT 'main_store',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_no TEXT,
  date TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  qty REAL NOT NULL,
  unit_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty REAL NOT NULL,
  type TEXT NOT NULL,
  ref TEXT,
  note TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS empty_bottle_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty REAL NOT NULL,
  action TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  note TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ================= HR =================
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nic TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  designation TEXT,
  hire_date TEXT,
  salary_basic REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  address TEXT,
  emergency_contact TEXT,
  bank_details TEXT,
  shift_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL DEFAULT 'present',
  hours REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  note TEXT,
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'annual',
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  days REAL NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  basic REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  overtime REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  epf_employee REAL NOT NULL DEFAULT 0,
  epf_employer REAL NOT NULL DEFAULT 0,
  etf REAL NOT NULL DEFAULT 0,
  net REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, month)
);

-- ================= FINANCE =================
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  ref_id INTEGER,
  guest_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  service_charge REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  date TEXT NOT NULL DEFAULT (date('now')),
  items TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  paid_to TEXT,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_stock_item ON stock_movements(inventory_item_id);
`;

db.exec(SCHEMA);

// ---------- helpers ----------
export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
export function insert(table, obj) {
  const keys = Object.keys(obj);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const r = db.prepare(sql).run(...keys.map((k) => normalize(obj[k])));
  return Number(r.lastInsertRowid);
}
export function update(table, id, obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`;
  return db.prepare(sql).run(...keys.map((k) => normalize(obj[k])), id);
}
export function remove(table, id) {
  return db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
}
function normalize(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v);
  return v;
}
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const s = {};
  for (const r of rows) {
    try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; }
  }
  return s;
}
export function setSetting(key, value) {
  run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, JSON.stringify(value)]);
}
export function nextCode(prefix, table, col = 'code') {
  const row = get(`SELECT ${col} AS c FROM ${table} WHERE ${col} LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
  let n = 1;
  if (row?.c) {
    const m = row.c.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(5, '0')}`;
}
export function audit(req, action, entity, entityId, detail) {
  try {
    insert('audit_log', {
      user_id: req?.user?.id ?? null,
      user_name: req?.user?.name ?? 'system',
      action, entity, entity_id: entityId != null ? String(entityId) : null,
      detail: typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null,
    });
  } catch { /* ignore */ }
}
