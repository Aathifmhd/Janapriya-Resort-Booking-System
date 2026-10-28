import { Router } from 'express';
import { all, get, insert, update, run, audit, nextCode, getSettings, transaction, SQL_TODAY } from '../db.js';
import { requireModule } from '../auth.js';
import { crud, pick } from './crud.js';
import { availability, availableRooms, createBooking, getBooking, recalcBooking } from '../services/booking.js';

const r = Router();

// ---------- Room types ----------
r.use('/room-types', requireModule('room-types'), crud({
  table: 'room_types',
  fields: ['name', 'description', 'base_rate', 'max_adults', 'max_children', 'size_sqm', 'amenities', 'image_url', 'active'],
  listSql: 'SELECT rt.*, (SELECT COUNT(*) FROM rooms WHERE room_type_id=rt.id) AS room_count FROM room_types rt',
  orderBy: 'base_rate',
}));

// ---------- Rooms ----------
r.use('/rooms', requireModule('rooms'), crud({
  table: 'rooms', alias: 'r',
  fields: ['number', 'room_type_id', 'floor', 'status', 'notes'],
  listSql: `SELECT r.*, rt.name AS type_name, rt.base_rate,
      (SELECT b.id FROM bookings b WHERE b.room_id=r.id AND b.status='checked_in' LIMIT 1) AS current_booking_id,
      (SELECT g.name FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE b.room_id=r.id AND b.status='checked_in' LIMIT 1) AS current_guest,
      (SELECT b.check_out FROM bookings b WHERE b.room_id=r.id AND b.status='checked_in' LIMIT 1) AS current_check_out,
      (SELECT b.check_in FROM bookings b WHERE b.room_id=r.id AND b.status IN ('confirmed','pending') AND b.check_in>=${SQL_TODAY} ORDER BY b.check_in LIMIT 1) AS next_arrival
      FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id`,
  getSql: 'SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id WHERE r.id=?',
  orderBy: 'r.floor, r.number',
}));
r.post('/rooms/:id/status', requireModule('rooms'), async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['available', 'occupied', 'dirty', 'cleaning', 'maintenance', 'out_of_order'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await update('rooms', req.params.id, { status, ...(notes !== undefined ? { notes } : {}) });
  if (status === 'maintenance') {
    await insert('housekeeping_tasks', { room_id: req.params.id, type: 'maintenance', priority: 'high', status: 'pending', notes: notes || 'Marked for maintenance' });
  }
  await audit(req, 'status', 'rooms', req.params.id, status);
  res.json(await get('SELECT * FROM rooms WHERE id=?', [req.params.id]));
});

// ---------- Guests ----------
r.use('/guests', requireModule('guests'), crud({
  table: 'guests', alias: 'g',
  fields: ['name', 'email', 'phone', 'nic_passport', 'nationality', 'address', 'notes', 'vip'],
  listSql: `SELECT g.*, (SELECT COUNT(*) FROM bookings WHERE guest_id=g.id) AS stays,
            (SELECT COALESCE(SUM(total),0) FROM bookings WHERE guest_id=g.id AND status!='cancelled') AS lifetime_value,
            (SELECT MAX(check_in) FROM bookings WHERE guest_id=g.id) AS last_visit FROM guests g`,
  searchCols: ['g.name', 'g.email', 'g.phone', 'g.nic_passport'],
  orderBy: 'g.id DESC',
}));
r.get('/guests/:id/bookings', requireModule('guests'), async (req, res) => {
  res.json(await all('SELECT b.*, rt.name AS room_type_name, r.number AS room_number FROM bookings b JOIN room_types rt ON rt.id=b.room_type_id LEFT JOIN rooms r ON r.id=b.room_id WHERE guest_id=? ORDER BY check_in DESC', [req.params.id]));
});

// ---------- Bookings ----------
r.get('/bookings/availability', requireModule('bookings'), async (req, res) => {
  const { check_in, check_out, adults = 1, children = 0, exclude } = req.query;
  if (!check_in || !check_out) return res.status(400).json({ error: 'check_in and check_out required' });
  const types = await availability(check_in, check_out, adults, children);
  const out = [];
  for (const t of types) out.push({ ...t, rooms: await availableRooms(t.id, check_in, check_out, exclude ? Number(exclude) : null) });
  res.json(out);
});

r.get('/bookings/calendar', requireModule('bookings'), async (req, res) => {
  const { from, to } = req.query;
  res.json(await all(
    `SELECT b.id, b.code, b.room_id, b.check_in, b.check_out, b.status, g.name AS guest_name, rt.name AS room_type_name
     FROM bookings b JOIN guests g ON g.id=b.guest_id JOIN room_types rt ON rt.id=b.room_type_id
     WHERE b.status NOT IN ('cancelled','no_show') AND b.check_in < ? AND b.check_out > ?`, [to, from]));
});

r.get('/bookings', requireModule('bookings'), async (req, res) => {
  const { status, q, from, to, view } = req.query;
  const where = []; const p = [];
  if (status) { where.push('b.status=?'); p.push(status); }
  if (q) { where.push('(b.code ILIKE ? OR g.name ILIKE ? OR g.phone ILIKE ? OR g.email ILIKE ? OR r.number ILIKE ?)'); p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (view === 'arrivals') { where.push(`b.check_in=${SQL_TODAY} AND b.status IN ('pending','confirmed')`); }
  if (view === 'departures') { where.push(`b.check_out=${SQL_TODAY} AND b.status='checked_in'`); }
  if (view === 'inhouse') { where.push("b.status='checked_in'"); }
  if (from) { where.push('b.check_out > ?'); p.push(from); }
  if (to) { where.push('b.check_in < ?'); p.push(to); }
  res.json(await all(
    `SELECT b.*, g.name AS guest_name, g.phone AS guest_phone, g.email AS guest_email, r.number AS room_number, rt.name AS room_type_name,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE booking_id=b.id) AS paid
     FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id JOIN room_types rt ON rt.id=b.room_type_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.check_in DESC, b.id DESC LIMIT 500`, p));
});

r.get('/bookings/:id', requireModule('bookings'), async (req, res) => {
  const b = await getBooking(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  b.orders = await all('SELECT * FROM orders WHERE booking_id=? ORDER BY id DESC', [b.id]);
  res.json(b);
});

r.post('/bookings', requireModule('bookings'), async (req, res) => {
  try {
    const b = await createBooking({ ...req.body, source: req.body.source || 'walkin', status: req.body.status || 'confirmed' }, req);
    await audit(req, 'create', 'bookings', b.id, { code: b.code });
    res.status(201).json(b);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.put('/bookings/:id', requireModule('bookings'), async (req, res) => {
  const b = await get('SELECT * FROM bookings WHERE id=?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const body = pick(req.body, ['check_in', 'check_out', 'adults', 'children', 'special_requests', 'room_id', 'rate', 'discount', 'source', 'room_type_id']);
  try {
    await transaction(async () => {
      const check_in = body.check_in || b.check_in; const check_out = body.check_out || b.check_out;
      const room_type_id = body.room_type_id || b.room_type_id;
      const nights = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
      if (nights < 1) throw new Error('Check-out must be after check-in');
      if (body.room_id || body.check_in || body.check_out || body.room_type_id) {
        const free = await availableRooms(room_type_id, check_in, check_out, b.id);
        const room_id = body.room_id || b.room_id;
        if (room_id && !free.find((x) => x.id === Number(room_id))) throw new Error('Room is not available for those dates');
        if (!room_id && !free.length) throw new Error('No room available for those dates');
        body.room_id = room_id || free[0].id;
      }
      const rate = body.rate != null ? Number(body.rate) : b.rate;
      body.nights = nights;
      await update('bookings', b.id, body);
      const rc = await get("SELECT id FROM booking_charges WHERE booking_id=? AND type='room' ORDER BY id LIMIT 1", [b.id]);
      const typeName = (await get('SELECT name FROM room_types WHERE id=?', [room_type_id])).name;
      if (rc) await update('booking_charges', rc.id, { amount: rate * nights, description: `Room charge - ${typeName} x ${nights} night(s)` });
      else await insert('booking_charges', { booking_id: b.id, description: `Room charge - ${typeName} x ${nights} night(s)`, amount: rate * nights, type: 'room' });
      await recalcBooking(b.id);
    });
    await audit(req, 'update', 'bookings', b.id, body);
    res.json(await getBooking(b.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.post('/bookings/:id/status', requireModule('bookings'), async (req, res) => {
  const b = await get('SELECT * FROM bookings WHERE id=?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    await transaction(async () => {
      if (status === 'checked_in') {
        if (!['pending', 'confirmed'].includes(b.status)) throw new Error('Only pending/confirmed bookings can be checked in');
        let room_id = b.room_id;
        const free = await availableRooms(b.room_type_id, b.check_in, b.check_out, b.id);
        if (!room_id || !free.find((x) => x.id === room_id)) {
          if (!free.length) throw new Error('No room available to check in');
          room_id = free[0].id;
        }
        const room = await get('SELECT status FROM rooms WHERE id=?', [room_id]);
        if (['dirty', 'cleaning'].includes(room.status) && !req.body.force) throw new Error(`Room is ${room.status}. Mark it clean or choose "force".`);
        await update('bookings', b.id, { status, room_id, checked_in_at: now });
        await update('rooms', room_id, { status: 'occupied' });
      } else if (status === 'checked_out') {
        if (b.status !== 'checked_in') throw new Error('Guest is not checked in');
        const full = await getBooking(b.id);
        if (full.balance > 0.5 && !req.body.allow_balance) throw new Error(`Outstanding balance of ${full.balance.toFixed(2)}. Settle before check-out or allow balance.`);
        await update('bookings', b.id, { status, checked_out_at: now });
        if (b.room_id) {
          await update('rooms', b.room_id, { status: 'dirty' });
          await insert('housekeeping_tasks', { room_id: b.room_id, type: 'cleaning', priority: 'high', status: 'pending', notes: `Check-out cleaning - ${b.code}` });
        }
        await run("UPDATE orders SET status='paid', closed_at=? WHERE booking_id=? AND status='billed'", [now, b.id]);
        if (!(await get("SELECT id FROM invoices WHERE type='room' AND ref_id=?", [b.id]))) {
          await insert('invoices', {
            number: await nextCode('INV-R-', 'invoices', 'number'), type: 'room', ref_id: b.id, guest_name: full.guest_name,
            subtotal: full.folio_subtotal, tax: full.folio_tax, service_charge: 0, discount: full.discount, total: full.folio_total, paid: full.paid,
            status: full.balance <= 0.5 ? 'paid' : full.paid > 0 ? 'partial' : 'unpaid', items: full.charges,
          });
        }
        await recalcBooking(b.id);
      } else if (['cancelled', 'no_show', 'confirmed', 'pending'].includes(status)) {
        if (['checked_in', 'checked_out'].includes(b.status)) throw new Error('Cannot change status of a checked-in/out booking');
        await update('bookings', b.id, { status });
      } else throw new Error('Invalid status');
    });
    await audit(req, status, 'bookings', b.id);
    res.json(await getBooking(b.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.post('/bookings/:id/charges', requireModule('bookings'), async (req, res) => {
  const { description, amount, type = 'other' } = req.body;
  if (!description || !amount) return res.status(400).json({ error: 'description and amount required' });
  await insert('booking_charges', { booking_id: req.params.id, description, amount: Number(amount), type });
  await recalcBooking(req.params.id);
  await audit(req, 'charge', 'bookings', req.params.id, { description, amount });
  res.json(await getBooking(req.params.id));
});
r.delete('/bookings/:id/charges/:cid', requireModule('bookings'), async (req, res) => {
  await run("DELETE FROM booking_charges WHERE id=? AND booking_id=? AND type!='room'", [req.params.cid, req.params.id]);
  await recalcBooking(req.params.id);
  res.json(await getBooking(req.params.id));
});

r.post('/bookings/:id/payments', requireModule('payments'), async (req, res) => {
  const { amount, method = 'cash', reference = '', note = '' } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  await insert('payments', { booking_id: req.params.id, amount: Number(amount), method, reference, note, received_by: req.user.id });
  const inv = await get("SELECT * FROM invoices WHERE type='room' AND ref_id=?", [req.params.id]);
  if (inv) {
    const paid = inv.paid + Number(amount);
    await update('invoices', inv.id, { paid, status: paid >= inv.total - 0.5 ? 'paid' : 'partial' });
  }
  await audit(req, 'payment', 'bookings', req.params.id, { amount, method });
  res.json(await getBooking(req.params.id));
});

// ---------- Housekeeping ----------
r.use('/housekeeping', requireModule('housekeeping'), crud({
  table: 'housekeeping_tasks', alias: 'h',
  fields: ['room_id', 'type', 'priority', 'status', 'assigned_to', 'notes', 'completed_at'],
  listSql: `SELECT h.*, r.number AS room_number, e.name AS assigned_name FROM housekeeping_tasks h
            LEFT JOIN rooms r ON r.id=h.room_id LEFT JOIN employees e ON e.id=h.assigned_to`,
  orderBy: "CASE h.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, CASE h.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, h.id DESC",
  beforeUpdate: (body) => {
    if (body.status === 'done' && !body.completed_at) body.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  },
  afterChange: async (id) => {
    const t = await get('SELECT * FROM housekeeping_tasks WHERE id=?', [id]);
    if (!t?.room_id) return;
    const room = await get('SELECT * FROM rooms WHERE id=?', [t.room_id]);
    if (!room) return;
    if (t.type === 'cleaning') {
      if (t.status === 'in_progress' && room.status === 'dirty') await update('rooms', room.id, { status: 'cleaning' });
      if (t.status === 'done' && ['dirty', 'cleaning'].includes(room.status)) await update('rooms', room.id, { status: 'available' });
    }
    if (t.type === 'maintenance') {
      if (['pending', 'in_progress'].includes(t.status) && room.status !== 'occupied') await update('rooms', room.id, { status: 'maintenance' });
      if (t.status === 'done' && room.status === 'maintenance') await update('rooms', room.id, { status: 'available', notes: null });
    }
  },
}));

export default r;
