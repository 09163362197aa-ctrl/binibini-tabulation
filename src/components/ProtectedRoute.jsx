import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (requiredRole && profile?.role !== requiredRole) {
    const redirect = profile?.role === 'admin' ? '/admin' : '/judge'
    return <Navigate to={redirect} replace />
  }

  return children
}
