import { Router } from 'express';
import { all, get, insert, update, run, audit, nextCode, getSettings, transaction, SQL_TODAY } from '../db.js';
import { requireModule } from '../auth.js';
import { crud } from './crud.js';
import { recalcBooking } from '../services/booking.js';
import { moveStock } from '../services/stock.js';

const r = Router();

// ---------- Tables ----------
r.use('/tables', requireModule('tables'), crud({
  table: 'tables', alias: 't',
  fields: ['name', 'area', 'capacity', 'status', 'x', 'y', 'shape'],
  listSql: `SELECT t.*, (SELECT o.id FROM orders o WHERE o.table_id=t.id AND o.status IN ('open','billed') ORDER BY o.id DESC LIMIT 1) AS open_order_id,
            (SELECT o.total FROM orders o WHERE o.table_id=t.id AND o.status IN ('open','billed') ORDER BY o.id DESC LIMIT 1) AS open_order_total,
            (SELECT o.created_at FROM orders o WHERE o.table_id=t.id AND o.status IN ('open','billed') ORDER BY o.id DESC LIMIT 1) AS occupied_since,
            (SELECT tr.guest_name FROM table_reservations tr WHERE tr.table_id=t.id AND tr.date=${SQL_TODAY} AND tr.status='booked' ORDER BY tr.time LIMIT 1) AS reserved_for,
            (SELECT tr.time FROM table_reservations tr WHERE tr.table_id=t.id AND tr.date=${SQL_TODAY} AND tr.status='booked' ORDER BY tr.time LIMIT 1) AS reserved_time
            FROM tables t`,
  orderBy: 't.area, t.id',
}));

r.use('/table-reservations', requireModule('tables'), crud({
  table: 'table_reservations', alias: 'tr',
  fields: ['table_id', 'guest_name', 'phone', 'date', 'time', 'party_size', 'status', 'notes'],
  listSql: 'SELECT tr.*, t.name AS table_name, t.area FROM table_reservations tr LEFT JOIN tables t ON t.id=tr.table_id',
  orderBy: 'tr.date DESC, tr.time',
  searchCols: ['tr.guest_name', 'tr.phone'],
}));

// ---------- Menu ----------
r.use('/menu/categories', requireModule('menu'), crud({ table: 'menu_categories', fields: ['name', 'type', 'sort'], orderBy: 'sort, name' }));
r.use('/menu/items', requireModule('menu'), crud({
  table: 'menu_items', alias: 'm',
  fields: ['category_id', 'name', 'description', 'price', 'cost', 'inventory_item_id', 'portion_qty', 'active', 'image_url', 'tags'],
  listSql: `SELECT m.*, c.name AS category_name, c.type AS category_type, i.name AS inventory_name, i.qty_on_hand AS stock_qty, i.unit AS stock_unit
            FROM menu_items m LEFT JOIN menu_categories c ON c.id=m.category_id LEFT JOIN inventory_items i ON i.id=m.inventory_item_id`,
  orderBy: 'c.sort, m.name',
  searchCols: ['m.name'],
}));

// ---------- Orders ----------
async function orderTotals(orderId, discount = null) {
  const s = await getSettings();
  const o = await get('SELECT * FROM orders WHERE id=?', [orderId]);
  const items = await all("SELECT * FROM order_items WHERE order_id=? AND status!='cancelled'", [orderId]);
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const disc = discount != null ? Number(discount) : o.discount;
  const service_charge = Math.round((subtotal - disc) * (Number(s.service_charge_rate) || 0)) / 100;
  const tax = Math.round((subtotal - disc + service_charge) * (Number(s.tax_rate) || 0)) / 100;
  await update('orders', orderId, { subtotal, discount: disc, service_charge, tax, total: subtotal - disc + service_charge + tax });
}

export async function getOrder(id) {
  const o = await get(`SELECT o.*, t.name AS table_name, t.area, e.name AS waiter_name, b.code AS booking_code, g.name AS guest_name, r.number AS room_number
                 FROM orders o LEFT JOIN tables t ON t.id=o.table_id LEFT JOIN employees e ON e.id=o.waiter_id
                 LEFT JOIN bookings b ON b.id=o.booking_id LEFT JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id WHERE o.id=?`, [id]);
  if (!o) return null;
  o.items = await all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [id]);
  o.payments = await all('SELECT * FROM payments WHERE order_id=? ORDER BY id', [id]);
  o.paid = o.payments.reduce((a, p) => a + p.amount, 0);
  return o;
}

r.get('/orders', requireModule('orders'), async (req, res) => {
  const { status, date, table_id, area, q } = req.query;
  const where = []; const p = [];
  if (status) { where.push(status.includes(',') ? `o.status IN (${status.split(',').map(() => '?').join(',')})` : 'o.status=?'); p.push(...status.split(',')); }
  if (date) { where.push('substr(o.created_at,1,10)=?'); p.push(date); }
  if (table_id) { where.push('o.table_id=?'); p.push(table_id); }
  if (area) { where.push('t.area=?'); p.push(area); }
  if (q) { where.push('(o.code ILIKE ? OR t.name ILIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  res.json(await all(`SELECT o.*, t.name AS table_name, t.area, e.name AS waiter_name, b.code AS booking_code, r.number AS room_number,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id AND oi.status!='cancelled') AS item_count,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id AND oi.status IN ('pending','preparing')) AS pending_items
      FROM orders o LEFT JOIN tables t ON t.id=o.table_id LEFT JOIN employees e ON e.id=o.waiter_id LEFT JOIN bookings b ON b.id=o.booking_id LEFT JOIN rooms r ON r.id=b.room_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 300`, p));
});

r.get('/orders/kitchen', requireModule('orders'), async (req, res) => {
  res.json(await all(`SELECT oi.*, o.code, o.table_id, t.name AS table_name, o.type, o.room_number FROM order_items oi
     JOIN (SELECT o.*, r.number AS room_number FROM orders o LEFT JOIN bookings b ON b.id=o.booking_id LEFT JOIN rooms r ON r.id=b.room_id) o ON o.id=oi.order_id
     LEFT JOIN tables t ON t.id=o.table_id
     WHERE o.status='open' AND oi.status IN ('pending','preparing','ready') ORDER BY oi.created_at`));
});

r.get('/orders/:id', requireModule('orders'), async (req, res) => {
  const o = await getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  res.json(o);
});

r.post('/orders', requireModule('orders'), async (req, res) => {
  const { table_id = null, booking_id = null, type = 'dine_in', covers = 1, notes = '', items = [] } = req.body;
  try {
    const id = await transaction(async () => {
      if (table_id) {
        const existing = await get("SELECT id FROM orders WHERE table_id=? AND status IN ('open','billed')", [table_id]);
        if (existing) throw new Error('This table already has an open order. Add items to it instead.');
      }
      const id = await insert('orders', { code: await nextCode('ORD', 'orders'), table_id, booking_id, type, covers, notes, waiter_id: req.user.employee_id || null });
      await addItems(id, items, req);
      if (table_id) await update('tables', table_id, { status: 'occupied' });
      await orderTotals(id);
      return id;
    });
    await audit(req, 'create', 'orders', id);
    res.status(201).json(await getOrder(id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

async function addItems(orderId, items, req) {
  for (const it of items) {
    const mi = await get('SELECT * FROM menu_items WHERE id=?', [it.menu_item_id]);
    if (!mi) throw new Error('Menu item not found');
    const qty = Number(it.qty) || 1;
    await insert('order_items', { order_id: orderId, menu_item_id: mi.id, name: mi.name, qty, price: mi.price, notes: it.notes || '', status: 'pending' });
    if (mi.inventory_item_id) await moveStock(mi.inventory_item_id, -(qty * (mi.portion_qty || 1)), 'sale', `ORD#${orderId}`, `${mi.name} x${qty}`, req?.user?.id);
  }
}

r.post('/orders/:id/items', requireModule('orders'), async (req, res) => {
  const o = await get('SELECT * FROM orders WHERE id=?', [req.params.id]);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'Order is not open' });
  try {
    await transaction(async () => { await addItems(o.id, req.body.items || [], req); await orderTotals(o.id); });
    res.json(await getOrder(o.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.put('/orders/:id/items/:itemId', requireModule('orders'), async (req, res) => {
  const item = await get('SELECT * FROM order_items WHERE id=? AND order_id=?', [req.params.itemId, req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const { status, qty, notes } = req.body;
  await transaction(async () => {
    const patch = {};
    if (status) patch.status = status;
    if (notes !== undefined) patch.notes = notes;
    if (qty != null && Number(qty) !== item.qty) {
      const mi = item.menu_item_id ? await get('SELECT * FROM menu_items WHERE id=?', [item.menu_item_id]) : null;
      if (mi?.inventory_item_id) await moveStock(mi.inventory_item_id, -((Number(qty) - item.qty) * (mi.portion_qty || 1)), 'sale', `ORD#${item.order_id}`, `qty change ${mi.name}`, req.user.id);
      patch.qty = Number(qty);
    }
    if (status === 'cancelled' && item.status !== 'cancelled') {
      const mi = item.menu_item_id ? await get('SELECT * FROM menu_items WHERE id=?', [item.menu_item_id]) : null;
      if (mi?.inventory_item_id) await moveStock(mi.inventory_item_id, item.qty * (mi.portion_qty || 1), 'return', `ORD#${item.order_id}`, `cancelled ${mi.name}`, req.user.id);
    }
    await update('order_items', item.id, patch);
    await orderTotals(item.order_id);
  });
  res.json(await getOrder(req.params.id));
});

r.put('/orders/:id', requireModule('orders'), async (req, res) => {
  const o = await get('SELECT * FROM orders WHERE id=?', [req.params.id]);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const { discount, notes, covers, table_id, booking_id } = req.body;
  await transaction(async () => {
    const patch = {};
    if (notes !== undefined) patch.notes = notes;
    if (covers !== undefined) patch.covers = covers;
    if (booking_id !== undefined) patch.booking_id = booking_id || null;
    if (table_id !== undefined && table_id !== o.table_id) {
      if (o.table_id) await update('tables', o.table_id, { status: 'free' });
      if (table_id) await update('tables', table_id, { status: 'occupied' });
      patch.table_id = table_id || null;
    }
    await update('orders', o.id, patch);
    await orderTotals(o.id, discount != null ? discount : null);
  });
  res.json(await getOrder(o.id));
});

/** Bill / settle an order. mode: 'pay' (take payment), 'room' (charge to room folio) */
r.post('/orders/:id/settle', requireModule('orders'), async (req, res) => {
  const o = await getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  if (!['open', 'billed'].includes(o.status)) return res.status(400).json({ error: 'Order already settled' });
  const { mode = 'pay', method = 'cash', amount, reference = '', booking_id } = req.body;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    await transaction(async () => {
      await run("UPDATE order_items SET status='served' WHERE order_id=? AND status IN ('pending','preparing','ready')", [o.id]);
      if (mode === 'room') {
        const bid = booking_id || o.booking_id;
        const b = bid ? await get("SELECT * FROM bookings WHERE id=? AND status='checked_in'", [bid]) : null;
        if (!b) throw new Error('Select an in-house booking to charge this order to');
        await insert('booking_charges', { booking_id: b.id, description: `${o.area === 'bar' ? 'Bar' : 'Restaurant'} ${o.code} - ${o.items.filter((i) => i.status !== 'cancelled').map((i) => `${i.name} x${i.qty}`).join(', ')}`, amount: o.total, type: o.area === 'bar' ? 'bar' : 'restaurant', ref_id: o.id });
        await recalcBooking(b.id);
        await update('orders', o.id, { status: 'billed', booking_id: b.id, closed_at: now });
      } else {
        const due = o.total - o.paid;
        const pay = Math.min(due, amount != null ? Number(amount) : due); // cash tendered above due is change, not revenue
        if (pay > 0) await insert('payments', { order_id: o.id, amount: pay, method, reference, received_by: req.user.id });
        const paidTotal = o.paid + Math.max(0, pay);
        if (paidTotal < o.total - 0.5) {
          await update('orders', o.id, { status: 'billed' });
        } else {
          await update('orders', o.id, { status: 'paid', closed_at: now });
          await insert('invoices', {
            number: await nextCode(o.area === 'bar' ? 'INV-B-' : 'INV-F-', 'invoices', 'number'), type: o.area === 'bar' ? 'bar' : 'restaurant', ref_id: o.id,
            guest_name: o.guest_name || (o.table_name ? `Table ${o.table_name}` : 'Walk-in'), subtotal: o.subtotal, tax: o.tax, service_charge: o.service_charge,
            discount: o.discount, total: o.total, paid: paidTotal, status: 'paid', items: o.items,
          });
        }
      }
      const st = (await get('SELECT status FROM orders WHERE id=?', [o.id])).status;
      if (o.table_id && ['billed', 'paid'].includes(st)) await update('tables', o.table_id, { status: 'free' });
    });
    await audit(req, 'settle', 'orders', o.id, { mode, method, amount });
    res.json(await getOrder(o.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.post('/orders/:id/cancel', requireModule('orders'), async (req, res) => {
  const o = await getOrder(req.params.id);
  if (!o || o.status !== 'open') return res.status(400).json({ error: 'Only open orders can be cancelled' });
  await transaction(async () => {
    for (const it of o.items.filter((i) => i.status !== 'cancelled')) {
      const mi = it.menu_item_id ? await get('SELECT * FROM menu_items WHERE id=?', [it.menu_item_id]) : null;
      if (mi?.inventory_item_id) await moveStock(mi.inventory_item_id, it.qty * (mi.portion_qty || 1), 'return', `ORD#${o.id}`, 'order cancelled', req.user.id);
    }
    await run("UPDATE order_items SET status='cancelled' WHERE order_id=?", [o.id]);
    await update('orders', o.id, { status: 'cancelled', closed_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
    if (o.table_id) await update('tables', o.table_id, { status: 'free' });
  });
  await audit(req, 'cancel', 'orders', o.id);
  res.json(await getOrder(o.id));
});

// in-house guests for "charge to room"
r.get('/inhouse', requireModule('orders'), async (req, res) => {
  res.json(await all("SELECT b.id, b.code, g.name AS guest_name, r.number AS room_number FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.status='checked_in' ORDER BY r.number"));
});

export default r;
