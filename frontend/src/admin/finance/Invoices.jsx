import { useEffect, useState, useCallback } from 'react';
import { Printer, Banknote } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { money, fmtDate, fmtDateTime, title } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { PageHeader, DataTable, Badge, Tabs, SearchBox, Modal, Field, Input, Select, useToast } from '../../components/ui';

export default function Invoices() {
  const toast = useToast();
  const { settings } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [inv, setInv] = useState(null);
  const [pay, setPay] = useState(null);
  const load = useCallback(() => { setLoading(true); api.get(`/api/invoices${qs({ type, status, q })}`).then(setRows).finally(() => setLoading(false)); }, [type, status, q]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  const open = (r) => api.get(`/api/invoices/${r.id}`).then(setInv);
  const doPay = async () => { try { await api.post(`/api/invoices/${pay.id}/pay`, pay); toast.success('Payment recorded'); setPay(null); load(); if (inv) open(inv); } catch (e) { toast.error(e.message); } };

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Room folios and restaurant / bar bills" />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs tabs={[{ value: '', label: 'All' }, { value: 'room', label: 'Rooms' }, { value: 'restaurant', label: 'Restaurant' }, { value: 'bar', label: 'Bar' }]} value={type} onChange={setType} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Any status" options={['paid', 'partial', 'unpaid']} className="w-40" />
        <SearchBox value={q} onChange={setQ} placeholder="Invoice no or guest" className="w-64" />
      </div>
      <DataTable loading={loading} rows={rows} onRowClick={open} columns={[
        { key: 'number', label: 'Invoice', render: (r) => <span className="font-mono font-semibold text-brand-800">{r.number}</span> },
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'type', label: 'Type', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.type)}</span> },
        { key: 'guest_name', label: 'Guest' },
        { key: 'subtotal', label: 'Subtotal', className: 'text-right', render: (r) => money(r.subtotal, { decimals: 0 }) },
        { key: 'tax', label: 'Tax + SC', className: 'text-right', render: (r) => money(r.tax + r.service_charge, { decimals: 0 }) },
        { key: 'total', label: 'Total', className: 'text-right', render: (r) => <span className="font-semibold">{money(r.total, { decimals: 0 })}</span> },
        { key: 'balance', label: 'Balance', className: 'text-right', render: (r) => <span className={r.total - r.paid > 0.5 ? 'text-rose-600 font-semibold' : 'text-slate-400'}>{money(r.total - r.paid, { decimals: 0 })}</span> },
        { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
      ]} />

      <Modal open={!!inv} onClose={() => setInv(null)} title={inv?.number} size="md" footer={<>
        {inv && inv.total - inv.paid > 0.5 && <button className="btn-primary" onClick={() => setPay({ id: inv.id, amount: (inv.total - inv.paid).toFixed(2), method: 'cash', reference: '' })}><Banknote size={16} /> Record payment</button>}
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </>}>
        {inv && <div className="text-sm">
          <div className="flex justify-between items-start mb-4">
            <div><div className="font-display text-2xl text-brand-900">{settings?.resort_name}</div><div className="text-xs text-slate-500 whitespace-pre-line">{settings?.address}<br />{settings?.phone} · {settings?.email}</div></div>
            <div className="text-right"><div className="font-mono font-bold">{inv.number}</div><div className="text-xs text-slate-500">{fmtDate(inv.date)}</div><Badge status={inv.status} className="mt-1" /></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 mb-4"><div className="text-[10px] uppercase text-slate-400 font-semibold">Bill to</div><div className="font-medium">{inv.guest_name}</div>{inv.booking && <div className="text-xs text-slate-500">Room {inv.booking.room_number} · {inv.booking.room_type_name} · {fmtDate(inv.booking.check_in)} - {fmtDate(inv.booking.check_out)}</div>}{inv.order && <div className="text-xs text-slate-500">{inv.order.code} · {inv.order.table_name ? `Table ${inv.order.table_name}` : title(inv.order.type)}</div>}</div>
          <table className="w-full"><thead><tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200"><th className="text-left py-1">Description</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Amount</th></tr></thead><tbody>
            {inv.items.map((it, i) => <tr key={i} className="border-b border-slate-100"><td className="py-1.5">{it.description || it.name}</td><td className="py-1.5 text-right">{it.qty || 1}</td><td className="py-1.5 text-right">{money(it.amount ?? it.qty * it.price)}</td></tr>)}
          </tbody></table>
          <div className="mt-3 ml-auto w-64 space-y-1">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(inv.subtotal)}</span></div>
            {inv.discount > 0 && <div className="flex justify-between text-slate-600"><span>Discount</span><span>- {money(inv.discount)}</span></div>}
            {inv.service_charge > 0 && <div className="flex justify-between text-slate-600"><span>Service charge</span><span>{money(inv.service_charge)}</span></div>}
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>{money(inv.tax)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-slate-800 pt-1"><span>Total</span><span>{money(inv.total)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{money(inv.paid)}</span></div>
            {inv.total - inv.paid > 0.5 && <div className="flex justify-between text-rose-600 font-semibold"><span>Balance due</span><span>{money(inv.total - inv.paid)}</span></div>}
          </div>
          {inv.payments.length > 0 && <div className="mt-4 text-xs text-slate-500">{inv.payments.map((p) => <div key={p.id}>{fmtDateTime(p.created_at)} · {title(p.method)} · {money(p.amount)}{p.reference ? ` · ${p.reference}` : ''}</div>)}</div>}
          <div className="mt-5 text-center text-[11px] text-slate-400">Thank you for staying with us</div>
        </div>}
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title="Record payment" size="sm" footer={<><button className="btn-secondary" onClick={() => setPay(null)}>Cancel</button><button className="btn-primary" onClick={doPay}>Save</button></>}>
        {pay && <div className="space-y-3"><Field label="Amount"><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field><Field label="Method"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} options={['cash', 'card', 'bank', 'online']} /></Field><Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field></div>}
      </Modal>
    </div>
  );
}
