import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Field, Input, useToast } from '../components/ui';

const DEMO = [['admin@janapriya.lk', 'admin123', 'Admin'], ['manager@janapriya.lk', 'manager123', 'Manager'], ['frontdesk@janapriya.lk', 'frontdesk123', 'Front desk'], ['restaurant@janapriya.lk', 'restaurant123', 'Restaurant'], ['bar@janapriya.lk', 'bar123', 'Bar'], ['hr@janapriya.lk', 'hr123', 'HR'], ['accounts@janapriya.lk', 'accounts123', 'Accounts'], ['housekeeping@janapriya.lk', 'housekeeping123', 'Housekeeping']];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(f.email, f.password); nav(loc.state?.from || '/admin', { replace: true }); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden">
        <motion.img initial={{ scale: 1.1 }} animate={{ scale: 1 }} transition={{ duration: 2 }} src="https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1600&q=80" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 to-brand-800/60" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"><ArrowLeft size={16} /> Back to website</Link>
          <div>
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-6"><span className="font-display text-gold-300 text-3xl font-bold">J</span></div>
            <h1 className="font-display text-5xl leading-tight">Janapriya Resort<br />Management System</h1>
            <p className="text-white/70 mt-4 max-w-md">Rooms, restaurant, bar, stock, staff and finance - all in one place.</p>
          </div>
          <div className="text-xs text-white/40">© {new Date().getFullYear()} Janapriya Resort</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 bg-slate-50">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center"><span className="font-display text-3xl text-brand-900">Janapriya Resort</span><div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-1">Staff Portal</div></div>
          <div className="card p-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Use your staff credentials to continue.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Email"><Input type="email" autoFocus value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@janapriya.lk" /></Field>
              <Field label="Password"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" /></Field>
              <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Sign in</button>
            </form>
          </div>
          <div className="mt-5 card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Demo accounts (click to fill)</div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map(([e, p, l]) => <button key={e} type="button" onClick={() => setF({ email: e, password: p })} className="chip bg-slate-100 text-slate-700 hover:bg-brand-100 hover:text-brand-800 transition">{l}</button>)}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
