import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const TIPOS = [
  { value: 'materia_prima', label: 'Materia prima', color: '#2B6B50', bg: 'var(--ok-s)' },
  { value: 'empaque',       label: 'Empaque',        color: '#2D6A9F', bg: 'var(--info-s)' },
  { value: 'logistica',     label: 'Logística',      color: '#A0692A', bg: 'var(--amber-s)' },
  { value: 'otro',          label: 'Otro',           color: '#9E9080', bg: 'var(--cream-d)' },
]
const UNIDADES = ['kg', 'pieza', 'envio', 'caja', 'rollo', 'litro', 'otro']

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function tipoMeta(value) {
  return TIPOS.find(t => t.value === value) || TIPOS[3]
}

function TabBtn({ id, active, onClick, children }) {
  return (
    <button onClick={() => onClick(id)} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
      fontSize: 13.5, fontWeight: active ? 600 : 400,
      color: active ? 'var(--forest)' : 'var(--txt3)',
      borderBottom: active ? '2px solid var(--forest)' : '2px solid transparent',
      marginBottom: -1, transition: 'color .1s', fontFamily: 'inherit',
    }}>{children}</button>
  )
}

const emptyInsumo = { nombre: '', tipo: 'materia_prima', costo_unitario: '', unidad: 'kg', notas: '' }
const emptyLote   = { fecha: new Date().toISOString().slice(0, 10), descripcion: '', piezas: '', notas: '' }

export default function Costos() {
  const [tab, setTab] = useState('lotes')
  const [insumos, setInsumos] = useState([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)

  // Insumo modal
  const [insumoModal, setInsumoModal] = useState(false)
  const [insumoForm, setInsumoForm] = useState(emptyInsumo)
  const [editInsumo, setEditInsumo] = useState(null)
  const [insumoErr, setInsumoErr] = useState('')
  const [insumoSaving, setInsumoSaving] = useState(false)

  // Lote modal
  const [loteModal, setLoteModal] = useState(false)
  const [loteForm, setLoteForm] = useState(emptyLote)
  const [loteItems, setLoteItems] = useState([{ insumo_id: '', cantidad: '', costo_unitario: '' }])
  const [editLote, setEditLote] = useState(null)
  const [loteErr, setLoteErr] = useState('')
  const [loteSaving, setLoteSaving] = useState(false)

  // Lote detalle
  const [detalleModal, setDetalleModal] = useState(null) // lote con items

  async function load() {
    const [{ data: ins }, { data: lot }] = await Promise.all([
      supabase.from('costos_insumos').select('*').order('tipo').order('nombre'),
      supabase.from('costos_lotes').select('*, costos_lote_items(*, costos_insumos(nombre, unidad))').order('fecha', { ascending: false }),
    ])
    setInsumos(ins || [])
    setLotes(lot || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Insumos ──
  function openNewInsumo() {
    setInsumoForm(emptyInsumo)
    setEditInsumo(null)
    setInsumoErr('')
    setInsumoModal(true)
  }
  function openEditInsumo(ins) {
    setInsumoForm({ nombre: ins.nombre, tipo: ins.tipo, costo_unitario: ins.costo_unitario, unidad: ins.unidad, notas: ins.notas || '' })
    setEditInsumo(ins.id)
    setInsumoErr('')
    setInsumoModal(true)
  }
  async function saveInsumo() {
    if (!insumoForm.nombre.trim()) { setInsumoErr('El nombre es requerido.'); return }
    if (insumoForm.costo_unitario === '' || isNaN(Number(insumoForm.costo_unitario))) { setInsumoErr('Ingresa un costo válido.'); return }
    setInsumoSaving(true)
    const payload = {
      nombre: insumoForm.nombre.trim(),
      tipo: insumoForm.tipo,
      costo_unitario: Number(insumoForm.costo_unitario),
      unidad: insumoForm.unidad,
      notas: insumoForm.notas || null,
    }
    const { error } = editInsumo
      ? await supabase.from('costos_insumos').update(payload).eq('id', editInsumo)
      : await supabase.from('costos_insumos').insert(payload)
    if (error) { setInsumoSaving(false); setInsumoErr(error.message); return }
    setInsumoSaving(false); setInsumoModal(false); load()
  }
  async function deleteInsumo(id) {
    if (!confirm('¿Eliminar este insumo?')) return
    await supabase.from('costos_insumos').delete().eq('id', id)
    load()
  }

  // ── Lotes ──
  function openNewLote() {
    setLoteForm(emptyLote)
    setLoteItems([{ insumo_id: '', cantidad: '', costo_unitario: '' }])
    setEditLote(null)
    setLoteErr('')
    setLoteModal(true)
  }
  async function openEditLote(lote) {
    setLoteForm({ fecha: lote.fecha, descripcion: lote.descripcion || '', piezas: lote.piezas, notas: lote.notas || '' })
    const items = (lote.costos_lote_items || []).map(it => ({
      id: it.id,
      insumo_id: it.insumo_id,
      cantidad: it.cantidad,
      costo_unitario: it.costo_unitario,
    }))
    setLoteItems(items.length ? items : [{ insumo_id: '', cantidad: '', costo_unitario: '' }])
    setEditLote(lote.id)
    setLoteErr('')
    setLoteModal(true)
  }

  function setItem(idx, field, value) {
    setLoteItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      // Auto-fill costo_unitario when insumo selected
      if (field === 'insumo_id') {
        const ins = insumos.find(i => i.id === value)
        if (ins) next[idx].costo_unitario = ins.costo_unitario
      }
      return next
    })
  }

  async function saveLote() {
    if (!loteForm.piezas || Number(loteForm.piezas) <= 0) { setLoteErr('Ingresa el número de piezas.'); return }
    const validItems = loteItems.filter(it => it.insumo_id && it.cantidad && Number(it.cantidad) > 0)
    if (validItems.length === 0) { setLoteErr('Agrega al menos un insumo con cantidad.'); return }
    setLoteSaving(true)
    const lotePayload = {
      fecha: loteForm.fecha,
      descripcion: loteForm.descripcion || null,
      piezas: Number(loteForm.piezas),
      notas: loteForm.notas || null,
    }
    let loteId = editLote
    if (editLote) {
      const { error } = await supabase.from('costos_lotes').update(lotePayload).eq('id', editLote)
      if (error) { setLoteSaving(false); setLoteErr(error.message); return }
      await supabase.from('costos_lote_items').delete().eq('lote_id', editLote)
    } else {
      const { data, error } = await supabase.from('costos_lotes').insert(lotePayload).select().single()
      if (error) { setLoteSaving(false); setLoteErr(error.message); return }
      loteId = data.id
    }
    const items = validItems.map(it => ({
      lote_id: loteId,
      insumo_id: it.insumo_id,
      cantidad: Number(it.cantidad),
      costo_unitario: Number(it.costo_unitario) || 0,
    }))
    const { error: itemsErr } = await supabase.from('costos_lote_items').insert(items)
    if (itemsErr) { setLoteSaving(false); setLoteErr(itemsErr.message); return }
    setLoteSaving(false); setLoteModal(false); load()
  }

  async function deleteLote(id) {
    if (!confirm('¿Eliminar este lote? Se eliminarán también sus insumos.')) return
    await supabase.from('costos_lotes').delete().eq('id', id)
    load()
  }

  // ── Cálculos ──
  function calcLote(lote) {
    const items = lote.costos_lote_items || []
    const total = items.reduce((a, it) => a + Number(it.cantidad) * Number(it.costo_unitario), 0)
    const piezas = Number(lote.piezas) || 1
    return { total, porPieza: total / piezas }
  }

  const resumen = useMemo(() => {
    if (!lotes.length) return null
    const costosPorPieza = lotes.map(l => calcLote(l).porPieza).filter(Boolean)
    const promedio = costosPorPieza.length ? costosPorPieza.reduce((a, b) => a + b, 0) / costosPorPieza.length : 0
    const totalInvertido = lotes.reduce((a, l) => a + calcLote(l).total, 0)
    const totalPiezas = lotes.reduce((a, l) => a + Number(l.piezas), 0)
    return { promedio, totalInvertido, totalPiezas, nLotes: lotes.length }
  }, [lotes])

  const insumosPorTipo = useMemo(() => {
    const map = {}
    for (const ins of insumos) {
      if (!map[ins.tipo]) map[ins.tipo] = []
      map[ins.tipo].push(ins)
    }
    return map
  }, [insumos])

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Costos de Producción</h2>
        <div className="gap-8">
          {tab === 'insumos' && (
            <button className="btn btn-amber" onClick={openNewInsumo}>+ Nuevo insumo</button>
          )}
          {tab === 'lotes' && (
            <button className="btn btn-amber" onClick={openNewLote}>+ Nuevo lote</button>
          )}
        </div>
      </div>

      {/* KPIs rápidos */}
      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ borderTop: '3px solid var(--forest)' }}>
            <div className="card-title">Costo promedio / pieza</div>
            <div className="kpi-val" style={{ color: 'var(--forest)', fontSize: 22 }}>{fmt(resumen.promedio)}</div>
            <div className="kpi-sub">promedio histórico</div>
          </div>
          <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
            <div className="card-title">Total invertido</div>
            <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 22 }}>{fmt(resumen.totalInvertido)}</div>
            <div className="kpi-sub">{resumen.nLotes} lotes registrados</div>
          </div>
          <div className="card" style={{ borderTop: '3px solid var(--ok)' }}>
            <div className="card-title">Piezas producidas</div>
            <div className="kpi-val" style={{ color: 'var(--ok)', fontSize: 22 }}>{resumen.totalPiezas}</div>
            <div className="kpi-sub">total acumulado</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--bdr)' }}>
        <TabBtn id="lotes"   active={tab === 'lotes'}   onClick={setTab}>Lotes</TabBtn>
        <TabBtn id="insumos" active={tab === 'insumos'} onClick={setTab}>Catálogo de insumos</TabBtn>
      </div>

      {/* ── TAB LOTES ── */}
      {tab === 'lotes' && (
        <div>
          {lotes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 14, color: 'var(--txt2)', marginBottom: 14 }}>
                Registra tu primer lote de producción para ver el costo por pieza
              </div>
              <button className="btn btn-amber" onClick={openNewLote}>+ Nuevo lote</button>
            </div>
          )}
          {lotes.length > 0 && (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th className="txt-right">Piezas</th>
                      <th className="txt-right">Costo total</th>
                      <th className="txt-right">Costo / pieza</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map(lote => {
                      const { total, porPieza } = calcLote(lote)
                      return (
                        <tr key={lote.id}>
                          <td style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                            {new Date(lote.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ color: 'var(--txt2)' }}>{lote.descripcion || '—'}</td>
                          <td className="txt-right mono">{Number(lote.piezas).toLocaleString('es-MX')}</td>
                          <td className="txt-right mono" style={{ fontWeight: 600, color: 'var(--red)' }}>{fmt(total)}</td>
                          <td className="txt-right mono" style={{ fontWeight: 700, color: 'var(--forest)' }}>{fmt(porPieza)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div className="gap-4">
                              <button className="btn btn-ghost btn-sm" onClick={() => setDetalleModal(lote)}>Ver</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditLote(lote)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteLote(lote.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB INSUMOS ── */}
      {tab === 'insumos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {insumos.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 14, color: 'var(--txt2)', marginBottom: 14 }}>
                Da de alta los insumos para calcular tus costos
              </div>
              <button className="btn btn-amber" onClick={openNewInsumo}>+ Nuevo insumo</button>
            </div>
          )}
          {TIPOS.filter(t => insumosPorTipo[t.value]?.length).map(tipo => (
            <div key={tipo.value}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: tipo.color, marginBottom: 8 }}>
                {tipo.label}
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Unidad</th>
                        <th className="txt-right">Costo unitario</th>
                        <th>Notas</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(insumosPorTipo[tipo.value] || []).map(ins => (
                        <tr key={ins.id}>
                          <td style={{ fontWeight: 500 }}>{ins.nombre}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: tipo.bg, color: tipo.color }}>
                              por {ins.unidad}
                            </span>
                          </td>
                          <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(ins.costo_unitario)}</td>
                          <td style={{ fontSize: 12, color: 'var(--txt3)' }}>{ins.notas || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div className="gap-4">
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditInsumo(ins)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteInsumo(ins.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Nuevo / Editar insumo ── */}
      {insumoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setInsumoModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <span className="modal-title">{editInsumo ? 'Editar insumo' : 'Nuevo insumo'}</span>
              <button className="modal-close" onClick={() => setInsumoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={insumoForm.nombre} onChange={e => setInsumoForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Queso (cremería)" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={insumoForm.tipo} onChange={e => setInsumoForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select className="form-select" value={insumoForm.unidad} onChange={e => setInsumoForm(f => ({ ...f, unidad: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Costo por {insumoForm.unidad} *</label>
                <input type="number" min="0" step="0.01" className="form-input" value={insumoForm.costo_unitario} onChange={e => setInsumoForm(f => ({ ...f, costo_unitario: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Notas (opcional)</label>
                <input className="form-input" value={insumoForm.notas} onChange={e => setInsumoForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Proveedor, condiciones, etc." />
              </div>
              {insumoErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{insumoErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setInsumoModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveInsumo} disabled={insumoSaving}>{insumoSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo / Editar lote ── */}
      {loteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setLoteModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <span className="modal-title">{editLote ? 'Editar lote' : 'Nuevo lote'}</span>
              <button className="modal-close" onClick={() => setLoteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={loteForm.fecha} onChange={e => setLoteForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Piezas producidas *</label>
                  <input type="number" min="1" className="form-input" value={loteForm.piezas} onChange={e => setLoteForm(f => ({ ...f, piezas: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción (opcional)</label>
                <input className="form-input" value={loteForm.descripcion} onChange={e => setLoteForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Lote semana 47 — queso Oaxaca" />
              </div>

              {/* Insumos del lote */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Insumos utilizados
                </div>
                {loteItems.map((item, idx) => {
                  const ins = insumos.find(i => i.id === item.insumo_id)
                  const subtotal = Number(item.cantidad || 0) * Number(item.costo_unitario || 0)
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <select className="form-select" value={item.insumo_id} onChange={e => setItem(idx, 'insumo_id', e.target.value)}>
                        <option value="">Seleccionar insumo…</option>
                        {TIPOS.map(tipo => {
                          const grupo = insumos.filter(i => i.tipo === tipo.value)
                          if (!grupo.length) return null
                          return (
                            <optgroup key={tipo.value} label={tipo.label}>
                              {grupo.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                            </optgroup>
                          )
                        })}
                      </select>
                      <div>
                        <input type="number" min="0" step="0.001" className="form-input" value={item.cantidad} onChange={e => setItem(idx, 'cantidad', e.target.value)} placeholder={ins ? ins.unidad : 'Cant.'} style={{ textAlign: 'right' }} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--txt3)', pointerEvents: 'none' }}>$</span>
                        <input type="number" min="0" step="0.01" className="form-input" value={item.costo_unitario} onChange={e => setItem(idx, 'costo_unitario', e.target.value)} placeholder="0.00" style={{ paddingLeft: 20, textAlign: 'right' }} />
                      </div>
                      <button onClick={() => setLoteItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 18, lineHeight: 1, padding: 0 }} title="Quitar">×</button>
                      {subtotal > 0 && (
                        <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--txt3)', paddingLeft: 4, marginTop: -2 }}>
                          {Number(item.cantidad).toLocaleString('es-MX')} {ins?.unidad || ''} × {fmt(item.costo_unitario)} = <strong style={{ color: 'var(--txt2)' }}>{fmt(subtotal)}</strong>
                        </div>
                      )}
                    </div>
                  )
                })}
                <button className="btn btn-ghost btn-sm" onClick={() => setLoteItems(prev => [...prev, { insumo_id: '', cantidad: '', costo_unitario: '' }])} style={{ marginTop: 4 }}>
                  + Agregar insumo
                </button>
              </div>

              {/* Preview de costo */}
              {(() => {
                const validItems = loteItems.filter(it => it.insumo_id && it.cantidad && it.costo_unitario)
                const total = validItems.reduce((a, it) => a + Number(it.cantidad) * Number(it.costo_unitario), 0)
                const piezas = Number(loteForm.piezas) || 0
                if (total <= 0) return null
                return (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: 'var(--forest-s)', border: '1px solid var(--bdr)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--txt2)' }}>Costo total del lote</span>
                      <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(total)}</span>
                    </div>
                    {piezas > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 6 }}>
                        <span style={{ color: 'var(--txt2)', fontWeight: 600 }}>Costo por pieza ({piezas} pzas)</span>
                        <span style={{ fontWeight: 700, color: 'var(--forest)', fontSize: 16 }}>{fmt(total / piezas)}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Notas (opcional)</label>
                <textarea className="form-input" rows={2} value={loteForm.notas} onChange={e => setLoteForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones del lote…" style={{ resize: 'vertical' }} />
              </div>
              {loteErr && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{loteErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setLoteModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveLote} disabled={loteSaving}>{loteSaving ? 'Guardando…' : editLote ? 'Guardar cambios' : 'Registrar lote'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de lote ── */}
      {detalleModal && (() => {
        const { total, porPieza } = calcLote(detalleModal)
        const items = detalleModal.costos_lote_items || []
        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalleModal(null)}>
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-head">
                <span className="modal-title">Detalle del lote</span>
                <button className="modal-close" onClick={() => setDetalleModal(null)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ flex: 1, minWidth: 100, background: 'var(--forest-s)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt3)' }}>Fecha</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', marginTop: 2 }}>
                      {new Date(detalleModal.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 100, background: 'var(--forest-s)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt3)' }}>Piezas</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', marginTop: 2 }}>{Number(detalleModal.piezas).toLocaleString('es-MX')}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 100, background: 'var(--red-s)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--red-t)' }}>Costo total</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)', marginTop: 2 }}>{fmt(total)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 100, background: 'var(--ok-s)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ok-t)' }}>Costo / pieza</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ok)', marginTop: 2 }}>{fmt(porPieza)}</div>
                  </div>
                </div>
                {detalleModal.descripcion && (
                  <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>{detalleModal.descripcion}</div>
                )}
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt3)', marginBottom: 8 }}>Insumos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(it => {
                    const subtotal = Number(it.cantidad) * Number(it.costo_unitario)
                    const pct = total > 0 ? (subtotal / total) * 100 : 0
                    return (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--bdr)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{it.costos_insumos?.nombre || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                            {Number(it.cantidad).toLocaleString('es-MX')} {it.costos_insumos?.unidad} × {fmt(it.costo_unitario)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{fmt(subtotal)}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{pct.toFixed(1)}%</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {detalleModal.notas && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>{detalleModal.notas}</div>
                )}
              </div>
              <div className="modal-foot">
                <button className="btn btn-ghost" onClick={() => setDetalleModal(null)}>Cerrar</button>
                <button className="btn btn-amber" onClick={() => { setDetalleModal(null); openEditLote(detalleModal) }}>Editar lote</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
