import { Router } from 'express';
import { all, get, run, getSettings, insert, audit } from '../db.js';
import { availability, createBooking, getBooking, safeJson } from '../services/booking.js';

const r = Router();

const PUBLIC_SETTINGS = ['resort_name', 'tagline', 'address', 'phone', 'email', 'currency', 'currency_symbol', 'tax_rate', 'service_charge_rate', 'check_in_time', 'check_out_time', 'website_hero_title', 'website_hero_subtitle'];

r.get('/info', async (req, res) => {
  const s = await getSettings();
  const out = {};
  for (const k of PUBLIC_SETTINGS) out[k] = s[k];
  res.json(out);
});

r.get('/room-types', async (req, res) => {
  const types = await all('SELECT rt.*, (SELECT COUNT(*) FROM rooms WHERE room_type_id=rt.id) AS room_count FROM room_types rt WHERE active=1 ORDER BY base_rate');
  res.json(types.map((t) => ({ ...t, amenities: safeJson(t.amenities, []) })));
});

r.get('/availability', async (req, res) => {
  const { check_in, check_out, adults = 2, children = 0 } = req.query;
  if (!check_in || !check_out) return res.status(400).json({ error: 'check_in and check_out are required' });
  if (new Date(check_out) <= new Date(check_in)) return res.status(400).json({ error: 'Check-out must be after check-in' });
  res.json(await availability(check_in, check_out, adults, children));
});

r.get('/menu', async (req, res) => {
  const cats = await all('SELECT * FROM menu_categories ORDER BY sort, name');
  const items = await all('SELECT id, category_id, name, description, price, tags, image_url FROM menu_items WHERE active=1 ORDER BY name');
  res.json(cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id) })));
});

r.post('/book', async (req, res) => {
  try {
    const b = await createBooking({ ...req.body, source: 'website', status: 'pending', rate: undefined, discount: 0, room_id: undefined, guest_id: undefined });
    await audit(null, 'create', 'bookings', b.id, { source: 'website', code: b.code });
    res.status(201).json(publicBooking(b));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.get('/booking/:code', async (req, res) => {
  const row = await get('SELECT b.id FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE b.code=? AND (g.email=? OR g.phone=?)', [req.params.code.toUpperCase(), req.query.email || '', req.query.phone || '']);
  if (!row) return res.status(404).json({ error: 'No booking found with that reference and email/phone' });
  res.json(publicBooking(await getBooking(row.id)));
});

r.post('/booking/:code/cancel', async (req, res) => {
  const row = await get('SELECT b.* FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE b.code=? AND (g.email=? OR g.phone=?)', [req.params.code.toUpperCase(), req.body.email || '', req.body.phone || '']);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  if (!['pending', 'confirmed'].includes(row.status)) return res.status(400).json({ error: 'This booking can no longer be cancelled online. Please contact the resort.' });
  await run("UPDATE bookings SET status='cancelled' WHERE id=?", [row.id]);
  await audit(null, 'cancel', 'bookings', row.id, 'Cancelled by guest online');
  res.json(publicBooking(await getBooking(row.id)));
});

r.post('/table-reservation', async (req, res) => {
  const { guest_name, phone, date, time, party_size = 2, notes = '' } = req.body || {};
  if (!guest_name || !phone || !date || !time) return res.status(400).json({ error: 'Name, phone, date and time are required' });
  const id = await insert('table_reservations', { guest_name, phone, date, time, party_size, notes, status: 'requested' });
  res.status(201).json({ id, message: 'Reservation request received. Our team will confirm shortly.' });
});

function publicBooking(b) {
  const { charges, payments, created_by, ...rest } = b;
  return rest;
}

export default r;
