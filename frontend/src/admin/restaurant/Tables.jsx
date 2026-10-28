import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, Search, Printer, BedDouble, Banknote, CreditCard, Loader2, Users, Clock, X, Pencil, ChefHat } from 'lucide-react';
import { api } from '../../lib/api';
import { money, timeAgo, fmtTime } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { PageHeader, Badge, Tabs, Modal, Field, Input, Select, useToast, Skeleton, Confirm } from '../../components/ui';

const AREAS = [{ value: 'restaurant', label: 'Restaurant' }, { value: 'bar', label: 'Bar' }, { value: 'outdoor', label: 'Outdoor' }];
const TABLE_STYLE = { free: 'bg-emerald-500/90 border-emerald-600', occupied: 'bg-sky-500/90 border-sky-600', reserved: 'bg-violet-500/90 border-violet-600', billed: 'bg-amber-500/90 border-amber-600' };

export default function Tables() {
  const toast = useToast();
  const [area, setArea] = useState('restaurant');
  const [tables, setTables] = useState(null);
  const [sel, setSel] = useState(null);       // table for POS
  const [edit, setEdit] = useState(null);     // table editor
  const [takeaway, setTakeaway] = useState(false);

  const load = useCallback(() => api.get('/api/tables').then(setTables).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const shown = tables?.filter((t) => t.area === area) || [];
  const counts = AREAS.map((a) => ({ ...a, count: tables?.filter((t) => t.area === a.value && t.status !== 'free').length }));
  const saveTable = async () => { try { if (edit.id) await api.put(`/api/tables/${edit.id}`, edit); else await api.post('/api/tables', { ...edit, area }); setEdit(null); load(); toast.success('Saved'); } catch (e) { toast.error(e.message); } };

  return (
    <div>
      <PageHeader title="Tables & POS" subtitle="Tap a table to take or manage an order" actions={<>
        <button className="btn-secondary" onClick={() => setTakeaway(true)}>Takeaway / Room service</button>
        <button className="btn-primary" onClick={() => setEdit({ name: '', capacity: 4, shape: 'square', x: 60, y: 60 })}><Plus size={16} /> Add table</button>
      </>} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs tabs={counts} value={area} onChange={setArea} />
        <div className="flex gap-3 text-xs">{Object.entries(TABLE_STYLE).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c.split(' ')[0]}`} />{k}</span>)}</div>
      </div>
      {!tables ? <Skeleton /> : (
        <div className="card p-4 overflow-auto">
          <div className="relative min-h-[460px] min-w-[640px] rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
            <AnimatePresence>
              {shown.map((t) => {
                const w = t.shape === 'rect' ? 150 : t.shape === 'round' ? 96 : 110; const h = t.shape === 'round' ? 96 : 90;
                return (
                  <motion.button key={t.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSel(t)} onContextMenu={(e) => { e.preventDefault(); setEdit({ ...t }); }}
                    style={{ left: t.x, top: t.y, width: w, height: h }}
                    className={`absolute flex flex-col items-center justify-center text-white border-2 shadow-lg ${t.shape === 'round' ? 'rounded-full' : 'rounded-2xl'} ${TABLE_STYLE[t.status] || TABLE_STYLE.free}`}>
                    <div className="font-bold text-lg leading-none">{t.name}</div>
                    <div className="text-[10px] opacity-80 flex items-center gap-1 mt-1"><Users size={10} /> {t.capacity}</div>
                    {t.open_order_total != null && <div className="text-[11px] font-semibold mt-1">{money(t.open_order_total, { decimals: 0 })}</div>}
                    {t.occupied_since && <div className="text-[9px] opacity-80 flex items-center gap-0.5"><Clock size={9} /> {timeAgo(t.occupied_since)}</div>}
                    {t.status === 'free' && t.reserved_for && <div className="text-[9px] opacity-90 mt-0.5">Res. {fmtTime(t.reserved_time)}</div>}
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {!shown.length && <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No tables in this area yet</div>}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Tip: right-click a table to edit its name, seats or position.</p>
        </div>
      )}

      <POS table={sel} open={!!sel || takeaway} takeaway={takeaway} onClose={() => { setSel(null); setTakeaway(false); load(); }} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add table'} size="sm" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveTable}>Save</button></>}>
        {edit && <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Seats"><Input type="number" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></Field>
          <Field label="Shape"><Select value={edit.shape} onChange={(e) => setEdit({ ...edit, shape: e.target.value })} options={['square', 'round', 'rect']} /></Field>
          <Field label="Area"><Select value={edit.area || area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} options={AREAS} /></Field>
          <Field label="X position"><Input type="number" value={edit.x} onChange={(e) => setEdit({ ...edit, x: Number(e.target.value) })} /></Field>
          <Field label="Y position"><Input type="number" value={edit.y} onChange={(e) => setEdit({ ...edit, y: Number(e.target.value) })} /></Field>
        </div>}
      </Modal>
    </div>
  );
}

// ======================= POS =======================
export function POS({ table, open, onClose, takeaway, orderId: presetOrderId }) {
  const toast = useToast();
  const { settings } = useAuth();
  const [menu, setMenu] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [order, setOrder] = useState(null);
  const [cart, setCart] = useState([]); // new items not yet sent
  const [busy, setBusy] = useState(false);
  const [settle, setSettle] = useState(null);
  const [inhouse, setInhouse] = useState([]);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    if (!open) return;
    setCart([]); setOrder(null); setSettle(null); setDiscount('');
    api.get('/api/menu/items?active=1').then(setMenu); api.get('/api/menu/categories').then(setCats); api.get('/api/inhouse').then(setInhouse);
    if (presetOrderId) api.get(`/api/orders/${presetOrderId}`).then((o) => { setOrder(o); setDiscount(o.discount || ''); });
    else if (table?.open_order_id) api.get(`/api/orders/${table.open_order_id}`).then((o) => { setOrder(o); setDiscount(o.discount || ''); });
  }, [open, table, presetOrderId]);

  const items = useMemo(() => menu.filter((m) => (!cat || m.category_id === Number(cat)) && (!q || m.name.toLowerCase().includes(q.toLowerCase()))), [menu, cat, q]);
  const addToCart = (m) => setCart((c) => { const ex = c.find((x) => x.menu_item_id === m.id); return ex ? c.map((x) => (x.menu_item_id === m.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }]; });
  const changeQty = (id, d) => setCart((c) => c.map((x) => (x.menu_item_id === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const send = async (type = 'dine_in') => {
    if (!cart.length) return;
    setBusy(true);
    try {
      let o;
      if (order) o = await api.post(`/api/orders/${order.id}/items`, { items: cart });
      else o = await api.post('/api/orders', { table_id: table?.id || null, type: takeaway ? type : 'dine_in', items: cart, covers: table?.capacity || 1 });
      setOrder(o); setCart([]); toast.success('Sent to kitchen / bar');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const updateItem = async (it, patch) => { try { setOrder(await api.put(`/api/orders/${order.id}/items/${it.id}`, patch)); } catch (e) { toast.error(e.message); } };
  const applyDiscount = async () => { try { setOrder(await api.put(`/api/orders/${order.id}`, { discount: Number(discount) || 0 })); toast.success('Discount applied'); } catch (e) { toast.error(e.message); } };
  const doSettle = async () => {
    setBusy(true);
    try { const o = await api.post(`/api/orders/${order.id}/settle`, settle); setOrder(o); setSettle(null); toast.success(o.status === 'billed' && settle.mode === 'room' ? 'Charged to room' : 'Order settled'); if (o.status !== 'open') setTimeout(onClose, 600); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const cancelOrder = async () => { try { await api.post(`/api/orders/${order.id}/cancel`); toast.success('Order cancelled'); onClose(); } catch (e) { toast.error(e.message); } };

  const cartTotal = cart.reduce((a, x) => a + x.qty * x.price, 0);
  const sc = Number(settings?.service_charge_rate) || 0; const tax = Number(settings?.tax_rate) || 0;
  const liveItems = order?.items.filter((i) => i.status !== 'cancelled') || [];

  return (
    <Modal open={open} onClose={onClose} size="full" title={<span className="flex items-center gap-3">{table ? `Table ${table.name}` : takeaway ? 'Takeaway / Room service' : 'Order'}{order && <><span className="font-mono text-sm text-slate-400">{order.code}</span><Badge status={order.status} /></>}</span>}>
      <div className="grid lg:grid-cols-5 gap-5 -m-1">
        {/* MENU */}
        <div className="lg:col-span-3">
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="input w-full pl-9 py-2" /></div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
            <button onClick={() => setCat('')} className={`chip whitespace-nowrap ${!cat ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
            {cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`chip whitespace-nowrap ${Number(cat) === c.id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{c.name}</button>)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto pr-1">
            {items.map((m) => (
              <motion.button key={m.id} whileTap={{ scale: 0.96 }} onClick={() => addToCart(m)} disabled={order && !['open'].includes(order.status)} className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-400 hover:shadow-md transition disabled:opacity-50">
                <div className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{m.name}</div>
                <div className="flex items-center justify-between mt-2"><span className="text-xs text-slate-400">{m.category_name}</span><span className="text-sm font-bold text-brand-800">{money(m.price, { decimals: 0 })}</span></div>
                {m.inventory_item_id && m.stock_qty <= 0 && <div className="text-[10px] text-rose-600 mt-1">Out of stock</div>}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ORDER */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-slate-50 border border-slate-200 p-4 max-h-[75vh]">
          <div className="flex-1 overflow-y-auto space-y-3">
            {order && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><ChefHat size={12} /> Sent items</div>
                {liveItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 py-1.5 border-b border-slate-200/70 text-sm">
                    <div className="flex-1 min-w-0"><div className="font-medium text-slate-800 truncate">{it.name}</div><div className="text-[11px] text-slate-400">{it.qty} × {money(it.price, { decimals: 0 })} · <Badge status={it.status} className="!text-[9px] !px-1.5 !py-0" /></div></div>
                    <div className="font-semibold">{money(it.qty * it.price, { decimals: 0 })}</div>
                    {order.status === 'open' && <button className="btn-ghost btn-sm text-rose-500 !px-1.5" onClick={() => updateItem(it, { status: 'cancelled' })}><X size={13} /></button>}
                  </div>
                ))}
                {order.items.filter((i) => i.status === 'cancelled').length > 0 && <div className="text-[11px] text-slate-400 mt-1">{order.items.filter((i) => i.status === 'cancelled').length} item(s) cancelled</div>}
              </div>
            )}
            <div>
              {cart.length > 0 && <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-1">New items (not sent)</div>}
              <AnimatePresence>
                {cart.map((it) => (
                  <motion.div key={it.menu_item_id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-2 py-1.5 border-b border-slate-200/70 text-sm">
                    <div className="flex-1 min-w-0"><div className="font-medium text-slate-800 truncate">{it.name}</div><div className="text-[11px] text-slate-400">{money(it.price, { decimals: 0 })}</div></div>
                    <div className="flex items-center gap-1"><button className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center" onClick={() => changeQty(it.menu_item_id, -1)}><Minus size={12} /></button><span className="w-6 text-center font-semibold">{it.qty}</span><button className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center" onClick={() => changeQty(it.menu_item_id, 1)}><Plus size={12} /></button></div>
                    <div className="w-16 text-right font-semibold">{money(it.qty * it.price, { decimals: 0 })}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!cart.length && !order && <div className="text-center text-sm text-slate-400 py-10">Tap menu items to start an order</div>}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-200 space-y-2">
            {cart.length > 0 && (
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={busy} onClick={() => send('takeaway')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />} Send {money(cartTotal, { decimals: 0 })}</button>
                <button className="btn-ghost" onClick={() => setCart([])}><Trash2 size={16} /></button>
              </div>
            )}
            {order && (
              <>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                  <div className="flex justify-between items-center text-slate-500"><span>Discount</span><span className="flex items-center gap-1"><input value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={applyDiscount} type="number" className="input !py-0.5 !px-2 w-24 text-right text-xs" placeholder="0" /></span></div>
                  <div className="flex justify-between text-slate-500"><span>Service charge {sc}%</span><span>{money(order.service_charge)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>Tax {tax}%</span><span>{money(order.tax)}</span></div>
                  <div className="flex justify-between font-bold text-lg text-slate-900 pt-1 border-t border-slate-200"><span>Total</span><span>{money(order.total)}</span></div>
                  {order.paid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{money(order.paid)}</span></div>}
                </div>
                {['open', 'billed'].includes(order.status) && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 !px-2" onClick={() => setSettle({ mode: 'pay', method: 'cash', amount: (order.total - order.paid).toFixed(2) })}><Banknote size={16} /> Cash</button>
                    <button className="btn-primary !px-2" onClick={() => setSettle({ mode: 'pay', method: 'card', amount: (order.total - order.paid).toFixed(2), reference: '' })}><CreditCard size={16} /> Card</button>
                    <button className="btn-secondary !px-2" onClick={() => setSettle({ mode: 'room', booking_id: order.booking_id || inhouse[0]?.id || '' })}><BedDouble size={16} /> Room</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn-ghost btn-sm flex-1" onClick={() => window.print()}><Printer size={14} /> Print bill</button>
                  {order.status === 'open' && <button className="btn-ghost btn-sm text-rose-600 flex-1" onClick={() => setCancelAsk(true)}><Trash2 size={14} /> Cancel order</button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!settle} onClose={() => setSettle(null)} title={settle?.mode === 'room' ? 'Charge to room' : `Settle by ${settle?.method}`} size="sm" footer={<><button className="btn-secondary" onClick={() => setSettle(null)}>Back</button><button className="btn-primary" disabled={busy} onClick={doSettle}>{busy && <Loader2 size={16} className="animate-spin" />}Confirm</button></>}>
        {settle && (settle.mode === 'room' ? (
          <Field label="In-house guest"><Select value={settle.booking_id} onChange={(e) => setSettle({ ...settle, booking_id: Number(e.target.value) })} placeholder="Select guest / room">{inhouse.map((b) => <option key={b.id} value={b.id}>Room {b.room_number} - {b.guest_name} ({b.code})</option>)}</Select></Field>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-900 text-white p-4 text-center"><div className="text-xs text-white/60">Amount due</div><div className="text-3xl font-bold">{money(order.total - order.paid)}</div></div>
            <Field label="Amount received"><Input type="number" step="0.01" value={settle.amount} onChange={(e) => setSettle({ ...settle, amount: e.target.value })} /></Field>
            {settle.method === 'card' && <Field label="Card slip reference"><Input value={settle.reference || ''} onChange={(e) => setSettle({ ...settle, reference: e.target.value })} /></Field>}
            {settle.method === 'cash' && Number(settle.amount) > order.total - order.paid && <div className="text-sm text-emerald-700 font-semibold">Change: {money(Number(settle.amount) - (order.total - order.paid))}</div>}
          </div>
        ))}
      </Modal>
      <Confirm open={cancelAsk} onClose={() => setCancelAsk(false)} onConfirm={cancelOrder} title="Cancel order" message="Cancel the whole order? Stock will be returned." confirmText="Cancel order" />
    </Modal>
  );
}
