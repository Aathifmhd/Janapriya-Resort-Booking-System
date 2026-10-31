import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Users, Check, ChevronRight, ChevronLeft, Loader2, BedDouble, PartyPopper, Printer } from 'lucide-react';
import { api, qs } from '../lib/api';
import { money, today, addDays, nightsBetween, fmtDate } from '../lib/format';
import { Field, Input, Select, Textarea, useToast } from '../components/ui';
import { useResortInfo } from './SiteLayout';

const steps = ['Dates', 'Room', 'Details', 'Confirm'];

export default function Book() {
  const [params] = useSearchParams();
  const info = useResortInfo();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState({
    check_in: params.get('check_in') || addDays(today(), 1),
    check_out: params.get('check_out') || addDays(today(), 3),
    adults: Number(params.get('adults')) || 2,
    children: Number(params.get('children')) || 0,
  });
  const [types, setTypes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '', nationality: 'Sri Lankan', nic_passport: '', special_requests: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const nights = nightsBetween(search.check_in, search.check_out);
  const preType = params.get('room_type_id');

  const runSearch = async () => {
    if (nights < 1) return toast.error('Check-out must be after check-in');
    setLoading(true);
    try {
      const r = await api.get(`/api/public/availability${qs(search)}`);
      setTypes(r);
      setStep(1);
      if (preType) { const t = r.find((x) => x.id === Number(preType)); if (t?.available) setSelected(t); }
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (params.get('check_in') || preType) runSearch(); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    if (!guest.name || !guest.phone) return toast.error('Name and phone are required');
    setBusy(true);
    try {
      const r = await api.post('/api/public/book', { ...search, room_type_id: selected.id, special_requests: guest.special_requests, guest });
      setResult(r); setStep(3);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const subtotal = selected ? selected.base_rate * nights : 0;
  const tax = subtotal * (Number(info.tax_rate) || 0) / 100;

  return (
    <div className="pt-28 pb-10 max-w-6xl mx-auto px-5">
      <div className="text-center mb-10">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-600">Reservations</span>
        <h1 className="font-display text-4xl sm:text-5xl text-slate-900 mt-2">Book your stay</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 sm:gap-4">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-brand-800' : 'text-slate-400'}`}>
              <motion.span animate={{ scale: i === step ? 1.1 : 1 }} className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${i < step ? 'bg-accent-600 text-white' : i === step ? 'bg-brand-700 text-white shadow-lg shadow-brand-700/30' : 'bg-slate-200 text-slate-500'}`}>{i < step ? <Check size={14} /> : i + 1}</motion.span>
              <span className="text-sm font-semibold hidden sm:inline">{s}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-6 sm:w-14 rounded ${i < step ? 'bg-accent-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <Panel key="dates">
                <h2 className="font-display text-2xl text-slate-900 mb-5">When would you like to stay?</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Check-in"><Input type="date" min={today()} value={search.check_in} onChange={(e) => setSearch({ ...search, check_in: e.target.value, check_out: e.target.value >= search.check_out ? addDays(e.target.value, 1) : search.check_out })} /></Field>
                  <Field label="Check-out"><Input type="date" min={addDays(search.check_in, 1)} value={search.check_out} onChange={(e) => setSearch({ ...search, check_out: e.target.value })} /></Field>
                  <Field label="Adults"><Select value={search.adults} onChange={(e) => setSearch({ ...search, adults: Number(e.target.value) })} options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} adult${n > 1 ? 's' : ''}` }))} /></Field>
                  <Field label="Children"><Select value={search.children} onChange={(e) => setSearch({ ...search, children: Number(e.target.value) })} options={[0, 1, 2, 3].map((n) => ({ value: n, label: `${n} child${n !== 1 ? 'ren' : ''}` }))} /></Field>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{nights} night{nights !== 1 ? 's' : ''}</span>
                  <button className="btn-primary" onClick={runSearch} disabled={loading}>{loading && <Loader2 size={16} className="animate-spin" />}Search rooms <ChevronRight size={16} /></button>
                </div>
              </Panel>
            )}

            {step === 1 && (
              <Panel key="room">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-2xl text-slate-900">Choose your room</h2>
                  <button className="btn-ghost btn-sm" onClick={() => setStep(0)}><ChevronLeft size={14} /> Change dates</button>
                </div>
                <div className="space-y-4">
                  {types?.map((t, i) => (
                    <motion.button key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} disabled={!t.available} onClick={() => setSelected(t)}
                      className={`w-full text-left flex flex-col sm:flex-row gap-4 rounded-3xl border-2 p-3 transition ${selected?.id === t.id ? 'border-brand-600 bg-sand-100/60 shadow-lg' : 'border-slate-200 hover:border-brand-300 bg-white'} ${!t.available ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <img src={t.image_url} alt="" className="h-36 sm:h-32 sm:w-44 rounded-2xl object-cover" />
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between gap-3">
                          <div><div className="font-display text-xl text-slate-900">{t.name}</div><div className="text-xs text-slate-500">Up to {t.max_adults} adults · {t.size_sqm} m²</div></div>
                          <div className="text-right shrink-0"><div className="font-bold text-brand-800">{money(t.base_rate, { decimals: 0 })}</div><div className="text-[10px] text-slate-400 uppercase">per night</div></div>
                        </div>
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{t.description}</p>
                        <div className="mt-2 text-xs font-semibold">
                          {t.available ? <span className="text-brand-700">{t.available_count} room{t.available_count > 1 ? 's' : ''} available</span> : !t.fits_guests ? <span className="text-amber-700">Too small for your party</span> : <span className="text-rose-600">Sold out for these dates</span>}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end"><button className="btn-primary" disabled={!selected} onClick={() => setStep(2)}>Continue <ChevronRight size={16} /></button></div>
              </Panel>
            )}

            {step === 2 && (
              <Panel key="details">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-2xl text-slate-900">Your details</h2>
                  <button className="btn-ghost btn-sm" onClick={() => setStep(1)}><ChevronLeft size={14} /> Back</button>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full name *" className="sm:col-span-2"><Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="As on your ID / passport" /></Field>
                  <Field label="Email"><Input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder="you@example.com" /></Field>
                  <Field label="Phone *"><Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="+94 7x xxx xxxx" /></Field>
                  <Field label="Nationality"><Input value={guest.nationality} onChange={(e) => setGuest({ ...guest, nationality: e.target.value })} /></Field>
                  <Field label="NIC / Passport"><Input value={guest.nic_passport} onChange={(e) => setGuest({ ...guest, nic_passport: e.target.value })} /></Field>
                  <Field label="Special requests" className="sm:col-span-2"><Textarea value={guest.special_requests} onChange={(e) => setGuest({ ...guest, special_requests: e.target.value })} placeholder="Early check-in, airport pickup, anniversary..." /></Field>
                </div>
                <p className="text-xs text-slate-500 mt-4">By booking you agree to our cancellation policy: free cancellation up to 48 hours before check-in. Payment is made at the resort (cash, card or bank transfer).</p>
                <div className="mt-6 flex justify-end"><button className="btn-accent" onClick={submit} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Confirm booking</button></div>
              </Panel>
            )}

            {step === 3 && result && (
              <Panel key="done">
                <div className="text-center py-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto h-20 w-20 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center"><PartyPopper size={36} /></motion.div>
                  <h2 className="font-display text-3xl text-slate-900 mt-5">Booking request received!</h2>
                  <p className="text-slate-600 mt-2">Your reference is</p>
                  <div className="font-mono text-3xl font-bold text-brand-800 mt-1 tracking-wider">{result.code}</div>
                  <p className="text-sm text-slate-500 mt-4 max-w-md mx-auto">Our front office will confirm your reservation shortly{result.guest_email ? ` and email ${result.guest_email}` : ''}. Save your reference to manage your booking online.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
                    <Link to={`/my-booking?code=${result.code}&phone=${encodeURIComponent(result.guest_phone || '')}`} className="btn-primary">View my booking</Link>
                  </div>
                </div>
              </Panel>
            )}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div>
          <motion.div layout className="card p-6 sticky top-28">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><BedDouble size={18} className="text-brand-700" /> Your stay</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row icon={CalendarDays} label="Check-in" value={`${fmtDate(search.check_in)} · ${info.check_in_time}`} />
              <Row icon={CalendarDays} label="Check-out" value={`${fmtDate(search.check_out)} · ${info.check_out_time}`} />
              <Row icon={Users} label="Guests" value={`${search.adults} adult${search.adults > 1 ? 's' : ''}${search.children ? `, ${search.children} child${search.children > 1 ? 'ren' : ''}` : ''}`} />
            </div>
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <div className="font-display text-lg text-slate-900">{selected.name}</div>
                    <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                      <div className="flex justify-between"><span>{money(selected.base_rate, { decimals: 0 })} × {nights} night{nights > 1 ? 's' : ''}</span><span>{money(subtotal)}</span></div>
                      <div className="flex justify-between"><span>Taxes ({info.tax_rate}%)</span><span>{money(tax)}</span></div>
                      <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100"><span>Total</span><span>{money(subtotal + tax)}</span></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const Panel = ({ children }) => <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }} className="card p-6 sm:p-8">{children}</motion.div>;
const Row = ({ icon: I, label, value }) => <div className="flex items-center gap-3"><I size={16} className="text-slate-400" /><span className="text-slate-500 w-20">{label}</span><span className="font-medium text-slate-800">{value}</span></div>;
