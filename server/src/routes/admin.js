import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, insert, update, remove, audit, getSettings, setSetting } from '../db.js';
import { requireModule, requireRole, ROLES } from '../auth.js';

const r = Router();

// ---------- Dashboard ----------
r.get('/dashboard', requireModule('dashboard'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rooms = all('SELECT status, COUNT(*) AS c FROM rooms GROUP BY status');
  const totalRooms = rooms.reduce((a, x) => a + x.c, 0);
  const occupied = rooms.find((x) => x.status === 'occupied')?.c || 0;
  const arrivals = get("SELECT COUNT(*) AS c FROM bookings WHERE check_in=? AND status IN ('pending','confirmed')", [today]).c;
  const departures = get("SELECT COUNT(*) AS c FROM bookings WHERE check_out=? AND status='checked_in'", [today]).c;
  const pendingWeb = get("SELECT COUNT(*) AS c FROM bookings WHERE status='pending'").c;
  const revToday = get('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE date(created_at)=?', [today]).v;
  const revMonth = get("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE strftime('%Y-%m', date)=strftime('%Y-%m','now')").v;
  const openOrders = get("SELECT COUNT(*) AS c FROM orders WHERE status IN ('open','billed')").c;
  const ordersToday = get("SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS v FROM orders WHERE date(created_at)=? AND status!='cancelled'", [today]);
  const lowStock = get('SELECT COUNT(*) AS c FROM inventory_items WHERE active=1 AND qty_on_hand<=reorder_level').c;
  const hkPending = get("SELECT COUNT(*) AS c FROM housekeeping_tasks WHERE status!='done'").c;
  const staffPresent = get("SELECT COUNT(*) AS c FROM attendance WHERE date=? AND status IN ('present','half_day')", [today]).c;
  const staffTotal = get("SELECT COUNT(*) AS c FROM employees WHERE status='active'").c;
  const pendingLeaves = get("SELECT COUNT(*) AS c FROM leaves WHERE status='pending'").c;
  const empties = get('SELECT COALESCE(SUM(empties_on_hand),0) AS c, COALESCE(SUM(empties_on_hand*bottle_deposit),0) AS v FROM inventory_items WHERE returnable_bottle=1');
  const revenue14 = all(`SELECT date, SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type IN ('restaurant','bar') THEN total ELSE 0 END) AS fnb FROM invoices WHERE date >= date('now','-13 days') GROUP BY date ORDER BY date`);
  const occupancy14 = all(`WITH RECURSIVE days(d) AS (SELECT date('now','-13 days') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now'))
     SELECT d AS date, (SELECT COUNT(*) FROM bookings b WHERE b.status IN ('checked_in','checked_out','confirmed') AND b.check_in<=d AND b.check_out>d) AS occupied FROM days`);
  const arrivalsList = all("SELECT b.id, b.code, g.name AS guest_name, rt.name AS room_type_name, r.number AS room_number, b.status, b.nights FROM bookings b JOIN guests g ON g.id=b.guest_id JOIN room_types rt ON rt.id=b.room_type_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.check_in=? AND b.status IN ('pending','confirmed') ORDER BY b.id", [today]);
  const departuresList = all("SELECT b.id, b.code, g.name AS guest_name, r.number AS room_number, b.total, (SELECT COALESCE(SUM(amount),0) FROM payments WHERE booking_id=b.id) AS paid FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.check_out=? AND b.status='checked_in'", [today]);
  const recentActivity = all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 12');
  res.json({
    rooms: { total: totalRooms, occupied, by_status: rooms, occupancy: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0 },
    arrivals, departures, pending_web_bookings: pendingWeb, revenue_today: revToday, revenue_month: revMonth,
    open_orders: openOrders, orders_today: ordersToday.c, orders_today_value: ordersToday.v, low_stock: lowStock, housekeeping_pending: hkPending,
    staff_present: staffPresent, staff_total: staffTotal, pending_leaves: pendingLeaves, empties: empties.c, empties_value: empties.v,
    revenue14, occupancy14, arrivals_list: arrivalsList, departures_list: departuresList, recent_activity: recentActivity,
  });
});

// ---------- Settings ----------
r.get('/settings', requireModule('settings'), (req, res) => res.json(getSettings()));
r.put('/settings', requireRole('admin', 'manager'), (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) setSetting(k, v);
  audit(req, 'update', 'settings', null, Object.keys(req.body || {}));
  res.json(getSettings());
});

// ---------- Users ----------
r.get('/users', requireRole('admin', 'manager'), (req, res) => {
  res.json(all('SELECT u.id, u.name, u.email, u.role, u.active, u.employee_id, u.created_at, e.name AS employee_name FROM users u LEFT JOIN employees e ON e.id=u.employee_id ORDER BY u.id'));
});
r.post('/users', requireRole('admin'), (req, res) => {
  const { name, email, password, role = 'frontdesk', employee_id = null } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (get('SELECT id FROM users WHERE email=?', [email.toLowerCase()])) return res.status(400).json({ error: 'Email already in use' });
  const id = insert('users', { name, email: email.toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role, employee_id: employee_id || null });
  audit(req, 'create', 'users', id, { email, role });
  res.status(201).json(get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [id]));
});
r.put('/users/:id', requireRole('admin'), (req, res) => {
  const { name, email, password, role, active, employee_id } = req.body;
  const patch = {};
  if (name) patch.name = name;
  if (email) patch.email = email.toLowerCase();
  if (role && ROLES.includes(role)) patch.role = role;
  if (active !== undefined) patch.active = active ? 1 : 0;
  if (employee_id !== undefined) patch.employee_id = employee_id || null;
  if (password) patch.password_hash = bcrypt.hashSync(password, 10);
  if (Number(req.params.id) === req.user.id && patch.active === 0) return res.status(400).json({ error: 'You cannot disable yourself' });
  update('users', req.params.id, patch);
  audit(req, 'update', 'users', req.params.id, Object.keys(patch));
  res.json(get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [req.params.id]));
});
r.delete('/users/:id', requireRole('admin'), (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  remove('users', req.params.id);
  res.json({ ok: true });
});
r.get('/roles', requireModule('dashboard'), (req, res) => res.json(ROLES));

r.get('/audit', requireRole('admin', 'manager'), (req, res) => {
  res.json(all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300'));
});

export default r;
