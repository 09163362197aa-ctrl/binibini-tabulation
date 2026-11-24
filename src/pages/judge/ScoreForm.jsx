import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPageantCriteria } from '../../lib/criteriaSync'
import {
  ArrowLeft,
  Lock,
  LockOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Save,
  Layers,
  Sparkles,
  ShieldCheck,
  MapPin,
  Crown
} from 'lucide-react'
import { CandidateRibbon, CandidatePill } from '../../components/CandidateBadge'
import './ScoreForm.css'

export default function ScoreForm() {
  const { competition, id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stageParam = searchParams.get('stage')

  const [criteria, setCriteria]   = useState([])
  const [scores, setScores]       = useState({})
  const [savedScores, setSaved]   = useState({})
  const [subject, setSubject]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [locking, setLocking]     = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [toast, setToast]         = useState(null)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [pageantCandidates, setPageantCandidates] = useState([])
  const [activeCandidateId, setActiveCandidateId] = useState(id)

  const teamEntryId   = competition === 'cheerdance' ? id : null
  const candidateId   = competition === 'pageant'    ? activeCandidateId : null

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      let allCriteria = []

      if (competition === 'pageant') {
        allCriteria = await getPageantCriteria()
      } else {
        const { data: criteriaData } = await supabase
          .from('criteria')
          .select('id, key, label, max_score, display_order, parent_id')
          .eq('competition_type', competition)
          .order('display_order')
        allCriteria = criteriaData || []
      }

      setCriteria(allCriteria)

      const targetCandId = competition === 'pageant' ? activeCandidateId : null

      if (competition === 'cheerdance') {
        const { data } = await supabase
          .from('team_entries')
          .select('id, photo_url, team:teams(name, logo_url)')
          .eq('id', id)
          .single()
        setSubject({
          type: 'cheer',
          name: data?.team?.name,
          entryId: id,
          photoUrl: data?.photo_url,
          logoUrl: data?.team?.logo_url
        })
      } else {
        const { data: candData } = await supabase
          .from('candidates')
          .select('id, name, category, photo_url, candidate_number, team_entry_id, team_entry:team_entry_id(team:teams(name, logo_url), candidates(id, category, name, photo_url, candidate_number))')
          .eq('id', targetCandId)
          .single()

        if (candData) {
          setPageantCandidates(candData.team_entry?.candidates || [])
          setSubject({
            type: candData.category,
            name: candData.name,
            team: candData.team_entry?.team?.name,
            candidateId: targetCandId,
            entryId: candData.team_entry_id,
            photoUrl: candData.photo_url,
            logoUrl: candData.team_entry?.team?.logo_url,
            candidateNumber: candData.candidate_number
          })
        }
      }

      const query = supabase
        .from('scores')
        .select('id, criterion_id, value, is_locked')
        .eq('judge_id', user.id)
      if (competition === 'cheerdance') query.eq('team_entry_id', id)
      if (competition === 'pageant')    query.eq('candidate_id', targetCandId)

      const { data: scoreRows } = await query

      const raw = {}
      const saved = {}
      scoreRows?.forEach(row => {
        // Direct scoring: stored value IS the judge's entered score — no conversion needed
        raw[row.criterion_id]   = parseFloat(row.value.toFixed(4))
        saved[row.criterion_id] = { id: row.id, is_locked: row.is_locked }
      })
      setScores(raw)
      setSaved(saved)

      const reqQuery = supabase
        .from('unlock_requests')
        .select('id, status')
        .eq('judge_id', user.id)
        .eq('status', 'pending')
      if (competition === 'cheerdance') reqQuery.eq('team_entry_id', id)
      if (competition === 'pageant')    reqQuery.eq('candidate_id', targetCandId)

      const { data: reqRows } = await reqQuery
      setHasPendingRequest((reqRows || []).length > 0)

      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`scoreform-rt-${competition}-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, (payload) => {
        if (payload.new && payload.new.judge_id === user.id) {
          setSaved(prev => ({
            ...prev,
            [payload.new.criterion_id]: { id: payload.new.id, is_locked: payload.new.is_locked }
          }))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unlock_requests' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [competition, id, activeCandidateId, user])

  const parents  = criteria.filter(c => !c.parent_id)
  const children = criteria.filter(c =>  c.parent_id)

  const [selectedStageId, setSelectedStageId] = useState(stageParam || parents[0]?.id || 'all')

  useEffect(() => {
    if (competition === 'pageant' && parents.length > 0) {
      if (stageParam && parents.some(p => p.id === stageParam)) {
        setSelectedStageId(stageParam)
      } else if (selectedStageId === 'all' || !parents.some(p => p.id === selectedStageId)) {
        setSelectedStageId(parents[0].id)
      }
    }
  }, [stageParam, parents, competition])

  const activeStageParents = (competition === 'pageant' && selectedStageId !== 'all')
    ? parents.filter(p => p.id === selectedStageId)
    : parents

  const activeCriteria = competition === 'cheerdance'
    ? criteria
    : (selectedStageId !== 'all'
        ? children.filter(c => c.parent_id === selectedStageId)
        : children)

  const activeCriteriaIds = activeCriteria.map(c => c.id)
  const isLocked = activeCriteriaIds.length > 0 && activeCriteriaIds.every(cid => savedScores[cid]?.is_locked)

  async function requestUnlock() {
    setRequesting(true)
    try {
      const payload = {
        judge_id:      user.id,
        candidate_id:  candidateId || null,
        team_entry_id: candidateId ? null : teamEntryId,
        status:        'pending',
      }
      if (selectedStageId && selectedStageId !== 'all') {
        payload.stage_id = selectedStageId
      }

      const { error } = await supabase.from('unlock_requests').insert(payload)
      if (error) throw error
      showToast('Unlock request sent to admin')
      setHasPendingRequest(true)
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    } finally {
      setRequesting(false)
    }
  }

  async function saveScore(criterionId, rawValue) {
    if (isLocked) return
    // Direct scoring: store exactly what the judge typed
    const existing = savedScores[criterionId]
    if (existing) {
      await supabase.from('scores').update({ value: rawValue }).eq('id', existing.id)
    } else {
      const row = {
        judge_id: user.id,
        criterion_id: criterionId,
        value: rawValue,
        is_locked: false,
        ...(teamEntryId ? { team_entry_id: teamEntryId } : { candidate_id: candidateId }),
      }
      const { data } = await supabase.from('scores').insert(row).select().single()
      if (data) setSaved(prev => ({ ...prev, [criterionId]: { id: data.id, is_locked: false } }))
    }
  }

  function handleScoreChange(criterionId, val) {
    setScores(prev => ({ ...prev, [criterionId]: val }))
  }

  async function handleBlur(criterionId, val) {
    setSaving(true)
    await saveScore(criterionId, val)
    setSaving(false)
  }

  async function handleLock() {
    // 80-POINT MINIMUM PAGEANT RULE ENFORCEMENT
    if (competition === 'pageant' && stageDisplayScore < 80) {
      showToast(`Cannot submit: Stage score must be at least 80.00 points (Current: ${stageDisplayScore.toFixed(2)}).`, 'error')
      setShowLockConfirm(false)
      return
    }

    setLocking(true)
    try {
      const savePromises = activeCriteriaIds.map(async cid => {
        const rawVal = scores[cid] ?? 0
        const existing = savedScores[cid]

        if (existing) {
          await supabase.from('scores').update({ value: rawVal, is_locked: true }).eq('id', existing.id)
          return { cid, id: existing.id }
        } else {
          const row = {
            judge_id: user.id,
            criterion_id: cid,
            value: rawVal,
            is_locked: true,
            ...(teamEntryId ? { team_entry_id: teamEntryId } : { candidate_id: candidateId }),
          }
          const { data } = await supabase.from('scores').insert(row).select().single()
          return { cid, id: data?.id }
        }
      })

      const results = await Promise.all(savePromises)

      setSaved(prev => {
        const next = { ...prev }
        results.forEach(r => {
          if (r?.cid) next[r.cid] = { id: r.id, is_locked: true }
        })
        return next
      })

      setShowLockConfirm(false)
      showToast('Scores locked successfully')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLocking(false)
    }
  }

  // Direct scoring: plain sum of entered values, no weighting
  let grandTotal = 0
  activeCriteria.forEach(c => {
    grandTotal += Number(scores[c.id]) || 0
  })

  // Stage total = sum of that stage's criteria values
  let stageDisplayScore = grandTotal
  if (competition === 'pageant' && activeStageParents.length === 1) {
    const stageKids = children.filter(c => c.parent_id === activeStageParents[0].id)
    stageDisplayScore = stageKids.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0)
  }

  // Max possible for current view
  const maxTotal = activeCriteria.reduce((sum, c) => sum + (c.max_score || 0), 0)

  const backUrl = competition === 'cheerdance'
    ? '/judge?comp=cheerdance'
    : (selectedStageId && selectedStageId !== 'all' ? `/judge?comp=pageant&stage=${selectedStageId}` : '/judge?comp=pageant')

  return (
    <div className="score-form-page" style={{ maxWidth: 880, margin: '0 auto' }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Sticky Top Bar (Clean, compact, no huge buttons) */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(250, 247, 239, 0.98)',
        backdropFilter: 'blur(10px)',
        margin: '-12px -16px 16px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        {/* Compact Back Button */}
        <button
          type="button"
          onClick={() => navigate(backUrl)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--bg-surface)',
            border: '1.5px solid rgba(212, 175, 55, 0.5)',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: '0.84rem',
            color: '#B45309',
            boxShadow: '0 1px 4px rgba(180, 130, 30, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ArrowLeft size={16} strokeWidth={2.4} />
          <span>Back to Contestants</span>
        </button>

        {/* Right Info: Logged-in Judge Tablet Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile?.name && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              background: 'rgba(217, 119, 6, 0.08)',
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid rgba(217, 119, 6, 0.25)'
            }}>
              <Crown size={12} color="#D97706" />
              <span>Judge: <strong style={{ color: '#B45309', fontWeight: 800 }}>{profile.name}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Streamlined Candidate Header Card */}
      {subject && (() => {
        return (
          <div className="card" style={{
            padding: 16,
            borderRadius: 14,
            border: '1.5px solid rgba(212, 175, 55, 0.35)',
            background: 'linear-gradient(145deg, #FFFDF8 0%, #FAF6ED 100%)',
            marginBottom: 16,
            boxShadow: '0 2px 10px rgba(180, 130, 30, 0.06)'
          }}>
            {/* CHEERDANCE: Wide landscape banner photo */}
            {subject.type === 'cheer' ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: 180,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1px solid var(--border)'
                }}>
                  <img
                    src={subject.photoUrl || subject.logoUrl || '/palayan.png'}
                    alt={subject.name || 'Cheerdance Team'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center center',
                      display: 'block'
                    }}
                    onError={(e) => {
                      if (e.target.src !== '/palayan.png') e.target.src = '/palayan.png'
                    }}
                  />
                </div>
              </div>
            ) : (
              /* PAGEANT: Well-arranged, compact horizontal layout */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap'
              }}>
                {/* Candidate Photo: Compact, elegant portrait */}
                <div style={{
                  position: 'relative',
                  width: 105,
                  height: 135,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1.5px solid rgba(212, 175, 55, 0.45)',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)'
                }}>
                  <img
                    src={subject.photoUrl || '/palayan.png'}
                    alt={subject.name || 'Candidate'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      display: 'block'
                    }}
                    onError={(e) => {
                      if (e.target.src !== '/palayan.png') e.target.src = '/palayan.png'
                    }}
                  />

                  {/* Candidate Number Ribbon */}
                  {subject.candidateNumber != null && (
                    <CandidateRibbon
                      number={subject.candidateNumber}
                      category="binibini"
                      size="compact"
                      style={{ position: 'absolute', top: 0, left: 6, zIndex: 3 }}
                    />
                  )}
                </div>

                {/* Candidate Details */}
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Status & Candidate Badge Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {subject.candidateNumber != null && (
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(217, 119, 6, 0.12)',
                        border: '1px solid rgba(217, 119, 6, 0.3)',
                        color: '#B45309',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        Candidate #{subject.candidateNumber}
                      </span>
                    )}

                    {isLocked ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#DCFCE7',
                        color: '#166534',
                        border: '1px solid #BBF7D0'
                      }}>
                        <Lock size={11} strokeWidth={2.4} /> Certified &amp; Locked
                      </span>
                    ) : saving ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: '#FEF9C3',
                        color: '#854D0E',
                        border: '1px solid #FDE047'
                      }}>
                        <Save size={11} /> Saving…
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)'
                      }}>
                        <FileEdit size={11} /> Draft Mode
                      </span>
                    )}
                  </div>

                  {/* Candidate Name */}
                  <h2 style={{
                    margin: 0,
                    fontSize: '1.45rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}>
                    {subject.name || 'Unnamed Contestant'}
                  </h2>

                  {/* Clean Barangay Name (No awkward crop/vegetable photo!) */}
                  {subject.team && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: '#B45309'
                    }}>
                      <MapPin size={14} color="#D97706" />
                      <span>Barangay {subject.team}</span>
                    </div>
                  )}
                </div>

                {/* Unlock Button if Locked */}
                {isLocked && (
                  <div style={{ marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '6px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: hasPendingRequest ? '#fef3c7' : 'rgba(242, 183, 5, 0.12)',
                        color: hasPendingRequest ? '#92400e' : '#B45309',
                        border: hasPendingRequest ? '1px solid #fde68a' : '1px solid rgba(242, 183, 5, 0.35)',
                        borderRadius: 6,
                        cursor: hasPendingRequest ? 'default' : 'pointer'
                      }}
                      disabled={requesting || hasPendingRequest}
                      onClick={requestUnlock}
                    >
                      <LockOpen size={13} color="#D97706" strokeWidth={2.2} />
                      {requesting ? 'Sending…' : hasPendingRequest ? 'Unlock Pending' : 'Request Unlock'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Active Stage Banner */}
      {competition === 'pageant' && !loading && (() => {
        const activeStage = parents.find(p => p.id === selectedStageId)
        if (!activeStage) return null
        const stageChildMax = children.filter(c => c.parent_id === activeStageParents[0]?.id).reduce((s, c) => s + (c.max_score || 0), 0) || 100
        const stageWeight = activeStage.max_score || stageChildMax
        const convertedScore = ((stageDisplayScore / stageChildMax) * stageWeight).toFixed(2)

        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(255, 253, 248, 0.95) 0%, rgba(251, 246, 234, 0.95) 100%)',
            border: '1.5px solid rgba(212, 175, 55, 0.45)',
            borderRadius: 14,
            padding: '14px 20px',
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(180, 130, 30, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: 8, background: 'rgba(217,119,6,0.12)', borderRadius: 10 }}>
                <Layers size={20} color="#D97706" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{activeStage.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#B45309', fontWeight: 700 }}>
                  100 Points Rubric • Converted to {stageWeight}% Overall
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontWeight: 900,
                fontSize: '1.45rem',
                color: (competition === 'pageant' && stageDisplayScore < 80) ? '#DC2626' : '#B45309',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1
              }}>
                {stageDisplayScore % 1 === 0 ? stageDisplayScore : stageDisplayScore.toFixed(2)}
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: 3 }}>
                  / {stageChildMax}
                </span>
              </div>
              <div style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: (competition === 'pageant' && stageDisplayScore < 80) ? '#DC2626' : '#D97706',
                marginTop: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4
              }}>
                {competition === 'pageant' && stageDisplayScore < 80 ? (
                  <>
                    <AlertTriangle size={12} color="#DC2626" />
                    <span>Min 80.00 pts required ({convertedScore}% / {stageWeight}%)</span>
                  </>
                ) : (
                  <span>Converted: {convertedScore}% / {stageWeight}%</span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="criteria-sections" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {competition === 'cheerdance' ? (
            <div className="card" style={{ padding: '16px 18px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Scoring Criteria</h3>
              <div className="criteria-list">
                {criteria.map(c => (
                  <CriterionRow
                    key={c.id}
                    criterion={c}
                    value={scores[c.id] ?? 0}
                    locked={isLocked}
                    onChangeScore={v => handleScoreChange(c.id, v)}
                    onBlurScore={v  => handleBlur(c.id, v)}
                  />
                ))}
              </div>
            </div>
          ) : (
            activeStageParents.map(parent => (
              <div key={parent.id} className="card" style={{ padding: '16px 18px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={16} color="#D97706" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{parent.label} Criteria</h3>
                </div>
                <div className="criteria-list">
                  {children.filter(c => c.parent_id === parent.id).map(c => (
                    <CriterionRow
                      key={c.id}
                      criterion={c}
                      value={scores[c.id] ?? 0}
                      locked={isLocked}
                      onChangeScore={v => handleScoreChange(c.id, v)}
                      onBlurScore={v => handleBlur(c.id, v)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Total Score Summary Bar */}
      {!loading && (
        <div className="card" style={{
          marginTop: 8,
          padding: '14px 20px',
          borderRadius: 14,
          border: (competition === 'pageant' && stageDisplayScore < 80)
            ? '1.5px solid #FCA5A5'
            : '1.5px solid rgba(212, 175, 55, 0.35)',
          background: (competition === 'pageant' && stageDisplayScore < 80)
            ? '#FEF2F2'
            : 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div>
            <div style={{
              fontSize: '0.84rem',
              fontWeight: 800,
              color: (competition === 'pageant' && stageDisplayScore < 80) ? '#991B1B' : '#B45309',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              {competition === 'pageant' && stageDisplayScore < 80 && <AlertTriangle size={15} color="#DC2626" />}
              <span>Total Stage Score</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: (competition === 'pageant' && stageDisplayScore < 80) ? '#7F1D1D' : 'var(--text-muted)', marginTop: 2 }}>
              {competition === 'pageant' && stageDisplayScore < 80
                ? '⚠️ Minimum 80.00 points required to submit'
                : 'Sum of all entered criteria scores'
              }
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div style={{
              fontSize: '1.95rem',
              fontWeight: 900,
              color: (competition === 'pageant' && stageDisplayScore < 80) ? '#DC2626' : '#B45309',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {grandTotal % 1 === 0 ? grandTotal : grandTotal.toFixed(2)}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>/ {maxTotal}</div>
          </div>
        </div>
      )}

      {/* Lock Action & Minimum Score Enforcement */}
      {!isLocked && !loading && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          {/* Below 80 Warning Box */}
          {competition === 'pageant' && stageDisplayScore < 80 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderRadius: 14,
              background: '#FEF2F2',
              border: '1.5px solid #F87171',
              color: '#991B1B',
              maxWidth: 580,
              margin: '0 auto 16px',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
            }}>
              <AlertTriangle size={24} color="#DC2626" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#991B1B' }}>
                  Score Below Minimum Required (80 Points)
                </div>
                <div style={{ fontSize: '0.82rem', marginTop: 3, color: '#7F1D1D', lineHeight: 1.45 }}>
                  Official competition rules state that <strong>80.00 points</strong> is the minimum stage score. Current score is <strong>{stageDisplayScore.toFixed(2)}</strong>. Submission is blocked until scores meet or exceed 80.00 points.
                </div>
              </div>
            </div>
          )}

          {/* Meets Minimum 80 Points Badge */}
          {competition === 'pageant' && stageDisplayScore >= 80 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 16px',
              borderRadius: 20,
              background: '#DCFCE7',
              border: '1.5px solid #86EFAC',
              color: '#166534',
              fontSize: '0.8rem',
              fontWeight: 800,
              marginBottom: 14
            }}>
              <CheckCircle2 size={15} color="#16A34A" /> Meets minimum requirement (≥ 80.00 points)
            </div>
          )}

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Once locked, scores cannot be edited without administrator authorization.
          </p>

          <button
            type="button"
            className="btn btn-lg"
            onClick={() => {
              if (competition === 'pageant' && stageDisplayScore < 80) {
                showToast(`Cannot submit: Stage score is below 80.00 points (Current: ${stageDisplayScore.toFixed(2)}).`, 'error')
                return
              }
              setShowLockConfirm(true)
            }}
            disabled={competition === 'pageant' && stageDisplayScore < 80}
            style={{
              background: (competition === 'pageant' && stageDisplayScore < 80)
                ? 'var(--bg-elevated)'
                : 'linear-gradient(135deg, #D4AF37 0%, #B45309 100%)',
              color: (competition === 'pageant' && stageDisplayScore < 80) ? 'var(--text-muted)' : '#FFFFFF',
              fontWeight: 800,
              padding: '13px 32px',
              borderRadius: 10,
              border: (competition === 'pageant' && stageDisplayScore < 80) ? '1.5px dashed var(--border)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.96rem',
              cursor: (competition === 'pageant' && stageDisplayScore < 80) ? 'not-allowed' : 'pointer',
              boxShadow: (competition === 'pageant' && stageDisplayScore < 80) ? 'none' : '0 3px 12px rgba(180, 130, 30, 0.28)',
              transition: 'all 0.2s ease'
            }}
          >
            <Lock size={16} strokeWidth={2.5} /> Submit &amp; Lock Stage Scores
          </button>
        </div>
      )}

      {/* Locked Notice & Unlock Request */}
      {isLocked && !loading && (
        <div className="card" style={{
          marginTop: 24,
          padding: 24,
          borderRadius: 14,
          border: '1.5px solid rgba(245, 200, 66, 0.35)',
          background: 'linear-gradient(180deg, rgba(254, 243, 199, 0.25) 0%, var(--bg-surface) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 4px 16px rgba(245, 200, 66, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{
              padding: 10,
              background: 'linear-gradient(135deg, #FDE047 0%, #F5C842 100%)',
              borderRadius: 10,
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(245, 200, 66, 0.3)'
            }}>
              <ShieldCheck size={24} strokeWidth={2.2} />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>Stage Scores are Locked &amp; Certified</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Scores for this evaluation are certified. If you need to revise, you may request an unlock from administrators.
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '1px', background: 'rgba(245, 200, 66, 0.2)' }} />

          {hasPendingRequest ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled
              style={{
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                fontWeight: 800,
                padding: '9px 20px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Clock size={15} color="#B45309" strokeWidth={2.2} /> Unlock Request Pending Administrator Approval
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={requestUnlock}
              disabled={requesting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: 800,
                fontSize: '0.88rem',
                padding: '9px 22px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #FDE047 0%, #F5C842 100%)',
                color: '#1A1A1A',
                border: 'none',
                boxShadow: '0 3px 12px rgba(245, 200, 66, 0.3)',
                cursor: 'pointer'
              }}
            >
              {requesting ? <span className="spinner spinner-sm" /> : <LockOpen size={16} strokeWidth={2.2} />}
              Request Stage Score Unlock
            </button>
          )}
        </div>
      )}

      {/* Lock Confirm Modal */}
      {showLockConfirm && (
        <div className="modal-overlay" onClick={() => !locking && setShowLockConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: 24, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                <Lock size={20} color="var(--pageant-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Lock Stage Scores?
              </h2>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              This will officially certify your evaluation for this stage. Once locked, modifications require administrator unlock.
            </p>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Calculated Total Score</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--pageant-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                {stageDisplayScore % 1 === 0 ? stageDisplayScore : stageDisplayScore.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Direct Stage Total Points</div>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLockConfirm(false)} disabled={locking}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleLock}
                disabled={locking}
                style={{ background: 'var(--pageant-primary)', color: '#FFFFFF', fontWeight: 700, padding: '7px 16px', borderRadius: 6, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {locking ? <span className="spinner spinner-sm" /> : <CheckCircle2 size={14} />}
                Confirm &amp; Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function cleanScoreStr(val) {
  if (val === undefined || val === null || val === '') return '0'
  const num = Number(val)
  if (isNaN(num)) return '0'
  return String(parseFloat(num.toFixed(4)))
}

function CriterionRow({ criterion, value, locked, onChangeScore, onBlurScore }) {
  const [localStr, setLocalStr] = useState(String(Math.round(Number(value) || 0)))

  useEffect(() => {
    setLocalStr(String(Math.round(Number(value) || 0)))
  }, [value])

  const maxScore = criterion.max_score || 100

  function handleKeyDown(e) {
    // Block decimal point, minus, and 'e' (scientific notation)
    if (e.key === '.' || e.key === ',' || e.key === '-' || e.key === 'e' || e.key === 'E') {
      e.preventDefault()
    }
  }

  function handleChange(e) {
    const raw = e.target.value
    if (raw === '') {
      setLocalStr('')
      onChangeScore(0)
      return
    }

    // Strip any non-digit characters just in case
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    let parsed = parseInt(digitsOnly, 10)
    if (isNaN(parsed)) parsed = 0

    // Clamp to this criterion's actual maximum
    const clamped = Math.min(maxScore, Math.max(0, parsed))
    setLocalStr(String(clamped))
    onChangeScore(clamped)
  }

  function handleBlur() {
    let parsed = parseInt(localStr, 10)
    if (isNaN(parsed) || parsed < 0) parsed = 0
    const clamped = Math.min(maxScore, Math.max(0, parsed))
    setLocalStr(String(clamped))
    onBlurScore(clamped)
  }

  return (
    <div className="criterion-row-clean">
      <div className="criterion-left">
        <span className="criterion-title">{criterion.label}</span>
        <span className="criterion-max-tag">Max: {maxScore} pts</span>
      </div>
      <div className="criterion-right">
        <input
          type="number"
          className="score-number-input-lg"
          min={0}
          max={maxScore}
          step={1}
          value={localStr}
          disabled={locked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="0"
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 6, whiteSpace: 'nowrap' }}>/ {maxScore}</span>
      </div>
    </div>
  )
}
