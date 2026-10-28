import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../../lib/api';
import { num, fmtDateTime, title, today, addDays } from '../../lib/format';
import { PageHeader, DataTable, Badge, Input, Select } from '../../components/ui';

export default function Movements() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ type: '', from: addDays(today(), -7), to: today() });
  const load = useCallback(() => { setLoading(true); api.get(`/api/stock-movements${qs(f)}`).then(setRows).finally(() => setLoading(false)); }, [f]);
  useEffect(load, [load]);
  return (
    <div>
      <PageHeader title="Stock Movements" subtitle="Every purchase, sale, wastage and adjustment - the full audit trail" />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="All types" options={['purchase', 'sale', 'return', 'wastage', 'breakage', 'consumption', 'transfer', 'adjustment', 'opening']} className="w-44" />
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-44" />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-44" />
      </div>
      <DataTable loading={loading} rows={rows} pageSize={50} columns={[
        { key: 'created_at', label: 'Date', render: (r) => fmtDateTime(r.created_at) },
        { key: 'item_name', label: 'Item', render: (r) => <span className="font-medium">{r.item_name}</span> },
        { key: 'type', label: 'Type', render: (r) => <Badge status={r.type}>{title(r.type)}</Badge> },
        { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => <span className={`font-semibold ${r.qty < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{r.qty > 0 ? '+' : ''}{num(r.qty, 2)} {r.unit}</span> },
        { key: 'ref', label: 'Reference', render: (r) => <span className="font-mono text-xs">{r.ref || '-'}</span> },
        { key: 'note', label: 'Note', render: (r) => <span className="text-xs text-slate-500">{r.note}</span> },
        { key: 'user_name', label: 'By', render: (r) => <span className="text-xs text-slate-500">{r.user_name || 'system'}</span> },
      ]} />
    </div>
  );
}
