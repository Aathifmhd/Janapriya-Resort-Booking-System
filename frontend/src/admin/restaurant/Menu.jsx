import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { Modal, Field, Input, Select, useToast, Badge } from '../../components/ui';

export default function Menu() {
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [inv, setInv] = useState([]);
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [key, setKey] = useState(0);
  const loadCats = () => api.get('/api/menu/categories').then(setCats);
  useEffect(() => { loadCats(); api.get('/api/inventory').then(setInv); }, []);
  const saveCat = async () => { try { if (editCat.id) await api.put(`/api/menu/categories/${editCat.id}`, editCat); else await api.post('/api/menu/categories', editCat); setEditCat(null); loadCats(); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };
  const delCat = async (c) => { if (!confirm(`Delete category "${c.name}"? Items will become uncategorised.`)) return; try { await api.del(`/api/menu/categories/${c.id}`); loadCats(); setKey((k) => k + 1); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <CrudPage
        title="Menu" subtitle="Food, beverages, spirits and cocktails. Link items to stock so sales deduct inventory automatically." refreshKey={key}
        endpoint="/api/menu/items" modalSize="lg"
        headerActions={<button className="btn-secondary" onClick={() => setCatModal(true)}>Manage categories</button>}
        columns={[
          { key: 'name', label: 'Item', render: (r) => <div><div className="font-medium flex items-center gap-2">{r.name}{!r.active && <span className="chip bg-slate-100 text-slate-500">hidden</span>}</div><div className="text-xs text-slate-400 line-clamp-1 max-w-xs">{r.description}</div></div> },
          { key: 'category_name', label: 'Category', render: (r) => <span className="chip bg-slate-100 text-slate-700">{r.category_name || '-'}</span> },
          { key: 'price', label: 'Price', render: (r) => <span className="font-semibold">{money(r.price, { decimals: 0 })}</span> },
          { key: 'cost', label: 'Cost / Margin', render: (r) => <span className="text-slate-500">{money(r.cost, { decimals: 0 })} <span className="text-xs">({r.price ? Math.round(((r.price - r.cost) / r.price) * 100) : 0}%)</span></span> },
          { key: 'inventory_name', label: 'Stock link', render: (r) => r.inventory_name ? <div className="text-xs"><div>{r.inventory_name}</div><div className="text-slate-400">{r.portion_qty} {r.stock_unit} per serving · {Number(r.stock_qty).toFixed(1)} left</div></div> : <span className="text-slate-300 text-xs">none</span> },
          { key: 'tags', label: 'Tags', render: (r) => <div className="flex gap-1 flex-wrap">{(r.tags || '').split(',').filter(Boolean).map((t) => <span key={t} className="chip bg-brand-50 text-brand-800">{t}</span>)}</div> },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'category_id', label: 'Category', type: 'select', required: true, options: cats.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'price', label: 'Selling price', type: 'number', required: true },
          { key: 'cost', label: 'Cost (for margin)', type: 'number' },
          { key: 'description', label: 'Description', type: 'textarea', span: 2 },
          { key: 'inventory_item_id', label: 'Deduct from stock item', type: 'select', options: inv.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` })), placeholder: 'No stock link' },
          { key: 'portion_qty', label: 'Stock qty per serving', type: 'number', hint: 'e.g. 1 for a bottle, 0.08 for a 60ml shot from a 750ml bottle' },
          { key: 'tags', label: 'Tags (comma separated)', hint: 'popular, spicy, veg, chef, signature, premium' },
          { key: 'image_url', label: 'Image URL' },
          { key: 'active', label: 'Available', type: 'toggle', toggleLabel: 'Show on menu & POS' },
        ]}
        defaults={{ active: 1, portion_qty: 1, cost: 0 }}
        transform={(f) => ({ ...f, category_id: f.category_id || null, inventory_item_id: f.inventory_item_id || null })}
      />
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Menu categories" size="sm">
        <div className="space-y-2">
          {cats.map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"><div><span className="font-medium">{c.name}</span> <Badge status={c.type} className="ml-2" /></div><div className="flex gap-1"><button className="btn-ghost btn-sm" onClick={() => setEditCat({ ...c })}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-rose-600" onClick={() => delCat(c)}><Trash2 size={14} /></button></div></div>)}
          <button className="btn-primary w-full" onClick={() => setEditCat({ name: '', type: 'food', sort: cats.length + 1 })}><Plus size={16} /> Add category</button>
        </div>
      </Modal>
      <Modal open={!!editCat} onClose={() => setEditCat(null)} title={editCat?.id ? 'Edit category' : 'New category'} size="sm" footer={<><button className="btn-secondary" onClick={() => setEditCat(null)}>Cancel</button><button className="btn-primary" onClick={saveCat}>Save</button></>}>
        {editCat && <div className="space-y-3">
          <Field label="Name"><Input value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} /></Field>
          <Field label="Type"><Select value={editCat.type} onChange={(e) => setEditCat({ ...editCat, type: e.target.value })} options={['food', 'beverage', 'liquor']} /></Field>
          <Field label="Sort order"><Input type="number" value={editCat.sort} onChange={(e) => setEditCat({ ...editCat, sort: Number(e.target.value) })} /></Field>
        </div>}
      </Modal>
    </>
  );
}
