import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const IVA_RATE = 0.16
const PARTICULAR = '__particular__'
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }
function folio(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() }

function PrintRemision({ venta, items, cliente, notas, conIva, onClose }) {
  const ref = useRef()
  function print() {
    const w = window.open('', '_blank')
    w.document.write('<html><head><title>Nota de Remisión</title>')
    w.document.write('<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto}')
    w.document.write('table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}')
    w.document.write('th{background:#f5f5f5;font-weight:600}.right{text-align:right}.brand{font-size:22px;font-weight:700;letter-spacing:2px}')
    w.document.write('.sub{font-size:11px;color:#888;letter-spacing:1px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;font-size:13px}')
    w.document.write('.total-row td{font-weight:700;background:#fef8ec}.hr{border:none;border-top:1px solid #ddd;margin:12px 0}')
    w.document.write('</style></head><body>')
    w.document.write(ref.current.innerHTML)
    w.document.write('</body></html>')
    w.document.close()
    w.print()
  }

  const sub = items.reduce((a, i) => a + i.subtotal, 0)
  const iva = conIva ? sub * IVA_RATE : 0
  const total = sub + iva

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <span className="modal-title">Nota de Remisión</span>
          <div className="gap-8">
            <button className="btn btn-amber btn-sm" onClick={print}>🖨 Imprimir</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" ref={ref}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>KOROVKA</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>Productos Lácteos</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>NOTA DE REMISIÓN</div>
              <div style={{ fontFamily: 'monospace', color: '#1E3D2C', marginTop: 4 }}>#{venta.folio}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{venta.fecha}</div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '10px 0 14px' }} />
          <div style={{ fontSize: 13, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Cliente:</div>
            {cliente ? (
              <>
                <div>{cliente.nombre}</div>
                {cliente.rfc && <div style={{ color: '#888' }}>RFC: {cliente.rfc}</div>}
                {cliente.direccion && <div style={{ color: '#888' }}>{cliente.direccion}</div>}
              </>
            ) : (
              <div>Cliente particular{notas ? ` — ${notas}` : ''}</div>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.producto_nombre}</td>
                    <td style={{ textAlign: 'right' }}>{item.cantidad} {item.unidad}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.precio_unitario)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} style={{ textAlign: 'right' }}>Subtotal</td><td style={{ textAlign: 'right' }}>{fmt(sub)}</td></tr>
                {conIva && <tr><td colSpan={3} style={{ textAlign: 'right' }}>IVA (16%)</td><td style={{ textAlign: 'right' }}>{fmt(iva)}</td></tr>}
                <tr style={{ fontWeight: 700, background: '#fef8ec' }}>
                  <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {notas && <div style={{ marginTop: 14, fontSize: 13, color: '#666' }}><strong>Notas:</strong> {notas}</div>}
          <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, fontSize: 12, color: '#888' }}>
            <div style={{ borderTop: '1px solid #ddd', paddingTop: 8, textAlign: 'center' }}>Entregó</div>
            <div style={{ borderTop: '1px solid #ddd', paddingTop: 8, textAlign: 'center' }}>Recibió</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Ventas() {
  const { profile } = useAuth()
  const [ventas, setVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [puntos, setPuntos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    cliente_id: '',
    punto_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    notas: '',
    con_iva: true,
  })
  const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])

  async function load() {
    const [{ data: v }, { data: c }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(50),
      supabase.from('clientes').select('id, nombre, rfc, direccion').eq('activo', true).order('nombre'),
      supabase.from('puntos_distribucion').select('id, nombre, modelo').eq('activo', true).eq('modelo', 'directa').order('nombre'),
      supabase.from('productos').select('id, nombre, precio_base, unidad').eq('activo', true).order('nombre'),
    ])
    setVentas(v || [])
    setClientes(c || [])
    setPuntos(p || [])
    setProductos(pr || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function addItem() { setItems(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeItem(i) { setItems(it => it.filter((_, idx) => idx !== i)) }

  function updateItem(i, key, val) {
    setItems(it => {
      const next = [...it]
      next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') {
        const p = productos.find(p => p.id === val)
        if (p) next[i].precio_unitario = p.precio_base
      }
      return next
    })
  }

  const subtotal = items.reduce((a, it) => a + (Number(it.cantidad) * Number(it.precio_unitario || 0)), 0)
  const iva = form.con_iva ? subtotal * IVA_RATE : 0
  const total = subtotal + iva

  const esParticular = form.cliente_id === PARTICULAR

  async function save() {
    if (!form.cliente_id) { setErr('Selecciona un cliente o "Cliente particular".'); return }
    if (items.some(i => !i.producto_id || !i.cantidad || !i.precio_unitario)) { setErr('Completa todos los productos.'); return }
    setSaving(true)

    const clienteIdReal = esParticular ? null : form.cliente_id

    const { data: venta, error } = await supabase.from('ventas').insert({
      folio: folio('VD'),
      tipo: 'directa',
      cliente_id: clienteIdReal,
      punto_id: form.punto_id || null,
      fecha: form.fecha,
      subtotal,
      iva,
      total,
      notas: form.notas,
      creado_por: profile?.id,
    }).select().single()

    if (error) { setSaving(false); setErr(error.message); return }

    const ventaItems = items.map(i => ({
      venta_id: venta.id,
      producto_id: i.producto_id,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.cantidad) * Number(i.precio_unitario),
    }))
    await supabase.from('venta_items').insert(ventaItems)

    if (!esParticular) {
      await supabase.from('cuentas_por_cobrar').insert({
        venta_id: venta.id,
        cliente_id: clienteIdReal,
        monto_total: total,
        monto_pagado: 0,
      })
    }

    const movimientos = items.map(i => ({
      producto_id: i.producto_id,
      tipo: 'salida',
      cantidad: -Number(i.cantidad),
      concepto: 'Venta directa ' + venta.folio,
      referencia_id: venta.id,
      referencia_tipo: 'venta',
      creado_por: profile?.id,
    }))
    await supabase.from('movimientos_inventario').insert(movimientos)

    setSaving(false)
    setModal(false)
    setForm({ cliente_id: '', punto_id: '', fecha: new Date().toISOString().slice(0, 10), notas: '', con_iva: true })
    setItems([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
    load()
  }

  async function openPrint(v) {
    const { data: vitems } = await supabase.from('venta_items').select('*, productos(nombre, unidad)').eq('venta_id', v.id)
    let cliente = null
    if (v.cliente_id) {
      const { data } = await supabase.from('clientes').select('*').eq('id', v.cliente_id).single()
      cliente = data
    }
    const mappedItems = (vitems || []).map(i => ({
      producto_nombre: i.productos?.nombre,
      unidad: i.productos?.unidad,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    }))
    setPrintData({ venta: v, items: mappedItems, cliente, notas: v.notas, conIva: v.iva > 0 })
  }

  const estadoBadge = e => ({
    pendiente: <span className="badge b-amber">Pendiente</span>,
    pagada: <span className="badge b-ok">Pagada</span>,
    cancelada: <span className="badge b-red">Cancelada</span>,
  }[e] || <span className="badge b-neu">{e}</span>)

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Ventas</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Nueva venta</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="txt-right">Subtotal</th>
                <th className="txt-right">IVA</th>
                <th className="txt-right">Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 && <tr><td colSpan={8} className="empty">Sin ventas</td></tr>}
              {ventas.map(v => (
                <tr key={v.id}>
                  <td className="mono">{v.folio}</td>
                  <td>{v.clientes?.nombre || <span style={{ color: 'var(--txt3)', fontSize: 12 }}>Cliente particular</span>}</td>
                  <td>{v.fecha}</td>
                  <td className="txt-right mono">{fmt(v.subtotal)}</td>
                  <td className="txt-right mono">{fmt(v.iva)}</td>
                  <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(v.total)}</td>
                  <td>{estadoBadge(v.estado)}</td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openPrint(v)}>🖨 Remisión</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <span className="modal-title">Nueva venta directa</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cliente *</label>
                  <select className="form-select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    <option value={PARTICULAR}>— Cliente particular —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {esParticular ? 'Nombre del comprador / Notas' : 'Notas'}
                </label>
                <input
                  className="form-input"
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder={esParticular ? 'Ej: Juan García' : 'Opcional'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Punto de distribución</label>
                <select className="form-select" value={form.punto_id} onChange={e => setForm(f => ({ ...f, punto_id: e.target.value }))}>
                  <option value="">— Sin punto específico —</option>
                  {puntos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, marginTop: 4 }}>Productos</div>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div>
                    {i === 0 && <label className="form-label">Producto</label>}
                    <select className="form-select" value={item.producto_id} onChange={e => updateItem(i, 'producto_id', e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Cantidad</label>}
                    <input type="number" className="form-input" value={item.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)} min="0" step="0.001" />
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Precio</label>}
                    <input type="number" className="form-input" value={item.precio_unitario} onChange={e => updateItem(i, 'precio_unitario', e.target.value)} min="0" step="0.01" />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 14 }}>+ Agregar producto</button>

              <div style={{ background: 'var(--forest-s)', borderRadius: 'var(--r2)', padding: '12px 14px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--txt2)' }}>Subtotal</span>
                  <span className="mono">{fmt(subtotal)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, con_iva: !f.con_iva }))}
                      style={{
                        width: 36, height: 20,
                        borderRadius: 10,
                        border: 'none',
                        background: form.con_iva ? 'var(--forest)' : 'var(--bdr2)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background .15s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2, left: form.con_iva ? 18 : 2,
                        width: 16, height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left .15s',
                      }} />
                    </button>
                    <span style={{ color: form.con_iva ? 'var(--txt)' : 'var(--txt3)' }}>
                      IVA (16%)
                    </span>
                  </div>
                  <span className="mono" style={{ color: form.con_iva ? 'var(--txt)' : 'var(--txt3)' }}>
                    {fmt(iva)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--bdr)', paddingTop: 8, color: 'var(--forest)' }}>
                  <span>Total</span>
                  <span className="mono">{fmt(total)}</span>
                </div>
              </div>

              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Registrar venta'}</button>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintRemision
          venta={printData.venta}
          items={printData.items}
          cliente={printData.cliente}
          notas={printData.notas}
          conIva={printData.conIva}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  )
}
