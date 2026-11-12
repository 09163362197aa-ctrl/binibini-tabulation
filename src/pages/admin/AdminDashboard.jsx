import { useEffect, useState, useCallback } from 'react'
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

  const load = useCallback(async () => {
    const [{ count: candidates }, { count: judges }, { count: locked }, { count: total }] = await Promise.all([
      supabase.from('candidates').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'judge'),
      supabase.from('scores').select('*', { count: 'exact', head: true }).eq('is_locked', true),
      supabase.from('scores').select('*', { count: 'exact', head: true }),
    ])
    setStats({ candidates: candidates ?? 0, judges: judges ?? 0, locked: locked ?? 0, total: total ?? 0 })
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    let debounceTimer = null
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        load()
      }, 400)
    }

    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, debouncedLoad)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [load])

  const lockPct = stats.total > 0 ? Math.round((stats.locked / stats.total) * 100) : 0

  return (
    <div className="dashboard" style={{ width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(217,119,6,0.08)', borderRadius: 8, border: '1px solid rgba(217,119,6,0.22)', marginBottom: 8 }}>
            <Crown size={14} color="#D97706" />
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Binibining Palayan Tabulation Center
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Administrator Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Real-time score audit, candidate progress, and official competition management
          </p>
        </div>
        {/* High-Priority Action Header Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Link
            to="/admin/teams"
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.84rem',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Users2 size={15} color="#D97706" />
            <span>Manage Candidates</span>
          </Link>

          <Link
            to="/admin/monitor"
            className="btn btn-gold btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              textDecoration: 'none',
              boxShadow: '0 3px 12px rgba(180,130,30,0.28)'
            }}
          >
            <Radio size={15} />
            <span>Open Live Monitor</span>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: '0 0 6px #FFFFFF',
              display: 'inline-block'
            }} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="stat-card skeleton" style={{ height: 110 }} />)}
        </div>
      ) : (
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <StatCard icon={Users2} label="Official Candidates" value={stats.candidates} iconColor="#B45309" borderColor="#D4AF37" />
          <StatCard icon={Gavel} label="Board of Judges" value={stats.judges} iconColor="#D97706" borderColor="#D97706" />
          <StatCard icon={Lock} label="Certified Scores" value={stats.locked} iconColor="#15803D" borderColor="#16A34A" />
          <StatCard
            icon={Activity}
            label="Locking Progress"
            value={`${lockPct}%`}
            iconColor="#D97706"
            borderColor="#B45309"
            sub={`${stats.locked} of ${stats.total} total scores`}
          />
        </div>
      )}

      {!loading && (
        <div className="card" style={{ marginTop: 22, padding: '20px 22px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>Competition Scoring Progress</h3>
            </div>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#B45309' }}>{lockPct}% Certified &amp; Locked</span>
          </div>
          <div className="progress-bar-track" style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${lockPct}%`,
                height: '100%',
                background: lockPct === 100 ? '#15803D' : 'linear-gradient(90deg, #D97706, #F59E0B)',
                transition: 'width 0.4s ease',
                borderRadius: 999
              }}
            />
          </div>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>{stats.locked}</strong> scores certified and locked &bull; <strong>{stats.total - stats.locked}</strong> scores still in draft or awaiting judge submission
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

function StatCard({ icon: Icon, label, value, sub, iconColor = 'var(--pageant-primary)', borderColor = 'var(--border)' }) {
  return (
    <div className="card" style={{
      padding: '20px 20px 18px',
      borderRadius: 14,
      border: '1px solid var(--border)',
      borderTop: `3.5px solid ${borderColor}`,
      background: 'var(--bg-surface)',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ padding: '7px 8px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={iconColor} strokeWidth={2.4} />
        </div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{sub}</div>}
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
