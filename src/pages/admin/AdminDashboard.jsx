import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Users2,
  Gavel,
  Lock,
  Activity,
  Crown,
  Radio,
  LockOpen,
  Trophy,
  ArrowRight
} from 'lucide-react'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ candidates: 0, judges: 0, locked: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: candidates }, { count: judges }, { count: locked }, { count: total }] = await Promise.all([
        supabase.from('candidates').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'judge'),
        supabase.from('scores').select('*', { count: 'exact', head: true }).eq('is_locked', true),
        supabase.from('scores').select('*', { count: 'exact', head: true }),
      ])
      setStats({ candidates: candidates ?? 0, judges: judges ?? 0, locked: locked ?? 0, total: total ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  const lockPct = stats.total > 0 ? Math.round((stats.locked / stats.total) * 100) : 0

  return (
    <div className="dashboard" style={{ width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(46,125,50,0.08)', borderRadius: 6, border: '1px solid rgba(46,125,50,0.2)', marginBottom: 8 }}>
            <Crown size={13} color="var(--pageant-primary)" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pageant-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Binibining Palayan Command Center
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Administrator Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Real-time scoring status and competition management for Binibining Palayan
          </p>
        </div>
        <div className="dashboard-competition-badges" style={{ display: 'flex', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(46,125,50,0.1)', borderRadius: 8, border: '1px solid rgba(46,125,50,0.25)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--pageant-primary)' }}>
            <Crown size={14} color="var(--pageant-primary)" /> Binibining Palayan
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="stat-card skeleton" style={{ height: 110 }} />)}
        </div>
      ) : (
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <StatCard icon={Users2} label="Official Candidates" value={stats.candidates} iconColor="var(--pageant-primary)" />
          <StatCard icon={Gavel} label="Board of Judges" value={stats.judges} iconColor="#D97706" />
          <StatCard icon={Lock} label="Locked Scores" value={stats.locked} iconColor="var(--pageant-primary)" />
          <StatCard
            icon={Activity}
            label="Locking Progress"
            value={`${lockPct}%`}
            iconColor="#D97706"
            sub={`${stats.locked} of ${stats.total} entries`}
          />
        </div>
      )}

      {!loading && (
        <div className="card" style={{ marginTop: 20, padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="var(--pageant-primary)" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Overall Scoring Progress</h3>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--pageant-primary)' }}>{lockPct}% Locked In</span>
          </div>
          <div className="progress-bar-track" style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${lockPct}%`, height: '100%', background: 'var(--pageant-primary)', transition: 'width 0.3s ease' }}
            />
          </div>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {stats.locked} scores certified and locked &bull; {stats.total - stats.locked} scores still in draft or pending
          </p>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Management Modules
        </h3>
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <QuickLink to="/admin/teams"   icon={Users2}   title="Candidate Roster"   desc="Register candidates, photos, and numbers" />
          <QuickLink to="/admin/judges"  icon={Gavel}    title="Judges Management"  desc="Setup judge accounts and credentials" />
          <QuickLink to="/admin/monitor" icon={Radio}    title="Judging Monitor"    desc="Real-time judge scoring activity and matrix" />
          <QuickLink to="/admin/unlock"  icon={LockOpen} title="Unlock Requests"    desc="Review and process score unlock requests" />
          <QuickLink to="/admin/results" icon={Trophy}   title="Results & Reports"  desc="Standings, stage awards, and PDF printouts" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, iconColor = 'var(--pageant-primary)' }) {
  return (
    <div className="card" style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <div style={{ padding: 6, background: 'var(--bg-elevated)', borderRadius: 6 }}>
          <Icon size={16} color={iconColor} />
        </div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function QuickLink({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        textDecoration: 'none',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 8, flexShrink: 0 }}>
        <Icon size={20} color="var(--pageant-primary)" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{desc}</div>
      </div>
      <ArrowRight size={16} color="var(--text-muted)" />
    </Link>
  )
}
