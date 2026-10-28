import { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const transparent = loc.pathname === '/' && !scrolled;

  useEffect(() => { api.get('/api/public/info').then((i) => { setInfo(i); setCurrencySymbol(i.currency_symbol); }).catch(() => {}); }, []);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 40); h(); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);

  return (
    <InfoCtx.Provider value={info}>
      <div className="min-h-screen flex flex-col bg-sand-50">
        <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${transparent ? 'bg-transparent py-5' : 'bg-white/85 backdrop-blur-xl shadow-sm py-3'}`}>
          <div className="max-w-7xl mx-auto px-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 8 }} className="h-11 w-11 rounded-full bg-brand-700 flex items-center justify-center shadow-lg shadow-brand-700/30">
                <span className="font-display text-gold-300 text-2xl font-bold">J</span>
              </motion.div>
              <div className="leading-tight">
                <div className={`font-display text-xl font-semibold ${transparent ? 'text-white' : 'text-brand-900'}`}>{info.resort_name}</div>
                <div className={`text-[10px] uppercase tracking-[0.25em] ${transparent ? 'text-white/70' : 'text-slate-500'}`}>Lakeside Luxury</div>
              </div>
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `relative px-4 py-2 text-sm font-medium transition ${transparent ? 'text-white/85 hover:text-white' : 'text-slate-600 hover:text-brand-800'} ${isActive ? (transparent ? 'text-white' : 'text-brand-800') : ''}`}>
                  {({ isActive }) => (<>
                    {l.label}
                    {isActive && <motion.span layoutId="site-nav" className={`absolute left-4 right-4 -bottom-0.5 h-0.5 rounded-full ${transparent ? 'bg-gold-400' : 'bg-brand-600'}`} />}
                  </>)}
                </NavLink>
              ))}
              <Link to="/book" className="btn-gold ml-3">Book Now</Link>
            </nav>
            <button onClick={() => setOpen(!open)} className={`lg:hidden p-2 rounded-xl ${transparent ? 'text-white' : 'text-slate-700'}`}>{open ? <X /> : <Menu />}</button>
          </div>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="lg:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 mt-3">
                <div className="px-5 py-4 flex flex-col gap-1">
                  {links.map((l) => <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `px-3 py-2.5 rounded-xl text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700'}`}>{l.label}</NavLink>)}
                  <Link to="/book" className="btn-gold mt-2">Book Now</Link>
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

        <footer className="bg-brand-950 text-white/80 mt-20">
          <div className="max-w-7xl mx-auto px-5 py-14 grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="font-display text-2xl text-white mb-3">{info.resort_name}</div>
              <p className="text-sm leading-relaxed max-w-md text-white/60">{info.tagline}. Lakeside rooms and villas, a restaurant serving authentic Sri Lankan and international cuisine, and a sunset bar with the island's best arrack cocktails.</p>
              <div className="flex gap-3 mt-5">
                {[Facebook, Instagram].map((I, i) => <a key={i} href="#" className="h-10 w-10 rounded-full bg-white/10 hover:bg-gold-500 hover:text-slate-900 flex items-center justify-center transition"><I size={18} /></a>)}
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Explore</div>
              <ul className="space-y-2 text-sm">
                {links.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-gold-300 transition">{l.label}</Link></li>)}
                <li><Link to="/book" className="hover:text-gold-300 transition">Book a Room</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Contact</div>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2"><MapPin size={16} className="shrink-0 mt-0.5 text-gold-400" />{info.address}</li>
                <li className="flex gap-2"><Phone size={16} className="shrink-0 mt-0.5 text-gold-400" />{info.phone}</li>
                <li className="flex gap-2"><Mail size={16} className="shrink-0 mt-0.5 text-gold-400" />{info.email}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10">
            <div className="max-w-7xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
              <span>© {new Date().getFullYear()} {info.resort_name}. All rights reserved.</span>
              <Link to="/admin" className="inline-flex items-center gap-1.5 hover:text-white/80 transition"><Lock size={12} /> Staff Portal</Link>
            </div>
          </div>
        </footer>
      </div>
    </InfoCtx.Provider>
  );
}
