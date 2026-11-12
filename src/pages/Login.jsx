import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Eye,
  EyeOff,
  User,
  Lock,
  LogIn,
  AlertCircle
} from 'lucide-react'
import ictLogo from '../assets/ict.png'
import './Login.css'

export default function Login() {
  const { signIn, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [showPass, setShowPass] = useState(false)

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/judge'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    
    const formattedEmail = email.includes('@') 
      ? email.trim() 
      : `${email.trim().toLowerCase().replace(/\s+/g, '')}@scoresystem.com`

    try {
      await signIn(formattedEmail, password)
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <img src="/palayan.png" alt="Palayan City Logo" style={{ width: 44, height: 44, objectFit: 'contain', display: 'block' }} />
          </div>
          <span className="login-logo-text">Binibining Palayan</span>
        </div>

        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">Sign in to access the official tabulation system</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Username or Email</label>
            <input
              id="email"
              type="text"
              className="form-input"
              placeholder="e.g. judge1 or admin@scoresystem.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                className="pass-toggle"
                onClick={() => setShowPass(v => !v)}
                aria-label="Toggle password visibility"
              >
                {showPass ? (
                  <EyeOff size={16} strokeWidth={1.8} />
                ) : (
                  <Eye size={16} strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={15} color="var(--error)" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {busy ? <span className="spinner spinner-sm" /> : <LogIn size={16} strokeWidth={2} />}
            <span>{busy ? 'Signing in…' : 'Sign In'}</span>
          </button>
        </form>

        <p className="login-footer">
          ScoreSystem &bull; Palayan City Tabulation
        </p>
      </div>
    </div>
  )
}
