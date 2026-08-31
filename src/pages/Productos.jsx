import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
}

const empty = { sku: '', nombre: '', descripcion: '', unidad: 'kg', precio_base: '', costo: '' }

export default function Productos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm(empty); setErr(''); setModal(true) }
  function openEdit(p) { setForm({ ...p }); setErr(''); setModal(true) }

  async function save() {
    if (!form.sku || !form.nombre || !form.precio_base) { setErr('SKU, nombre y precio son requeridos.'); return }
    setSaving(true)
    const payload = { ...form, precio_base: Number(form.precio_base), costo: Number(form.costo || 0) }
    const { error } = form.id
      ? await supabase.from('productos').update(payload).eq('id', form.id)
      : await supabase.from('productos').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModal(false)
    load()
  }

  async function toggle(p) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    load()
  }

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}" permanentemente? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('productos').delete().eq('id', p.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    load()
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Productos</h2>
        <button className="btn btn-amber" onClick={openNew}>+ Nuevo producto</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Unidad</th>
                <th className="txt-right">Precio</th>
                <th className="txt-right">Costo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="empty">Sin productos</td></tr>}
              {rows.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.sku}</td>
                  <td><strong>{p.nombre}</strong>{p.descripcion && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{p.descripcion}</div>}</td>
                  <td>{p.unidad}</td>
                  <td className="txt-right mono">{fmt(p.precio_base)}</td>
                  <td className="txt-right mono">{fmt(p.costo)}</td>
                  <td>
                    {p.activo
                      ? <span className="badge b-ok">Activo</span>
                      : <span className="badge b-neu">Inactivo</span>}
                  </td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(p)}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="btn btn-red btn-sm" onClick={() => eliminar(p)}>Eliminar</button>
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
              <span className="modal-title">{form.id ? 'Editar producto' : 'Nuevo producto'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="QCH-1KG" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select className="form-select" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}>
                    <option>kg</option><option>pieza</option><option>litro</option><option>gramo</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Queso Chihuahua 1 kg" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" value={form.descripcion || ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Precio de venta *</label>
                  <input type="number" className="form-input" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Costo</label>
                  <input type="number" className="form-input" value={form.costo || ''} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{err}</div>}
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
