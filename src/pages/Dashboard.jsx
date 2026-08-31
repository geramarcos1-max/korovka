import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const [stats, setStats] = useState({ ventas_hoy: 0, ventas_mes: 0, pendiente_cobro: 0, consignaciones_activas: 0 })
  const [ultimas, setUltimas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const hoy = new Date().toISOString().slice(0, 10)
      const mesInicio = hoy.slice(0, 7) + '-01'

      const [{ data: ventasHoy }, { data: ventasMes }, { data: cxc }, { data: cons }, { data: recientes }] =
        await Promise.all([
          supabase.from('ventas').select('total').eq('fecha', hoy).neq('estado', 'cancelada'),
          supabase.from('ventas').select('total').gte('fecha', mesInicio).neq('estado', 'cancelada'),
          supabase.from('cuentas_por_cobrar').select('monto_total, monto_pagado').in('estado', ['pendiente', 'parcial']),
          supabase.from('consignacion_entregas').select('id').eq('estado', 'activa'),
          supabase.from('ventas').select('folio, fecha, total, estado, clientes(nombre)').order('created_at', { ascending: false }).limit(8),
        ])

      const sumTotal = arr => arr?.reduce((a, r) => a + Number(r.total), 0) || 0
      const sumPend = arr => arr?.reduce((a, r) => a + Number(r.monto_total) - Number(r.monto_pagado), 0) || 0

      setStats({
        ventas_hoy: sumTotal(ventasHoy),
        ventas_mes: sumTotal(ventasMes),
        pendiente_cobro: sumPend(cxc),
        consignaciones_activas: cons?.length || 0,
      })
      setUltimas(recientes || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="empty">Cargando…</div>

  const kpis = [
    { label: 'Ventas hoy', val: fmt(stats.ventas_hoy), sub: 'venta directa + liquidaciones' },
    { label: 'Ventas del mes', val: fmt(stats.ventas_mes), sub: new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' }) },
    { label: 'Por cobrar', val: fmt(stats.pendiente_cobro), sub: 'saldo pendiente' },
    { label: 'Consignaciones activas', val: stats.consignaciones_activas, sub: 'entregas sin liquidar' },
  ]

  const estadoBadge = e => ({
    pendiente: <span className="badge b-amber">Pendiente</span>,
    pagada:    <span className="badge b-ok">Pagada</span>,
    cancelada: <span className="badge b-red">Cancelada</span>,
  }[e] || <span className="badge b-neu">{e}</span>)

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="card">
            <div className="card-title">{k.label}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-hdr" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Últimas ventas</div>
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
                  <td>{v.clientes?.nombre || '—'}</td>
                  <td>{v.fecha}</td>
                  <td className="txt-right mono">{fmt(v.total)}</td>
                  <td>{estadoBadge(v.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
