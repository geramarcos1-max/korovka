import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function folio() { return 'ODC-' + Date.now().toString(36).toUpperCase() }
function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) }

const ESTADOS = {
  pendiente: { label: 'Pendiente',      bg: 'var(--amber-s)', color: 'var(--amber-t)' },
  enviado:   { label: 'Enviado',        bg: 'var(--info-s)',  color: 'var(--info-t)'  },
  recibido:  { label: 'Recibido en MTY', bg: 'var(--ok-s)',   color: 'var(--ok-t)'   },
}

function EstadoBadge({ estado }) {
  const m = ESTADOS[estado] || ESTADOS.pendiente
  return (
    <span style={{ background: m.bg, color: m.color, borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function PrintOdc({ odc, items, onClose }) {
  const ref = useRef()
  function print() {
    const w = window.open('', '_blank')
    w.document.write('<html><head><title>ODC ' + odc.folio + '</title>')
    w.document.write('<style>body{font-family:sans-serif;padding:24px;max-width:640px;margin:0 auto;color:#111}')
    w.document.write('table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px 10px;font-size:13px}')
    w.document.write('th{background:#f5f5f5;font-weight:600;text-align:left}.right{text-align:right}')
    w.document.write('h1{font-size:22px;margin:0}h2{font-size:13px;color:#888;font-weight:400;margin:4px 0 0}')
    w.document.write('.meta{display:flex;justify-content:space-between;margin-bottom:20px}')
    w.document.write('.block{background:#f9f9f9;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px}')
    w.document.write('</style></head><body>')
    w.document.write(ref.current.innerHTML)
    w.document.write('</body></html>')
    w.document.close()
    w.print()
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-head">
          <span className="modal-title">Vista previa — {odc.folio}</span>
          <div className="gap-8">
            <button className="btn btn-amber btn-sm" onClick={print}>⬇ Descargar / Imprimir</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" ref={ref}>
          <div className="meta">
            <div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>KOROVKA</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>Productos Lácteos</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>ORDEN DE COMPRA INTERNA</div>
              <div style={{ fontFamily: 'monospace', color: '#1E3D2C', marginTop: 4, fontSize: 15 }}>#{odc.folio}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{odc.fecha}</div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '10px 0 16px' }} />
          {odc.notas && (
            <div className="block">
              <strong>Notas:</strong> {odc.notas}
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th>Notas / Especificaciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ color: '#888', width: 32 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{it.productos?.nombre || it.nombre}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(it.cantidad)} {it.productos?.unidad || ''}</td>
                    <td style={{ color: '#666', fontSize: 12 }}>{it.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, fontSize: 12, color: '#888' }}>
            <div style={{ borderTop: '1px solid #ddd', paddingTop: 8, textAlign: 'center' }}>Solicitado por</div>
            <div style={{ borderTop: '1px solid #ddd', paddingTop: 8, textAlign: 'center' }}>Recibido por — Fernando</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OdcInterna() {
  const { profile } = useAuth()
  const [odcs, setOdcs] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const emptyItem = { producto_id: '', cantidad: '', notas: '' }
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), notas: '' })
  const [items, setItems] = useState([{ ...emptyItem }])

  async function load() {
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase.from('odc_internas')
        .select('*, odc_interna_items(*, productos(nombre, unidad))')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('productos').select('id, nombre, unidad').eq('activo', true).order('nombre'),
    ])
    setOdcs(o || [])
    setProductos(p || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const odcsFiltradas = useMemo(() => {
    if (!filtroEstado) return odcs
    return odcs.filter(o => o.estado === filtroEstado)
  }, [odcs, filtroEstado])

  function addItem() { setItems(it => [...it, { ...emptyItem }]) }
  function removeItem(i) { setItems(it => it.filter((_, idx) => idx !== i)) }
  function updateItem(i, key, val) {
    setItems(it => { const n = [...it]; n[i] = { ...n[i], [key]: val }; return n })
  }

  async function save() {
    if (items.some(i => !i.producto_id || !i.cantidad)) {
      setErr('Completa producto y cantidad en todos los renglones.')
      return
    }
    setSaving(true)
    const { data: odc, error } = await supabase.from('odc_internas').insert({
      folio: folio(),
      fecha: form.fecha,
      notas: form.notas || null,
      estado: 'pendiente',
      creado_por: profile?.id,
    }).select().single()
    if (error) { setSaving(false); setErr(error.message); return }

    await supabase.from('odc_interna_items').insert(
      items.map(i => ({
        odc_id: odc.id,
        producto_id: i.producto_id,
        cantidad: Number(i.cantidad),
        notas: i.notas || null,
      }))
    )
    setSaving(false)
    setModal(false)
    setForm({ fecha: new Date().toISOString().slice(0, 10), notas: '' })
    setItems([{ ...emptyItem }])
    load()
  }

  async function marcarEnviado(odc) {
    if (!window.confirm(`¿Confirmar que la ODC ${odc.folio} fue enviada?`)) return
    await supabase.from('odc_internas').update({
      estado: 'enviado',
      fecha_enviado: new Date().toISOString().slice(0, 10),
      enviado_por: profile?.id,
    }).eq('id', odc.id)
    load()
  }

  async function marcarRecibido(odc) {
    if (!window.confirm(`¿Confirmar que la ODC ${odc.folio} fue recibida en MTY?`)) return
    await supabase.from('odc_internas').update({
      estado: 'recibido',
      fecha_recibido: new Date().toISOString().slice(0, 10),
      recibido_por: profile?.id,
    }).eq('id', odc.id)
    load()
  }

  async function eliminar(odc) {
    if (!window.confirm(`¿Eliminar la ODC ${odc.folio}? Esta acción no se puede deshacer.`)) return
    await supabase.from('odc_interna_items').delete().eq('odc_id', odc.id)
    await supabase.from('odc_internas').delete().eq('id', odc.id)
    load()
  }

  async function openPrint(odc) {
    const { data: its } = await supabase
      .from('odc_interna_items')
      .select('*, productos(nombre, unidad)')
      .eq('odc_id', odc.id)
    setPrintData({ odc, items: its || [] })
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>ODC Interna</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Nueva ODC</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ maxWidth: 180 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="enviado">Enviado</option>
          <option value="recibido">Recibido en MTY</option>
        </select>
        {filtroEstado && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFiltroEstado('')}>Limpiar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)' }}>
          {odcsFiltradas.length} {odcsFiltradas.length === 1 ? 'orden' : 'órdenes'}
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Productos</th>
                <th>Notas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {odcsFiltradas.length === 0 && <tr><td colSpan={6} className="empty">Sin órdenes</td></tr>}
              {odcsFiltradas.map(o => (
                <tr key={o.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{o.folio}</td>
                  <td>{o.fecha}</td>
                  <td style={{ fontSize: 12 }}>
                    {(o.odc_interna_items || []).length === 0
                      ? <span style={{ color: 'var(--txt3)' }}>—</span>
                      : (o.odc_interna_items || []).map((it, i) => (
                          <span key={i} style={{ display: 'inline-block', background: 'var(--forest-s)', borderRadius: 4, padding: '1px 6px', marginRight: 4, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {it.productos?.nombre} ×{fmtNum(it.cantidad)}
                          </span>
                        ))
                    }
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--txt2)', maxWidth: 160 }}>{o.notas || <span style={{ color: 'var(--txt3)' }}>—</span>}</td>
                  <td><EstadoBadge estado={o.estado} /></td>
                  <td>
                    <div className="gap-8" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openPrint(o)}>⬇ PDF</button>
                      {o.estado === 'pendiente' && (
                        <button className="btn btn-sm" style={{ background: 'var(--info-s)', color: 'var(--info-t)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => marcarEnviado(o)}>
                          Marcar enviado
                        </button>
                      )}
                      {o.estado === 'enviado' && (
                        <button className="btn btn-sm" style={{ background: 'var(--ok-s)', color: 'var(--ok-t)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => marcarRecibido(o)}>
                          Recibido en MTY
                        </button>
                      )}
                      {o.estado === 'pendiente' && (
                        <button className="btn btn-red btn-sm" onClick={() => eliminar(o)}>Eliminar</button>
                      )}
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
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-head">
              <span className="modal-title">Nueva ODC Interna</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas generales</label>
                <input className="form-input" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej: Urgente, para la semana del 23…" />
              </div>

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, marginTop: 4 }}>Productos requeridos</div>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div>
                    {i === 0 && <label className="form-label">Producto</label>}
                    <select className="form-select" value={item.producto_id} onChange={e => updateItem(i, 'producto_id', e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Cantidad</label>}
                    <input type="number" className="form-input" value={item.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)} min="0" step="1" placeholder="0" />
                  </div>
                  <div>
                    {i === 0 && <label className="form-label">Notas</label>}
                    <input className="form-input" value={item.notas} onChange={e => updateItem(i, 'notas', e.target.value)} placeholder="Opcional" />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} style={{ marginTop: i === 0 ? 18 : 0 }}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 14 }}>+ Agregar producto</button>
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Crear ODC'}</button>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintOdc odc={printData.odc} items={printData.items} onClose={() => setPrintData(null)} />
      )}
    </div>
  )
}
