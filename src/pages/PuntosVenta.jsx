import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const fmt = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const today = () => new Date().toISOString().slice(0, 10)
const addDays = (d, n) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10) }
const folio = () => 'PV-' + Date.now().toString(36).toUpperCase()

export default function PuntosVenta() {
  const [tab, setTab] = useState('entregas')
  const [clientes, setClientes] = useState([])
  const [entregas, setEntregas] = useState([])
  const [devoluciones, setDevoluciones] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modals
  const [entregaModal, setEntregaModal] = useState(null)
  const [cobroModal, setCobroModal] = useState(null)
  const [devModal, setDevModal] = useState(null)
  const [clienteModal, setClienteModal] = useState(null)

  async function load() {
    setLoading(true)
    const [
      { data: cl },
      { data: en },
      { data: dv },
      { data: pr },
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('tipo', 'institucional').eq('activo', true).order('nombre'),
      supabase.from('pv_entregas').select(`
        *,
        cliente:clientes(nombre),
        pv_entrega_items(*, producto:productos(nombre, sku)),
        pv_cobros(*)
      `).order('created_at', { ascending: false }),
      supabase.from('pv_devoluciones').select(`
        *,
        entrega:pv_entregas(folio, cliente_id, cliente:clientes(nombre)),
        pv_devolucion_items(*, producto:productos(nombre, sku))
      `).order('created_at', { ascending: false }),
      supabase.from('productos').select('id, nombre, sku, precio_base').eq('activo', true).order('nombre'),
    ])
    setClientes(cl || [])
    setEntregas(en || [])
    setDevoluciones(dv || [])
    setProductos(pr || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const entregasConEstado = useMemo(() => entregas.map(e => {
    const cobrado = (e.pv_cobros || []).reduce((s, c) => s + Number(c.monto), 0)
    const pendiente = Number(e.total) - cobrado
    const esVencida = e.estado === 'pendiente' && e.fecha_pago_programada && e.fecha_pago_programada < today()
    return { ...e, cobrado, pendiente, esVencida }
  }), [entregas])

  const devPendientes = useMemo(() => devoluciones.filter(d => !d.reposicion_completada), [devoluciones])

  // KPIs
  const kpi = useMemo(() => {
    const facturado = entregasConEstado.reduce((s, e) => s + Number(e.total), 0)
    const cobrado = entregasConEstado.reduce((s, e) => s + e.cobrado, 0)
    return { facturado, cobrado, porCobrar: facturado - cobrado, repoPendientes: devPendientes.length }
  }, [entregasConEstado, devPendientes])

  // ─── SAVE ENTREGA ──────────────────────────────────────────
  async function saveEntrega(f) {
    setSaving(true)
    setError('')
    try {
      let oc_url = null
      if (f.ocFile) {
        const ext = f.ocFile.name.split('.').pop()
        const path = `${f.folio}.${ext}`
        await supabase.storage.from('ordenes-compra').upload(path, f.ocFile, { upsert: true })
        const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(path)
        oc_url = urlData.publicUrl
      }
      const subtotal = f.items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0)
      const iva = f.conIva ? subtotal * 0.16 : 0
      const retencion = f.conRetencion ? Number(f.retencion || 0) : 0
      const total = subtotal + iva - retencion
      const { data: ent, error: e1 } = await supabase.from('pv_entregas').insert({
        folio: f.folio,
        cliente_id: f.cliente_id,
        fecha: f.fecha,
        fecha_pago_programada: addDays(f.fecha, 30),
        subtotal,
        iva,
        retencion,
        total,
        oc_url,
        notas: f.notas || null,
        estado: 'pendiente',
      }).select().single()
      if (e1) throw e1
      await supabase.from('pv_entrega_items').insert(
        f.items.map(i => ({
          entrega_id: ent.id,
          producto_id: i.producto_id,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
          subtotal: Number(i.cantidad) * Number(i.precio_unitario),
        }))
      )
      // Salida de inventario
      await supabase.from('movimientos_inventario').insert(
        f.items.map(i => ({
          producto_id: i.producto_id,
          tipo: 'salida',
          cantidad: Number(i.cantidad),
          concepto: `Entrega institucional ${ent.folio}`,
          referencia_id: ent.id,
          referencia_tipo: 'pv_entrega',
        }))
      )
      setEntregaModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  // ─── UPDATE ENTREGA ────────────────────────────────────────
  async function updateEntrega(f) {
    setSaving(true)
    setError('')
    try {
      let oc_url = f.oc_url || null
      if (f.ocFile) {
        const ext = f.ocFile.name.split('.').pop()
        const path = `${f.folio}.${ext}`
        await supabase.storage.from('ordenes-compra').upload(path, f.ocFile, { upsert: true })
        const { data: urlData } = supabase.storage.from('ordenes-compra').getPublicUrl(path)
        oc_url = urlData.publicUrl
      }
      const { error: e1 } = await supabase.from('pv_entregas').update({
        folio: f.folio,
        cliente_id: f.cliente_id,
        fecha: f.fecha,
        fecha_pago_programada: f.fecha_pago_programada,
        oc_url,
        notas: f.notas || null,
        estado: f.estado,
        retencion: f.conRetencion ? Number(f.retencion || 0) : 0,
      }).eq('id', f.id)
      if (e1) throw e1
      setEntregaModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  // ─── UPDATE DEVOLUCION ─────────────────────────────────────
  async function updateDev(f) {
    setSaving(true)
    setError('')
    try {
      const { error: e1 } = await supabase.from('pv_devoluciones').update({
        fecha: f.fecha,
        motivo: f.motivo,
        notas: f.notas || null,
      }).eq('id', f.id)
      if (e1) throw e1
      setDevModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  // ─── UPDATE CLIENTE ────────────────────────────────────────
  async function updateCliente(f) {
    setSaving(true)
    setError('')
    try {
      const { error: e1 } = await supabase.from('clientes').update({
        nombre: f.nombre,
        contacto: f.contacto || null,
        telefono: f.telefono || null,
        email: f.email || null,
        rfc: f.rfc || null,
        direccion: f.direccion || null,
      }).eq('id', f.id)
      if (e1) throw e1
      setClienteModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  // ─── SAVE COBRO ────────────────────────────────────────────
  async function saveCobro(f) {
    setSaving(true)
    setError('')
    try {
      const { error: e1 } = await supabase.from('pv_cobros').insert({
        entrega_id: f.entrega_id,
        fecha: f.fecha,
        monto: Number(f.monto),
        metodo: f.metodo,
        notas: f.notas || null,
      })
      if (e1) throw e1
      // Si el cobro cubre el pendiente → marcar pagada
      const entrega = entregasConEstado.find(e => e.id === f.entrega_id)
      if (entrega && (entrega.cobrado + Number(f.monto)) >= entrega.total) {
        await supabase.from('pv_entregas').update({ estado: 'pagada' }).eq('id', f.entrega_id)
      }
      setCobroModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  // ─── SAVE DEVOLUCION ───────────────────────────────────────
  async function saveDev(f) {
    setSaving(true)
    setError('')
    try {
      const { data: dev, error: e1 } = await supabase.from('pv_devoluciones').insert({
        entrega_id: f.entrega_id,
        fecha: f.fecha,
        motivo: f.motivo,
        notas: f.notas || null,
        reposicion_completada: false,
      }).select().single()
      if (e1) throw e1
      await supabase.from('pv_devolucion_items').insert(
        f.items.map(i => ({
          devolucion_id: dev.id,
          producto_id: i.producto_id,
          cantidad: Number(i.cantidad),
        }))
      )
      // Entrada de inventario (merma/devolución — entra al stock para re-venta)
      await supabase.from('movimientos_inventario').insert(
        f.items.map(i => ({
          producto_id: i.producto_id,
          tipo: 'entrada',
          cantidad: Number(i.cantidad),
          concepto: `Devolución ${f.motivo} — necesita reposición`,
          referencia_id: dev.id,
          referencia_tipo: 'pv_devolucion',
        }))
      )
      setDevModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  async function marcarReposicion(devId) {
    await supabase.from('pv_devoluciones').update({ reposicion_completada: true }).eq('id', devId)
    await load()
  }

  // ─── SAVE CLIENTE ──────────────────────────────────────────
  async function saveCliente(f) {
    setSaving(true)
    setError('')
    try {
      const { error: e1 } = await supabase.from('clientes').insert({
        nombre: f.nombre,
        contacto: f.contacto || null,
        telefono: f.telefono || null,
        email: f.email || null,
        rfc: f.rfc || null,
        direccion: f.direccion || null,
        tipo: 'institucional',
        activo: true,
      })
      if (e1) throw e1
      setClienteModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--txt3)', textAlign: 'center' }}>Cargando…</div>

  return (
    <div>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Facturado', val: fmt(kpi.facturado), color: 'var(--forest)' },
          { label: 'Cobrado', val: fmt(kpi.cobrado), color: '#2B6B50' },
          { label: 'Por cobrar', val: fmt(kpi.porCobrar), color: kpi.porCobrar > 0 ? '#b45309' : '#2B6B50' },
          { label: 'Rep. pendientes', val: kpi.repoPendientes, color: kpi.repoPendientes > 0 ? '#991b1b' : '#2B6B50', badge: kpi.repoPendientes > 0 },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--srf)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>
              {k.badge ? (
                <span style={{ background: '#dc2626', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 16 }}>{k.val}</span>
              ) : k.val}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--bdr)', paddingBottom: 0 }}>
        {[
          { id: 'entregas', label: 'Entregas' },
          { id: 'devoluciones', label: `Devoluciones${devPendientes.length > 0 ? ` (${devPendientes.length})` : ''}` },
          { id: 'clientes', label: 'Clientes' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
            fontSize: 13.5, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--forest)' : 'var(--txt2)',
            borderBottom: tab === t.id ? '2px solid var(--forest)' : '2px solid transparent',
            marginBottom: -1, transition: 'color .12s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ENTREGAS TAB ── */}
      {tab === 'entregas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-amber" onClick={() => setEntregaModal({
              folio: folio(), cliente_id: '', fecha: today(), conIva: true, conRetencion: false, retencion: '',
              items: [{ producto_id: '', cantidad: 1, precio_unitario: 0 }], notas: '', ocFile: null,
            })}>+ Nueva entrega</button>
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Folio</th><th>Cliente</th><th>Fecha</th><th>Pago programado</th>
              <th>Total</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {entregasConEstado.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--txt3)', padding: 24 }}>Sin entregas registradas</td></tr>
              )}
              {entregasConEstado.map(e => (
                <tr key={e.id} style={{ background: e.esVencida ? '#fef2f2' : undefined }}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                    {e.folio}
                    {e.oc_url && <a href={e.oc_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11, color: 'var(--forest)' }}>📄 OC</a>}
                  </td>
                  <td>{e.cliente?.nombre || '—'}</td>
                  <td>{fmtDate(e.fecha)}</td>
                  <td style={{ color: e.esVencida ? '#dc2626' : undefined }}>
                    {fmtDate(e.fecha_pago_programada)}
                    {e.esVencida && <span style={{ marginLeft: 4, fontSize: 10, background: '#dc2626', color: '#fff', borderRadius: 4, padding: '1px 5px' }}>VENCIDA</span>}
                  </td>
                  <td>{fmt(e.total)}</td>
                  <td style={{ color: '#2B6B50' }}>{fmt(e.cobrado)}</td>
                  <td style={{ color: e.pendiente > 0 ? '#b45309' : '#2B6B50', fontWeight: 500 }}>{fmt(e.pendiente)}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: e.estado === 'pagada' ? '#d1fae5' : e.esVencida ? '#fee2e2' : '#fef3c7',
                      color: e.estado === 'pagada' ? '#065f46' : e.esVencida ? '#991b1b' : '#92400e',
                    }}>{e.estado}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {e.estado !== 'pagada' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setCobroModal({ entrega_id: e.id, folio: e.folio, pendiente: e.pendiente, fecha: today(), monto: e.pendiente, metodo: 'transferencia', notas: '' })}>
                          Cobrar
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setDevModal({ entrega_id: e.id, folio: e.folio, fecha: today(), motivo: 'perdida_vacio', notas: '', items: (e.pv_entrega_items || []).map(i => ({ producto_id: i.producto_id, nombre: i.producto?.nombre, cantidad: 0 })), pv_entrega_items: e.pv_entrega_items })}>
                        Devolución
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEntregaModal({
                        id: e.id, folio: e.folio, cliente_id: e.cliente_id, fecha: e.fecha,
                        fecha_pago_programada: e.fecha_pago_programada, conIva: e.iva > 0,
                        estado: e.estado, notas: e.notas || '', oc_url: e.oc_url, ocFile: null,
                        editMode: true,
                      })}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DEVOLUCIONES TAB ── */}
      {tab === 'devoluciones' && (
        <div>
          <table className="data-table">
            <thead><tr>
              <th>Fecha</th><th>Entrega</th><th>Cliente</th><th>Motivo</th><th>Productos</th><th>Reposición</th><th></th>
            </tr></thead>
            <tbody>
              {devoluciones.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--txt3)', padding: 24 }}>Sin devoluciones registradas</td></tr>
              )}
              {devoluciones.map(d => (
                <tr key={d.id} style={{ background: !d.reposicion_completada ? '#fffbeb' : undefined }}>
                  <td>{fmtDate(d.fecha)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.entrega?.folio || '—'}</td>
                  <td>{d.entrega?.cliente?.nombre || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{(d.motivo || '').replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: 12 }}>
                    {(d.pv_devolucion_items || []).map(i => (
                      <div key={i.id}>{i.producto?.nombre} × {i.cantidad}</div>
                    ))}
                  </td>
                  <td>
                    {d.reposicion_completada
                      ? <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Completada</span>
                      : <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Pendiente</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!d.reposicion_completada && (
                        <button className="btn btn-ghost btn-sm" onClick={() => marcarReposicion(d.id)}>Marcar repuesta</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setDevModal({
                        id: d.id, editMode: true,
                        entrega_id: d.entrega_id, folio: d.entrega?.folio || '',
                        fecha: d.fecha, motivo: d.motivo, notas: d.notas || '',
                        items: [], pv_entrega_items: [],
                      })}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CLIENTES TAB ── */}
      {tab === 'clientes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-amber" onClick={() => setClienteModal({ nombre: '', contacto: '', telefono: '', email: '', rfc: '', direccion: '' })}>+ Nuevo cliente</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>RFC</th><th>Dirección</th><th></th></tr></thead>
            <tbody>
              {clientes.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--txt3)', padding: 24 }}>Sin clientes institucionales</td></tr>
              )}
              {clientes.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td>{c.contacto || '—'}</td>
                  <td>{c.telefono || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.rfc || '—'}</td>
                  <td>{c.direccion || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setClienteModal({
                      id: c.id, editMode: true,
                      nombre: c.nombre, contacto: c.contacto || '', telefono: c.telefono || '',
                      email: c.email || '', rfc: c.rfc || '', direccion: c.direccion || '',
                    })}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL: NUEVA ENTREGA ─────────────────────────────── */}
      {entregaModal && (
        <ModalOverlay onClose={() => setEntregaModal(null)}>
          <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: 'var(--forest)' }}>{entregaModal.editMode ? 'Editar entrega' : 'Nueva entrega institucional'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Folio</label>
              <input className="form-input" value={entregaModal.folio}
                onChange={e => setEntregaModal(m => ({ ...m, folio: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={entregaModal.fecha} onChange={e => setEntregaModal(m => ({ ...m, fecha: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Cliente</label>
              <select className="form-input" value={entregaModal.cliente_id} onChange={e => setEntregaModal(m => ({ ...m, cliente_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {entregaModal.editMode && (
              <>
                <div>
                  <label className="form-label">Fecha pago programado</label>
                  <input className="form-input" type="date" value={entregaModal.fecha_pago_programada || ''} onChange={e => setEntregaModal(m => ({ ...m, fecha_pago_programada: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <select className="form-input" value={entregaModal.estado} onChange={e => setEntregaModal(m => ({ ...m, estado: e.target.value }))}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Orden de compra</label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                border: '1px solid var(--bdr)', borderRadius: 8, cursor: 'pointer',
                background: entregaModal.ocFile ? 'var(--forest-s)' : 'var(--cream-d)',
                transition: 'background .15s',
              }}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
                  onChange={e => setEntregaModal(m => ({ ...m, ocFile: e.target.files[0] || null }))} />
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={entregaModal.ocFile ? 'var(--forest)' : 'var(--txt3)'} strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span style={{ fontSize: 13, color: entregaModal.ocFile ? 'var(--forest)' : 'var(--txt3)', fontWeight: entregaModal.ocFile ? 600 : 400 }}>
                  {entregaModal.ocFile ? entregaModal.ocFile.name : 'Seleccionar archivo PDF o imagen…'}
                </span>
                {entregaModal.ocFile && (
                  <span onClick={e => { e.preventDefault(); setEntregaModal(m => ({ ...m, ocFile: null })) }}
                    style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)', cursor: 'pointer', padding: '0 4px' }}>✕</span>
                )}
              </label>
            </div>
          </div>

          {!entregaModal.editMode && <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Productos</label>
              <button className="btn btn-ghost btn-sm" onClick={() => setEntregaModal(m => ({ ...m, items: [...m.items, { producto_id: '', cantidad: 1, precio_unitario: 0 }] }))}>+ Agregar</button>
            </div>
            {entregaModal.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 28px', gap: 8, marginBottom: 6 }}>
                <select className="form-input" value={item.producto_id} onChange={e => {
                  const prod = productos.find(p => p.id === e.target.value)
                  setEntregaModal(m => { const items = [...m.items]; items[idx] = { ...items[idx], producto_id: e.target.value, precio_unitario: prod?.precio_base || 0 }; return { ...m, items } })
                }}>
                  <option value="">— Producto —</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input className="form-input" type="number" min="0" placeholder="Cant." value={item.cantidad}
                  onChange={e => setEntregaModal(m => { const items = [...m.items]; items[idx] = { ...items[idx], cantidad: e.target.value }; return { ...m, items } })} />
                <input className="form-input" type="number" min="0" step="0.01" placeholder="Precio" value={item.precio_unitario}
                  onChange={e => setEntregaModal(m => { const items = [...m.items]; items[idx] = { ...items[idx], precio_unitario: e.target.value }; return { ...m, items } })} />
                <button style={{ background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}
                  onClick={() => setEntregaModal(m => ({ ...m, items: m.items.filter((_, i) => i !== idx) }))}>×</button>
              </div>
            ))}
            {/* Toggles IVA / Retención + totales */}
            {entregaModal.items.length > 0 && (() => {
              const sub = entregaModal.items.reduce((s, i) => s + Number(i.cantidad || 0) * Number(i.precio_unitario || 0), 0)
              const iva = entregaModal.conIva ? sub * 0.16 : 0
              const ret = entregaModal.conRetencion ? Number(entregaModal.retencion || 0) : 0
              const total = sub + iva - ret
              return (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--cream-d)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Fila de toggles */}
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {/* Toggle IVA */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                      <div onClick={() => setEntregaModal(m => ({ ...m, conIva: !m.conIva }))}
                        style={{ width: 36, height: 20, borderRadius: 99, position: 'relative', cursor: 'pointer', background: entregaModal.conIva ? 'var(--forest)' : 'var(--bdr2)', transition: 'background .2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: entregaModal.conIva ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 500 }}>IVA 16%</span>
                    </label>
                    {/* Toggle Retención */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                      <div onClick={() => setEntregaModal(m => ({ ...m, conRetencion: !m.conRetencion, retencion: m.conRetencion ? '' : m.retencion }))}
                        style={{ width: 36, height: 20, borderRadius: 99, position: 'relative', cursor: 'pointer', background: entregaModal.conRetencion ? '#b45309' : 'var(--bdr2)', transition: 'background .2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: entregaModal.conRetencion ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 500 }}>Retención</span>
                    </label>
                    {entregaModal.conRetencion && (
                      <input
                        type="number" min="0" step="0.01" placeholder="Monto retención"
                        value={entregaModal.retencion}
                        onChange={e => setEntregaModal(m => ({ ...m, retencion: e.target.value }))}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #d97706', fontSize: 13, width: 150, background: '#fffbeb', color: '#92400e', fontWeight: 600 }}
                      />
                    )}
                  </div>
                  {/* Resumen de totales */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                    <span><span style={{ color: 'var(--txt3)' }}>Subtotal </span><strong>{fmt(sub)}</strong></span>
                    {entregaModal.conIva && <span><span style={{ color: 'var(--txt3)' }}>IVA </span><strong>{fmt(iva)}</strong></span>}
                    {entregaModal.conRetencion && ret > 0 && <span><span style={{ color: '#b45309' }}>− Retención </span><strong style={{ color: '#b45309' }}>{fmt(ret)}</strong></span>}
                    <span style={{ borderLeft: '1px solid var(--bdr)', paddingLeft: 16 }}><span style={{ color: 'var(--forest)' }}>Total </span><strong style={{ color: 'var(--forest)', fontSize: 14 }}>{fmt(total)}</strong></span>
                  </div>
                </div>
              )
            })()}
          </div>}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Notas</label>
            <textarea className="form-input" rows={2} value={entregaModal.notas} onChange={e => setEntregaModal(m => ({ ...m, notas: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEntregaModal(null)}>Cancelar</button>
            <button className="btn btn-amber"
              disabled={saving || !entregaModal.cliente_id || (!entregaModal.editMode && entregaModal.items.filter(i => i.producto_id && Number(i.cantidad) > 0).length === 0)}
              onClick={() => entregaModal.editMode
                ? updateEntrega(entregaModal)
                : saveEntrega({ ...entregaModal, items: entregaModal.items.filter(i => i.producto_id && Number(i.cantidad) > 0) })
              }>
              {saving ? 'Guardando…' : entregaModal.editMode ? 'Guardar cambios' : 'Registrar entrega'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ─── MODAL: COBRO ────────────────────────────────────── */}
      {cobroModal && (
        <ModalOverlay onClose={() => setCobroModal(null)}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--forest)' }}>Registrar cobro</h3>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>{cobroModal.folio} · Pendiente: <strong>{fmt(cobroModal.pendiente)}</strong></div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Fecha cobro</label>
                <input className="form-input" type="date" value={cobroModal.fecha} onChange={e => setCobroModal(m => ({ ...m, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Monto</label>
                <input className="form-input" type="number" min="0" step="0.01" value={cobroModal.monto} onChange={e => setCobroModal(m => ({ ...m, monto: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">Método</label>
              <select className="form-input" value={cobroModal.metodo} onChange={e => setCobroModal(m => ({ ...m, metodo: e.target.value }))}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="form-label">Notas</label>
              <textarea className="form-input" rows={2} value={cobroModal.notas} onChange={e => setCobroModal(m => ({ ...m, notas: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setCobroModal(null)}>Cancelar</button>
            <button className="btn btn-amber" disabled={saving || !cobroModal.monto || Number(cobroModal.monto) <= 0} onClick={() => saveCobro(cobroModal)}>
              {saving ? 'Guardando…' : 'Registrar cobro'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ─── MODAL: DEVOLUCIÓN ───────────────────────────────── */}
      {devModal && (
        <ModalOverlay onClose={() => setDevModal(null)}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: 'var(--forest)' }}>{devModal.editMode ? 'Editar devolución' : 'Registrar devolución'}</h3>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>{devModal.folio}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={devModal.fecha} onChange={e => setDevModal(m => ({ ...m, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Motivo</label>
              <select className="form-input" value={devModal.motivo} onChange={e => setDevModal(m => ({ ...m, motivo: e.target.value }))}>
                <option value="perdida_vacio">Pérdida de vacío</option>
                <option value="fecha_caducidad">Fecha de caducidad</option>
                <option value="danio_transporte">Daño en transporte</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          {!devModal.editMode && (
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Cantidades devueltas</label>
            {devModal.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 6 }}>
                <div style={{ padding: '7px 10px', background: '#f5f5f5', borderRadius: 6, fontSize: 13, border: '1px solid var(--bdr)' }}>{item.nombre}</div>
                <input className="form-input" type="number" min="0" placeholder="Cant." value={item.cantidad}
                  onChange={e => setDevModal(m => { const items = [...m.items]; items[idx] = { ...items[idx], cantidad: e.target.value }; return { ...m, items } })} />
              </div>
            ))}
          </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Notas</label>
            <textarea className="form-input" rows={2} value={devModal.notas} onChange={e => setDevModal(m => ({ ...m, notas: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setDevModal(null)}>Cancelar</button>
            <button className="btn btn-amber"
              disabled={saving || (!devModal.editMode && devModal.items.filter(i => Number(i.cantidad) > 0).length === 0)}
              onClick={() => devModal.editMode ? updateDev(devModal) : saveDev({ ...devModal, items: devModal.items.filter(i => Number(i.cantidad) > 0) })}>
              {saving ? 'Guardando…' : devModal.editMode ? 'Guardar cambios' : 'Registrar devolución'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ─── MODAL: CLIENTE ──────────────────────────────────── */}
      {clienteModal && (
        <ModalOverlay onClose={() => setClienteModal(null)}>
          <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: 'var(--forest)' }}>{clienteModal.editMode ? 'Editar cliente' : 'Nuevo cliente institucional'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'nombre', label: 'Nombre *', full: true },
              { key: 'contacto', label: 'Persona de contacto' },
              { key: 'telefono', label: 'Teléfono' },
              { key: 'email', label: 'Email' },
              { key: 'rfc', label: 'RFC' },
              { key: 'direccion', label: 'Dirección', full: true },
            ].map(f => (
              <div key={f.key} style={f.full ? { gridColumn: '1/-1' } : {}}>
                <label className="form-label">{f.label}</label>
                <input className="form-input" value={clienteModal[f.key]} onChange={e => setClienteModal(m => ({ ...m, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setClienteModal(null)}>Cancelar</button>
            <button className="btn btn-amber" disabled={saving || !clienteModal.nombre}
              onClick={() => clienteModal.editMode ? updateCliente(clienteModal) : saveCliente(clienteModal)}>
              {saving ? 'Guardando…' : clienteModal.editMode ? 'Guardar cambios' : 'Guardar cliente'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

function ModalOverlay({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,56,49,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        {children}
      </div>
    </div>
  )
}
