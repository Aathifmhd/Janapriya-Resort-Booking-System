import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../../lib/api';
import { money, fmtDateTime, title, today, addDays } from '../../lib/format';
import { PageHeader, DataTable, Input, Select, Stat } from '../../components/ui';

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ from: addDays(today(), -7), to: today(), method: '' });
  const load = useCallback(() => { setLoading(true); api.get(`/api/payments${qs(f)}`).then(setRows).finally(() => setLoading(false)); }, [f]);
  useEffect(load, [load]);
  const byMethod = ['cash', 'card', 'bank', 'online'].map((m) => ({ m, v: rows.filter((r) => r.method === m).reduce((a, r) => a + r.amount, 0) }));
  return (
    <div>
      <PageHeader title="Payments received" subtitle="All guest and restaurant payments - cash drawer reconciliation" />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-44" />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-44" />
        <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} placeholder="All methods" options={['cash', 'card', 'bank', 'online']} className="w-40" />
        <button className="btn-secondary btn-sm" onClick={() => setF({ ...f, from: today(), to: today() })}>Today</button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">{byMethod.map((x, i) => <Stat key={x.m} label={title(x.m)} value={money(x.v, { decimals: 0 })} tone={['emerald', 'sky', 'violet', 'gold'][i]} delay={i * 0.05} />)}</div>
      <DataTable loading={loading} rows={rows} pageSize={50} columns={[
        { key: 'created_at', label: 'Date', render: (r) => fmtDateTime(r.created_at) },
        { key: 'ref', label: 'For', render: (r) => <span className="font-mono text-xs">{r.booking_code || r.order_code || '-'}</span> },
        { key: 'guest_name', label: 'Guest', render: (r) => r.guest_name || <span className="text-slate-400">Walk-in / F&B</span> },
        { key: 'method', label: 'Method', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.method)}</span> },
        { key: 'reference', label: 'Reference', render: (r) => <span className="text-xs text-slate-500">{r.reference || r.note || '-'}</span> },
        { key: 'received_by_name', label: 'Received by', render: (r) => <span className="text-xs text-slate-500">{r.received_by_name || '-'}</span> },
        { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => <span className="font-semibold text-emerald-700">{money(r.amount)}</span> },
      ]} footer={<><td colSpan={6} className="px-4 py-3 font-semibold bg-slate-50">Total</td><td className="px-4 py-3 text-right font-bold bg-slate-50">{money(rows.reduce((a, r) => a + r.amount, 0))}</td></>} />
    </div>
  );
}
