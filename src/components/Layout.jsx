import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Monochrome SVG icons
const Icon = ({ name, size = 16 }) => {
  const icons = {
    dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    ventas:    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    puntos:    <><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></>,
    caja:      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />,
    odc:       <><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></>,
    intel:     <><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>,
    inventario:<><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></>,
    productos: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8 4m-8-4l8 4" />,
    collapse:  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />,
    expand:    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />,
    logout:    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ flexShrink: 0, display: 'block' }}>
      {icons[name]}
    </svg>
  )
}

const nav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { label: 'OPERACIONES', type: 'label' },
  { to: '/ventas', label: 'Ventas', icon: 'ventas' },
  { to: '/puntos-venta', label: 'Puntos de Venta', icon: 'puntos' },
  { to: '/caja', label: 'Caja', icon: 'caja' },
  { to: '/odc-interna', label: 'ODC Interna', icon: 'odc' },
  { to: '/inteligencia', label: 'Inteligencia', icon: 'intel' },
  { label: 'CATÁLOGOS', type: 'label' },
  { to: '/inventario', label: 'Inventario', icon: 'inventario' },
  { to: '/productos', label: 'Productos', icon: 'productos' },
]

const titles = {
  '/': 'Dashboard',
  '/ventas': 'Ventas',
  '/puntos-venta': 'Puntos de Venta',
  '/caja': 'Caja',
  '/odc-interna': 'ODC Interna',
  '/inteligencia': 'Inteligencia Comercial',
  '/inventario': 'Inventario',
  '/productos': 'Productos',
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const pageTitle = titles[location.pathname] || 'Dashboard'
  const sw = collapsed ? 64 : 240

  return (
    <div className="app-shell">
      <nav style={{
        width: sw, background: 'var(--forest)', display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0,
        overflowY: 'auto', overflowX: 'hidden', zIndex: 100,
        transition: 'width .2s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Brand */}
        <div style={{ padding: collapsed ? '18px 0' : '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8, transition: 'padding .2s' }}>
          {!collapsed && (
            <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#F6EFDF', letterSpacing: '-.01em', lineHeight: 1 }}>Korovka</div>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(246,239,223,.45)', marginTop: 4 }}>Productos Lácteos</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(246,239,223,.5)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .12s, background .12s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F6EFDF'; e.currentTarget.style.background = 'rgba(246,239,223,.10)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(246,239,223,.5)'; e.currentTarget.style.background = 'none' }}
          >
            <Icon name={collapsed ? 'expand' : 'collapse'} size={15} />
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 0', flex: 1 }}>
          {nav.map((item, i) => {
            if (item.type === 'label') {
              if (collapsed) return null
              return <div key={i} style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(246,239,223,.35)', padding: '16px 18px 4px' }}>{item.label}</div>
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
                style={collapsed ? { justifyContent: 'center', padding: '8px 0', margin: '1px 8px' } : {}}
              >
                <Icon name={item.icon} size={17} />
                {!collapsed && item.label}
              </NavLink>
            )
          })}
        </div>

        {/* User footer */}
        {!collapsed ? (
          <div style={{ padding: '14px 20px 20px', borderTop: '1px solid rgba(255,255,255,.10)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(246,239,223,.20)', color: '#F6EFDF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
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
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(246,239,223,.10)'; e.currentTarget.style.color = '#F6EFDF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(246,239,223,.55)' }}
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div style={{ padding: '14px 0', borderTop: '1px solid rgba(255,255,255,.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(246,239,223,.20)', color: '#F6EFDF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
              {(profile?.nombre || 'U')[0].toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              style={{ background: 'none', border: 'none', color: 'rgba(246,239,223,.50)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', transition: 'color .12s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F6EFDF' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(246,239,223,.50)' }}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        )}
      </nav>

      <div style={{ marginLeft: sw, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', transition: 'margin-left .2s cubic-bezier(.4,0,.2,1)' }}>
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
