import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, CalendarDays, CalendarRange, BedDouble, Layers, Users, Sparkles, UtensilsCrossed, ClipboardList, ChefHat, BookOpen, CalendarCheck, Package, ShoppingCart, Truck, ArrowLeftRight, Wine, UserCircle, Clock, Plane, Wallet, FileText, CreditCard, Receipt, BarChart3, Settings, ShieldCheck, History, LogOut, Menu, X, Globe, ChevronDown, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Modal, Field, Input, useToast } from '../components/ui';

const NAV = [
  { title: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { title: 'Front Desk', module: 'frontdesk', items: [
    { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
    { to: '/admin/calendar', label: 'Room Calendar', icon: CalendarRange },
    { to: '/admin/rooms', label: 'Rooms', icon: BedDouble },
    { to: '/admin/room-types', label: 'Room Types', icon: Layers },
    { to: '/admin/guests', label: 'Guests', icon: Users },
    { to: '/admin/housekeeping', label: 'Housekeeping', icon: Sparkles },
  ] },
  { title: 'Restaurant & Bar', module: 'restaurant', items: [
    { to: '/admin/tables', label: 'Tables & POS', icon: UtensilsCrossed },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/kitchen', label: 'Kitchen Display', icon: ChefHat },
    { to: '/admin/menu', label: 'Menu', icon: BookOpen },
    { to: '/admin/reservations', label: 'Table Reservations', icon: CalendarCheck },
  ] },
  { title: 'Inventory', module: 'inventory', items: [
    { to: '/admin/inventory', label: 'Stock Items', icon: Package },
    { to: '/admin/purchases', label: 'Purchases', icon: ShoppingCart },
    { to: '/admin/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/admin/movements', label: 'Stock Movements', icon: ArrowLeftRight },
    { to: '/admin/empty-bottles', label: 'Empty Bottles', icon: Wine },
  ] },
  { title: 'Human Resources', module: 'hr', items: [
    { to: '/admin/employees', label: 'Employees', icon: UserCircle },
    { to: '/admin/attendance', label: 'Attendance', icon: Clock },
    { to: '/admin/leaves', label: 'Leave Requests', icon: Plane },
    { to: '/admin/payroll', label: 'Payroll', icon: Wallet },
  ] },
  { title: 'Finance', module: 'finance', items: [
    { to: '/admin/invoices', label: 'Invoices', icon: FileText },
    { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
    { to: '/admin/reports', label: 'Reports & P&L', icon: BarChart3 },
  ] },
  { title: 'System', module: 'settings', items: [
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/admin/users', label: 'Users & Roles', icon: ShieldCheck },
    { to: '/admin/audit', label: 'Audit Log', icon: History },
  ] },
];

export default function AdminLayout() {
  const { user, logout, can, settings } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  const groups = NAV.filter((g) => !g.module || can(g.module));

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/5">
        <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30"><span className="font-display text-gold-300 text-xl font-bold">J</span></div>
        <div className="leading-tight"><div className="font-display text-white text-lg">{settings?.resort_name || 'Janapriya'}</div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Staff Portal</div></div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{g.title}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <it.icon size={17} /> {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-white/5">
        <Link to="/" className="nav-link"><Globe size={17} /> View website</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:block w-64 shrink-0 bg-slate-900 fixed inset-y-0 left-0 no-print">{Sidebar}</aside>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="absolute inset-y-0 left-0 w-72 bg-slate-900">{Sidebar}</motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:pl-64 min-w-0">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 no-print">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 rounded-xl hover:bg-slate-100" onClick={() => setOpen(true)}><Menu size={20} /></button>
              <div className="text-sm text-slate-500 hidden sm:block">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <UserMenu user={user} onLogout={() => { logout(); nav('/admin/login'); }} onPassword={() => setPw(true)} />
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
      <PasswordModal open={pw} onClose={() => setPw(false)} />
    </div>
  );
}

function UserMenu({ user, onLogout, onPassword }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100 transition">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white flex items-center justify-center font-bold text-sm">{user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
        <div className="text-left hidden sm:block leading-tight"><div className="text-sm font-semibold text-slate-800">{user.name}</div><div className="text-[11px] text-slate-500 capitalize">{user.role}</div></div>
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      <AnimatePresence>
        {open && (<>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-52 card p-1.5 z-20 shadow-xl">
            <button onClick={() => { setOpen(false); onPassword(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 text-slate-700"><KeyRound size={15} /> Change password</button>
            <button onClick={onLogout} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-rose-50 text-rose-600"><LogOut size={15} /> Sign out</button>
          </motion.div>
        </>)}
      </AnimatePresence>
    </div>
  );
}

function PasswordModal({ open, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const save = async () => {
    if (f.next !== f.confirm) return toast.error('Passwords do not match');
    try { await api.post('/api/auth/change-password', f); toast.success('Password changed'); onClose(); setF({ current: '', next: '', confirm: '' }); } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Update</button></>}>
      <div className="space-y-3">
        <Field label="Current password"><Input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="New password"><Input type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Confirm new password"><Input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
