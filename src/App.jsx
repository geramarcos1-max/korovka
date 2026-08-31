import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ventas from './pages/Ventas'
import Inventario from './pages/Inventario'
import Consignacion from './pages/Consignacion'
import CxC from './pages/CxC'
import Productos from './pages/Productos'
import Clientes from './pages/Clientes'
import Puntos from './pages/Puntos'

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
        <Route path="consignacion" element={<Consignacion />} />
        <Route path="cxc" element={<CxC />} />
        <Route path="productos" element={<Productos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="puntos" element={<Puntos />} />
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
