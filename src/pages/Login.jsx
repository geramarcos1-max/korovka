import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) setError('Email o contraseña incorrectos.')
    else navigate('/')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
    }}>
      {/* Panel izquierdo — decorativo */}
      <div style={{
        width: '42%',
        background: 'var(--forest)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 280, height: 280,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.04)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 220, height: 220,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.04)',
        }} />

        {/* Logo */}
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 44,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-.02em',
            lineHeight: 1,
          }}>Korovka</div>
          <div style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,.45)',
            marginTop: 8,
          }}>Productos Lácteos</div>
        </div>

        {/* Frase inferior */}
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 22,
            color: 'rgba(255,255,255,.85)',
            lineHeight: 1.4,
            fontWeight: 500,
            marginBottom: 12,
          }}>
            Control comercial<br />de tu negocio.
          </div>
          
