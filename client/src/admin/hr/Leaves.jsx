import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { fmtDate, title, today } from '../../lib/format';
import { Badge, Tabs, useToast } from '../../components/ui';

export default function Leaves() {
  const toast = useToast();
  const [emps, setEmps] = useState([]);
  const [tab, setTab] = useState('');
  const [key, setKey] = useState(0);
  useEffect(() => { api.get('/api/employees').then(setEmps); }, []);
  const decide = async (r, status) => { try { await api.put(`/api/leaves/${r.id}`, { status }); toast.success(`Leave ${status}`); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };
  return (
    <CrudPage
      title="Leave Requests" subtitle="Annual, casual, sick and unpaid leave. Approved leave is written to the attendance register automatically." refreshKey={key}
      endpoint="/api/leaves" searchable={false} query={tab ? { status: tab } : {}} createLabel="New request"
      toolbar={<Tabs tabs={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} value={tab} onChange={setTab} />}
      columns={[
        { key: 'employee_name', label: 'Employee', render: (r) => <div><div className="font-medium">{r.employee_name}</div><div className="text-xs text-slate-400">{r.emp_code}</div></div> },
        { key: 'type', label: 'Type', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.type)}</span> },
        { key: 'from_date', label: 'From', render: (r) => fmtDate(r.from_date) },
        { key: 'to_date', label: 'To', render: (r) => fmtDate(r.to_date) },
        { key: 'days', label: 'Days', className: 'text-center' },
        { key: 'reason', label: 'Reason', render: (r) => <span className="text-slate-500 text-xs line-clamp-1 max-w-xs">{r.reason}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
      ]}
      fields={[
        { key: 'employee_id', label: 'Employee', type: 'select', required: true, options: emps.map((e) => ({ value: e.id, label: `${e.name} (${e.emp_code})` })) },
        { key: 'type', label: 'Leave type', type: 'select', options: ['annual', 'casual', 'sick', 'unpaid', 'maternity'] },
        { key: 'from_date', label: 'From', type: 'date', required: true }, { key: 'to_date', label: 'To', type: 'date', required: true },
        { key: 'days', label: 'Days', type: 'number', hint: 'Auto-calculated if blank' }, { key: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected'] },
        { key: 'reason', label: 'Reason', type: 'textarea', span: 2 },
      ]}
      defaults={{ type: 'annual', from_date: today(), to_date: today(), status: 'pending' }}
      transform={(f) => ({ ...f, days: f.days || undefined })}
      extraActions={(r) => r.status === 'pending' && <><button className="btn-ghost btn-sm text-emerald-700" title="Approve" onClick={() => decide(r, 'approved')}><Check size={14} /></button><button className="btn-ghost btn-sm text-rose-600" title="Reject" onClick={() => decide(r, 'rejected')}><X size={14} /></button></>}
    />
  );
}
