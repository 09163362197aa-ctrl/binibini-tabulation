import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPageantCriteria } from '../../lib/criteriaSync'
import {
  Crown,
  Megaphone,
  Trophy,
  Layers,
  Lock,
  LockOpen,
  Clock,
  Edit3,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Users,
  Sparkles
} from 'lucide-react'
import { CandidatePill } from '../../components/CandidateBadge'
import crownImg from '../../assets/pdf/crown.png'
import './JudgeSummary.css'

export default function JudgeSummary() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [toast, setToast]           = useState(null)
  const [requestingKey, setRequestingKey] = useState(null)

  // Criteria & Raw DB Data
  const [criteria, setCriteria]       = useState([])
  const [cheerCriteria, setCheerCriteria] = useState([])
  const [candidates, setCandidates]   = useState([])
  const [teams, setTeams]             = useState([])
  const [scores, setScores]           = useState([])
  const [unlockReqs, setUnlockReqs]   = useState([])

  const activeComp = 'pageant'
  const initialStageTab = searchParams.get('stage') || 'overall'
  const [activePageantTab, setActivePageantTab] = useState(initialStageTab)
  const selectedDivision = 'binibini'

  function showToast(msg, kind = 'success') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const pCriteria = await getPageantCriteria()
        setCriteria(pCriteria)

        const { data: cheerCrit } = await supabase
          .from('criteria')
          .select('id, key, label, max_score, display_order, parent_id')
          .eq('competition_type', 'cheerdance')
          .order('display_order')
        setCheerCriteria(cheerCrit || [])

        const [
          { data: teamsData },
          { data: scoresData, error: scoreErr },
          { data: reqsData, error: reqErr }
        ] = await Promise.all([
          supabase
            .from('teams')
            .select(`
              id, name, logo_url,
              team_entries (
                id, competition_type,
                candidates ( id, category, name, candidate_number )
              )
            `)
            .order('name'),
          supabase
            .from('scores')
            .select('id, team_entry_id, candidate_id, criterion_id, value, is_locked')
            .eq('judge_id', user.id),
          supabase
            .from('unlock_requests')
            .select('id, team_entry_id, candidate_id, stage_id, status')
            .eq('judge_id', user.id)
            .eq('status', 'pending')
        ])

        if (scoreErr) throw scoreErr
        if (reqErr) throw reqErr

        setTeams(teamsData || [])
        setScores(scoresData || [])
        setUnlockReqs(reqsData || [])

        const cList = (teamsData || [])
          .flatMap(t => {
            const pageantEntry = t.team_entries?.find(e => e.competition_type === 'pageant')
            if (!pageantEntry) return []
            return (pageantEntry.candidates || [])
              .filter(c => c.category === 'binibini')
              .map(c => ({
                ...c,
                team_id: t.id,
                team_name: t.name,
                team_entry_id: pageantEntry.id
              }))
          })
          .sort((a, b) => {
            const numA = a.candidate_number != null ? a.candidate_number : 99999
            const numB = b.candidate_number != null ? b.candidate_number : 99999
            if (numA !== numB) return numA - numB
            if (a.category !== b.category) {
              return a.category === 'binibini' ? -1 : 1
            }
            return (a.name || '').localeCompare(b.name || '')
          })

        setCandidates(cList)
      } catch (err) {
        console.error('Error loading scores summary:', err)
        setError(err.message || 'Failed to load scores overview')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  async function handleRequestUnlock(candidateId, teamEntryId, stageId) {
    const key = `${candidateId || teamEntryId}_${stageId}`
    setRequestingKey(key)
    try {
      const payload = {
        judge_id:      user.id,
        candidate_id:  candidateId || null,
        team_entry_id: candidateId ? null : teamEntryId,
        status:        'pending',
      }
      if (stageId && stageId !== 'overall') {
        payload.stage_id = stageId
      }
      const { error } = await supabase.from('unlock_requests').insert(payload)
      if (error) throw error

      showToast('Unlock request sent to admin')
      setUnlockReqs(prev => [...prev, payload])
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    } finally {
      setRequestingKey(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="js-page" style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
        <div className="card" style={{ border: '1px solid var(--error)', background: 'var(--bg-error)', padding: 32, borderRadius: 12 }}>
          <AlertTriangle size={32} color="var(--error)" style={{ marginBottom: 12 }} />
          <h2 style={{ color: 'var(--error)', margin: '0 0 8px', fontSize: '1.2rem' }}>Error Loading Scores</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.88rem' }}>{error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  const parentStages = criteria
    .filter(c => !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  function formatHeaderLabel(label) {
    if (!label) return ''
    return label.replace(/\s+and\s+/gi, ' & ')
  }

  function getStageChildren(stageId) {
    return criteria
      .filter(c => c.parent_id === stageId)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  }

  const activeStageObject = parentStages.find(p => p.id === activePageantTab || p.key === activePageantTab)

  function getCandidateStageData(candidateId, stageId) {
    const stageKids = getStageChildren(stageId)
    const stageKidIds = stageKids.map(k => k.id)

    const relevantScores = scores.filter(s =>
      s.candidate_id === candidateId && stageKidIds.includes(s.criterion_id)
    )

    const isLocked = relevantScores.length > 0 && relevantScores.every(s => s.is_locked)
    const hasPending = unlockReqs.some(r =>
      r.candidate_id === candidateId && (r.stage_id === stageId || !r.stage_id)
    )

    // Direct scoring: stored value IS the entered score, plain sum
    const enteredScores = {}
    let stageSubtotal = 0
    let stageMaxTotal = 0

    stageKids.forEach(kid => {
      const match = scores.find(s => s.candidate_id === candidateId && s.criterion_id === kid.id)
      if (match) {
        enteredScores[kid.id] = Number(match.value)
        stageSubtotal += Number(match.value) || 0
      } else {
        enteredScores[kid.id] = null
      }
      stageMaxTotal += (kid.max_score || 0)
    })

    const isCompleted = stageKids.every(k => enteredScores[k.id] !== null && enteredScores[k.id] !== undefined)

    let status = 'not-started'
    if (isLocked) status = 'locked'
    else if (hasPending) status = 'pending'
    else if (isCompleted) status = 'draft'

    return {
      enteredScores,
      stageSubtotal,
      stageMaxTotal,
      isCompleted,
      isLocked,
      hasPending,
      status
    }
  }

  return (
    <div className="js-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 22 }}>
        <div className="page-header-left" style={{ width: '100%' }}>
          {/* Top Navigation & Status Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/judge')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  background: '#0E3429',
                  border: '1.5px solid #D4AF37',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  color: '#FEF3C7',
                  boxShadow: '0 2px 6px rgba(14, 52, 41, 0.16)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowLeft size={16} strokeWidth={2.4} />
                <span>Back to Scoring</span>
              </button>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: 'rgba(14, 52, 41, 0.08)',
                borderRadius: 8,
                border: '1px solid rgba(212, 175, 55, 0.45)'
              }}>
                <img src={crownImg} alt="Crown" style={{ width: 18, height: 'auto', objectFit: 'contain' }} />
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0E3429', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Binibining Palayan
                </span>
              </div>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#0E3429',
              background: 'rgba(14, 52, 41, 0.08)',
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid rgba(212, 175, 55, 0.45)'
            }}>
              <span>{candidates.length} Official Candidates</span>
            </div>
          </div>

          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Score Verification &amp; Summary
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Review your submitted evaluations, criteria breakdowns, and certification status
          </p>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. BINIBINING PALAYAN OVERVIEW SCREEN                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(() => {
        const displayCandidates = candidates

        return (
          <div>
            {/* Stage Tabs Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 18
            }}>
              {/* Stage Sub-Tabs */}
              <div style={{
                display: 'inline-flex',
                background: 'var(--bg-elevated)',
                padding: 4,
                borderRadius: 12,
                border: '1px solid var(--border)',
                gap: 5,
                flexWrap: 'wrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                {parentStages.map(stage => {
                  const isActive = activePageantTab === stage.id || activePageantTab === stage.key
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        border: isActive ? '1px solid #D4AF37' : '1px solid transparent',
                        background: isActive ? 'linear-gradient(135deg, #0A271E 0%, #0E3429 100%)' : 'transparent',
                        color: isActive ? '#FEF3C7' : 'var(--text-secondary)',
                        fontWeight: isActive ? 800 : 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 8px rgba(14, 52, 41, 0.25)' : 'none'
                      }}
                      onClick={() => setActivePageantTab(stage.id)}
                    >
                      {stage.label}
                    </button>
                  )
                })}

                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: activePageantTab === 'overall' ? '1px solid #D4AF37' : '1px solid transparent',
                    background: activePageantTab === 'overall' ? 'linear-gradient(135deg, #0A271E 0%, #0E3429 100%)' : 'transparent',
                    color: activePageantTab === 'overall' ? '#FEF3C7' : 'var(--text-secondary)',
                    fontWeight: activePageantTab === 'overall' ? 800 : 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: activePageantTab === 'overall' ? '0 2px 8px rgba(14, 52, 41, 0.25)' : 'none'
                  }}
                  onClick={() => setActivePageantTab('overall')}
                >
                  <Trophy size={15} color={activePageantTab === 'overall' ? '#FDE68A' : 'currentColor'} />
                  <span>Overall</span>
                </button>
              </div>
            </div>

            {/* ── STAGE SPECIFIC TAB (Sportswear, Talent, Q&A) ────────── */}
            {activePageantTab !== 'overall' && activeStageObject && (() => {
              const stageKids = getStageChildren(activeStageObject.id)

              // Compute scores and sort candidates by rank descending
              const stageCandidateList = displayCandidates.map(c => {
                const sData = getCandidateStageData(c.id, activeStageObject.id)
                const score = sData.isCompleted ? sData.stageSubtotal : -1
                return { c, sData, score }
              })

              stageCandidateList.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score
                if (a.c.candidate_number != null && b.c.candidate_number != null) {
                  return a.c.candidate_number - b.c.candidate_number
                }
                return (a.c.name || '').localeCompare(b.c.name || '')
              })

              return (
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <div style={{ padding: '14px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {activeStageObject.label} Evaluation Breakdown &amp; Standings
                      </h2>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {selectedDivision === 'ginoo' ? 'Ginoo Division — ' : selectedDivision === 'binibini' ? 'Binibini Division — ' : 'All Candidates — '}
                        Ranked by highest score first
                      </p>
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--pageant-primary)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {displayCandidates.length} {selectedDivision === 'ginoo' ? 'Ginoo Candidates' : selectedDivision === 'binibini' ? 'Binibini Candidates' : 'Candidates'}
                    </span>
                  </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)' }}>
                        <th style={{
                          padding: '12px 16px',
                          minWidth: 220,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          position: 'sticky',
                          left: 0,
                          background: 'var(--bg-surface)',
                          zIndex: 2,
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                          boxShadow: '2px 0 6px rgba(0,0,0,0.03)'
                        }}>
                          Candidate
                        </th>
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 120,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Barangay
                        </th>
                        {stageKids.map(k => (
                          <th
                            key={k.id}
                            style={{
                              padding: '12px 12px',
                              minWidth: 140,
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)',
                              fontWeight: 800,
                              textAlign: 'center',
                              lineHeight: 1.35,
                              verticalAlign: 'middle',
                              whiteSpace: 'normal',
                              wordBreak: 'normal',
                              overflowWrap: 'normal',
                              hyphens: 'none',
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)'
                            }}
                          >
                            {formatHeaderLabel(k.label)}
                          </th>
                        ))}
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 105,
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.35,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Stage Total
                        </th>
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 110,
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.35,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageCandidateList.map(({ c, sData }) => {
                        const reqKey = `${c.id}_${activeStageObject.id}`

                        return (
                          <tr key={c.id}>
                            <td style={{
                              padding: '12px 16px',
                              minWidth: 180,
                              position: 'sticky',
                              left: 0,
                              background: 'var(--bg-surface)',
                              zIndex: 1,
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)',
                              boxShadow: '2px 0 6px rgba(0,0,0,0.03)'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {c.candidate_number != null && (
                                    <CandidatePill number={c.candidate_number} category={c.category} />
                                  )}
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: c.category === 'ginoo' ? 'rgba(46,125,50,0.1)' : 'rgba(192,57,43,0.1)',
                                    color: c.category === 'ginoo' ? 'var(--pageant-primary)' : '#c0392b',
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                  }}>
                                    {c.category === 'ginoo' ? 'Ginoo' : 'Binibini'}
                                  </span>
                                </div>
                                <span style={{
                                  fontWeight: 700,
                                  fontSize: '0.92rem',
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.3,
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal'
                                }}>
                                  {c.name || (c.category === 'ginoo' ? 'Ginoo' : 'Binibini')}
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                              {c.team_name}
                            </td>

                            {stageKids.map(k => {
                              const val = sData.enteredScores[k.id]
                              return (
                                <td key={k.id} style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                                  {val != null
                                    ? <>{val % 1 === 0 ? val : val.toFixed(2)}<span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 2 }}>/ {k.max_score}</span></>
                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                              )
                            })}

                            <td style={{ padding: '12px 14px', textAlign: 'center', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                              {sData.isCompleted ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                                    {sData.stageSubtotal % 1 === 0 ? sData.stageSubtotal : sData.stageSubtotal.toFixed(2)}
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>/ {sData.stageMaxTotal}</span>
                                  </span>
                                  {activeStageObject?.max_score != null && (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', marginTop: 1 }}>
                                      {((sData.stageSubtotal / (sData.stageMaxTotal || 100)) * activeStageObject.max_score).toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending</span>
                              )}
                            </td>

                            <td style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              {sData.isLocked ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                    <Lock size={11} strokeWidth={2.5} /> Locked
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-xs"
                                    style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '3px 8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: sData.hasPending ? '#fef3c7' : 'rgba(242, 183, 5, 0.12)',
                                      color: sData.hasPending ? '#92400e' : '#B45309',
                                      border: sData.hasPending ? '1px solid #fde68a' : '1px solid rgba(242, 183, 5, 0.35)',
                                      borderRadius: 5,
                                      cursor: sData.hasPending ? 'default' : 'pointer'
                                    }}
                                    disabled={requestingKey === reqKey || sData.hasPending}
                                    onClick={() => handleRequestUnlock(c.id, c.team_entry_id, activeStageObject.id)}
                                  >
                                    <LockOpen size={11} color="#D97706" strokeWidth={2.2} />
                                    {requestingKey === reqKey ? 'Sending…' : sData.hasPending ? 'Unlock Pending' : 'Request Unlock'}
                                  </button>
                                </div>
                              ) : sData.hasPending ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#fef3c7', color: '#854d0e', border: '1px solid #fde047' }}>
                                  <Clock size={11} /> Unlock Pending
                                </span>
                              ) : sData.isCompleted ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>
                                    <Edit3 size={11} /> Draft
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                                    onClick={() => navigate(`/judge/score/pageant/${c.id}?stage=${activeStageObject.id}`)}
                                  >
                                    Edit Score
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  style={{ fontSize: '0.74rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => navigate(`/judge/score/pageant/${c.id}?stage=${activeStageObject.id}`)}
                                >
                                  <span>Score</span> <ArrowRight size={11} />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

            {/* ── OVERALL TAB (Combined weighted 50% total across all stages) ─────── */}
            {activePageantTab === 'overall' && (() => {
              const totalMaxWeight = parentStages.reduce((sum, st) => sum + Number(st.max_score || 0), 0)

              const overallCandidateList = displayCandidates.map(c => {
                let combinedTotal = 0
                let lockedCount = 0

                const stageSummaries = parentStages.map(stage => {
                  const sData = getCandidateStageData(c.id, stage.id)
                  const stageWeight = stage.max_score != null ? Number(stage.max_score) : (sData.stageMaxTotal || 100)
                  const stageWeighted = (sData.stageSubtotal / (sData.stageMaxTotal || 100)) * stageWeight
                  if (sData.isLocked) {
                    lockedCount++
                    combinedTotal += stageWeighted
                  }
                  return { stage, stageWeight, stageWeighted, ...sData }
                })

                const allLocked = lockedCount === parentStages.length
                const score = lockedCount > 0 ? combinedTotal : -1
                return { c, stageSummaries, combinedTotal, lockedCount, allLocked, score }
              })

              // Sort by overall total score descending
              overallCandidateList.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score
                if (a.c.candidate_number != null && b.c.candidate_number != null) {
                  return a.c.candidate_number - b.c.candidate_number
                }
                return (a.c.name || '').localeCompare(b.c.name || '')
              })

              return (
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <div style={{ padding: '14px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        Combined Overall Pageant Standings &amp; Rankings
                      </h2>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {selectedDivision === 'ginoo' ? 'Ginoo Division — ' : selectedDivision === 'binibini' ? 'Binibini Division — ' : 'All Candidates — '}
                        Ranked by highest combined total
                      </p>
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--pageant-primary)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {displayCandidates.length} {selectedDivision === 'ginoo' ? 'Ginoo Candidates' : selectedDivision === 'binibini' ? 'Binibini Candidates' : 'Candidates'}
                    </span>
                  </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)' }}>
                        <th style={{
                          padding: '12px 16px',
                          minWidth: 220,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          position: 'sticky',
                          left: 0,
                          background: 'var(--bg-surface)',
                          zIndex: 2,
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                          boxShadow: '2px 0 6px rgba(0,0,0,0.03)'
                        }}>
                          Candidate
                        </th>
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 120,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Barangay
                        </th>
                        {parentStages.map(stage => (
                          <th
                            key={stage.id}
                            style={{
                              padding: '12px 12px',
                              minWidth: 140,
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)',
                              fontWeight: 800,
                              textAlign: 'center',
                              lineHeight: 1.35,
                              verticalAlign: 'middle',
                              whiteSpace: 'normal',
                              wordBreak: 'normal',
                              overflowWrap: 'normal',
                              hyphens: 'none',
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)'
                            }}
                          >
                            {formatHeaderLabel(stage.label)}
                          </th>
                        ))}
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 115,
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.35,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Overall Score
                        </th>
                        <th style={{
                          padding: '12px 14px',
                          minWidth: 105,
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          fontWeight: 800,
                          textAlign: 'center',
                          lineHeight: 1.35,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallCandidateList.map(({ c, stageSummaries, combinedTotal, lockedCount, allLocked }) => {
                        return (
                          <tr key={c.id}>
                            <td style={{
                              padding: '12px 16px',
                              minWidth: 180,
                              position: 'sticky',
                              left: 0,
                              background: 'var(--bg-surface)',
                              zIndex: 1,
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)',
                              boxShadow: '2px 0 6px rgba(0,0,0,0.03)'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {c.candidate_number != null && (
                                    <CandidatePill number={c.candidate_number} category={c.category} />
                                  )}
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: c.category === 'ginoo' ? 'rgba(46,125,50,0.1)' : 'rgba(192,57,43,0.1)',
                                    color: c.category === 'ginoo' ? 'var(--pageant-primary)' : '#c0392b',
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                  }}>
                                    {c.category === 'ginoo' ? 'Ginoo' : 'Binibini'}
                                  </span>
                                </div>
                                <span style={{
                                  fontWeight: 700,
                                  fontSize: '0.92rem',
                                  color: 'var(--text-primary)',
                                  lineHeight: 1.3,
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal'
                                }}>
                                  {c.name || (c.category === 'ginoo' ? 'Ginoo' : 'Binibini')}
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '12px 16px', fontSize: '0.84rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                              {c.team_name}
                            </td>

                            {stageSummaries.map(({ stage, isLocked, stageSubtotal, stageMaxTotal, stageWeighted, hasPending }) => (
                              <td key={stage.id} style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                                {isLocked ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                      {stageSubtotal % 1 === 0 ? stageSubtotal : stageSubtotal.toFixed(2)}
                                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>/ {stageMaxTotal}</span>
                                    </span>
                                    {stage.max_score != null && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706' }}>
                                        {stageWeighted.toFixed(2)}%
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <Lock size={10} strokeWidth={2.5} /> Locked
                                    </span>
                                  </div>
                                ) : hasPending ? (
                                  <span style={{ fontSize: '0.74rem', color: '#854d0e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Clock size={10} /> Pending
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                            ))}

                            <td style={{ padding: '12px 14px', textAlign: 'center', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                              {lockedCount > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: allLocked ? 'var(--pageant-primary)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {combinedTotal.toFixed(2)}%
                                    {totalMaxWeight > 0 && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 3 }}>
                                        / {totalMaxWeight}%
                                      </span>
                                    )}
                                  </span>
                                  {!allLocked && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                      ({lockedCount}/{parentStages.length} locked)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending</span>
                              )}
                            </td>

                            <td style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                              {allLocked ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                                  <CheckCircle2 size={11} strokeWidth={2.5} /> Complete
                                </span>
                              ) : lockedCount > 0 ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>
                                  {lockedCount}/{parentStages.length} Locked
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>In Progress</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )})()}

      {/* Toast notifications */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  )
}
