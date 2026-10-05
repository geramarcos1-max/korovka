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
  })
  const [regalados, setRegalados] = useState({ unidades: 0, valor: 0 })
  const [degustacion, setDegustacion] = useState({ unidades: 0, valor: 0 })
  const [inventario, setInventario] = useState([])
  const [ultimas, setUltimas] = useState([])

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
        supabase.from('caja_movimientos').select('monto').eq('tipo', 'transferencia_salida').eq('referencia_tipo', 'reembolso_gasto'),
      ])

      const sumTotal = arr => arr?.reduce((a, r) => a + Number(r.total || 0), 0) || 0
      const sumPend  = arr => arr?.reduce((a, r) => a + Number(r.monto_total || 0) - Number(r.monto_pagado || 0), 0) || 0

      const efectivoVentas     = sumTotal(vEfectivo)
      const transferenciaVentas = sumTotal(vTransferencia)
      const cortesCaja          = Math.abs((cortesMovs || []).reduce((a, m) => a + Number(m.monto || 0), 0))
      const reembolsosSalida    = Math.abs((reembolsosMovs || []).reduce((a, m) => a + Number(m.monto || 0), 0))

      setKpis({
        ventasTotales: sumTotal(vTotales),
        ventasMes: sumTotal(vMes),
        pendienteCobro: sumPend(cxc),
        consignacionesActivas: cons?.length || 0,
        efectivoVentas,
        transferenciaVentas,
        cortesCaja,
        reembolsosSalida,
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
          label="Por cobrar"
          value={fmt(kpis.pendienteCobro)}
          sub="saldo pendiente"
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
        <div className="card" style={{ borderTop: '3px solid #16a34a', gridColumn: 'span 2' }}>
          <div className="card-title">Caja chica</div>
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
        <div className="card" style={{ borderTop: '3px solid #0284c7', gridColumn: 'span 2' }}>
          <div className="card-title">Dinero en banco</div>
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
                Reembolsos pagados: <strong style={{ color: 'var(--red-t)' }}>−{fmt(kpis.reembolsosSalida)}</strong>
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
  )
}
