import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, insert, update, remove, audit, getSettings, setSetting, daysAgo } from '../db.js';
import { requireModule, requireRole, ROLES } from '../auth.js';

const r = Router();

// ---------- Dashboard ----------
r.get('/dashboard', requireModule('dashboard'), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const c = async (sql, p) => (await get(sql, p)).c;
  const v = async (sql, p) => (await get(sql, p)).v;
  const rooms = await all('SELECT status, COUNT(*) AS c FROM rooms GROUP BY status');
  const totalRooms = rooms.reduce((a, x) => a + x.c, 0);
  const occupied = rooms.find((x) => x.status === 'occupied')?.c || 0;
  const arrivals = await c("SELECT COUNT(*) AS c FROM bookings WHERE check_in=? AND status IN ('pending','confirmed')", [today]);
  const departures = await c("SELECT COUNT(*) AS c FROM bookings WHERE check_out=? AND status='checked_in'", [today]);
  const pendingWeb = await c("SELECT COUNT(*) AS c FROM bookings WHERE status='pending'");
  const revToday = await v('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE substr(created_at,1,10)=?', [today]);
  const revMonth = await v('SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE substr(date,1,7)=?', [today.slice(0, 7)]);
  const openOrders = await c("SELECT COUNT(*) AS c FROM orders WHERE status IN ('open','billed')");
  const ordersToday = await get("SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS v FROM orders WHERE substr(created_at,1,10)=? AND status!='cancelled'", [today]);
  const lowStock = await c('SELECT COUNT(*) AS c FROM inventory_items WHERE active=1 AND qty_on_hand<=reorder_level');
  const hkPending = await c("SELECT COUNT(*) AS c FROM housekeeping_tasks WHERE status!='done'");
  const staffPresent = await c("SELECT COUNT(*) AS c FROM attendance WHERE date=? AND status IN ('present','half_day')", [today]);
  const staffTotal = await c("SELECT COUNT(*) AS c FROM employees WHERE status='active'");
  const pendingLeaves = await c("SELECT COUNT(*) AS c FROM leaves WHERE status='pending'");
  const empties = await get('SELECT COALESCE(SUM(empties_on_hand),0) AS c, COALESCE(SUM(empties_on_hand*bottle_deposit),0) AS v FROM inventory_items WHERE returnable_bottle=1');
  const revenue14 = await all(`SELECT date, SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type IN ('restaurant','bar') THEN total ELSE 0 END) AS fnb FROM invoices WHERE date >= ${daysAgo(13)} GROUP BY date ORDER BY date`);
  const occupancy14 = await all(`SELECT to_char(g.d,'YYYY-MM-DD') AS date,
      (SELECT COUNT(*) FROM bookings b WHERE b.status IN ('checked_in','checked_out','confirmed') AND b.check_in<=to_char(g.d,'YYYY-MM-DD') AND b.check_out>to_char(g.d,'YYYY-MM-DD')) AS occupied
      FROM generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') AS g(d) ORDER BY g.d`);
  const arrivalsList = await all("SELECT b.id, b.code, g.name AS guest_name, rt.name AS room_type_name, r.number AS room_number, b.status, b.nights FROM bookings b JOIN guests g ON g.id=b.guest_id JOIN room_types rt ON rt.id=b.room_type_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.check_in=? AND b.status IN ('pending','confirmed') ORDER BY b.id", [today]);
  const departuresList = await all("SELECT b.id, b.code, g.name AS guest_name, r.number AS room_number, b.total, (SELECT COALESCE(SUM(amount),0) FROM payments WHERE booking_id=b.id) AS paid FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.check_out=? AND b.status='checked_in'", [today]);
  const recentActivity = await all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 12');
  res.json({
    rooms: { total: totalRooms, occupied, by_status: rooms, occupancy: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0 },
    arrivals, departures, pending_web_bookings: pendingWeb, revenue_today: revToday, revenue_month: revMonth,
    open_orders: openOrders, orders_today: ordersToday.c, orders_today_value: ordersToday.v, low_stock: lowStock, housekeeping_pending: hkPending,
    staff_present: staffPresent, staff_total: staffTotal, pending_leaves: pendingLeaves, empties: empties.c, empties_value: empties.v,
    revenue14, occupancy14, arrivals_list: arrivalsList, departures_list: departuresList, recent_activity: recentActivity,
  });
});

// ---------- Settings ----------
r.get('/settings', requireModule('settings'), async (req, res) => res.json(await getSettings()));
r.put('/settings', requireRole('admin', 'manager'), async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) await setSetting(k, v);
  await audit(req, 'update', 'settings', null, Object.keys(req.body || {}));
  res.json(await getSettings());
});

// ---------- Users ----------
r.get('/users', requireRole('admin', 'manager'), async (req, res) => {
  res.json(await all('SELECT u.id, u.name, u.email, u.role, u.active, u.employee_id, u.created_at, e.name AS employee_name FROM users u LEFT JOIN employees e ON e.id=u.employee_id ORDER BY u.id'));
});
r.post('/users', requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'frontdesk', employee_id = null } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (await get('SELECT id FROM users WHERE email=?', [email.toLowerCase()])) return res.status(400).json({ error: 'Email already in use' });
  const id = await insert('users', { name, email: email.toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role, employee_id: employee_id || null });
  await audit(req, 'create', 'users', id, { email, role });
  res.status(201).json(await get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [id]));
});
r.put('/users/:id', requireRole('admin'), async (req, res) => {
  const { name, email, password, role, active, employee_id } = req.body;
  const patch = {};
  if (name) patch.name = name;
  if (email) patch.email = email.toLowerCase();
  if (role && ROLES.includes(role)) patch.role = role;
  if (active !== undefined) patch.active = active ? 1 : 0;
  if (employee_id !== undefined) patch.employee_id = employee_id || null;
  if (password) patch.password_hash = bcrypt.hashSync(password, 10);
  if (Number(req.params.id) === req.user.id && patch.active === 0) return res.status(400).json({ error: 'You cannot disable yourself' });
  await update('users', req.params.id, patch);
  await audit(req, 'update', 'users', req.params.id, Object.keys(patch));
  res.json(await get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [req.params.id]));
});
r.delete('/users/:id', requireRole('admin'), async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  await remove('users', req.params.id);
  res.json({ ok: true });
});
r.get('/roles', requireModule('dashboard'), (req, res) => res.json(ROLES));

r.get('/audit', requireRole('admin', 'manager'), async (req, res) => {
  res.json(await all('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300'));
});

export default r;
