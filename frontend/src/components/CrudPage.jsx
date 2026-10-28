import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api, qs } from '../lib/api';
import { PageHeader, DataTable, Modal, Confirm, Field, Input, Select, Textarea, SearchBox, useToast, Toggle } from './ui';

/**
 * Generic list + create/edit/delete page.
 * props: title, subtitle, endpoint, columns, fields[{key,label,type,options,required,placeholder,span,hint}], defaults, searchable, filters(node), canDelete, extraActions(row), transform(formValues)->body, rowClick, toolbar, refreshKey
 */
export default function CrudPage({ title, subtitle, endpoint, columns, fields, defaults = {}, searchable = true, query = {}, canDelete = true, canEdit = true, canCreate = true, extraActions, transform, rowClick, toolbar, refreshKey, onLoaded, modalSize = 'md', createLabel = 'Add', headerActions, renderForm, pageSize }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | {} | row
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`${endpoint}${qs({ ...query, q: searchable ? q : undefined })}`).then((r) => { setRows(r); onLoaded?.(r); }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [q, JSON.stringify(query), refreshKey]);

  const openCreate = () => { setForm({ ...defaults }); setEditing({}); };
  const openEdit = (row) => { const f = {}; fields.forEach((fd) => { f[fd.key] = fd.parse ? fd.parse(row[fd.key]) : (row[fd.key] ?? ''); }); setForm(f); setEditing(row); };

  const save = async () => {
    for (const f of fields) if (f.required && (form[f.key] === '' || form[f.key] == null)) return toast.error(`${f.label} is required`);
    setSaving(true);
    try {
      const body = transform ? transform(form, editing) : form;
      if (editing?.id) await api.put(`${endpoint}/${editing.id}`, body); else await api.post(endpoint, body);
      toast.success(editing?.id ? 'Updated' : 'Created');
      setEditing(null); load();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const doDelete = async () => { try { await api.del(`${endpoint}/${del.id}`); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); } };

  const cols = useMemo(() => {
    const c = [...columns];
    if (canEdit || canDelete || extraActions) c.push({
      key: '_actions', label: '', className: 'text-right whitespace-nowrap',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {extraActions?.(r, load)}
          {canEdit && <button className="btn-ghost btn-sm" onClick={() => openEdit(r)} title="Edit"><Pencil size={14} /></button>}
          {canDelete && <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" onClick={() => setDel(r)} title="Delete"><Trash2 size={14} /></button>}
        </div>
      ),
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, canEdit, canDelete, extraActions]);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<>
        {headerActions}
        {canCreate && <button className="btn-primary" onClick={openCreate}><Plus size={16} />{createLabel}</button>}
      </>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {searchable && <SearchBox value={q} onChange={setQ} className="w-72" />}
        {toolbar}
      </div>
      <DataTable columns={cols} rows={rows} loading={loading} onRowClick={rowClick} pageSize={pageSize} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`} size={modalSize}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={save}>{saving && <Loader2 size={16} className="animate-spin" />}Save</button></>}>
        {renderForm ? renderForm(form, setForm, editing) : <FormFields fields={fields} form={form} setForm={setForm} />}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} title="Delete record" message={`Delete "${del?.name || del?.description || del?.code || del?.number || 'this record'}"? This cannot be undone.`} confirmText="Delete" />
    </div>
  );
}

export function FormFields({ fields, form, setForm }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((f) => {
        if (f.hidden) return null;
        const span = f.span === 2 ? 'sm:col-span-2' : '';
        const common = { value: form[f.key] ?? '', placeholder: f.placeholder };
        let ctrl;
        if (f.type === 'select') ctrl = <Select {...common} onChange={(e) => set(f.key, e.target.value)} options={f.options || []} placeholder={f.placeholder || 'Select...'} />;
        else if (f.type === 'textarea') ctrl = <Textarea {...common} onChange={(e) => set(f.key, e.target.value)} />;
        else if (f.type === 'toggle') ctrl = <div className="pt-2"><Toggle checked={!!Number(form[f.key])} onChange={(v) => set(f.key, v ? 1 : 0)} label={f.toggleLabel} /></div>;
        else if (f.type === 'number') ctrl = <Input type="number" step={f.step || 'any'} min={f.min} {...common} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />;
        else ctrl = <Input type={f.type || 'text'} {...common} onChange={(e) => set(f.key, e.target.value)} />;
        return <Field key={f.key} label={f.label + (f.required ? ' *' : '')} hint={f.hint} className={span}>{ctrl}</Field>;
      })}
    </div>
  );
}
