import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wine, Truck, AlertTriangle, Banknote, RotateCcw, PlusCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { money, num, fmtDateTime, title } from '../../lib/format';
import { PageHeader, Stat, Modal, Field, Input, Select, Textarea, Badge, Skeleton, useToast } from '../../components/ui';

const ACTION_LABEL = { collected: 'Collected', returned: 'Returned to supplier', broken: 'Broken', lost: 'Lost', adjust: 'Adjusted' };

export default function EmptyBottles() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null);
  const load = useCallback(() => api.get('/api/empty-bottles').then(setD).catch((e) => toast.error(e.message)), [toast]);
  useEffect(() => { load(); api.get('/api/suppliers').then(setSuppliers); }, [load]);

  const submit = async () => {
    try { await api.post('/api/empty-bottles', form); toast.success('Recorded'); setForm(null); load(); } catch (e) { toast.error(e.message); }
  };
  const openForm = (action, item) => setForm({ action, inventory_item_id: item?.id || d.items[0]?.id, qty: action === 'returned' ? item?.empties_on_hand || 0 : 1, supplier_id: item?.supplier_id || '', note: '' });
  const item = d?.items.find((i) => i.id === Number(form?.inventory_item_id));
  const autoAmount = item ? (form?.qty || 0) * item.bottle_deposit : 0;

  if (!d) return <Skeleton rows={8} />;
  return (
    <div>
      <PageHeader title="Empty Bottle Management" subtitle="Track returnable empties (beer, soft drinks, arrack), supplier returns, deposits and breakages" actions={<>
        <button className="btn-secondary" onClick={() => openForm('collected')}><PlusCircle size={16} /> Record empties</button>
        <button className="btn-primary" onClick={() => openForm('returned')}><Truck size={16} /> Return to supplier</button>
      </>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Empties on hand" value={num(d.summary.empties_on_hand)} sub="bottles waiting to be returned" icon={Wine} tone="gold" />
        <Stat label="Deposit value held" value={money(d.summary.deposit_value, { decimals: 0 })} sub="recoverable from suppliers" icon={Banknote} tone="emerald" delay={0.05} />
        <Stat label="Returned (30 days)" value={num(d.summary.returned_30d)} sub={`${money(d.summary.recovered_30d, { decimals: 0 })} recovered`} icon={RotateCcw} tone="sky" delay={0.1} />
        <Stat label="Broken / lost (30 days)" value={num(d.summary.broken_30d)} sub="deposit forfeited" icon={AlertTriangle} tone={d.summary.broken_30d ? 'rose' : 'slate'} delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <h3 className="font-semibold text-slate-800 mb-2">Returnable items</h3>
          <div className="table-wrap"><table className="data"><thead><tr><th>Item</th><th>Supplier</th><th className="text-right">Full</th><th className="text-right">Empties</th><th className="text-right">Deposit</th><th className="text-right">Returned</th><th></th></tr></thead><tbody>
            {d.items.map((i, k) => (
              <motion.tr key={i.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: k * 0.03 }}>
                <td><div className="font-medium">{i.name}</div><div className="text-xs text-slate-400">{i.unit_size}ml · {money(i.bottle_deposit, { decimals: 0 })}/bottle</div></td>
                <td className="text-xs text-slate-500">{i.supplier_name || '-'}</td>
                <td className="text-right">{num(i.qty_on_hand)}</td>
                <td className="text-right"><span className={`font-bold ${i.empties_on_hand > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{num(i.empties_on_hand)}</span></td>
                <td className="text-right font-medium">{money(i.empties_on_hand * i.bottle_deposit, { decimals: 0 })}</td>
                <td className="text-right text-xs text-slate-500">{num(i.total_returned)} <span className="text-slate-300">/</span> <span className="text-rose-500">{num(i.total_broken)} broken</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="btn-ghost btn-sm" title="Return to supplier" disabled={!i.empties_on_hand} onClick={() => openForm('returned', i)}><Truck size={14} /></button>
                  <button className="btn-ghost btn-sm text-rose-600" title="Breakage" disabled={!i.empties_on_hand} onClick={() => openForm('broken', i)}><AlertTriangle size={14} /></button>
                  <button className="btn-ghost btn-sm" title="Add empties" onClick={() => openForm('collected', i)}><PlusCircle size={14} /></button>
                </td>
              </motion.tr>
            ))}
          </tbody></table></div>
          <p className="text-xs text-slate-400 mt-2">Selling a returnable bottle through the POS automatically adds one empty to stock. Return crates to the supplier here to recover the deposit.</p>
        </div>
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-2">Recent activity</h3>
          <div className="card divide-y divide-slate-100 max-h-[560px] overflow-auto">
            {d.log.map((l) => (
              <div key={l.id} className="px-4 py-3 flex items-start gap-3 text-sm">
                <span className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${l.action === 'returned' ? 'bg-emerald-50 text-emerald-600' : l.action === 'collected' ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600'}`}>{l.action === 'returned' ? <Truck size={15} /> : l.action === 'collected' ? <PlusCircle size={15} /> : <AlertTriangle size={15} />}</span>
                <div className="flex-1 min-w-0"><div className="font-medium text-slate-800">{ACTION_LABEL[l.action]} · {num(l.qty)} × {l.item_name}</div><div className="text-xs text-slate-500">{l.supplier_name ? `${l.supplier_name} · ` : ''}{l.note || ''}</div><div className="text-[11px] text-slate-400">{fmtDateTime(l.created_at)} · {l.user_name}</div></div>
                {l.amount > 0 && <div className={`font-semibold text-xs ${l.action === 'returned' ? 'text-emerald-700' : 'text-rose-600'}`}>{l.action === 'returned' ? '+' : '-'}{money(l.amount, { decimals: 0 })}</div>}
              </div>
            ))}
            {!d.log.length && <div className="p-8 text-center text-slate-400 text-sm">No activity yet</div>}
          </div>
        </div>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form ? ACTION_LABEL[form.action] : ''} size="sm" footer={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={submit}>Save</button></>}>
        {form && <div className="space-y-3">
          <Field label="Action"><Select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} options={Object.entries(ACTION_LABEL).filter(([k]) => k !== 'adjust').map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Item"><Select value={form.inventory_item_id} onChange={(e) => setForm({ ...form, inventory_item_id: Number(e.target.value) })} options={d.items.map((i) => ({ value: i.id, label: `${i.name} (${num(i.empties_on_hand)} empties)` }))} /></Field>
          <Field label="Quantity (bottles)"><Input type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
          {form.action === 'returned' && <Field label="Supplier"><Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select supplier" /></Field>}
          {form.action !== 'collected' && <div className="rounded-xl bg-slate-50 p-3 text-sm flex justify-between"><span className="text-slate-500">{form.action === 'returned' ? 'Deposit recovered' : 'Deposit forfeited'}</span><span className="font-bold">{money(autoAmount)}</span></div>}
          <Field label="Note"><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Crate numbers, delivery note ref..." /></Field>
        </div>}
      </Modal>
    </div>
  );
}
