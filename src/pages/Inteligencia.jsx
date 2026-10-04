import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n, dec = 1) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Color palette for pie chart and product bars
const PIE_COLORS = [
  '#063831', '#2B6B50', '#4A9073', '#7CB5A0',
  '#A8D1C5', '#c8a85a', '#e07b4a', '#9b59b6',
  '#2980b9', '#e74c3c', '#1abc9c', '#f39c12',
]

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function HBar({ pct, color = 'var(--forest)', height = 10 }) {
  return (
    <div style={{ flex: 1, background: 'var(--cream-d)', borderRadius: 100, height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct, 0)}%`, height: '100%', background: color, borderRadius: 100, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  )
}

// SVG Donut chart — no library needed
function DonutChart({ slices, size = 180 }) {
  const r = 68
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r

  let offset = 0
  const segments = slices.map(s => {
    const dash = (s.pct / 100) * circ
    const seg = { ...s, dash, gap: circ - dash, offset }
    offset += dash
    return seg
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cream-d)" strokeWidth={22} />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={22}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  )
}

export default function Inteligencia() {
  const [loading, setLoading]         = useState(true)
  const [ventas, setVentas]           = useState([])
  const [ventaItems, setVentaItems]   = useState([])
  const [productos, setProductos]     = useState([])
  const [devoluciones, setDevoluciones] = useState([])
  const [devItems, setDevItems]       = useState([])

  // Período para la gráfica de barras (meses mostrados)
  const [periodoMeses, setPeriodoMeses] = useState(6)

  // Filtro de análisis (desde / hasta) para top productos y pay chart
  const hoy = new Date().toISOString().slice(0, 10)
  const hace6m = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [desde, setDesde] = useState(hace6m)
  const [hasta, setHasta] = useState(hoy)
  const [mesSel, setMesSel] = useState(null) // 'YYYY-MM' o null

  useEffect(() => {
    async function load() {
      const [
        { data: v },
        { data: p },
        { data: d },
        { data: di },
      ] = await Promise.all([
        supabase.from('ventas')
          .select('id, fecha, total, estado, metodo_pago, venta_items(producto_id, cantidad, precio_unit)')
          .not('estado', 'eq', 'cancelada')
          .order('fecha'),
        supabase.from('productos').select('id, nombre, unidad').order('nombre'),
        supabase.from('pv_devoluciones').select('id, fecha, motivo, notas').order('fecha', { ascending: false }).limit(300),
        supabase.from('pv_devolucion_items').select('devolucion_id, producto_id, cantidad'),
      ])
      const ventasData = v || []
      setVentas(ventasData)
      // Flatten venta_items from the join
      const flatItems = ventasData.flatMap(venta =>
        (venta.venta_items || []).map(i => ({ ...i, venta_id: venta.id }))
      )
      setVentaItems(flatItems)
      setProductos(p || [])
      setDevoluciones(d || [])
      setDevItems(di || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Ventas mes a mes (respeta periodoMeses) ────────────────
  const ventasMes = useMemo(() => {
    const map = {}
    for (const v of ventas) {
      const m = v.fecha?.slice(0, 7)
      if (!m) continue
      if (!map[m]) map[m] = { total: 0, count: 0 }
      map[m].total += Number(v.total || 0)
      map[m].count++
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-periodoMeses)
  }, [ventas, periodoMeses])

  const maxMes       = useMemo(() => Math.max(...ventasMes.map(([, d]) => d.total), 1), [ventasMes])
  const totalPeriodo = useMemo(() => ventasMes.reduce((a, [, d]) => a + d.total, 0), [ventasMes])
  const promedioMes  = useMemo(() => ventasMes.length ? totalPeriodo / ventasMes.length : 0, [totalPeriodo, ventasMes])
  const mesActual    = useMemo(() => ventasMes[ventasMes.length - 1]?.[1]?.total || 0, [ventasMes])
  const mesPrev      = useMemo(() => ventasMes[ventasMes.length - 2]?.[1]?.total || 0, [ventasMes])
  const crecimiento  = useMemo(() => mesPrev > 0 ? ((mesActual - mesPrev) / mesPrev) * 100 : null, [mesActual, mesPrev])

  // ── Filtro de análisis: fechas o mes seleccionado ──────────
  const fechaDesde = mesSel ? `${mesSel}-01` : desde
  const fechaHasta = mesSel ? `${mesSel}-31` : hasta

  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => v.fecha >= fechaDesde && v.fecha <= fechaHasta)
  }, [ventas, fechaDesde, fechaHasta])

  const ventasFiltradasIds = useMemo(() => new Set(ventasFiltradas.map(v => v.id)), [ventasFiltradas])

  const totalFiltro = useMemo(() => ventasFiltradas.reduce((a, v) => a + Number(v.total || 0), 0), [ventasFiltradas])

  // ── Top productos (con filtro de fechas) ──────────────────
  const prodMap = useMemo(() => {
    const m = {}
    for (const p of productos) m[p.id] = { ...p, cantidad: 0, ingresos: 0 }
    for (const i of ventaItems) {
      if (!ventasFiltradasIds.has(i.venta_id)) continue
      if (!m[i.producto_id]) {
        // producto no en catálogo activo, agrega con nombre desconocido
        m[i.producto_id] = { id: i.producto_id, nombre: `Producto ${i.producto_id?.slice(0, 6)}`, unidad: 'pza', cantidad: 0, ingresos: 0 }
      }
      m[i.producto_id].cantidad += Number(i.cantidad || 0)
      m[i.producto_id].ingresos += Number(i.cantidad || 0) * Number(i.precio_unit || 0)
    }
    return Object.values(m).filter(p => p.cantidad > 0).sort((a, b) => b.ingresos - a.ingresos)
  }, [productos, ventaItems, ventasFiltradasIds])

  const maxProdIngresos = useMemo(() => Math.max(...prodMap.map(p => p.ingresos), 1), [prodMap])

  // ── Pie chart slices (por ingresos) ───────────────────────
  const pieSlices = useMemo(() => {
    const total = prodMap.reduce((a, p) => a + p.ingresos, 0) || 1
    return prodMap.slice(0, 8).map((p, i) => ({
      ...p,
      pct: (p.ingresos / total) * 100,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [prodMap])

  // ── Proyección semanal (siempre últimas 4 semanas) ────────
  const proyecciones = useMemo(() => {
    const hace28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const ids28  = new Set(ventas.filter(v => v.fecha >= hace28).map(v => v.id))
    const m = {}
    for (const p of productos) m[p.id] = { ...p, cant28: 0 }
    for (const i of ventaItems) {
      if (!ids28.has(i.venta_id)) continue
      if (!m[i.producto_id]) m[i.producto_id] = { id: i.producto_id, nombre: `Producto ${i.producto_id?.slice(0, 6)}`, unidad: 'pza', cant28: 0 }
      m[i.producto_id].cant28 += Number(i.cantidad || 0)
    }
    return Object.values(m)
      .map(p => ({ ...p, semProm: p.cant28 / 4, sugerido: Math.ceil((p.cant28 / 4) * 1.25) }))
      .filter(p => p.cant28 > 0)
      .sort((a, b) => b.semProm - a.semProm)
  }, [productos, ventas, ventaItems])

  // ── Devoluciones ──────────────────────────────────────────
  const totalDevUnidades = useMemo(() => devItems.reduce((a, i) => a + Number(i.cantidad || 0), 0), [devItems])

  const devPorMotivo = useMemo(() => {
    const m = {}
    for (const d of devoluciones) {
      const key = d.motivo || 'Sin motivo'
      m[key] = (m[key] || 0) + 1
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a)
  }, [devoluciones])

  const devPorProducto = useMemo(() => {
    const m = {}
    for (const p of productos) m[p.id] = { ...p, cantidad: 0 }
    for (const i of devItems) {
      if (m[i.producto_id]) m[i.producto_id].cantidad += Number(i.cantidad || 0)
    }
    return Object.values(m).filter(p => p.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)
  }, [productos, devItems])
  const maxDevProd = useMemo(() => Math.max(...devPorProducto.map(p => p.cantidad), 1), [devPorProducto])

  // ─────────────────────────────────────────────────────────
  if (loading) return <div className="empty">Cargando…</div>

  const labelFiltro = mesSel
    ? (() => { const [y, mo] = mesSel.split('-'); return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}` })()
    : `${desde} → ${hasta}`

  return (
    <div>
      {/* ── Encabezado ── */}
      <div className="page-hdr" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Inteligencia Comercial</h2>
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 3 }}>Análisis de ventas, productos y proyecciones</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => setPeriodoMeses(n)} className={periodoMeses === n ? 'btn btn-amber btn-sm' : 'btn btn-ghost btn-sm'}>
              {n} meses
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI fila (sin devoluciones, solo unidades devueltas) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total periodo', value: fmt(totalPeriodo), color: 'var(--forest)' },
          { label: 'Promedio mensual', value: fmt(promedioMes), color: '#2563eb' },
          { label: 'Mes actual', value: fmt(mesActual), color: crecimiento !== null && crecimiento >= 0 ? 'var(--ok)' : 'var(--red)' },
          ...(crecimiento !== null ? [{ label: 'vs mes anterior', value: (crecimiento >= 0 ? '+' : '') + fmtN(crecimiento) + '%', color: crecimiento >= 0 ? 'var(--ok)' : 'var(--red)' }] : []),
          { label: 'Unidades devueltas', value: fmtN(totalDevUnidades, 0), color: 'var(--amber-t)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Ventas mes a mes ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle sub={`Últimos ${periodoMeses} meses · Total ${fmt(totalPeriodo)} · Clic en un mes para filtrar el análisis`}>
          Ventas mes a mes
        </SectionTitle>
        {ventasMes.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>Sin datos suficientes</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ventasMes.map(([key, data]) => {
              const [yr, mo] = key.split('-')
              const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`
              const pct   = (data.total / maxMes) * 100
              const esActual  = key === new Date().toISOString().slice(0, 7)
              const esSel     = mesSel === key
              return (
                <div
                  key={key}
                  onClick={() => setMesSel(esSel ? null : key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderRadius: 8, padding: '4px 6px', background: esSel ? 'var(--forest-s)' : 'transparent', transition: 'background .15s' }}
                >
                  <div style={{ width: 56, fontSize: 12, color: esActual ? 'var(--forest)' : esSel ? 'var(--forest)' : 'var(--txt3)', fontWeight: esActual || esSel ? 700 : 400, flexShrink: 0, textAlign: 'right', lineHeight: 1.3 }}>
                    {label}
                  </div>
                  <HBar pct={pct} color={esSel ? 'var(--forest)' : esActual ? '#2B6B50' : 'var(--forest)'} height={26} />
                  <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: 'var(--txt)', flexShrink: 0, textAlign: 'right' }}>
                    {fmt(data.total)}
                  </div>
                  <div style={{ width: 38, fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>
                    {data.count} v.
                  </div>
                </div>
              )
            })}
            {/* Línea promedio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px dashed var(--bdr)', marginTop: 4 }}>
              <div style={{ width: 56, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', flexShrink: 0 }}>prom.</div>
              <HBar pct={(promedioMes / maxMes) * 100} color="var(--amber)" height={4} />
              <div style={{ width: 90, fontSize: 12, color: 'var(--amber-t)', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{fmt(promedioMes)}</div>
              <div style={{ width: 38 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Filtro de análisis ─────────────────────────────────── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Período de análisis</div>
        {mesSel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--forest)' }}>{labelFiltro}</span>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>(seleccionado en gráfica)</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setMesSel(null)}>Limpiar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input type="date" className="form-input" style={{ width: 140, padding: '4px 8px', fontSize: 13 }} value={desde} onChange={e => setDesde(e.target.value)} />
            <span style={{ color: 'var(--txt3)', fontSize: 13 }}>→</span>
            <input type="date" className="form-input" style={{ width: 140, padding: '4px 8px', fontSize: 13 }} value={hasta} onChange={e => setHasta(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>· {ventasFiltradas.length} ventas · {fmt(totalFiltro)}</span>
          </div>
        )}
      </div>

      {/* ── Top productos + Pie chart ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 20 }}>

        {/* Top productos */}
        <div className="card">
          <SectionTitle sub={`Por ingresos · ${labelFiltro}`}>Top productos</SectionTitle>
          {prodMap.length === 0 ? (
            <div className="empty" style={{ padding: '28px 0' }}>Sin ventas en el periodo seleccionado</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {prodMap.map((p, i) => (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{fmtN(p.cantidad, 0)} {p.unidad}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', minWidth: 80, textAlign: 'right' }}>{fmt(p.ingresos)}</span>
                    </div>
                  </div>
                  <HBar pct={(p.ingresos / maxProdIngresos) * 100} color={PIE_COLORS[i % PIE_COLORS.length]} height={7} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie / Donut chart */}
        {prodMap.length > 0 && (
          <div className="card" style={{ minWidth: 260 }}>
            <SectionTitle sub="Composición por ingresos">Desglose</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <DonutChart slices={pieSlices} size={180} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>{fmt(totalFiltro)}</div>
                </div>
              </div>
              {/* Leyenda */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {pieSlices.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 11.5, color: 'var(--txt2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--txt3)', flexShrink: 0 }}>{fmtN(s.pct)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Devoluciones ── */}
      {(devoluciones.length > 0 || devPorProducto.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="card">
            <SectionTitle sub={`${devoluciones.length} devoluciones · ${fmtN(totalDevUnidades, 0)} unidades`}>
              Devoluciones por motivo
            </SectionTitle>
            {devPorMotivo.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>Sin datos</div>
            ) : devPorMotivo.map(([motivo, count]) => (
              <div key={motivo} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--txt)' }}>{motivo}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber-t)' }}>{count}</span>
                </div>
                <HBar pct={(count / (devPorMotivo[0]?.[1] || 1)) * 100} color="var(--amber)" height={6} />
              </div>
            ))}
          </div>
          <div className="card">
            <SectionTitle sub="Unidades devueltas por producto">Devoluciones por producto</SectionTitle>
            {devPorProducto.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>Sin datos</div>
            ) : devPorProducto.map(p => (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--txt)' }}>{p.nombre}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-t)' }}>{fmtN(p.cantidad, 0)} {p.unidad}</span>
                </div>
                <HBar pct={(p.cantidad / maxDevProd) * 100} color="var(--red-t)" height={6} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Proyección semanal ── */}
      <div className="card">
        <SectionTitle sub="Basado en ventas de las últimas 4 semanas · Sugerido = promedio × 1.25">
          Proyección de pedido semanal
        </SectionTitle>
        {proyecciones.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>Sin ventas en los últimos 28 días</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Unidad</th>
                  <th className="txt-right">Vendido (28 días)</th>
                  <th className="txt-right">Promedio / semana</th>
                  <th className="txt-right" style={{ color: 'var(--forest)' }}>Pedido sugerido</th>
                </tr>
              </thead>
              <tbody>
                {proyecciones.map(p => {
                  const maxSem = proyecciones[0]?.semProm || 1
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                      <td style={{ color: 'var(--txt3)', fontSize: 12 }}>{p.unidad}</td>
                      <td className="txt-right mono">{fmtN(p.cant28, 0)}</td>
                      <td className="txt-right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                          <HBar pct={(p.semProm / maxSem) * 100} color="var(--forest)" height={6} />
                          <span className="mono" style={{ fontWeight: 500, minWidth: 36, textAlign: 'right' }}>{fmtN(p.semProm)}</span>
                        </div>
                      </td>
                      <td className="txt-right">
                        <span style={{ display: 'inline-block', padding: '3px 14px', borderRadius: 100, background: 'var(--forest-s)', color: 'var(--forest)', fontWeight: 700, fontSize: 14 }}>
                          {p.sugerido}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
