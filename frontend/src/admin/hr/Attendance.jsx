import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { today, addDays, fmtDate, title } from '../../lib/format';
import { PageHeader, Badge, Input, Skeleton, useToast } from '../../components/ui';

const STATUSES = ['present', 'absent', 'leave', 'half_day'];

export default function Attendance() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get(`/api/attendance${qs({ date })}`).then(setRows).catch((e) => toast.error(e.message)), [date, toast]);
  useEffect(load, [load]);

  const mark = async (r, patch) => {
    try { await api.post('/api/attendance', { employee_id: r.employee_id, date, status: r.status || 'present', check_in: r.check_in, check_out: r.check_out, note: r.note, ...patch }); load(); } catch (e) { toast.error(e.message); }
  };
  const markAll = async () => { try { await api.post('/api/attendance/bulk', { date, status: 'present', employee_ids: rows.filter((r) => !r.status).map((r) => r.employee_id) }); toast.success('Marked everyone present'); load(); } catch (e) { toast.error(e.message); } };
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: rows?.filter((r) => r.status === s).length || 0 }), {});

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily attendance register with check-in / check-out times and overtime" actions={<div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={14} /></button>
        <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <button className="btn-secondary btn-sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()}><ChevronRight size={14} /></button>
        <button className="btn-primary" onClick={markAll}><CheckCheck size={16} /> Mark all present</button>
      </div>} />
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <span className="chip bg-slate-100 text-slate-700">{fmtDate(date)}</span>
        {STATUSES.map((s) => <span key={s} className="flex items-center gap-1"><Badge status={s} /><span className="font-semibold">{counts[s]}</span></span>)}
        <span className="chip bg-slate-50 text-slate-500">{rows?.filter((r) => !r.status).length || 0} unmarked</span>
      </div>
      {!rows ? <Skeleton /> : (
        <div className="table-wrap"><table className="data"><thead><tr><th>Employee</th><th>Shift</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th>OT</th><th>Note</th></tr></thead><tbody>
          {rows.map((r, i) => (
            <motion.tr key={r.employee_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <td><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.emp_code} · {r.department_name}</div></td>
              <td className="text-xs text-slate-500">{r.shift_name ? `${r.shift_name} ${r.start_time}-${r.end_time}` : '-'}</td>
              <td><div className="flex gap-1">{STATUSES.map((s) => <button key={s} onClick={() => mark(r, { status: s })} className={`chip transition ${r.status === s ? '' : 'opacity-40 hover:opacity-100'} ${s === 'present' ? 'bg-emerald-100 text-emerald-800' : s === 'absent' ? 'bg-rose-100 text-rose-700' : s === 'leave' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>{title(s)[0]}</button>)}</div></td>
              <td><input type="time" defaultValue={r.check_in || ''} onBlur={(e) => e.target.value !== (r.check_in || '') && mark(r, { check_in: e.target.value || null, status: r.status || 'present' })} className="input !py-1 !px-2 w-32 text-xs" /></td>
              <td><input type="time" defaultValue={r.check_out || ''} onBlur={(e) => e.target.value !== (r.check_out || '') && mark(r, { check_out: e.target.value || null, status: r.status || 'present' })} className="input !py-1 !px-2 w-32 text-xs" /></td>
              <td className="font-medium">{r.hours ? Number(r.hours).toFixed(1) : '-'}</td>
              <td className={r.overtime_hours ? 'text-amber-700 font-semibold' : 'text-slate-300'}>{r.overtime_hours ? `+${Number(r.overtime_hours).toFixed(1)}` : '-'}</td>
              <td><input defaultValue={r.note || ''} onBlur={(e) => e.target.value !== (r.note || '') && mark(r, { note: e.target.value })} placeholder="note" className="input !py-1 !px-2 w-36 text-xs" /></td>
            </motion.tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}
