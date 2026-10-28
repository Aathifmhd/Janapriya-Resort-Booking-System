import { useEffect, useState } from 'react';
import { Check, Armchair, X } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { fmtDate, fmtTime, today } from '../../lib/format';
import { Badge, useToast } from '../../components/ui';

export default function Reservations() {
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [key, setKey] = useState(0);
  useEffect(() => { api.get('/api/tables').then(setTables); }, []);
  const setStatus = async (r, status, extra = {}) => { try { await api.put(`/api/table-reservations/${r.id}`, { status, ...extra }); toast.success(`Reservation ${status}`); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };
  return (
    <CrudPage
      title="Table Reservations" subtitle="Website requests and phone reservations for the restaurant and bar" refreshKey={key}
      endpoint="/api/table-reservations" createLabel="New reservation"
      columns={[
        { key: 'date', label: 'When', render: (r) => <div><div className="font-semibold">{fmtDate(r.date)}</div><div className="text-xs text-slate-400">{fmtTime(r.time)}</div></div> },
        { key: 'guest_name', label: 'Guest', render: (r) => <div><div className="font-medium">{r.guest_name}</div><div className="text-xs text-slate-400">{r.phone}</div></div> },
        { key: 'party_size', label: 'Party', render: (r) => `${r.party_size} pax` },
        { key: 'table_name', label: 'Table', render: (r) => r.table_name ? <span className="chip bg-slate-100 text-slate-700">{r.table_name} · {r.area}</span> : <span className="text-amber-600 text-xs">Not assigned</span> },
        { key: 'notes', label: 'Notes', render: (r) => <span className="text-slate-500 text-xs line-clamp-1 max-w-xs">{r.notes}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
      ]}
      fields={[
        { key: 'guest_name', label: 'Guest name', required: true }, { key: 'phone', label: 'Phone', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'time', label: 'Time', type: 'time', required: true },
        { key: 'party_size', label: 'Party size', type: 'number' },
        { key: 'table_id', label: 'Table', type: 'select', options: tables.map((t) => ({ value: t.id, label: `${t.name} (${t.area}, ${t.capacity} seats)` })), placeholder: 'Assign later' },
        { key: 'status', label: 'Status', type: 'select', options: ['requested', 'booked', 'seated', 'completed', 'cancelled', 'no_show'] },
        { key: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ]}
      defaults={{ date: today(), time: '19:30', party_size: 2, status: 'booked' }}
      transform={(f) => ({ ...f, table_id: f.table_id || null })}
      extraActions={(r) => <>
        {r.status === 'requested' && <button className="btn-ghost btn-sm text-emerald-700" title="Confirm" onClick={() => setStatus(r, 'booked')}><Check size={14} /></button>}
        {r.status === 'booked' && <button className="btn-ghost btn-sm text-sky-700" title="Seated" onClick={() => setStatus(r, 'seated')}><Armchair size={14} /></button>}
        {['requested', 'booked'].includes(r.status) && <button className="btn-ghost btn-sm text-rose-600" title="Cancel" onClick={() => setStatus(r, 'cancelled')}><X size={14} /></button>}
      </>}
    />
  );
}
