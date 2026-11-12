import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users2,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Crown,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Camera,
  Layers,
  MapPin
} from 'lucide-react'
import { CandidateRibbon } from '../../components/CandidateBadge'
import './AdminTeams.css'

export default function AdminTeams() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({
    candidate_number: '',
    name: '',
    barangay: '',
    photoFile: null,
    photoPreview: ''
  })
  const [busy, setBusy]             = useState(false)
  const [toast, setToast]           = useState(null)
  const [deleting, setDeleting]     = useState(null)
  const [deleteScoreCount, setDeleteScoreCount] = useState(0)
  const [checkingScores, setCheckingScores]     = useState(false)

  async function load() {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, name, logo_url, created_at,
          team_entries (
            id, competition_type, photo_url,
            candidates ( id, category, name, photo_url, candidate_number )
          )
        `)
        .order('created_at')

      if (error) throw error

      const list = []
      ;(data || []).forEach(team => {
        const pageantEntry = team.team_entries?.find(e => e.competition_type === 'pageant')
        if (pageantEntry && pageantEntry.candidates) {
          pageantEntry.candidates.forEach(c => {
            list.push({
              id: c.id,
              candidate_number: c.candidate_number,
              name: c.name,
              photo_url: c.photo_url,
              category: c.category || 'binibini',
              team_id: team.id,
              team_name: team.name,
              team_entry_id: pageantEntry.id
            })
          })
        }
      })

      // Sort by candidate number ascending
      list.sort((a, b) => {
        const numA = a.candidate_number != null ? a.candidate_number : 99999
        const numB = b.candidate_number != null ? b.candidate_number : 99999
        if (numA !== numB) return numA - numB
        return (a.name || '').localeCompare(b.name || '')
      })

      setCandidates(list)
    } catch (err) {
      console.error('Error loading candidates:', err)
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  function openAdd() {
    setEditing(null)
    setForm({
      candidate_number: '',
      name: '',
      barangay: '',
      photoFile: null,
      photoPreview: ''
    })
    setShowModal(true)
  }

  function openEdit(cand) {
    setEditing(cand)
    setForm({
      candidate_number: cand.candidate_number != null ? String(cand.candidate_number) : '',
      name: cand.name || '',
      barangay: cand.team_name || '',
      photoFile: null,
      photoPreview: cand.photo_url || ''
    })
    setShowModal(true)
  }

  async function uploadPhoto(file, folder = 'candidates') {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('team-photos')
      .upload(filePath, file)

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const { data } = supabase.storage
      .from('team-photos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  function handleFileChange(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo size must be under 5MB', 'error')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setForm(prev => ({
      ...prev,
      photoFile: file,
      photoPreview: previewUrl
    }))
  }

  async function handleSave(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!form.candidate_number) {
      showToast('Candidate Number is required.', 'error')
      return
    }
    if (!form.name.trim()) {
      showToast('Candidate Name is required.', 'error')
      return
    }

    const num = parseInt(form.candidate_number, 10)
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid positive candidate number.', 'error')
      return
    }

    setBusy(true)

    if (editing) {
      try {
        let photoUrl = form.photoPreview
        if (form.photoFile) {
          photoUrl = await uploadPhoto(form.photoFile, 'candidates')
        }

        // Update candidate
        const { error: candErr } = await supabase
          .from('candidates')
          .update({
            name: form.name.trim(),
            candidate_number: num,
            photo_url: photoUrl || null
          })
          .eq('id', editing.id)

        if (candErr) {
          if (candErr.code === '23505') throw new Error(`Candidate #${num} is already assigned to another candidate.`)
          throw candErr
        }

        // Update team name (Barangay/Representation)
        if (editing.team_id && form.barangay.trim()) {
          await supabase
            .from('teams')
            .update({
              name: form.barangay.trim(),
              logo_url: photoUrl || null
            })
            .eq('id', editing.team_id)
        }

        showToast(`Candidate #${num} updated successfully!`)
        setShowModal(false)
        load()
      } catch (err) {
        showToast(err.message || 'Failed to update candidate.', 'error')
      } finally {
        setBusy(false)
      }
    } else {
      let createdTeamId = null
      try {
        let photoUrl = null
        if (form.photoFile) {
          photoUrl = await uploadPhoto(form.photoFile, 'candidates')
        }

        const teamName = form.barangay.trim() || `Candidate #${num}`

        // 1. Create Team (stores barangay/representation)
        const { data: newTeam, error: teamErr } = await supabase
          .from('teams')
          .insert({ name: teamName, logo_url: photoUrl })
          .select()
          .single()

        if (teamErr) throw teamErr
        createdTeamId = newTeam.id

        // 2. Create Pageant Team Entry
        const { data: newEntry, error: entryErr } = await supabase
          .from('team_entries')
          .insert({
            team_id: newTeam.id,
            competition_type: 'pageant',
            photo_url: photoUrl
          })
          .select()
          .single()

        if (entryErr) throw entryErr

        // 3. Create Candidate
        const { error: candErr } = await supabase
          .from('candidates')
          .insert({
            team_entry_id: newEntry.id,
            category: 'binibini',
            name: form.name.trim(),
            candidate_number: num,
            photo_url: photoUrl
          })

        if (candErr) {
          if (candErr.code === '23505') throw new Error(`Candidate #${num} is already taken. Please choose another number.`)
          throw candErr
        }

        showToast(`Candidate #${num} "${form.name.trim()}" added successfully!`)
        setShowModal(false)
        load()
      } catch (err) {
        if (createdTeamId) {
          await supabase.from('teams').delete().eq('id', createdTeamId)
        }
        showToast(err.message || 'Failed to register candidate.', 'error')
      } finally {
        setBusy(false)
      }
    }
  }

  async function openDelete(cand) {
    setDeleting(cand)
    setCheckingScores(true)
    setDeleteScoreCount(0)

    try {
      const { count } = await supabase
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', cand.id)

      setDeleteScoreCount(count || 0)
    } catch (err) {
      console.error('Error checking scores:', err)
    } finally {
      setCheckingScores(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      // 1. Delete unlock requests
      await supabase.from('unlock_requests').delete().eq('candidate_id', deleting.id)

      // 2. Delete scores
      await supabase.from('scores').delete().eq('candidate_id', deleting.id)

      // 3. Delete rankings
      await supabase.from('rankings').delete().eq('candidate_id', deleting.id)

      // 4. Delete candidate
      await supabase.from('candidates').delete().eq('id', deleting.id)

      // 5. Delete entry and team
      if (deleting.team_entry_id) {
        await supabase.from('team_entries').delete().eq('id', deleting.team_entry_id)
      }
      if (deleting.team_id) {
        await supabase.from('teams').delete().eq('id', deleting.team_id)
      }

      showToast(`Candidate #${deleting.candidate_number} removed.`)
      setDeleting(null)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to delete candidate.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ width: '100%', paddingBottom: 40 }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Main Header */}
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(217,119,6,0.1)', borderRadius: 6, border: '1px solid rgba(217,119,6,0.25)', marginBottom: 8 }}>
            <Crown size={14} color="#D97706" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Binibining Palayan Roster
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Official Candidates
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Register candidates, assign official numbers, and manage barangay representations
          </p>
        </div>

        <button
          type="button"
          className="btn btn-gold btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8 }}
          onClick={openAdd}
        >
          <Plus size={16} /> Add Candidate
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div className="spinner" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="card" style={{ padding: 56, textAlign: 'center', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 14, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 14 }}>
            <Crown size={32} color="#D97706" />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800 }}>No candidates registered yet</h3>
          <p style={{ margin: '0 0 20px', fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Click the button below to register your first official Binibining Palayan candidate with portrait photo and candidate number.
          </p>
          <button type="button" className="btn btn-gold btn-sm" onClick={openAdd}>
            <Plus size={15} /> Add First Candidate
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {candidates.map(cand => (
            <div
              key={cand.id}
              className="card"
              style={{
                padding: 16,
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                position: 'relative',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Ribbon Badge */}
              <div style={{ flexShrink: 0 }}>
                {cand.candidate_number != null ? (
                  <CandidateRibbon number={cand.candidate_number} category="binibini" />
                ) : (
                  <div style={{
                    width: 44,
                    height: 48,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1.5px dashed var(--border)',
                    color: 'var(--text-muted)',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}>
                    —
                  </div>
                )}
              </div>

              {/* Portrait Thumbnail */}
              <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                <img
                  src={cand.photo_url || '/palayan.png'}
                  alt={cand.name}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(217,119,6,0.35)',
                    background: 'var(--bg-elevated)'
                  }}
                />
              </div>

              {/* Candidate Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: '1.02rem',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {cand.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <MapPin size={12} color="var(--text-muted)" flexShrink={0} />
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {cand.team_name || 'Palayan City'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => openEdit(cand)}
                  title="Edit Candidate Details"
                  style={{ padding: '5px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  onClick={() => openDelete(cand)}
                  title="Remove Candidate"
                  style={{ padding: '5px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Candidate Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !busy && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, background: 'rgba(217,119,6,0.1)', borderRadius: 8 }}>
                  <Crown size={20} color="#D97706" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {editing ? `Edit Candidate #${editing.candidate_number}` : 'Register Candidate'}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Official Binibining Palayan Candidate
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => !busy && setShowModal(false)}
                disabled={busy}
                style={{ padding: 4 }}
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      Number <span style={{ color: 'var(--error)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="e.g. 1"
                      value={form.candidate_number}
                      onChange={e => setForm(f => ({ ...f, candidate_number: e.target.value }))}
                      required
                      autoFocus
                      disabled={busy}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      Full Name <span style={{ color: 'var(--error)' }}>*</span>
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. Maria Clara Santos"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Representing Barangay / Unit
                  </label>
                  <input
                    className="form-input"
                    placeholder="e.g. Barangay Singalat / Barangay Ganaderia"
                    value={form.barangay}
                    onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}
                    disabled={busy}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Portrait Photo (Optional)
                  </label>
                  <div className="photo-upload-zone" style={{ padding: 16 }}>
                    {form.photoPreview ? (
                      <div className="photo-preview-container" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <img
                          src={form.photoPreview}
                          alt="Preview"
                          style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(217,119,6,0.5)' }}
                        />
                        <div>
                          <label className="btn btn-ghost btn-xs" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Camera size={13} /> Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleFileChange(e.target.files?.[0])}
                              style={{ display: 'none' }}
                              disabled={busy}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="photo-upload-label" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0' }}>
                        <Upload size={22} color="#D97706" />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Upload Official Candidate Portrait</span>
                        <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileChange(e.target.files?.[0])}
                          style={{ display: 'none' }}
                          disabled={busy}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                  {busy ? <span className="spinner spinner-sm" /> : editing ? 'Save Changes' : 'Register Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Candidate Confirmation Modal */}
      {deleting && (
        <div className="modal-overlay" onClick={() => !busy && setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: deleteScoreCount > 0 ? 'rgba(217,119,6,0.12)' : 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
                {deleteScoreCount > 0 ? <AlertTriangle size={20} color="#D97706" /> : <Trash2 size={18} color="#EF4444" />}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {deleteScoreCount > 0 ? 'Existing Scores Detected' : `Delete Candidate #${deleting.candidate_number}?`}
              </h2>
            </div>

            {checkingScores ? (
              <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                <span className="spinner spinner-sm" /> Checking scores...
              </div>
            ) : deleteScoreCount > 0 ? (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Candidate <strong>#{deleting.candidate_number} {deleting.name}</strong> currently has <strong>{deleteScoreCount}</strong> recorded score(s) by the judges.
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
                  Deleting this candidate will permanently remove all associated scores and tabulation results for this candidate.
                </p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>Candidate #{deleting.candidate_number} ({deleting.name})</strong> from the Binibining Palayan roster?
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={confirmDelete}
                disabled={busy}
                style={{
                  background: '#dc2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px'
                }}
              >
                {busy ? <span className="spinner spinner-sm" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
