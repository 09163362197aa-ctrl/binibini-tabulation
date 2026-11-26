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
  const [stats, setStats] = useState({
    candidates: 0,
    judges: 0,
    locked: 0,
    draft: 0,
    notStarted: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [
      { data: candidatesData },
      { data: judgesData },
      { data: criteriaData },
      { data: scoresData },
    ] = await Promise.all([
      supabase.from('candidates').select('id, category'),
      supabase.from('profiles').select('id, allowed_competitions').eq('role', 'judge'),
      supabase.from('criteria').select('id, parent_id, competition_type').eq('competition_type', 'pageant'),
      supabase.from('scores').select('judge_id, candidate_id, criterion_id, is_locked'),
    ])

    const activeCandidates = (candidatesData || []).filter(c => c.category === 'binibini')
    const activeJudges = (judgesData || []).filter(j => (j.allowed_competitions || ['pageant']).includes('pageant'))
    const stages = (criteriaData || []).filter(c => !c.parent_id)
    const childCriteria = (criteriaData || []).filter(c => c.parent_id != null)
    const scores = scoresData || []

    // Build quick lookup map: `${judge_id}:${candidate_id}:${criterion_id}` -> is_locked
    const scoreMap = new Map()
    for (const s of scores) {
      if (s.judge_id && s.candidate_id && s.criterion_id) {
        scoreMap.set(`${s.judge_id}:${s.candidate_id}:${s.criterion_id}`, Boolean(s.is_locked))
      }
    }

    // Count expected (candidate × judge × stage) evaluations accurately
    const totalExpected = activeCandidates.length * activeJudges.length * stages.length
    let lockedCount = 0
    let draftCount = 0

    for (const stg of stages) {
      const stageKids = childCriteria.filter(c => c.parent_id === stg.id)
      const targetCritIds = stageKids.length > 0 ? stageKids.map(c => c.id) : [stg.id]

      for (const cand of activeCandidates) {
        for (const judge of activeJudges) {
          let foundAny = false
          let allLocked = targetCritIds.length > 0

          for (const cid of targetCritIds) {
            const val = scoreMap.get(`${judge.id}:${cand.id}:${cid}`)
            if (val !== undefined) {
              foundAny = true
              if (!val) allLocked = false
            } else {
              allLocked = false
            }
          }

          if (foundAny && allLocked) lockedCount++
          else if (foundAny) draftCount++
        }
      }
    }

    const notStartedCount = Math.max(0, totalExpected - lockedCount - draftCount)

    setStats({
      candidates: activeCandidates.length,
      judges: activeJudges.length,
      locked: lockedCount,
      draft: draftCount,
      notStarted: notStartedCount,
      total: totalExpected
    })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'criteria' }, debouncedLoad)
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
          <StatCard
            icon={Lock}
            label="Certified Stage Scores"
            value={stats.locked}
            iconColor="#15803D"
            borderColor="#16A34A"
            sub={`of ${stats.total} stage evaluations`}
          />
          <StatCard
            icon={Activity}
            label="Locking Progress"
            value={`${lockPct}%`}
            iconColor="#D97706"
            borderColor="#B45309"
            sub={`${stats.locked} locked • ${stats.draft} draft • ${stats.notStarted} pending`}
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
            <strong>{stats.locked}</strong> stage evaluations certified and locked &bull; <strong>{stats.draft}</strong> in draft &bull; <strong>{stats.notStarted}</strong> awaiting judge submission
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
