import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SEAL_B64, LOGO_B64 } from '../lib/brandImages'

const IVA_RATE = 0.16
const PARTICULAR = '__particular__'
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }
function folio(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() }

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente',   bg: 'var(--amber-s)', color: 'var(--amber-t)' },
  { value: 'pagada',      label: 'Pagada',      bg: 'var(--ok-s)',    color: 'var(--ok-t)' },
  { value: 'degustacion', label: 'Degustación', bg: 'var(--info-s)',  color: 'var(--info-t)' },
  { value: 'regalado',    label: 'Regalado',    bg: '#f3e8ff',        color: '#7c3aed' },
]
function estadoMeta(e) { return ESTADOS.find(x => x.value === e) || ESTADOS[0] }

function SortTh({ col, label, sort, onSort, className }) {
  const active = sort.col === col
  return (
    <th className={className} onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
        {active && sort.dir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  )
}

function EstadoSelect({ v, onChange }) {
  const meta = estadoMeta(v.estado)
  return (
    <select
      value={v.estado}
      onChange={e => onChange(v, e.target.value)}
      style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: meta.bg, color: meta.color, outline: 'none' }}
    >
      {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
    </select>
  )
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

function PagoEstado({ f, setF, personas }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="form-row">
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
            <option value="degustacion">Degustación</option>
            <option value="regalado">Regalado</option>
          </select>
        </div>
      </div>
      {f.metodo_pago === 'efectivo' && f.estado === 'pagada' && personas.length > 0 && (
        <div className="form-group" style={{ marginTop: 10 }}>
          <label className="form-label">¿Quién cobró? <span style={{ color: 'var(--txt3)', fontWeight: 400 }}>(registra en caja)</span></label>
          <select className="form-select" value={f.cobrado_por || ''} onChange={e => setF(x => ({ ...x, cobrado_por: e.target.value }))}>
            <option value="">— Sin asignar —</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}
      {f.metodo_pago === 'transferencia' && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">¿A quién se transfirió?</label>
            <select className="form-select" value={f.beneficiario_transferencia || ''} onChange={e => setF(x => ({ ...x, beneficiario_transferencia: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {['Caro', 'Fer', 'Gera', 'Kseniya'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Comprobante de pago <span style={{ color: 'var(--txt3)', fontWeight: 400 }}>(imagen)</span></label>
            {f.comprobante_url && !f.comprobante_file && (
              <a href={f.comprobante_url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 12, color: 'var(--forest)', marginBottom: 6 }}>Ver comprobante actual</a>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px dashed var(--bdr2)', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--txt2)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {f.comprobante_file ? f.comprobante_file.name : 'Seleccionar imagen…'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setF(x => ({ ...x, comprobante_file: e.target.files[0] || null }))} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalCampos({ f, setF, esP, clientes, puntos }) {
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

function ProductosForm({ its, onAdd, onRemove, onUpd, productos }) {
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


function PrintRemision({ venta, items, cliente, notas, conIva, onClose }) {
  const sub = items.reduce((a, i) => a + i.subtotal, 0)
  const iva = conIva ? sub * IVA_RATE : 0
  const total = sub + iva
  const fechaLarga = venta.fecha
    ? new Date(venta.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const clienteNombre = cliente ? cliente.nombre : (notas || 'Cliente')

  function printTicket() {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Ticket Korovka — ${venta.folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;display:flex;justify-content:center;padding:32px 16px}
  .ticket{width:100%;max-width:400px;background:#fff}
  .hdr{background:#063831;color:#F6EFDF;padding:24px 22px 20px;border-radius:10px 10px 0 0}
  .hdr-top{display:flex;justify-content:space-between;align-items:flex-start}
  .brand{font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;letter-spacing:.04em;line-height:1}
  .brand-sub{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(246,239,223,.55);margin-top:5px;font-weight:500}
  .ticket-label{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(246,239,223,.55);font-weight:500;text-align:right}
  .folio{font-family:monospace;font-size:13px;color:#F6EFDF;font-weight:600;margin-top:4px;text-align:right}
  .fecha{font-size:11px;color:rgba(246,239,223,.65);margin-top:2px;text-align:right}
  .body{padding:18px 22px 22px;border:1px solid #e8e2d9;border-top:none;border-radius:0 0 10px 10px}
  .cliente-block{padding:12px 0 14px;border-bottom:1px dashed #ddd6ca}
  .lbl{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#999;font-weight:600;margin-bottom:4px}
  .cliente-nombre{font-size:14px;font-weight:600;color:#063831}
  .cliente-sub{font-size:11px;color:#888;margin-top:2px}
  .items{width:100%;border-collapse:collapse;margin:14px 0}
  .items thead th{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#999;font-weight:600;padding:0 0 8px;border-bottom:1px solid #e8e2d9}
  .items thead th:first-child{text-align:left}
  .items thead th:not(:first-child){text-align:right}
  .items tbody td{padding:9px 0;border-bottom:1px solid #f0ece6;font-size:13px;color:#2d2d2d;vertical-align:top}
  .items tbody td:first-child{text-align:left;font-weight:500}
  .items tbody td:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}
  .items tbody td .qty{font-size:11px;color:#888;margin-top:1px}
  .totals{padding-top:2px}
  .total-row{display:flex;justify-content:space-between;font-size:12px;color:#666;padding:3px 0}
  .total-final{display:flex;justify-content:space-between;align-items:center;background:#063831;color:#F6EFDF;padding:12px 14px;border-radius:8px;margin-top:10px}
  .total-final .t-lbl{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;opacity:.75}
  .total-final .t-val{font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700}
  .notas{margin-top:14px;padding:10px 12px;background:#f9f6f1;border-radius:7px;font-size:12px;color:#666;border-left:2px solid #d4c9b4}
  .brand-footer{margin-top:20px;padding-top:16px;border-top:1px dashed #ddd6ca;display:flex;flex-direction:column;align-items:center;gap:10px}
  .brand-footer img.seal{width:90px;height:90px;object-fit:contain}
  .brand-footer img.logo{width:160px;object-fit:contain}
  .footer-thanks{font-family:'Playfair Display',Georgia,serif;font-size:12px;color:#888;font-weight:400;text-align:center;margin-top:4px}
  @media print{body{padding:0}@page{margin:12mm}}
</style>
</head>
<body>
<div class="ticket">
  <div class="hdr">
    <div class="hdr-top">
      <div>
        <div class="brand">Korovka</div>
        <div class="brand-sub">Productos Lácteos</div>
      </div>
      <div>
        <div class="ticket-label">Ticket de venta</div>
        <div class="folio">${venta.folio}</div>
        <div class="fecha">${fechaLarga}</div>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="cliente-block">
      <div class="lbl">Cliente</div>
      <div class="cliente-nombre">${clienteNombre}</div>
      ${cliente?.rfc ? `<div class="cliente-sub">RFC: ${cliente.rfc}</div>` : ''}
      ${cliente?.direccion ? `<div class="cliente-sub">${cliente.direccion}</div>` : ''}
    </div>
    <table class="items">
      <thead><tr>
        <th>Producto</th>
        <th>Precio</th>
        <th>Total</th>
      </tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.producto_nombre}<div class="qty">${i.cantidad} ${i.unidad || 'pza'}</div></td>
          <td>${fmt(i.precio_unitario)}</td>
          <td>${fmt(i.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
      ${conIva ? `<div class="total-row"><span>IVA (16%)</span><span>${fmt(iva)}</span></div>` : ''}
      <div class="total-final">
        <div class="t-lbl">Total</div>
        <div class="t-val">${fmt(total)}</div>
      </div>
    </div>
    ${notas ? `<div class="notas"><strong>Nota:</strong> ${notas}</div>` : ''}
    <div class="brand-footer">
      <img class="seal" src="${SEAL_B64}" alt="Sello Korovka"/>
      <img class="logo" src="${LOGO_B64}" alt="Korovka"/>
      <div class="footer-thanks">¡Gracias por tu preferencia!</div>
    </div>
  </div>
</div>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <span className="modal-title">Ticket de venta</span>
          <div className="gap-8">
            <button className="btn btn-amber btn-sm" onClick={printTicket}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ marginRight: 5, verticalAlign: 'middle' }}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h.01"/></svg>
              Imprimir / Descargar
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div style={{ background: '#f5f0e8', padding: '20px 24px 24px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,.12)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: '#063831', color: '#F6EFDF', padding: '20px 20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 22, fontWeight: 700, letterSpacing: '.03em', lineHeight: 1 }}>Korovka</div>
                    <div style={{ fontSize: 8.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(246,239,223,.5)', marginTop: 5, fontWeight: 500 }}>Productos Lácteos</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 8.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(246,239,223,.5)', fontWeight: 500 }}>Ticket de venta</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#F6EFDF', fontWeight: 600, marginTop: 4 }}>{venta.folio}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(246,239,223,.6)', marginTop: 2 }}>{fechaLarga}</div>
                  </div>
                </div>
              </div>
              {/* Body */}
              <div style={{ padding: '14px 18px 18px' }}>
                {/* Cliente */}
                <div style={{ paddingBottom: 12, marginBottom: 2, borderBottom: '1px dashed #e0d9ce' }}>
                  <div style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', fontWeight: 600, marginBottom: 3 }}>Cliente</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#063831' }}>{clienteNombre}</div>
                  {cliente?.rfc && <div style={{ fontSize: 10.5, color: '#888', marginTop: 1 }}>RFC: {cliente.rfc}</div>}
                </div>
                {/* Items */}
                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
                  <thead>
                    <tr>
                      {['Producto','Precio','Total'].map(h => (
                        <th key={h} style={{ fontSize: 8.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', fontWeight: 600, padding: '0 0 7px', borderBottom: '1px solid #ede8e0', textAlign: h === 'Producto' ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f5f1eb', fontSize: 12, fontWeight: 500, color: '#222', verticalAlign: 'top' }}>
                          {item.producto_nombre}
                          <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{item.cantidad} {item.unidad || 'pza'}</div>
                        </td>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f5f1eb', fontSize: 12, color: '#555', textAlign: 'right', verticalAlign: 'top' }}>{fmt(item.precio_unitario)}</td>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f5f1eb', fontSize: 12, fontWeight: 500, color: '#222', textAlign: 'right', verticalAlign: 'top' }}>{fmt(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Totals */}
                <div style={{ paddingTop: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#777', padding: '3px 0' }}>
                    <span>Subtotal</span><span>{fmt(sub)}</span>
                  </div>
                  {conIva && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#777', padding: '3px 0' }}>
                      <span>IVA (16%)</span><span>{fmt(iva)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#063831', color: '#F6EFDF', padding: '10px 13px', borderRadius: 7, marginTop: 9 }}>
                    <span style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, opacity: .7 }}>Total</span>
                    <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 18, fontWeight: 700 }}>{fmt(total)}</span>
                  </div>
                </div>
                {/* Notas */}
                {notas && (
                  <div style={{ marginTop: 12, padding: '8px 10px', background: '#f9f6f1', borderRadius: 6, fontSize: 11, color: '#777', borderLeft: '2px solid #d4c9b4' }}>
                    <strong style={{ color: '#555' }}>Nota:</strong> {notas}
                  </div>
                )}
                {/* Brand footer */}
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed #e0d9ce', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <img src={SEAL_B64} alt="Sello Korovka" style={{ width: 80, height: 80, objectFit: 'contain' }} />
                  <img src={LOGO_B64} alt="Korovka" style={{ width: 140, objectFit: 'contain' }} />
                  <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 2 }}>¡Gracias por tu preferencia!</div>
                </div>
              </div>
            </div>
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
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPago, setFiltroPago] = useState('')
  const [sort, setSort] = useState({ col: 'fecha', dir: 'desc' })

  function handleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const emptyForm = {
    cliente_id: '', punto_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    notas: '', con_iva: true, estado: 'pendiente', metodo_pago: 'efectivo',
    cobrado_por: '', beneficiario_transferencia: '', comprobante_file: null, comprobante_url: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
  const [editForm, setEditForm] = useState(emptyForm)
  const [editItems, setEditItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
  const [editingVenta, setEditingVenta] = useState(null)
  const [errEdit, setErrEdit] = useState('')

  async function load() {
    const [{ data: v }, { data: c }, { data: p }, { data: pr }, { data: per }] = await Promise.all([
      supabase.from('ventas').select('*, clientes(nombre), venta_items(cantidad, productos(nombre))').order('created_at', { ascending: false }).limit(200),
      supabase.from('clientes').select('id, nombre, rfc, direccion').eq('activo', true).order('nombre'),
      supabase.from('puntos_distribucion').select('id, nombre, modelo').eq('activo', true).eq('modelo', 'directa').order('nombre'),
      supabase.from('productos').select('id, nombre, precio_base, unidad').eq('activo', true).order('nombre'),
      supabase.from('personas_caja').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setVentas(v || [])
    setClientes(c || [])
    setPuntos(p || [])
    setProductos(pr || [])
    setPersonas(per || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
    if (filtroPago)   rows = rows.filter(v => (v.metodo_pago || 'efectivo') === filtroPago)
    rows.sort((a, b) => {
      let va, vb
      switch (sort.col) {
        case 'cliente':  va = (a.clientes?.nombre || 'zz').toLowerCase(); vb = (b.clientes?.nombre || 'zz').toLowerCase(); break
        case 'fecha':    va = a.fecha;    vb = b.fecha;    break
        case 'subtotal': va = a.subtotal; vb = b.subtotal; break
        case 'total':    va = a.total;    vb = b.total;    break
        case 'estado':   va = a.estado;   vb = b.estado;   break
        case 'pago':     va = a.metodo_pago || ''; vb = b.metodo_pago || ''; break
        default:         va = a.fecha;    vb = b.fecha
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1  : -1
      return 0
    })
    return rows
  }, [ventas, busqueda, filtroEstado, filtroPago, sort])

  function addItem()  { setItems(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeItem(i) { setItems(it => it.filter((_, idx) => idx !== i)) }
  function updateItem(i, key, val) {
    setItems(it => {
      const next = [...it]; next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') { const p = productos.find(p => p.id === val); if (p) next[i].precio_unitario = p.precio_base }
      return next
    })
  }

  function addEditItem()  { setEditItems(it => [...it, { producto_id: '', cantidad: 1, precio_unitario: '' }]) }
  function removeEditItem(i) { setEditItems(it => it.filter((_, idx) => idx !== i)) }
  function updateEditItem(i, key, val) {
    setEditItems(it => {
      const next = [...it]; next[i] = { ...next[i], [key]: val }
      if (key === 'producto_id') { const p = productos.find(p => p.id === val); if (p) next[i].precio_unitario = p.precio_base }
      return next
    })
  }

  const subtotal  = items.reduce((a, it) => a + (Number(it.cantidad) * Number(it.precio_unitario || 0)), 0)
  const iva       = form.con_iva ? subtotal * IVA_RATE : 0
  const total     = subtotal + iva
  const esParticular = form.cliente_id === PARTICULAR

  const subtotalE = editItems.reduce((a, it) => a + (Number(it.cantidad) * Number(it.precio_unitario || 0)), 0)
  const ivaE      = editForm.con_iva ? subtotalE * IVA_RATE : 0
  const totalE    = subtotalE + ivaE
  const esParticularE = editForm.cliente_id === PARTICULAR

  async function openEdit(v) {
    const { data: vitems } = await supabase.from('venta_items').select('*').eq('venta_id', v.id)
    setEditingVenta(v)
    setEditForm({
      cliente_id: v.cliente_id || PARTICULAR,
      punto_id: v.punto_id || '',
      fecha: v.fecha, notas: v.notas || '',
      con_iva: v.iva > 0, estado: v.estado, metodo_pago: v.metodo_pago || 'efectivo',
      cobrado_por: v.cobrado_por || '',
      beneficiario_transferencia: v.beneficiario_transferencia || '', comprobante_file: null, comprobante_url: v.comprobante_url || '',
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
    const cxcEstado = editForm.estado === 'pagada' ? 'pagada' : 'pendiente'
    const cxcPagado = editForm.estado === 'pagada' ? totalE : 0

    let comprobante_url_edit = editForm.comprobante_url || null
    if (editForm.comprobante_file) {
      const ext = editForm.comprobante_file.name.split('.').pop()
      const path = `${editingVenta.folio}-comp.${ext}`
      await supabase.storage.from('comprobantes').upload(path, editForm.comprobante_file, { upsert: true })
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
      comprobante_url_edit = urlData.publicUrl
    }
    await supabase.from('ventas').update({
      cliente_id: clienteIdReal, punto_id: editForm.punto_id || null,
      fecha: editForm.fecha, notas: editForm.notas,
      subtotal: subtotalE, iva: ivaE, total: totalE,
      estado: editForm.estado, metodo_pago: editForm.metodo_pago,
      cobrado_por: editForm.cobrado_por || null,
      beneficiario_transferencia: editForm.metodo_pago === 'transferencia' ? (editForm.beneficiario_transferencia || null) : null,
      comprobante_url: comprobante_url_edit,
    }).eq('id', editingVenta.id)

    await supabase.from('venta_items').delete().eq('venta_id', editingVenta.id)
    await supabase.from('venta_items').insert(editItems.map(i => ({
      venta_id: editingVenta.id, producto_id: i.producto_id,
      cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.cantidad) * Number(i.precio_unitario),
    })))
    await supabase.from('caja_movimientos').delete().eq('referencia_id', editingVenta.id).eq('referencia_tipo', 'venta').eq('tipo', 'cobro_venta')
    if (editForm.metodo_pago === 'efectivo' && editForm.estado === 'pagada' && editForm.cobrado_por) {
      await supabase.from('caja_movimientos').insert({
        persona_id: editForm.cobrado_por, tipo: 'cobro_venta', monto: totalE,
        concepto: 'Cobro venta ' + editingVenta.folio,
        referencia_id: editingVenta.id, referencia_tipo: 'venta', creado_por: profile?.id,
      })
    }
    await supabase.from('movimientos_inventario').delete().eq('referencia_id', editingVenta.id).eq('referencia_tipo', 'venta')
    await supabase.from('movimientos_inventario').insert(editItems.map(i => ({
      producto_id: i.producto_id, tipo: 'salida', cantidad: -Number(i.cantidad),
      concepto: 'Venta directa ' + editingVenta.folio,
      referencia_id: editingVenta.id, referencia_tipo: 'venta', creado_por: profile?.id,
    })))

    if (!esParticularE && clienteIdReal) {
      const { data: cxc } = await supabase.from('cuentas_por_cobrar').select('id').eq('venta_id', editingVenta.id).single()
      if (cxc) {
        await supabase.from('cuentas_por_cobrar').update({ cliente_id: clienteIdReal, monto_total: totalE, monto_pagado: cxcPagado, estado: cxcEstado }).eq('venta_id', editingVenta.id)
      } else {
        await supabase.from('cuentas_por_cobrar').insert({ venta_id: editingVenta.id, cliente_id: clienteIdReal, monto_total: totalE, monto_pagado: cxcPagado, estado: cxcEstado })
      }
    }
    setSaving(false); setEditModal(false); load()
  }

  async function save() {
    if (!form.cliente_id) { setErr('Selecciona un cliente o "Cliente particular".'); return }
    if (items.some(i => !i.producto_id || !i.cantidad || !i.precio_unitario)) { setErr('Completa todos los productos.'); return }
    setSaving(true)
    const clienteIdReal = esParticular ? null : form.cliente_id
    let comprobante_url = form.comprobante_url || null
    if (form.comprobante_file) {
      const ext = form.comprobante_file.name.split('.').pop()
      const path = `${folio('COMP')}.${ext}`
      await supabase.storage.from('comprobantes').upload(path, form.comprobante_file, { upsert: true })
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
      comprobante_url = urlData.publicUrl
    }
    const { data: venta, error } = await supabase.from('ventas').insert({
      folio: folio('VD'), tipo: 'directa', cliente_id: clienteIdReal,
      punto_id: form.punto_id || null, fecha: form.fecha, subtotal, iva, total,
      notas: form.notas, estado: form.estado, metodo_pago: form.metodo_pago, creado_por: profile?.id,
      cobrado_por: form.cobrado_por || null,
      beneficiario_transferencia: form.metodo_pago === 'transferencia' ? (form.beneficiario_transferencia || null) : null,
      comprobante_url,
    }).select().single()
    if (error) { setSaving(false); setErr(error.message); return }
    await supabase.from('venta_items').insert(items.map(i => ({
      venta_id: venta.id, producto_id: i.producto_id,
      cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.cantidad) * Number(i.precio_unitario),
    })))
    if (!esParticular) {
      await supabase.from('cuentas_por_cobrar').insert({
        venta_id: venta.id, cliente_id: clienteIdReal, monto_total: total,
        monto_pagado: form.estado === 'pagada' ? total : 0,
        estado: form.estado === 'pagada' ? 'pagada' : 'pendiente',
      })
    }
    if (form.metodo_pago === 'efectivo' && form.estado === 'pagada' && form.cobrado_por) {
      await supabase.from('caja_movimientos').insert({
        persona_id: form.cobrado_por, tipo: 'cobro_venta', monto: total,
        concepto: 'Cobro venta ' + venta.folio,
        referencia_id: venta.id, referencia_tipo: 'venta', creado_por: profile?.id,
      })
    }
    await supabase.from('movimientos_inventario').insert(items.map(i => ({
      producto_id: i.producto_id, tipo: 'salida', cantidad: -Number(i.cantidad),
      concepto: 'Venta directa ' + venta.folio,
      referencia_id: venta.id, referencia_tipo: 'venta', creado_por: profile?.id,
    })))
    setSaving(false); setModal(false)
    setForm(emptyForm); setItems([{ producto_id: '', cantidad: 1, precio_unitario: '' }])
    load()
  }

  async function cambiarEstado(v, nuevoEstado) {
    await supabase.from('ventas').update({ estado: nuevoEstado }).eq('id', v.id)
    if (v.cliente_id) {
      await supabase.from('cuentas_por_cobrar').update({
        estado: nuevoEstado === 'pagada' ? 'pagada' : 'pendiente',
        monto_pagado: nuevoEstado === 'pagada' ? v.total : 0,
      }).eq('venta_id', v.id)
    }
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
    setPrintData({
      venta: v,
      items: (vitems || []).map(i => ({ producto_nombre: i.productos?.nombre, unidad: i.productos?.unidad, cantidad: i.cantidad, precio_unitario: i.precio_unitario, subtotal: i.subtotal })),
      cliente, notas: v.notas, conIva: v.iva > 0,
    })
  }

  if (loading) return <div className="empty">Cargando…</div>

  return (
    <div>
      <div className="page-hdr">
        <h2>Ventas</h2>
        <button className="btn btn-amber" onClick={() => { setErr(''); setModal(true) }}>+ Nueva venta</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 220 }} placeholder="Buscar cliente, folio, notas…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
          <option value="degustacion">Degustación</option>
          <option value="regalado">Regalado</option>
        </select>
        <select className="form-select" style={{ maxWidth: 170 }} value={filtroPago} onChange={e => setFiltroPago(e.target.value)}>
          <option value="">Todos los pagos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
        {(busqueda || filtroEstado || filtroPago) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroPago('') }}>Limpiar filtros</button>
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
                <SortTh col="cliente"  label="Cliente"  sort={sort} onSort={handleSort} />
                <th>Productos</th>
                <th>Notas</th>
                <SortTh col="fecha"    label="Fecha"    sort={sort} onSort={handleSort} />
                <SortTh col="subtotal" label="Subtotal" sort={sort} onSort={handleSort} className="txt-right" />
                <th className="txt-right">IVA</th>
                <SortTh col="total"    label="Total"    sort={sort} onSort={handleSort} className="txt-right" />
                <SortTh col="pago"     label="Pago"     sort={sort} onSort={handleSort} />
                <SortTh col="estado"   label="Estado"   sort={sort} onSort={handleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.length === 0 && <tr><td colSpan={11} className="empty">Sin ventas</td></tr>}
              {ventasFiltradas.map(v => (
                <tr key={v.id}>
                  <td className="mono">{v.folio}</td>
                  <td>{v.clientes?.nombre || <span style={{ color: 'var(--txt3)', fontSize: 12 }}>Cliente particular</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--txt2)', maxWidth: 200 }}>
                    {v.venta_items?.length > 0
                      ? v.venta_items.map((it, i) => (
                          <span key={i} style={{ display: 'inline-block', background: 'var(--forest-s)', borderRadius: 4, padding: '1px 6px', marginRight: 4, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {it.productos?.nombre} ×{it.cantidad}
                          </span>
                        ))
                      : <span style={{ color: 'var(--txt3)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--txt2)', maxWidth: 180 }}>{v.notas || <span style={{ color: 'var(--txt3)' }}>—</span>}</td>
                  <td>{v.fecha}</td>
                  <td className="txt-right mono">{fmt(v.subtotal)}</td>
                  <td className="txt-right mono">{fmt(v.iva)}</td>
                  <td className="txt-right mono" style={{ fontWeight: 600 }}>{fmt(v.total)}</td>
                  <td>{v.metodo_pago === 'transferencia' ? <span className="badge b-info">Transferencia</span> : <span className="badge b-neu">Efectivo</span>}</td>
                  <td><EstadoSelect v={v} onChange={cambiarEstado} /></td>
                  <td>
                    <div className="gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openPrint(v)}>Ticket</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Editar</button>
                      <button className="btn btn-red btn-sm"   onClick={() => eliminar(v)}>Eliminar</button>
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
              <ModalCampos f={form} setF={setForm} esP={esParticular} clientes={clientes} puntos={puntos} />
              <ProductosForm its={items} onAdd={addItem} onRemove={removeItem} onUpd={updateItem} productos={productos} />
              <IVAResumen sub={subtotal} iv={iva} tot={total} conIva={form.con_iva} onToggle={() => setForm(f => ({ ...f, con_iva: !f.con_iva }))} />
              <PagoEstado f={form} setF={setForm} personas={personas} />
              {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-amber" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Registrar venta'}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && editingVenta && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-head">
              <span className="modal-title">Editar venta — {editingVenta.folio}</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <ModalCampos f={editForm} setF={setEditForm} esP={esParticularE} clientes={clientes} puntos={puntos} />
              <ProductosForm its={editItems} onAdd={addEditItem} onRemove={removeEditItem} onUpd={updateEditItem} productos={productos} />
              <IVAResumen sub={subtotalE} iv={ivaE} tot={totalE} conIva={editForm.con_iva} onToggle={() => setEditForm(f => ({ ...f, con_iva: !f.con_iva }))} />
              <PagoEstado f={editForm} setF={setEditForm} personas={personas} />
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
