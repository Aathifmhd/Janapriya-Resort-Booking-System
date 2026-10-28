import { useEffect, useState } from 'react';
import { ArrowUpDown, History, AlertTriangle, Package, Wine, Banknote } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { money, num, fmtDateTime, title } from '../../lib/format';
import { Modal, Field, Input, Select, Textarea, Tabs, Stat, Badge, useToast } from '../../components/ui';

const CATS = ['liquor', 'beer', 'wine', 'soft_drink', 'food', 'housekeeping', 'other'];

export default function Inventory() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cat, setCat] = useState('');
  const [adjust, setAdjust] = useState(null);
  const [hist, setHist] = useState(null);
  const [moves, setMoves] = useState([]);
  const [key, setKey] = useState(0);
  const loadSummary = () => api.get('/api/inventory/summary').then(setSummary);
  useEffect(() => { api.get('/api/suppliers').then(setSuppliers); loadSummary(); }, [key]);
  useEffect(() => { if (hist) api.get(`/api/inventory/${hist.id}/movements`).then(setMoves); }, [hist]);
  const doAdjust = async () => { try { await api.post(`/api/inventory/${adjust.id}/adjust`, { qty: adjust.direction === 'in' ? Math.abs(adjust.qty) : -Math.abs(adjust.qty), type: adjust.type, note: adjust.note }); toast.success('Stock updated'); setAdjust(null); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };

  return (
    <>
      {summary && <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Stock items" value={summary.total_items} icon={Package} />
        <Stat label="Stock value (cost)" value={money(summary.stock_value, { decimals: 0 })} icon={Banknote} tone="emerald" delay={0.05} />
        <Stat label="Low stock" value={summary.low_stock} sub="at or below reorder level" icon={AlertTriangle} tone={summary.low_stock ? 'rose' : 'slate'} delay={0.1} />
        <Stat label="Empty bottles" value={num(summary.empties_on_hand)} sub={`${money(summary.empties_deposit_value, { decimals: 0 })} deposit value`} icon={Wine} tone="gold" delay={0.15} />
      </div>}
      <CrudPage
        title="Stock Items" subtitle="Bar, kitchen and housekeeping inventory" refreshKey={key} query={cat ? { category: cat } : {}} modalSize="lg"
        endpoint="/api/inventory"
        toolbar={<Tabs tabs={[{ value: '', label: 'All' }, ...CATS.map((c) => ({ value: c, label: title(c) }))]} value={cat} onChange={setCat} />}
        columns={[
          { key: 'name', label: 'Item', render: (r) => <div><div className="font-medium flex items-center gap-2">{r.name}{r.qty_on_hand <= r.reorder_level && <span className="chip bg-rose-100 text-rose-700"><AlertTriangle size={10} /> low</span>}</div><div className="text-xs text-slate-400">{r.sku} · {title(r.location)}</div></div> },
          { key: 'category', label: 'Category', render: (r) => <Badge status={r.category}>{title(r.category)}</Badge> },
          { key: 'qty_on_hand', label: 'On hand', render: (r) => <div><span className={`font-bold ${r.qty_on_hand <= r.reorder_level ? 'text-rose-600' : 'text-slate-800'}`}>{num(r.qty_on_hand, 2)}</span> <span className="text-xs text-slate-400">{r.unit}{r.unit_size ? ` (${r.unit_size}ml)` : ''}</span><div className="text-[11px] text-slate-400">reorder at {num(r.reorder_level)}</div></div> },
          { key: 'cost_price', label: 'Cost', render: (r) => money(r.cost_price, { decimals: 0 }) },
          { key: 'value', label: 'Value', render: (r) => <span className="font-medium">{money(r.qty_on_hand * r.cost_price, { decimals: 0 })}</span> },
          { key: 'supplier_name', label: 'Supplier', render: (r) => <span className="text-slate-500 text-xs">{r.supplier_name || '-'}</span> },
          { key: 'returnable_bottle', label: 'Empties', render: (r) => r.returnable_bottle ? <span className="chip bg-amber-100 text-amber-800">{num(r.empties_on_hand)} · {money(r.bottle_deposit, { decimals: 0 })}/btl</span> : <span className="text-slate-300 text-xs">-</span> },
        ]}
        fields={[
          { key: 'name', label: 'Item name', required: true }, { key: 'sku', label: 'SKU', hint: 'Auto-generated if blank' },
          { key: 'category', label: 'Category', type: 'select', options: CATS, required: true }, { key: 'location', label: 'Location', type: 'select', options: ['bar', 'kitchen', 'main_store', 'housekeeping_store'] },
          { key: 'unit', label: 'Unit', type: 'select', options: ['bottle', 'can', 'kg', 'litre', 'pcs', 'pack'] }, { key: 'unit_size', label: 'Unit size (ml, for bottles)', type: 'number' },
          { key: 'qty_on_hand', label: 'Opening quantity', type: 'number' }, { key: 'reorder_level', label: 'Reorder level', type: 'number' },
          { key: 'cost_price', label: 'Cost price', type: 'number' }, { key: 'sell_price', label: 'Selling price (reference)', type: 'number' },
          { key: 'supplier_id', label: 'Supplier', type: 'select', options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
          { key: 'returnable_bottle', label: 'Returnable bottle', type: 'toggle', toggleLabel: 'Track empties & deposit' },
          { key: 'bottle_deposit', label: 'Deposit per bottle', type: 'number' }, { key: 'empties_on_hand', label: 'Empties on hand', type: 'number' },
          { key: 'active', label: 'Active', type: 'toggle', toggleLabel: 'In use' },
        ]}
        defaults={{ category: 'liquor', unit: 'bottle', location: 'bar', qty_on_hand: 0, reorder_level: 5, cost_price: 0, returnable_bottle: 0, bottle_deposit: 0, empties_on_hand: 0, active: 1 }}
        transform={(f) => ({ ...f, supplier_id: f.supplier_id || null })}
        extraActions={(r) => <>
          <button className="btn-ghost btn-sm" title="Adjust stock" onClick={() => setAdjust({ id: r.id, name: r.name, unit: r.unit, direction: 'out', qty: 1, type: 'adjustment', note: '' })}><ArrowUpDown size={14} /></button>
          <button className="btn-ghost btn-sm" title="Movement history" onClick={() => setHist(r)}><History size={14} /></button>
        </>}
      />
      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust stock - ${adjust?.name}`} size="sm" footer={<><button className="btn-secondary" onClick={() => setAdjust(null)}>Cancel</button><button className="btn-primary" onClick={doAdjust}>Apply</button></>}>
        {adjust && <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">{['in', 'out'].map((d) => <button key={d} className={`btn ${adjust.direction === d ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setAdjust({ ...adjust, direction: d })}>Stock {d}</button>)}</div>
          <Field label={`Quantity (${adjust.unit})`}><Input type="number" step="any" min={0} value={adjust.qty} onChange={(e) => setAdjust({ ...adjust, qty: e.target.value })} /></Field>
          <Field label="Reason"><Select value={adjust.type} onChange={(e) => setAdjust({ ...adjust, type: e.target.value })} options={adjust.direction === 'out' ? ['wastage', 'breakage', 'consumption', 'transfer', 'adjustment'] : ['adjustment', 'return', 'transfer', 'opening']} /></Field>
          <Field label="Note"><Textarea value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`Movements - ${hist?.name}`} size="lg">
        <div className="table-wrap"><table className="data"><thead><tr><th>Date</th><th>Type</th><th className="text-right">Qty</th><th>Ref</th><th>Note</th><th>By</th></tr></thead><tbody>
          {moves.map((m) => <tr key={m.id}><td>{fmtDateTime(m.created_at)}</td><td><Badge status={m.type}>{title(m.type)}</Badge></td><td className={`text-right font-semibold ${m.qty < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{m.qty > 0 ? '+' : ''}{num(m.qty, 2)}</td><td className="font-mono text-xs">{m.ref || '-'}</td><td className="text-xs text-slate-500">{m.note}</td><td className="text-xs text-slate-500">{m.user_name || 'system'}</td></tr>)}
        </tbody></table></div>
      </Modal>
    </>
  );
}
