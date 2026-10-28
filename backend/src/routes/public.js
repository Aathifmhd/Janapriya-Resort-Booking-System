import { Router } from 'express';
import { all, get, run, getSettings, insert, audit, todayLocal } from '../db.js';
import { availability, createBooking, getBooking, safeJson, nightsBetween, isISODate } from '../services/booking.js';
import { rateLimit } from '../rateLimit.js';

const r = Router();

const PUBLIC_SETTINGS = ['resort_name', 'tagline', 'address', 'phone', 'email', 'currency', 'currency_symbol', 'tax_rate', 'service_charge_rate', 'check_in_time', 'check_out_time', 'website_hero_title', 'website_hero_subtitle'];

// Limits for unauthenticated website bookings, so nobody can hold rooms for months from the website.
// Staff bookings in the portal are not limited.
const MAX_WEB_NIGHTS = 30;
const MAX_WEB_DAYS_AHEAD = 365;

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
  const problem = webDatesError(check_in, check_out);
  if (problem) return res.status(400).json({ error: problem });
  res.json(await availability(check_in, check_out, adults, children));
});

r.get('/menu', async (req, res) => {
  const cats = await all('SELECT * FROM menu_categories ORDER BY sort, name');
  const items = await all('SELECT id, category_id, name, description, price, tags, image_url FROM menu_items WHERE active=1 ORDER BY name');
  res.json(cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id) })));
});

r.post('/book', rateLimit('book', 5, 60), async (req, res) => {
  try {
    const body = req.body || {};
    const adults = Number(body.adults ?? 2); const children = Number(body.children ?? 0);
    const problem = webDatesError(body.check_in, body.check_out) || await webPartyError(body.room_type_id, adults, children);
    if (problem) return res.status(400).json({ error: problem });
    const b = await createBooking({ ...body, adults, children, source: 'website', status: 'pending', rate: undefined, discount: 0, room_id: undefined, guest_id: undefined });
    await audit(null, 'create', 'bookings', b.id, { source: 'website', code: b.code });
    res.status(201).json(publicBooking(b));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

r.get('/booking/:code', rateLimit('lookup', 20, 15), async (req, res) => {
  const row = await findGuestBooking(req.params.code, req.query);
  if (!row) return res.status(404).json({ error: 'No booking found with that reference and email/phone' });
  res.json(publicBooking(await getBooking(row.id)));
});

r.post('/booking/:code/cancel', rateLimit('lookup', 20, 15), async (req, res) => {
  const row = await findGuestBooking(req.params.code, req.body);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  if (!['pending', 'confirmed'].includes(row.status)) return res.status(400).json({ error: 'This booking can no longer be cancelled online. Please contact the resort.' });
  await run("UPDATE bookings SET status='cancelled' WHERE id=?", [row.id]);
  await audit(null, 'cancel', 'bookings', row.id, 'Cancelled by guest online');
  res.json(publicBooking(await getBooking(row.id)));
});

r.post('/table-reservation', rateLimit('table', 5, 60), async (req, res) => {
  const { guest_name, phone, date, time, party_size = 2, notes = '' } = req.body || {};
  if (!guest_name || !phone || !date || !time) return res.status(400).json({ error: 'Name, phone, date and time are required' });
  const id = await insert('table_reservations', { guest_name, phone, date, time, party_size, notes, status: 'requested' });
  res.status(201).json({ id, message: 'Reservation request received. Our team will confirm shortly.' });
});

/** A booking matched by its reference plus the guest's email or phone. Blank values never match. */
async function findGuestBooking(code, contact = {}) {
  const email = String(contact.email || '').trim();
  const phone = String(contact.phone || '').trim();
  const match = []; const params = [String(code).toUpperCase()];
  if (email) { match.push('g.email=?'); params.push(email); }
  if (phone) { match.push('g.phone=?'); params.push(phone); }
  if (!match.length) return null;
  return get(`SELECT b.* FROM bookings b JOIN guests g ON g.id=b.guest_id WHERE b.code=? AND (${match.join(' OR ')})`, params);
}

function webDatesError(check_in, check_out) {
  if (!isISODate(check_in) || !isISODate(check_out)) return 'Choose check-in and check-out dates';
  if (check_out <= check_in) return 'Check-out must be after check-in';
  if (check_in < todayLocal()) return 'Check-in date cannot be in the past';
  if (nightsBetween(check_in, check_out) > MAX_WEB_NIGHTS) return `Online bookings are limited to ${MAX_WEB_NIGHTS} nights. Please contact the resort for longer stays.`;
  if (check_in > todayLocal(MAX_WEB_DAYS_AHEAD)) return `Online bookings can be made up to ${MAX_WEB_DAYS_AHEAD} days ahead. Please contact the resort for later dates.`;
  return null;
}

/** Website guests can't book more people than the room takes (staff can, e.g. with an extra bed). */
async function webPartyError(room_type_id, adults, children) {
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) return 'Invalid number of guests';
  const typeId = Number(room_type_id);
  const type = Number.isInteger(typeId) ? await get('SELECT max_adults, max_children FROM room_types WHERE id=? AND active=1', [typeId]) : null;
  if (!type) return 'Room type not found';
  if (adults > type.max_adults || children > type.max_children) return `This room takes up to ${type.max_adults} adults and ${type.max_children} children`;
  return null;
}

function publicBooking(b) {
  const { charges, payments, created_by, nic_passport, ...rest } = b;
  return rest;
}

export default r;
