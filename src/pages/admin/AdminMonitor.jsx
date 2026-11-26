import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Radio,
  Lock,
  FileEdit,
  Clock,
  Megaphone,
  Crown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  ChevronRight,
  RotateCcw,
  Trash2
} from 'lucide-react'

export default function AdminMonitor() {
  const [judges, setJudges]       = useState([])
  const [entries, setEntries]     = useState([])
  const [scores, setScores]       = useState([])
  const [criteria, setCriteria]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const tab                       = 'binibini'
  const [selectedStageId, setSelectedStageId] = useState('all')
  const [toast, setToast]         = useState(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetting, setResetting] = useState(false)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleResetAllScores() {
    if (resetConfirmation.trim().toUpperCase() !== 'RESET') {
      showToast('Please type RESET in capital letters to confirm.', 'error')
      return
    }

    setResetting(true)
    try {
      // 1. Try calling the secure RPC function
      let { error: rpcErr } = await supabase.rpc('admin_reset_all_scores', {})

      if (rpcErr) {
        console.warn('RPC admin_reset_all_scores error:', rpcErr)
        // Try fallback: direct table deletion
        const { error: directErr } = await supabase
          .from('scores')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')

        if (directErr) {
          throw new Error(rpcErr.message || directErr.message || 'Failed to reset scores.')
        }

        try {
          await supabase.from('unlock_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        } catch (_) {}
      }

      // Check if scores actually cleared
      const { count: remainingCount } = await supabase.from('scores').select('*', { count: 'exact', head: true })
      
      if (remainingCount && remainingCount > 0) {
        throw new Error(rpcErr?.message ? `RPC Error: ${rpcErr.message}` : `Database RLS policy blocked deleting ${remainingCount} score(s).`)
      }

      setScores([])
      setShowResetModal(false)
      setResetConfirmation('')
      showToast('All scores have been reset to Not Started! Ready for a fresh competition.', 'success')
      await load()
    } catch (err) {
      console.error('Failed to reset competition scores:', err)
      showToast(err.message || 'Failed to reset scores.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const load = useCallback(async () => {
    try {
      const [
        { data: judgesData },
        { data: entriesData },
        { data: scoresData },
        { data: criteriaData }
      ] = await Promise.all([
        supabase.from('profiles').select('id, name, allowed_competitions').eq('role', 'judge').order('name'),
        supabase.from('team_entries').select('id, competition_type, team:teams(id, name), candidates(id, category, name, candidate_number)').order('competition_type'),
        supabase.from('scores').select('id, judge_id, team_entry_id, candidate_id, criterion_id, value, is_locked, updated_at'),
        supabase.from('criteria').select('id, key, label, max_score, parent_id, display_order, competition_type').order('display_order')
      ])

      setJudges(judgesData || [])
      setEntries(entriesData || [])
      setScores(scoresData || [])
      setCriteria(criteriaData || [])
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error loading admin monitor data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-monitor-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, (payload) => {
        setScores(prev => {
          if (payload.eventType === 'INSERT') {
            if (prev.some(s => s.id === payload.new.id)) return prev
            return [...prev, payload.new]
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(s => s.id !== payload.old.id)
          }
          return prev
        })
        setLastUpdate(new Date())
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  // Parse Criteria Structures
  const pageantStages = useMemo(() => {
    return (criteria || [])
      .filter(c => c.competition_type === 'pageant' && !c.parent_id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }, [criteria])

  const pageantChildren = useMemo(() => {
    return (criteria || []).filter(c => c.competition_type === 'pageant' && c.parent_id != null)
  }, [criteria])

  const cheerCriteria = useMemo(() => {
    return (criteria || []).filter(c => c.competition_type === 'cheerdance')
  }, [criteria])

  // Active Judges for Binibining Palayan
  const activeJudges = useMemo(() => {
    return judges.filter(j => (j.allowed_competitions || ['pageant']).includes('pageant'))
  }, [judges])

  // Scoreable units (Binibining Palayan Candidates sorted by candidate_number)
  const scoreables = useMemo(() => {
    const list = []
    entries.forEach(entry => {
      if (entry.competition_type === 'pageant') {
        entry.candidates?.forEach(c => {
          if (c.category === 'binibini') {
            list.push({
              id: entry.id,
              candidateId: c.id,
              label: c.name,
              sub: entry.team?.name,
              number: c.candidate_number,
              type: c.category
            })
          }
        })
      }
    })

    list.sort((a, b) => {
      const numA = a.number != null ? a.number : 99999
      const numB = b.number != null ? b.number : 99999
      if (numA !== numB) return numA - numB
      return (a.label || '').localeCompare(b.label || '')
    })
    return list
  }, [entries])

  // Helper: Get status of a judge for a specific pageant stage
  const getJudgeStageStatus = useCallback((judgeId, candidateId, stageId) => {
    const stageCriteria = pageantChildren.filter(c => c.parent_id === stageId)
    const targetCritIds = stageCriteria.length > 0
      ? stageCriteria.map(c => c.id)
      : [stageId]

    const judgeScores = scores.filter(s =>
      s.judge_id === judgeId &&
      s.candidate_id === candidateId &&
      targetCritIds.includes(s.criterion_id)
    )

    if (judgeScores.length === 0) return 'none'
    const allLocked = targetCritIds.length > 0 &&
      targetCritIds.every(cid => judgeScores.some(s => s.criterion_id === cid && s.is_locked))
    if (allLocked) return 'locked'
    return 'draft'
  }, [pageantChildren, scores])

  // Helper: Get overall status across all stages (or cheerdance)
  const getJudgeCellStatus = useCallback((judgeId, entryId, candidateId) => {
    if (tab === 'cheerdance') {
      const cheerCritIds = cheerCriteria.map(c => c.id)
      const judgeScores = scores.filter(s =>
        s.judge_id === judgeId &&
        s.team_entry_id === entryId
      )
      if (judgeScores.length === 0) return { status: 'none', lockedCount: 0, total: 1 }
      const allLocked = cheerCritIds.length > 0 &&
        cheerCritIds.every(cid => judgeScores.some(s => s.criterion_id === cid && s.is_locked))
      if (allLocked) return { status: 'locked', lockedCount: 1, total: 1 }
      return { status: 'draft', lockedCount: 0, total: 1 }
    }

    // Specific Pageant Stage Selected
    if (selectedStageId !== 'all') {
      const st = getJudgeStageStatus(judgeId, candidateId, selectedStageId)
      return { status: st, lockedCount: st === 'locked' ? 1 : 0, total: 1 }
    }

    // All Pageant Stages Overview
    if (pageantStages.length === 0) return { status: 'none', lockedCount: 0, total: 0 }
    let lockedStages = 0
    let draftStages = 0
    const stageDetails = []

    pageantStages.forEach(stg => {
      const st = getJudgeStageStatus(judgeId, candidateId, stg.id)
      stageDetails.push({ id: stg.id, label: stg.label, status: st })
      if (st === 'locked') lockedStages++
      else if (st === 'draft') draftStages++
    })

    let status = 'none'
    if (lockedStages === pageantStages.length && pageantStages.length > 0) status = 'locked'
    else if (lockedStages > 0 || draftStages > 0) status = 'draft'

    return {
      status,
      lockedCount: lockedStages,
      draftCount: draftStages,
      total: pageantStages.length,
      stageDetails
    }
  }, [tab, selectedStageId, cheerCriteria, scores, pageantStages, getJudgeStageStatus])

  // Summary Metrics Calculation
  const totalCells = scoreables.length * activeJudges.length
  let lockedCells = 0
  let draftCells = 0

  scoreables.forEach(s => {
    activeJudges.forEach(j => {
      const cell = getJudgeCellStatus(j.id, s.id, s.candidateId)
      if (cell.status === 'locked') lockedCells++
      else if (cell.status === 'draft') draftCells++
    })
  })

  const notStartedCells = Math.max(0, totalCells - lockedCells - draftCells)
  const progressPct = totalCells > 0 ? Math.round((lockedCells / totalCells) * 100) : 0

  const isGinoo = tab === 'ginoo'
  const isBinibini = tab === 'binibini'
  const isPageant = isGinoo || isBinibini

  return (
    <div style={{ width: '100%', paddingBottom: 40 }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(217,119,6,0.08)', borderRadius: 8, border: '1px solid rgba(217,119,6,0.22)', marginBottom: 8 }}>
            <Radio size={13} color="#D97706" />
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live Judging Monitor
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Official Scoring Matrix
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Real-time stage-by-stage evaluation stream, judge draft updates, and lock certifications
          </p>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Live Sync Status Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#15803D',
            background: 'rgba(21,128,61,0.08)',
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid rgba(21,128,61,0.22)'
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#16A34A',
              boxShadow: '0 0 6px rgba(22,163,74,0.6)',
              display: 'inline-block'
            }} />
            <span>Live Sync {lastUpdate ? `(${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})` : ''}</span>
          </div>

          {/* Quick Refresh Button */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={load}
            title="Refresh Scoring Matrix"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              borderRadius: 8,
              padding: '7px 14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={13} color="#D97706" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Unified Pageant Control & Progress Panel ──────────────── */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        {/* Row 1: Segment Selector & Legend */}
        <div style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid var(--border)'
        }}>
          {/* Segment Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#B45309',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <Crown size={15} color="#D97706" />
              <span>Segment:</span>
            </div>

            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-elevated)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid var(--border)',
              gap: 4,
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={() => setSelectedStageId('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: selectedStageId === 'all' ? 'linear-gradient(135deg, #D4AF37 0%, #B45309 100%)' : 'transparent',
                  color: selectedStageId === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: selectedStageId === 'all' ? 800 : 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedStageId === 'all' ? '0 2px 8px rgba(180,130,30,0.25)' : 'none'
                }}
              >
                <span>All Stages (Combined)</span>
              </button>

              {pageantStages.map(stage => {
                const isSelected = selectedStageId === stage.id
                let stageLockedPairs = 0
                scoreables.forEach(s => {
                  activeJudges.forEach(j => {
                    if (getJudgeStageStatus(j.id, s.candidateId, stage.id) === 'locked') {
                      stageLockedPairs++
                    }
                  })
                })

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStageId(stage.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: isSelected ? 'linear-gradient(135deg, #D4AF37 0%, #B45309 100%)' : 'transparent',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(180,130,30,0.25)' : 'none'
                    }}
                  >
                    <span>{stage.label}</span>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '1px 7px',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(255,255,255,0.28)' : 'var(--bg-surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                      fontWeight: 800
                    }}>
                      {stageLockedPairs}/{totalCells}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clean Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={12} strokeWidth={2.4} /> Certified
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>
              <FileEdit size={12} strokeWidth={2.2} /> Draft
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
              <AlertCircle size={12} strokeWidth={2} /> Pending
            </span>
          </div>
        </div>

        {/* Row 2: Integrated Live Progress Bar */}
        {!loading && totalCells > 0 && (
          <div style={{ padding: '12px 18px', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534' }}>
                  ✓ {lockedCells} Certified
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#854d0e' }}>
                  ✎ {draftCells} In Draft
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>
                  ⚠ {notStartedCells} Pending
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  &bull; {activeJudges.length} Judge{activeJudges.length !== 1 ? 's' : ''} Online
                </span>
              </div>
              <span style={{ fontSize: '0.86rem', fontWeight: 900, color: '#B45309' }}>
                {progressPct}% Certified
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${progressPct}%`,
                height: '100%',
                background: progressPct === 100 ? '#16A34A' : 'linear-gradient(90deg, #D97706, #F59E0B)',
                transition: 'width 0.4s ease',
                borderRadius: 999
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Matrix Table ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : scoreables.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <Radio size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No entries for Binibining Palayan</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Register teams and candidates to view the scoring matrix for this competition.
          </p>
        </div>
      ) : activeJudges.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <Radio size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No judges assigned to Binibining Palayan</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Assign judges to this competition under the Judges page to monitor their scores.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {/* Row header: Team / Candidate */}
                  <th style={{
                    padding: '14px 18px',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    position: 'sticky',
                    left: 0,
                    background: 'var(--bg-elevated)',
                    zIndex: 2,
                    minWidth: 220
                  }}>
                    {tab === 'cheerdance' ? 'Barangay' : 'Candidate'}
                  </th>

                  {/* Column headers: Judge names */}
                  {activeJudges.map(j => (
                    <th key={j.id} style={{
                      textAlign: 'center',
                      minWidth: 130,
                      padding: '12px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em'
                    }}>
                      {j.name || 'Unnamed Judge'}
                    </th>
                  ))}

                  {/* Summary column */}
                  <th style={{
                    textAlign: 'center',
                    padding: '12px 14px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    minWidth: 100
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {scoreables.map((s) => {
                  // Compute row summary
                  let rowLocked = 0
                  let rowDraft = 0
                  activeJudges.forEach(j => {
                    const cell = getJudgeCellStatus(j.id, s.id, s.candidateId)
                    if (cell.status === 'locked') rowLocked++
                    else if (cell.status === 'draft') rowDraft++
                  })
                  const allLocked = rowLocked === activeJudges.length && activeJudges.length > 0
                  const allNone = rowLocked === 0 && rowDraft === 0

                  return (
                    <tr key={`${s.id}-${s.candidateId || 'team'}`} style={{
                      borderBottom: '1px solid var(--border)',
                      background: allLocked ? (isBinibini ? 'rgba(217,119,6,0.03)' : 'rgba(46,125,50,0.03)') : 'transparent'
                    }}>
                      {/* Row label: Candidate Number, Photo & Team Name */}
                      <td style={{
                        padding: '12px 18px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: 'var(--text-primary)',
                        position: 'sticky',
                        left: 0,
                        background: allLocked
                          ? (isBinibini ? '#fffdfa' : '#fbfefb')
                          : 'var(--bg-surface)',
                        zIndex: 1,
                        boxShadow: '2px 0 6px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Squircle Number Badge */}
                          {s.number != null && (
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isGinoo
                                ? 'radial-gradient(circle at 40% 35%, #ffffff, #bbf7d0 45%, #4ade80 100%)'
                                : 'radial-gradient(circle at 40% 35%, #ffffff, #fef08a 45%, #fcd34d 100%)',
                              border: `1.5px solid ${isGinoo ? 'rgba(74,222,128,0.85)' : 'rgba(251,191,36,0.85)'}`,
                              flexShrink: 0
                            }}>
                              <span style={{ fontSize: '0.36rem', fontWeight: 800, color: isGinoo ? '#166534' : '#92400e', lineHeight: 1, textTransform: 'uppercase' }}>
                                NO.
                              </span>
                              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: isGinoo ? '#14532d' : '#78350f', lineHeight: 1.05 }}>
                                {s.number}
                              </span>
                            </div>
                          )}

                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              {s.label}
                            </div>
                            {s.sub && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 3,
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                background: 'var(--bg-elevated)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: '1px solid var(--border)'
                              }}>
                                <span>{s.sub}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Judge columns */}
                      {activeJudges.map(j => {
                        const cell = getJudgeCellStatus(j.id, s.id, s.candidateId)

                        return (
                          <td key={j.id} style={{ textAlign: 'center', padding: '10px 12px' }}>
                            {/* CASE 1: Single Stage View or Cheerdance */}
                            {selectedStageId !== 'all' || tab === 'cheerdance' ? (
                              cell.status === 'locked' ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: '#dcfce7',
                                  color: '#166534',
                                  border: '1px solid #bbf7d0'
                                }}>
                                  <CheckCircle2 size={13} strokeWidth={2.5} /> Locked
                                </span>
                              ) : cell.status === 'draft' ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: '#fef9c3',
                                  color: '#854d0e',
                                  border: '1px solid #fde047'
                                }}>
                                  <FileEdit size={13} strokeWidth={2.2} /> Draft
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: '#fef2f2',
                                  color: '#991b1b',
                                  border: '1px solid #fecaca'
                                }}>
                                  <AlertCircle size={12} strokeWidth={2} /> Not Started
                                </span>
                              )
                            ) : (
                              /* CASE 2: All Stages Combined Overview Mode */
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                {cell.status === 'locked' ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: '#dcfce7',
                                    color: '#166534',
                                    border: '1px solid #bbf7d0'
                                  }}>
                                    <CheckCircle2 size={12} strokeWidth={2.5} /> All Locked ({cell.lockedCount}/{cell.total})
                                  </span>
                                ) : cell.lockedCount > 0 || cell.draftCount > 0 ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: '#fef9c3',
                                    color: '#854d0e',
                                    border: '1px solid #fde047'
                                  }}>
                                    <FileEdit size={12} strokeWidth={2.2} /> {cell.lockedCount}/{cell.total} Stages
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: '#fef2f2',
                                    color: '#991b1b',
                                    border: '1px solid #fecaca'
                                  }}>
                                    <AlertCircle size={11} strokeWidth={2} /> 0/{cell.total}
                                  </span>
                                )}

                                {/* Mini Stage Dots */}
                                {cell.stageDetails && cell.stageDetails.length > 0 && (
                                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                                    {cell.stageDetails.map(sd => (
                                      <span
                                        key={sd.id}
                                        title={`${sd.label}: ${sd.status}`}
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          background: sd.status === 'locked' ? '#16a34a' : sd.status === 'draft' ? '#ca8a04' : '#ef4444'
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}

                      {/* Row summary */}
                      <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                        {allLocked ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '4px 9px',
                            borderRadius: 6,
                            background: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #bbf7d0'
                          }}>
                            <CheckCircle2 size={12} strokeWidth={2.5} /> Complete
                          </span>
                        ) : allNone ? (
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: '#991b1b',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: '#fef2f2'
                          }}>
                            0 / {activeJudges.length}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: rowLocked > 0 ? '#166534' : '#854d0e',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: rowLocked > 0 ? '#f0fdf4' : '#fefce8',
                            border: `1px solid ${rowLocked > 0 ? '#bbf7d0' : '#fef08a'}`
                          }}>
                            {rowLocked} / {activeJudges.length}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Summary Stats Cards ────────────────────────────────────── */}
      {!loading && scoreables.length > 0 && activeJudges.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 20 }}>
          <div className="card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--pageant-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {lockedCells}
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
              Locked Scores
            </div>
          </div>
          <div className="card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>
              {draftCells}
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
              Drafts Pending
            </div>
          </div>
          <div className="card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b', fontVariantNumeric: 'tabular-nums' }}>
              {notStartedCells}
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
              Not Started
            </div>
          </div>
          <div className="card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {activeJudges.length}
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
              Assigned Judges
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Maintenance & Danger Zone ──────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => {
            setResetConfirmation('')
            setShowResetModal(true)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <RotateCcw size={12} strokeWidth={2.2} />
          <span>Reset All Scores (Danger Zone)</span>
        </button>
      </div>

      {/* ── Reset Confirmation Modal ───────────────────────────────── */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => !resetting && setShowResetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 8, background: '#fee2e2', borderRadius: 8 }}>
                <RotateCcw size={20} color="#b91c1c" strokeWidth={2.2} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Reset All Competition Scores?
                </h2>
                <span style={{ fontSize: '0.76rem', color: '#b91c1c', fontWeight: 700 }}>
                  Permanent Action &bull; Full Season Reset
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(185, 28, 28, 0.05)',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: '0.82rem',
              color: '#7f1d1d',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} color="#b91c1c" />
                <span>What will happen:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><strong>All scores &amp; drafts will be deleted</strong> across Ginoo, Binibini, and Cheerdance ({scores.length} scores currently).</li>
                <li>All judge scoring statuses will return to <strong>Not Started (0%)</strong>.</li>
                <li><strong>Teams, candidates, judges, and criteria remain intact</strong> — no need to re-register them!</li>
              </ul>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Type <strong style={{ color: '#b91c1c' }}>RESET</strong> to confirm:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="RESET"
                value={resetConfirmation}
                onChange={e => setResetConfirmation(e.target.value)}
                disabled={resetting}
                autoFocus
                style={{
                  width: '100%',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)'
                }}
              />
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleResetAllScores}
                disabled={resetting || resetConfirmation.trim().toUpperCase() !== 'RESET'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: resetConfirmation.trim().toUpperCase() !== 'RESET' ? 0.5 : 1,
                  cursor: resetConfirmation.trim().toUpperCase() !== 'RESET' ? 'not-allowed' : 'pointer'
                }}
              >
                {resetting ? <span className="spinner spinner-sm" /> : <Trash2 size={14} />}
                {resetting ? 'Resetting…' : 'Confirm Reset All Scores'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
