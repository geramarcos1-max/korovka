import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const empty = { nombre: '', contacto: '', telefono: '', email: '', rfc: '', direccion: '' }

export default function Clientes() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm(empty); setErr(''); setModal(true) }
  function openEdit(c) { setForm({ ...c }); setErr(''); setModal(true) }

  async function save() {
    if (!form.nombre) { setErr('El nombre es requerido.'); return }
    setSaving(true)
    const { error } = form.id
      ? await supabase.from('clientes').update(form).eq('id', form.id)
      : await supabase.from('clientes').insert(form)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModal(false)
    load()
  }

  async function toggle(c) {
    await supabase.from('clientes').update({ activo: !c.activo }).eq('id', c.id)
    load()
  }

  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar "${c.nombre}" permanentemente? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    load()
  }

  const filtered = rows.filter(r =>
    r.nombre.toLowerCase().includes(q.toLowerCase()) ||
    (r.contacto || '').toLowerCase().includes(q.toLowerCase())
  )

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Clientes</h2>
        <button className="btn btn-amber" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <input
            className="form-input"
            style={{ maxWidth: 280 }}
            placeholder="Buscar cliente…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>RFC</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="empty">Sin clientes</td></tr>}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong>{c.direccion && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{c.direccion}</div>}</td>
                  <td>{c.contacto || '—'}</td>
                  <td>{c.telefono || '—'}</td>
                  <td className="mono">{c.rfc || '—'}</td>
                  <td>{c.activo ? <span className="badge b-ok">Activo</span> : <span className="badge b-neu">Inactivo</span>}</td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                      <button className="btn btn-red btn-sm" onClick={() => eliminar(c)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre / Razón social *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contacto</label>
                  <input className="form-input" value={form.contacto || ''} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.telefono || ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">RFC</label>
                  <input className="form-input" value={form.rfc || ''} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="form-input" value={form.direccion || ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
