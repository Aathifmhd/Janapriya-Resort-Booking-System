import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { setCurrencySymbol } from '../lib/format';

const InfoCtx = createContext({});
export const useResortInfo = () => useContext(InfoCtx);

const links = [
  { to: '/', label: 'Home' },
  { to: '/rooms', label: 'Rooms & Villas' },
  { to: '/dining', label: 'Restaurant & Bar' },
  { to: '/my-booking', label: 'My Booking' },
  { to: '/contact', label: 'Contact' },
];

export default function SiteLayout() {
  const [info, setInfo] = useState({ resort_name: 'Janapriya Resort' });
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  const lenis = useRef(null);
  const transparent = loc.pathname === '/' && !scrolled;

  useEffect(() => { api.get('/api/public/info').then((i) => { setInfo(i); setCurrencySymbol(i.currency_symbol); }).catch(() => {}); }, []);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 40); h(); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  // While the public site is shown: hide the page scrollbar and glide wheel scrolling with Lenis
  // (not for visitors who prefer reduced motion). The staff portal keeps native scrolling.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('site-scroll');
    let frame;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lenis.current = new Lenis({ lerp: 0.08 });
      const raf = (t) => { lenis.current?.raf(t); frame = requestAnimationFrame(raf); };
      frame = requestAnimationFrame(raf);
    }
    return () => { cancelAnimationFrame(frame); lenis.current?.destroy(); lenis.current = null; html.classList.remove('site-scroll'); };
  }, []);
  useEffect(() => {
    setOpen(false);
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true }); else window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <InfoCtx.Provider value={info}>
      <div className="site isolate min-h-screen flex flex-col bg-sand-50">
        {/* soft glows of the palette's tan and taupe drift slowly behind the whole page */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[20%] -left-[15%] h-[60vmax] w-[60vmax] bg-radial from-sand-300/40 to-transparent to-70% motion-safe:animate-drift" style={{ animationDuration: '26s' }} />
          <div className="absolute top-[25%] -right-[20%] h-[55vmax] w-[55vmax] bg-radial from-sand-200/70 to-transparent to-70% motion-safe:animate-drift" style={{ animationDuration: '32s', animationDirection: 'alternate-reverse' }} />
          <div className="absolute -bottom-[25%] left-[15%] h-[50vmax] w-[50vmax] bg-radial from-sand-300/30 to-transparent to-70% motion-safe:animate-drift" style={{ animationDuration: '29s', animationDelay: '-10s' }} />
        </div>
        <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${transparent ? 'bg-transparent py-5' : 'bg-sand-50/90 backdrop-blur-xl shadow-sm py-3'}`}>
          <div className="max-w-7xl mx-auto px-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 8 }} className="h-11 w-11 rounded-full bg-sand-300 flex items-center justify-center shadow-lg shadow-brand-900/20">
                <span className="font-display text-brand-900 text-2xl font-bold">J</span>
              </motion.div>
              <div className="leading-tight">
                <div className={`font-display text-xl font-semibold ${transparent ? 'text-white' : 'text-brand-900'}`}>{info.resort_name}</div>
                <div className={`font-luxe text-[10px] uppercase tracking-[0.25em] ${transparent ? 'text-white/70' : 'text-slate-500'}`}>Lakeside Luxury</div>
              </div>
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `relative px-2.5 xl:px-4 py-2 font-luxe text-[12px] xl:text-[13px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition ${transparent ? 'text-white/85 hover:text-white' : 'text-slate-600 hover:text-brand-800'} ${isActive ? (transparent ? 'text-white' : 'text-brand-800') : ''}`}>
                  {({ isActive }) => (<>
                    {l.label}
                    {isActive && <motion.span layoutId="site-nav" className={`absolute left-2.5 right-2.5 xl:left-4 xl:right-4 -bottom-0.5 h-0.5 rounded-full ${transparent ? 'bg-sand-300' : 'bg-brand-600'}`} />}
                  </>)}
                </NavLink>
              ))}
              {/* an outline over the hero; it fills once the header turns white */}
              <Link to="/book" className={`ml-3 duration-300 ${transparent ? 'btn-outline-light' : 'btn-accent border border-transparent'}`}>Book Now</Link>
            </nav>
            <button onClick={() => setOpen(!open)} className={`lg:hidden p-2 rounded-xl ${transparent ? 'text-white' : 'text-slate-700'}`}>{open ? <X /> : <Menu />}</button>
          </div>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="lg:hidden overflow-hidden bg-sand-50/95 backdrop-blur-xl border-t border-slate-100 mt-3">
                <div className="px-5 py-4 flex flex-col gap-1">
                  {links.map((l) => <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `px-3 py-2.5 rounded-xl font-luxe text-[13px] font-semibold uppercase tracking-[0.14em] ${isActive ? 'bg-sand-100 text-brand-800' : 'text-slate-700'}`}>{l.label}</NavLink>)}
                  <Link to="/book" className="btn-accent mt-2">Book Now</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Outlet />
          </motion.div>
        </main>

        <footer className="bg-sand-100 border-t border-sand-200 text-slate-600 mt-20">
          <div className="max-w-7xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="font-display text-2xl text-slate-900 mb-3">{info.resort_name}</div>
              <p className="text-sm leading-relaxed max-w-md text-slate-500">{info.tagline}. Lakeside rooms and villas, a restaurant serving authentic Sri Lankan and international cuisine, and a sunset bar with the island's best arrack cocktails.</p>
              <div className="flex gap-3 mt-5">
                {[Facebook, Instagram].map((I, i) => <a key={i} href="#" className="h-10 w-10 rounded-full bg-white text-slate-700 shadow-sm hover:bg-sand-300 hover:text-slate-900 flex items-center justify-center transition"><I size={18} /></a>)}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 mb-3">Explore</div>
              <ul className="space-y-2 text-sm">
                {links.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-slate-900 transition">{l.label}</Link></li>)}
                <li><Link to="/book" className="hover:text-slate-900 transition">Book a Room</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-slate-900 mb-3">Contact</div>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2"><MapPin size={16} className="shrink-0 mt-0.5 text-brand-500" />{info.address}</li>
                <li className="flex gap-2"><Phone size={16} className="shrink-0 mt-0.5 text-brand-500" />{info.phone}</li>
                <li className="flex gap-2"><Mail size={16} className="shrink-0 mt-0.5 text-brand-500" />{info.email}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-sand-200">
            <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>© {new Date().getFullYear()} {info.resort_name}. All rights reserved.</span>
              <Link to="/admin" className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"><Lock size={12} /> Staff Portal</Link>
            </div>
          </div>
        </footer>
      </div>
    </InfoCtx.Provider>
  );
}
