import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const IVA = 0.16
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }
function folio(p) { return p + '-' + Date.now().toString(36).toUpperCase() }

export default function Consignacion() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('entregas')
  const [entregas, setEntregas] = useState([])
  const [liquidaciones, setLiquidaciones] = useState([])
  const [puntos, setPuntos] = useState([])
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalEntrega, setModalEntrega] = useState(false)
  const [modalLiq, setModalLiq] = useState(false)
  const [selectedEntrega, setSelectedEntrega] = useState(null)

  const [formE, setFormE] = useState({ punto_id: '', fecha: new Date().toISOString().slice(0, 10), notas: '' })
  const [itemsE, setItemsE] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])

  const [formL, setFormL] = useState({ metodo: 'reporte_tienda', cliente_id: '' })
  const [itemsL, setItemsL] = useState([])

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const [{ data: e }, { data: l }, { data: p }, { data: pr }, { data: c }] = await Promise.all([
      supabase.from('consignacion_entregas').select('*, puntos_distribucion(nombre)').order('created_at', { ascending: false }),
      supabase.from('consignacion_liquidaciones').select('*, consignacion_entregas(folio, puntos_distribucion(nombre)), ventas(total)').order('created_at', { ascending: false }),
      supabase.from('puntos_distribucion').select('id, nombre').eq('activo', true).eq('modelo', 'consignacion').order('nombre'),
      supabase.from('productos').select('id, nombre, precio_base, unidad').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setEntregas(e || [])
    setLiquidaciones(l || [])
    setPuntos(p || [])
    setProductos(pr || [])
    setClientes(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function addItemE() { setItemsE(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeItemE(i) { setItemsE(it => it.filter((_, idx) => idx !== i)) }
  function updateItemE(i, key, val) {
    setItemsE(it => {
      const next = [...it]
      next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') {
        const p = productos.find(p => p.id === val)
        if (p) next[i].precio_unitario = p.precio_base
      }
      return next
    })
  }

  async function saveEntrega() {
    if (!formE.punto_id) { setErr('Selecciona un punto de distribución.'); return }
    if (itemsE.some(i => !i.producto_id || !i.cantidad || !i.precio_unitario)) { setErr('Completa todos los productos.'); return }
    setSaving(true)
    const { data: entrega, error } = await supabase.from('consignacion_entregas').insert({
      folio: folio('CE'),
      punto_id: formE.punto_id,
      fecha: formE.fecha,
      notas: formE.notas,
      creado_por: profile?.id,
    }).select().single()
    if (error) { setSaving(false); setErr(error.message); return }

    await supabase.from('consignacion_entrega_items').insert(
      itemsE.map(i => ({
        entrega_id: entrega.id,
        producto_id: i.producto_id,
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
      }))
    )

    await supabase.from('movimientos_inventario').insert(
      itemsE.map(i => ({
        producto_id: i.producto_id,
        tipo: 'salida',
        cantidad: -Number(i.cantidad),
        concepto: 'Entrega consignación ' + entrega.folio,
        referencia_id: entrega.id,
        referencia_tipo: 'consignacion_entrega',
        creado_por: profile?.id,
      }))
    )

    setSaving(false)
    setModalEntrega(false)
    setFormE({ punto_id: '', fecha: new Date().toISOString().slice(0, 10), notas: '' })
    setItemsE([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
    load()
  }

  async function openLiquidar(entrega) {
    const { data: eitems } = await supabase
      .from('consignacion_entrega_items')
      .select('*, productos(nombre, unidad)')
      .eq('entrega_id', entrega.id)

    setSelectedEntrega(entrega)
    setItemsL((eitems || []).map(i => ({
      producto_id: i.producto_id,
      producto_nombre: i.productos?.nombre,
      unidad: i.productos?.unidad,
      cantidad_entregada: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      cantidad_vendida: '',
      cantidad_devuelta: '',
    })))
    setFormL({ metodo: 'reporte_tienda', cliente_id: '' })
    setErr('')
    setModalLiq(true)
  }

  function updateItemL(i, key, val) {
    setItemsL(it => {
      const next = [...it]
      next[i] = { ...next[i], [key]: val }
      return next
    })
  }

  const subtotalLiq = itemsL.reduce((a, i) => a + (Number(i.cantidad_vendida || 0) * Number(i.precio_unitario)), 0)
  const ivaLiq = subtotalLiq * IVA
  const totalLiq = subtotalLiq + ivaLiq

  async function saveLiquidacion() {
    if (itemsL.some(i => i.cantidad_vendida === '')) { setErr('Ingresa las cantidades vendidas.'); return }
    setSaving(true)

    const punto = puntos.find(p => p.id === selectedEntrega.punto_id) ||
      { nombre: selectedEntrega.puntos_distribucion?.nombre }

    let clienteId = formL.cliente_id || null
    if (!clienteId && selectedEntrega.cliente_id) clienteId = selectedEntrega.cliente_id

    const { data: venta } = await supabase.from('ventas').insert({
      folio: folio('CL'),
      tipo: 'consignacion_liquidacion',
      cliente_id: clienteId,
      punto_id: selectedEntrega.punto_id,
      fecha: new Date().toISOString().slice(0, 10),
      subtotal: subtotalLiq,
      iva: ivaLiq,
      total: totalLiq,
      creado_por: profile?.id,
    }).select().single()

    if (venta.data === null) {
      setSaving(false)
      setErr('Error al crear la venta.')
      return
    }

    const liqItems = itemsL.map(i => ({
      producto_id: i.producto_id,
      cantidad_vendida: Number(i.cantidad_vendida || 0),
      cantidad_devuelta: Number(i.cantidad_devuelta || 0),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.cantidad_vendida || 0) * Number(i.precio_unitario),
    }))

    const { data: liq } = await supabase.from('consignacion_liquidaciones').insert({
      entrega_id: selectedEntrega.id,
      metodo: formL.metodo,
      venta_id: venta?.id,
      creado_por: profile?.id,
    }).select().single()

    if (liq?.id) {
      await supabase.from('consignacion_liquidacion_items').insert(
        liqItems.map(i => ({ ...i, liquidacion_id: liq.id }))
      )
    }

    await supabase.from('consignacion_entregas').update({ estado: 'liquidada' }).eq('id', selectedEntrega.id)

    const devoluciones = itemsL.filter(i => Number(i.cantidad_devuelta || 0) > 0)
    if (devoluciones.length > 0) {
      await supabase.from('movimientos_inventario').insert(
        devoluciones.map(i => ({
          producto_id: i.producto_id,
          tipo: 'entrada',
          cantidad: Number(i.cantidad_devuelta),
          concepto: 'Devolución consignación ' + selectedEntrega.folio,
          referencia_id: selectedEntrega.id,
          referencia_tipo: 'consignacion_entrega',
          creado_por: profile?.id,
        }))
      )
    }

    if (clienteId && totalLiq > 0) {
      await supabase.from('cuentas_por_cobrar').insert({
        venta_id: venta?.id,
        cliente_id: clienteId,
        monto_total: totalLiq,
        monto_pagado: 0,
      })
    }

    setSaving(false)
    setModalLiq(false)
    load()
  }

  if (loading) return <div className="empty">Cargando…</div>

  const estadoBadge = e => ({
    activa: <span className="badge b-amber">Activa</span>,
    liquidada: <span className="badge b-ok">Liquidada</span>,
    cancelada: <span className="badge b-red">Cancelada</span>,
  }[e] || <span className="badge b-neu">{e}</span>)

  return (
    <div>
      <div className="page-hdr">
        <h2>Consignación</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModalEntrega(true) }}>+ Nueva entrega</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['entregas', 'liquidaciones'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={'btn ' + (tab === t ? 'btn-amber' : 'btn-ghost')}>
            {t === 'entregas' ? 'Entregas' : 'Liquidaciones'}
          </button>
        ))}
      </div>

      {tab === 'entregas' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Folio</th><th>Punto</th><th>Fecha</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {entregas.length === 0 && <tr><td colSpan={5} className="empty">Sin entregas</td></tr>}
                {entregas.map(e => (
                  <tr key={e.id}>
                    <td className="mono">{e.folio}</td>
                    <td>{e.puntos_distribucion?.nombre}</td>
                    <td>{e.fecha}</td>
                    <td>{estadoBadge(e.estado)}</td>
                    <td>
                      {e.estado === 'activa' && (
                        <button className="btn btn-amber btn-sm" onClick={() => openLiquidar(e)}>Liquidar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'liquidaciones' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Entrega</th><th>Punto</th><th>Método</th><th className="txt-right">Total</th></tr>
              </thead>
              <tbody>
                {liquidaciones.length === 0 && <tr><td colSpan={5} className="empty">Sin liquidaciones</td></tr>}
                {liquidaciones.map(l => (
                  <tr key={l.id}>
                    <td>{l.fecha}</td>
                    <td className="mono">{l.consignacion_entregas?.folio}</td>
                    <td>{l.consignacion_entregas?.puntos_distribucion?.nombre}</td>
                    <td>{l.metodo === 'reporte_tienda' ? 'Reporte tienda' : 'Conteo físico'}</td>
                    <td className="txt-right mono">{fmt(l.ventas?.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva entrega */}
      {modalEntrega && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalEntrega(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-head">
              <span className="modal-title">Nueva entrega en consignación</span>
              <button className="modal-close" onClick={() => setModalEntrega(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Punto de distribución *</label>
                  <select className="form-select" value={formE.punto_id} onChange={e => setFormE(f => ({ ...f, punto_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {puntos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={formE.fecha} onChange={e => setFormE(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Productos a entregar</div>
              {itemsE.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div>
                    {i === 0 && <label className="form-label">Producto</label>}
                    <select className="form-select" value={item.producto_id} onChange={e => updateItemE(i, 'producto_id', e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Cantidad</label>}
                    <input type="number" className="form-input" value={item.cantidad} onChange={e => updateItemE(i, 'cantidad', e.target.value)} min="0" step="0.001" />
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Precio</label>}
                    <input type="number" className="form-input" value={item.precio_unitario} onChange={e => updateItemE(i, 'precio_unitario', e.target.value)} min="0" step="0.01" />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItemE(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addItemE} style={{ marginBottom: 12 }}>+ Agregar producto</button>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notas</label>
                <input className="form-input" value={formE.notas} onChange={e => setFormE(f => ({ ...f, notas: e.target.value }))} />
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalEntrega(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveEntrega} disabled={saving}>{saving ? 'Guardando…' : 'Registrar entrega'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal liquidación */}
      {modalLiq && selectedEntrega && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalLiq(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-head">
              <span className="modal-title">Liquidar — {selectedEntrega.folio}</span>
              <button className="modal-close" onClick={() => setModalLiq(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Método de liquidación</label>
                  <select className="form-select" value={formL.metodo} onChange={e => setFormL(f => ({ ...f, metodo: e.target.value }))}>
                    <option value="reporte_tienda">Reporte de la tienda</option>
                    <option value="conteo_fisico">Conteo físico</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <select className="form-select" value={formL.cliente_id} onChange={e => setFormL(f => ({ ...f, cliente_id: e.target.value }))}>
                    <option value="">— Sin cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="txt-right">Entregado</th>
                    <th className="txt-right">Vendido</th>
                    <th className="txt-right">Devuelto</th>
                    <th className="txt-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsL.map((item, i) => (
                    <tr key={i}>
                      <td>{item.producto_nombre}<div style={{ fontSize: 11, color: 'var(--txt3)' }}>{fmt(item.precio_unitario)}/{item.unidad}</div></td>
                      <td className="txt-right mono">{item.cantidad_entregada}</td>
                      <td className="txt-right">
                        <input type="number" className="form-input" style={{ width: 80, textAlign: 'right' }}
                          value={item.cantidad_vendida}
                          onChange={e => updateItemL(i, 'cantidad_vendida', e.target.value)}
                          min="0" step="0.001" max={item.cantidad_entregada} />
                      </td>
                      <td className="txt-right">
                        <input type="number" className="form-input" style={{ width: 80, textAlign: 'right' }}
                          value={item.cantidad_devuelta}
                          onChange={e => updateItemL(i, 'cantidad_devuelta', e.target.value)}
                          min="0" step="0.001" max={item.cantidad_entregada} />
                      </td>
                      <td className="txt-right mono">{fmt(Number(item.cantidad_vendida || 0) * Number(item.precio_unitario))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ background: 'var(--amber-s)', borderRadius: 'var(--r2)', padding: '12px 14px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span className="mono">{fmt(subtotalLiq)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--txt2)' }}><span>IVA (16%)</span><span className="mono">{fmt(ivaLiq)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, marginTop: 4, color: 'var(--amber-t)' }}><span>Total a cobrar</span><span className="mono">{fmt(totalLiq)}</span></div>
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalLiq(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveLiquidacion} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar liquidación'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
