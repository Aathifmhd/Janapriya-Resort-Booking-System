import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Banknote, Printer, Loader2 } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { money, monthLabel } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { PageHeader, Badge, Input, Modal, Field, Stat, Skeleton, Confirm, useToast } from '../../components/ui';

export default function Payroll() {
  const toast = useToast();
  const { settings } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [slip, setSlip] = useState(null);
  const [payAsk, setPayAsk] = useState(false);
  const load = useCallback(() => api.get(`/api/payroll${qs({ month })}`).then(setRows), [month]);
  useEffect(load, [load]);

  const generate = async () => { setBusy(true); try { const r = await api.post('/api/payroll/generate', { month }); toast.success(`Generated ${r.count} payslips from attendance`); load(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const saveEdit = async () => { try { await api.put(`/api/payroll/${edit.id}`, edit); setEdit(null); load(); } catch (e) { toast.error(e.message); } };
  const payAll = async () => { const r = await api.post('/api/payroll/pay', { month }); toast.success(`Paid ${r.count} employees - expenses recorded`); load(); };

  const t = (k) => rows?.reduce((a, r) => a + r[k], 0) || 0;
  const drafts = rows?.filter((r) => r.status === 'draft').length || 0;

  return (
    <div>
      <PageHeader title="Payroll" subtitle={`Monthly salaries with EPF ${settings?.epf_employee_rate}% / ${settings?.epf_employer_rate}% and ETF ${settings?.etf_rate}%. Overtime and absence deductions come from attendance.`} actions={<>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        <button className="btn-secondary" disabled={busy} onClick={generate}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} {rows?.length ? 'Recalculate drafts' : 'Generate payroll'}</button>
        <button className="btn-primary" disabled={!drafts} onClick={() => setPayAsk(true)}><Banknote size={16} /> Pay {drafts} draft{drafts !== 1 ? 's' : ''}</button>
      </>} />
      {rows && rows.length > 0 && <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Gross payroll" value={money(t('basic') + t('allowances') + t('overtime') + t('bonus'), { decimals: 0 })} sub={`${rows.length} employees`} />
        <Stat label="Net payable" value={money(t('net'), { decimals: 0 })} tone="emerald" delay={0.05} />
        <Stat label="EPF + ETF (employer)" value={money(t('epf_employer') + t('etf'), { decimals: 0 })} sub="statutory contributions" tone="sky" delay={0.1} />
        <Stat label="Total cost to company" value={money(t('basic') + t('allowances') + t('overtime') + t('bonus') + t('epf_employer') + t('etf'), { decimals: 0 })} tone="gold" delay={0.15} />
      </div>}
      {!rows ? <Skeleton /> : !rows.length ? <div className="card p-10 text-center text-slate-500">No payroll for {monthLabel(month)} yet. Click <b>Generate payroll</b> to calculate from employee salaries and attendance.</div> : (
        <div className="table-wrap"><table className="data"><thead><tr><th>Employee</th><th className="text-right">Basic</th><th className="text-right">Allow.</th><th className="text-right">OT</th><th className="text-right">Bonus</th><th className="text-right">Deduct.</th><th className="text-right">EPF 8%</th><th className="text-right">Net</th><th>Status</th><th></th></tr></thead><tbody>
          {rows.map((r, i) => (
            <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className={r.status === 'draft' ? 'cursor-pointer' : ''} onClick={() => r.status === 'draft' && setEdit({ id: r.id, name: r.employee_name, bonus: r.bonus, deductions: r.deductions, overtime: r.overtime })}>
              <td><div className="font-medium">{r.employee_name}</div><div className="text-xs text-slate-400">{r.emp_code} · {r.designation}</div></td>
              <td className="text-right">{money(r.basic, { decimals: 0 })}</td><td className="text-right">{money(r.allowances, { decimals: 0 })}</td>
              <td className="text-right text-amber-700">{r.overtime ? money(r.overtime, { decimals: 0 }) : '-'}</td><td className="text-right">{r.bonus ? money(r.bonus, { decimals: 0 }) : '-'}</td>
              <td className="text-right text-rose-600">{r.deductions ? money(r.deductions, { decimals: 0 }) : '-'}</td><td className="text-right text-slate-500">{money(r.epf_employee, { decimals: 0 })}</td>
              <td className="text-right font-bold">{money(r.net, { decimals: 0 })}</td><td><Badge status={r.status} /></td>
              <td className="text-right"><button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSlip(r); }}><Printer size={14} /></button></td>
            </motion.tr>
          ))}
        </tbody><tfoot><tr className="bg-slate-50 font-semibold"><td className="px-4 py-3">Totals</td><td className="px-4 py-3 text-right">{money(t('basic'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('allowances'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('overtime'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('bonus'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('deductions'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('epf_employee'), { decimals: 0 })}</td><td className="px-4 py-3 text-right">{money(t('net'), { decimals: 0 })}</td><td colSpan={2}></td></tr></tfoot></table></div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Adjust - ${edit?.name}`} size="sm" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveEdit}>Save</button></>}>
        {edit && <div className="space-y-3"><Field label="Overtime amount"><Input type="number" value={edit.overtime} onChange={(e) => setEdit({ ...edit, overtime: Number(e.target.value) })} /></Field><Field label="Bonus"><Input type="number" value={edit.bonus} onChange={(e) => setEdit({ ...edit, bonus: Number(e.target.value) })} /></Field><Field label="Deductions (absence, advances, loans)"><Input type="number" value={edit.deductions} onChange={(e) => setEdit({ ...edit, deductions: Number(e.target.value) })} /></Field></div>}
      </Modal>
      <Modal open={!!slip} onClose={() => setSlip(null)} title="Payslip" size="sm" footer={<button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print</button>}>
        {slip && <div className="text-sm">
          <div className="text-center mb-4"><div className="font-display text-xl text-brand-900">{settings?.resort_name}</div><div className="text-xs text-slate-500">Payslip for {monthLabel(slip.month)}</div></div>
          <div className="flex justify-between mb-3"><div><div className="font-semibold">{slip.employee_name}</div><div className="text-xs text-slate-500">{slip.emp_code} · {slip.designation} · {slip.department_name}</div></div><Badge status={slip.status} /></div>
          <table className="w-full"><tbody>
            {[['Basic salary', slip.basic], ['Allowances', slip.allowances], ['Overtime', slip.overtime], ['Bonus', slip.bonus]].map(([l, v]) => <tr key={l}><td className="py-1 text-slate-600">{l}</td><td className="py-1 text-right">{money(v)}</td></tr>)}
            <tr className="border-t border-slate-200 font-semibold"><td className="py-1">Gross</td><td className="py-1 text-right">{money(slip.basic + slip.allowances + slip.overtime + slip.bonus)}</td></tr>
            {[['Deductions', slip.deductions], [`EPF employee (${settings?.epf_employee_rate}%)`, slip.epf_employee]].map(([l, v]) => <tr key={l}><td className="py-1 text-rose-600">{l}</td><td className="py-1 text-right text-rose-600">- {money(v)}</td></tr>)}
            <tr className="border-t-2 border-slate-800 font-bold text-base"><td className="py-2">Net pay</td><td className="py-2 text-right">{money(slip.net)}</td></tr>
          </tbody></table>
          <div className="mt-3 text-[11px] text-slate-400">Employer contributions: EPF {money(slip.epf_employer)} · ETF {money(slip.etf)}</div>
        </div>}
      </Modal>
      <Confirm open={payAsk} onClose={() => setPayAsk(false)} onConfirm={payAll} danger={false} title="Pay salaries" message={`Mark ${drafts} payslip(s) for ${monthLabel(month)} as paid? Salary and EPF/ETF expenses will be posted to finance.`} confirmText="Pay now" />
    </div>
  );
}
