import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { setCurrencySymbol } from '../../lib/format';
import { PageHeader, Field, Input, Textarea, useToast, Skeleton } from '../../components/ui';

const SECTIONS = [
  { title: 'Resort profile', fields: [['resort_name', 'Resort name'], ['tagline', 'Tagline'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address', 'textarea']] },
  { title: 'Website', fields: [['website_hero_title', 'Hero title'], ['website_hero_subtitle', 'Hero subtitle', 'textarea']] },
  { title: 'Billing', fields: [['currency', 'Currency code'], ['currency_symbol', 'Currency symbol'], ['tax_rate', 'Tax / VAT rate (%)', 'number'], ['service_charge_rate', 'Service charge on F&B (%)', 'number'], ['check_in_time', 'Check-in time'], ['check_out_time', 'Check-out time']] },
  { title: 'Payroll', fields: [['epf_employee_rate', 'EPF employee (%)', 'number'], ['epf_employer_rate', 'EPF employer (%)', 'number'], ['etf_rate', 'ETF (%)', 'number'], ['overtime_multiplier', 'Overtime multiplier', 'number'], ['working_days_per_month', 'Working days / month', 'number'], ['working_hours_per_day', 'Working hours / day', 'number']] },
];

export default function Settings() {
  const toast = useToast();
  const { setSettings } = useAuth();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/api/settings').then(setS); }, []);
  const save = async () => { setBusy(true); try { const r = await api.put('/api/settings', s); setS(r); setSettings(r); setCurrencySymbol(r.currency_symbol); toast.success('Settings saved'); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  if (!s) return <Skeleton />;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Resort profile, website content, billing and payroll rules" actions={<button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes</button>} />
      <div className="space-y-6">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-4">{sec.title}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {sec.fields.map(([k, label, type]) => <Field key={k} label={label} className={type === 'textarea' ? 'sm:col-span-2' : ''}>{type === 'textarea' ? <Textarea value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /> : <Input type={type || 'text'} value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />}</Field>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
