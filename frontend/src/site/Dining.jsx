import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Phone, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { money, today } from '../lib/format';
import { Reveal, Field, Input, useToast } from '../components/ui';
import { useResortInfo } from './SiteLayout';
import PageHero from './PageHero';

const TAG_COLORS = { popular: 'bg-amber-100 text-amber-800', spicy: 'bg-rose-100 text-rose-700', veg: 'bg-emerald-100 text-emerald-800', chef: 'bg-violet-100 text-violet-800', signature: 'bg-brand-100 text-brand-800', premium: 'bg-slate-800 text-white' };

export default function Dining() {
  const info = useResortInfo();
  const toast = useToast();
  const [menu, setMenu] = useState([]);
  const [tab, setTab] = useState('food');
  const [form, setForm] = useState({ guest_name: '', phone: '', date: today(), time: '19:30', party_size: 2, notes: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { api.get('/api/public/menu').then(setMenu).catch(() => {}); }, []);
  const cats = menu.filter((c) => (tab === 'food' ? c.type === 'food' : c.type !== 'food'));

  const reserve = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/api/public/table-reservation', form); setDone(true); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHero kicker="Eat & drink" title="Restaurant & Bar" text="The Lake House Restaurant serves breakfast, lunch and dinner. The Sunset Bar opens at 4pm with signature arrack cocktails and live music on weekends." image="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=2000&q=80" />

      <div className="max-w-7xl mx-auto px-5 mt-14 grid sm:grid-cols-3 gap-5">
        {[['Breakfast', '7:00 - 10:30'], ['Lunch & Dinner', '12:00 - 22:30'], ['Sunset Bar', '16:00 - late']].map(([n, t], i) => (
          <Reveal key={n} delay={i * 0.08}><div className="card p-5 flex items-center gap-4"><span className="h-11 w-11 rounded-2xl bg-sand-100 text-brand-700 flex items-center justify-center"><Clock size={20} /></span><div><div className="font-semibold text-slate-900">{n}</div><div className="text-sm text-slate-500">{t}</div></div></div></Reveal>
        ))}
      </div>

      <section className="max-w-7xl mx-auto px-5 mt-20 grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <Reveal className="flex items-end justify-between flex-wrap gap-4">
            <div><span className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-600">Our menu</span><h2 className="font-display text-4xl text-slate-900 mt-2">{tab === 'food' ? 'Kitchen' : 'Bar & Beverages'}</h2></div>
            <div className="inline-flex rounded-xl bg-sand-100 p-1">
              {['food', 'drinks'].map((t) => <button key={t} onClick={() => setTab(t)} className={`relative px-5 py-2 text-sm font-semibold rounded-lg transition ${tab === t ? 'text-brand-900' : 'text-slate-500'}`}>{tab === t && <motion.span layoutId="menu-tab" className="absolute inset-0 bg-white rounded-lg shadow" />}<span className="relative capitalize">{t}</span></button>)}
            </div>
          </Reveal>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-8 space-y-10">
              {cats.map((c) => (
                <div key={c.id}>
                  <h3 className="font-display text-2xl text-slate-900 border-b border-sand-300 pb-2">{c.name}</h3>
                  <ul className="mt-4 divide-y divide-sand-200">
                    {c.items.map((it) => (
                      <li key={it.id} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">{it.name}{it.tags && it.tags.split(',').filter(Boolean).map((t) => <span key={t} className={`chip ${TAG_COLORS[t.trim()] || 'bg-slate-100 text-slate-600'}`}>{t.trim()}</span>)}</div>
                          {it.description && <div className="text-sm text-slate-500 mt-0.5">{it.description}</div>}
                        </div>
                        <div className="font-semibold text-brand-800 whitespace-nowrap">{money(it.price, { decimals: 0 })}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
          <p className="text-xs text-slate-400 mt-8">Prices in {info.currency}. {info.service_charge_rate}% service charge and {info.tax_rate}% government taxes apply.</p>
        </div>

        <Reveal delay={0.15}>
          <div className="card p-6 sticky top-28">
            <h3 className="font-display text-2xl text-slate-900">Reserve a table</h3>
            <p className="text-sm text-slate-500 mt-1">We'll confirm by phone within the hour.</p>
            {done ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 rounded-2xl bg-accent-100 text-accent-700 p-5 text-sm">
                <div className="font-semibold text-base">Request received!</div>
                Thank you {form.guest_name}. Our team will call {form.phone} to confirm your table for {form.party_size} on {form.date} at {form.time}.
              </motion.div>
            ) : (
              <form onSubmit={reserve} className="mt-5 space-y-3">
                <Field label="Name"><Input required value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="Your name" /></Field>
                <Field label="Phone"><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 7x xxx xxxx" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date"><Input type="date" min={today()} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
                  <Field label="Time"><Input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
                </div>
                <Field label="Guests"><Input type="number" min={1} max={30} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) })} /></Field>
                <Field label="Special requests"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Birthday, dietary needs..." /></Field>
                <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Request reservation</button>
                <div className="text-xs text-slate-400 text-center flex items-center justify-center gap-1"><Phone size={12} /> or call {info.phone}</div>
              </form>
            )}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
