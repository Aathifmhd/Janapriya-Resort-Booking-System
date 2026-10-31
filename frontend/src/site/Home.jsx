import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CalendarDays, Users, ArrowRight, Waves, UtensilsCrossed, Wine, Sparkles, Star, Wifi, Car, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { money, today, addDays } from '../lib/format';
import { Reveal } from '../components/ui';
import { useResortInfo } from './SiteLayout';
import { HERO_SLIDES, HeroImages, useSlideshow } from './HeroSlideshow';

// hero search: the panel rises in, then its fields and button follow one by one
const EASE = [0.22, 1, 0.36, 1];
const SEARCH_PANEL = { hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.6, ease: EASE, delayChildren: 0.9, staggerChildren: 0.08 } } };
const RISE = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };
// closing banner: once in view its lines rise in one after another, and a short rule draws out under the heading
const CTA_PANEL = { hidden: {}, show: { transition: { delayChildren: 0.2, staggerChildren: 0.12 } } };
const RULE = { hidden: { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.8, ease: EASE } } };

export default function Home() {
  const info = useResortInfo();
  const nav = useNavigate();
  const slide = useSlideshow(HERO_SLIDES.length);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ check_in: addDays(today(), 1), check_out: addDays(today(), 3), adults: 2, children: 0 });
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => { api.get('/api/public/room-types').then(setTypes).catch(() => {}); }, []);

  const search = (e) => { e.preventDefault(); nav(`/book?${new URLSearchParams(form).toString()}`); };

  return (
    <div>
      {/* HERO */}
      <section ref={heroRef} className="relative h-[100svh] min-h-[640px] overflow-hidden flex items-center">
        <motion.div style={{ y }} className="absolute inset-0 bg-brand-950">
          <HeroImages slides={HERO_SLIDES} index={slide} />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/30 to-brand-950/30" />
        </motion.div>
        <motion.div style={{ opacity }} className="relative max-w-7xl mx-auto px-5 w-full pt-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sand-100 border border-white/20"><Sparkles size={14} /> {info.tagline}</span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white font-semibold mt-6 leading-[1.05] max-w-3xl">
              {info.website_hero_title || 'Escape to Serenity'}
            </h1>
            <p className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">{info.website_hero_subtitle}</p>
          </motion.div>

          <motion.form onSubmit={search} variants={SEARCH_PANEL} initial="hidden" animate="show"
            className="mt-10 max-w-5xl grid grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2.5 rounded-3xl border border-white/25 bg-white/10 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <HeroField icon={CalendarDays} label="Check-in"><input type="date" min={today()} value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value, check_out: e.target.value >= form.check_out ? addDays(e.target.value, 1) : form.check_out })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800" /></HeroField>
            <HeroField icon={CalendarDays} label="Check-out"><input type="date" min={addDays(form.check_in, 1)} value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800" /></HeroField>
            <HeroField icon={Users} label="Adults"><select value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></HeroField>
            <HeroField icon={Users} label="Children"><select value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800">{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></HeroField>
            <motion.button variants={RISE} type="submit" className="group btn-accent col-span-2 lg:col-span-1 h-full min-h-[56px] rounded-xl px-7 text-base lg:text-sm whitespace-nowrap duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5">
              Check Availability <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
            </motion.button>
          </motion.form>
        </motion.div>
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs tracking-widest uppercase">Scroll</motion.div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="max-w-7xl mx-auto px-5 -mt-6 relative z-10">
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { icon: Waves, title: 'Lakeside Rooms & Villas', text: 'Wake to misty water views from private balconies and plunge-pool villas.', to: '/rooms' },
            { icon: UtensilsCrossed, title: 'The Lake House Restaurant', text: 'Authentic Sri Lankan rice & curry, fresh seafood and international favourites.', to: '/dining' },
            { icon: Wine, title: 'Sunset Bar', text: 'Signature arrack cocktails, ice-cold Lion lager and the best sunset on the lake.', to: '/dining' },
          ].map((h, i) => (
            <Reveal key={h.title} delay={i * 0.1}>
              <Link to={h.to} className="card p-7 block h-full group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-12 w-12 rounded-2xl bg-sand-100 text-brand-700 flex items-center justify-center group-hover:bg-sand-300 group-hover:text-brand-900 transition"><h.icon size={22} /></div>
                <h3 className="font-display text-xl font-semibold mt-5 text-slate-900">{h.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{h.text}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 mt-4 group-hover:gap-2 transition-all">Discover <ArrowRight size={14} /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ROOMS */}
      <section className="max-w-7xl mx-auto px-5 mt-24">
        <Reveal className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-600">Stay with us</span>
            <h2 className="font-display text-4xl text-slate-900 mt-2">Rooms & Villas</h2>
          </div>
          <Link to="/rooms" className="btn-secondary">View all rooms</Link>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          {types.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.08}>
              <Link to={`/book?room_type_id=${t.id}`} className="group block card overflow-hidden hover:shadow-2xl transition-all duration-500">
                <div className="relative h-64 overflow-hidden">
                  <img src={t.image_url} alt={t.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white">
                    <div>
                      <h3 className="font-display text-2xl">{t.name}</h3>
                      <p className="text-xs text-white/70 mt-1">Up to {t.max_adults} adults · {t.size_sqm} m²</p>
                    </div>
                    <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-white/70">From</div><div className="font-bold text-lg text-sand-300">{money(t.base_rate, { decimals: 0 })}</div></div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600">{t.description}</p>
                  <div className="flex flex-wrap gap-2 mt-4">{(t.amenities || []).slice(0, 4).map((a) => <span key={a} className="chip bg-sand-100 text-slate-600">{a}</span>)}</div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* EXPERIENCE BAND */}
      <section className="mt-28 relative overflow-hidden">
        <div className="absolute inset-0"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=2000&q=80" alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-brand-950/80" /></div>
        <div className="relative max-w-7xl mx-auto px-5 py-28 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-sand-300">Dine & unwind</span>
            <h2 className="font-display text-4xl sm:text-5xl text-white mt-3 leading-tight">From lake-fresh seafood to sunset arrack sours</h2>
            <p className="text-white/70 mt-5 leading-relaxed max-w-lg">Our restaurant serves breakfast, lunch and dinner with the finest local produce. In the evening, the bar fills with the sound of ice, laughter and the lapping of the lake.</p>
            <Link to="/dining" className="btn-accent mt-8">Explore the menu</Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            {[['https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80', 'Signature cocktails'], ['https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=80', 'Sri Lankan rice & curry'], ['https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80', 'Lakeside dining'], ['https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80', 'Fresh seafood']].map(([src, cap], i) => (
              <Reveal key={cap} delay={i * 0.1} className={i % 2 ? 'mt-8' : ''}>
                <div className="relative rounded-3xl overflow-hidden aspect-[4/5] group">
                  <img src={src} alt={cap} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute bottom-3 left-3 chip bg-white/90 text-slate-800">{cap}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AMENITIES + TESTIMONIALS, on a linen band */}
      <section className="mt-24 bg-sand-100 py-20">
        <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-5 gap-10">
          <Reveal className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-600">Everything you need</span>
            <h2 className="font-display text-4xl text-slate-900 mt-2">Resort amenities</h2>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {[[Wifi, 'Free high-speed Wi-Fi'], [Car, 'Airport transfers'], [Sun, 'Infinity pool'], [Waves, 'Boat rides & kayaking'], [UtensilsCrossed, 'In-room dining'], [Sparkles, 'Ayurvedic spa']].map(([I, t]) => (
                <div key={t} className="flex items-center gap-3 text-sm text-slate-700"><span className="h-9 w-9 rounded-xl bg-white text-brand-700 shadow-sm flex items-center justify-center"><I size={16} /></span>{t}</div>
              ))}
            </div>
          </Reveal>
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-5">
            {[['Sarah T.', 'United Kingdom', 'The lake view from our balcony was breathtaking. Staff went out of their way for our anniversary - the sunset bar is a must.'], ['Hans M.', 'Germany', 'Best rice and curry I had in Sri Lanka, and the villa pool was pure bliss. Online booking was quick and the confirmation came instantly.'], ['Priya R.', 'India', 'Perfect for families. The suite was spacious and kids loved the boat ride. Will definitely return.'], ['Dinesh K.', 'Colombo', 'We hosted a birthday dinner at the restaurant - the team arranged everything, even the cake.']].map(([n, c, t], i) => (
              <Reveal key={n} delay={i * 0.08}>
                <div className="card p-6 h-full">
                  <div className="flex gap-0.5 text-accent-500">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={14} fill="currentColor" />)}</div>
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">"{t}"</p>
                  <div className="mt-4 text-sm font-semibold text-slate-900">{n} <span className="font-normal text-slate-400">· {c}</span></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA: soft glows drift and a band of light sweeps across the banner */}
      <section className="max-w-7xl mx-auto px-5 mt-24">
        <Reveal>
          <motion.div variants={CTA_PANEL} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}
            className="relative overflow-hidden rounded-[2.5rem] bg-sand-300 text-slate-900 px-8 py-16 text-center">
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-sand-50/50 blur-3xl motion-safe:animate-drift" />
            <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-sand-100/60 blur-3xl motion-safe:animate-drift" style={{ animationDuration: '24s', animationDirection: 'alternate-reverse' }} />
            <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-sweep" />
            <motion.h2 variants={RISE} className="relative font-display text-4xl sm:text-5xl">Your lakeside escape awaits</motion.h2>
            <motion.span variants={RULE} className="relative mx-auto mt-5 block h-px w-16 bg-slate-900/40" />
            <motion.p variants={RISE} className="relative text-slate-700 mt-5 max-w-xl mx-auto">Book directly with us for the best rates, free cancellation up to 48 hours before arrival and a welcome drink at the Sunset Bar.</motion.p>
            <motion.div variants={RISE} className="relative mt-8">
              <Link to="/book" className="group btn-primary bg-brand-900 hover:bg-brand-950 text-base px-8 py-3.5 duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5">
                Book your stay <ArrowRight size={18} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>
        </Reveal>
      </section>
    </div>
  );
}

function HeroField({ icon: Icon, label, children }) {
  return (
    <motion.label variants={RISE} className="group flex cursor-pointer items-center gap-3 rounded-xl bg-white/95 px-3 sm:px-4 py-3 shadow-sm ring-1 ring-black/5 transition duration-300 hover:bg-white hover:shadow-lg motion-safe:hover:-translate-y-0.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-400">
      <Icon size={18} className="hidden sm:block shrink-0 text-brand-700 transition-colors duration-300 group-hover:text-accent-600 group-focus-within:text-accent-600" />
      <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold transition-colors duration-300 group-focus-within:text-accent-600">{label}</span>{children}</span>
    </motion.label>
  );
}
