import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

  const [histPersona, setHistPersona] = useState('')
  const [histTipo, setHistTipo]       = useState('')
  const [gastosView, setGastosView]   = useState('tabla')

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
      referencia_tipo: 'gasto',
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
      {tab === 'gastos' && (
        <div>
          {/* KPI por persona + toggle de vista */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {balances.map(p => {
              const total = Math.abs(gastos.filter(g => g.persona_id === p.id).reduce((a, g) => a + Number(g.monto), 0))
              return (
                <div key={p.id} className="card" style={{ flex: 1, minWidth: 140 }}>
                  <div className="card-title">{p.nombre}</div>
                  <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 22 }}>{fmt(total)}</div>
                  <div className="kpi-sub">total gastado</div>
                </div>
              )
            })}
            <div className="card" style={{ flex: 1, minWidth: 140 }}>
              <div className="card-title">Total general</div>
              <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 22 }}>
                {fmt(Math.abs(gastos.reduce((a, g) => a + Number(g.monto), 0)))}
              </div>
              <div className="kpi-sub">{gastos.length} registros</div>
            </div>
          </div>

          {/* Toggle tabla / gráfica */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[['tabla', '☰ Tabla'], ['grafica', '▦ Gráfica']].map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setGastosView(v)}
                className={gastosView === v ? 'btn btn-amber btn-sm' : 'btn btn-ghost btn-sm'}
              >
                {lbl}
              </button>
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
                      <th>Pagado por</th>
                      <th>Concepto</th>
                      <th className="txt-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.length === 0 && <tr><td colSpan={4} className="empty">Sin gastos registrados</td></tr>}
                    {gastos.map(g => (
                      <tr key={g.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                          {new Date(g.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ fontWeight: 500 }}>{g.personas_caja?.nombre || '—'}</td>
                        <td style={{ color: 'var(--txt2)', fontSize: 13 }}>{g.concepto}</td>
                        <td className="txt-right mono" style={{ fontWeight: 600, color: 'var(--red)' }}>{fmt(Math.abs(g.monto))}</td>
                      </tr>
                    ))}
                  </tbody>
                  {gastos.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 600, color: 'var(--txt2)', paddingTop: 10 }}>Total gastos</td>
                        <td className="txt-right mono" style={{ fontWeight: 700, color: 'var(--red)', paddingTop: 10 }}>
                          {fmt(Math.abs(gastos.reduce((a, g) => a + Number(g.monto), 0)))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Vista gráfica ── */}
          {gastosView === 'grafica' && (
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
      )}

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
                  </tr>
                </thead>
                <tbody>
                  {transferencias.length === 0 && <tr><td colSpan={5} className="empty">Sin transferencias registradas</td></tr>}
                  {transferencias.map((t, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--txt3)' }}>
                        {t.salida && new Date(t.salida.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--red-t)' }}>{t.salida?.personas_caja?.nombre || '—'}</td>
                      <td style={{ fontWeight: 500, color: 'var(--ok-t)' }}>{t.entrada?.personas_caja?.nombre || '—'}</td>
                      <td style={{ color: 'var(--txt2)', fontSize: 13 }}>{t.salida?.concepto || '—'}</td>
                      <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(Math.abs(t.salida?.monto || 0))}</td>
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
              <span className="modal-title">Nuevo gasto</span>
              <button className="modal-close" onClick={() => setGastoModal(false)}>×</button>
            </div>
            <div className="modal-body">
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
              <button className="btn btn-amber" onClick={saveGasto} disabled={gastoSaving}>{gastoSaving ? 'Guardando…' : 'Registrar gasto'}</button>
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
