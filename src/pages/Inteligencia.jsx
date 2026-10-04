import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n, dec = 1) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatChip({ label, value, color = 'var(--forest)' }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '12px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
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

export default function Inteligencia() {
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState([])
  const [ventaItems, setVentaItems] = useState([])
  const [productos, setProductos] = useState([])
  const [devoluciones, setDevoluciones] = useState([])
  const [devItems, setDevItems] = useState([])
  const [periodoMeses, setPeriodoMeses] = useState(6)

  useEffect(() => {
    async function load() {
      const [
        { data: v },
        { data: vi },
        { data: p },
        { data: d },
        { data: di },
      ] = await Promise.all([
        supabase.from('ventas').select('id, fecha, total, estado, metodo_pago').not('estado', 'eq', 'cancelada').order('fecha'),
        supabase.from('venta_items').select('venta_id, producto_id, cantidad, precio_unit'),
        supabase.from('productos').select('id, nombre, unidad').eq('activo', true).order('nombre'),
        supabase.from('pv_devoluciones').select('id, fecha, motivo, notas, entrega_id').order('fecha', { ascending: false }).limit(200),
        supabase.from('pv_devolucion_items').select('devolucion_id, producto_id, cantidad'),
      ])
      setVentas(v || [])
      setVentaItems(vi || [])
      setProductos(p || [])
      setDevoluciones(d || [])
      setDevItems(di || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Ventas mes a mes ──────────────────────────────────────
  const ventasMes = useMemo(() => {
    const map = {}
    for (const v of ventas) {
      const m = v.fecha?.slice(0, 7)
      if (!m) continue
      if (!map[m]) map[m] = { total: 0, count: 0, efectivo: 0, transferencia: 0 }
      map[m].total += Number(v.total || 0)
      map[m].count++
      if (v.metodo_pago === 'efectivo') map[m].efectivo += Number(v.total || 0)
      if (v.metodo_pago === 'transferencia') map[m].transferencia += Number(v.total || 0)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-periodoMeses)
  }, [ventas, periodoMeses])

  const maxMes = useMemo(() => Math.max(...ventasMes.map(([, d]) => d.total), 1), [ventasMes])

  const totalPeriodo = useMemo(() => ventasMes.reduce((a, [, d]) => a + d.total, 0), [ventasMes])
  const promedioMes  = useMemo(() => ventasMes.length ? totalPeriodo / ventasMes.length : 0, [totalPeriodo, ventasMes])
  const mesActual    = useMemo(() => ventasMes[ventasMes.length - 1]?.[1]?.total || 0, [ventasMes])
  const mesPrev      = useMemo(() => ventasMes[ventasMes.length - 2]?.[1]?.total || 0, [ventasMes])
  const crecimiento  = useMemo(() => mesPrev > 0 ? ((mesActual - mesPrev) / mesPrev) * 100 : null, [mesActual, mesPrev])

  // ── Top productos ─────────────────────────────────────────
  const prodMap = useMemo(() => {
    const m = {}
    for (const p of productos) m[p.id] = { ...p, cantidad: 0, ingresos: 0 }
    for (const i of ventaItems) {
      if (m[i.producto_id]) {
        m[i.producto_id].cantidad += Number(i.cantidad || 0)
        m[i.producto_id].ingresos += Number(i.cantidad || 0) * Number(i.precio_unit || 0)
      }
    }
    return Object.values(m).filter(p => p.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)
  }, [productos, ventaItems])

  const maxProdCantidad = useMemo(() => Math.max(...prodMap.map(p => p.cantidad), 1), [prodMap])

  // ── Proyección semanal (últimas 4 semanas) ────────────────
  const proyecciones = useMemo(() => {
    const hoy = new Date()
    const hace28 = new Date(hoy - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const ventasRecientes = new Set(ventas.filter(v => v.fecha >= hace28).map(v => v.id))
    const m = {}
    for (const p of productos) m[p.id] = { ...p, cant28: 0 }
    for (const i of ventaItems) {
      if (ventasRecientes.has(i.venta_id) && m[i.producto_id]) {
        m[i.producto_id].cant28 += Number(i.cantidad || 0)
      }
    }
    return Object.values(m)
      .map(p => ({ ...p, semanaPromedio: p.cant28 / 4, pedidoSugerido: Math.ceil((p.cant28 / 4) * 1.25) }))
      .filter(p => p.cant28 > 0)
      .sort((a, b) => b.semanaPromedio - a.semanaPromedio)
  }, [productos, ventas, ventaItems])

  // ── Devoluciones ──────────────────────────────────────────
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

  const totalDevUnidades = useMemo(() => devItems.reduce((a, i) => a + Number(i.cantidad || 0), 0), [devItems])
  const maxDevProd = useMemo(() => Math.max(...devPorProducto.map(p => p.cantidad), 1), [devPorProducto])

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      {/* ── Encabezado ── */}
      <div className="page-hdr" style={{ marginBottom: 24 }}>
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

      {/* ── KPI fila superior ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatChip label="Total periodo" value={fmt(totalPeriodo)} color="var(--forest)" />
        <StatChip label="Promedio mensual" value={fmt(promedioMes)} color="#2563eb" />
        <StatChip label="Mes actual" value={fmt(mesActual)} color={crecimiento !== null && crecimiento >= 0 ? 'var(--ok)' : 'var(--red)'} />
        {crecimiento !== null && (
          <StatChip
            label="vs mes anterior"
            value={(crecimiento >= 0 ? '+' : '') + fmtN(crecimiento) + '%'}
            color={crecimiento >= 0 ? 'var(--ok)' : 'var(--red)'}
          />
        )}
        <StatChip label="Devoluciones" value={devoluciones.length} color="var(--amber)" />
        <StatChip label="Unidades devueltas" value={fmtN(totalDevUnidades, 0)} color="var(--amber)" />
      </div>

      {/* ── Ventas mes a mes ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <SectionTitle sub={`Últimos ${periodoMeses} meses · Total ${fmt(totalPeriodo)}`}>
          Ventas mes a mes
        </SectionTitle>
        {ventasMes.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>Sin datos suficientes</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ventasMes.map(([key, data]) => {
              const [yr, mo] = key.split('-')
              const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`
              const pct = (data.total / maxMes) * 100
              const esActual = key === new Date().toISOString().slice(0, 7)
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 52, fontSize: 12, color: esActual ? 'var(--forest)' : 'var(--txt3)', fontWeight: esActual ? 700 : 400, flexShrink: 0, textAlign: 'right' }}>
                    {label}
                  </div>
                  <HBar pct={pct} color={esActual ? 'var(--forest)' : 'var(--forest-d, #0a5a48)'} height={24} />
                  <div style={{ width: 88, fontSize: 13, fontWeight: 600, color: 'var(--txt)', flexShrink: 0, textAlign: 'right' }}>
                    {fmt(data.total)}
                  </div>
                  <div style={{ width: 40, fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>
                    {data.count} v.
                  </div>
                </div>
              )
            })}
            {/* Promedio line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px dashed var(--bdr)', marginTop: 4 }}>
              <div style={{ width: 52, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', flexShrink: 0 }}>prom.</div>
              <HBar pct={(promedioMes / maxMes) * 100} color="var(--amber)" height={4} />
              <div style={{ width: 88, fontSize: 12, color: 'var(--amber-t)', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{fmt(promedioMes)}</div>
              <div style={{ width: 40 }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* ── Top productos vendidos ── */}
        <div className="card">
          <SectionTitle sub="Por cantidad de unidades vendidas (histórico)">
            Top productos
          </SectionTitle>
          {prodMap.length === 0 ? (
            <div className="empty" style={{ padding: '28px 0' }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {prodMap.map((p, i) => (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 18, height: 18, background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--cream-d)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: i < 3 ? '#fff' : 'var(--txt3)', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{p.nombre}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>{fmtN(p.cantidad, 0)}</span>
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}> {p.unidad}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HBar pct={(p.cantidad / maxProdCantidad) * 100} color="var(--forest)" height={6} />
                    <span style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(p.ingresos)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Devoluciones ── */}
        <div className="card">
          <SectionTitle sub={`${devoluciones.length} devoluciones · ${fmtN(totalDevUnidades, 0)} unidades totales`}>
            Devoluciones por motivo
          </SectionTitle>
          {devPorMotivo.length === 0 ? (
            <div className="empty" style={{ padding: '28px 0' }}>Sin devoluciones registradas</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {devPorMotivo.map(([motivo, count]) => (
                  <div key={motivo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--txt)' }}>{motivo}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber-t)' }}>{count}</span>
                    </div>
                    <HBar pct={(count / (devPorMotivo[0]?.[1] || 1)) * 100} color="var(--amber)" height={6} />
                  </div>
                ))}
              </div>
              {devPorProducto.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Por producto</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {devPorProducto.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--txt2)', flex: 1 }}>{p.nombre}</div>
                        <HBar pct={(p.cantidad / maxDevProd) * 100} color="var(--red-t)" height={6} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-t)', width: 30, textAlign: 'right', flexShrink: 0 }}>{fmtN(p.cantidad, 0)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Proyección de pedido semanal ── */}
      <div className="card">
        <SectionTitle sub="Basado en ventas de las últimas 4 semanas · Sugerido incluye +25% de margen">
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {proyecciones.map(p => {
                  const maxCant = proyecciones[0]?.semanaPromedio || 1
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                      <td style={{ color: 'var(--txt3)', fontSize: 12 }}>{p.unidad}</td>
                      <td className="txt-right mono">{fmtN(p.cant28, 0)}</td>
                      <td className="txt-right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                          <HBar pct={(p.semanaPromedio / maxCant) * 100} color="var(--forest)" height={6} />
                          <span className="mono" style={{ fontWeight: 500, minWidth: 36, textAlign: 'right' }}>{fmtN(p.semanaPromedio)}</span>
                        </div>
                      </td>
                      <td className="txt-right">
                        <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 100, background: 'var(--forest-s)', color: 'var(--forest)', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                          {p.pedidoSugerido}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--txt3)' }}>{p.unidad}</td>
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
