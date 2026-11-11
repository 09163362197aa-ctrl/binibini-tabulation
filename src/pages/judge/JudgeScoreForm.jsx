import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import './JudgeScoreForm.css'

/* ── criteria definitions ─────────────────────────────────────── */
const CHEERDANCE_CRITERIA = [
  { id: 'execution',   label: 'Execution & Technique',   max: 30, description: 'Precision, synchronization, skill' },
  { id: 'formation',   label: 'Formation & Choreography', max: 25, description: 'Creativity, transitions, spacing' },
  { id: 'crowd',       label: 'Crowd Appeal',             max: 20, description: 'Energy, showmanship, engagement' },
  { id: 'costume',     label: 'Costume & Presentation',   max: 15, description: 'Uniformity, appropriateness, impact' },
  { id: 'difficulty',  label: 'Difficulty',               max: 10, description: 'Stunt complexity and risk factor' },
]

const PAGEANT_CRITERIA = {
  sportswear: [
    { id: 'sw_poise',       label: 'Poise & Bearing',      max: 30, description: 'Confidence and grace on stage' },
    { id: 'sw_attire',      label: 'Attire & Presentation', max: 40, description: 'Appropriateness, fit, and style' },
    { id: 'sw_personality', label: 'Personality',           max: 30, description: 'Stage presence and charm' },
  ],
  talent: [
    { id: 'tl_skill',       label: 'Talent Skill',         max: 40, description: 'Technical proficiency' },
    { id: 'tl_presentation',label: 'Presentation',         max: 30, description: 'Stage usage and showmanship' },
    { id: 'tl_impact',      label: 'Impact & Originality', max: 30, description: 'Uniqueness and audience response' },
  ],
  qa: [
    { id: 'qa_content',     label: 'Content & Relevance',  max: 40, description: 'Accuracy and depth of answer' },
    { id: 'qa_delivery',    label: 'Delivery & Clarity',   max: 30, description: 'Articulation and confidence' },
    { id: 'qa_composure',   label: 'Composure',            max: 30, description: 'Poise under pressure' },
  ],
}

const PAGEANT_ROUND_LABELS = { sportswear: '👗 Sportswear', talent: '🎭 Talent', qa: '🎤 Q & A' }

function ScoreInput({ criterion, value, onChange, locked, accentColor }) {
  const pct = Math.round((value / criterion.max) * 100)

  return (
    <div className="sf-criterion">
      <div className="sf-criterion-header">
        <div>
          <div className="sf-criterion-label">{criterion.label}</div>
          <div className="sf-criterion-desc">{criterion.description}</div>
        </div>
        <div className="sf-criterion-value" style={{ color: accentColor }}>
          <span className="sf-score-num">{value}</span>
          <span className="sf-score-sep">/{criterion.max}</span>
        </div>
      </div>
      <div className="score-input-wrap">
        <input
          type="range"
          className="score-slider"
          min={0}
          max={criterion.max}
          value={value}
          disabled={locked}
          onChange={e => onChange(criterion.id, Number(e.target.value))}
          style={{
            '--slider-pct': `${pct}%`,
            '--slider-color': accentColor,
            background: locked
              ? `linear-gradient(to right, var(--locked-color) ${pct}%, var(--border) ${pct}%)`
              : `linear-gradient(to right, ${accentColor} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
          }}
        />
        <div className="score-display">
          <span className="score-max text-xs text-muted">0</span>
          <div className="sf-pct-bar">
            <div
              className="sf-pct-fill"
              style={{ width: `${pct}%`, background: accentColor }}
            />
          </div>
          <span className="score-max text-xs text-muted">{criterion.max}</span>
        </div>
      </div>
    </div>
  )
}

export default function JudgeScoreForm() {
  const { type, id } = useParams()          // type = 'cheerdance' | 'pageant',  id = entryId | candidateId
  const { user } = useAuth()
  const navigate = useNavigate()

  const [subject, setSubject]   = useState(null)  // team_entry or candidate info
  const [scores, setScores]     = useState({})     // { criterionId: value }
  const [activeRound, setActiveRound] = useState('sportswear')
  const [existingRows, setExistingRows] = useState([]) // raw score rows from DB
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [locking, setLocking]   = useState(false)
  const [showLockModal, setShowLockModal] = useState(false)
  const [toast, setToast]       = useState(null)
  const [saveTimer, setSaveTimer] = useState(null)

  const isCheer   = type === 'cheerdance'
  const isPageant = type === 'pageant'
  const accentColor = isCheer ? 'var(--cheer-primary)' : 'var(--pageant-primary)'

  /* ── show toast ────────────────────────────────────────────── */
  function showToast(msg, kind = 'info') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── load subject + existing scores ────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (isCheer) {
          // id is team_entry_id
          const { data: entry } = await supabase
            .from('team_entries')
            .select('id, competition_type, teams(name)')
            .eq('id', id)
            .single()
          setSubject(entry)

          const { data: rows } = await supabase
            .from('scores')
            .select('*')
            .eq('team_entry_id', id)
            .eq('judge_id', user.id)
          setExistingRows(rows || [])
          const locked = (rows || []).some(r => r.is_locked)
          setIsLocked(locked)

          // build score state
          const initial = {}
          CHEERDANCE_CRITERIA.forEach(c => {
            const row = (rows || []).find(r => r.criterion_id === c.id)
            initial[c.id] = row?.value ?? 0
          })
          setScores(initial)
        } else {
          // id is candidate_id
          const { data: candidate } = await supabase
            .from('candidates')
            .select('id, category, name, team_entries(id, teams(name))')
            .eq('id', id)
            .single()
          setSubject(candidate)

          const entryId = candidate?.team_entries?.id
          const { data: rows } = await supabase
            .from('scores')
            .select('*')
            .eq('candidate_id', id)
            .eq('judge_id', user.id)
          setExistingRows(rows || [])
          const locked = (rows || []).some(r => r.is_locked)
          setIsLocked(locked)

          // build score state for all rounds
          const initial = {}
          Object.values(PAGEANT_CRITERIA).flat().forEach(c => {
            const row = (rows || []).find(r => r.criterion_id === c.id)
            initial[c.id] = row?.value ?? 0
          })
          setScores(initial)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, type, user])

  /* ── autosave on score change ───────────────────────────────── */
  const handleScoreChange = useCallback((criterionId, value) => {
    setScores(prev => ({ ...prev, [criterionId]: value }))
    // debounce autosave 800ms
    setSaveTimer(prev => {
      if (prev) clearTimeout(prev)
      return setTimeout(() => {
        triggerSave({ [criterionId]: value })
      }, 800)
    })
  }, [])

  async function triggerSave(changedScores = {}) {
    setSaving(true)
    try {
      const allScores = { ...scores, ...changedScores }
      const criteria = isCheer
        ? CHEERDANCE_CRITERIA
        : Object.values(PAGEANT_CRITERIA).flat()

      const upserts = criteria.map(c => ({
        judge_id:      user.id,
        team_entry_id: isCheer ? id : subject?.team_entries?.id,
        candidate_id:  isPageant ? id : null,
        criterion_id:  c.id,
        value:         allScores[c.id] ?? 0,
        is_locked:     false,
      }))

      const { error } = await supabase
        .from('scores')
        .upsert(upserts, {
          onConflict: 'judge_id,team_entry_id,candidate_id,criterion_id',
          ignoreDuplicates: false,
        })

      if (error) throw error
    } catch (err) {
      console.error('Autosave error:', err)
    } finally {
      setSaving(false)
    }
  }

  /* ── manual save ────────────────────────────────────────────── */
  async function handleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    setSaving(true)
    try {
      await triggerSave()
      showToast('Draft saved ✓', 'success')
    } catch {
      showToast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ── lock ───────────────────────────────────────────────────── */
  async function handleLock() {
    setLocking(true)
    try {
      // save first
      await triggerSave()

      const criteria = isCheer
        ? CHEERDANCE_CRITERIA
        : Object.values(PAGEANT_CRITERIA).flat()

      const upserts = criteria.map(c => ({
        judge_id:      user.id,
        team_entry_id: isCheer ? id : subject?.team_entries?.id,
        candidate_id:  isPageant ? id : null,
        criterion_id:  c.id,
        value:         scores[c.id] ?? 0,
        is_locked:     true,
      }))

      const { error } = await supabase
        .from('scores')
        .upsert(upserts, {
          onConflict: 'judge_id,team_entry_id,candidate_id,criterion_id',
          ignoreDuplicates: false,
        })

      if (error) throw error

      setIsLocked(true)
      setShowLockModal(false)
      showToast('Scores locked successfully 🔒', 'success')
      setTimeout(() => navigate('/judge'), 1800)
    } catch (err) {
      showToast('Failed to lock: ' + err.message, 'error')
    } finally {
      setLocking(false)
    }
  }

  /* ── compute totals ─────────────────────────────────────────── */
  function total(criteria) {
    return criteria.reduce((sum, c) => sum + (scores[c.id] ?? 0), 0)
  }
  function maxTotal(criteria) {
    return criteria.reduce((sum, c) => sum + c.max, 0)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    )
  }

  const displayName = isCheer
    ? subject?.teams?.name
    : subject?.name || `${subject?.category === 'ginoo' ? 'Ginoo' : 'Binibini'} — ${subject?.team_entries?.teams?.name}`

  const currentCriteria = isCheer
    ? CHEERDANCE_CRITERIA
    : PAGEANT_CRITERIA[activeRound]

  const currentTotal = total(currentCriteria)
  const currentMax   = maxTotal(currentCriteria)
  const grandTotal   = isPageant
    ? total(Object.values(PAGEANT_CRITERIA).flat())
    : currentTotal
  const grandMax = isPageant
    ? maxTotal(Object.values(PAGEANT_CRITERIA).flat())
    : currentMax

  return (
    <div className="sf-page">
      {/* Header */}
      <div className="sf-header">
        <button className="btn btn-ghost btn-sm sf-back" onClick={() => navigate(`/judge?comp=${isCheer ? 'cheerdance' : 'pageant'}`)}>
          ← Back
        </button>
        <div className="sf-header-center">
          <div className={`sf-comp-badge ${isCheer ? 'badge-cheer' : 'badge-pageant'} badge`}>
            {isCheer ? '📣 Cheerdance' : '👑 Pageant'}
          </div>
          <h1 className="sf-title">{displayName}</h1>
          {isPageant && subject?.category && (
            <span className={`badge ${subject.category === 'ginoo' ? 'badge-ginoo' : 'badge-binibini'}`}>
              {subject.category === 'ginoo' ? '♂ Ginoo' : '♀ Binibini'}
            </span>
          )}
        </div>
        {isLocked ? (
          <span className="badge badge-locked sf-lock-badge">🔒 Locked</span>
        ) : (
          <div className="sf-header-actions">
            <button
              className="btn btn-ghost btn-sm"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <><div className="spinner spinner-sm" /> Saving…</> : '💾 Save Draft'}
            </button>
            <button
              className="btn btn-lock btn-sm"
              onClick={() => setShowLockModal(true)}
            >
              🔒 Lock & Submit
            </button>
          </div>
        )}
      </div>

      {isLocked && (
        <div className="sf-locked-banner">
          🔒 Your scores for this entry have been locked and submitted. Contact the admin if you need to make changes.
        </div>
      )}

      {/* Pageant round tabs */}
      {isPageant && (
        <div className="sf-round-tabs">
          {Object.entries(PAGEANT_ROUND_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`sf-round-tab ${activeRound === key ? 'active' : ''}`}
              onClick={() => setActiveRound(key)}
            >
              {label}
              <span className="sf-round-score">
                {total(PAGEANT_CRITERIA[key])}/{maxTotal(PAGEANT_CRITERIA[key])}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="sf-body">
        {/* Score criteria */}
        <div className="sf-criteria-list">
          {currentCriteria.map(c => (
            <ScoreInput
              key={c.id}
              criterion={c}
              value={scores[c.id] ?? 0}
              onChange={handleScoreChange}
              locked={isLocked}
              accentColor={accentColor}
            />
          ))}
        </div>

        {/* Summary card */}
        <div className="sf-summary card">
          <div className="sf-summary-title">Score Summary</div>

          {isPageant ? (
            <>
              {Object.entries(PAGEANT_CRITERIA).map(([round, criteria]) => (
                <div key={round} className="sf-summary-row">
                  <span className="sf-summary-label">{PAGEANT_ROUND_LABELS[round]}</span>
                  <span className="sf-summary-val">
                    {total(criteria)}<span className="text-muted">/{maxTotal(criteria)}</span>
                  </span>
                </div>
              ))}
              <div className="sf-summary-divider" />
              <div className="sf-summary-total">
                <span>Grand Total</span>
                <span style={{ color: accentColor }}>{grandTotal}<span className="text-muted" style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>/{grandMax}</span></span>
              </div>
              <div className="sf-summary-pct-bar">
                <div
                  className="sf-summary-pct-fill"
                  style={{ width: `${Math.round((grandTotal / grandMax) * 100)}%`, background: accentColor }}
                />
              </div>
              <div className="text-xs text-muted" style={{ textAlign: 'right' }}>
                {Math.round((grandTotal / grandMax) * 100)}%
              </div>
            </>
          ) : (
            <>
              {currentCriteria.map(c => (
                <div key={c.id} className="sf-summary-row">
                  <span className="sf-summary-label">{c.label}</span>
                  <span className="sf-summary-val">
                    {scores[c.id] ?? 0}<span className="text-muted">/{c.max}</span>
                  </span>
                </div>
              ))}
              <div className="sf-summary-divider" />
              <div className="sf-summary-total">
                <span>Total</span>
                <span style={{ color: accentColor }}>{currentTotal}<span className="text-muted" style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>/{currentMax}</span></span>
              </div>
              <div className="sf-summary-pct-bar">
                <div
                  className="sf-summary-pct-fill"
                  style={{ width: `${Math.round((currentTotal / currentMax) * 100)}%`, background: accentColor }}
                />
              </div>
              <div className="text-xs text-muted" style={{ textAlign: 'right' }}>
                {Math.round((currentTotal / currentMax) * 100)}%
              </div>
            </>
          )}

          {!isLocked && (
            <button
              className="btn btn-lock w-full"
              style={{ marginTop: 20 }}
              onClick={() => setShowLockModal(true)}
            >
              🔒 Lock & Submit
            </button>
          )}
        </div>
      </div>

      {/* Lock confirm modal */}
      {showLockModal && (
        <div className="modal-overlay" onClick={() => !locking && setShowLockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">⚠️ Lock Scores?</div>
            <p style={{ marginTop: 8 }}>
              This will permanently lock your scores for <strong>{displayName}</strong>.
              You will <strong>not</strong> be able to edit them after locking without admin approval.
            </p>
            <div className="sf-lock-totals">
              {isPageant ? (
                Object.entries(PAGEANT_CRITERIA).map(([round, criteria]) => (
                  <div key={round} className="sf-lock-row">
                    <span>{PAGEANT_ROUND_LABELS[round]}</span>
                    <strong>{total(criteria)}/{maxTotal(criteria)}</strong>
                  </div>
                ))
              ) : (
                currentCriteria.map(c => (
                  <div key={c.id} className="sf-lock-row">
                    <span>{c.label}</span>
                    <strong>{scores[c.id] ?? 0}/{c.max}</strong>
                  </div>
                ))
              )}
              <div className="sf-lock-row sf-lock-grand">
                <span>Grand Total</span>
                <strong style={{ color: accentColor }}>{grandTotal}/{grandMax}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowLockModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-lock"
                disabled={locking}
                onClick={handleLock}
              >
                {locking ? <><div className="spinner spinner-sm" /> Locking…</> : '🔒 Confirm Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  )
}
