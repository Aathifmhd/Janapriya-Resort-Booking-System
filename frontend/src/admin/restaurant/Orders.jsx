import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../../lib/api';
import { money, fmtDateTime, today } from '../../lib/format';
import { PageHeader, DataTable, Badge, Tabs, Input, useToast } from '../../components/ui';
import { POS } from './Tables';

export default function Orders() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open,billed');
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => { setLoading(true); api.get(`/api/orders${qs({ status: status || undefined, date: date || undefined })}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false)); }, [status, date, toast]);
  useEffect(load, [load]);

  const totals = rows.reduce((a, r) => a + (r.status !== 'cancelled' ? r.total : 0), 0);
  return (
    <div>
      <PageHeader title="Orders" subtitle="Restaurant, bar, takeaway and room-service orders" />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs tabs={[{ value: 'open,billed', label: 'Active' }, { value: 'paid', label: 'Paid' }, { value: 'cancelled', label: 'Cancelled' }, { value: '', label: 'All' }]} value={status} onChange={setStatus} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        {date && <button className="btn-ghost btn-sm" onClick={() => setDate('')}>Clear</button>}
        <button className="btn-secondary btn-sm" onClick={() => setDate(today())}>Today</button>
        <div className="ml-auto text-sm text-slate-500">{rows.length} orders · <span className="font-semibold text-slate-800">{money(totals, { decimals: 0 })}</span></div>
      </div>
      <DataTable loading={loading} rows={rows} onRowClick={(r) => setOpen(r.id)} columns={[
        { key: 'code', label: 'Order', render: (r) => <span className="font-mono font-semibold text-brand-800">{r.code}</span> },
        { key: 'table_name', label: 'Table / Type', render: (r) => <div><div className="font-medium">{r.table_name || (r.type === 'room_service' ? `Room ${r.room_number || ''}` : 'Takeaway')}</div><div className="text-xs text-slate-400 capitalize">{r.area || r.type.replace('_', ' ')}</div></div> },
        { key: 'item_count', label: 'Items', render: (r) => <span>{r.item_count}{r.pending_items > 0 && <span className="ml-1 chip bg-amber-100 text-amber-800">{r.pending_items} pending</span>}</span> },
        { key: 'waiter_name', label: 'Waiter', render: (r) => r.waiter_name || '-' },
        { key: 'created_at', label: 'Opened', render: (r) => fmtDateTime(r.created_at) },
        { key: 'booking_code', label: 'Room charge', render: (r) => r.booking_code ? <span className="font-mono text-xs">{r.booking_code}</span> : '-' },
        { key: 'total', label: 'Total', className: 'text-right', render: (r) => <span className="font-semibold">{money(r.total, { decimals: 0 })}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
      ]} />
      <POS open={!!open} orderId={open} onClose={() => { setOpen(null); load(); }} />
    </div>
  );
}
