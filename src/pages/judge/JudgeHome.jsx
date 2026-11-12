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
  Layers,
  Trophy,
  FileSpreadsheet,
  Users2
} from 'lucide-react'
import { CandidateRibbon, CandidatePill } from '../../components/CandidateBadge'
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
          id, name, logo_url,
          team_entries (
            id, competition_type, photo_url,
            candidates ( id, category, name, photo_url, candidate_number )
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
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div className="page-header-left">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(217,119,6,0.1)', borderRadius: 6, border: '1px solid rgba(217,119,6,0.25)', marginBottom: 8 }}>
              <Crown size={14} color="#D97706" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Binibining Palayan Judge Portal
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
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
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 6
            }}
            onClick={() => navigate('/judge/summary?comp=pageant')}
          >
            <FileSpreadsheet size={15} color="#D97706" />
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
                        <Layers size={20} color="#D97706" />
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
                      {stageKids.length > 0 ? `${stageKids.length} Criteria • Max ${maxScore} pts` : 'Pageant Evaluation Segment'}
                    </div>

                    {/* Progress Bar */}
                    <div className="jh-stage-progress-bar-bg">
                      <div
                        className="jh-stage-progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: isCompleted
                            ? 'linear-gradient(90deg, #16A34A, #22C55E)'
                            : 'linear-gradient(90deg, #D97706, #F59E0B)'
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
                        <span className="jh-stage-stat-val" style={{ color: '#B45309' }}>
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

    // Binibining Palayan Colors
    const stripeColor = '#d97706'

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
          border: '1px solid var(--border)',
          borderLeft: `6px solid ${stripeColor}`,
          background: isLocked ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          boxShadow: isLocked ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
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

        {/* Candidate Photo */}
        <div style={{ position: 'relative', width: 48, height: 48, minWidth: 48, flexShrink: 0 }}>
          <img
            src={c.photo_url || '/palayan.png'}
            alt={c.name}
            loading="lazy"
            decoding="async"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid var(--border)'
            }}
          />
        </div>

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
              background: '#b45309',
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1
            }}>
              Binibini
            </span>

            {/* Team Identity Pill (Logo + Name as one distinct unit) */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 10px 2px 3px',
              borderRadius: 999,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(217,119,6,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: '#b45309',
                  flexShrink: 0
                }}>
                  {team.name.charAt(0)}
                </div>
              )}
              <span style={{
                fontSize: '0.8rem',
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
          padding: '4px 9px',
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
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 6
          }}
          onClick={() => navigate(`/judge/summary?comp=pageant&stage=${selectedStageId}`)}
        >
          <FileSpreadsheet size={15} color="#D97706" />
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
