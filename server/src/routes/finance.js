import { Router } from 'express';
import { all, get, insert, update, audit } from '../db.js';
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

r.get('/invoices', requireModule('invoices'), (req, res) => {
  const { type, status, from, to, q } = req.query;
  const where = []; const p = [];
  if (type) { where.push('type=?'); p.push(type); }
  if (status) { where.push('status=?'); p.push(status); }
  if (from) { where.push('date>=?'); p.push(from); }
  if (to) { where.push('date<=?'); p.push(to); }
  if (q) { where.push('(number LIKE ? OR guest_name LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  res.json(all(`SELECT * FROM invoices ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, p));
});
r.get('/invoices/:id', requireModule('invoices'), (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  try { inv.items = JSON.parse(inv.items || '[]'); } catch { inv.items = []; }
  inv.payments = inv.type === 'room' ? all('SELECT * FROM payments WHERE booking_id=?', [inv.ref_id]) : all('SELECT * FROM payments WHERE order_id=?', [inv.ref_id]);
  if (inv.type === 'room') inv.booking = get('SELECT b.*, g.name AS guest_name, g.email, g.phone, g.address, r.number AS room_number, rt.name AS room_type_name FROM bookings b JOIN guests g ON g.id=b.guest_id LEFT JOIN rooms r ON r.id=b.room_id JOIN room_types rt ON rt.id=b.room_type_id WHERE b.id=?', [inv.ref_id]);
  else inv.order = get('SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id=o.table_id WHERE o.id=?', [inv.ref_id]);
  res.json(inv);
});
r.post('/invoices/:id/pay', requireModule('payments'), (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id=?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const amount = Number(req.body.amount) || (inv.total - inv.paid);
  if (amount <= 0) return res.status(400).json({ error: 'Nothing to pay' });
  insert('payments', { booking_id: inv.type === 'room' ? inv.ref_id : null, order_id: inv.type !== 'room' ? inv.ref_id : null, invoice_id: inv.id, amount, method: req.body.method || 'cash', reference: req.body.reference || '', received_by: req.user.id });
  const paid = inv.paid + amount;
  update('invoices', inv.id, { paid, status: paid >= inv.total - 0.5 ? 'paid' : 'partial' });
  audit(req, 'payment', 'invoices', inv.id, { amount });
  res.json(get('SELECT * FROM invoices WHERE id=?', [inv.id]));
});

r.get('/payments', requireModule('payments'), (req, res) => {
  const { from, to, method } = req.query;
  const where = []; const p = [];
  if (from) { where.push('date(p.created_at)>=?'); p.push(from); }
  if (to) { where.push('date(p.created_at)<=?'); p.push(to); }
  if (method) { where.push('p.method=?'); p.push(method); }
  res.json(all(`SELECT p.*, u.name AS received_by_name, b.code AS booking_code, o.code AS order_code, g.name AS guest_name
    FROM payments p LEFT JOIN users u ON u.id=p.received_by LEFT JOIN bookings b ON b.id=p.booking_id LEFT JOIN guests g ON g.id=b.guest_id LEFT JOIN orders o ON o.id=p.order_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC LIMIT 500`, p));
});

// ---------- Reports ----------
r.get('/reports/summary', requireModule('reports'), (req, res) => {
  const from = req.query.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const roomRev = get("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='room' AND date BETWEEN ? AND ?", [from, to]).v;
  const restRev = get("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='restaurant' AND date BETWEEN ? AND ?", [from, to]).v;
  const barRev = get("SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE type='bar' AND date BETWEEN ? AND ?", [from, to]).v;
  const taxCollected = get('SELECT COALESCE(SUM(tax),0) AS v FROM invoices WHERE date BETWEEN ? AND ?', [from, to]).v;
  const serviceCharge = get('SELECT COALESCE(SUM(service_charge),0) AS v FROM invoices WHERE date BETWEEN ? AND ?', [from, to]).v;
  const payments = get('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE date(created_at) BETWEEN ? AND ?', [from, to]).v;
  const expensesByCat = all('SELECT category, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC', [from, to]);
  const expenses = expensesByCat.reduce((a, x) => a + x.amount, 0);
  const purchasesUnpaid = get('SELECT COALESCE(SUM(total-paid),0) AS v FROM purchases').v;
  const receivables = get("SELECT COALESCE(SUM(total-paid),0) AS v FROM invoices WHERE status!='paid'").v;
  const cogs = get("SELECT COALESCE(SUM(-m.qty * i.cost_price),0) AS v FROM stock_movements m JOIN inventory_items i ON i.id=m.inventory_item_id WHERE m.type='sale' AND date(m.created_at) BETWEEN ? AND ?", [from, to]).v;
  const daily = all(`SELECT date, SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type='restaurant' THEN total ELSE 0 END) AS restaurant, SUM(CASE WHEN type='bar' THEN total ELSE 0 END) AS bar FROM invoices WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`, [from, to]);
  const expDaily = all('SELECT date, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY date', [from, to]);
  const paymentsByMethod = all('SELECT method, SUM(amount) AS amount FROM payments WHERE date(created_at) BETWEEN ? AND ? GROUP BY method', [from, to]);
  const totalRooms = get('SELECT COUNT(*) AS c FROM rooms').c;
  const nightsSold = get("SELECT COALESCE(SUM(nights),0) AS v FROM bookings WHERE status IN ('checked_in','checked_out') AND check_in BETWEEN ? AND ?", [from, to]).v;
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const occupancy = totalRooms ? Math.round((nightsSold / (totalRooms * days)) * 1000) / 10 : 0;
  const adr = nightsSold ? Math.round(roomRev / nightsSold) : 0;
  const topItems = all(`SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty*oi.price) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='paid' AND date(o.created_at) BETWEEN ? AND ? AND oi.status!='cancelled' GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`, [from, to]);
  const bookingSources = all("SELECT source, COUNT(*) AS count, SUM(total) AS revenue FROM bookings WHERE status!='cancelled' AND check_in BETWEEN ? AND ? GROUP BY source", [from, to]);
  res.json({
    from, to, revenue: { room: roomRev, restaurant: restRev, bar: barRev, total: roomRev + restRev + barRev },
    tax_collected: taxCollected, service_charge: serviceCharge, payments_received: payments, expenses, expenses_by_category: expensesByCat,
    cogs, gross_profit: roomRev + restRev + barRev - cogs, net_profit: roomRev + restRev + barRev - cogs - expenses,
    purchases_unpaid: purchasesUnpaid, receivables, daily, expenses_daily: expDaily, payments_by_method: paymentsByMethod,
    occupancy, adr, nights_sold: nightsSold, top_items: topItems, booking_sources: bookingSources,
  });
});

r.get('/reports/monthly', requireModule('reports'), (req, res) => {
  const rows = all(`SELECT strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type='room' THEN total ELSE 0 END) AS room, SUM(CASE WHEN type='restaurant' THEN total ELSE 0 END) AS restaurant, SUM(CASE WHEN type='bar' THEN total ELSE 0 END) AS bar
      FROM invoices WHERE date >= date('now','-11 months','start of month') GROUP BY month ORDER BY month`);
  const exp = all("SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS expenses FROM expenses WHERE date >= date('now','-11 months','start of month') GROUP BY month");
  res.json(rows.map((m) => ({ ...m, expenses: exp.find((e) => e.month === m.month)?.expenses || 0 })));
});

export default r;
