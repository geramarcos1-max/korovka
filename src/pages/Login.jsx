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
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--txt)',
            letterSpacing: '.04em',
          }}>KOROVKA</div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--amber)',
            marginTop: 4,
          }}>Productos Lácteos</div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>Iniciar sesión</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div style={{
                background: 'var(--red-s)',
                color: 'var(--red)',
                padding: '8px 12px',
                borderRadius: 'var(--r2)',
                fontSize: 13,
                marginBottom: 14,
              }}>{error}</div>
            )}
            <button
              type="submit"
              className="btn btn-amber"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
