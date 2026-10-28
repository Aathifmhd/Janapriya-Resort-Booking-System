import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, PackageCheck, Banknote, Eye, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { money, num, fmtDate, today } from '../../lib/format';
import { PageHeader, DataTable, Badge, Modal, Field, Input, Select, Textarea, useToast } from '../../components/ui';

export default function Purchases() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { setLoading(true); api.get('/api/purchases').then(setRows).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); api.get('/api/suppliers').then(setSuppliers); api.get('/api/inventory').then(setItems); }, [load]);

  const newForm = () => setForm({ supplier_id: '', invoice_no: '', date: today(), status: 'received', paid: 0, notes: '', items: [{ inventory_item_id: '', qty: 1, unit_cost: 0 }] });
  const setLine = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const pickItem = (i, id) => { const it = items.find((x) => x.id === Number(id)); setLine(i, { inventory_item_id: Number(id), unit_cost: it?.cost_price || 0 }); if (it?.supplier_id && !form.supplier_id) setForm((f) => ({ ...f, supplier_id: it.supplier_id })); };
  const total = form?.items.reduce((a, l) => a + Number(l.qty) * Number(l.unit_cost), 0) || 0;
  const filteredItems = form?.supplier_id ? items.filter((i) => !i.supplier_id || i.supplier_id === Number(form.supplier_id)) : items;

  const save = async () => {
    const lines = form.items.filter((l) => l.inventory_item_id && Number(l.qty) > 0);
    if (!lines.length) return toast.error('Add at least one item');
    setBusy(true);
    try { await api.post('/api/purchases', { ...form, items: lines, supplier_id: form.supplier_id || null }); toast.success('Purchase recorded & stock updated'); setForm(null); load(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const receive = async (p) => { try { await api.post(`/api/purchases/${p.id}/receive`); toast.success('Goods received into stock'); load(); } catch (e) { toast.error(e.message); } };
  const doPay = async () => { try { await api.post(`/api/purchases/${pay.id}/pay`, { amount: Number(pay.amount), method: pay.method }); toast.success('Supplier payment recorded'); setPay(null); load(); } catch (e) { toast.error(e.message); } };
  const openView = (p) => api.get(`/api/purchases/${p.id}`).then(setView);

  return (
    <div>
      <PageHeader title="Purchases" subtitle="Goods received notes and supplier bills. Receiving a purchase adds stock automatically." actions={<button className="btn-primary" onClick={newForm}><Plus size={16} /> New purchase</button>} />
      <DataTable loading={loading} rows={rows} onRowClick={openView} columns={[
        { key: 'code', label: 'PO', render: (r) => <span className="font-mono font-semibold text-brand-800">{r.code}</span> },
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'supplier_name', label: 'Supplier', render: (r) => <div><div className="font-medium">{r.supplier_name || '-'}</div><div className="text-xs text-slate-400">{r.invoice_no ? `Inv ${r.invoice_no}` : ''}</div></div> },
        { key: 'line_count', label: 'Lines', className: 'text-center' },
        { key: 'total', label: 'Total', className: 'text-right', render: (r) => <span className="font-semibold">{money(r.total, { decimals: 0 })}</span> },
        { key: 'paid', label: 'Balance', className: 'text-right', render: (r) => <span className={r.total - r.paid > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}>{money(r.total - r.paid, { decimals: 0 })}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
        { key: '_a', label: '', className: 'text-right', render: (r) => <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost btn-sm" onClick={() => openView(r)}><Eye size={14} /></button>
          {r.status === 'ordered' && <button className="btn-ghost btn-sm text-sky-700" title="Receive goods" onClick={() => receive(r)}><PackageCheck size={14} /></button>}
          {r.total - r.paid > 0 && <button className="btn-ghost btn-sm text-emerald-700" title="Pay supplier" onClick={() => setPay({ id: r.id, code: r.code, amount: (r.total - r.paid).toFixed(2), method: 'bank' })}><Banknote size={14} /></button>}
        </div> },
      ]} />

      <Modal open={!!form} onClose={() => setForm(null)} title="New purchase / goods received" size="xl" footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />}Save purchase</button></>}>
        {form && <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Supplier"><Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select" /></Field>
            <Field label="Supplier invoice no"><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'received', label: 'Received (add to stock now)' }, { value: 'ordered', label: 'Ordered (receive later)' }]} /></Field>
          </div>
          <div className="table-wrap"><table className="data"><thead><tr><th className="w-1/2">Item</th><th>Qty</th><th>Unit cost</th><th className="text-right">Line total</th><th></th></tr></thead><tbody>
            {form.items.map((l, i) => (
              <tr key={i}>
                <td><Select value={l.inventory_item_id} onChange={(e) => pickItem(i, e.target.value)} placeholder="Select item" options={filteredItems.map((it) => ({ value: it.id, label: `${it.name} (${it.unit}) - ${num(it.qty_on_hand)} on hand` }))} /></td>
                <td><Input type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className="w-24" /></td>
                <td><Input type="number" min={0} step="any" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} className="w-32" /></td>
                <td className="text-right font-medium">{money(Number(l.qty) * Number(l.unit_cost), { decimals: 0 })}</td>
                <td><button className="btn-ghost btn-sm text-rose-600" onClick={() => setForm({ ...form, items: form.items.filter((_, k) => k !== i) })}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody></table></div>
          <div className="flex items-center justify-between">
            <button className="btn-secondary btn-sm" onClick={() => setForm({ ...form, items: [...form.items, { inventory_item_id: '', qty: 1, unit_cost: 0 }] })}><Plus size={14} /> Add line</button>
            <div className="text-right"><div className="text-xs text-slate-500">Total</div><div className="text-xl font-bold">{money(total)}</div></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Amount paid now" hint="Leave 0 for credit purchase"><Input type="number" min={0} value={form.paid} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} /></Field>
            <Field label="Notes"><Textarea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        </div>}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.code} · ${view.supplier_name || ''}` : ''} size="lg">
        {view && <div>
          <div className="flex flex-wrap gap-4 text-sm mb-4"><span>Date <b>{fmtDate(view.date)}</b></span><span>Invoice <b>{view.invoice_no || '-'}</b></span><Badge status={view.status} /><span className="ml-auto">Paid <b>{money(view.paid)}</b> of <b>{money(view.total)}</b></span></div>
          <div className="table-wrap"><table className="data"><thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th><th className="text-right">Total</th></tr></thead><tbody>
            {view.items.map((l) => <tr key={l.id}><td>{l.item_name}</td><td className="text-right">{num(l.qty, 2)} {l.unit}</td><td className="text-right">{money(l.unit_cost)}</td><td className="text-right font-medium">{money(l.qty * l.unit_cost)}</td></tr>)}
          </tbody></table></div>
          {view.notes && <p className="text-sm text-slate-500 mt-3">{view.notes}</p>}
        </div>}
      </Modal>

      <Modal open={!!pay} onClose={() => setPay(null)} title={`Pay supplier - ${pay?.code}`} size="sm" footer={<><button className="btn-secondary" onClick={() => setPay(null)}>Cancel</button><button className="btn-primary" onClick={doPay}>Record payment</button></>}>
        {pay && <div className="space-y-3"><Field label="Amount"><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field><Field label="Method"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} options={['bank', 'cash', 'cheque', 'card']} /></Field><p className="text-xs text-slate-500">This will also be recorded as an expense under "purchases".</p></div>}
      </Modal>
    </div>
  );
}
