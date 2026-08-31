import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const empty = { nombre: '', cliente_id: '', direccion: '', modelo: 'directa' }

export default function Puntos() {
  const [rows, setRows] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('puntos_distribucion').select('*, clientes(nombre)').order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows(p || [])
    setClientes(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setForm(empty); setErr(''); setModal(true) }
  function openEdit(p) { setForm({ ...p, cliente_id: p.cliente_id || '' }); setErr(''); setModal(true) }

  async function save() {
    if (!form.nombre) { setErr('El nombre es requerido.'); return }
    setSaving(true)
    const payload = { ...form, cliente_id: form.cliente_id || null }
    const { error } = form.id
      ? await supabase.from('puntos_distribucion').update(payload).eq('id', form.id)
      : await supabase.from('puntos_distribucion').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModal(false)
    load()
  }

  async function toggle(p) {
    await supabase.from('puntos_distribucion').update({ activo: !p.activo }).eq('id', p.id)
    load()
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Puntos de Distribución</h2>
        <button className="btn btn-amber" onClick={openNew}>+ Nuevo punto</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cliente</th>
                <th>Modelo</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="empty">Sin puntos de distribución</td></tr>}
              {rows.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.clientes?.nombre || '—'}</td>
                  <td>
                    {p.modelo === 'directa'
                      ? <span className="badge b-info">Venta directa</span>
                      : <span className="badge b-amber">Consignación</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--txt2)' }}>{p.direccion || '—'}</td>
                  <td>{p.activo ? <span className="badge b-ok">Activo</span> : <span className="badge b-neu">Inactivo</span>}</td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
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
              <span className="modal-title">{form.id ? 'Editar punto' : 'Nuevo punto de distribución'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Tienda La Vaquita" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <select className="form-select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                    <option value="">— Sin cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo de venta</label>
                  <select className="form-select" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}>
                    <option value="directa">Venta directa</option>
                    <option value="consignacion">Consignación</option>
                  </select>
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
