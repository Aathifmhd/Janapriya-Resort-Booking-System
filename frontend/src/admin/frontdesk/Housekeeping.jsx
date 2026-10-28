import { useEffect, useState } from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import CrudPage, { FormFields } from '../../components/CrudPage';
import { api } from '../../lib/api';
import { fmtDateTime, title } from '../../lib/format';
import { Badge, Tabs, useToast } from '../../components/ui';

export default function Housekeeping() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [tab, setTab] = useState('');
  const [key, setKey] = useState(0);
  useEffect(() => { api.get('/api/rooms').then(setRooms); api.get('/api/housekeeping/staff').then(setStaff); }, []);
  const advance = async (r, status) => { try { await api.put(`/api/housekeeping/${r.id}`, { status }); toast.success(`Task ${title(status)}`); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };
  const fields = [
    { key: 'room_id', label: 'Room', type: 'select', required: true, options: rooms.map((r) => ({ value: r.id, label: `Room ${r.number} (${title(r.status)})` })) },
    { key: 'type', label: 'Task type', type: 'select', options: ['cleaning', 'inspection', 'maintenance', 'turndown', 'deep_clean'] },
    { key: 'priority', label: 'Priority', type: 'select', options: ['high', 'normal', 'low'] },
    { key: 'assigned_to', label: 'Assign to', type: 'select', options: staff.map((s) => ({ value: s.id, label: `${s.name} - ${s.designation}` })) },
    { key: 'status', label: 'Status', type: 'select', options: ['pending', 'in_progress', 'done'] },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 2 },
  ];
  return (
    <CrudPage
      title="Housekeeping & Maintenance" subtitle="Room cleaning, inspections and maintenance work orders"
      endpoint="/api/housekeeping" searchable={false} refreshKey={key} query={tab ? { status: tab } : {}} createLabel="New task"
      toolbar={<Tabs tabs={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }]} value={tab} onChange={setTab} />}
      columns={[
        { key: 'room_number', label: 'Room', render: (r) => <span className="font-display text-lg font-semibold">{r.room_number || '-'}</span> },
        { key: 'type', label: 'Task', render: (r) => <span className="capitalize font-medium">{title(r.type)}</span> },
        { key: 'priority', label: 'Priority', render: (r) => <Badge status={r.priority} /> },
        { key: 'assigned_name', label: 'Assigned to', render: (r) => r.assigned_name || <span className="text-slate-400">Unassigned</span> },
        { key: 'notes', label: 'Notes', render: (r) => <span className="text-slate-500 line-clamp-1 max-w-xs">{r.notes}</span> },
        { key: 'created_at', label: 'Created', render: (r) => fmtDateTime(r.created_at) },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
      ]}
      fields={fields} defaults={{ type: 'cleaning', priority: 'normal', status: 'pending' }}
      renderForm={(form, setForm) => <FormFields fields={fields} form={form} setForm={setForm} />}
      extraActions={(r) => <>
        {r.status === 'pending' && <button className="btn-ghost btn-sm text-sky-700" title="Start" onClick={() => advance(r, 'in_progress')}><Play size={14} /></button>}
        {r.status !== 'done' && <button className="btn-ghost btn-sm text-emerald-700" title="Mark done" onClick={() => advance(r, 'done')}><CheckCircle2 size={14} /></button>}
      </>}
    />
  );
}
