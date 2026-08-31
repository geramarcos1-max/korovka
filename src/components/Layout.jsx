import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: '◉', end: true },
  { label: 'OPERACIONES', type: 'label' },
  { to: '/ventas', label: 'Ventas', icon: '🧾' },
  { to: '/consignacion', label: 'Consignación', icon: '📦' },
  { to: '/cxc', label: 'Cuentas por Cobrar', icon: '💰' },
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
  '/inventario': 'Inventario',
  '/productos': 'Productos',
  '/clientes': 'Clientes',
  '/puntos': 'Puntos de Distribución',
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">KOROVKA</div>
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

        <div style={{ padding: '12px 18px 20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>
            {profile?.nombre || 'Usuario'}
            <span style={{
              display: 'inline-block', marginLeft: 6,
              background: 'rgba(200,132,28,.3)',
              color: 'var(--amber)',
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}>{profile?.rol}</span>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,.15)',
              color: 'rgba(255,255,255,.5)', borderRadius: 6,
              padding: '5px 10px', fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="main-area">
        <div className="topbar">
          <span className="topbar-title">
            {titles[window.location.pathname.replace('/korovka', '')] || 'Dashboard'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
            KOROVKA · Sistema Comercial
          </span>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
