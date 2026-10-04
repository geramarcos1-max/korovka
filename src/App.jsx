import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ventas from './pages/Ventas'
import Inventario from './pages/Inventario'
import PuntosVenta from './pages/PuntosVenta'
import Productos from './pages/Productos'
import Caja from './pages/Caja'
import OdcInterna from './pages/OdcInterna'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Cargando…</div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute><Layout /></PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="puntos-venta" element={<PuntosVenta />} />
        <Route path="productos" element={<Productos />} />
        <Route path="caja" element={<Caja />} />
        <Route path="odc-interna" element={<OdcInterna />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
