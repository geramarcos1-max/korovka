import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const IVA_RATE = 0.16
const PARTICULAR = '__particular__'
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }
function folio(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() }

function SortTh({ col, label, sort, onSort, className }) {
  const active = sort.col === col
  return (
    <th
      className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
        {active && sort.dir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  )
}

function PrintRemision({ venta, items, cliente, notas, conIva, onClose }) {
  const ref = useRef()
  function print() {
    const w = window.open('', '_blank')
    w.document.write('<html><head><title>Nota de Remisión</title>')
    w.document.write('<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto}')
    w.document.write('table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}')
    w.document.write('th{background:#f5f5f5;font-weight:600}.right{text-align:right}')
    w.document.write('.total-row td{font-weight:700;background:#fef8ec}')
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
  const [editModal, setEditModal] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Filtros y orden
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPago, setFiltroPago] = useState('')
  const [sort, setSort] = useState({ col: 'fecha', dir: 'desc' })

  function handleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const emptyForm = { cliente_id: '', punto_id: '', fecha: new Date().toISOString().slice(0, 10), notas: '', con_iva: true, estado: 'pendiente', metodo_pago: 'efectivo' }
  const [form, setForm] = useState(emptyForm)
  const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
  const [editForm, setEditForm] = useState(emptyForm)
  const [editItems, setEditItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
  const [editingVenta, setEditingVenta] = useState(null)
  const [errEdit, setErrEdit] = useState('')

  async function load() {
    const [{ data: v }, { data: c }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre)').order('created_at', { ascending: false }).limit(200),
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

  // Filtrado + ordenamiento
  const ventasFiltradas = useMemo(() => {
    let rows = [...ventas]

    if (busqueda) {
      const q = busqueda.toLowerCase()
      rows = rows.filter(v =>
        (v.clientes?.nombre || 'cliente particular').toLowerCase().includes(q) ||
        (v.notas || '').toLowerCase().includes(q) ||
        (v.folio || '').toLowerCase().includes(q)
      )
    }
    if (filtroEstado) rows = rows.filter(v => v.estado === filtroEstado)
    if (filtroPago) rows = rows.filter(v => (v.metodo_pago || 'efectivo') === filtroPago)

    rows.sort((a, b) => {
      let va, vb
      switch (sort.col) {
        case 'cliente': va = (a.clientes?.nombre || 'zz').toLowerCase(); vb = (b.clientes?.nombre || 'zz').toLowerCase(); break
        case 'fecha':   va = a.fecha; vb = b.fecha; break
        case 'subtotal':va = a.subtotal; vb = b.subtotal; break
        case 'total':   va = a.total; vb = b.total; break
        case 'estado':  va = a.estado; vb = b.estado; break
        case 'pago':    va = a.metodo_pago || ''; vb = b.metodo_pago || ''; break
        default:        va = a.fecha; vb = b.fecha
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [ventas, busqueda, filtroEstado, filtroPago, sort])

  function addItem() { setItems(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeItem(i) { setItems(it => it.filter((_, idx) => idx !== i)) }
  function updateItem(i, key, val) {
    setItems(it => {
      const next = [...it]
      next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') { const p = productos.find(p => p.id === val); if (p) next[i].precio_unitario = p.precio_base }
      return next
    })
  }

  function addEditItem() { setEditItems(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeEditItem(i) { setEditItems(it => it.filter((_, idx) => idx !== i)) }
  function updateEditItem(i, key, val) {
    setEditItems(it => {
      const next = [...it]
      next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') { const p = productos.find(p => p.id === val); if (p) next[i].precio_unitario = p.precio_base }
      return next
    })
  }

  const subtotal = items.reduce((a, it) => a + (Number(it.cantidad) * Number(it.precio_unitario || 0)), 0)
  const iva = form.con_iva ? subtotal * IVA_RATE : 0
  const total = subtotal + iva
  const esParticular = form.cliente_id === PARTICULAR

  const subtotalE = editItems.reduce((a, it) => a + (Number(it.cantidad) * Number(it.precio_unitario || 0)), 0)
  const ivaE = editForm.con_iva ? subtotalE * IVA_RATE : 0
  const totalE = subtotalE + ivaE
  const esParticularE = editForm.cliente_id === PARTICULAR

  async function openEdit(v) {
    const { data: vitems } = await supabase.from('venta_items').select('*').eq('venta_id', v.id)
    setEditingVenta(v)
    setEditForm({
      cliente_id: v.cliente_id || PARTICULAR,
      punto_id: v.punto_id || '',
      fecha: v.fecha,
      notas: v.notas || '',
      con_iva: v.iva > 0,
      estado: v.estado,
      metodo_pago: v.metodo_pago || 'efectivo',
    })
    setEditItems((vitems || []).map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })))
    setErrEdit('')
    setEditModal(true)
  }

  async function saveEdit() {
    if (!editForm.cliente_id) { setErrEdit('Selecciona un cliente.'); return }
    if (editItems.some(i => !i.producto_id || !i.cantidad || !i.precio_unitario)) { setErrEdit('Completa todos los productos.'); return }
    setSaving(true)
    const clienteIdReal = esParticularE ? null : editForm.cliente_id
    await supabase.from('ventas').update({ cliente_id: clienteIdReal, punto_id: editForm.punto_id || null, fecha: editForm.fecha, notas: editForm.notas, subtotal: subtotalE, iva: ivaE, total: totalE, estado: editForm.estado, metodo_pago: editForm.metodo_pago }).eq('id', editingVenta.id)
    await supabase.from('venta_items').delete().eq('venta_id', editingVenta.id)
    await supabase.from('venta_items').insert(editItems.map(i => ({ venta_id: editingVenta.id, producto_id: i.producto_id, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), subtotal: Number(i.cantidad) * Number(i.precio_unitario) })))
    await supabase.from('movimientos_inventario').delete().eq('referencia_id', editingVenta.id).eq('referencia_tipo', 'venta')
    await supabase.from('movimientos_inventario').insert(editItems.map(i => ({ producto_id: i.producto_id, tipo: 'salida', cantidad: -Number(i.cantidad), concepto: 'Venta directa ' + editingVenta.folio, referencia_id: editingVenta.id, referencia_tipo: 'venta', creado_por: profile?.id })))
    if (!esParticularE && clienteIdReal) {
      const { data: cxc } = await supabase.from('cuentas_por_cobrar').select('id').eq('venta_id', editingVenta.id).single()
      if (cxc) { await supabase.from('cuentas_por_cobrar').update({ cliente_id: clienteIdReal, monto_total: totalE, monto_pagado: editForm.estado === 'pagada' ? totalE : 0, estado: editForm.estado === 'pagada' ? 'pagada' : 'pendiente' }).eq('venta_id', editingVenta.id) }
      else { await supabase.from('cuentas_por_cobrar').insert({ venta_id: editingVenta.id, cliente_id: clienteIdReal, monto_total: totalE, monto_pagado: editForm.estado === 'pagada' ? totalE : 0, estado: editForm.estado === 'pagada' ? 'pagada' : 'pendiente' }) }
    }
    setSaving(false)
    setEditModal(false)
    load()
  }

  async function save() {
    if (!form.cliente_id) { setErr('Selecciona un cliente o "Cliente particular".'); return }
    if (items.some(i => !i.producto_id || !i.cantidad || !i.precio_unitario)) { setErr('Completa todos los productos.'); return }
    setSaving(true)
    const clienteIdReal = esParticular ? null : form.cliente_id
    const { data: venta, error } = await supabase.from('ventas').insert({ folio: folio('VD'), tipo: 'directa', cliente_id: clienteIdReal, punto_id: form.punto_id || null, fecha: form.fecha, subtotal, iva, total, notas: form.notas, estado: form.estado, metodo_pago: form.metodo_pago, creado_por: profile?.id }).select().single()
    if (error) { setSaving(false); setErr(error.message); return }
    await supabase.from('venta_items').insert(items.map(i => ({ venta_id: venta.id, producto_id: i.producto_id, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), subtotal: Number(i.cantidad) * Number(i.precio_unitario) })))
    if (!esParticular) { await supabase.from('cuentas_por_cobrar').insert({ venta_id: venta.id, cliente_id: clienteIdReal, monto_total: total, monto_pagado: form.estado === 'pagada' ? total : 0, estado: form.estado === 'pagada' ? 'pagada' : 'pendiente' }) }
    await supabase.from('movimientos_inventario').insert(items.map(i => ({ producto_id: i.producto_id, tipo: 'salida', cantidad: -Number(i.cantidad), concepto: 'Venta directa ' + venta.folio, referencia_id: venta.id, referencia_tipo: 'venta', creado_por: profile?.id })))
    setSaving(false); setModal(false); setForm(emptyForm); setItems([{ producto_id: '', cantidad: 1, precio_unitario: '' }]); load()
  }

  async function toggleEstado(v) {
    const nuevoEstado = v.estado === 'pagada' ? 'pendiente' : 'pagada'
    await supabase.from('ventas').update({ estado: nuevoEstado }).eq('id', v.id)
    if (v.cliente_id) { await supabase.from('cuentas_por_cobrar').update({ estado: nuevoEstado, monto_pagado: nuevoEstado === 'pagada' ? v.total : 0 }).eq('venta_id', v.id) }
    load()
  }

  async function eliminar(v) {
    if (!window.confirm(`¿Eliminar la venta ${v.folio}?\n\nEsta acción no se puede deshacer.`)) return
    await supabase.from('cuentas_por_cobrar').delete().eq('venta_id', v.id)
    await supabase.from('movimientos_inventario').delete().eq('referencia_id', v.id).eq('referencia_tipo', 'venta')
    await supabase.from('venta_items').delete().eq('venta_id', v.id)
    await supabase.from('ventas').delete().eq('id', v.id)
    load()
  }

  async function openPrint(v) {
    const { data: vitems } = await supabase.from('venta_items').select('*, productos(nombre, unidad)').eq('venta_id', v.id)
    let cliente = null
    if (v.cliente_id) { const { data } = await supabase.from('clientes').select('*').eq('id', v.cliente_id).single(); cliente = data }
    setPrintData({ venta: v, items: (vitems || []).map(i => ({ producto_nombre: i.productos?.nombre, unidad: i.productos?.unidad, cantidad: i.cantidad, precio_unitario: i.precio_unitario, subtotal: i.subtotal })), cliente, notas: v.notas, conIva: v.iva > 0 })
  }

  function ProductosForm({ its, onAdd, onRemove, onUpd }) {
    return <>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, marginTop: 4 }}>Productos</div>
      {its.map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <div>
            {i === 0 && <label className="form-label">Producto</label>}
            <select className="form-select" value={item.producto_id} onChange={e => onUpd(i, 'producto_id', e.target.value)}>
              <option value="">Seleccionar…</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            {i === 0 && <label className="form-label">Cantidad</label>}
            <input type="number" className="form-input" value={item.cantidad} onChange={e => onUpd(i, 'cantidad', e.target.value)} min="0" step="0.001" />
          </div>
          <div>
            {i === 0 && <label className="form-label">Precio</label>}
            <input type="number" className="form-input" value={item.precio_unitario} onChange={e => onUpd(i, 'precio_unitario', e.target.value)} min="0" step="0.01" />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onRemove(i)}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={onAdd} style={{ marginBottom: 14 }}>+ Agregar producto</button>
    </>
  }

  function IVAResumen({ sub, iv, tot, conIva, onToggle }) {
    return (
      <div style={{ background: 'var(--forest-s)', borderRadius: 'var(--r2)', padding: '12px 14px', fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--txt2)' }}>Subtotal</span><span className="mono">{fmt(sub)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: conIva ? 'var(--forest)' : 'var(--bdr2)', cursor: 'pointer', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: conIva ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
            <span style={{ color: conIva ? 'var(--txt)' : 'var(--txt3)' }}>IVA (16%)</span>
          </div>
          <span className="mono" style={{ color: conIva ? 'var(--txt)' : 'var(--txt3)' }}>{fmt(iv)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--bdr)', paddingTop: 8, color: 'var(--forest)' }}>
          <span>Total</span><span className="mono">{fmt(tot)}</span>
        </div>
      </div>
    )
  }

  function ModalCampos({ f, setF, esP }) {
    return <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cliente *</label>
          <select className="form-select" value={f.cliente_id} onChange={e => setF(x => ({ ...x, cliente_id: e.target.value }))}>
            <option value="">Seleccionar…</option>
            <option value={PARTICULAR}>— Cliente particular —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Fecha</label>
          <input type="date" className="form-input" value={f.fecha} onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{esP ? 'Nombre del comprador / Notas' : 'Notas'}</label>
        <input className="form-input" value={f.notas} onChange={e => setF(x => ({ ...x, notas: e.target.value }))} placeholder={esP ? 'Ej: Juan García' : 'Opcional'} />
      </div>
      <div className="form-group">
        <label className="form-label">Punto de distribución</label>
        <select className="form-select" value={f.punto_id} onChange={e => setF(x => ({ ...x, punto_id: e.target.value }))}>
          <option value="">— Sin punto específico —</option>
          {puntos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
    </>
  }

  function PagoEstado({ f, setF }) {
    return (
      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Método de pago</label>
          <select className="form-select" value={f.metodo_pago} onChange={e => setF(x => ({ ...x, metodo_pago: e.target.value }))}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Estado</label>
          <select className="form-select" value={f.estado} onChange={e => setF(x => ({ ...x, estado: e.target.value }))}>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
          </select>
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Ventas</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Nueva venta</button>
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 220 }}
          placeholder="Buscar cliente, folio, notas…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="form-select" style={{ maxWidth: 150 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
        </select>
        <select className="form-select" style={{ maxWidth: 170 }} value={filtroPago} onChange={e => setFiltroPago(e.target.value)}>
          <option value="">Todos los pagos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
        {(busqueda || filtroEstado || filtroPago) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroPago('') }}>
            Limpiar filtros
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)' }}>
          {ventasFiltradas.length} {ventasFiltradas.length === 1 ? 'venta' : 'ventas'}
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <SortTh col="cliente" label="Cliente" sort={sort} onSort={handleSort} />
                <th>Notas</th>
                <SortTh col="fecha" label="Fecha" sort={sort} onSort={handleSort} />
                <SortTh col="subtotal" label="Subtotal" sort={sort} onSort={handleSort} className="txt-right" />
                <th className="txt-right">IVA</th>
                <SortTh col="total" label="Total" sort={sort} onSort={handleSort} className="txt-right" />
                <SortTh col="pago" label="Pago" sort={sort} onSort={handleSort} />
                <SortTh col="estado" label="Estado" sort={sort} onSort={handleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.length === 0 && <tr><td colSpan={10} className="empty">Sin ventas</td></tr>}
              {ventasFiltradas.map(v => (
                <tr key={v.id}>
                  <td className="mono">{v.folio}</td>
                  <td>{v.clientes?.nombre || <span style={{ color: 'var(--txt3)', fontSize: 12 }}>Cliente particular</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--txt2)', maxWidth: 180 }}>{v.notas || <span style={{ color: 'var(--txt3)' }}>—</span>}</td>
                  <td>{v.fecha}</td>
                  <td className="txt-right mono">{fmt(v.subtotal)}</td>
                  <td className="txt-right mono">{fmt(v.iva)}</td>
                  <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(v.total)}</td>
                  <td>
                    {v.metodo_pago === 'transferencia'
                      ? <span className="badge b-info">Transferencia</span>
                      : <span className="badge b-neu">Efectivo</span>}
                  </td>
                  <td>
                    <button onClick={() => toggleEstado(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', transition: 'background .15s', background: v.estado === 'pagada' ? 'var(--ok-s)' : 'var(--amber-s)', color: v.estado === 'pagada' ? 'var(--ok-t)' : 'var(--amber-t)' }} title="Clic para cambiar estado">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: v.estado === 'pagada' ? 'var(--ok)' : 'var(--amber)' }} />
                      {v.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </button>
                  </td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openPrint(v)}>🖨 Remisión</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Editar</button>
                      <button className="btn btn-red btn-sm" onClick={() => eliminar(v)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva venta */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <span className="modal-title">Nueva venta directa</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <ModalCampos f={form} setF={setForm} esP={esParticular} />
              <ProductosForm its={items} onAdd={addItem} onRemove={removeItem} onUpd={updateItem} />
              <IVAResumen sub={subtotal} iv={iva} tot={total} conIva={form.con_iva} onToggle={() => setForm(f => ({ ...f, con_iva: !f.con_iva }))} />
              <PagoEstado f={form} setF={setForm} />
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Registrar venta'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar venta */}
      {editModal && editingVenta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <span className="modal-title">Editar venta — {editingVenta.folio}</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <ModalCampos f={editForm} setF={setEditForm} esP={esParticularE} />
              <ProductosForm its={editItems} onAdd={addEditItem} onRemove={removeEditItem} onUpd={updateEditItem} />
              <IVAResumen sub={subtotalE} iv={ivaE} tot={totalE} conIva={editForm.con_iva} onToggle={() => setEditForm(f => ({ ...f, con_iva: !f.con_iva }))} />
              <PagoEstado f={editForm} setF={setEditForm} />
              {errEdit && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{errEdit}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintRemision venta={printData.venta} items={printData.items} cliente={printData.cliente} notas={printData.notas} conIva={printData.conIva} onClose={() => setPrintData(null)} />
      )}
    </div>
  )
}
