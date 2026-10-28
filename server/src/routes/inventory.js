import { Router } from 'express';
import { all, get, insert, update, audit, nextCode, transaction, daysAgo } from '../db.js';
import { requireModule } from '../auth.js';
import { crud } from './crud.js';
import { moveStock } from '../services/stock.js';

const r = Router();

r.use('/suppliers', requireModule('suppliers'), crud({
  table: 'suppliers', alias: 's',
  fields: ['name', 'contact_person', 'phone', 'email', 'address', 'category', 'notes'],
  listSql: `SELECT s.*, (SELECT COUNT(*) FROM purchases WHERE supplier_id=s.id) AS purchase_count,
            (SELECT COALESCE(SUM(total-paid),0) FROM purchases WHERE supplier_id=s.id) AS outstanding FROM suppliers s`,
  orderBy: 's.name', searchCols: ['s.name', 's.contact_person', 's.phone'],
}));

r.get('/inventory/summary', requireModule('inventory'), async (req, res) => {
  const items = await all('SELECT * FROM inventory_items WHERE active=1');
  const low = items.filter((i) => i.qty_on_hand <= i.reorder_level);
  const value = items.reduce((a, i) => a + i.qty_on_hand * i.cost_price, 0);
  const empties = items.filter((i) => i.returnable_bottle).reduce((a, i) => a + i.empties_on_hand, 0);
  const depositValue = items.filter((i) => i.returnable_bottle).reduce((a, i) => a + i.empties_on_hand * i.bottle_deposit, 0);
  res.json({ total_items: items.length, low_stock: low.length, stock_value: value, empties_on_hand: empties, empties_deposit_value: depositValue, low_items: low });
});

r.use('/inventory', requireModule('inventory'), crud({
  table: 'inventory_items', alias: 'i',
  fields: ['sku', 'name', 'category', 'unit', 'unit_size', 'qty_on_hand', 'reorder_level', 'cost_price', 'sell_price', 'supplier_id', 'returnable_bottle', 'bottle_deposit', 'empties_on_hand', 'location', 'active'],
  listSql: 'SELECT i.*, s.name AS supplier_name FROM inventory_items i LEFT JOIN suppliers s ON s.id=i.supplier_id',
  orderBy: 'i.category, i.name', searchCols: ['i.name', 'i.sku'],
  beforeInsert: async (b) => { if (!b.sku) b.sku = await nextCode('SKU', 'inventory_items', 'sku'); },
}));

r.get('/inventory/:id/movements', requireModule('inventory'), async (req, res) => {
  res.json(await all('SELECT m.*, u.name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id=m.user_id WHERE inventory_item_id=? ORDER BY m.id DESC LIMIT 200', [req.params.id]));
});

r.post('/inventory/:id/adjust', requireModule('inventory'), async (req, res) => {
  const { qty, type = 'adjustment', note = '' } = req.body;
  const allowed = ['adjustment', 'wastage', 'breakage', 'transfer', 'opening', 'return', 'consumption'];
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid movement type' });
  if (!qty) return res.status(400).json({ error: 'qty is required (negative for stock out)' });
  try {
    const item = await moveStock(req.params.id, Number(qty), type, null, note, req.user.id);
    await audit(req, 'adjust', 'inventory_items', req.params.id, { qty, type, note });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

r.get('/stock-movements', requireModule('inventory'), async (req, res) => {
  const { type, from, to } = req.query;
  const where = []; const p = [];
  if (type) { where.push('m.type=?'); p.push(type); }
  if (from) { where.push('substr(m.created_at,1,10)>=?'); p.push(from); }
  if (to) { where.push('substr(m.created_at,1,10)<=?'); p.push(to); }
  res.json(await all(`SELECT m.*, i.name AS item_name, i.unit, u.name AS user_name FROM stock_movements m JOIN inventory_items i ON i.id=m.inventory_item_id LEFT JOIN users u ON u.id=m.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC LIMIT 500`, p));
});

// ---------- Purchases ----------
r.get('/purchases', requireModule('purchases'), async (req, res) => {
  res.json(await all(`SELECT p.*, s.name AS supplier_name, (SELECT COUNT(*) FROM purchase_items WHERE purchase_id=p.id) AS line_count FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.date DESC, p.id DESC LIMIT 500`));
});
r.get('/purchases/:id', requireModule('purchases'), async (req, res) => {
  const p = await get('SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.items = await all('SELECT pi.*, i.name AS item_name, i.unit FROM purchase_items pi JOIN inventory_items i ON i.id=pi.inventory_item_id WHERE purchase_id=?', [p.id]);
  res.json(p);
});
r.post('/purchases', requireModule('purchases'), async (req, res) => {
  const { supplier_id, invoice_no = '', date, notes = '', items = [], paid = 0, status = 'received' } = req.body;
  if (!items.length) return res.status(400).json({ error: 'Add at least one item' });
  try {
    const id = await transaction(async () => {
      const total = items.reduce((a, i) => a + Number(i.qty) * Number(i.unit_cost), 0);
      const id = await insert('purchases', { code: await nextCode('PO', 'purchases'), supplier_id: supplier_id || null, invoice_no, date: date || new Date().toISOString().slice(0, 10), total, paid: Number(paid) || 0, status: Number(paid) >= total ? 'paid' : status, notes, created_by: req.user.id });
      for (const it of items) {
        await insert('purchase_items', { purchase_id: id, inventory_item_id: it.inventory_item_id, qty: Number(it.qty), unit_cost: Number(it.unit_cost) });
        if (status !== 'ordered') {
          await moveStock(it.inventory_item_id, Number(it.qty), 'purchase', `PO#${id}`, invoice_no ? `Supplier inv ${invoice_no}` : null, req.user.id);
          await update('inventory_items', it.inventory_item_id, { cost_price: Number(it.unit_cost) });
        }
      }
      return id;
    });
    await audit(req, 'create', 'purchases', id);
    res.status(201).json(await get('SELECT * FROM purchases WHERE id=?', [id]));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
r.post('/purchases/:id/receive', requireModule('purchases'), async (req, res) => {
  const p = await get('SELECT * FROM purchases WHERE id=?', [req.params.id]);
  if (!p || p.status !== 'ordered') return res.status(400).json({ error: 'Purchase is not in ordered state' });
  await transaction(async () => {
    for (const it of await all('SELECT * FROM purchase_items WHERE purchase_id=?', [p.id])) {
      await moveStock(it.inventory_item_id, it.qty, 'purchase', `PO#${p.id}`, 'Goods received', req.user.id);
      await update('inventory_items', it.inventory_item_id, { cost_price: it.unit_cost });
    }
    await update('purchases', p.id, { status: p.paid >= p.total ? 'paid' : 'received' });
  });
  res.json(await get('SELECT * FROM purchases WHERE id=?', [p.id]));
});
r.post('/purchases/:id/pay', requireModule('purchases'), async (req, res) => {
  const p = await get('SELECT * FROM purchases WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const amt = Number(req.body.amount) || (p.total - p.paid);
  const paid = Math.min(p.total, p.paid + amt);
  await update('purchases', p.id, { paid, status: paid >= p.total ? 'paid' : p.status });
  const sup = p.supplier_id ? await get('SELECT name FROM suppliers WHERE id=?', [p.supplier_id]) : null;
  await insert('expenses', { category: 'purchases', description: `Supplier payment ${p.code}${p.invoice_no ? ' (' + p.invoice_no + ')' : ''}`, amount: amt, date: new Date().toISOString().slice(0, 10), paid_to: sup?.name || 'Supplier', method: req.body.method || 'cash', reference: p.code, created_by: req.user.id });
  await audit(req, 'pay', 'purchases', p.id, { amount: amt });
  res.json(await get('SELECT * FROM purchases WHERE id=?', [p.id]));
});

// ---------- Empty bottles ----------
r.get('/empty-bottles', requireModule('empty-bottles'), async (req, res) => {
  const items = await all(`SELECT i.id, i.name, i.unit_size, i.qty_on_hand, i.empties_on_hand, i.bottle_deposit, i.supplier_id, s.name AS supplier_name,
      (SELECT COALESCE(SUM(qty),0) FROM empty_bottle_log WHERE inventory_item_id=i.id AND action='returned') AS total_returned,
      (SELECT COALESCE(SUM(qty),0) FROM empty_bottle_log WHERE inventory_item_id=i.id AND action='broken') AS total_broken,
      (SELECT COALESCE(SUM(amount),0) FROM empty_bottle_log WHERE inventory_item_id=i.id AND action='returned') AS deposit_recovered
      FROM inventory_items i LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE i.returnable_bottle=1 AND i.active=1 ORDER BY i.name`);
  const log = await all('SELECT l.*, i.name AS item_name, s.name AS supplier_name, u.name AS user_name FROM empty_bottle_log l JOIN inventory_items i ON i.id=l.inventory_item_id LEFT JOIN suppliers s ON s.id=l.supplier_id LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 200');
  const d30 = daysAgo(30);
  const summary = {
    empties_on_hand: items.reduce((a, i) => a + i.empties_on_hand, 0),
    deposit_value: items.reduce((a, i) => a + i.empties_on_hand * i.bottle_deposit, 0),
    returned_30d: (await get(`SELECT COALESCE(SUM(qty),0) AS q FROM empty_bottle_log WHERE action='returned' AND substr(created_at,1,10)>=${d30}`)).q,
    broken_30d: (await get(`SELECT COALESCE(SUM(qty),0) AS q FROM empty_bottle_log WHERE action IN ('broken','lost') AND substr(created_at,1,10)>=${d30}`)).q,
    recovered_30d: (await get(`SELECT COALESCE(SUM(amount),0) AS a FROM empty_bottle_log WHERE action='returned' AND substr(created_at,1,10)>=${d30}`)).a,
  };
  res.json({ items, log, summary });
});

/** action: collected (add empties manually), returned (to supplier, deposit refund), broken, lost, adjust */
r.post('/empty-bottles', requireModule('empty-bottles'), async (req, res) => {
  const { inventory_item_id, qty, action, supplier_id, note = '', amount } = req.body;
  const item = await get('SELECT * FROM inventory_items WHERE id=? AND returnable_bottle=1', [inventory_item_id]);
  if (!item) return res.status(400).json({ error: 'Item is not a returnable bottle' });
  const q = Number(qty);
  if (!q || q <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
  if (!['collected', 'returned', 'broken', 'lost', 'adjust'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const delta = action === 'collected' ? q : action === 'adjust' ? Number(req.body.delta ?? q) : -q;
  if (action !== 'collected' && action !== 'adjust' && q > item.empties_on_hand) return res.status(400).json({ error: `Only ${item.empties_on_hand} empties on hand` });
  const amt = amount != null ? Number(amount) : action === 'returned' ? q * item.bottle_deposit : action === 'broken' || action === 'lost' ? q * item.bottle_deposit : 0;
  await transaction(async () => {
    await update('inventory_items', item.id, { empties_on_hand: Math.max(0, item.empties_on_hand + delta) });
    await insert('empty_bottle_log', { inventory_item_id: item.id, qty: q, action, supplier_id: supplier_id || item.supplier_id || null, amount: amt, note, user_id: req.user.id });
    if (['broken', 'lost'].includes(action) && amt > 0) {
      await insert('expenses', { category: 'breakage', description: `${action === 'broken' ? 'Broken' : 'Lost'} empties - ${item.name} x${q}`, amount: amt, date: new Date().toISOString().slice(0, 10), paid_to: 'Deposit forfeited', method: 'other', created_by: req.user.id });
    }
  });
  await audit(req, action, 'empty_bottles', item.id, { qty: q, amount: amt });
  res.json({ ok: true });
});

export default r;
