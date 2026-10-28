import { Router } from 'express';
import { all, get, insert, update, audit, localDate, todayLocal, TIMEZONE } from '../db.js';
import { requireModule } from '../auth.js';
import { crud } from './crud.js';

const r = Router();

r.use('/expenses', requireModule('expenses'), crud({
  table: 'expenses', alias: 'x',
  fields: ['category', 'description', 'amount', 'date', 'paid_to', 'method', 'reference'],
  listSql: 'SELECT x.*, u.name AS created_by_name FROM expenses x LEFT JOIN users u ON u.id=x.created_by',
  orderBy: 'x.date DESC, x.id DESC', searchCols: ['x.description', 'x.paid_to', 'x.category'],
  beforeInsert: (b, req) => { b.created_by = req.user.id; },
}));

r.get('/invoices', requireModule('invoices'), async (req, res) => {
  const { type, status, from, to, q } = req.query;
  const where = []; const p = [];
  if (type) { where.push('type=?'); p.push(type); }
  if (status) { where.push('status=?'); p.push(status); }
  if (from) { where.push('date>=?'); p.push(from); }
  if (to) { where.push('date<=?'); p.push(to); }
  if (q) { where.push('(number ILIKE ? OR guest_name ILIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  res.json(await all(`SELECT * FROM invoices ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, p));
});
r.get('/invoices/:id', requireModule('invoices'), async (req, res) => {
  const inv = await get('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  try { inv.items = JSON.parse(inv.items || '[]'); } catch { inv.items = []; }
  inv.payments = inv.type === 'room' ? await all('SELECT * FROM payments WHERE booking_id=?', [inv.ref_id]) : await all('SELECT * FROM payments WHERE order_id=?', [inv.ref_id]);
  if (inv.type === 'room') inv.booking = await get('SELECT b.*, g.name AS guest_name, g.email, g.phone, g.address, r.number AS room_number, rt.name AS room_type_name FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id JOIN room_types rt ON rt.id=b.room_type_id WHERE b.id=?', [inv.ref_id]);
  else inv.order = await get('SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id=o.table_id WHERE o.id=?', [inv.ref_id]);
  res.json(inv);
});
r.post('/invoices/:id/pay', requireModule('payments'), async (req, res) => {
  const inv = await get('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const amount = Number(req.body.amount) || (inv.total - inv.paid);
  if (amount <= 0) return res.status(400).json({ error: 'Nothing to pay' });
  await insert('payments', { booking_id: inv.type === 'room' ? inv.ref_id : null, order_id: inv.type !== 'room' ? inv.ref_id : null, invoice_id: inv.id, amount, method: req.body.method || 'cash', reference: req.body.reference || '', received_by: req.user.id });
  const paid = inv.paid + amount;
  await update('invoices', inv.id, { paid, status: paid >= inv.total - 0.5 ? 'paid' : 'partial' });
  await audit(req, 'payment', 'invoices', inv.id, { amount });
  res.json(await get('SELECT * FROM invoices WHERE id=?', [inv.id]));
});

r.get('/payments', requireModule('payments'), async (req, res) => {
  const { from, to, method } = req.query;
  const where = []; const p = [];
  if (from) { where.push(`${localDate('p.created_at')}>=?`); p.push(from); }
  if (to) { where.push(`${localDate('p.created_at')}<=?`); p.push(to); }
  if (method) { where.push('p.method=?'); p.push(method); }
  res.json(await all(`SELECT p.*, u.name AS received_by_name, b.code AS booking_code, o.code AS order_code, g.name AS guest_name
    FROM payments p LEFT JOIN users u ON u.id=p.received_by LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN guests g ON g.id=b.guest_id LEFT JOIN orders o ON o.id=p.order_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC LIMIT 500`, p));
});

// ---------- Reports ----------
r.get('/reports/summary', requireModule('reports'), async (req, res) => {
  const from = req.query.from || todayLocal(-29);
  const to = req.query.to || todayLocal();
  const v = async (sql, p) => (await get(sql, p)).v;
  const roomRev = await v("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='room' AND date BETWEEN ? AND ?", [from, to]);
  const restRev = await v("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='restaurant' AND date BETWEEN ? AND ?", [from, to]);
  const barRev = await v("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='bar' AND date BETWEEN ? AND ?", [from, to]);
  const taxCollected = await v('SELECT COALESCE(SUM(tax),0) AS v FROM invoices WHERE date BETWEEN ? AND ?', [from, to]);
  const serviceCharge = await v('SELECT COALESCE(SUM(service_charge),0) AS v FROM invoices WHERE date BETWEEN ? AND ?', [from, to]);
  const payments = await v(`SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE ${localDate('created_at')} BETWEEN ? AND ?`, [from, to]);
  const expensesByCat = await all('SELECT category, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC', [from, to]);
  const expenses = expensesByCat.reduce((a, x) => a + x.amount, 0);
  const purchasesUnpaid = await v('SELECT COALESCE(SUM(total-paid),0) AS v FROM purchases');
  const receivables = await v("SELECT COALESCE(SUM(total-paid),0) AS v FROM invoices WHERE status!='paid'");
  // sales, minus stock put back when order items are cancelled ('return' movements with an ORD# ref)
  const cogs = await v(`SELECT COALESCE(SUM(-m.qty * i.cost_price),0) AS v FROM stock_movements m JOIN inventory_items i ON i.id=m.inventory_item_id
    WHERE (m.type='sale' OR (m.type='return' AND m.ref LIKE 'ORD#%')) AND ${localDate('m.created_at')} BETWEEN ? AND ?`, [from, to]);
  const daily = await all(`SELECT date, SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type='restaurant' THEN total ELSE 0 END) AS restaurant, SUM(CASE WHEN type='bar' THEN total ELSE 0 END) AS bar FROM invoices WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`, [from, to]);
  const expDaily = await all('SELECT date, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY date', [from, to]);
  const paymentsByMethod = await all(`SELECT method, SUM(amount) AS amount FROM payments WHERE ${localDate('created_at')} BETWEEN ? AND ? GROUP BY method`, [from, to]);
  const totalRooms = (await get('SELECT COUNT(*) AS c FROM rooms')).c;
  const nightsSold = await v("SELECT COALESCE(SUM(nights),0) AS v FROM bookings WHERE status IN ('checked_in','checked_out') AND check_in BETWEEN ? AND ?", [from, to]);
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const occupancy = totalRooms ? Math.round((nightsSold / (totalRooms * days)) * 1000) / 10 : 0;
  const adr = nightsSold ? Math.round(roomRev / nightsSold) : 0;
  const topItems = await all(`SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty*oi.price) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND ${localDate('o.created_at')} BETWEEN ? AND ? AND oi.status!='cancelled' GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`, [from, to]);
  const bookingSources = await all("SELECT source, COUNT(*) AS count, SUM(total) AS revenue FROM bookings WHERE status!='cancelled' AND check_in BETWEEN ? AND ? GROUP BY source", [from, to]);
  res.json({
    from, to, revenue: { room: roomRev, restaurant: restRev, bar: barRev, total: roomRev + restRev + barRev },
    tax_collected: taxCollected, service_charge: serviceCharge, payments_received: payments, expenses, expenses_by_category: expensesByCat,
    cogs, gross_profit: roomRev + restRev + barRev - cogs, net_profit: roomRev + restRev + barRev - cogs - expenses,
    purchases_unpaid: purchasesUnpaid, receivables, daily, expenses_daily: expDaily, payments_by_method: paymentsByMethod,
    occupancy, adr, nights_sold: nightsSold, top_items: topItems, booking_sources: bookingSources,
  });
});

r.get('/reports/monthly', requireModule('reports'), async (req, res) => {
  const since = `to_char(date_trunc('month', now() at time zone '${TIMEZONE}') - interval '11 months','YYYY-MM-DD')`;
  const rows = await all(`SELECT substr(date,1,7) AS month,
      SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type='restaurant' THEN total ELSE 0 END) AS restaurant, SUM(CASE WHEN type='bar' THEN total ELSE 0 END) AS bar
      FROM invoices WHERE date >= ${since} GROUP BY substr(date,1,7) ORDER BY month`);
  const exp = await all(`SELECT substr(date,1,7) AS month, SUM(amount) AS expenses FROM expenses WHERE date >= ${since} GROUP BY substr(date,1,7)`);
  res.json(rows.map((m) => ({ ...m, expenses: exp.find((e) => e.month === m.month)?.expenses || 0 })));
});

export default r;
