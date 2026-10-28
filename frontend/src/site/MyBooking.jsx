import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Loader2, Printer, XCircle } from 'lucide-react';
import { api, qs } from '../lib/api';
import { money, fmtDate } from '../lib/format';
import { Field, Input, Badge, Confirm, useToast } from '../components/ui';
import { useResortInfo } from './SiteLayout';

export default function MyBooking() {
  const [params] = useSearchParams();
  const info = useResortInfo();
  const toast = useToast();
  const [form, setForm] = useState({ code: params.get('code') || '', contact: params.get('phone') || params.get('email') || '' });
  const [busy, setBusy] = useState(false);
  const [b, setB] = useState(null);
  const [cancel, setCancel] = useState(false);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!form.code || !form.contact) return toast.error('Enter your booking reference and email or phone');
    setBusy(true);
    try {
      const contact = form.contact.includes('@') ? { email: form.contact } : { phone: form.contact };
      setB(await api.get(`/api/public/booking/${form.code.trim()}${qs(contact)}`));
    } catch (err) { toast.error(err.message); setB(null); } finally { setBusy(false); }
  };
  useEffect(() => { if (form.code && form.contact) lookup(); /* eslint-disable-next-line */ }, []);

  const doCancel = async () => {
    const contact = form.contact.includes('@') ? { email: form.contact } : { phone: form.contact };
    setB(await api.post(`/api/public/booking/${form.code.trim()}/cancel`, contact));
    toast.success('Booking cancelled');
  };

  return (
    <div className="pt-28 pb-10 max-w-3xl mx-auto px-5">
      <div className="text-center mb-10">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Manage</span>
        <h1 className="font-display text-4xl sm:text-5xl text-slate-900 mt-2">My booking</h1>
        <p className="text-slate-500 mt-3">Enter your booking reference and the email or phone used when booking.</p>
      </div>
      <form onSubmit={lookup} className="card p-6 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end no-print">
        <Field label="Booking reference"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="JR00012" /></Field>
        <Field label="Email or phone"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="you@example.com" /></Field>
        <button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find</button>
      </form>

      {b && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mt-6 overflow-hidden">
          <div className="relative h-40"><img src={b.room_image} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between text-white"><div><div className="text-xs text-white/70 uppercase tracking-wider">Reference</div><div className="font-mono text-2xl font-bold">{b.code}</div></div><Badge status={b.status} /></div>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-6">
            <div className="space-y-3 text-sm">
              <Row l="Guest" v={b.guest_name} />
              <Row l="Room" v={`${b.room_type_name}${b.room_number && ['checked_in', 'checked_out'].includes(b.status) ? ` · Room ${b.room_number}` : ''}`} />
              <Row l="Check-in" v={`${fmtDate(b.check_in)} from ${info.check_in_time}`} />
              <Row l="Check-out" v={`${fmtDate(b.check_out)} by ${info.check_out_time}`} />
              <Row l="Guests" v={`${b.adults} adults, ${b.children} children`} />
              {b.special_requests && <Row l="Requests" v={b.special_requests} />}
            </div>
            <div className="rounded-2xl bg-sand-100 p-5 text-sm space-y-2">
              <div className="flex justify-between text-slate-600"><span>{b.nights} night{b.nights > 1 ? 's' : ''} × {money(b.rate, { decimals: 0 })}</span><span>{money(b.subtotal)}</span></div>
              {b.folio_subtotal > b.subtotal && <div className="flex justify-between text-slate-600"><span>Other charges</span><span>{money(b.folio_subtotal - b.subtotal)}</span></div>}
              <div className="flex justify-between text-slate-600"><span>Taxes</span><span>{money(b.folio_tax)}</span></div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-sand-300"><span>Total</span><span>{money(b.folio_total)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{money(b.paid)}</span></div>
              <div className="flex justify-between font-semibold text-slate-800"><span>Balance due</span><span>{money(b.balance)}</span></div>
            </div>
          </div>
          <div className="px-6 pb-6 flex flex-wrap gap-2 no-print">
            <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print confirmation</button>
            {['pending', 'confirmed'].includes(b.status) && <button className="btn-ghost text-rose-600" onClick={() => setCancel(true)}><XCircle size={16} /> Cancel booking</button>}
          </div>
        </motion.div>
      )}
      <Confirm open={cancel} onClose={() => setCancel(false)} onConfirm={doCancel} title="Cancel booking" message="Are you sure you want to cancel this reservation? This cannot be undone." confirmText="Yes, cancel" />
    </div>
  );
}
const Row = ({ l, v }) => <div className="flex gap-3"><span className="w-24 text-slate-400">{l}</span><span className="font-medium text-slate-800">{v}</span></div>;
