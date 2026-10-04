import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function SliderConfirm({ onConfirm, onCancel, label = 'Desliza para confirmar' }) {
  const trackRef = useRef(null)
  const [pos, setPos] = useState(0)
  const dragging = useRef(false)
  const startX = useRef(0)

  function getTrackWidth() { return (trackRef.current?.clientWidth || 260) - 48 }

  function start(clientX) { dragging.current = true; startX.current = clientX - pos }
  function move(clientX) {
    if (!dragging.current) return
    const next = Math.max(0, Math.min(clientX - startX.current, getTrackWidth()))
    setPos(next)
  }
  function end() {
    if (!dragging.current) return
    dragging.current = false
    if (pos >= getTrackWidth() * 0.88) { onConfirm() } else { setPos(0) }
  }

  const pct = pos / Math.max(getTrackWidth(), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
      <div style={{ fontSize: 13.5, color: 'var(--txt2)', textAlign: 'center' }}>{label}</div>
      <div
        ref={trackRef}
        onMouseMove={e => move(e.clientX)}
        onMouseUp={end} onMouseLeave={end}
        style={{ position: 'relative', width: '100%', height: 48, background: `linear-gradient(90deg, rgba(220,38,38,.18) ${pct * 100}%, var(--cream-d) ${pct * 100}%)`, borderRadius: 100, cursor: 'default', userSelect: 'none', overflow: 'hidden', transition: 'background .1s' }}
      >
        <div
          onMouseDown={e => start(e.clientX)}
          onTouchStart={e => start(e.touches[0].clientX)}
          onTouchMove={e => { e.preventDefault(); move(e.touches[0].clientX) }}
          onTouchEnd={end}
          style={{ position: 'absolute', left: pos, top: 4, width: 40, height: 40, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', boxShadow: '0 2px 8px rgba(0,0,0,.18)', transition: dragging.current ? 'none' : 'left .25s', color: '#fff', fontSize: 18, fontWeight: 700 }}
        >›</div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--txt3)', pointerEvents: 'none', opacity: 1 - pct * 2 }}>
          desliza →
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
    </div>
  )
}

const MOTIVOS = [
  { value: 'operacion',      label: 'Operación' },
  { value: 'logistica',      label: 'Logística' },
  { value: 'marketing',      label: 'Marketing' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'otro',           label: 'Otro' },
]

const CAT_LABELS = ['Operación', 'Logística', 'Marketing', 'Administrativo', 'Otro']
const CAT_COLORS = {
  'Operación':      '#2B6B50',
  'Logística':      '#2D6A9F',
  'Marketing':      '#be185d',
  'Administrativo': '#A0692A',
  'Otro':           '#9E9080',
}
function detectCat(concepto) {
  for (const cat of CAT_LABELS) {
    if (concepto?.startsWith(cat)) return cat
  }
  return 'Otro'
}

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSigned(n) {
  const v = Number(n || 0)
  const str = '$' + Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? str : `−${str}`
}

function TipoLabel({ tipo }) {
  const map = {
    cobro_venta:           { label: 'Cobro venta',      bg: 'var(--ok-s)',    color: 'var(--ok-t)' },
    gasto:                 { label: 'Gasto',             bg: 'var(--red-s)',   color: 'var(--red-t)' },
    transferencia_entrada: { label: 'Transferencia +',  bg: 'var(--info-s)',  color: 'var(--info-t)' },
    transferencia_salida:  { label: 'Transferencia −',  bg: 'var(--amber-s)', color: 'var(--amber-t)' },
    ajuste:                { label: 'Ajuste',            bg: 'var(--cream-d)', color: 'var(--txt2)' },
  }
  const s = map[tipo] || map.ajuste
  return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
}

function TabBtn({ id, active, onClick, children }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: active ? 600 : 400,
        color: active ? 'var(--forest)' : 'var(--txt3)',
        borderBottom: active ? '2px solid var(--forest)' : '2px solid transparent',
        marginBottom: -1, transition: 'color .1s',
      }}
    >
      {children}
    </button>
  )
}

const emptyGasto = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo_registro: 'gasto',
  motivo: 'operacion',
  monto: '',
  persona_id: '',
  forma_pago: 'efectivo',
  notas: '',
}

const emptyTrans = {
  de_persona_id: '',
  a_persona_id: '',
  monto: '',
  concepto: '',
}

export default function Caja() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('resumen')
  const [personas, setPersonas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)

  const [gastoModal, setGastoModal]   = useState(false)
  const [gastoForm, setGastoForm]     = useState(emptyGasto)
  const [gastoErr, setGastoErr]       = useState('')
  const [gastoSaving, setGastoSaving] = useState(false)

  const [transModal, setTransModal]   = useState(false)
  const [transForm, setTransForm]     = useState(emptyTrans)
  const [transErr, setTransErr]       = useState('')
  const [transSaving, setTransSaving] = useState(false)

  const [personaModal, setPersonaModal]   = useState(false)
  const [personaNombre, setPersonaNombre] = useState('')
  const [personaErr, setPersonaErr]       = useState('')
  const [personaSaving, setPersonaSaving] = useState(false)

  const [histPersona, setHistPersona]   = useState('')
  const [histTipo, setHistTipo]         = useState('')
  const [gastosView, setGastosView]     = useState('tabla')
  const [gastosFiltro, setGastosFiltro] = useState('todos')

  const [deleteModal, setDeleteModal]   = useState(null) // { type, id, label, refId? }
  const [deleteErr, setDeleteErr]       = useState('')

  const [editGastoModal, setEditGastoModal]   = useState(false)
  const [editGastoForm, setEditGastoForm]     = useState({})
  const [editGastoErr, setEditGastoErr]       = useState('')
  const [editGastoSaving, setEditGastoSaving] = useState(false)

  const [editTransModal, setEditTransModal]   = useState(false)
  const [editTransForm, setEditTransForm]     = useState({})
  const [editTransErr, setEditTransErr]       = useState('')
  const [editTransSaving, setEditTransSaving] = useState(false)

  async function load() {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('personas_caja').select('*').eq('activo', true).order('nombre'),
      supabase.from('caja_movimientos')
        .select('*, personas_caja(nombre)')
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    setPersonas(p || [])
    setMovimientos(m || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const balances = useMemo(() => {
    const map = {}
    for (const p of personas) map[p.id] = { ...p, saldo: 0 }
    for (const m of movimientos) {
      if (map[m.persona_id]) map[m.persona_id].saldo += Number(m.monto)
    }
    return Object.values(map)
  }, [personas, movimientos])

  const totalGeneral = balances.reduce((a, b) => a + b.saldo, 0)

  const gastos = useMemo(() => movimientos.filter(m => m.tipo === 'gasto'), [movimientos])
  const inversiones = useMemo(() => gastos.filter(g => g.referencia_tipo === 'inversion'), [gastos])
  const soloGastos  = useMemo(() => gastos.filter(g => g.referencia_tipo !== 'inversion'), [gastos])

  const gastosPorCat = useMemo(() => {
    const map = {}
    for (const g of gastos) {
      const cat = detectCat(g.concepto)
      map[cat] = (map[cat] || 0) + Math.abs(Number(g.monto))
    }
    return CAT_LABELS.map(cat => ({ cat, total: map[cat] || 0 }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [gastos])

  const gastosPorCatPersona = useMemo(() => {
    const map = {}
    for (const g of gastos) {
      const cat = detectCat(g.concepto)
      const persona = g.personas_caja?.nombre || 'Sin asignar'
      if (!map[cat]) map[cat] = {}
      map[cat][persona] = (map[cat][persona] || 0) + Math.abs(Number(g.monto))
    }
    return map
  }, [gastos])

  const transferencias = useMemo(() => {
    const map = {}
    for (const m of movimientos) {
      if (m.tipo !== 'transferencia_salida' && m.tipo !== 'transferencia_entrada') continue
      if (!map[m.referencia_id]) map[m.referencia_id] = { salida: null, entrada: null, ts: m.created_at }
      if (m.tipo === 'transferencia_salida') map[m.referencia_id].salida = m
      else map[m.referencia_id].entrada = m
    }
    return Object.values(map).sort((a, b) => b.ts > a.ts ? 1 : -1)
  }, [movimientos])

  const histFiltered = useMemo(() => {
    let rows = [...movimientos]
    if (histPersona) rows = rows.filter(m => m.persona_id === histPersona)
    if (histTipo)    rows = rows.filter(m => m.tipo === histTipo)
    return rows
  }, [movimientos, histPersona, histTipo])

  async function saveGasto() {
    if (!gastoForm.persona_id) { setGastoErr('Selecciona quién pagó.'); return }
    if (!gastoForm.monto || isNaN(Number(gastoForm.monto)) || Number(gastoForm.monto) <= 0) { setGastoErr('Ingresa un monto válido.'); return }
    setGastoSaving(true)
    const motivo = MOTIVOS.find(m => m.value === gastoForm.motivo)?.label || gastoForm.motivo
    const concepto = [motivo, gastoForm.notas].filter(Boolean).join(' — ')
    const { error } = await supabase.from('caja_movimientos').insert({
      persona_id: gastoForm.persona_id,
      tipo: 'gasto',
      monto: -Math.abs(Number(gastoForm.monto)),
      concepto,
      referencia_tipo: gastoForm.tipo_registro,
      creado_por: profile?.id,
    })
    if (error) { setGastoSaving(false); setGastoErr(error.message); return }
    setGastoSaving(false); setGastoModal(false); setGastoForm(emptyGasto); load()
  }

  async function saveTransferencia() {
    if (!transForm.de_persona_id || !transForm.a_persona_id) { setTransErr('Selecciona ambas personas.'); return }
    if (transForm.de_persona_id === transForm.a_persona_id) { setTransErr('Las personas deben ser distintas.'); return }
    if (!transForm.monto || isNaN(Number(transForm.monto)) || Number(transForm.monto) <= 0) { setTransErr('Ingresa un monto válido.'); return }
    setTransSaving(true)
    const refId = crypto.randomUUID()
    const concepto = transForm.concepto || 'Transferencia entre personas'
    const monto = Math.abs(Number(transForm.monto))
    const { error } = await supabase.from('caja_movimientos').insert([
      { persona_id: transForm.de_persona_id, tipo: 'transferencia_salida', monto: -monto, concepto, referencia_id: refId, referencia_tipo: 'transferencia', creado_por: profile?.id },
      { persona_id: transForm.a_persona_id,  tipo: 'transferencia_entrada', monto,        concepto, referencia_id: refId, referencia_tipo: 'transferencia', creado_por: profile?.id },
    ])
    if (error) { setTransSaving(false); setTransErr(error.message); return }
    setTransSaving(false); setTransModal(false); setTransForm(emptyTrans); load()
  }

  async function savePersona() {
    if (!personaNombre.trim()) { setPersonaErr('Ingresa un nombre.'); return }
    setPersonaSaving(true)
    const { error } = await supabase.from('personas_caja').insert({ nombre: personaNombre.trim() })
    if (error) { setPersonaSaving(false); setPersonaErr(error.message); return }
    setPersonaSaving(false); setPersonaModal(false); setPersonaNombre(''); load()
  }

  function openEditGasto(g) {
    setEditGastoForm({
      id: g.id,
      monto: Math.abs(Number(g.monto)),
      concepto: g.concepto || '',
      persona_id: g.persona_id || '',
      tipo_registro: g.referencia_tipo === 'inversion' ? 'inversion' : 'gasto',
    })
    setEditGastoErr('')
    setEditGastoModal(true)
  }

  async function updateGasto() {
    if (!editGastoForm.persona_id) { setEditGastoErr('Selecciona quién pagó.'); return }
    if (!editGastoForm.monto || isNaN(Number(editGastoForm.monto)) || Number(editGastoForm.monto) <= 0) { setEditGastoErr('Ingresa un monto válido.'); return }
    setEditGastoSaving(true)
    const { error } = await supabase.from('caja_movimientos').update({
      persona_id: editGastoForm.persona_id,
      monto: -Math.abs(Number(editGastoForm.monto)),
      concepto: editGastoForm.concepto,
      referencia_tipo: editGastoForm.tipo_registro,
    }).eq('id', editGastoForm.id)
    if (error) { setEditGastoSaving(false); setEditGastoErr(error.message); return }
    setEditGastoSaving(false); setEditGastoModal(false); load()
  }

  function openEditTrans(t) {
    setEditTransForm({
      refId: t.salida?.referencia_id || '',
      salidaId: t.salida?.id || '',
      entradaId: t.entrada?.id || '',
      de_persona_id: t.salida?.persona_id || '',
      a_persona_id: t.entrada?.persona_id || '',
      monto: Math.abs(Number(t.salida?.monto || 0)),
      concepto: t.salida?.concepto || '',
    })
    setEditTransErr('')
    setEditTransModal(true)
  }

  async function updateTransferencia() {
    if (!editTransForm.de_persona_id || !editTransForm.a_persona_id) { setEditTransErr('Selecciona ambas personas.'); return }
    if (editTransForm.de_persona_id === editTransForm.a_persona_id) { setEditTransErr('Las personas deben ser distintas.'); return }
    if (!editTransForm.monto || isNaN(Number(editTransForm.monto)) || Number(editTransForm.monto) <= 0) { setEditTransErr('Ingresa un monto válido.'); return }
    setEditTransSaving(true)
    const monto = Math.abs(Number(editTransForm.monto))
    const concepto = editTransForm.concepto || 'Transferencia entre personas'
    const [r1, r2] = await Promise.all([
      supabase.from('caja_movimientos').update({ persona_id: editTransForm.de_persona_id, monto: -monto, concepto }).eq('id', editTransForm.salidaId),
      supabase.from('caja_movimientos').update({ persona_id: editTransForm.a_persona_id,  monto,        concepto }).eq('id', editTransForm.entradaId),
    ])
    const err = r1.error || r2.error
    if (err) { setEditTransSaving(false); setEditTransErr(err.message); return }
    setEditTransSaving(false); setEditTransModal(false); load()
  }

  async function deleteItem() {
    if (!deleteModal) return
    setDeleteErr('')
    try {
      if (deleteModal.type === 'gasto') {
        const { error } = await supabase.from('caja_movimientos').delete().eq('id', deleteModal.id)
        if (error) throw error
      } else if (deleteModal.type === 'transferencia') {
        const { error } = await supabase.from('caja_movimientos').delete().eq('referencia_id', deleteModal.refId)
        if (error) throw error
      }
      setDeleteModal(null)
      load()
    } catch (err) {
      setDeleteErr(err.message || 'Error al eliminar')
    }
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Caja</h2>
        <div className="gap-8">
          <button className="btn btn-ghost" onClick={() => { setPersonaErr(''); setPersonaModal(true) }}>+ Persona</button>
          <button className="btn btn-ghost" onClick={() => { setTransErr(''); setTransModal(true) }}>↔ Transferencia</button>
          <button className="btn btn-amber" onClick={() => { setGastoErr(''); setGastoModal(true) }}>+ Nuevo gasto</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--bdr)' }}>
        <TabBtn id="resumen"        active={tab === 'resumen'}        onClick={setTab}>Resumen</TabBtn>
        <TabBtn id="gastos"         active={tab === 'gastos'}         onClick={setTab}>Gastos</TabBtn>
        <TabBtn id="transferencias" active={tab === 'transferencias'} onClick={setTab}>Transferencias</TabBtn>
        <TabBtn id="historial"      active={tab === 'historial'}      onClick={setTab}>Historial</TabBtn>
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
            {balances.map(p => (
              <div key={p.id} className="card" style={{ borderTop: `3px solid ${p.saldo >= 0 ? 'var(--ok)' : 'var(--red)'}` }}>
                <div className="card-title">{p.nombre}</div>
                <div className="kpi-val" style={{ color: p.saldo >= 0 ? 'var(--ok)' : 'var(--red)', fontSize: 24 }}>
                  {fmtSigned(p.saldo)}
                </div>
                <div className="kpi-sub">
                  {movimientos.filter(m => m.persona_id === p.id).length} movimientos
                </div>
              </div>
            ))}
            {balances.length > 0 && (
              <div className="card" style={{ borderTop: '3px solid var(--forest)', background: 'var(--forest-s)' }}>
                <div className="card-title">Total en caja</div>
                <div className="kpi-val" style={{ color: 'var(--forest)', fontSize: 24 }}>{fmtSigned(totalGeneral)}</div>
                <div className="kpi-sub">suma de todos</div>
              </div>
            )}
            {balances.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px 20px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>💵</div>
                <div style={{ fontSize: 13.5, color: 'var(--txt2)', marginBottom: 10 }}>Agrega personas para llevar el control de caja</div>
                <button className="btn btn-amber" onClick={() => { setPersonaErr(''); setPersonaModal(true) }}>+ Agregar persona</button>
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt2)', marginBottom: 10 }}>Últimos movimientos</div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Persona</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th className="txt-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && <tr><td colSpan={5} className="empty">Sin movimientos registrados</td></tr>}
                  {movimientos.slice(0, 12).map(m => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                        {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.personas_caja?.nombre || '—'}</td>
                      <td><TipoLabel tipo={m.tipo} /></td>
                      <td style={{ color: 'var(--txt2)', fontSize: 13, maxWidth: 260 }}>{m.concepto}</td>
                      <td className="txt-right mono" style={{ fontWeight: 600, color: Number(m.monto) >= 0 ? 'var(--ok)' : 'var(--red)' }}>
                        {fmtSigned(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── GASTOS ── */}
      {tab === 'gastos' && (() => {
        const gastosVis = gastosFiltro === 'gasto' ? soloGastos : gastosFiltro === 'inversion' ? inversiones : gastos
        const totalGastos    = Math.abs(soloGastos.reduce((a, g) => a + Number(g.monto), 0))
        const totalInversion = Math.abs(inversiones.reduce((a, g) => a + Number(g.monto), 0))
        return (
        <div>
          {/* KPI cards: gastos, inversiones, total */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
              <div className="card-title">Gastos</div>
              <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 22 }}>{fmt(totalGastos)}</div>
              <div className="kpi-sub">{soloGastos.length} registros</div>
            </div>
            <div className="card" style={{ borderTop: '3px solid #7c3aed' }}>
              <div className="card-title">Inversiones</div>
              <div className="kpi-val" style={{ color: '#7c3aed', fontSize: 22 }}>{fmt(totalInversion)}</div>
              <div className="kpi-sub">{inversiones.length} registros</div>
            </div>
            <div className="card" style={{ borderTop: '3px solid var(--forest)' }}>
              <div className="card-title">Total salidas</div>
              <div className="kpi-val" style={{ color: 'var(--forest)', fontSize: 22 }}>{fmt(totalGastos + totalInversion)}</div>
              <div className="kpi-sub">{gastos.length} registros</div>
            </div>
          </div>

          {/* Controles: filtro tipo + toggle vista */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['todos','Todos'], ['gasto','Solo gastos'], ['inversion','Solo inversiones']].map(([v, lbl]) => (
              <button key={v} onClick={() => setGastosFiltro(v)} className={gastosFiltro === v ? 'btn btn-amber btn-sm' : 'btn btn-ghost btn-sm'}>{lbl}</button>
            ))}
            <div style={{ width: 1, background: 'var(--bdr)', margin: '0 4px' }} />
            {[['tabla', '☰ Tabla'], ['grafica', '▦ Gráfica']].map(([v, lbl]) => (
              <button key={v} onClick={() => setGastosView(v)} className={gastosView === v ? 'btn btn-amber btn-sm' : 'btn btn-ghost btn-sm'}>{lbl}</button>
            ))}
          </div>

          {/* ── Vista tabla ── */}
          {gastosView === 'tabla' && (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Pagado por</th>
                      <th>Concepto</th>
                      <th className="txt-right">Monto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosVis.length === 0 && <tr><td colSpan={6} className="empty">Sin registros</td></tr>}
                    {gastosVis.map(g => {
                      const esInversion = g.referencia_tipo === 'inversion'
                      return (
                        <tr key={g.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                            {new Date(g.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                              background: esInversion ? '#ede9fe' : 'var(--red-s)',
                              color: esInversion ? '#7c3aed' : 'var(--red-t)',
                            }}>
                              {esInversion ? 'Inversión' : 'Gasto'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{g.personas_caja?.nombre || '—'}</td>
                          <td style={{ color: 'var(--txt2)', fontSize: 13 }}>{g.concepto}</td>
                          <td className="txt-right mono" style={{ fontWeight: 600, color: esInversion ? '#7c3aed' : 'var(--red)' }}>{fmt(Math.abs(g.monto))}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div className="gap-4">
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditGasto(g)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setDeleteErr(''); setDeleteModal({ type: 'gasto', id: g.id, label: g.concepto || 'este gasto' }) }}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {gastosVis.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ fontWeight: 600, color: 'var(--txt2)', paddingTop: 10 }}>Total</td>
                        <td className="txt-right mono" style={{ fontWeight: 700, color: 'var(--txt)', paddingTop: 10 }}>
                          {fmt(Math.abs(gastosVis.reduce((a, g) => a + Number(g.monto), 0)))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Vista gráfica ── */}
          {gastosView === 'grafica' && gastosFiltro !== 'inversion' && (
            <div>
              {/* Cards por categoría */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
                {gastosPorCat.map(({ cat, total }) => {
                  const totalGenGastos = gastosPorCat.reduce((a, x) => a + x.total, 0)
                  const pct = totalGenGastos > 0 ? ((total / totalGenGastos) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={cat} className="card" style={{ borderTop: `3px solid ${CAT_COLORS[cat]}`, padding: '14px 16px' }}>
                      <div className="card-title">{cat}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: CAT_COLORS[cat], fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{fmt(total)}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>{pct}% del total</div>
                    </div>
                  )
                })}
              </div>

              {/* Barras horizontales */}
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Desglose por categoría
                </div>
                {gastosPorCat.length === 0 && <div className="empty" style={{ padding: '24px 0' }}>Sin gastos registrados</div>}
                {gastosPorCat.map(({ cat, total }) => {
                  const maxTotal = Math.max(...gastosPorCat.map(x => x.total), 1)
                  const pct = (total / maxTotal) * 100
                  const personas = gastosPorCatPersona[cat] || {}
                  const color = CAT_COLORS[cat]
                  return (
                    <div key={cat} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--txt)' }}>{cat}</span>
                        </div>
                        <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, color }}>
                          {fmt(total)}
                        </span>
                      </div>
                      {/* Barra */}
                      <div style={{ height: 12, background: 'var(--cream-d)', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                        <div
                          style={{
                            height: '100%', width: `${pct}%`, background: color,
                            borderRadius: 100, transition: 'width .5s cubic-bezier(.4,0,.2,1)',
                          }}
                        />
                      </div>
                      {/* Desglose por persona */}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {Object.entries(personas).sort((a, b) => b[1] - a[1]).map(([nombre, monto]) => (
                          <span key={nombre} style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
                            {nombre}:&nbsp;<strong style={{ color: 'var(--txt2)', fontWeight: 600 }}>{fmt(monto)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── TRANSFERENCIAS ── */}
      {tab === 'transferencias' && (
        <div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>De</th>
                    <th>A</th>
                    <th>Concepto</th>
                    <th className="txt-right">Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transferencias.length === 0 && <tr><td colSpan={6} className="empty">Sin transferencias registradas</td></tr>}
                  {transferencias.map((t, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                        {t.salida && new Date(t.salida.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--red-t)' }}>{t.salida?.personas_caja?.nombre || '—'}</td>
                      <td style={{ fontWeight: 500, color: 'var(--ok-t)' }}>{t.entrada?.personas_caja?.nombre || '—'}</td>
                      <td style={{ color: 'var(--txt2)', fontSize: 13 }}>{t.salida?.concepto || '—'}</td>
                      <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(Math.abs(t.salida?.monto || 0))}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="gap-4">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditTrans(t)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setDeleteErr(''); setDeleteModal({ type: 'transferencia', refId: t.salida?.referencia_id, label: `transferencia de ${t.salida?.personas_caja?.nombre || '?'} a ${t.entrada?.personas_caja?.nombre || '?'}` }) }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === 'historial' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" style={{ maxWidth: 180 }} value={histPersona} onChange={e => setHistPersona(e.target.value)}>
              <option value="">Todas las personas</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 210 }} value={histTipo} onChange={e => setHistTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="cobro_venta">Cobro venta</option>
              <option value="gasto">Gasto</option>
              <option value="transferencia_entrada">Transferencia entrada</option>
              <option value="transferencia_salida">Transferencia salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
            {(histPersona || histTipo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setHistPersona(''); setHistTipo('') }}>Limpiar</button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)' }}>
              {histFiltered.length} movimientos
            </span>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Persona</th>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th className="txt-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {histFiltered.length === 0 && <tr><td colSpan={5} className="empty">Sin movimientos</td></tr>}
                  {histFiltered.map(m => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                        {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.personas_caja?.nombre || '—'}</td>
                      <td><TipoLabel tipo={m.tipo} /></td>
                      <td style={{ color: 'var(--txt2)', fontSize: 13, maxWidth: 280 }}>{m.concepto}</td>
                      <td className="txt-right mono" style={{ fontWeight: 600, color: Number(m.monto) >= 0 ? 'var(--ok)' : 'var(--red)' }}>
                        {fmtSigned(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo gasto ── */}
      {gastoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setGastoModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <span className="modal-title">{gastoForm.tipo_registro === 'inversion' ? 'Nueva inversión' : 'Nuevo gasto'}</span>
              <button className="modal-close" onClick={() => setGastoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Toggle Gasto / Inversión */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 18, background: 'var(--cream-d)', borderRadius: 8, padding: 3 }}>
                {[['gasto', 'Gasto'], ['inversion', 'Inversión']].map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setGastoForm(f => ({ ...f, tipo_registro: v }))}
                    style={{
                      flex: 1, border: 'none', cursor: 'pointer', padding: '7px 0', borderRadius: 6,
                      fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s',
                      background: gastoForm.tipo_registro === v ? (v === 'inversion' ? '#7c3aed' : 'var(--forest)') : 'transparent',
                      color: gastoForm.tipo_registro === v ? '#fff' : 'var(--txt2)',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={gastoForm.fecha} onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto *</label>
                  <input type="number" className="form-input" value={gastoForm.monto} onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Motivo *</label>
                <select className="form-select" value={gastoForm.motivo} onChange={e => setGastoForm(f => ({ ...f, motivo: e.target.value }))}>
                  {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pagado por *</label>
                  <select className="form-select" value={gastoForm.persona_id} onChange={e => setGastoForm(f => ({ ...f, persona_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Forma de pago</label>
                  <select className="form-select" value={gastoForm.forma_pago} onChange={e => setGastoForm(f => ({ ...f, forma_pago: e.target.value }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción / Notas</label>
                <textarea className="form-input" rows={2} value={gastoForm.notas} onChange={e => setGastoForm(f => ({ ...f, notas: e.target.value }))} placeholder="Proveedor, referencia, descripción…" style={{ resize: 'vertical' }} />
              </div>
              {gastoErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{gastoErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setGastoModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveGasto} disabled={gastoSaving} style={gastoForm.tipo_registro === 'inversion' ? { background: '#7c3aed' } : {}}>{gastoSaving ? 'Guardando…' : gastoForm.tipo_registro === 'inversion' ? 'Registrar inversión' : 'Registrar gasto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva transferencia ── */}
      {transModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTransModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <span className="modal-title">Nueva transferencia</span>
              <button className="modal-close" onClick={() => setTransModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">De (entrega dinero)</label>
                  <select className="form-select" value={transForm.de_persona_id} onChange={e => setTransForm(f => ({ ...f, de_persona_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">A (recibe dinero)</label>
                  <select className="form-select" value={transForm.a_persona_id} onChange={e => setTransForm(f => ({ ...f, a_persona_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input type="number" className="form-input" value={transForm.monto} onChange={e => setTransForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input className="form-input" value={transForm.concepto} onChange={e => setTransForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Entrega efectivo del día" />
              </div>
              {transErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{transErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setTransModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveTransferencia} disabled={transSaving}>{transSaving ? 'Guardando…' : 'Registrar transferencia'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar gasto ── */}
      {editGastoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditGastoModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <span className="modal-title">Editar {editGastoForm.tipo_registro === 'inversion' ? 'inversión' : 'gasto'}</span>
              <button className="modal-close" onClick={() => setEditGastoModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 0, marginBottom: 18, background: 'var(--cream-d)', borderRadius: 8, padding: 3 }}>
                {[['gasto', 'Gasto'], ['inversion', 'Inversión']].map(([v, lbl]) => (
                  <button key={v} onClick={() => setEditGastoForm(f => ({ ...f, tipo_registro: v }))}
                    style={{ flex: 1, border: 'none', cursor: 'pointer', padding: '7px 0', borderRadius: 6, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s', background: editGastoForm.tipo_registro === v ? (v === 'inversion' ? '#7c3aed' : 'var(--forest)') : 'transparent', color: editGastoForm.tipo_registro === v ? '#fff' : 'var(--txt2)' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input type="number" className="form-input" value={editGastoForm.monto} onChange={e => setEditGastoForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Pagado por *</label>
                <select className="form-select" value={editGastoForm.persona_id} onChange={e => setEditGastoForm(f => ({ ...f, persona_id: e.target.value }))}>
                  <option value="">Seleccionar…</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input className="form-input" value={editGastoForm.concepto} onChange={e => setEditGastoForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Operación — Etiquetas" />
              </div>
              {editGastoErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{editGastoErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEditGastoModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={updateGasto} disabled={editGastoSaving} style={editGastoForm.tipo_registro === 'inversion' ? { background: '#7c3aed' } : {}}>{editGastoSaving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar transferencia ── */}
      {editTransModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditTransModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-head">
              <span className="modal-title">Editar transferencia</span>
              <button className="modal-close" onClick={() => setEditTransModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">De (entrega dinero)</label>
                  <select className="form-select" value={editTransForm.de_persona_id} onChange={e => setEditTransForm(f => ({ ...f, de_persona_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">A (recibe dinero)</label>
                  <select className="form-select" value={editTransForm.a_persona_id} onChange={e => setEditTransForm(f => ({ ...f, a_persona_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input type="number" className="form-input" value={editTransForm.monto} onChange={e => setEditTransForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input className="form-input" value={editTransForm.concepto} onChange={e => setEditTransForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Entrega efectivo del día" />
              </div>
              {editTransErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{editTransErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEditTransModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={updateTransferencia} disabled={editTransSaving}>{editTransSaving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación con slider ── */}
      {deleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-head">
              <span className="modal-title" style={{ color: 'var(--red)' }}>Eliminar registro</span>
              <button className="modal-close" onClick={() => setDeleteModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13.5, color: 'var(--txt2)', marginBottom: 18, textAlign: 'center' }}>
                Vas a eliminar: <strong style={{ color: 'var(--txt)' }}>{deleteModal.label}</strong>.<br />Esta acción no se puede deshacer.
              </div>
              {deleteErr && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{deleteErr}</div>}
              <SliderConfirm onConfirm={deleteItem} onCancel={() => setDeleteModal(null)} label="Desliza para eliminar" />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Agregar persona ── */}
      {personaModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPersonaModal(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-head">
              <span className="modal-title">Agregar persona a caja</span>
              <button className="modal-close" onClick={() => setPersonaModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  className="form-input" value={personaNombre}
                  onChange={e => setPersonaNombre(e.target.value)}
                  placeholder="Ej: Fernando"
                  onKeyDown={e => e.key === 'Enter' && savePersona()}
                  autoFocus
                />
              </div>
              {personaErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>{personaErr}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setPersonaModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={savePersona} disabled={personaSaving}>{personaSaving ? 'Guardando…' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
