import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export default function Inventario() {
  const { profile } = useAuth()
  const [stock, setStock] = useState([])
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')
  const [modal, setModal] = useState(false)
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({ producto_id: '', tipo: 'entrada', cantidad: '', concepto: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const [{ data: prods }, { data: movimientos }] = await Promise.all([
      supabase.from('productos').select('id, sku, nombre, unidad').eq('activo', true).order('nombre'),
      supabase.from('movimientos_inventario').select('*, productos(nombre, unidad)').order('created_at', { ascending: false }).limit(50),
    ])

    setProductos(prods || [])

    const stockMap = {}
    ;(prods || []).forEach(p => { stockMap[p.id] = { ...p, cantidad: 0 } })

    const { data: allMovs } = await supabase
      .from('movimientos_inventario')
      .select('producto_id, cantidad')

    ;(allMovs || []).forEach(m => {
      if (stockMap[m.producto_id]) stockMap[m.producto_id].cantidad += Number(m.cantidad)
    })

    setStock(Object.values(stockMap))
    setMovs(movimientos || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveAjuste() {
    if (!form.producto_id || !form.cantidad || !form.concepto) {
      setErr('Todos los campos son requeridos.')
      return
    }
    setSaving(true)
    const cantidad = form.tipo === 'salida' ? -Math.abs(Number(form.cantidad)) : Math.abs(Number(form.cantidad))
    const { error } = await supabase.from('movimientos_inventario').insert({
      producto_id: form.producto_id,
      tipo: form.tipo,
      cantidad,
      concepto: form.concepto,
      referencia_tipo: 'ajuste',
      creado_por: profile?.id,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModal(false)
    setForm({ producto_id: '', tipo: 'entrada', cantidad: '', concepto: '' })
    load()
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Inventario</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Ajuste manual</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['stock', 'movimientos'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={'btn ' + (tab === t ? 'btn-amber' : 'btn-ghost')}
          >
            {t === 'stock' ? 'Stock actual' : 'Movimientos'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th className="txt-right">Existencia</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(p => (
                  <tr key={p.id}>
                    <td className="mono">{p.sku}</td>
                    <td>{p.nombre}</td>
                    <td className="txt-right mono" style={{ fontWeight: 600, fontSize: 15 }}>{fmt(p.cantidad)}</td>
                    <td>{p.unidad}</td>
                    <td>
                      {p.cantidad <= 0
                        ? <span className="badge b-red">Agotado</span>
                        : p.cantidad < 5
                          ? <span className="badge b-amber">Stock bajo</span>
                          : <span className="badge b-ok">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="txt-right">Cantidad</th>
                  <th>Concepto</th>
                </tr>
              </thead>
              <tbody>
                {movs.length === 0 && <tr><td colSpan={5} className="empty">Sin movimientos</td></tr>}
                {movs.map(m => (
                  <tr key={m.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleString('es-MX')}</td>
                    <td>{m.productos?.nombre}</td>
                    <td>
                      {m.tipo === 'entrada' && <span className="badge b-ok">Entrada</span>}
                      {m.tipo === 'salida' && <span className="badge b-red">Salida</span>}
                      {m.tipo === 'ajuste' && <span className="badge b-neu">Ajuste</span>}
                    </td>
                    <td className="txt-right mono" style={{ color: Number(m.cantidad) >= 0 ? 'var(--ok)' : 'var(--red)', fontWeight: 600 }}>
                      {Number(m.cantidad) >= 0 ? '+' : ''}{fmt(m.cantidad)} {m.productos?.unidad}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--txt2)' }}>{m.concepto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">Ajuste de inventario</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Producto *</label>
                <select className="form-select" value={form.producto_id} onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))}>
                  <option value="">Seleccionar…</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input type="number" className="form-input" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} step="0.001" min="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Concepto / Motivo *</label>
                <input className="form-input" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Producción del día, merma, devolución…" />
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={saveAjuste} disabled={saving}>{saving ? 'Guardando…' : 'Guardar ajuste'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
