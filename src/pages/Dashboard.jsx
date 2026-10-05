import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

const ESTADO_BADGE = {
  pendiente:   { label: 'Pendiente',   bg: 'var(--amber-s)', color: 'var(--amber-t)' },
  pagada:      { label: 'Pagada',      bg: 'var(--ok-s)',    color: 'var(--ok-t)' },
  degustacion: { label: 'Degustación', bg: 'var(--info-s)',  color: 'var(--info-t)' },
  regalado:    { label: 'Regalado',    bg: '#f3e8ff',        color: '#7c3aed' },
  cancelada:   { label: 'Cancelada',   bg: 'var(--red-s)',   color: 'var(--red)' },
}
function EstadoBadge({ e }) {
  const m = ESTADO_BADGE[e] || { label: e, bg: 'var(--bg2)', color: 'var(--txt2)' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${accent || 'var(--forest)'}` }}>
      <div className="card-title">{label}</div>
      <div className="kpi-val" style={{ color: accent || 'var(--forest)' }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    ventasTotales: 0,
    ventasMes: 0,
    pendienteCobro: 0,
    consignacionesActivas: 0,
    efectivoVentas: 0,
    transferenciaVentas: 0,
    cortesCaja: 0,
    reembolsosSalida: 0,
    pvFacturado: 0,
    pvCobrado: 0,
    pvPorCobrar: 0,
  })
  const [regalados, setRegalados] = useState({ unidades: 0, valor: 0 })
  const [degustacion, setDegustacion] = useState({ unidades: 0, valor: 0 })
  const [inventario, setInventario] = useState([])
  const [ultimas, setUltimas] = useState([])

  const [histModal, setHistModal] = useState(null) // null | 'caja_chica' | 'banco'
  const [histData, setHistData]   = useState([])
  const [histLoading, setHistLoading] = useState(false)

  async function openHist(tipo) {
    setHistModal(tipo)
    setHistLoading(true)
    setHistData([])

    if (tipo === 'caja_chica') {
      const [{ data: ventas }, { data: cortes }] = await Promise.all([
        supabase.from('ventas').select('folio, fecha, total, clientes(nombre)').eq('metodo_pago', 'efectivo').in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']).order('fecha', { ascending: false }),
        supabase.from('caja_movimientos').select('monto, concepto, created_at').eq('tipo', 'transferencia_salida').eq('referencia_tipo', 'corte_caja').order('created_at', { ascending: false }),
      ])
      const items = [
        ...(ventas || []).map(v => ({
          fecha: v.fecha,
          label: `Cobro efectivo${v.clientes?.nombre ? ' · ' + v.clientes.nombre : ''}${v.folio ? ' #' + v.folio : ''}`,
          monto: Number(v.total),
          dir: 'entrada',
        })),
        ...(cortes || []).map(c => ({
          fecha: c.created_at?.slice(0, 10),
          label: c.concepto || 'Corte de caja',
          monto: Math.abs(Number(c.monto)),
          dir: 'salida',
        })),
      ].sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0))
      setHistData(items)
    } else {
      const PROP = { reembolso_gasto: 'Reembolso de gasto', reparto_ganancias: 'Reparto de ganancias' }
      const [{ data: ventas }, { data: cortesIn }, { data: salidas }] = await Promise.all([
        supabase.from('ventas').select('folio, fecha, total, clientes(nombre)').eq('metodo_pago', 'transferencia').in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']).order('fecha', { ascending: false }),
        supabase.from('caja_movimientos').select('monto, concepto, created_at').eq('tipo', 'transferencia_salida').eq('referencia_tipo', 'corte_caja').order('created_at', { ascending: false }),
        supabase.from('caja_movimientos').select('monto, concepto, referencia_tipo, created_at, personas(nombre)').eq('tipo', 'transferencia_salida').in('referencia_tipo', ['reembolso_gasto', 'reparto_ganancias']).order('created_at', { ascending: false }),
      ])
      const items = [
        ...(ventas || []).map(v => ({
          fecha: v.fecha,
          label: `Cobro transferencia${v.clientes?.nombre ? ' · ' + v.clientes.nombre : ''}${v.folio ? ' #' + v.folio : ''}`,
          monto: Number(v.total),
          dir: 'entrada',
        })),
        ...(cortesIn || []).map(c => ({
          fecha: c.created_at?.slice(0, 10),
          label: c.concepto || 'Corte de caja',
          monto: Math.abs(Number(c.monto)),
          dir: 'entrada',
        })),
        ...(salidas || []).map(s => ({
          fecha: s.created_at?.slice(0, 10),
          label: `${PROP[s.referencia_tipo] || s.referencia_tipo}${s.personas?.nombre ? ' · ' + s.personas.nombre : ''}${s.concepto ? ' — ' + s.concepto : ''}`,
          monto: Math.abs(Number(s.monto)),
          dir: 'salida',
        })),
      ].sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0))
      setHistData(items)
    }
    setHistLoading(false)
  }

  useEffect(() => {
    async function load() {
      const hoy = new Date().toISOString().slice(0, 10)
      const mesInicio = hoy.slice(0, 7) + '-01'

      const [
        { data: vTotales },
        { data: vMes },
        { data: cxc },
        { data: cons },
        { data: recientes },
        { data: vRegaladas },
        { data: vDegust },
        { data: prods },
        { data: movs },
        { data: vEfectivo },
        { data: vTransferencia },
        { data: cortesMovs },
        { data: reembolsosMovs },
        { data: pvEntregas },
        { data: pvCobros },
      ] = await Promise.all([
        supabase.from('ventas').select('total').in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']),
        supabase.from('ventas').select('total').gte('fecha', mesInicio).in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']),
        supabase.from('cuentas_por_cobrar').select('monto_total, monto_pagado').in('estado', ['pendiente', 'parcial']),
        supabase.from('consignacion_entregas').select('id').eq('estado', 'activa'),
        supabase.from('ventas').select('folio, fecha, total, estado, clientes(nombre)').order('created_at', { ascending: false }).limit(8),
        supabase.from('ventas').select('subtotal, venta_items(cantidad)').eq('estado', 'regalado'),
        supabase.from('ventas').select('subtotal, venta_items(cantidad)').eq('estado', 'degustacion'),
        supabase.from('productos').select('id, nombre, unidad, precio_base').eq('activo', true).order('nombre'),
        supabase.from('movimientos_inventario').select('producto_id, cantidad'),
        supabase.from('ventas').select('total').eq('metodo_pago', 'efectivo').in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']),
        supabase.from('ventas').select('total').eq('metodo_pago', 'transferencia').in('estado', ['pagada', 'pendiente', 'degustacion', 'regalado']),
        supabase.from('caja_movimientos').select('monto').eq('tipo', 'transferencia_salida').eq('referencia_tipo', 'corte_caja'),
        supabase.from('caja_movimientos').select('monto').eq('tipo', 'transferencia_salida').in('referencia_tipo', ['reembolso_gasto', 'reparto_ganancias']),
        supabase.from('pv_entregas').select('total'),
        supabase.from('pv_cobros').select('monto'),
      ])

      const sumTotal = arr => arr?.reduce((a, r) => a + Number(r.total || 0), 0) || 0
      const sumPend  = arr => arr?.reduce((a, r) => a + Number(r.monto_total || 0) - Number(r.monto_pagado || 0), 0) || 0

      const efectivoVentas     = sumTotal(vEfectivo)
      const transferenciaVentas = sumTotal(vTransferencia)
      const cortesCaja          = Math.abs((cortesMovs || []).reduce((a, m) => a + Number(m.monto || 0), 0))
      const reembolsosSalida    = Math.abs((reembolsosMovs || []).reduce((a, m) => a + Number(m.monto || 0), 0))
      const pvFacturado         = (pvEntregas || []).reduce((a, e) => a + Number(e.total || 0), 0)
      const pvCobrado           = (pvCobros || []).reduce((a, c) => a + Number(c.monto || 0), 0)

      setKpis({
        ventasTotales: sumTotal(vTotales),
        ventasMes: sumTotal(vMes),
        pendienteCobro: sumPend(cxc),
        consignacionesActivas: cons?.length || 0,
        efectivoVentas,
        transferenciaVentas,
        cortesCaja,
        reembolsosSalida,
        pvFacturado,
        pvCobrado,
        pvPorCobrar: pvFacturado - pvCobrado,
      })

      const regUnidades = (vRegaladas || []).reduce((a, v) => a + (v.venta_items || []).reduce((b, i) => b + Number(i.cantidad || 0), 0), 0)
      const regValor    = (vRegaladas || []).reduce((a, v) => a + Number(v.subtotal || 0), 0)
      setRegalados({ unidades: regUnidades, valor: regValor })

      const degUnidades = (vDegust || []).reduce((a, v) => a + (v.venta_items || []).reduce((b, i) => b + Number(i.cantidad || 0), 0), 0)
      const degValor    = (vDegust || []).reduce((a, v) => a + Number(v.subtotal || 0), 0)
      setDegustacion({ unidades: degUnidades, valor: degValor })

      const stockMap = {}
      ;(movs || []).forEach(m => {
        stockMap[m.producto_id] = (stockMap[m.producto_id] || 0) + Number(m.cantidad || 0)
      })
      const inv = (prods || []).map(p => ({ ...p, stock: stockMap[p.id] || 0 }))
      setInventario(inv)

      setUltimas(recientes || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="empty">Cargando…</div>

  const mesLabel = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <>
    <div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Ventas totales"
          value={fmt(kpis.ventasTotales)}
          sub="histórico acumulado"
          accent="var(--forest)"
        />
        <KpiCard
          label="Ventas del mes"
          value={fmt(kpis.ventasMes)}
          sub={mesLabel}
          accent="#2563eb"
        />
        <KpiCard
          label="Pago pendiente clientes"
          value={fmt(kpis.pendienteCobro)}
          sub="saldo pendiente"
          accent="var(--amber)"
        />
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KpiCard
          label="PV · Facturado"
          value={fmt(kpis.pvFacturado)}
          sub="total entregas puntos de venta"
          accent="var(--forest)"
        />
        <KpiCard
          label="PV · Cobrado"
          value={fmt(kpis.pvCobrado)}
          sub="pagos recibidos"
          accent="#2563eb"
        />
        <KpiCard
          label="PV · Por cobrar"
          value={fmt(kpis.pvPorCobrar)}
          sub="pendiente de cobro"
          accent="var(--amber)"
        />
        <KpiCard
          label="Consignaciones activas"
          value={kpis.consignacionesActivas}
          sub="entregas sin liquidar"
          accent="#7c3aed"
        />
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" onClick={() => openHist('caja_chica')} style={{ borderTop: '3px solid #16a34a', gridColumn: 'span 2', cursor: 'pointer', transition: 'box-shadow .15s' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,.15)'} onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="card-title">Caja chica</div>
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, opacity: .7 }}>Ver historial →</span>
          </div>
          <div className="kpi-val" style={{ color: '#16a34a' }}>{fmt(kpis.efectivoVentas - kpis.cortesCaja)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Ventas efectivo: <strong style={{ color: 'var(--txt2)' }}>{fmt(kpis.efectivoVentas)}</strong>
            </span>
            {kpis.cortesCaja > 0 && (
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                Cortes entregados al banco: <strong style={{ color: 'var(--red-t)' }}>−{fmt(kpis.cortesCaja)}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="card" onClick={() => openHist('banco')} style={{ borderTop: '3px solid #0284c7', gridColumn: 'span 2', cursor: 'pointer', transition: 'box-shadow .15s' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(2,132,199,.15)'} onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="card-title">Dinero en banco</div>
            <span style={{ fontSize: 11, color: '#0284c7', fontWeight: 600, opacity: .7 }}>Ver historial →</span>
          </div>
          <div className="kpi-val" style={{ color: '#0284c7' }}>{fmt(kpis.transferenciaVentas + kpis.cortesCaja - kpis.reembolsosSalida)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Transferencias directas: <strong style={{ color: 'var(--txt2)' }}>{fmt(kpis.transferenciaVentas)}</strong>
            </span>
            {kpis.cortesCaja > 0 && (
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                Cortes de caja: <strong style={{ color: 'var(--txt2)' }}>{fmt(kpis.cortesCaja)}</strong>
              </span>
            )}
            {kpis.reembolsosSalida > 0 && (
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
                Transferencias salientes: <strong style={{ color: 'var(--red-t)' }}>−{fmt(kpis.reembolsosSalida)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🎁</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Productos regalados</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f3e8ff', borderRadius: 'var(--r2)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Unidades</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>{fmtNum(regalados.unidades)}</div>
            </div>
            <div style={{ background: '#f3e8ff', borderRadius: 'var(--r2)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Valor</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>{fmt(regalados.valor)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 8 }}>Valor al precio de venta registrado</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🧀</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Degustaciones</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--info-s)', borderRadius: 'var(--r2)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info-t)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Unidades</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--info-t)' }}>{fmtNum(degustacion.unidades)}</div>
            </div>
            <div style={{ background: 'var(--info-s)', borderRadius: 'var(--r2)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info-t)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Costo</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--info-t)' }}>{fmt(degustacion.valor)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 8 }}>Valor al precio de venta registrado</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="page-hdr" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Resumen de inventario</div>
          <Link to="/inventario" className="btn btn-ghost btn-sm">Ver detalle →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="txt-right">Stock actual</th>
                <th>Unidad</th>
                <th className="txt-right">Precio base</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {inventario.length === 0 && (
                <tr><td colSpan={5} className="empty">Sin productos registrados</td></tr>
              )}
              {inventario.map(p => {
                const bajo = p.stock <= 0
                const alerta = p.stock > 0 && p.stock < 5
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td className="txt-right mono" style={{ fontWeight: 700, color: bajo ? 'var(--red)' : alerta ? 'var(--amber)' : 'var(--ok)' }}>
                      {fmtNum(p.stock)}
                    </td>
                    <td style={{ color: 'var(--txt2)', fontSize: 12 }}>{p.unidad}</td>
                    <td className="txt-right mono">{fmt(p.precio_base)}</td>
                    <td>
                      {bajo
                        ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--red-s)', color: 'var(--red)' }}>Sin stock</span>
                        : alerta
                        ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--amber-s)', color: 'var(--amber-t)' }}>Stock bajo</span>
                        : <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--ok-s)', color: 'var(--ok-t)' }}>OK</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="page-hdr" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Últimas ventas</div>
          <Link to="/ventas" className="btn btn-ghost btn-sm">Ver todas →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="txt-right">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.length === 0 && (
                <tr><td colSpan={5} className="empty">Sin ventas registradas aún</td></tr>
              )}
              {ultimas.map(v => (
                <tr key={v.folio}>
                  <td className="mono">{v.folio}</td>
                  <td>{v.clientes?.nombre || <span style={{ color: 'var(--txt3)', fontSize: 12 }}>Cliente particular</span>}</td>
                  <td>{v.fecha}</td>
                  <td className="txt-right mono">{fmt(v.total)}</td>
                  <td><EstadoBadge e={v.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>

      {/* ── PANEL HISTORIAL ── */}
      {histModal && (
        <>
          <div onClick={() => setHistModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,.12)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: histModal === 'caja_chica' ? '#16a34a' : '#0284c7' }}>
                  {histModal === 'caja_chica' ? 'Caja chica' : 'Dinero en banco'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                  {histModal === 'caja_chica' ? 'Efectivo en caja — historial de movimientos' : 'Cuenta bancaria — historial de movimientos'}
                </div>
              </div>
              <button onClick={() => setHistModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--txt3)', padding: 4, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              {histLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Cargando…</div>
              ) : histData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Sin movimientos registrados</div>
              ) : (() => {
                const sorted = [...histData].reverse()
                let bal = 0
                const withBal = sorted.map(item => {
                  bal += item.dir === 'entrada' ? item.monto : -item.monto
                  return { ...item, bal }
                })
                return withBal.reverse().map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid var(--bdr)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: item.dir === 'entrada' ? 'var(--ok-s)' : 'var(--red-s)', color: item.dir === 'entrada' ? 'var(--ok-t)' : 'var(--red-t)' }}>
                      {item.dir === 'entrada' ? '+' : '−'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{item.fecha}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: item.dir === 'entrada' ? 'var(--ok)' : 'var(--red)' }}>
                        {item.dir === 'entrada' ? '+' : '−'}{fmt(item.monto)}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 1 }}>saldo {fmt(item.bal)}</div>
                    </div>
                  </div>
                ))
              })()}
            </div>
            {!histLoading && histData.length > 0 && (() => {
              const totalEnt = histData.filter(i => i.dir === 'entrada').reduce((a, i) => a + i.monto, 0)
              const totalSal = histData.filter(i => i.dir === 'salida').reduce((a, i) => a + i.monto, 0)
              return (
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--bdr)', background: 'var(--bg2)', display: 'flex', gap: 20, flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Total entradas</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ok)' }}>+{fmt(totalEnt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Total salidas</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>−{fmt(totalSal)}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Saldo neto</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: histModal === 'caja_chica' ? '#16a34a' : '#0284c7' }}>{fmt(totalEnt - totalSal)}</div>
                  </div>
                </div>
              )
            })()}
          </div>
        </>
      )}
    </>
  )
}
