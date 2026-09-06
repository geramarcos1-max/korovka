import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MOTIVOS = [
  { value: 'marketing',      label: 'Marketing' },
  { value: 'operacion',      label: 'Operación' },
  { value: 'logistica',      label: 'Logística' },
  { value: 'administrativo', label: 'Administrativo' },
]

const MOTIVO_STYLE = {
  marketing:      { bg: '#fce7f3', color: '#be185d' },
  operacion:      { bg: 'var(--ok-s)',    color: 'var(--ok-t)' },
  logistica:      { bg: 'var(--info-s)',  color: 'var(--info-t)' },
  administrativo: { bg: 'var(--amber-s)', color: 'var(--amber-t)' },
}

const PAGO_STYLE = {
  efectivo:      { bg: 'var(--ok-s)',    color: 'var(--ok-t)' },
  transferencia: { bg: 'var(--info-s)',  color: 'var(--info-t)' },
  tarjeta:       { bg: '#f3e8ff',        color: '#7c3aed' },
}

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MotivoBadge({ m }) {
  const s = MOTIVO_STYLE[m] || { bg: 'var(--bg2)', color: 'var(--txt2)' }
  const label = MOTIVOS.find(x => x.value === m)?.label || m
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>
}

function PagoBadge({ p }) {
  if (!p) return <span style={{ color: 'var(--txt3)' }}>—</span>
  const s = PAGO_STYLE[p] || { bg: 'var(--bg2)', color: 'var(--txt2)' }
  const label = p === 'efectivo' ? 'Efectivo' : p === 'transferencia' ? 'Transferencia' : 'Tarjeta'
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>
}

function SortTh({ col, label, sort, onSort, className }) {
  const active = sort.col === col
  return (
    <th className={className} onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>{active && sort.dir === 'desc' ? '▼' : '▲'}</span>
    </th>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}`, flex: 1, minWidth: 0 }}>
      <div className="card-title">{label}</div>
      <div className="kpi-val" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

const emptyForm = {
  fecha: new Date().toISOString().slice(0, 10),
  motivo: 'operacion',
  monto: '',
  notas: '',
  responsable: 'gera',
  forma_pago: 'efectivo',
}

export default function Gastos() {
  const { profile } = useAuth()
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [err, setErr] = useState('')
  const [errEdit, setErrEdit] = useState('')
  const [saving, setSaving] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [sort, setSort] = useState({ col: 'fecha', dir: 'desc' })

  function handleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  async function load() {
    const { data } = await supabase.from('gastos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const gastosFiltrados = (() => {
    let rows = [...gastos]
    if (busqueda) { const q = busqueda.toLowerCase(); rows = rows.filter(g => (g.notas || '').toLowerCase().includes(q)) }
    if (filtroMotivo)      rows = rows.filter(g => g.motivo === filtroMotivo)
    if (filtroResponsable) rows = rows.filter(g => g.responsable === filtroResponsable)
    rows.sort((a, b) => {
      let va, vb
      switch (sort.col) {
        case 'fecha':  va = a.fecha;  vb = b.fecha;  break
        case 'monto':  va = Number(a.monto);  vb = Number(b.monto);  break
        case 'motivo': va = a.motivo; vb = b.motivo; break
        default:       va = a.fecha;  vb = b.fecha
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1  : -1
      return 0
    })
    return rows
  })()

  // Indicadores
  const totalGeneral   = gastos.reduce((a, g) => a + Number(g.monto || 0), 0)
  const totalGera      = gastos.filter(g => g.responsable === 'gera').reduce((a, g) => a + Number(g.monto || 0), 0)
  const totalFer       = gastos.filter(g => g.responsable === 'fer').reduce((a, g) => a + Number(g.monto || 0), 0)
  const totalFiltrado  = gastosFiltrados.reduce((a, g) => a + Number(g.monto || 0), 0)
  const mesCurrent     = new Date().toISOString().slice(0, 7)
  const totalMes       = gastos.filter(g => g.fecha?.slice(0, 7) === mesCurrent).reduce((a, g) => a + Number(g.monto || 0), 0)

  async function save() {
    if (!form.monto || isNaN(Number(form.monto)) || Number(form.monto) <= 0) { setErr('Ingresa un monto válido.'); return }
    setSaving(true)
    const { error } = await supabase.from('gastos').insert({
      fecha: form.fecha, motivo: form.motivo, monto: Number(form.monto),
      notas: form.notas || null, responsable: form.responsable, forma_pago: form.forma_pago,
      creado_por: profile?.id,
    })
    if (error) { setSaving(false); setErr(error.message); return }
    setSaving(false); setModal(false); setForm(emptyForm); load()
  }

  function openEdit(g) {
    setEditando(g)
    setEditForm({ fecha: g.fecha, motivo: g.motivo, monto: g.monto, notas: g.notas || '', responsable: g.responsable || 'gera', forma_pago: g.forma_pago || 'efectivo' })
    setErrEdit(''); setEditModal(true)
  }

  async function saveEdit() {
    if (!editForm.monto || isNaN(Number(editForm.monto)) || Number(editForm.monto) <= 0) { setErrEdit('Ingresa un monto válido.'); return }
    setSaving(true)
    const { error } = await supabase.from('gastos').update({
      fecha: editForm.fecha, motivo: editForm.motivo, monto: Number(editForm.monto),
      notas: editForm.notas || null, responsable: editForm.responsable, forma_pago: editForm.forma_pago,
    }).eq('id', editando.id)
    if (error) { setSaving(false); setErrEdit(error.message); return }
    setSaving(false); setEditModal(false); load()
  }

  async function eliminar(g) {
    if (!window.confirm(`¿Eliminar este gasto de ${fmt(g.monto)}?\n\nEsta acción no se puede deshacer.`)) return
    await supabase.from('gastos').delete().eq('id', g.id)
    load()
  }

  if (loading) return <div className="empty">Cargando…</div>

  const mesLabel = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-hdr">
        <h2>Gastos</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Nuevo gasto</button>
      </div>

      {/* Indicadores */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total acumulado"   value={fmt(totalGeneral)} sub="histórico"        color="var(--forest)" />
        <StatCard label={`Gastos — ${mesLabel}`} value={fmt(totalMes)} sub="mes actual"     color="#2563eb" />
        <StatCard label="Gera"              value={fmt(totalGera)}    sub="total acumulado"  color="var(--amber)" />
        <StatCard label="Fer"               value={fmt(totalFer)}     sub="total acumulado"  color="#be185d" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 200 }} placeholder="Buscar en notas…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 170 }} value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)}>
          <option value="">Todos los motivos</option>
          {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 150 }} value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)}>
          <option value="">Todos</option>
          <option value="gera">Gera</option>
          <option value="fer">Fer</option>
        </select>
        {(busqueda || filtroMotivo || filtroResponsable) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusqueda(''); setFiltroMotivo(''); setFiltroResponsable('') }}>Limpiar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)' }}>
          {gastosFiltrados.length} {gastosFiltrados.length === 1 ? 'gasto' : 'gastos'} · Total: <strong style={{ color: 'var(--txt)' }}>{fmt(totalFiltrado)}</strong>
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh col="fecha"  label="Fecha"      sort={sort} onSort={handleSort} />
                <SortTh col="motivo" label="Motivo"     sort={sort} onSort={handleSort} />
                <th>Forma de pago</th>
                <th>Responsable</th>
                <th>Notas</th>
                <SortTh col="monto"  label="Monto"      sort={sort} onSort={handleSort} className="txt-right" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.length === 0 && <tr><td colSpan={7} className="empty">Sin gastos registrados</td></tr>}
              {gastosFiltrados.map(g => (
                <tr key={g.id}>
                  <td>{g.fecha}</td>
                  <td><MotivoBadge m={g.motivo} /></td>
                  <td><PagoBadge p={g.forma_pago} /></td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 13, color: g.responsable === 'fer' ? '#be185d' : 'var(--forest)' }}>
                      {g.responsable === 'fer' ? 'Fer' : 'Gera'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--txt2)', maxWidth: 260 }}>{g.notas || <span style={{ color: 'var(--txt3)' }}>—</span>}</td>
                  <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(g.monto)}</td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>Editar</button>
                      <button className="btn btn-red btn-sm"   onClick={() => eliminar(g)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {gastosFiltrados.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt2)', paddingTop: 10 }}>Total</td>
                  <td className="txt-right mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--forest)', paddingTop: 10 }}>{fmt(totalFiltrado)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal nuevo */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <span className="modal-title">Nuevo gasto</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto *</label>
                  <input type="number" className="form-input" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Motivo *</label>
                <select className="form-select" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}>
                  {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Responsable *</label>
                  <select className="form-select" value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}>
                    <option value="gera">Gera</option>
                    <option value="fer">Fer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Forma de pago *</label>
                  <select className="form-select" value={form.forma_pago} onChange={e => setForm(f => ({ ...f, forma_pago: e.target.value }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={3} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Descripción, proveedor, referencia…" style={{ resize: 'vertical' }} />
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Registrar gasto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editModal && editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <span className="modal-title">Editar gasto</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={editForm.fecha} onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto *</label>
                  <input type="number" className="form-input" value={editForm.monto} onChange={e => setEditForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Motivo *</label>
                <select className="form-select" value={editForm.motivo} onChange={e => setEditForm(f => ({ ...f, motivo: e.target.value }))}>
                  {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Responsable *</label>
                  <select className="form-select" value={editForm.responsable} onChange={e => setEditForm(f => ({ ...f, responsable: e.target.value }))}>
                    <option value="gera">Gera</option>
                    <option value="fer">Fer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Forma de pago *</label>
                  <select className="form-select" value={editForm.forma_pago} onChange={e => setEditForm(f => ({ ...f, forma_pago: e.target.value }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={3} value={editForm.notas} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} placeholder="Descripción, proveedor, referencia…" style={{ resize: 'vertical' }} />
              </div>
              {errEdit && <div style={{ color: 'var(--red)', fontSize: 13 }}>{errEdit}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
