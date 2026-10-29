import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { CalendarDays, Users, ArrowRight, Waves, UtensilsCrossed, Wine, Sparkles, Star, Wifi, Car, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { money, today, addDays } from '../lib/format';
import { Reveal } from '../components/ui';
import { useResortInfo } from './SiteLayout';
import { HERO_SLIDES, HeroImages, useSlideshow } from './HeroSlideshow';

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
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/30 to-sand-50" />
        </motion.div>
        <motion.div style={{ opacity }} className="relative max-w-7xl mx-auto px-5 w-full pt-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 border border-white/20"><Sparkles size={14} /> {info.tagline}</span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white font-semibold mt-6 leading-[1.05] max-w-3xl">
              {info.website_hero_title || 'Escape to Serenity'}
            </h1>
            <p className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">{info.website_hero_subtitle}</p>
          </motion.div>

          <motion.form onSubmit={search} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-10 glass rounded-3xl p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 max-w-4xl">
            <HeroField icon={CalendarDays} label="Check-in"><input type="date" min={today()} value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value, check_out: e.target.value >= form.check_out ? addDays(e.target.value, 1) : form.check_out })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800" /></HeroField>
            <HeroField icon={CalendarDays} label="Check-out"><input type="date" min={addDays(form.check_in, 1)} value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800" /></HeroField>
            <HeroField icon={Users} label="Adults"><select value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></HeroField>
            <HeroField icon={Users} label="Children"><select value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} className="bg-transparent outline-none w-full text-sm font-semibold text-slate-800">{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></HeroField>
            <button type="submit" className="btn-gold col-span-2 lg:col-span-1 h-full min-h-[56px] text-base">Check Availability <ArrowRight size={18} /></button>
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
                <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center group-hover:bg-brand-700 group-hover:text-white transition"><h.icon size={22} /></div>
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
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Stay with us</span>
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
                    <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-white/70">From</div><div className="font-bold text-lg text-gold-300">{money(t.base_rate, { decimals: 0 })}</div></div>
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
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">Dine & unwind</span>
            <h2 className="font-display text-4xl sm:text-5xl text-white mt-3 leading-tight">From lake-fresh seafood to sunset arrack sours</h2>
            <p className="text-white/70 mt-5 leading-relaxed max-w-lg">Our restaurant serves breakfast, lunch and dinner with the finest local produce. In the evening, the bar fills with the sound of ice, laughter and the lapping of the lake.</p>
            <Link to="/dining" className="btn-gold mt-8">Explore the menu</Link>
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

      {/* AMENITIES + TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-5 mt-24 grid lg:grid-cols-5 gap-10">
        <Reveal className="lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Everything you need</span>
          <h2 className="font-display text-4xl text-slate-900 mt-2">Resort amenities</h2>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[[Wifi, 'Free high-speed Wi-Fi'], [Car, 'Airport transfers'], [Sun, 'Infinity pool'], [Waves, 'Boat rides & kayaking'], [UtensilsCrossed, 'In-room dining'], [Sparkles, 'Ayurvedic spa']].map(([I, t]) => (
              <div key={t} className="flex items-center gap-3 text-sm text-slate-700"><span className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center"><I size={16} /></span>{t}</div>
            ))}
          </div>
        </Reveal>
        <div className="lg:col-span-3 grid sm:grid-cols-2 gap-5">
          {[['Sarah T.', 'United Kingdom', 'The lake view from our balcony was breathtaking. Staff went out of their way for our anniversary - the sunset bar is a must.'], ['Hans M.', 'Germany', 'Best rice and curry I had in Sri Lanka, and the villa pool was pure bliss. Online booking was quick and the confirmation came instantly.'], ['Priya R.', 'India', 'Perfect for families. The suite was spacious and kids loved the boat ride. Will definitely return.'], ['Dinesh K.', 'Colombo', 'We hosted a birthday dinner at the restaurant - the team arranged everything, even the cake.']].map(([n, c, t], i) => (
            <Reveal key={n} delay={i * 0.08}>
              <div className="card p-6 h-full">
                <div className="flex gap-0.5 text-gold-500">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={14} fill="currentColor" />)}</div>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">"{t}"</p>
                <div className="mt-4 text-sm font-semibold text-slate-900">{n} <span className="font-normal text-slate-400">· {c}</span></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 mt-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-800 text-white px-8 py-16 text-center">
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl animate-float" />
            <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
            <h2 className="relative font-display text-4xl sm:text-5xl">Your lakeside escape awaits</h2>
            <p className="relative text-white/70 mt-4 max-w-xl mx-auto">Book directly with us for the best rates, free cancellation up to 48 hours before arrival and a welcome drink at the Sunset Bar.</p>
            <Link to="/book" className="btn-gold mt-8 relative text-base px-8 py-3.5">Book your stay</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function HeroField({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 border border-slate-200/70">
      <Icon size={18} className="text-brand-700 shrink-0" />
      <div className="min-w-0 flex-1"><div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>{children}</div>
    </div>
  );
}
