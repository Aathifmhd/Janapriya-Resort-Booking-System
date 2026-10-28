// Postgres data layer (Neon). Same helper API as before, but every helper is async.
// Inside transaction(fn) all helpers automatically use the transaction's client.
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool, types } = pg;
// Return bigint / numeric as JS numbers so COUNT()/SUM() behave like SQLite did.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (Neon Postgres connection string)');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /sslmode=/.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 2 : 8,
  idleTimeoutMillis: 10000,
});

const als = new AsyncLocalStorage();
const conn = () => als.getStore() || pool;

/** Convert `?` placeholders to $1..$n (none of our SQL has literal question marks). */
function convert(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// SQL snippets for "today" (UTC, matching the client's toISOString() dates)
export const SQL_TODAY = "to_char(now() at time zone 'utc','YYYY-MM-DD')";
export const SQL_NOW = "to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS')";
export const daysAgo = (n) => `to_char((now() at time zone 'utc') - interval '${n} days','YYYY-MM-DD')`;

export async function query(sql, params = []) {
  return conn().query(convert(sql), params.map(normalize));
}
export async function all(sql, params = []) { return (await query(sql, params)).rows; }
export async function get(sql, params = []) { return (await query(sql, params)).rows[0]; }
export async function run(sql, params = []) { const r = await query(sql, params); return { changes: r.rowCount }; }

export async function insert(table, obj) {
  const keys = Object.keys(obj);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) RETURNING id`;
  const r = await query(sql, keys.map((k) => obj[k]));
  return r.rows[0].id;
}
export async function update(table, id, obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`;
  return query(sql, [...keys.map((k) => obj[k]), id]);
}
export async function remove(table, id) {
  return query(`DELETE FROM ${table} WHERE id=?`, [id]);
}
function normalize(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v);
  return v;
}

/** Run fn inside a transaction. Nested calls reuse the outer transaction. */
export async function transaction(fn) {
  if (als.getStore()) return fn();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await als.run(client, fn);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const s = {};
  for (const r of rows) {
    try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; }
  }
  return s;
}
export async function setSetting(key, value) {
  await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, JSON.stringify(value)]);
}
export async function nextCode(prefix, table, col = 'code') {
  const row = await get(`SELECT ${col} AS c FROM ${table} WHERE ${col} LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
  let n = 1;
  if (row?.c) {
    const m = row.c.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(5, '0')}`;
}
export async function audit(req, action, entity, entityId, detail) {
  try {
    await insert('audit_log', {
      user_id: req?.user?.id ?? null,
      user_name: req?.user?.name ?? 'system',
      action, entity, entity_id: entityId != null ? String(entityId) : null,
      detail: typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null,
    });
  } catch { /* ignore */ }
}

// ---------------- schema ----------------
const TS = `TEXT NOT NULL DEFAULT ${SQL_NOW}`;
const TODAY_DEF = `TEXT NOT NULL DEFAULT ${SQL_TODAY}`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'frontdesk', employee_id INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at ${TS});

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, detail TEXT, created_at ${TS});

CREATE TABLE IF NOT EXISTS room_types (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, base_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_adults INTEGER NOT NULL DEFAULT 2, max_children INTEGER NOT NULL DEFAULT 1, size_sqm INTEGER,
  amenities TEXT DEFAULT '[]', image_url TEXT, active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY, number TEXT NOT NULL UNIQUE, room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  floor INTEGER DEFAULT 1, status TEXT NOT NULL DEFAULT 'available', notes TEXT);

CREATE TABLE IF NOT EXISTS guests (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, nic_passport TEXT, nationality TEXT DEFAULT 'Sri Lankan',
  address TEXT, notes TEXT, vip INTEGER NOT NULL DEFAULT 0, created_at ${TS});

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER REFERENCES rooms(id), room_type_id INTEGER NOT NULL REFERENCES room_types(id),
  check_in TEXT NOT NULL, check_out TEXT NOT NULL, adults INTEGER NOT NULL DEFAULT 2, children INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', source TEXT NOT NULL DEFAULT 'walkin', rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1, subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0, special_requests TEXT,
  created_by INTEGER, checked_in_at TEXT, checked_out_at TEXT, created_at ${TS});

CREATE TABLE IF NOT EXISTS booking_charges (
  id SERIAL PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE, description TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL, type TEXT NOT NULL DEFAULT 'other', ref_id INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id SERIAL PRIMARY KEY, room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'cleaning',
  priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'pending', assigned_to INTEGER, notes TEXT,
  created_at ${TS}, completed_at TEXT);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL DEFAULT 'restaurant', capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'free', x INTEGER DEFAULT 0, y INTEGER DEFAULT 0, shape TEXT DEFAULT 'square');

CREATE TABLE IF NOT EXISTS table_reservations (
  id SERIAL PRIMARY KEY, table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL, guest_name TEXT NOT NULL, phone TEXT,
  date TEXT NOT NULL, time TEXT NOT NULL, party_size INTEGER NOT NULL DEFAULT 2, status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT, created_at ${TS});

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT,
  category TEXT DEFAULT 'general', notes TEXT);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY, sku TEXT, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', unit TEXT NOT NULL DEFAULT 'pcs',
  unit_size DOUBLE PRECISION DEFAULT 0, qty_on_hand DOUBLE PRECISION NOT NULL DEFAULT 0, reorder_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_price DOUBLE PRECISION NOT NULL DEFAULT 0, sell_price DOUBLE PRECISION DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, returnable_bottle INTEGER NOT NULL DEFAULT 0,
  bottle_deposit DOUBLE PRECISION NOT NULL DEFAULT 0, empties_on_hand DOUBLE PRECISION NOT NULL DEFAULT 0,
  location TEXT DEFAULT 'main_store', active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS menu_categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'food', sort INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY, category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT,
  price DOUBLE PRECISION NOT NULL DEFAULT 0, cost DOUBLE PRECISION DEFAULT 0,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL, portion_qty DOUBLE PRECISION DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1, image_url TEXT, tags TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL, type TEXT NOT NULL DEFAULT 'dine_in', status TEXT NOT NULL DEFAULT 'open',
  covers INTEGER DEFAULT 1, subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax DOUBLE PRECISION NOT NULL DEFAULT 0,
  service_charge DOUBLE PRECISION NOT NULL DEFAULT 0, discount DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0,
  waiter_id INTEGER, notes TEXT, created_at ${TS}, closed_at TEXT);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL, name TEXT NOT NULL, qty DOUBLE PRECISION NOT NULL DEFAULT 1,
  price DOUBLE PRECISION NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, created_at ${TS});

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY, booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL, invoice_id INTEGER, amount DOUBLE PRECISION NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash', reference TEXT, note TEXT, received_by INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, invoice_no TEXT,
  date TEXT NOT NULL, total DOUBLE PRECISION NOT NULL DEFAULT 0, paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received', notes TEXT, created_by INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY, purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id), qty DOUBLE PRECISION NOT NULL, unit_cost DOUBLE PRECISION NOT NULL);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY, inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty DOUBLE PRECISION NOT NULL, type TEXT NOT NULL, ref TEXT, note TEXT, user_id INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS empty_bottle_log (
  id SERIAL PRIMARY KEY, inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty DOUBLE PRECISION NOT NULL, action TEXT NOT NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0, note TEXT, user_id INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS departments (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS shifts (id SERIAL PRIMARY KEY, name TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY, emp_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT, phone TEXT, nic TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL, designation TEXT, hire_date TEXT,
  salary_basic DOUBLE PRECISION NOT NULL DEFAULT 0, allowances DOUBLE PRECISION NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
  address TEXT, emergency_contact TEXT, bank_details TEXT, shift_id INTEGER, created_at ${TS});

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, date TEXT NOT NULL,
  check_in TEXT, check_out TEXT, status TEXT NOT NULL DEFAULT 'present', hours DOUBLE PRECISION DEFAULT 0,
  overtime_hours DOUBLE PRECISION DEFAULT 0, note TEXT, UNIQUE(employee_id, date));

CREATE TABLE IF NOT EXISTS leaves (
  id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'annual',
  from_date TEXT NOT NULL, to_date TEXT NOT NULL, days DOUBLE PRECISION NOT NULL DEFAULT 1, reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', created_at ${TS});

CREATE TABLE IF NOT EXISTS payroll (
  id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE, month TEXT NOT NULL,
  basic DOUBLE PRECISION NOT NULL DEFAULT 0, allowances DOUBLE PRECISION NOT NULL DEFAULT 0, overtime DOUBLE PRECISION NOT NULL DEFAULT 0,
  bonus DOUBLE PRECISION NOT NULL DEFAULT 0, deductions DOUBLE PRECISION NOT NULL DEFAULT 0, epf_employee DOUBLE PRECISION NOT NULL DEFAULT 0,
  epf_employer DOUBLE PRECISION NOT NULL DEFAULT 0, etf DOUBLE PRECISION NOT NULL DEFAULT 0, net DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', paid_at TEXT, created_at ${TS}, UNIQUE(employee_id, month));

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY, number TEXT NOT NULL UNIQUE, type TEXT NOT NULL, ref_id INTEGER, guest_name TEXT,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0, tax DOUBLE PRECISION NOT NULL DEFAULT 0, service_charge DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0, total DOUBLE PRECISION NOT NULL DEFAULT 0, paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', date ${TODAY_DEF}, items TEXT DEFAULT '[]', created_at ${TS});

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY, category TEXT NOT NULL DEFAULT 'general', description TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL,
  date ${TODAY_DEF}, paid_to TEXT, method TEXT NOT NULL DEFAULT 'cash', reference TEXT, created_by INTEGER, created_at ${TS});

CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_stock_item ON stock_movements(inventory_item_id);
`;

let schemaReady = null;
/** Create tables if they don't exist (runs once per process). */
export function ensureSchema() {
  if (!schemaReady) schemaReady = pool.query(SCHEMA).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}
