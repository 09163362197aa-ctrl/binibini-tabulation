import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPageantCriteria } from '../../lib/criteriaSync'
import {
  Megaphone,
  Crown,
  Sparkles,
  Lock,
  Clock,
  FileEdit,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trophy,
  FileSpreadsheet,
  Users2
} from 'lucide-react'
import { CandidateRibbon, CandidatePill } from '../../components/CandidateBadge'
import palayanLogo from '../../assets/pdf/palayan-logo.png'
import crownImg from '../../assets/pdf/crown.png'
import titleImg from '../../assets/pdf/title.png'
import './JudgeHome.css'

export default function JudgeHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [teams, setTeams]           = useState([])
  const [scores, setScores]         = useState([])
  const [pageantCriteria, setPageantCriteria] = useState([])
  const [loading, setLoading]       = useState(true)

  const selectedComp = 'pageant'
  const selectedStageId = searchParams.get('stage') || null

  const load = useCallback(async () => {
    const criteria = await getPageantCriteria()
    setPageantCriteria(criteria)

    const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
      supabase
        .from('teams')
        .select(`
          id, name,
          team_entries (
            id, competition_type,
            candidates ( id, category, name, candidate_number )
          )
        `)
        .order('name'),
      supabase
        .from('scores')
        .select('id, team_entry_id, candidate_id, criterion_id, is_locked')
        .eq('judge_id', user.id),
    ])
    setTeams(teamsData || [])
    setScores(scoresData || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()

    let debounceTimer = null
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        load()
      }, 350)
    }

    const channel = supabase
      .channel(`judge-home-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `judge_id=eq.${user.id}` }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unlock_requests', filter: `judge_id=eq.${user.id}` }, debouncedLoad)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [load, selectedComp, selectedStageId, user.id])

  /* ── Helpers ────────────────────────────────────────────────── */

  function getStageCriterionIds(stageId) {
    return pageantCriteria.filter(c => c.parent_id === stageId).map(c => c.id)
  }

  function getCandidateStageStatus(candidateId, stageId) {
    const stageCritIds = getStageCriterionIds(stageId)
    if (stageCritIds.length === 0) return 'not-started'
    const relevant = scores.filter(s =>
      s.candidate_id === candidateId && stageCritIds.includes(s.criterion_id)
    )
    if (relevant.length === 0) return 'not-started'
    if (relevant.every(s => s.is_locked)) return 'locked'
    return 'draft'
  }

  function getCandidateStageScore(candidateId, stageId) {
    const stageCritIds = getStageCriterionIds(stageId)
    if (stageCritIds.length === 0) return 0
    return scores
      .filter(s => s.candidate_id === candidateId && stageCritIds.includes(s.criterion_id))
      .reduce((sum, s) => sum + (Number(s.value) || 0), 0)
  }

  function getEntryStatus(entryId, candidateId) {
    const relevant = scores.filter(s =>
      candidateId ? s.candidate_id === candidateId : s.team_entry_id === entryId
    )
    if (relevant.length === 0) return 'not-started'
    if (relevant.every(s => s.is_locked)) return 'locked'
    return 'draft'
  }

  const pageantStages = pageantCriteria
    .filter(c => !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(p => ({
      id: p.id,
      label: p.label
    }))

  const selectedStageInfo = pageantStages.find(s => s.id === selectedStageId) || null

  function getStageStats(stageId) {
    const allCandidates = teams.flatMap(t =>
      t.team_entries?.find(e => e.competition_type === 'pageant')?.candidates || []
    )
    let total = allCandidates.length, locked = 0, draft = 0
    allCandidates.forEach(c => {
      const st = getCandidateStageStatus(c.id, stageId)
      if (st === 'locked') locked++
      else if (st === 'draft') draft++
    })
    return { total, locked, draft }
  }

  function getCompStats(compType) {
    const compEntries = teams.flatMap(t => t.team_entries?.filter(e => e.competition_type === compType) || [])
    let total = 0, done = 0, draft = 0
    if (compType === 'cheerdance') {
      compEntries.forEach(entry => {
        total++
        const st = getEntryStatus(entry.id, null)
        if (st === 'locked') done++
        else if (st === 'draft') draft++
      })
    } else {
      compEntries.forEach(entry => {
        entry.candidates?.forEach(c => {
          total++
          const st = getEntryStatus(entry.id, c.id)
          if (st === 'locked') done++
          else if (st === 'draft') draft++
        })
      })
    }
    return { total, done, draft, remaining: total - done - draft }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    )
  }

  /* ── Binibining Palayan Stage Picker ────────────────────────────────── */
  if (!selectedStageId) {
    return (
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Royal Emerald Green + Gold + White Glitter Pageant Hero Banner */}
        <div className="jh-hero-banner">
          <img src={palayanLogo} alt="Palayan City Logo" className="jh-hero-logo" />
          <div className="jh-hero-center">
            <img src={titleImg} alt="Binibining Palayan 2026" className="jh-hero-title-img" />
          </div>
          <img src={crownImg} alt="Binibining Palayan Crown" className="jh-hero-crown" />
        </div>

        {/* Tablet Distribution Banner: Clearly confirms judge assignment to prevent distribution confusion */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F4F9F6 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.5)',
          boxShadow: '0 2px 10px rgba(14, 52, 41, 0.06)',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0E3429 0%, #15803D 100%)',
              border: '2px solid #D4AF37',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FDE68A',
              fontWeight: 900,
              fontSize: '1.05rem',
              boxShadow: '0 2px 6px rgba(14, 52, 41, 0.25)',
              flexShrink: 0
            }}>
              {(profile?.name || 'J')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0E3429', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tablet Assigned Official Judge
              </div>
              <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0A271E', letterSpacing: '-0.01em' }}>
                {profile?.name || 'Official Judge'}
                {profile?.username && (
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#A67C14', marginLeft: 8 }}>
                    (@{profile.username})
                  </span>
                )}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.76rem',
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 20,
            background: '#0E3429',
            color: '#FDE68A',
            border: '1px solid #D4AF37',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Crown size={13} color="#D4AF37" /> Authorized Tablet
          </span>
        </div>

        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div className="page-header-left">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(14, 52, 41, 0.08)', borderRadius: 6, border: '1px solid rgba(212, 175, 55, 0.45)', marginBottom: 8 }}>
              <Crown size={14} color="#A67C14" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0E3429', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Binibining Palayan Judge Portal
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0A271E', letterSpacing: '-0.02em' }}>
              Evaluation Stages
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Choose a competition segment to evaluate and score candidates
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0E3429',
              border: '1.5px solid #D4AF37',
              color: '#FEF3C7',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(14, 52, 41, 0.16)'
            }}
            onClick={() => navigate('/judge/summary?comp=pageant')}
          >
            <FileSpreadsheet size={15} color="#D4AF37" />
            Review My Scores
          </button>
        </div>

        {pageantStages.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
              <Layers size={28} color="var(--text-muted)" />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No pageant stages found</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Please wait for the administrator to configure the pageant stage criteria.
            </p>
          </div>
        ) : (
          <div className="jh-stage-grid">
            {pageantStages.map(stage => {
              const stats = getStageStats(stage.id)
              const stageKids = pageantCriteria.filter(c => c.parent_id === stage.id)
              const maxScore = stageKids.reduce((acc, k) => acc + (k.max_score || 0), 0)
              const isCompleted = stats.total > 0 && stats.locked === stats.total
              const isInProgress = !isCompleted && (stats.locked > 0 || stats.draft > 0)
              const pct = stats.total > 0 ? Math.round((stats.locked / stats.total) * 100) : 0

              return (
                <button
                  key={stage.id}
                  type="button"
                  className="jh-stage-card card"
                  onClick={() => navigate(`/judge?comp=pageant&stage=${stage.id}`)}
                >
                  <div>
                    <div className="jh-stage-card-header">
                      <div className="jh-stage-icon-wrap">
                        <Layers size={20} color="#0E3429" />
                      </div>

                      {isCompleted ? (
                        <span className="jh-stage-status-badge completed">
                          <CheckCircle2 size={12} strokeWidth={2.4} /> Certified
                        </span>
                      ) : isInProgress ? (
                        <span className="jh-stage-status-badge inprogress">
                          <Clock size={12} strokeWidth={2.4} /> {pct}% Done
                        </span>
                      ) : (
                        <span className="jh-stage-status-badge ready">
                          Ready
                        </span>
                      )}
                    </div>

                    <div className="jh-stage-title">{stage.label}</div>
                    <div className="jh-stage-subtitle">
                      {stageKids.length > 0 ? `${stageKids.length} Criteria (100 pts) • Converted to ${stage.max_score || maxScore}% Overall` : 'Pageant Evaluation Segment'}
                    </div>

                    {/* Progress Bar */}
                    <div className="jh-stage-progress-bar-bg">
                      <div
                        className="jh-stage-progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: isCompleted
                            ? 'linear-gradient(90deg, #16A34A, #22C55E)'
                            : 'linear-gradient(90deg, #0E3429, #D4AF37)'
                        }}
                      />
                    </div>

                    {/* Clean Stats Grid */}
                    <div className="jh-stage-stats-row">
                      <div className="jh-stage-stat-item">
                        <span className="jh-stage-stat-val" style={{ color: 'var(--text-primary)' }}>
                          {stats.total}
                        </span>
                        <span className="jh-stage-stat-lbl">Candidates</span>
                      </div>
                      <div className="jh-stage-stat-item">
                        <span className="jh-stage-stat-val" style={{ color: 'var(--pageant-primary)' }}>
                          {stats.locked}
                        </span>
                        <span className="jh-stage-stat-lbl">Locked</span>
                      </div>
                      <div className="jh-stage-stat-item">
                        <span className="jh-stage-stat-val" style={{ color: '#0E3429' }}>
                          {stats.draft}
                        </span>
                        <span className="jh-stage-stat-lbl">Draft</span>
                      </div>
                    </div>
                  </div>

                  <div className="jh-stage-footer">
                    <span>Score Stage</span>
                    <ArrowRight size={14} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ── 4. Pageant Stage Candidate List ────────────────────────── */
  const allPageantCandidates = teams
    .flatMap(team => {
      const entry = team.team_entries?.find(e => e.competition_type === 'pageant')
      if (!entry) return []
      return (entry.candidates || [])
        .filter(c => c.category === 'binibini')
        .map(c => ({ candidate: c, team }))
    })
    .sort((a, b) => {
      const numA = a.candidate.candidate_number != null ? a.candidate.candidate_number : 99999
      const numB = b.candidate.candidate_number != null ? b.candidate.candidate_number : 99999
      if (numA !== numB) return numA - numB
      return (a.candidate.name || '').localeCompare(b.candidate.name || '')
    })

  const pendingCandidates = allPageantCandidates.filter(({ candidate }) =>
    getCandidateStageStatus(candidate.id, selectedStageId) !== 'locked'
  )
  const lockedCandidates = allPageantCandidates.filter(({ candidate }) =>
    getCandidateStageStatus(candidate.id, selectedStageId) === 'locked'
  )

  function CandidateCard({ candidate: c, team }) {
    const status = getCandidateStageStatus(c.id, selectedStageId)
    const isLocked = status === 'locked'
    const isDraft = status === 'draft'

    // Binibining Palayan Royal Emerald + Gold Colors
    const stripeColor = isLocked ? '#15803D' : '#D4AF37'

    return (
      <button
        type="button"
        className={`judge-candidate-card card ${isLocked ? 'card-locked' : ''}`}
        onClick={() => navigate(`/judge/score/pageant/${c.id}?stage=${selectedStageId}`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 18px',
          borderRadius: 14,
          border: '1px solid rgba(14, 52, 41, 0.14)',
          borderLeft: `6px solid ${stripeColor}`,
          background: isLocked ? '#F4F9F6' : '#FFFFFF',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          boxShadow: isLocked ? 'none' : '0 2px 8px rgba(14, 52, 41, 0.05)',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        {/* Candidate Number (Ribbon Badge) */}
        {c.candidate_number != null ? (
          <CandidateRibbon number={c.candidate_number} category={c.category} style={{ flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 44,
            height: 48,
            minWidth: 44,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-elevated)',
            border: '1.5px dashed var(--border)',
            color: 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '1rem',
            flexShrink: 0
          }}>
            —
          </div>
        )}

        {/* Candidate Name & Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 800,
            fontSize: '1.08rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            wordBreak: 'break-word'
          }}>
            {c.name || 'Binibini Candidate'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Category badge */}
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              background: '#0E3429',
              color: '#FDE68A',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1
            }}>
              Binibini
            </span>

            {/* Barangay Pill (Text-only for fast rendering) */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2
              }}>
                {team.name}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge & Arrow (Right side) */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 6,
          background: isLocked ? '#dcfce7' : isDraft ? '#fef9c3' : 'var(--bg-elevated)',
          color: isLocked ? '#166534' : isDraft ? '#854d0e' : 'var(--text-muted)',
          border: isLocked ? '1px solid #bbf7d0' : isDraft ? '1px solid #fde047' : '1px solid var(--border)',
          flexShrink: 0
        }}>
          {isLocked ? <Lock size={12} strokeWidth={2.5} /> : isDraft ? <FileEdit size={12} strokeWidth={2} /> : null}
          {isLocked ? 'Locked' : isDraft ? 'Draft' : 'Not Started'}
        </span>
        <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </button>
    )
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div className="page-header-left">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              load()
              navigate('/judge')
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', marginBottom: 8 }}
          >
            <ArrowLeft size={14} /> Back to Stages
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--pageant-primary)', textTransform: 'uppercase', background: 'rgba(46,125,50,0.08)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(46,125,50,0.2)' }}>
              Binibining Palayan
            </span>
            {selectedStageInfo && (
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                &bull; {selectedStageInfo.label}
              </span>
            )}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Select a Candidate
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Score all candidates for this stage
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#0E3429',
            border: '1.5px solid #D4AF37',
            color: '#FEF3C7',
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(14, 52, 41, 0.16)'
          }}
          onClick={() => navigate(`/judge/summary?comp=pageant&stage=${selectedStageId}`)}
        >
          <FileSpreadsheet size={15} color="#D4AF37" />
          Review My Scores
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pendingCandidates.length === 0 && lockedCandidates.length > 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', borderRadius: 12, border: '1px solid rgba(46,125,50,0.3)', background: 'rgba(46,125,50,0.04)', color: 'var(--pageant-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
            All candidates have been scored and certified for this stage!
          </div>
        ) : (
          pendingCandidates.map(({ candidate, team }) => (
            <CandidateCard key={candidate.id} candidate={candidate} team={team} />
          ))
        )}

        {lockedCandidates.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              <Lock size={13} />
              <span>Certified Candidates ({lockedCandidates.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lockedCandidates.map(({ candidate, team }) => (
                <CandidateCard key={candidate.id} candidate={candidate} team={team} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
