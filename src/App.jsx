import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BusinessProvider, useBusiness } from './context/BusinessContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import BusinessSelector from './pages/BusinessSelector'
import Dashboard from './pages/Dashboard'
import Ventas from './pages/Ventas'
import Inventario from './pages/Inventario'
import PuntosVenta from './pages/PuntosVenta'
import Productos from './pages/Productos'
import Caja from './pages/Caja'
import OdcInterna from './pages/OdcInterna'
import Inteligencia from './pages/Inteligencia'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Cargando…</div>
  return user ? children : <Navigate to="/login" replace />
}

function BusinessRoute({ children }) {
  const { user, loading } = useAuth()
  const { business } = useBusiness()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!business) return <Navigate to="/negocio" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/negocio" element={<PrivateRoute><BusinessSelector /></PrivateRoute>} />
      <Route path="/" element={
        <BusinessRoute><Layout /></BusinessRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="puntos-venta" element={<PuntosVenta />} />
        <Route path="productos" element={<Productos />} />
        <Route path="caja" element={<Caja />} />
        <Route path="odc-interna" element={<OdcInterna />} />
        <Route path="inteligencia" element={<Inteligencia />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessProvider>
        <AppRoutes />
      </BusinessProvider>
    </AuthProvider>
  )
}
