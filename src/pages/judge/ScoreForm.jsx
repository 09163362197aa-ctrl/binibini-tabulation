import { useEffect, useRef, useState } from 'react'
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
  Crown,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { CandidateRibbon, CandidatePill } from '../../components/CandidateBadge'
import './ScoreForm.css'

// Preload candidate photo into browser cache before unveiling profile to avoid image swap flicker
function preloadImage(url) {
  if (!url || typeof url !== 'string') return Promise.resolve()
  return new Promise(resolve => {
    const img = new Image()
    let settled = false
    const timeout = setTimeout(() => {
      settled = true
      resolve(url)
    }, 2500) // 2.5s safeguard timeout
    img.onload = () => {
      if (!settled) {
        clearTimeout(timeout)
        resolve(url)
      }
    }
    img.onerror = () => {
      if (!settled) {
        clearTimeout(timeout)
        resolve(url)
      }
    }
    img.src = url
  })
}

export default function ScoreForm() {
  const { competition, id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stageParam = searchParams.get('stage')

  const [criteria, setCriteria] = useState([])
  const [scores, setScores] = useState({})
  const [savedScores, setSaved] = useState({})
  const [subject, setSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [zoomPhoto, setZoomPhoto] = useState(false)
  const [toast, setToast] = useState(null)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [pageantCandidates, setPageantCandidates] = useState([])
  const [candidateList, setCandidateList] = useState([])
  const [keypadTarget, setKeypadTarget] = useState(null) // { criterion, value }
  const [canScrollMore, setCanScrollMore] = useState(false)
  const rightColRef = useRef(null)
  const submitSectionRef = useRef(null)
  const candidateId = competition === 'pageant' ? id : null
  const teamEntryId = competition === 'cheerdance' ? id : null
  const savedRef = useRef({})
  const inFlightSavesRef = useRef({})
  const toastTimerRef = useRef(null)

  useEffect(() => {
    savedRef.current = savedScores
  }, [savedScores])

  useEffect(() => {
    savedRef.current = {}
    inFlightSavesRef.current = {}
  }, [competition, id])

  function resetScrollTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const rightCol = document.querySelector('.scoring-right-col')
    if (rightCol) rightCol.scrollTop = 0
  }

  useEffect(() => {
    resetScrollTop()
    const timer = setTimeout(() => {
      resetScrollTop()
    }, 40)
    return () => clearTimeout(timer)
  }, [id])

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let isCurrent = true

    async function load() {
      setLoading(true)
      // Reset subject immediately so previous candidate's image/details never leak to the new candidate
      setSubject(null)
      resetScrollTop()
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

      if (!isCurrent) return
      setCriteria(allCriteria)

      const targetCandId = competition === 'pageant' ? id : null

      if (competition === 'cheerdance') {
        const [{ data: cheerData }, { data: allTeams }] = await Promise.all([
          supabase
            .from('team_entries')
            .select('id, photo_url, team:teams(name, logo_url)')
            .eq('id', id)
            .single(),
          supabase
            .from('team_entries')
            .select('id, photo_url, team:teams(name)')
            .eq('competition_type', 'cheerdance')
        ])

        if (!isCurrent) return

        if (cheerData?.photo_url) {
          await preloadImage(cheerData.photo_url)
        }
        if (!isCurrent) return

        setSubject({
          type: 'cheer',
          name: cheerData?.team?.name,
          entryId: id,
          photoUrl: cheerData?.photo_url,
          logoUrl: cheerData?.team?.logo_url
        })
        setCandidateList(allTeams || [])
      } else {
        const [{ data: candData }, { data: allCands }] = await Promise.all([
          supabase
            .from('candidates')
            .select('id, name, category, photo_url, candidate_number, team_entry_id, team_entry:team_entry_id(team:teams(name, logo_url), candidates(id, category, name, photo_url, candidate_number))')
            .eq('id', targetCandId)
            .single(),
          supabase
            .from('candidates')
            .select('id, name, category, candidate_number, photo_url, team_entry:team_entry_id(team:teams(name))')
            .eq('category', 'binibini')
        ])

        if (!isCurrent) return

        // Preload candidate photo into browser memory so it renders instantly with zero flicker
        if (candData?.photo_url) {
          await preloadImage(candData.photo_url)
        }
        if (!isCurrent) return

        if (allCands) {
          const sorted = allCands.sort((a, b) => {
            const numA = a.candidate_number != null ? Number(a.candidate_number) : 99999
            const numB = b.candidate_number != null ? Number(b.candidate_number) : 99999
            if (numA !== numB) return numA - numB
            return (a.name || '').localeCompare(b.name || '')
          })
          setCandidateList(sorted)
        }

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

      if (!isCurrent) return

      const query = supabase
        .from('scores')
        .select('id, criterion_id, value, is_locked')
        .eq('judge_id', user.id)
      if (competition === 'cheerdance') query.eq('team_entry_id', id)
      if (competition === 'pageant') query.eq('candidate_id', targetCandId)

      const { data: scoreRows } = await query
      if (!isCurrent) return

      const raw = {}
      const saved = {}
      scoreRows?.forEach(row => {
        // Direct scoring: stored value IS the judge's entered score — no conversion needed
        raw[row.criterion_id] = parseFloat(row.value.toFixed(4))
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
      if (competition === 'pageant') reqQuery.eq('candidate_id', targetCandId)

      const { data: reqRows } = await reqQuery
      if (!isCurrent) return
      setHasPendingRequest((reqRows || []).length > 0)

      setLoading(false)
      requestAnimationFrame(() => {
        resetScrollTop()
      })
    }
    load()

    async function refreshStatusSilently() {
      const sQuery = supabase
        .from('scores')
        .select('id, criterion_id, value, is_locked')
        .eq('judge_id', user.id)
      if (competition === 'cheerdance') sQuery.eq('team_entry_id', id)
      if (competition === 'pageant') sQuery.eq('candidate_id', targetCandId)

      const rQuery = supabase
        .from('unlock_requests')
        .select('id, status')
        .eq('judge_id', user.id)
        .eq('status', 'pending')
      if (competition === 'cheerdance') rQuery.eq('team_entry_id', id)
      if (competition === 'pageant') rQuery.eq('candidate_id', targetCandId)

      const [{ data: scoreRows }, { data: reqRows }] = await Promise.all([sQuery, rQuery])
      if (!isCurrent) return

      if (scoreRows) {
        const nextSaved = {}
        scoreRows.forEach(row => {
          nextSaved[row.criterion_id] = { id: row.id, is_locked: row.is_locked }
        })
        savedRef.current = nextSaved
        setSaved(nextSaved)
      }
      setHasPendingRequest((reqRows || []).length > 0)
    }

    let unlockRefreshTimer = null

    const channel = supabase
      .channel(`scoreform-rt-${competition}-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        (payload) => {
          const row = payload.new
          if (!row || row.judge_id !== user.id) return
          const matchesTarget = competition === 'pageant'
            ? row.candidate_id === targetCandId
            : row.team_entry_id === id
          if (!matchesTarget) return

          const nextEntry = { id: row.id, is_locked: row.is_locked }
          savedRef.current = { ...savedRef.current, [row.criterion_id]: nextEntry }
          setSaved(prev => ({
            ...prev,
            [row.criterion_id]: nextEntry
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unlock_requests' },
        (payload) => {
          const row = payload.new || payload.old
          if (row && row.judge_id && row.judge_id !== user.id) return
          if (row && (row.candidate_id || row.team_entry_id)) {
            const matchesTarget = competition === 'pageant'
              ? row.candidate_id === targetCandId
              : row.team_entry_id === id
            if (!matchesTarget) return
          }
          refreshStatusSilently()
          if (unlockRefreshTimer) clearTimeout(unlockRefreshTimer)
          unlockRefreshTimer = setTimeout(() => {
            refreshStatusSilently()
          }, 450)
        }
      )
      .subscribe()

    return () => {
      isCurrent = false
      if (unlockRefreshTimer) clearTimeout(unlockRefreshTimer)
      supabase.removeChannel(channel)
    }
  }, [competition, id, user])

  // Fallback poll ONLY while waiting for an unlock approval on this candidate
  useEffect(() => {
    if (!hasPendingRequest || !user?.id || !id) return
    const targetCandId = competition === 'pageant' ? id : null

    const interval = setInterval(async () => {
      const sQuery = supabase
        .from('scores')
        .select('id, criterion_id, is_locked')
        .eq('judge_id', user.id)
      if (competition === 'cheerdance') sQuery.eq('team_entry_id', id)
      if (competition === 'pageant') sQuery.eq('candidate_id', targetCandId)

      const rQuery = supabase
        .from('unlock_requests')
        .select('id, status')
        .eq('judge_id', user.id)
        .eq('status', 'pending')
      if (competition === 'cheerdance') rQuery.eq('team_entry_id', id)
      if (competition === 'pageant') rQuery.eq('candidate_id', targetCandId)

      const [{ data: scoreRows }, { data: reqRows }] = await Promise.all([sQuery, rQuery])
      if (scoreRows) {
        const nextSaved = {}
        scoreRows.forEach(row => {
          nextSaved[row.criterion_id] = { id: row.id, is_locked: row.is_locked }
        })
        savedRef.current = nextSaved
        setSaved(nextSaved)
      }
      setHasPendingRequest((reqRows || []).length > 0)
    }, 3000)

    return () => clearInterval(interval)
  }, [hasPendingRequest, competition, id, user?.id])

  const parents = criteria.filter(c => !c.parent_id)
  const children = criteria.filter(c => c.parent_id)

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

  useEffect(() => {
    function checkScrollMore() {
      const isMobile = window.innerWidth <= 640
      const el = rightColRef.current
      if (!isMobile && el && el.scrollHeight > el.clientHeight + 4) {
        setCanScrollMore(el.scrollHeight - el.scrollTop - el.clientHeight > 24)
      } else {
        const doc = document.documentElement
        const scrollTop = window.scrollY || doc.scrollTop || 0
        setCanScrollMore(doc.scrollHeight - scrollTop - window.innerHeight > 24)
      }
    }

    const timer = setTimeout(checkScrollMore, 80)
    const el = rightColRef.current
    if (el) el.addEventListener('scroll', checkScrollMore, { passive: true })
    window.addEventListener('scroll', checkScrollMore, { passive: true })
    window.addEventListener('resize', checkScrollMore)
    return () => {
      clearTimeout(timer)
      if (el) el.removeEventListener('scroll', checkScrollMore)
      window.removeEventListener('scroll', checkScrollMore)
      window.removeEventListener('resize', checkScrollMore)
    }
  }, [loading, id, selectedStageId, isLocked])

  async function requestUnlock() {
    setRequesting(true)
    try {
      const payload = {
        judge_id: user.id,
        candidate_id: candidateId || null,
        team_entry_id: candidateId ? null : teamEntryId,
        status: 'pending',
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
    const runSave = async () => {
      if (inFlightSavesRef.current[criterionId]) {
        await inFlightSavesRef.current[criterionId].catch(() => {})
      }
      const existing = savedRef.current[criterionId]
      if (existing) {
        const { error } = await supabase.from('scores').update({ value: rawValue }).eq('id', existing.id)
        if (error) throw error
      } else {
        const row = {
          judge_id: user.id,
          criterion_id: criterionId,
          value: rawValue,
          is_locked: false,
          ...(teamEntryId ? { team_entry_id: teamEntryId } : { candidate_id: candidateId }),
        }
        const { data, error } = await supabase.from('scores').insert(row).select().single()
        if (error) throw error
        if (data) {
          const entry = { id: data.id, is_locked: false }
          savedRef.current = { ...savedRef.current, [criterionId]: entry }
          setSaved(prev => ({ ...prev, [criterionId]: entry }))
        }
      }
    }

    const promise = runSave()
    inFlightSavesRef.current[criterionId] = promise
    try {
      await promise
    } catch (err) {
      showToast('Auto-save failed: ' + err.message, 'error')
    } finally {
      if (inFlightSavesRef.current[criterionId] === promise) {
        delete inFlightSavesRef.current[criterionId]
      }
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
      // Wait for any in-flight blur auto-saves to settle so we never insert duplicate rows
      const pendingSaves = Object.values(inFlightSavesRef.current)
      if (pendingSaves.length > 0) {
        await Promise.allSettled(pendingSaves)
      }

      const savePromises = activeCriteriaIds.map(async cid => {
        const rawVal = scores[cid] ?? 0
        const existing = savedRef.current[cid]

        if (existing) {
          const { error } = await supabase.from('scores').update({ value: rawVal, is_locked: true }).eq('id', existing.id)
          if (error) throw error
          return { cid, id: existing.id }
        } else {
          const row = {
            judge_id: user.id,
            criterion_id: cid,
            value: rawVal,
            is_locked: true,
            ...(teamEntryId ? { team_entry_id: teamEntryId } : { candidate_id: candidateId }),
          }
          const { data, error } = await supabase.from('scores').insert(row).select().single()
          if (error) throw error
          return { cid, id: data?.id }
        }
      })

      const results = await Promise.all(savePromises)

      setSaved(prev => {
        const next = { ...prev }
        results.forEach(r => {
          if (r?.cid) next[r.cid] = { id: r.id, is_locked: true }
        })
        savedRef.current = next
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

  const currentTargetId = id
  const currentIndex = candidateList.findIndex(c => c.id === currentTargetId)
  const prevCandidate = currentIndex > 0 ? candidateList[currentIndex - 1] : null
  const nextCandidate = (currentIndex >= 0 && currentIndex < candidateList.length - 1) ? candidateList[currentIndex + 1] : null

  function goToCandidate(targetCand) {
    if (!targetCand) return
    resetScrollTop()
    const stageQuery = stageParam
      ? `?stage=${stageParam}`
      : (selectedStageId && selectedStageId !== 'all' ? `?stage=${selectedStageId}` : '')
    navigate(`/judge/score/${competition}/${targetCand.id}${stageQuery}`)
  }

  return (
    <div className="score-form-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Top Bar (Clean, compact, with Quick Candidate Switcher) */}
      <div className="score-form-top-bar">
        {/* Left: Compact Back Button */}
        <button
          type="button"
          onClick={() => navigate(backUrl)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1.5px solid rgba(212, 175, 55, 0.65)',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: '0.84rem',
            color: '#FEF3C7',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ArrowLeft size={16} strokeWidth={2.4} />
          <span>Back to List</span>
        </button>

        {/* Center: Candidate Switcher Controls */}
        {candidateList.length > 0 && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '4px 8px',
            borderRadius: 10,
            border: '1px solid rgba(212, 175, 55, 0.45)'
          }}>
            <button
              type="button"
              disabled={!prevCandidate}
              onClick={() => goToCandidate(prevCandidate)}
              title={prevCandidate ? `Go to ${prevCandidate.name}` : 'No previous candidate'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(212, 175, 55, 0.45)',
                background: prevCandidate ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: prevCandidate ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: prevCandidate ? 'pointer' : 'not-allowed',
                opacity: prevCandidate ? 1 : 0.4
              }}
            >
              <ChevronLeft size={15} />
              <span>Prev</span>
            </button>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#FDE68A',
              padding: '0 6px',
              whiteSpace: 'nowrap'
            }}>
              {currentIndex >= 0 ? `${currentIndex + 1} of ${candidateList.length}` : ''}
            </span>

            <button
              type="button"
              disabled={!nextCandidate}
              onClick={() => goToCandidate(nextCandidate)}
              title={nextCandidate ? `Go to ${nextCandidate.name}` : 'No next candidate'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                borderRadius: 6,
                border: nextCandidate ? '1.5px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.35)',
                background: nextCandidate ? 'linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)' : 'transparent',
                color: nextCandidate ? '#0A271E' : 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: nextCandidate ? 'pointer' : 'not-allowed',
                opacity: nextCandidate ? 1 : 0.4,
                boxShadow: nextCandidate ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none'
              }}
            >
              <span>Next Candidate</span>
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Royal Crown Preloader while switching or loading contestant evaluation */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 460,
          padding: 48,
          background: 'linear-gradient(145deg, rgba(255, 253, 248, 0.95) 0%, rgba(251, 246, 234, 0.95) 100%)',
          borderRadius: 16,
          border: '1.5px solid rgba(212, 175, 55, 0.35)',
          boxShadow: '0 4px 20px rgba(180, 130, 30, 0.08)',
          textAlign: 'center',
          margin: '20px 0'
        }}>
          <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 20 }}>
            <div className="spinner" style={{ width: 72, height: 72, borderWidth: 3.5, borderColor: 'rgba(212, 175, 55, 0.2)', borderTopColor: '#D97706' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={28} color="#D97706" />
            </div>
          </div>
          <div style={{ fontSize: '1.18rem', fontWeight: 900, color: '#B45309', letterSpacing: '-0.01em' }}>
            Loading Contestant Evaluation...
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 0', maxWidth: 360, lineHeight: 1.5 }}>
            Fetching candidate profile, rubrics, and certified scoring records
          </p>
        </div>
      ) : (
        <div className="scoring-layout-split">
        {/* ── LEFT COLUMN: Highlighted Candidate Showcase (Sticky on scroll) ── */}
        <div className="scoring-left-col">
          {subject && (
            <div className="card candidate-spotlight-card">
              {/* Highlighted Portrait Photo (Responsive & Fitted) */}
              <div
                className="candidate-spotlight-photo"
                onClick={() => setZoomPhoto(true)}
                title="Tap to inspect full-size photo"
              >
                <img
                  key={subject.candidateId || subject.photoUrl || subject.name}
                  src={subject.photoUrl || '/palayan.png'}
                  alt={subject.name || 'Candidate'}
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
                    style={{ position: 'absolute', top: 0, left: 10, zIndex: 3 }}
                  />
                )}

                {/* Tap to Enlarge Badge */}
                <div style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.68)',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  border: '1px solid rgba(255,255,255,0.25)'
                }}>
                  <Maximize2 size={11} />
                  <span>Tap to zoom</span>
                </div>
              </div>

              {/* Candidate Identity Details (Centered) */}
              <div className="candidate-spotlight-details">
                {/* Candidate Number Pill (Centered) */}
                {subject.candidateNumber != null && (
                  <div className="candidate-spotlight-badges">
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      padding: '3px 12px',
                      borderRadius: 6,
                      background: 'rgba(217, 119, 6, 0.12)',
                      border: '1px solid rgba(217, 119, 6, 0.3)',
                      color: '#B45309',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      Candidate #{subject.candidateNumber}
                    </span>
                  </div>
                )}

                {/* Candidate Full Name (Centered) */}
                <h2 className="candidate-spotlight-name">
                  {subject.name || 'Unnamed Contestant'}
                </h2>

                {/* Clean Barangay Name (Centered) */}
                {subject.team && (
                  <div className="candidate-spotlight-barangay">
                    <MapPin size={15} color="#D97706" />
                    <span>Barangay {subject.team}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Active Stage Rubric & Scoring Inputs ── */}
        <div className="scoring-right-col" ref={rightColRef}>
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
                padding: '12px 18px',
                boxShadow: '0 2px 8px rgba(180, 130, 30, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 8, background: 'rgba(217,119,6,0.12)', borderRadius: 10 }}>
                    <Layers size={18} color="#D97706" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{activeStage.label}</span>
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
                    <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 700, marginTop: 2 }}>
                      100 Points Rubric • Converted to {stageWeight}% Overall
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: '1.4rem',
                    color: (competition === 'pageant' && stageDisplayScore < 80) ? '#DC2626' : '#B45309',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1
                  }}>
                    {stageDisplayScore % 1 === 0 ? stageDisplayScore : stageDisplayScore.toFixed(2)}
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: 3 }}>
                      / {stageChildMax}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.72rem',
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

          {/* Criteria Evaluation Card */}
          <div className="criteria-sections" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
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
                        onOpenKeypad={(crit, val) => setKeypadTarget({ criterion: crit, value: val })}
                        onChangeScore={v => handleScoreChange(c.id, v)}
                        onBlurScore={v => handleBlur(c.id, v)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                activeStageParents.map(parent => (
                  <div key={parent.id} className="card" style={{ padding: '16px 18px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={16} color="#D97706" />
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>{parent.label} Criteria</h3>
                    </div>
                    <div className="criteria-list">
                      {children.filter(c => c.parent_id === parent.id).map(c => (
                        <CriterionRow
                          key={c.id}
                          criterion={c}
                          value={scores[c.id] ?? 0}
                          locked={isLocked}
                          onOpenKeypad={(crit, val) => setKeypadTarget({ criterion: crit, value: val })}
                          onChangeScore={v => handleScoreChange(c.id, v)}
                          onBlurScore={v => handleBlur(c.id, v)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

          {/* Total Score Summary Bar */}
          {!loading && (
            <div className="card" style={{
              marginTop: 0,
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
            <div ref={submitSectionRef} style={{ marginTop: 14, textAlign: 'center' }}>
              {/* Below 80 Warning Box */}
              {competition === 'pageant' && stageDisplayScore < 80 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#FEF2F2',
                  border: '1.5px solid #F87171',
                  color: '#991B1B',
                  margin: '0 auto 14px',
                  textAlign: 'left',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
                }}>
                  <AlertTriangle size={22} color="#DC2626" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#991B1B' }}>
                      Score Below Minimum Required (80 Points)
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: 2, color: '#7F1D1D', lineHeight: 1.4 }}>
                      Current score is <strong>{stageDisplayScore.toFixed(2)}</strong>. Submission is blocked until scores meet or exceed 80.00 points.
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
                  marginBottom: 12
                }}>
                  <CheckCircle2 size={15} color="#16A34A" /> Meets minimum requirement (≥ 80.00 points)
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
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
                    : 'linear-gradient(135deg, #0E3429 0%, #0A271E 100%)',
                  color: (competition === 'pageant' && stageDisplayScore < 80) ? 'var(--text-muted)' : '#FEF3C7',
                  fontWeight: 800,
                  padding: '12px 30px',
                  borderRadius: 10,
                  border: (competition === 'pageant' && stageDisplayScore < 80) ? '1.5px dashed var(--border)' : '1.5px solid #D4AF37',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.94rem',
                  cursor: (competition === 'pageant' && stageDisplayScore < 80) ? 'not-allowed' : 'pointer',
                  boxShadow: (competition === 'pageant' && stageDisplayScore < 80) ? 'none' : '0 4px 14px rgba(10, 39, 30, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Lock size={16} strokeWidth={2.5} /> Submit &amp; Lock Stage Scores
              </button>
            </div>
          )}

          {/* Locked Notice */}
          {isLocked && !loading && (
            <div className="card" style={{
              marginTop: 14,
              padding: 20,
              borderRadius: 14,
              border: '1.5px solid rgba(212, 175, 55, 0.45)',
              background: 'linear-gradient(180deg, rgba(254, 243, 199, 0.22) 0%, #FFFFFF 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 14,
              boxShadow: '0 4px 16px rgba(14, 52, 41, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <div style={{
                  padding: 8,
                  background: 'linear-gradient(135deg, #0A271E 0%, #0E3429 100%)',
                  border: '1px solid #D4AF37',
                  borderRadius: 8,
                  color: '#FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(14, 52, 41, 0.22)',
                  flexShrink: 0
                }}>
                  <ShieldCheck size={22} strokeWidth={2.2} />
                </div>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>Stage Scores are Locked &amp; Certified</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Scores for this evaluation are certified. If you need to revise, you may request an unlock from administrators.
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                style={{
                  width: '100%',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  padding: '10px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: hasPendingRequest
                    ? 'rgba(14, 52, 41, 0.08)'
                    : 'linear-gradient(135deg, #0A271E 0%, #0E3429 100%)',
                  color: hasPendingRequest ? '#0E3429' : '#FEF3C7',
                  border: hasPendingRequest
                    ? '1.5px solid rgba(14, 52, 41, 0.25)'
                    : '1.5px solid #D4AF37',
                  borderRadius: 10,
                  cursor: hasPendingRequest ? 'default' : 'pointer',
                  boxShadow: hasPendingRequest ? 'none' : '0 3px 10px rgba(10, 39, 30, 0.2)'
                }}
                disabled={requesting || hasPendingRequest}
                onClick={requestUnlock}
              >
                <LockOpen size={15} color={hasPendingRequest ? '#0E3429' : '#FDE68A'} strokeWidth={2.2} />
                {requesting ? 'Sending Unlock Request…' : hasPendingRequest ? 'Unlock Request Pending Approval' : 'Request Stage Unlock'}
              </button>
            </div>
          )}

          {/* Next Candidate Navigation Banner at the Bottom */}
          {candidateList.length > 1 && (
            <div style={{ marginTop: 14 }}>
              {nextCandidate ? (
                <button
                  type="button"
                  onClick={() => goToCandidate(nextCandidate)}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #F1F5F9 100%)',
                    border: '1.5px solid rgba(14, 52, 41, 0.22)',
                    color: '#0E3429',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(14, 52, 41, 0.08)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Next Evaluation
                    </div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0A271E' }}>
                      Candidate #{nextCandidate.candidate_number != null ? nextCandidate.candidate_number : ''} — {nextCandidate.name}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'linear-gradient(135deg, #0E3429 0%, #0A271E 100%)',
                    border: '1px solid #D4AF37',
                    color: '#FEF3C7',
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: '0.84rem'
                  }}>
                    <span>Next Candidate</span>
                    <ChevronRight size={16} strokeWidth={2.6} />
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(backUrl)}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>All Candidates Evaluated • Return to List</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Full-Screen HD Photo Lightbox Modal */}
      {zoomPhoto && subject?.photoUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setZoomPhoto(false)}
        >
          <div
            style={{ position: 'relative', maxWidth: 600, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomPhoto(false)}
              style={{
                position: 'absolute',
                top: -16,
                right: -16,
                background: '#FFFFFF',
                color: '#1A1A1A',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                zIndex: 10
              }}
            >
              <X size={20} strokeWidth={2.5} />
            </button>
            <img
              src={subject.photoUrl}
              alt={subject.name || 'Candidate Photo'}
              style={{
                maxWidth: '100%',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: 14,
                border: '2px solid rgba(212, 175, 55, 0.7)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
              }}
            />
            <div style={{ marginTop: 12, textAlign: 'center', color: '#FFFFFF' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{subject.name}</div>
              {subject.team && <div style={{ fontSize: '0.85rem', color: '#FDE68A' }}>Barangay {subject.team}</div>}
            </div>
          </div>
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

      {/* ── Scroll Indicator Pill when more criteria/actions exist below ── */}
      {canScrollMore && !loading && (
        <button
          type="button"
          className="scoring-scroll-indicator"
          onClick={() => {
            const isMobile = window.innerWidth <= 640
            if (!isMobile && rightColRef.current && rightColRef.current.scrollHeight > rightColRef.current.clientHeight + 4) {
              rightColRef.current.scrollBy({ top: 240, behavior: 'smooth' })
            } else {
              window.scrollBy({ top: 240, behavior: 'smooth' })
            }
          }}
        >
          <span>Scroll for more</span>
          <span>↓</span>
        </button>
      )}

      {/* ── Built-in On-Screen Keypad Modal (Prevents device virtual keyboard and URL bar popup) ── */}
      {keypadTarget && (() => {
        const keypadIdx = activeCriteria.findIndex(c => c.id === keypadTarget.criterion.id)
        const nextCriterion = keypadIdx >= 0 && keypadIdx + 1 < activeCriteria.length
          ? activeCriteria[keypadIdx + 1]
          : null
        const prevCriterion = keypadIdx > 0
          ? activeCriteria[keypadIdx - 1]
          : null

        return (
          <ScoreKeypadModal
            criterion={keypadTarget.criterion}
            initialValue={keypadTarget.value}
            subject={subject}
            hasNext={Boolean(nextCriterion)}
            hasPrev={Boolean(prevCriterion)}
            allCriteria={activeCriteria}
            allScores={scores}
            onClose={() => setKeypadTarget(null)}
            onApply={(val) => {
              handleScoreChange(keypadTarget.criterion.id, val)
              handleBlur(keypadTarget.criterion.id, val)
              setKeypadTarget(null)
              if (!nextCriterion) {
                setTimeout(() => {
                  submitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 60)
              }
            }}
            onApplyAndNext={(val) => {
              handleScoreChange(keypadTarget.criterion.id, val)
              handleBlur(keypadTarget.criterion.id, val)
              if (nextCriterion) {
                setKeypadTarget({
                  criterion: nextCriterion,
                  value: Number(scores[nextCriterion.id]) || 0
                })
              } else {
                setKeypadTarget(null)
              }
            }}
            onApplyAndPrev={(val) => {
              handleScoreChange(keypadTarget.criterion.id, val)
              handleBlur(keypadTarget.criterion.id, val)
              if (prevCriterion) {
                setKeypadTarget({
                  criterion: prevCriterion,
                  value: Number(scores[prevCriterion.id]) || 0
                })
              }
            }}
          />
        )
      })()}
    </div>
  )
}

function ScoreKeypadModal({ criterion, initialValue, subject, hasNext, hasPrev, allCriteria, allScores, onClose, onApply, onApplyAndNext, onApplyAndPrev }) {
  const maxScore = Number(criterion.max_score) || 100
  const [valStr, setValStr] = useState(initialValue != null && initialValue > 0 ? String(initialValue) : '')

  useEffect(() => {
    setValStr(initialValue != null && initialValue > 0 ? String(initialValue) : '')
  }, [criterion.id, initialValue])

  function handleDigit(d) {
    setValStr(prev => {
      const next = prev + String(d)
      const parsed = parseInt(next, 10)
      if (isNaN(parsed)) return ''
      if (parsed > maxScore) return String(maxScore)
      return String(parsed)
    })
  }

  function handleBackspace() {
    setValStr(prev => prev.slice(0, -1))
  }

  function handleClear() {
    setValStr('')
  }

  function getClampedScore() {
    let parsed = parseInt(valStr, 10)
    if (isNaN(parsed) || parsed < 0) parsed = 0
    return Math.min(maxScore, Math.max(0, parsed))
  }

  function handleDone() {
    onApply(getClampedScore())
  }

  function handleNext() {
    if (onApplyAndNext) {
      onApplyAndNext(getClampedScore())
    } else {
      handleDone()
    }
  }

  function handlePrev() {
    if (onApplyAndPrev) {
      onApplyAndPrev(getClampedScore())
    }
  }

  return (
    <div className="score-keypad-overlay">
      <div className="score-keypad-modal">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1.5px solid rgba(14,52,41,0.18)',
            background: '#F1F5F9',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: '#0E3429',
            fontWeight: 700,
            lineHeight: 1,
            zIndex: 10,
          }}
          aria-label="Close"
        >
          ✕
        </button>
        {subject && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #0A271E 0%, #0E3429 100%)',
            border: '1px solid rgba(212, 175, 55, 0.55)',
            color: '#FFFFFF'
          }}>
            {subject.photoUrl && (
              <img
                src={subject.photoUrl}
                alt={subject.name || 'Candidate'}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  border: '1.5px solid #D4AF37',
                  flexShrink: 0
                }}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#FEF3C7',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {subject.candidateNumber != null ? `#${subject.candidateNumber} • ` : ''}
                {subject.name || 'Candidate'}
              </div>
              {subject.team && (
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.78)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  Barangay {subject.team}
                </div>
              )}
            </div>
          </div>
        )}

        {allCriteria && allCriteria.length > 1 && (
          <div style={{
            background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F6 100%)',
            border: '1.5px solid rgba(212, 175, 55, 0.3)',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0E3429', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Scores Overview
            </div>
            {allCriteria.map(c => {
              const isActive = c.id === criterion.id
              const val = isActive ? (parseInt(valStr, 10) || 0) : (Number(allScores?.[c.id]) || 0)
              return (
                <div key={c.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '3px 6px',
                  borderRadius: 6,
                  background: isActive ? 'rgba(14, 52, 41, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '0.74rem', color: isActive ? '#0E3429' : 'var(--text-secondary)', fontWeight: isActive ? 800 : 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isActive && '▶ '}{c.label}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isActive ? '#0E3429' : 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>
                    {val} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.68rem' }}>/ {c.max_score}</span>
                  </span>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(212, 175, 55, 0.3)' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0E3429', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0A271E', fontVariantNumeric: 'tabular-nums' }}>
                {allCriteria.reduce((sum, c) => {
                  const v = c.id === criterion.id ? (parseInt(valStr, 10) || 0) : (Number(allScores?.[c.id]) || 0)
                  return sum + Math.min(Number(c.max_score) || 0, v)
                }, 0)}
                {' '}<span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ {allCriteria.reduce((s, c) => s + (Number(c.max_score) || 0), 0)}</span>
              </span>
            </div>
          </div>
        )}

        <div className="score-keypad-header">
          <div>
            <div className="score-keypad-title">{criterion.label}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tap numbers to score (Max: {maxScore})</div>
          </div>
        </div>

        <div className="score-keypad-display-row">
          <span className="score-keypad-val">{valStr || '0'}</span>
          <span className="score-keypad-max">/ {maxScore} pts</span>
        </div>

        <div className="score-keypad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button
              key={n}
              type="button"
              className="score-keypad-btn"
              onClick={() => handleDigit(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="score-keypad-btn action-btn"
            onClick={handleClear}
          >
            Clear
          </button>
          <button
            type="button"
            className="score-keypad-btn"
            onClick={() => handleDigit(0)}
          >
            0
          </button>
          <button
            type="button"
            className="score-keypad-btn action-btn"
            onClick={handleBackspace}
          >
            ⌫
          </button>
        </div>

        {hasNext ? (
          <div className="score-keypad-actions">
            {hasPrev && (
              <button
                type="button"
                className="score-keypad-btn next-btn"
                onClick={handlePrev}
              >
                ← Prev
              </button>
            )}
            <button
              type="button"
              className="score-keypad-btn next-btn"
              style={{ flex: 1 }}
              onClick={handleNext}
            >
              Next →
            </button>
          </div>
        ) : (
          <div className="score-keypad-actions">
            {hasPrev && (
              <button
                type="button"
                className="score-keypad-btn next-btn"
                onClick={handlePrev}
              >
                ← Prev
              </button>
            )}
            <button
              type="button"
              className="score-keypad-btn done-btn"
              style={{ flex: 1, height: 48 }}
              onClick={handleDone}
            >
              ✓ Set Score ({valStr || '0'})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CriterionRow({ criterion, value, locked, onChangeScore, onBlurScore, onOpenKeypad }) {
  const [localStr, setLocalStr] = useState(String(Math.round(Number(value) || 0)))

  useEffect(() => {
    setLocalStr(String(Math.round(Number(value) || 0)))
  }, [value])

  const maxScore = criterion.max_score || 100

  return (
    <div className="criterion-row-clean">
      <div className="criterion-left">
        <span className="criterion-title">{criterion.label}</span>
        <span className="criterion-max-tag">Max: {maxScore} pts</span>
      </div>
      <div className="criterion-right">
        <input
          type="text"
          inputMode="none"
          readOnly
          className="score-number-input-lg"
          value={localStr}
          disabled={locked}
          onClick={() => {
            if (!locked && onOpenKeypad) {
              onOpenKeypad(criterion, Number(localStr) || 0)
            }
          }}
          placeholder="0"
          style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 6, whiteSpace: 'nowrap' }}>/ {maxScore}</span>
      </div>
    </div>
  )
}
