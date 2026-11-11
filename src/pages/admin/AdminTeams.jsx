import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users2,
  Plus,
  Edit3,
  Trash2,
  Camera,
  Upload,
  Megaphone,
  Crown,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  Image as ImageIcon
} from 'lucide-react'
import './AdminTeams.css'

export default function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [detailTab, setDetailTab] = useState('cheerdance')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    logoFile: null,
    logoPreview: '',
    participates_in: ['cheerdance', 'pageant'],
    cheerFile: null,
    cheerPreview: '',
    ginooName: '',
    ginooNumber: '',
    ginooFile: null,
    ginooPreview: '',
    binibiniName: '',
    binibiniNumber: '',
    binibiniFile: null,
    binibiniPreview: '',
  })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteScoreCount, setDeleteScoreCount] = useState(0)
  const [checkingScores, setCheckingScores] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('teams')
      .select(`
        id, name, logo_url, created_at,
        team_entries (
          id, competition_type, photo_url,
          candidates ( id, category, name, photo_url, candidate_number )
        )
      `)
      .order('created_at')
    setTeams(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  function openAdd() {
    setEditing(null)
    setWizardStep(1)
    setForm({
      name: '',
      logoFile: null,
      logoPreview: '',
      participates_in: ['cheerdance', 'pageant'],
      cheerFile: null,
      cheerPreview: '',
      binibiniName: '',
      binibiniNumber: '',
      binibiniFile: null,
      binibiniPreview: '',
      ginooName: '',
      ginooNumber: '',
      ginooFile: null,
      ginooPreview: '',
    })
    setShowModal(true)
  }

  function openEdit(team) {
    setEditing(team)
    setForm({
      name: team.name,
      logoFile: null,
      logoPreview: team.logo_url || '/palayan.png',
    })
    setShowModal(true)
  }

  async function uploadPhoto(file, folder) {
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

  function handleFileChange(type, file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be under 5MB', 'error')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setForm(prev => ({
      ...prev,
      [`${type}File`]: file,
      [`${type}Preview`]: previewUrl,
    }))
  }

  function clearFile(type) {
    setForm(prev => ({
      ...prev,
      [`${type}File`]: null,
      [`${type}Preview`]: '',
    }))
  }

  async function handleSave(e) {
    if (e && e.preventDefault) e.preventDefault()
    setBusy(true)

    if (editing) {
      try {
        let logoUrl = form.logoPreview
        if (form.logoFile) {
          logoUrl = await uploadPhoto(form.logoFile, 'logos')
        }

        const { error } = await supabase
          .from('teams')
          .update({
            name: form.name.trim(),
            logo_url: logoUrl || null,
          })
          .eq('id', editing.id)

        if (error) throw error

        showToast(`Team "${form.name.trim()}" updated successfully!`)
        setShowModal(false)
        load()
      } catch (err) {
        showToast(err.message, 'error')
      } finally {
        setBusy(false)
      }
    } else {
      let createdTeamId = null
      try {
        const hasCheer   = form.participates_in.includes('cheerdance')
        const hasPageant = form.participates_in.includes('pageant')

        if (!hasCheer && !hasPageant) {
          showToast('Select at least one competition.', 'error')
          setBusy(false)
          return
        }

        let logoUrl = null
        if (form.logoFile) logoUrl = await uploadPhoto(form.logoFile, 'logos')

        let cheerUrl = null
        if (hasCheer && form.cheerFile) cheerUrl = await uploadPhoto(form.cheerFile, 'cheerdance')

        let ginooUrl = null
        if (hasPageant && form.ginooFile) ginooUrl = await uploadPhoto(form.ginooFile, 'candidates')

        let binibiniUrl = null
        if (hasPageant && form.binibiniFile) binibiniUrl = await uploadPhoto(form.binibiniFile, 'candidates')

        const ginooNum    = form.ginooNumber ? parseInt(form.ginooNumber, 10) : null
        const binibiniNum = form.binibiniNumber ? parseInt(form.binibiniNumber, 10) : null

        const { data: newTeam, error: teamError } = await supabase
          .from('teams')
          .insert({ name: form.name.trim(), logo_url: logoUrl })
          .select()
          .single()
        if (teamError) throw teamError
        createdTeamId = newTeam.id

        // Only insert entries for selected competitions
        const entriesToInsert = []
        if (hasCheer)   entriesToInsert.push({ team_id: newTeam.id, competition_type: 'cheerdance', photo_url: cheerUrl })
        if (hasPageant) entriesToInsert.push({ team_id: newTeam.id, competition_type: 'pageant' })

        const { data: entries, error: entriesError } = await supabase
          .from('team_entries')
          .insert(entriesToInsert)
          .select()
        if (entriesError) throw entriesError

        if (hasPageant) {
          const pageantEntry = entries?.find(e => e.competition_type === 'pageant')
          if (pageantEntry) {
            const { error: candidatesError } = await supabase.from('candidates').insert([
              { team_entry_id: pageantEntry.id, category: 'binibini', name: form.binibiniName.trim(), photo_url: binibiniUrl, candidate_number: binibiniNum },
              { team_entry_id: pageantEntry.id, category: 'ginoo', name: form.ginooName.trim(), photo_url: ginooUrl, candidate_number: ginooNum },
            ])
            if (candidatesError) {
              if (candidatesError.code === '23505') throw new Error(`One of the candidate numbers is already taken. Please choose another number.`)
              throw candidatesError
            }
          }
        }

        showToast(`Team "${form.name.trim()}" created successfully!`)
        setShowModal(false)
        load()
      } catch (err) {
        if (createdTeamId) await supabase.from('teams').delete().eq('id', createdTeamId)
        showToast(err.message, 'error')
      } finally {
        setBusy(false)
      }
    }
  }

  async function handleDelete(team) {
    setDeleting(team)
    setCheckingScores(true)
    setDeleteScoreCount(0)

    try {
      const entryIds = team.team_entries?.map(e => e.id) || []
      const candIds  = team.team_entries?.flatMap(e => e.candidates?.map(c => c.id) || []) || []

      let count = 0

      if (entryIds.length > 0) {
        const { count: cheerCount } = await supabase
          .from('scores')
          .select('id', { count: 'exact', head: true })
          .in('team_entry_id', entryIds)
        count += (cheerCount || 0)
      }

      if (candIds.length > 0) {
        const { count: candCount } = await supabase
          .from('scores')
          .select('id', { count: 'exact', head: true })
          .in('candidate_id', candIds)
        count += (candCount || 0)
      }

      setDeleteScoreCount(count)
    } catch (err) {
      console.error('Error checking team scores:', err)
    } finally {
      setCheckingScores(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      // Re-fetch fresh IDs from DB to avoid stale state issues
      const { data: freshEntries } = await supabase
        .from('team_entries')
        .select('id, candidates(id)')
        .eq('team_id', deleting.id)

      const entryIds = (freshEntries || []).map(e => e.id)
      const candIds  = (freshEntries || []).flatMap(e => (e.candidates || []).map(c => c.id))

      // Step 1: Delete unlock_requests by candidate_id FIRST (FK constraint)
      if (candIds.length > 0) {
        await supabase.from('unlock_requests').delete().in('candidate_id', candIds)
      }

      // Step 2: Delete unlock_requests by team_entry_id
      if (entryIds.length > 0) {
        await supabase.from('unlock_requests').delete().in('team_entry_id', entryIds)
      }

      // Step 3: Delete scores linked to candidates
      if (candIds.length > 0) {
        await supabase.from('scores').delete().in('candidate_id', candIds)
      }

      // Step 4: Delete scores linked to team entries (cheerdance)
      if (entryIds.length > 0) {
        await supabase.from('scores').delete().in('team_entry_id', entryIds)
      }

      // Step 5: Delete rankings linked to candidates
      if (candIds.length > 0) {
        await supabase.from('rankings').delete().in('candidate_id', candIds)
      }

      // Step 6: Delete rankings linked to team entries
      if (entryIds.length > 0) {
        await supabase.from('rankings').delete().in('team_entry_id', entryIds)
      }

      // Step 7: Delete candidates
      if (candIds.length > 0) {
        await supabase.from('candidates').delete().in('id', candIds)
      }

      // Step 8: Delete team_entries
      if (entryIds.length > 0) {
        await supabase.from('team_entries').delete().in('id', entryIds)
      }

      // Step 9: Finally delete the team itself
      const { error } = await supabase.from('teams').delete().eq('id', deleting.id)
      if (error) throw error

      showToast(`Team "${deleting.name}" deleted.`)
      if (selectedTeamId === deleting.id) {
        setSelectedTeamId(null)
      }
      setDeleting(null)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to delete team.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function updateCandidate(candidateId, field, value) {
    const { error } = await supabase.from('candidates').update({ [field]: value }).eq('id', candidateId)
    if (error) {
      if (error.code === '23505') {
        showToast('That candidate number is already taken.', 'error')
      } else {
        showToast(error.message, 'error')
      }
      return false
    }
    load()
    return true
  }

  async function updateBothCandidates(ginooId, binibiniId, value) {
    const num = (value !== '' && value !== null) ? parseInt(value, 10) : null
    for (const cid of [ginooId, binibiniId]) {
      if (!cid) continue
      const { error } = await supabase.from('candidates').update({ candidate_number: num }).eq('id', cid)
      if (error) {
        if (error.code === '23505') showToast(`Candidate #${num} is already taken by another team.`, 'error')
        else showToast(error.message, 'error')
        return false
      }
    }
    load()
    if (num !== null) {
      showToast(`Team candidate number updated to #${num} for both Ginoo & Binibini!`)
    }
    return true
  }

  async function updateCandidatePhoto(candidateId, file) {
    try {
      const url = await uploadPhoto(file, 'candidates')
      await supabase.from('candidates').update({ photo_url: url }).eq('id', candidateId)
      load()
      showToast('Candidate photo updated!')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function updateCheerPhoto(entryId, file) {
    try {
      const url = await uploadPhoto(file, 'cheerdance')
      await supabase.from('team_entries').update({ photo_url: url }).eq('id', entryId)
      load()
      showToast('Cheerdance group photo updated!')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || null

  return (
    <div style={{ width: '100%' }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      {/* Main Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          {selectedTeam ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedTeamId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', marginBottom: 8 }}
            >
              <ArrowLeft size={14} /> Back to All Teams
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(46,125,50,0.08)', borderRadius: 6, border: '1px solid rgba(46,125,50,0.2)', marginBottom: 8 }}>
              <Users2 size={13} color="var(--pageant-primary)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--pageant-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Teams &amp; Candidate Registry
              </span>
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {selectedTeam ? selectedTeam.name : 'Teams Management'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {selectedTeam ? 'Manage team details, photos, and candidate entries' : 'Register and manage teams, cheerdance entries, and pageant candidates'}
          </p>
        </div>
        {!selectedTeam && (
          <button
            type="button"
            className="btn btn-gold btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8 }}
            onClick={openAdd}
          >
            <Plus size={15} /> Add Team
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div className="spinner" />
        </div>
      ) : selectedTeam ? (
        <TeamDetailView
          team={selectedTeam}
          activeTab={detailTab}
          onTabChange={setDetailTab}
          onEdit={() => openEdit(selectedTeam)}
          onDelete={() => handleDelete(selectedTeam)}
          onUpdateCandidate={updateCandidate}
          onUpdateBothCandidates={updateBothCandidates}
          onUpdateCandidatePhoto={updateCandidatePhoto}
          onUpdateCheerPhoto={updateCheerPhoto}
        />
      ) : teams.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <Users2 size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No teams added yet</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Add your first team to configure Cheerdance and Pageant participants.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            Add Team
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teams.map(team => (
            <TeamRowCard
              key={team.id}
              team={team}
              onSelect={() => {
                setSelectedTeamId(team.id)
                setDetailTab('cheerdance')
              }}
              onEdit={() => openEdit(team)}
              onDelete={() => handleDelete(team)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg" style={{ borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                {editing ? 'Edit Team Details' : 'Add New Team'}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => !busy && setShowModal(false)}
                disabled={busy}
                style={{ padding: 4, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close"
              >
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleSave}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Team Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Falcon Squadron"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                      autoFocus
                      disabled={busy}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Team Logo</label>
                    <div className="photo-upload-zone">
                      {form.logoPreview ? (
                        <div className="photo-preview-container">
                          <img src={form.logoPreview} alt="Logo Preview" className="photo-preview-img-large" />
                          <button type="button" className="btn btn-danger btn-xs" onClick={() => clearFile('logo')} disabled={busy}>
                            Remove Logo
                          </button>
                        </div>
                      ) : (
                        <label className="photo-upload-label">
                          <Upload size={22} color="var(--pageant-primary)" />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Click to upload Team Logo</span>
                          <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                          <input type="file" accept="image/*" onChange={e => handleFileChange('logo', e.target.files?.[0])} style={{ display: 'none' }} disabled={busy} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} disabled={busy}>Cancel</button>
                  <button type="submit" className="btn btn-gold btn-sm" disabled={busy}>
                    {busy ? <span className="spinner spinner-sm" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="wizard-container">
                {/* ── Dynamic step progress bar ── */}
                {(() => {
                  const hasCheer   = form.participates_in.includes('cheerdance')
                  const hasPageant = form.participates_in.includes('pageant')
                  // Build ordered step list
                  const steps = [1, 2] // name, competition-select
                  if (hasCheer)   steps.push(3)   // cheer photo
                  if (hasPageant) steps.push(4, 5) // ginoo, binibini
                  const currentIdx = steps.indexOf(wizardStep)
                  const totalSteps = steps.length

                  return (
                    <div className="wizard-progress" style={{ marginBottom: 20 }}>
                      {steps.map((s, i) => (
                        <div
                          key={s}
                          className={`wizard-step-node ${wizardStep === s ? 'active' : ''} ${i < currentIdx ? 'completed' : ''}`}
                        >
                          {i < currentIdx ? '✓' : i + 1}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Step 1: Team Info */}
                {wizardStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="wizard-step-title" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Step 1: Team Information</div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Team Name <span style={{ color: 'var(--error)' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder="e.g. Falcon Squadron"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (form.name.trim()) setWizardStep(2) } }}
                        required
                        autoFocus
                        disabled={busy}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Team Logo (Optional)</label>
                      <div className="photo-upload-zone">
                        {form.logoPreview ? (
                          <div className="photo-preview-container">
                            <img src={form.logoPreview} alt="Logo Preview" className="photo-preview-img-large" />
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => clearFile('logo')} disabled={busy}>
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="photo-upload-label">
                            <Upload size={20} color="var(--pageant-primary)" />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Team Logo</span>
                            <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" onChange={e => handleFileChange('logo', e.target.files?.[0])} style={{ display: 'none' }} disabled={busy} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Competition Selection */}
                {wizardStep === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="wizard-step-title" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Step 2: Competition Participation</div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Select which competitions <strong>{form.name}</strong> will participate in. You can choose one or both.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                      {/* Cheerdance Toggle */}
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 10,
                          border: `2px solid ${form.participates_in.includes('cheerdance') ? 'var(--pageant-primary)' : 'var(--border)'}`,
                          background: form.participates_in.includes('cheerdance') ? 'rgba(46,125,50,0.06)' : 'var(--bg-elevated)',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.participates_in.includes('cheerdance')}
                          onChange={() => setForm(f => ({
                            ...f,
                            participates_in: f.participates_in.includes('cheerdance')
                              ? f.participates_in.filter(c => c !== 'cheerdance')
                              : [...f.participates_in, 'cheerdance']
                          }))}
                          style={{ width: 18, height: 18, accentColor: 'var(--pageant-primary)', flexShrink: 0 }}
                          disabled={busy}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ padding: '6px 8px', background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                            <Megaphone size={18} color="var(--pageant-primary)" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Cheerdance</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Team performs as a group in the cheerdance competition</div>
                          </div>
                        </div>
                      </label>

                      {/* Pageant Toggle */}
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 10,
                          border: `2px solid ${form.participates_in.includes('pageant') ? 'var(--pageant-primary)' : 'var(--border)'}`,
                          background: form.participates_in.includes('pageant') ? 'rgba(46,125,50,0.06)' : 'var(--bg-elevated)',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.participates_in.includes('pageant')}
                          onChange={() => setForm(f => ({
                            ...f,
                            participates_in: f.participates_in.includes('pageant')
                              ? f.participates_in.filter(c => c !== 'pageant')
                              : [...f.participates_in, 'pageant']
                          }))}
                          style={{ width: 18, height: 18, accentColor: 'var(--pageant-primary)', flexShrink: 0 }}
                          disabled={busy}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ padding: '6px 8px', background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                            <Crown size={18} color="var(--pageant-primary)" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Pageant (Ginoo & Binibini)</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Team sends one male and one female candidate for the pageant</div>
                          </div>
                        </div>
                      </label>
                    </div>

                    {form.participates_in.length === 0 && (
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fecaca', fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
                        ⚠️ Select at least one competition to continue.
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Cheerdance Photo (only if cheerdance selected) */}
                {wizardStep === 3 && form.participates_in.includes('cheerdance') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="wizard-step-title" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Cheerdance Group Entry</div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Cheerdance Group Photo (Optional)</label>
                      <div className="photo-upload-zone">
                        {form.cheerPreview ? (
                          <div className="photo-preview-container">
                            <img src={form.cheerPreview} alt="Cheer Preview" className="photo-preview-img-large" />
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => clearFile('cheer')} disabled={busy}>
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="photo-upload-label">
                            <Megaphone size={20} color="var(--pageant-primary)" />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Cheerdance Group Photo</span>
                            <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" onChange={e => handleFileChange('cheer', e.target.files?.[0])} style={{ display: 'none' }} disabled={busy} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Binibini Candidate (only if pageant selected) */}
                {wizardStep === 4 && form.participates_in.includes('pageant') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="wizard-step-title" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Pageant — Binibini (Female) Candidate</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Binibini Candidate Name <span style={{ color: 'var(--error)' }}>*</span></label>
                        <input
                          className="form-input"
                          placeholder="e.g. Maria Clara"
                          value={form.binibiniName}
                          onChange={e => setForm(f => ({ ...f, binibiniName: e.target.value }))}
                          required
                          autoFocus
                          disabled={busy}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Binibini # <span style={{ color: 'var(--error)' }}>*</span></label>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 1"
                          value={form.binibiniNumber}
                          onChange={e => setForm(f => ({ ...f, binibiniNumber: e.target.value }))}
                          required
                          disabled={busy}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Binibini Photo (Optional)</label>
                      <div className="photo-upload-zone">
                        {form.binibiniPreview ? (
                          <div className="photo-preview-container">
                            <img src={form.binibiniPreview} alt="Binibini Preview" className="photo-preview-img-large" />
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => clearFile('binibini')} disabled={busy}>
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="photo-upload-label">
                            <Crown size={20} color="#c0392b" />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Binibini Portrait</span>
                            <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" onChange={e => handleFileChange('binibini', e.target.files?.[0])} style={{ display: 'none' }} disabled={busy} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Ginoo Candidate (only if pageant selected) */}
                {wizardStep === 5 && form.participates_in.includes('pageant') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="wizard-step-title" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Pageant — Ginoo (Male) Candidate</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Ginoo Candidate Name <span style={{ color: 'var(--error)' }}>*</span></label>
                        <input
                          className="form-input"
                          placeholder="e.g. Juan Dela Cruz"
                          value={form.ginooName}
                          onChange={e => setForm(f => ({ ...f, ginooName: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && form.ginooName.trim() && form.ginooNumber && !busy) handleSave(e) }}
                          required
                          autoFocus
                          disabled={busy}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Ginoo # <span style={{ color: 'var(--error)' }}>*</span></label>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 1"
                          value={form.ginooNumber}
                          onChange={e => setForm(f => ({ ...f, ginooNumber: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && form.ginooName.trim() && form.ginooNumber && !busy) handleSave(e) }}
                          required
                          disabled={busy}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Ginoo Photo (Optional)</label>
                      <div className="photo-upload-zone">
                        {form.ginooPreview ? (
                          <div className="photo-preview-container">
                            <img src={form.ginooPreview} alt="Ginoo Preview" className="photo-preview-img-large" />
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => clearFile('ginoo')} disabled={busy}>
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="photo-upload-label">
                            <Crown size={20} color="var(--pageant-primary)" />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Ginoo Portrait</span>
                            <span className="photo-upload-sub text-xs">PNG, JPG up to 5MB</span>
                            <input type="file" accept="image/*" onChange={e => handleFileChange('ginoo', e.target.files?.[0])} style={{ display: 'none' }} disabled={busy} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Wizard Navigation */}
                {(() => {
                  const hasCheer   = form.participates_in.includes('cheerdance')
                  const hasPageant = form.participates_in.includes('pageant')
                  const steps = [1, 2]
                  if (hasCheer)   steps.push(3)
                  if (hasPageant) steps.push(4, 5)
                  const currentIdx = steps.indexOf(wizardStep)
                  const isLast = currentIdx === steps.length - 1
                  const isFirstStep = wizardStep === 1

                  // Determine if Next is disabled
                  const nextDisabled = (() => {
                    if (wizardStep === 1) return !form.name.trim()
                    if (wizardStep === 2) return form.participates_in.length === 0
                    if (wizardStep === 4) return !form.binibiniName.trim() || !form.binibiniNumber
                    if (wizardStep === 5) return !form.ginooName.trim() || !form.ginooNumber
                    return false
                  })()

                  // If only cheerdance (no pageant), last step is step 3 — Save directly
                  const isSaveStep = isLast

                  function goNext() {
                    const nextStep = steps[currentIdx + 1]
                    if (nextStep) setWizardStep(nextStep)
                  }

                  return (
                    <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                      {isFirstStep ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} disabled={busy}>Cancel</button>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWizardStep(steps[currentIdx - 1])} disabled={busy}>Back</button>
                      )}

                      {isSaveStep ? (
                        <button
                          type="button"
                          className="btn btn-gold btn-sm"
                          disabled={busy || nextDisabled}
                          onClick={handleSave}
                        >
                          {busy ? <span className="spinner spinner-sm" /> : 'Save Team'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-gold btn-sm"
                          disabled={nextDisabled}
                          onClick={goNext}
                        >
                          Next Step
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <div className="modal-overlay" onClick={() => !busy && setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: deleteScoreCount > 0 ? 'rgba(242,183,5,0.12)' : 'rgba(192,57,43,0.1)', borderRadius: 8 }}>
                {deleteScoreCount > 0 ? (
                  <AlertTriangle size={20} color="#d97706" />
                ) : (
                  <Trash2 size={18} color="var(--error)" />
                )}
              </div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {deleteScoreCount > 0 ? 'Cannot Delete Team' : 'Delete Team?'}
              </h2>
            </div>

            {checkingScores ? (
              <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                <span className="spinner spinner-sm" />
                Checking for existing scores...
              </div>
            ) : deleteScoreCount > 0 ? (
              <div>
                <div style={{
                  padding: '12px 14px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  marginBottom: 14,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.45 }}>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Scores Recorded by Judges</strong>
                    Judges have already submitted <strong>{deleteScoreCount}</strong> score(s) for <strong>{deleting.name}</strong>.
                  </div>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  This team cannot be deleted while it has active scoring records attached to it. If you need to remove this team, please clear or reset the judges' scores in the database first.
                </p>
                <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)} disabled={busy}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: 20, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Are you sure you want to delete <strong>{deleting.name}</strong>? This will remove the team and all associated candidate profiles.
                </p>
                <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)} disabled={busy}>Cancel</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={busy}>
                    {busy ? <span className="spinner spinner-sm" /> : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 1. Team Row Card ────────────────────────────────────────── */
function TeamRowCard({ team, onSelect, onEdit, onDelete }) {
  return (
    <div className="card" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--bg-surface)'
    }}>
      <div onClick={onSelect} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flex: 1 }}>
        <img
          src={team.logo_url || '/palayan.png'}
          alt={team.name}
          style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1.5px solid var(--border)' }}
        />
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{team.name}</h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Click to configure entries and portraits</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-xs" onClick={onSelect} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px' }}>
          <span>View Entries</span> <ArrowRight size={13} />
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}>
          <Edit3 size={13} /> Edit
        </button>
        <button type="button" className="btn btn-danger btn-xs" onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/* ── 2. Team Detail View ──────────────────────────────────────── */
function TeamDetailView({
  team,
  activeTab,
  onTabChange,
  onEdit,
  onDelete,
  onUpdateCandidate,
  onUpdateBothCandidates,
  onUpdateCandidatePhoto,
  onUpdateCheerPhoto
}) {
  const cheerdance = team.team_entries?.find(e => e.competition_type === 'cheerdance')
  const pageant = team.team_entries?.find(e => e.competition_type === 'pageant')
  const ginoo = pageant?.candidates?.find(c => c.category === 'ginoo')
  const binibini = pageant?.candidates?.find(c => c.category === 'binibini')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Team Header Banner */}
      <div className="card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <img
          src={team.logo_url || '/palayan.png'}
          alt={team.name}
          style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1.5px solid var(--border)' }}
        />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{team.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Manage competition entries, group photos, and candidate portraits
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Edit3 size={13} /> Edit Info
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Delete Team
          </button>
        </div>
      </div>

      {/* Tab Controls */}
      <div style={{
        display: 'inline-flex',
        background: 'var(--bg-elevated)',
        padding: 4,
        borderRadius: 10,
        border: '1px solid var(--border)',
        gap: 4,
        alignSelf: 'flex-start'
      }}>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'cheerdance' ? 'var(--pageant-primary)' : 'transparent',
            color: activeTab === 'cheerdance' ? '#FFFFFF' : 'var(--text-secondary)',
            fontWeight: activeTab === 'cheerdance' ? 700 : 600,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
          onClick={() => onTabChange('cheerdance')}
        >
          <Megaphone size={15} /> Cheerdance Entry
        </button>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'pageant' ? 'var(--pageant-primary)' : 'transparent',
            color: activeTab === 'pageant' ? '#FFFFFF' : 'var(--text-secondary)',
            fontWeight: activeTab === 'pageant' ? 700 : 600,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
          onClick={() => onTabChange('pageant')}
        >
          <Crown size={15} /> Pageant Candidates
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'cheerdance' && (
          <CheerdanceDetailTab
            entryId={cheerdance?.id}
            photoUrl={cheerdance?.photo_url}
            onUpdateCheerPhoto={onUpdateCheerPhoto}
          />
        )}

        {activeTab === 'pageant' && (
          <PageantDetailTab
            ginoo={ginoo}
            binibini={binibini}
            onUpdateCandidate={onUpdateCandidate}
            onUpdateBothCandidates={onUpdateBothCandidates}
            onUpdateCandidatePhoto={onUpdateCandidatePhoto}
          />
        )}
      </div>
    </div>
  )
}

/* ── 3. Cheerdance Detail Tab ─────────────────────────────────── */
function CheerdanceDetailTab({ entryId, photoUrl, onUpdateCheerPhoto }) {
  const [localPhoto, setLocalPhoto] = useState(photoUrl || '')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setLocalPhoto(photoUrl || '')
  }, [photoUrl])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setLocalPhoto(objectUrl)
    setUploading(true)
    try {
      await onUpdateCheerPhoto(entryId, file)
    } catch (err) {
      alert(err.message)
      setLocalPhoto(photoUrl || '')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Cheerdance Group Photo</h3>
          <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            High-resolution team group photo shown to judges during routine scoring
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => document.getElementById(`cheer-large-input-${entryId}`).click()}
          disabled={uploading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {uploading ? <span className="spinner spinner-sm" /> : <Camera size={14} />}
          <span>Upload Photo</span>
        </button>
        <input
          id={`cheer-large-input-${entryId}`}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className="cheer-large-photo-container" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elevated)', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={localPhoto || '/palayan.png'}
          alt="Cheerdance Group"
          style={{ width: '100%', maxHeight: 420, objectFit: 'cover' }}
        />
        {uploading && (
          <div className="photo-upload-spinner-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 8 }}>
            <span className="spinner" />
            <span>Uploading photo...</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 4. Pageant Detail Tab ────────────────────────────────────── */
function PageantDetailTab({
  ginoo,
  binibini,
  onUpdateCandidate,
  onUpdateCandidatePhoto
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <LargeCandidateCard
          label="Binibini (Female)"
          badgeClass="badge-binibini"
          candidate={binibini}
          onSave={onUpdateCandidate}
          onPhotoUpload={(file) => onUpdateCandidatePhoto(binibini?.id, file)}
        />

        <LargeCandidateCard
          label="Ginoo (Male)"
          badgeClass="badge-ginoo"
          candidate={ginoo}
          onSave={onUpdateCandidate}
          onPhotoUpload={(file) => onUpdateCandidatePhoto(ginoo?.id, file)}
        />
      </div>
    </div>
  )
}

/* ── 5. Large Candidate Card ─────────────────────────────────── */
function LargeCandidateCard({
  label,
  candidate,
  onSave,
  onPhotoUpload
}) {
  const [name, setName] = useState(candidate?.name || '')
  const [candNum, setCandNum] = useState(candidate?.candidate_number ?? '')
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [localPhoto, setLocalPhoto] = useState(candidate?.photo_url || '')
  const [pendingName, setPendingName] = useState(null)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => { setName(candidate?.name || '') }, [candidate?.name])
  useEffect(() => { setCandNum(candidate?.candidate_number ?? '') }, [candidate?.candidate_number])
  useEffect(() => { setLocalPhoto(candidate?.photo_url || '') }, [candidate?.photo_url])

  function handleNameBlur() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(candidate?.name || '')
      return
    }
    if (trimmed !== (candidate?.name || '')) {
      setPendingName(trimmed)
    }
  }

  async function handleNumBlur() {
    const parsed = candNum !== '' ? parseInt(candNum, 10) : null
    const original = candidate?.candidate_number ?? null
    if (parsed !== original) {
      const ok = await onSave(candidate?.id, 'candidate_number', parsed)
      if (ok !== false) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setCandNum(candidate?.candidate_number ?? '')
      }
    }
  }

  async function confirmNameChange() {
    if (!pendingName) return
    setSavingName(true)
    try {
      const ok = await onSave(candidate?.id, 'name', pendingName)
      if (ok !== false) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setName(candidate?.name || '')
      }
    } finally {
      setSavingName(false)
      setPendingName(null)
    }
  }

  function cancelNameChange() {
    setName(candidate?.name || '')
    setPendingName(null)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setLocalPhoto(objectUrl)
    setUploading(true)
    try {
      await onPhotoUpload(file)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      alert(err.message)
      setLocalPhoto(candidate?.photo_url || '')
    } finally {
      setUploading(false)
    }
  }

  const isGinoo = label.includes('Ginoo')

  return (
    <div className="card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 4,
            background: isGinoo ? 'rgba(46,125,50,0.1)' : 'rgba(192,57,43,0.1)',
            color: isGinoo ? 'var(--pageant-primary)' : '#c0392b',
            border: '1px solid var(--border)',
            textTransform: 'uppercase'
          }}>
            {label}
          </span>
          {candidate?.candidate_number != null && (
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a'
            }}>
              #{candidate.candidate_number}
            </span>
          )}
        </div>
        {saved && (
          <span style={{ fontSize: '0.74rem', color: 'var(--pageant-primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Saved
          </span>
        )}
      </div>

      {/* Portrait Photo Frame */}
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elevated)', aspectRatio: '3/4', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={localPhoto || '/palayan.png'}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 6 }}>
            <span className="spinner" />
            <span style={{ fontSize: '0.78rem' }}>Uploading...</span>
          </div>
        )}
        <div
          onClick={() => document.getElementById(`large-file-${candidate?.id}`).click()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            color: '#FFFFFF',
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Click to change portrait
        </div>
        <input
          id={`large-file-${candidate?.id}`}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Name and Number Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Candidate Name</label>
          <input
            className="form-input"
            placeholder={`Enter ${label} name`}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.target.blur()
              }
            }}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Number</label>
          <input
            type="number"
            min="1"
            className="form-input"
            style={{ textAlign: 'center', fontWeight: 800, color: 'var(--pageant-primary)' }}
            placeholder="#"
            value={candNum}
            onChange={e => setCandNum(e.target.value)}
            onBlur={handleNumBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.target.blur()
              }
            }}
          />
        </div>
      </div>

      {/* Name Change Modal */}
      {pendingName && (
        <div className="modal-overlay" onClick={cancelNameChange}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, background: 'rgba(46,125,50,0.1)', borderRadius: 8 }}>
                <Edit3 size={18} color="var(--pageant-primary)" />
              </div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Confirm Name Change
              </h2>
            </div>
            <p style={{ marginBottom: 20, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Update candidate name from{' '}
              <strong>&quot;{candidate?.name || 'Unnamed'}&quot;</strong> to{' '}
              <strong style={{ color: 'var(--pageant-primary)' }}>&quot;{pendingName}&quot;</strong>?
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelNameChange} disabled={savingName}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={confirmNameChange} disabled={savingName}>
                {savingName ? <span className="spinner spinner-sm" /> : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
