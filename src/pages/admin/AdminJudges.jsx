import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Gavel,
  UserPlus,
  Edit3,
  Trash2,
  Megaphone,
  Crown,
  Sparkles,
  AlertTriangle,
  User,
  ShieldCheck,
  Calendar
} from 'lucide-react'

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-judge`

async function callEdge(action, payload) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || 'Edge function failed')
  return json
}

export default function AdminJudges() {
  const [judges, setJudges]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editingJudge, setEditingJudge] = useState(null)
  const [form, setForm]                 = useState({ name: '', username: '', password: '', allowed_competitions: ['cheerdance', 'pageant'] })
  const [busy, setBusy]                 = useState(false)
  const [toast, setToast]               = useState(null)
  const [deleting, setDeleting]         = useState(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, username, allowed_competitions, created_at')
      .eq('role', 'judge')
      .order('created_at')
    setJudges(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  function toggleComp(comp) {
    setForm(f => {
      const current = f.allowed_competitions || []
      const next = current.includes(comp)
        ? current.filter(c => c !== comp)
        : [...current, comp]
      return { ...f, allowed_competitions: next }
    })
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault()
    if (!form.allowed_competitions || form.allowed_competitions.length === 0) {
      showToast('Select at least one competition for the judge.', 'error')
      return
    }
    setBusy(true)
    const username = form.username.trim().toLowerCase().replace(/\s+/g, '')
    try {
      const res = await callEdge('create', { name: form.name.trim(), username, password: form.password })
      if (res?.id) {
        await supabase
          .from('profiles')
          .update({ allowed_competitions: form.allowed_competitions })
          .eq('id', res.id)
      }
      showToast(`Judge "${form.name}" created!`)
      setShowModal(false)
      setForm({ name: '', username: '', password: '', allowed_competitions: ['cheerdance', 'pageant'] })
      load()
    } catch (err) {
      showToast(err.message || 'Failed to create judge.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── EDIT ─────────────────────────────────────────────────────────────────────
  async function handleEdit(e) {
    e.preventDefault()
    if (!form.allowed_competitions || form.allowed_competitions.length === 0) {
      showToast('Select at least one competition for the judge.', 'error')
      return
    }
    setBusy(true)
    const username = form.username.trim().toLowerCase().replace(/\s+/g, '')
    try {
      await callEdge('update', {
        judgeId:  editingJudge.id,
        name:     form.name.trim(),
        username,
        password: form.password || undefined,
      })
      await supabase
        .from('profiles')
        .update({ allowed_competitions: form.allowed_competitions })
        .eq('id', editingJudge.id)

      showToast(`Judge "${form.name}" updated!`)
      setEditingJudge(null)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to update judge.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setBusy(true)
    try {
      await callEdge('delete', { judgeId: deleting.id })
      showToast(`Judge "${deleting.name}" removed.`)
      setDeleting(null)
      load()
    } catch (err) {
      const raw = err.message || ''
      const msg = raw.includes('submitted scores')
        ? `Cannot remove "${deleting.name}" because they have already submitted and locked scores.`
        : raw
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(judge) {
    setEditingJudge(judge)
    setForm({
      name: judge.name || '',
      username: judge.username || '',
      password: '',
      allowed_competitions: judge.allowed_competitions || ['cheerdance', 'pageant']
    })
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
            <Gavel size={13} color="var(--pageant-primary)" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pageant-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Access Control &amp; Roster
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Board of Judges
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Register and manage judge credentials and competition assignments
          </p>
        </div>
        <button
          type="button"
          className="btn btn-gold btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8 }}
          onClick={() => {
            setForm({ name: '', username: '', password: '', allowed_competitions: ['cheerdance', 'pageant'] })
            setShowModal(true)
          }}
        >
          <UserPlus size={15} /> Add Judge
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : judges.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <Gavel size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No judges registered yet</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Create judge accounts so they can sign in and score competitions.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setForm({ name: '', username: '', password: '', allowed_competitions: ['cheerdance', 'pageant'] })
              setShowModal(true)
            }}
          >
            Add Judge
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Judge</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Username</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Assigned Competitions</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Date Created</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {judges.map(j => {
                  const comps = j.allowed_competitions || ['cheerdance', 'pageant']
                  return (
                    <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: 'var(--pageant-primary)', fontSize: '0.85rem', flexShrink: 0
                          }}>
                            {(j.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{j.name || 'Unnamed'}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ID: {j.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.88rem' }}>
                        {j.username ? `@${j.username}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>none</span>}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {comps.includes('cheerdance') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(46,125,50,0.1)', color: 'var(--pageant-primary)', border: '1px solid var(--border)' }}>
                              <Megaphone size={11} /> Cheerdance
                            </span>
                          )}
                          {comps.includes('pageant') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(46,125,50,0.1)', color: 'var(--pageant-primary)', border: '1px solid var(--border)' }}>
                              <Crown size={11} /> Pageant
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        {new Date(j.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => startEdit(j)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => setDeleting(j)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !busy && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                <UserPlus size={18} color="var(--pageant-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add Board Judge</h2>
            </div>
            <p style={{ marginBottom: 20, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Create a scoring account for a judge. Provide the credentials to the judge on event day.
            </p>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Full Name</label>
                  <input className="form-input" placeholder="e.g. Atty. Juan Dela Cruz"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required autoFocus disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Username (Login)</label>
                  <input className="form-input" placeholder="e.g. judge1"
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/\s+/g, '') }))}
                    required disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Password</label>
                  <input type="password" className="form-input" placeholder="Min. 6 characters"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required minLength={6} disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Assigned Competitions</label>
                  <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={(form.allowed_competitions || []).includes('cheerdance')}
                        onChange={() => toggleComp('cheerdance')}
                        disabled={busy}
                      />
                      Cheerdance
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={(form.allowed_competitions || []).includes('pageant')}
                        onChange={() => toggleComp('pageant')}
                        disabled={busy}
                      />
                      Pageant
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                  {busy ? <span className="spinner spinner-sm" /> : 'Create Judge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingJudge && (
        <div className="modal-overlay" onClick={() => !busy && setEditingJudge(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                <Edit3 size={18} color="var(--pageant-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Judge</h2>
            </div>
            <p style={{ marginBottom: 20, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Update credentials or competition assignments for {editingJudge.name}.
            </p>
            <form onSubmit={handleEdit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Full Name</label>
                  <input className="form-input" placeholder="Judge name"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required autoFocus disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Username</label>
                  <input className="form-input" placeholder="e.g. judge1"
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/\s+/g, '') }))}
                    required disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>New Password</label>
                  <input type="password" className="form-input" placeholder="Leave blank to keep existing password"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    minLength={6} disabled={busy} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Assigned Competitions</label>
                  <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={(form.allowed_competitions || []).includes('cheerdance')}
                        onChange={() => toggleComp('cheerdance')}
                        disabled={busy}
                      />
                      Cheerdance
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={(form.allowed_competitions || []).includes('pageant')}
                        onChange={() => toggleComp('pageant')}
                        disabled={busy}
                      />
                      Pageant
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingJudge(null)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  {busy ? <span className="spinner spinner-sm" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="modal-overlay" onClick={() => !busy && setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(192,57,43,0.1)', borderRadius: 8 }}>
                <Trash2 size={18} color="var(--error)" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Remove Judge?</h2>
            </div>
            <p style={{ marginBottom: 16, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              This will delete <strong>{deleting.name || 'this judge'}</strong>&apos;s login account.
            </p>
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 18,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Automatic cleanup:</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                <li>Cleans draft and unlocked scores by this judge</li>
                <li>Removes any pending unlock requests</li>
                <li><strong>Locked / certified scores are protected and preserved</strong></li>
              </ul>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={busy}>
                {busy ? <span className="spinner spinner-sm" style={{ marginRight: 6 }} /> : null}
                {busy ? 'Removing…' : 'Remove Judge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
