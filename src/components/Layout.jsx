import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: '◈', end: true },
  { label: 'OPERACIONES', type: 'label' },
  { to: '/ventas', label: 'Ventas', icon: '🧾' },
  { to: '/consignacion', label: 'Consignación', icon: '📦' },
  { to: '/cxc', label: 'Cuentas por Cobrar', icon: '💰' },
  { to: '/gastos', label: 'Gastos', icon: '💸' },
  { to: '/odc-interna', label: 'ODC Interna', icon: '🗒️' },
  { label: 'CATÁLOGOS', type: 'label' },
  { to: '/inventario', label: 'Inventario', icon: '📊' },
  { to: '/productos', label: 'Productos', icon: '🧀' },
  { to: '/clientes', label: 'Clientes', icon: '🏪' },
  { to: '/puntos', label: 'Puntos de Distrib.', icon: '📍' },
]

const titles = {
  '/': 'Dashboard',
  '/ventas': 'Ventas',
  '/consignacion': 'Consignación',
  '/cxc': 'Cuentas por Cobrar',
  '/gastos': 'Gastos',
  '/odc-interna': 'ODC Interna',
  '/inventario': 'Inventario',
  '/productos': 'Productos',
  '/clientes': 'Clientes',
  '/puntos': 'Puntos de Distribución',
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const pageTitle = titles[location.pathname] || 'Dashboard'

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">Korovka</div>
          <div className="sb-sub">Productos Lácteos</div>
        </div>

        <div className="sb-nav">
          {nav.map((item, i) => {
            if (item.type === 'label') {
              return <div key={i} className="sb-label">{item.label}</div>
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
              >
                <em className="sb-icon">{item.icon}</em>
                {item.label}
              </NavLink>
            )
          })}
        </div>

        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid rgba(255,255,255,.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(246,239,223,.20)', color: '#F6EFDF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>
              {(profile?.nombre || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#F6EFDF', lineHeight: 1.2 }}>{profile?.nombre || 'Usuario'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(246,239,223,.45)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>{profile?.rol}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(246,239,223,.55)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%', transition: 'color .12s, background .12s' }}
            onMouseEnter={e => { e.target.style.background = 'rgba(246,239,223,.10)'; e.target.style.color = '#F6EFDF' }}
            onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'rgba(246,239,223,.55)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="main-area">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 600, color: 'var(--forest)', letterSpacing: '-.01em' }}>Korovka</span>
            <span style={{ color: 'var(--bdr2)', fontSize: 16 }}>›</span>
            <span className="topbar-title">{pageTitle}</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--txt3)', letterSpacing: '.04em' }}>Sistema Comercial</span>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
