import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPageantCriteria } from '../../lib/criteriaSync'
import {
  LockOpen,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  ShieldAlert,
  Calendar
} from 'lucide-react'

export default function AdminUnlock() {
  const { user: adminUser } = useAuth()
  const [requests, setRequests]   = useState([])
  const [criteria, setCriteria]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(null)
  const [toast, setToast]         = useState(null)
  const [filter, setFilter]       = useState('pending')

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
    const pageantCrit = await getPageantCriteria()
    setCriteria(pageantCrit)

    const { data: requestsResult } = await supabase
      .from('unlock_requests')
      .select(`
        id, stage_id, status, requested_at, resolved_at,
        judge:judge_id ( id, name ),
        team_entry:team_entry_id ( id, competition_type, team:teams(name) ),
        candidate:candidate_id ( id, category, name, candidate_number, team_entry:team_entry_id(team:teams(name)) )
      `)
      .order('requested_at', { ascending: false })

    setRequests(requestsResult || [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('admin-unlock-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unlock_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to get criteria IDs for a pageant parent stage
  function getStageCritIds(stageId) {
    if (!stageId) return []
    const targetParent = criteria.find(c => !c.parent_id && (c.id === stageId || c.key === stageId))
    const targetParentId = targetParent ? targetParent.id : stageId
    return criteria.filter(c => c.parent_id === targetParentId || c.parent_id === stageId).map(c => c.id)
  }

  /* ── Resolve an unlock request ──────────────────────────────── */
  async function resolve(req, status) {
    setBusy(req.id)
    try {
      await supabase.from('unlock_requests').update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: adminUser?.id ?? null,
      }).eq('id', req.id)

      if (status === 'approved') {
        let unlockSuccess = false
        const stageCritIds = req.stage_id ? getStageCritIds(req.stage_id) : []

        // Try RPC first
        try {
          if (stageCritIds.length > 0) {
            const { error: rpcErr } = await supabase.rpc('admin_unlock_stage_scores', {
              p_judge_id:      req.judge?.id,
              p_candidate_id:  req.candidate?.id,
              p_criterion_ids: stageCritIds,
            })
            if (!rpcErr) unlockSuccess = true
          }
        } catch (_) {}

        // Fallback: update scores table directly
        if (!unlockSuccess) {
          let q = supabase
            .from('scores')
            .update({ is_locked: false })
            .eq('judge_id', req.judge?.id)

          if (req.candidate?.id) {
            q = q.eq('candidate_id', req.candidate.id)
          } else if (req.team_entry?.id) {
            q = q.eq('team_entry_id', req.team_entry.id)
          }

          if (stageCritIds.length > 0) {
            q = q.in('criterion_id', stageCritIds)
          }

          const { error: directErr } = await q
          if (directErr) throw directErr
        }

        showToast(`Unlocked scores for ${req.judge?.name || 'Judge'}`)
      } else {
        showToast(`Request denied.`, 'info')
      }
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const filtered = requests.filter(r => filter === 'all' ? true : r.status === filter)

  function describeTarget(req) {
    let stageLabel = ''
    if (req.stage_id) {
      const parent = criteria.find(c => !c.parent_id && (c.id === req.stage_id || c.key === req.stage_id))
      if (parent) stageLabel = ` [${parent.label}]`
    }
    if (req.candidate) {
      const team = req.candidate.team_entry?.team?.name || 'Palayan City'
      const num = req.candidate.candidate_number != null ? ` #${req.candidate.candidate_number}` : ''
      return `Candidate${num} — ${req.candidate.name || 'Candidate'} (${team})${stageLabel}`
    }
    if (req.team_entry) {
      return `${req.team_entry.team?.name || 'Entry'}`
    }
    return 'Candidate Score Entry'
  }

  return (
    <div style={{ width: '100%' }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(46,125,50,0.08)', borderRadius: 6, border: '1px solid rgba(46,125,50,0.2)', marginBottom: 8 }}>
            <LockOpen size={13} color="var(--pageant-primary)" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pageant-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Security &amp; Authorization
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Score Unlock Requests
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Review, authorize, or deny judge stage score modification requests
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'inline-flex',
        background: 'var(--bg-elevated)',
        padding: 4,
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 24,
        gap: 4
      }}>
        {['pending', 'approved', 'denied', 'all'].map(f => {
          const count = f === 'pending' ? requests.filter(r => r.status === 'pending').length : null
          const isSelected = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: isSelected ? 'var(--pageant-primary)' : 'transparent',
                color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 600,
                fontSize: '0.84rem',
                textTransform: 'capitalize',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{f}</span>
              {count !== null && (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                  fontWeight: 800
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <CheckCircle2 size={28} color="var(--pageant-primary)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>
            No {filter === 'all' ? '' : filter} requests
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Judges can request unlocks directly from their scoring form.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(req => {
            const isPending = req.status === 'pending'
            const isApproved = req.status === 'approved'

            return (
              <div
                key={req.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  padding: '18px 20px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)'
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={15} color="var(--pageant-primary)" />
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {req.judge?.name || 'Unknown Judge'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: isPending ? '#fef9c3' : isApproved ? '#dcfce7' : '#fee2e2',
                      color:      isPending ? '#854d0e' : isApproved ? '#166534' : '#991b1b',
                      border:     isPending ? '1px solid #fde047' : isApproved ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {req.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target:</span> <strong>{describeTarget(req)}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    <Calendar size={13} color="var(--text-muted)" />
                    <span>Requested {new Date(req.requested_at).toLocaleString()}</span>
                  </div>
                </div>

                {isPending && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={busy === req.id}
                      onClick={() => resolve(req, 'denied')}
                      style={{ fontWeight: 600, fontSize: '0.82rem', padding: '6px 12px' }}
                    >
                      <XCircle size={14} style={{ marginRight: 4 }} />
                      Deny
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy === req.id}
                      onClick={() => resolve(req, 'approved')}
                      style={{
                        background: 'var(--pageant-primary)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none'
                      }}
                    >
                      {busy === req.id ? (
                        <span className="spinner spinner-sm" style={{ marginRight: 6 }} />
                      ) : (
                        <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                      )}
                      Approve &amp; Unlock
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
