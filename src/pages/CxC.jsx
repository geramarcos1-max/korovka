import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }

export default function CxC() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalPago, setModalPago] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('pendiente')

  async function load() {
    const { data } = await supabase
      .from('cuentas_por_cobrar')
      .select('*, ventas(folio, fecha), clientes(nombre)')
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function registrarPago() {
    if (!montoPago || Number(montoPago) <= 0) return
    setSaving(true)
    const cxc = modalPago
    const nuevoPagado = Math.min(Number(cxc.monto_pagado) + Number(montoPago), Number(cxc.monto_total))
    const nuevoEstado = nuevoPagado >= Number(cxc.monto_total) ? 'pagada' : 'parcial'
    await supabase.from('cuentas_por_cobrar').update({
      monto_pagado: nuevoPagado,
      estado: nuevoEstado,
    }).eq('id', cxc.id)
    if (nuevoEstado === 'pagada') {
      await supabase.from('ventas').update({ estado: 'pagada' }).eq('id', cxc.venta_id)
    }
    setSaving(false)
    setModalPago(null)
    setMontoPago('')
    load()
  }

  const estadoBadge = e => ({
    pendiente: <span className="badge b-amber">Pendiente</span>,
    parcial:   <span className="badge b-info">Parcial</span>,
    pagada:    <span className="badge b-ok">Pagada</span>,
    vencida:   <span className="badge b-red">Vencida</span>,
  }[e] || <span className="badge b-neu">{e}</span>)

  const filtrados = filtro === 'todos' ? rows : rows.filter(r => r.estado === filtro)
  const totalPendiente = rows.filter(r => ['pendiente', 'parcial'].includes(r.estado))
    .reduce((a, r) => a + Number(r.monto_total) - Number(r.monto_pagado), 0)

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Cuentas por Cobrar</h2>
        <div style={{ background: 'var(--amber-s)', border: '1px solid var(--amber)', borderRadius: 'var(--r2)', padding: '6px 16px', fontSize: 14, color: 'var(--amber-t)', fontWeight: 600 }}>
          Por cobrar: {fmt(totalPendiente)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { val: 'pendiente', label: 'Pendientes' },
          { val: 'parcial', label: 'Parciales' },
          { val: 'pagada', label: 'Pagadas' },
          { val: 'todos', label: 'Todas' },
        ].map(f => (
          <button key={f.val} onClick={() => setFiltro(f.val)} className={'btn ' + (filtro === f.val ? 'btn-amber' : 'btn-ghost')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio venta</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="txt-right">Total</th>
                <th className="txt-right">Pagado</th>
                <th className="txt-right">Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && <tr><td colSpan={8} className="empty">Sin registros</td></tr>}
              {filtrados.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.ventas?.folio || '—'}</td>
                  <td>{r.clientes?.nombre || '—'}</td>
                  <td>{r.ventas?.fecha || '—'}</td>
                  <td className="txt-right mono">{fmt(r.monto_total)}</td>
                  <td className="txt-right mono" style={{ color: 'var(--ok)' }}>{fmt(r.monto_pagado)}</td>
                  <td className="txt-right mono" style={{ fontWeight: 600, color: Number(r.monto_total) - Number(r.monto_pagado) > 0 ? 'var(--red)' : 'var(--ok)' }}>
                    {fmt(Number(r.monto_total) - Number(r.monto_pagado))}
                  </td>
                  <td>{estadoBadge(r.estado)}</td>
                  <td>
                    {['pendiente', 'parcial'].includes(r.estado) && (
                      <button className="btn btn-ok btn-sm" onClick={() => { setModalPago(r); setMontoPago('') }}>
                        Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalPago && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Registrar pago</span>
              <button className="modal-close" onClick={() => setModalPago(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, fontSize: 14 }}>
                <div><strong>Cliente:</strong> {modalPago.clientes?.nombre}</div>
                <div><strong>Folio:</strong> {modalPago.ventas?.folio}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--txt3)' }}>TOTAL</div><div className="mono" style={{ fontWeight: 600 }}>{fmt(modalPago.monto_total)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--txt3)' }}>YA PAGADO</div><div className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{fmt(modalPago.monto_pagado)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--txt3)' }}>SALDO</div><div className="mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(Number(modalPago.monto_total) - Number(modalPago.monto_pagado))}</div></div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto del pago</label>
                <input
                  type="number"
                  className="form-input"
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={Number(modalPago.monto_total) - Number(modalPago.monto_pagado)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalPago(null)}>Cancelar</button>
              <button className="btn btn-ok" onClick={registrarPago} disabled={saving || !montoPago}>
                {saving ? 'Guardando…' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
