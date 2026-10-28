import { all, get, insert, update, run, nextCode, getSettings, transaction } from '../db.js';

export function nightsBetween(ci, co) {
  return Math.round((new Date(co) - new Date(ci)) / 86400000);
}

/** Rooms of a type that are free for the whole [check_in, check_out) window. */
export function availableRooms(room_type_id, check_in, check_out, excludeBookingId = null) {
  return all(
    `SELECT r.* FROM rooms r
     WHERE r.room_type_id=? AND r.status NOT IN ('out_of_order','maintenance')
       AND r.id NOT IN (
         SELECT room_id FROM bookings
         WHERE room_id IS NOT NULL AND status IN ('pending','confirmed','checked_in')
           AND check_in < ? AND check_out > ? ${excludeBookingId ? 'AND id != ?' : ''}
       )
     ORDER BY r.number`,
    excludeBookingId ? [room_type_id, check_out, check_in, excludeBookingId] : [room_type_id, check_out, check_in]
  );
}

/** Availability summary per room type for a date range. */
export function availability(check_in, check_out, adults = 1, children = 0) {
  const types = all('SELECT * FROM room_types WHERE active=1 ORDER BY base_rate');
  const nights = nightsBetween(check_in, check_out);
  return types.map((t) => {
    const rooms = availableRooms(t.id, check_in, check_out);
    const fits = t.max_adults >= Number(adults) && t.max_children >= Number(children);
    return {
      ...t,
      amenities: safeJson(t.amenities, []),
      available_count: rooms.length,
      available: rooms.length > 0 && fits,
      fits_guests: fits,
      nights,
      total_before_tax: t.base_rate * nights,
    };
  });
}

export function priceBooking(rate, nights, discount = 0) {
  const s = getSettings();
  const subtotal = rate * nights;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * (Number(s.tax_rate) || 0)) / 100;
  return { subtotal, tax, discount, total: taxable + tax };
}

/**
 * Create a booking. Finds or creates guest, auto-assigns a room if none given.
 */
export function createBooking(input, req = null) {
  const { check_in, check_out, room_type_id, adults = 2, children = 0, source = 'walkin', special_requests = '', status = 'confirmed', discount = 0 } = input;
  if (!check_in || !check_out || !room_type_id) throw new Error('check_in, check_out and room_type_id are required');
  const nights = nightsBetween(check_in, check_out);
  if (nights < 1) throw new Error('Check-out must be after check-in');
  if (new Date(check_in) < new Date(new Date().toISOString().slice(0, 10))) throw new Error('Check-in date cannot be in the past');
  const type = get('SELECT * FROM room_types WHERE id=?', [room_type_id]);
  if (!type) throw new Error('Room type not found');

  return transaction(() => {
    // guest
    let guest_id = input.guest_id;
    if (!guest_id) {
      const g = input.guest || {};
      if (!g.name) throw new Error('Guest name is required');
      const existing = g.email ? get('SELECT id FROM guests WHERE email=?', [g.email]) : g.phone ? get('SELECT id FROM guests WHERE phone=?', [g.phone]) : null;
      if (existing) {
        guest_id = existing.id;
        update('guests', guest_id, { name: g.name, phone: g.phone || null, nic_passport: g.nic_passport || null, nationality: g.nationality || 'Sri Lankan', address: g.address || null });
      } else {
        guest_id = insert('guests', { name: g.name, email: g.email || null, phone: g.phone || null, nic_passport: g.nic_passport || null, nationality: g.nationality || 'Sri Lankan', address: g.address || null });
      }
    }
    // room
    let room_id = input.room_id || null;
    const free = availableRooms(room_type_id, check_in, check_out);
    if (room_id) {
      if (!free.find((r) => r.id === Number(room_id))) throw new Error('Selected room is not available for those dates');
    } else {
      if (!free.length) throw new Error('No rooms of this type are available for the selected dates');
      room_id = free[0].id;
    }
    const rate = input.rate != null ? Number(input.rate) : type.base_rate;
    const price = priceBooking(rate, nights, Number(discount) || 0);
    const code = nextCode('JR', 'bookings');
    const id = insert('bookings', {
      code, guest_id, room_id, room_type_id, check_in, check_out, adults, children, status, source, rate, nights,
      ...price, special_requests, created_by: req?.user?.id ?? null,
    });
    insert('booking_charges', { booking_id: id, description: `Room charge - ${type.name} x ${nights} night(s)`, amount: price.subtotal, type: 'room' });
    return getBooking(id);
  });
}

export function getBooking(id) {
  const b = get(
    `SELECT b.*, g.name AS guest_name, g.email AS guest_email, g.phone AS guest_phone, g.nic_passport, g.nationality,
            r.number AS room_number, rt.name AS room_type_name, rt.image_url AS room_image
     FROM bookings b JOIN guests g ON g.id=b.guest_id
     LEFT JOIN rooms r ON r.id=b.room_id JOIN room_types rt ON rt.id=b.room_type_id WHERE b.id=?`, [id]);
  if (!b) return null;
  b.charges = all('SELECT * FROM booking_charges WHERE booking_id=? ORDER BY id', [id]);
  b.payments = all('SELECT p.*, u.name AS received_by_name FROM payments p LEFT JOIN users u ON u.id=p.received_by WHERE p.booking_id=? ORDER BY p.id', [id]);
  const s = getSettings();
  const chargesTotal = b.charges.reduce((a, c) => a + c.amount, 0);
  const taxable = Math.max(0, chargesTotal - b.discount);
  b.folio_subtotal = chargesTotal;
  b.folio_tax = Math.round(taxable * (Number(s.tax_rate) || 0)) / 100;
  b.folio_total = taxable + b.folio_tax;
  b.paid = b.payments.reduce((a, p) => a + p.amount, 0);
  b.balance = b.folio_total - b.paid;
  return b;
}

export function recalcBooking(id) {
  const b = getBooking(id);
  if (!b) return null;
  update('bookings', id, { subtotal: b.folio_subtotal, tax: b.folio_tax, total: b.folio_total });
  return getBooking(id);
}

export function safeJson(v, fallback) {
  try { return typeof v === 'string' ? JSON.parse(v) : v ?? fallback; } catch { return fallback; }
}
