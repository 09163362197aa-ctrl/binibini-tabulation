import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut } from 'lucide-react'
import ictLogo from '../../assets/ict.png'
import './JudgeLayout.css'

export default function JudgeLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleConfirmSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login')
    } finally {
      setSigningOut(false)
      setShowSignOutModal(false)
    }
  }

  return (
    <div className="judge-shell">
      <header className="judge-header">
        <div className="judge-header-logo">
          <div className="judge-logo-icon">
            <img src={ictLogo} alt="ICT Logo" style={{ width: 30, height: 30, objectFit: 'contain', display: 'block' }} />
          </div>
          <span className="judge-logo-text">ScoreSystem</span>
        </div>

        <div className="judge-header-right">
          <div className="judge-user">
            <div className="judge-avatar">{(profile?.name || 'J')[0].toUpperCase()}</div>
            <span className="judge-name">{profile?.name || 'Judge'}</span>
          </div>
          <button className="judge-signout btn btn-ghost btn-sm" onClick={() => setShowSignOutModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <LogOut size={13} color="#FCD34D" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>

      <main className="judge-main">
        <Outlet />
      </main>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div className="card" style={{
            maxWidth: 400,
            width: '100%',
            padding: 24,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                padding: 10,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 10,
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <LogOut size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Sign Out?
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Are you sure you want to end your judging session?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSignOutModal(false)}
                disabled={signingOut}
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmSignOut}
                disabled={signingOut}
                style={{
                  background: '#dc2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {signingOut ? <span className="spinner spinner-sm" /> : <LogOut size={14} />}
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
