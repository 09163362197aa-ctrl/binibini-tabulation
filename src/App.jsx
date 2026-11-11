import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'

import AdminLayout    from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTeams     from './pages/admin/AdminTeams'
import AdminJudges    from './pages/admin/AdminJudges'
import AdminMonitor   from './pages/admin/AdminMonitor'
import AdminUnlock    from './pages/admin/AdminUnlock'
import AdminResults   from './pages/admin/AdminResults'

import JudgeLayout  from './pages/judge/JudgeLayout'
import JudgeHome    from './pages/judge/JudgeHome'
import ScoreForm    from './pages/judge/ScoreForm'
import JudgeSummary from './pages/judge/JudgeSummary'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="teams"   element={<AdminTeams />} />
            <Route path="judges"  element={<AdminJudges />} />
            <Route path="monitor" element={<AdminMonitor />} />
            <Route path="unlock"  element={<AdminUnlock />} />
            <Route path="results" element={<AdminResults />} />
          </Route>

          {/* Judge routes */}
          <Route
            path="/judge"
            element={
              <ProtectedRoute requiredRole="judge">
                <JudgeLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<JudgeHome />} />
            <Route path="score/:competition/:id" element={<ScoreForm />} />
            <Route path="summary" element={<JudgeSummary />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
