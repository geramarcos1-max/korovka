import { useBusiness } from '../context/BusinessContext'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function BusinessSelector() {
  const { selectBusiness } = useBusiness()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName = profile?.nombre || 'Usuario'

  function pick(biz) {
    selectBusiness(biz)
    navigate('/')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F6EFDF 0%, #EDE4CF 100%)',
      padding: 24,
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#9E9080', marginBottom: 6, letterSpacing: '.04em' }}>
          Bienvenido, {displayName}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1308', letterSpacing: '-.02em' }}>
          ¿A qué negocio entramos?
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Korovka */}
        <button
          onClick={() => pick('korovka')}
          style={{
            width: 240,
            background: '#fff',
            border: '2px solid #D9CEBC',
            borderRadius: 16,
            padding: '32px 24px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color .15s, box-shadow .15s, transform .15s',
            boxShadow: '0 2px 12px rgba(6,56,49,.06)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#063831'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(6,56,49,.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D9CEBC'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(6,56,49,.06)'; e.currentTarget.style.transform = 'none' }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: '#063831',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 24 }}>🧀</span>
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 22, fontWeight: 600, color: '#063831',
            letterSpacing: '-.01em', lineHeight: 1, marginBottom: 6,
          }}>
            Korovka
          </div>
          <div style={{ fontSize: 12, color: '#9E9080', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Productos Lácteos
          </div>
        </button>

        {/* Teo Bros */}
        <button
          onClick={() => pick('teobros')}
          style={{
            width: 240,
            background: '#fff',
            border: '2px solid #D9CEBC',
            borderRadius: 16,
            padding: '32px 24px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color .15s, box-shadow .15s, transform .15s',
            boxShadow: '0 2px 12px rgba(92,45,10,.06)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C2D0A'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(92,45,10,.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D9CEBC'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(92,45,10,.06)'; e.currentTarget.style.transform = 'none' }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: '#5C2D0A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 24 }}>🍫</span>
          </div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 22, fontWeight: 600, color: '#5C2D0A',
            letterSpacing: '-.01em', lineHeight: 1, marginBottom: 6,
          }}>
            Teo Bros
          </div>
          <div style={{ fontSize: 12, color: '#9E9080', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Chocolate Artesanal
          </div>
        </button>
      </div>

      <button
        onClick={handleSignOut}
        style={{
          marginTop: 40, background: 'none', border: 'none',
          color: '#9E9080', fontSize: 13, cursor: 'pointer',
          textDecoration: 'underline', fontFamily: 'inherit',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
