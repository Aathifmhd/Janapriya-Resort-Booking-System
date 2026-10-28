import { useEffect, useState } from 'react';
import { User, Plus, Pencil, Trash2 } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { money, fmtDate, title, monthLabel } from '../../lib/format';
import { Modal, Badge, Field, Input, useToast } from '../../components/ui';

export default function Employees() {
  const toast = useToast();
  const [depts, setDepts] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deptModal, setDeptModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [key, setKey] = useState(0);
  const loadMeta = () => { api.get('/api/departments').then(setDepts); api.get('/api/shifts').then(setShifts); };
  useEffect(loadMeta, []);
  useEffect(() => { if (profile) api.get(`/api/employees/${profile.id}/summary`).then(setSummary); else setSummary(null); }, [profile]);
  const saveDept = async () => { try { if (editDept.id) await api.put(`/api/departments/${editDept.id}`, editDept); else await api.post('/api/departments', editDept); setEditDept(null); loadMeta(); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };
  const delDept = async (d) => { try { await api.del(`/api/departments/${d.id}`); loadMeta(); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <CrudPage
        title="Employees" subtitle="Staff directory, departments, shifts and salary setup" refreshKey={key} modalSize="lg"
        endpoint="/api/employees" createLabel="Add employee"
        headerActions={<button className="btn-secondary" onClick={() => setDeptModal(true)}>Departments</button>}
        columns={[
          { key: 'name', label: 'Employee', render: (r) => <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white flex items-center justify-center text-xs font-bold">{r.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div><div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.emp_code} · {r.designation}</div></div></div> },
          { key: 'department_name', label: 'Department', render: (r) => <span className="chip bg-slate-100 text-slate-700">{r.department_name || '-'}</span> },
          { key: 'phone', label: 'Contact', render: (r) => <div><div>{r.phone}</div><div className="text-xs text-slate-400">{r.email}</div></div> },
          { key: 'shift_name', label: 'Shift', render: (r) => r.shift_name || '-' },
          { key: 'salary_basic', label: 'Basic + allow.', render: (r) => <span className="font-medium">{money(r.salary_basic + r.allowances, { decimals: 0 })}</span> },
          { key: 'hire_date', label: 'Joined', render: (r) => fmtDate(r.hire_date) },
          { key: 'today_status', label: 'Today', render: (r) => r.today_status ? <Badge status={r.today_status} /> : <span className="text-xs text-slate-300">not marked</span> },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
        ]}
        fields={[
          { key: 'name', label: 'Full name', required: true }, { key: 'emp_code', label: 'Employee code', hint: 'Auto-generated if blank' },
          { key: 'designation', label: 'Designation', required: true }, { key: 'department_id', label: 'Department', type: 'select', options: depts.map((d) => ({ value: d.id, label: d.name })) },
          { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'nic', label: 'NIC' }, { key: 'hire_date', label: 'Hire date', type: 'date' },
          { key: 'salary_basic', label: 'Basic salary', type: 'number', required: true }, { key: 'allowances', label: 'Monthly allowances', type: 'number' },
          { key: 'shift_id', label: 'Shift', type: 'select', options: shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.start_time}-${s.end_time})` })) },
          { key: 'status', label: 'Status', type: 'select', options: ['active', 'on_leave', 'resigned', 'terminated'] },
          { key: 'address', label: 'Address', span: 2 }, { key: 'emergency_contact', label: 'Emergency contact' }, { key: 'bank_details', label: 'Bank account (for salary)' },
        ]}
        defaults={{ status: 'active', allowances: 0, salary_basic: 0 }}
        transform={(f) => ({ ...f, department_id: f.department_id || null, shift_id: f.shift_id || null })}
        extraActions={(r) => <button className="btn-ghost btn-sm" title="Profile" onClick={() => setProfile(r)}><User size={14} /></button>}
      />
      <Modal open={!!profile} onClose={() => setProfile(null)} title={profile?.name} size="lg">
        {profile && <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            {[['Code', profile.emp_code], ['Designation', profile.designation], ['Department', profile.department_name], ['Phone', profile.phone], ['NIC', profile.nic], ['Joined', fmtDate(profile.hire_date)], ['Basic', money(profile.salary_basic, { decimals: 0 })], ['Allowances', money(profile.allowances, { decimals: 0 })], ['Shift', profile.shift_name || '-']].map(([l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] uppercase text-slate-400 font-semibold">{l}</div><div className="font-medium text-slate-800">{v || '-'}</div></div>)}
          </div>
          {summary && <>
            <div><h4 className="font-semibold mb-2">This month's attendance</h4><div className="flex flex-wrap gap-1">{summary.attendance.map((a) => <span key={a.id} title={`${a.date}: ${title(a.status)}`} className={`h-7 w-7 rounded-md text-[10px] flex items-center justify-center font-semibold ${a.status === 'present' ? 'bg-emerald-100 text-emerald-800' : a.status === 'absent' ? 'bg-rose-100 text-rose-700' : a.status === 'leave' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>{a.date.slice(8)}</span>)}{!summary.attendance.length && <span className="text-sm text-slate-400">No records</span>}</div></div>
            <div><h4 className="font-semibold mb-2">Payslips</h4><div className="table-wrap"><table className="data"><thead><tr><th>Month</th><th className="text-right">Gross</th><th className="text-right">EPF (8%)</th><th className="text-right">Net</th><th>Status</th></tr></thead><tbody>{summary.payroll.map((p) => <tr key={p.id}><td>{monthLabel(p.month)}</td><td className="text-right">{money(p.basic + p.allowances + p.overtime + p.bonus, { decimals: 0 })}</td><td className="text-right">{money(p.epf_employee, { decimals: 0 })}</td><td className="text-right font-semibold">{money(p.net, { decimals: 0 })}</td><td><Badge status={p.status} /></td></tr>)}{!summary.payroll.length && <tr><td colSpan={5} className="text-center text-slate-400 py-4">No payslips yet</td></tr>}</tbody></table></div></div>
          </>}
        </div>}
      </Modal>
      <Modal open={deptModal} onClose={() => setDeptModal(false)} title="Departments" size="sm">
        <div className="space-y-2">
          {depts.map((d) => <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"><span className="font-medium">{d.name} <span className="text-xs text-slate-400">· {d.headcount} staff</span></span><div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setEditDept({ ...d })}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-rose-600" onClick={() => delDept(d)}><Trash2 size={14} /></button></div></div>)}
          <button className="btn-primary w-full" onClick={() => setEditDept({ name: '' })}><Plus size={16} /> Add department</button>
        </div>
      </Modal>
      <Modal open={!!editDept} onClose={() => setEditDept(null)} title={editDept?.id ? 'Edit department' : 'New department'} size="sm" footer={<><button className="btn-secondary" onClick={() => setEditDept(null)}>Cancel</button><button className="btn-primary" onClick={saveDept}>Save</button></>}>
        {editDept && <Field label="Name"><Input value={editDept.name} onChange={(e) => setEditDept({ ...editDept, name: e.target.value })} /></Field>}
      </Modal>
    </>
  );
}
