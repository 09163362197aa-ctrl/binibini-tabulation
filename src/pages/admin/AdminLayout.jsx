import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  Users2,
  Gavel,
  Radio,
  LockOpen,
  Trophy,
  LogOut,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react'
import ictLogo from '../../assets/ict.png'
import './AdminLayout.css'

const NAV_ITEMS = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/admin/teams',    icon: Users2,          label: 'Candidates'       },
  { to: '/admin/judges',   icon: Gavel,           label: 'Judges'          },
  { to: '/admin/monitor',  icon: Radio,           label: 'Judging Monitor' },
  { to: '/admin/unlock',   icon: LockOpen,        label: 'Unlock Requests' },
  { to: '/admin/results',  icon: Trophy,          label: 'Results & Reports' },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  
  // Sidebar collapsed state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  // Mobile sidebar open/close state
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('admin_sidebar_collapsed', String(next))
      return next
    })
  }

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

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
    <div className={`admin-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Header Bar */}
      <header className="admin-mobile-header">
        <button
          type="button"
          className="admin-mobile-toggle-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} color="#FFFFFF" />
        </button>
        <div className="mobile-header-brand">
          <img src="/palayan.png" alt="Palayan Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span>Binibining Palayan</span>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-brand">
            <div className="sidebar-logo-icon">
              <img src="/palayan.png" alt="Palayan Logo" style={{ width: 30, height: 30, objectFit: 'contain', display: 'block' }} />
            </div>
            {!isCollapsed && <span className="sidebar-logo-text">Binibining Palayan</span>}
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand menu" : "Collapse menu"}
            aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.8} className="sidebar-link-icon" />
                <span className="sidebar-link-text">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" title={isCollapsed ? `${profile?.name || 'Admin'} (Administrator)` : undefined}>
            <div className="sidebar-avatar">
              {(profile?.name || 'A')[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{profile?.name || 'Admin'}</div>
                <div className="sidebar-user-role">Administrator</div>
              </div>
            )}
          </div>
          <button
            className="sidebar-signout btn btn-ghost btn-sm"
            onClick={() => setShowSignOutModal(true)}
            title={isCollapsed ? "Sign out" : undefined}
          >
            <LogOut size={16} color="#FCD34D" strokeWidth={2} />
            {!isCollapsed && <span className="sidebar-signout-text">Sign out</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
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
                  Are you sure you want to end your session? You will need to log in again to access administrative tools.
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
