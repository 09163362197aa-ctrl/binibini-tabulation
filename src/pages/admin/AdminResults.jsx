import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  FileText,
  FileSpreadsheet,
  Trophy,
  Award,
  Filter,
  Users,
  Layers,
  Crown,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  User
} from 'lucide-react'
import {
  printCheerdanceTabulation,
  printCheerdanceRankings,
  printPageantStageTabulation,
  printPageantOverallRankings,
  printPageantOverallTabulation,
  printPageantCoronationTransferSheet
} from '../../lib/printReports'

export default function AdminResults() {
  const [results, setResults]         = useState({ cheerdance: [], pageant: { ginoo: [], binibini: [], ginooAwards: [], binibiniAwards: [] } })
  const [rawScores, setRawScores]     = useState([])
  const [rawCriteria, setRawCriteria] = useState([])
  const [judgesList, setJudgesList]   = useState([])
  const [teamsData, setTeamsData]     = useState([])
  const [candidatesData, setCandidatesData] = useState([])
  const [loading, setLoading]         = useState(true)
  const tab                           = 'binibini'

  // Report Controls State
  const [selectedJudgeId, setSelectedJudgeId]   = useState('all')
  const [selectedStageId, setSelectedStageId]   = useState('')

  // Warning modal state
  const [warningModal, setWarningModal] = useState(null) // { issues, onProceed }

  // All scores (locked + draft) for completeness checks
  const [allScoresRaw, setAllScoresRaw] = useState([])

  useEffect(() => {
    async function load() {
      const [
        { data: rankData },
        { data: entries },
        { data: candidates },
        { data: scoresData },
        { data: criteriaData },
        { data: judgesData },
        { data: allScores }
      ] = await Promise.all([
        supabase.from('rankings').select('team_entry_id, candidate_id, final_score, judges_scored'),
        supabase.from('team_entries').select('id, competition_type, team:teams(id, name)'),
        supabase.from('candidates').select('id, category, name, candidate_number, team_entry:team_entry_id(id, team:teams(name))'),
        supabase.from('scores').select('candidate_id, team_entry_id, criterion_id, value, is_locked, judge_id').eq('is_locked', true),
        supabase.from('criteria').select('id, key, label, max_score, parent_id, display_order, competition_type').order('display_order'),
        supabase.from('profiles').select('id, name, username, allowed_competitions').eq('role', 'judge').order('name'),
        supabase.from('scores').select('candidate_id, team_entry_id, criterion_id, judge_id, is_locked')
      ])

      if (!rankData || !entries) { setLoading(false); return }

      setRawScores(scoresData || [])
      setRawCriteria(criteriaData || [])
      setJudgesList(judgesData || [])
      setTeamsData(entries || [])
      setCandidatesData(candidates || [])
      setAllScoresRaw(allScores || [])

      // Set default selected stage ID for Pageant reports (defaults to overall combined)
      setSelectedStageId('overall')

      // Build judge permission sets — only count judges allowed for each competition
      const cheerJudgeIds   = new Set((judgesData || []).filter(j => (j.allowed_competitions || ['cheerdance', 'pageant']).includes('cheerdance')).map(j => j.id))
      const pageantJudgeIds = new Set((judgesData || []).filter(j => (j.allowed_competitions || ['cheerdance', 'pageant']).includes('pageant')).map(j => j.id))

      // Build cheerdance score per team_entry — only from cheer-allowed judges
      const cheerScoresByEntry = {}
      scoresData?.forEach(s => {
        if (!s.team_entry_id || s.candidate_id) return
        if (!cheerJudgeIds.has(s.judge_id)) return  // skip non-cheer judges
        if (!cheerScoresByEntry[s.team_entry_id]) {
          cheerScoresByEntry[s.team_entry_id] = { total: 0, judges: new Set() }
        }
        cheerScoresByEntry[s.team_entry_id].total += Number(s.value) || 0
        cheerScoresByEntry[s.team_entry_id].judges.add(s.judge_id)
      })

      // Map cheerdance — average across judges
      const cheer = (entries || [])
        .filter(e => e.competition_type === 'cheerdance')
        .map(e => {
          const stats = cheerScoresByEntry[e.id]
          const rankInfo = rankData?.find(r => r.team_entry_id === e.id && !r.candidate_id)
          const judgeCount = stats?.judges.size || rankInfo?.judges_scored || 1
          const finalScore = stats
            ? (stats.total / (judgeCount || 1))
            : (rankInfo?.final_score || 0)
          return {
            team_entry_id: e.id,
            team: e.team?.name || '?',
            competition: 'Cheerdance',
            final_score: finalScore,
            judges_scored: judgeCount
          }
        })
        .filter(r => r.final_score > 0)
        .sort((a, b) => b.final_score - a.final_score)

      // Build parent/child criteria structure
      const pageantCrit = (criteriaData || []).filter(c => c.competition_type === 'pageant')
      const parents = pageantCrit.filter(c => !c.parent_id).sort((a,b) => (a.display_order || 0) - (b.display_order || 0))
      const children = pageantCrit.filter(c => c.parent_id).sort((a,b) => (a.display_order || 0) - (b.display_order || 0))

      // Build criterion_id -> parentId map (no weighting needed — scores are direct)
      const criterionParentMap = {}
      parents.forEach(parent => {
        const stageKids = children.filter(c => c.parent_id === parent.id)
        stageKids.forEach(kid => {
          criterionParentMap[kid.id] = parent.id
        })
      })

      // Accumulate candidate scores + per-stage sub-totals — only from pageant-allowed judges
      const pageantScoresByCand = {}
      scoresData?.forEach(s => {
        if (!s.candidate_id) return
        if (!pageantJudgeIds.has(s.judge_id)) return  // skip non-pageant judges
        if (!pageantScoresByCand[s.candidate_id]) {
          pageantScoresByCand[s.candidate_id] = { total: 0, judges: new Set(), stageScores: {}, stageJudges: {} }
        }

        const directVal = Number(s.value) || 0
        const parentId  = criterionParentMap[s.criterion_id]

        pageantScoresByCand[s.candidate_id].total += directVal
        pageantScoresByCand[s.candidate_id].judges.add(s.judge_id)

        if (parentId) {
          const prev = pageantScoresByCand[s.candidate_id].stageScores[parentId] || 0
          pageantScoresByCand[s.candidate_id].stageScores[parentId] = prev + directVal

          if (!pageantScoresByCand[s.candidate_id].stageJudges[parentId]) {
            pageantScoresByCand[s.candidate_id].stageJudges[parentId] = new Set()
          }
          pageantScoresByCand[s.candidate_id].stageJudges[parentId].add(s.judge_id)
        }
      })

      // Helper: build ranked candidate list for a category with stage conversion weights (Overall 50%)
      function buildCategoryList(category) {
        return (candidates || [])
          .filter(c => c.category === category)
          .map(c => {
            const stats = pageantScoresByCand[c.id]
            const rankInfo = rankData?.find(r => r.candidate_id === c.id)
            const judgeCount = stats?.judges.size || rankInfo?.judges_scored || 1

            // Compute weighted final score across all stages (TV 10%, Talent 20%, Costume 20% = 50%)
            let weightedFinalScore = 0
            const stageAverages = {}

            parents.forEach(parent => {
              const stageKids = children.filter(k => k.parent_id === parent.id)
              const stageChildMaxSum = stageKids.reduce((sum, k) => sum + (Number(k.max_score) || 0), 0) || 100
              const stageWeight = Number(parent.max_score) || stageChildMaxSum

              const stageJudgeCount = stats?.stageJudges?.[parent.id]?.size || 0
              const stageSum = stats?.stageScores?.[parent.id] || 0
              const stageAvg = stageJudgeCount > 0 ? (stageSum / stageJudgeCount) : 0
              stageAverages[parent.id] = stageAvg

              const stageWeighted = (stageAvg / stageChildMaxSum) * stageWeight
              weightedFinalScore += stageWeighted
            })

            const finalScore = stats ? weightedFinalScore : (rankInfo?.final_score || 0)

            return {
              candidate_id: c.id,
              candidate: c.name || '?',
              candidate_number: c.candidate_number,
              team: c.team_entry?.team?.name || '?',
              category: c.category,
              final_score: finalScore,
              judges_scored: judgeCount,
              stageScores: stats?.stageScores || {},
              stageAverages
            }
          })
          .filter(r => r.final_score > 0)
          .sort((a,b) => b.final_score - a.final_score)
      }

      const ginoo = buildCategoryList('ginoo')
      const binibini = buildCategoryList('binibini')

      // Find winner and full candidate rankings per stage
      function buildStageAwards(category) {
        const catCands = (candidates || []).filter(c => c.category === category)
        return parents.map(parent => {
          const rankedCandidates = catCands
            .map(c => {
              const rec = pageantScoresByCand[c.id]
              const stageJudgeCount = rec?.stageJudges?.[parent.id]?.size || 0
              const stageSum = rec?.stageScores?.[parent.id] || 0
              // stage_avg = average total score for this stage per judge
              const stageAvg = stageJudgeCount > 0 ? (stageSum / stageJudgeCount) : 0
              return {
                candidate_id: c.id,
                candidate: c.name || '?',
                candidate_number: c.candidate_number,
                team: c.team_entry?.team?.name || '?',
                category: c.category,
                stage_avg: stageAvg,
                stage_judge_count: stageJudgeCount
              }
            })
            .sort((a, b) => {
              if (b.stage_avg !== a.stage_avg) return b.stage_avg - a.stage_avg
              if (a.candidate_number != null && b.candidate_number != null) return a.candidate_number - b.candidate_number
              return (a.candidate || '').localeCompare(b.candidate || '')
            })

          const winner = rankedCandidates.find(c => c.stage_avg > 0) || null
          return {
            id: parent.id,
            label: parent.label,
            winner,
            rankings: rankedCandidates
          }
        })
      }

      const ginooAwards    = buildStageAwards('ginoo')
      const binibiniAwards = buildStageAwards('binibini')

      setResults({ cheerdance: cheer, pageant: { ginoo, binibini, ginooAwards, binibiniAwards } })
      setLoading(false)
    }

    load()

    let debounceTimer = null
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        load()
      }, 400)
    }

    const channel = supabase
      .channel('admin-results-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rankings' }, debouncedLoad)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [])

  const cheerJudges   = (judgesList || []).filter(j => (j.allowed_competitions || ['cheerdance', 'pageant']).includes('cheerdance'))
  const pageantJudges = (judgesList || []).filter(j => (j.allowed_competitions || ['cheerdance', 'pageant']).includes('pageant'))

  /* ── Completeness checks ────────────────────────────────────── */

  function scoreStatus(judgeId, filterFn, expectedCount) {
    const all    = allScoresRaw.filter(s => s.judge_id === judgeId && filterFn(s))
    const locked = all.filter(s => s.is_locked)
    if (all.length === 0)           return 'Not Started'
    if (locked.length >= expectedCount) return null
    if (locked.length > 0)          return 'Partially Locked'
    return 'Draft (Not Locked)'
  }

  function buildCheerdanceWarnings(targetJudgeId = selectedJudgeId) {
    const cheerCrit    = rawCriteria.filter(c => c.competition_type === 'cheerdance')
    const cheerEntries = teamsData.filter(e => e.competition_type === 'cheerdance')
    const targetJudges = targetJudgeId && targetJudgeId !== 'all'
      ? cheerJudges.filter(j => j.id === targetJudgeId)
      : cheerJudges

    const issues = []
    targetJudges.forEach(judge => {
      cheerEntries.forEach(entry => {
        const status = scoreStatus(
          judge.id,
          s => s.team_entry_id === entry.id,
          cheerCrit.length
        )
        if (status) issues.push({
          judge: judge.name,
          target: entry.team?.name || '?',
          stage: 'Cheerdance',
          status
        })
      })
    })
    return issues
  }

  function buildPageantStageWarnings(stageId, category, targetJudgeId = selectedJudgeId) {
    const stageObj  = rawCriteria.find(c => c.id === stageId)
    if (!stageObj) return []
    const stageKids = rawCriteria.filter(c => c.parent_id === stageId)
    const catCands  = candidatesData.filter(c => c.category === category)
    const targetJudges = targetJudgeId && targetJudgeId !== 'all'
      ? pageantJudges.filter(j => j.id === targetJudgeId)
      : pageantJudges

    const issues    = []
    targetJudges.forEach(judge => {
      catCands.forEach(cand => {
        const status = scoreStatus(
          judge.id,
          s => s.candidate_id === cand.id && stageKids.some(k => k.id === s.criterion_id),
          stageKids.length
        )
        const barangay = cand.team_entry?.team?.name
        if (status) issues.push({
          judge:    judge.name,
          target:   `${cand.name} (${cand.category === 'ginoo' ? 'Ginoo' : 'Binibini'})`,
          barangay: barangay || null,
          stage:    stageObj.label,
          status
        })
      })
    })
    return issues
  }

  function buildPageantOverallWarnings(category, targetJudgeId = selectedJudgeId) {
    const pageantKids = rawCriteria.filter(c => c.competition_type === 'pageant' && c.parent_id)
    const catCands    = candidatesData.filter(c => c.category === category)
    const targetJudges = targetJudgeId && targetJudgeId !== 'all'
      ? pageantJudges.filter(j => j.id === targetJudgeId)
      : pageantJudges

    const issues      = []
    targetJudges.forEach(judge => {
      catCands.forEach(cand => {
        const status = scoreStatus(
          judge.id,
          s => s.candidate_id === cand.id,
          pageantKids.length
        )
        const barangay = cand.team_entry?.team?.name
        if (status) issues.push({
          judge:    judge.name,
          target:   `${cand.name} (${cand.category === 'ginoo' ? 'Ginoo' : 'Binibini'})`,
          barangay: barangay || null,
          stage:    'All Stages (Overall)',
          status
        })
      })
    })
    return issues
  }

  function generateWithCheck(issues, generateFn) {
    if (issues.length > 0) {
      setWarningModal({ issues, onProceed: generateFn })
    } else {
      generateFn()
    }
  }

  /* ── Report Generation Handlers ─────────────────────────────── */

  function handleGenerateCheerdanceTabulation() {
    const cheerCriteria = rawCriteria.filter(c => c.competition_type === 'cheerdance')
    const cheerTeams = (teamsData || [])
      .filter(e => e.competition_type === 'cheerdance')
      .map(e => ({ team_entry_id: e.id, team: e.team?.name || '?' }))

    generateWithCheck(buildCheerdanceWarnings(selectedJudgeId), () => printCheerdanceTabulation({
      teams: cheerTeams,
      criteria: cheerCriteria,
      scores: rawScores.filter(s => cheerJudges.some(j => j.id === s.judge_id)),
      judges: cheerJudges,
      selectedJudgeId
    }))
  }

  function handleGenerateCheerdanceRankings() {
    generateWithCheck(buildCheerdanceWarnings('all'), () => printCheerdanceRankings({
      rankedTeams: results.cheerdance,
      judges: cheerJudges
    }))
  }

  function handleGeneratePageantStageTabulation() {
    const currentCategory = tab // 'ginoo' or 'binibini'
    const pageantCandidates = (candidatesData || []).map(c => ({
      candidate_id: c.id,
      candidate: c.name || '?',
      candidate_number: c.candidate_number,
      category: c.category,
      team: c.team_entry?.team?.name || '?'
    }))

    const pageantScores = rawScores.filter(s => pageantJudges.some(j => j.id === s.judge_id))

    if (selectedStageId === 'overall') {
      generateWithCheck(buildPageantOverallWarnings(currentCategory, selectedJudgeId), () =>
        printPageantOverallTabulation({
          category: currentCategory,
          candidates: pageantCandidates,
          criteria: rawCriteria,
          scores: pageantScores,
          judges: pageantJudges,
          selectedJudgeId
        })
      )
      return
    }

    const stageObj = rawCriteria.find(c => c.id === selectedStageId || c.key === selectedStageId)
    if (!stageObj) return

    generateWithCheck(buildPageantStageWarnings(selectedStageId, currentCategory, selectedJudgeId), () =>
      printPageantStageTabulation({
        stage: stageObj,
        category: currentCategory,
        candidates: pageantCandidates,
        criteria: rawCriteria,
        scores: pageantScores,
        judges: pageantJudges,
        selectedJudgeId
      })
    )
  }

  function handleGenerateGinooRankings() {
    generateWithCheck(buildPageantOverallWarnings('ginoo', 'all'), () => printPageantOverallRankings({
      category: 'ginoo',
      topCandidates: results.pageant.ginoo,
      judges: pageantJudges
    }))
  }

  function handleGenerateBinibiniRankings() {
    generateWithCheck(buildPageantOverallWarnings('binibini', 'all'), () => printPageantOverallRankings({
      category: 'binibini',
      topCandidates: results.pageant.binibini,
      judges: pageantJudges
    }))
  }

  function handleGenerateCoronationTransferSheet() {
    const currentCategory = tab // 'binibini'
    const pageantCandidates = (candidatesData || []).map(c => ({
      candidate_id: c.id,
      candidate: c.name || '?',
      candidate_number: c.candidate_number,
      category: c.category,
      team: c.team_entry?.team?.name || '?'
    }))

    const pageantScores = rawScores.filter(s => pageantJudges.some(j => j.id === s.judge_id))

    generateWithCheck(buildPageantOverallWarnings(currentCategory, 'all'), () =>
      printPageantCoronationTransferSheet({
        category: currentCategory,
        candidates: pageantCandidates,
        criteria: rawCriteria,
        scores: pageantScores,
        judges: pageantJudges
      })
    )
  }

  const pageantParents = rawCriteria.filter(c => c.competition_type === 'pageant' && !c.parent_id)

  return (
    <div style={{ width: '100%' }}>
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(217,119,6,0.1)', borderRadius: 20, border: '1px solid rgba(217,119,6,0.3)', marginBottom: 8 }}>
            <Crown size={13} color="#D97706" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              50% Preliminary Competition
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Preliminary Results &amp; Tabulation
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Official ranked summaries based on certified scores across Tourism Video (10%), Talent (20%), and Festival-Inspired Costume (20%)
          </p>
        </div>
      </div>

      {/* ── 50% Preliminary Tabulation & Reports Hub ─────── */}
      <div className="card" style={{
        padding: 24,
        borderRadius: 16,
        border: '1.5px solid rgba(212,175,55,0.4)',
        background: 'linear-gradient(145deg, #FFFDF8 0%, #FBF6EA 100%)',
        boxShadow: '0 4px 18px rgba(180,130,30,0.06)',
        marginBottom: 32
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(217,119,6,0.12)', borderRadius: 20, border: '1px solid rgba(217,119,6,0.3)', marginBottom: 8 }}>
              <Crown size={13} color="#D97706" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                50% Preliminary Tabulation
              </span>
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Preliminary Stage Reports &amp; Verification
            </h3>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Generate certified print-ready PDF reports for individual stages (Tourism Video 10%, Talent 20%, Festival-Inspired Costume 20%) or the combined 50% preliminary standings.
            </p>
          </div>
        </div>

        {/* Filters and Action Buttons Row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingTop: 14,
          borderTop: '1px solid rgba(180,130,30,0.16)'
        }}>
          {/* Controls: Stage and Judge Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flex: '1 1 360px' }}>
            {/* Stage Selector */}
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Evaluation Stage
              </label>
              <select
                value={selectedStageId}
                onChange={e => setSelectedStageId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(180,130,30,0.3)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <option value="overall">All 3 Stages Combined (50% Preliminary)</option>
                {pageantParents.map(p => (
                  <option key={p.id} value={p.id}>{p.label} ({p.max_score}% Weight)</option>
                ))}
              </select>
            </div>

            {/* Judge Filter */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Filter Judge
              </label>
              <select
                value={selectedJudgeId}
                onChange={e => setSelectedJudgeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(180,130,30,0.3)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <option value="all">All Scoring Judges</option>
                {pageantJudges.map(j => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={handleGeneratePageantStageTabulation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.86rem',
                fontWeight: 800,
                padding: '10px 20px',
                borderRadius: 10,
                boxShadow: '0 3px 10px rgba(180,130,30,0.22)'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>
                {selectedStageId === 'overall'
                  ? 'Print 50% Tabulation Matrix (PDF)'
                  : 'Print Stage Tabulation Sheet (PDF)'
                }
              </span>
            </button>

            {/* Official 50% Preliminary Scores Transfer Sheet for Coronation Night AU System */}
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleGenerateCoronationTransferSheet}
              title="Print official 50% preliminary transfer sheet for encoding into the AU Coronation software"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.86rem',
                fontWeight: 800,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#FDE68A',
                border: '1.5px solid rgba(212, 175, 55, 0.45)',
                boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                cursor: 'pointer'
              }}
            >
              <Crown size={16} color="#FDE68A" />
              <span>Print AU Coronation 50% Transfer Sheet (PDF)</span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={handleGenerateBinibiniRankings}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.86rem',
                fontWeight: 700,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'var(--bg-surface)',
                border: '1px solid rgba(180,130,30,0.3)',
                color: '#B45309'
              }}
            >
              <Trophy size={16} color="#D97706" />
              <span>Print Preliminary Standings (PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Data View ────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
      ) : (
        <div className="print-area">
          <StageAwardsSection awards={results.pageant.binibiniAwards} />
          <ResultSection
            show={true}
            title="Binibining Palayan — 50% Preliminary Standings"
            rows={results.pageant.binibini}
            nameCol="candidate"
            teamCol="team"
          />
        </div>
      )}

      {/* ── Warning Modal for Incomplete Scores ───────────────── */}
      {warningModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', padding: 24, borderRadius: 14, maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 8, background: 'rgba(242,183,5,0.12)', borderRadius: 8, border: '1px solid rgba(242,183,5,0.3)' }}>
                <AlertTriangle size={20} color="#b45309" strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Incomplete Scores Detected</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  The following judge scores are not yet fully locked. The generated report may reflect partial results.
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 18, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Judge</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Entry / Candidate</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Stage</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {warningModal.issues.map((issue, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{issue.judge}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {issue.target}
                        </div>
                        {issue.barangay && (
                          <div style={{ fontSize: '0.74rem', color: '#B45309', fontWeight: 700, marginTop: 2 }}>
                            {issue.barangay}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{issue.stage}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                          borderRadius: 4,
                          background: issue.status === 'Not Started' ? '#fee2e2' : issue.status === 'Partially Locked' ? '#fef9c3' : '#fde68a',
                          color:      issue.status === 'Not Started' ? '#b91c1c' : issue.status === 'Partially Locked' ? '#92400e' : '#78350f',
                          border:     issue.status === 'Not Started' ? '1px solid #fecaca' : '1px solid #fde68a'
                        }}>
                          {issue.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWarningModal(null)}
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  const cb = warningModal.onProceed
                  setWarningModal(null)
                  cb()
                }}
                style={{
                  background: '#b45309',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px'
                }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stage Awards Leaderboards Component ─────────────────────── */

function StageAwardsSection({ awards }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!awards || awards.length === 0) return null
  const hasAny = awards.some(a => a.rankings && a.rankings.length > 0)
  if (!hasAny) return null

  const currentAward = awards[activeIdx] || awards[0]

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Header & Sub-Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={18} color="#D97706" strokeWidth={2.2} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Stage Awards Comparison
            </h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Individual stage leaderboards on a standard 0–100 score scale
            </p>
          </div>
        </div>

        {/* Stage Sub-Tabs */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-elevated)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--border)',
          gap: 4
        }}>
          {awards.map((award, i) => {
            const isSelected = activeIdx === i
            return (
              <button
                key={award.id || i}
                type="button"
                onClick={() => setActiveIdx(i)}
                style={{
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
                {award.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Full-Width Stage Award Card */}
      {currentAward && (
        <div className="card" style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)'
        }}>
          {/* Active Stage Banner */}
          <div style={{
            padding: '12px 18px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="var(--pageant-primary)" />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {currentAward.label}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ranked by stage average (0–100 scale)
            </span>
          </div>

          {/* Table */}
          {currentAward.rankings && currentAward.rankings.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <th style={{ padding: '10px 18px', width: 64, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Rank</th>
                    <th style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Candidate</th>
                    <th style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Barangay</th>
                    <th style={{ padding: '10px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Judges Scored</th>
                    <th style={{ padding: '10px 18px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Stage Score</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAward.rankings.map((c, idx) => {
                    const isFirst = idx === 0 && c.stage_avg > 0
                    const isSecond = idx === 1 && c.stage_avg > 0
                    const isThird = idx === 2 && c.stage_avg > 0

                    return (
                      <tr key={c.candidate_id || idx} style={{
                        borderBottom: '1px solid var(--border)',
                        background: isFirst ? 'rgba(217,119,6,0.06)' : 'transparent'
                      }}>
                        {/* Rank Badge */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            fontSize: '0.82rem',
                            fontWeight: 900,
                            fontVariantNumeric: 'tabular-nums',
                            background: isFirst ? 'linear-gradient(135deg, #FDE68A 0%, #D97706 100%)' : isSecond ? 'linear-gradient(135deg, #F1F5F9 0%, #94A3B8 100%)' : isThird ? 'linear-gradient(135deg, #FFEDD5 0%, #C2410C 100%)' : 'var(--bg-elevated)',
                            color: (isFirst || isThird) ? '#FFFFFF' : isSecond ? '#0F172A' : 'var(--text-muted)',
                            boxShadow: isFirst ? '0 2px 6px rgba(180,130,30,0.3)' : 'none',
                            border: isFirst ? '1px solid #D97706' : isSecond ? '1px solid #CBD5E1' : isThird ? '1px solid #EA580C' : '1px solid var(--border)'
                          }}>
                            {idx + 1}
                          </span>
                        </td>

                        {/* Candidate Name */}
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
                            <span style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{c.candidate}</span>
                            {c.candidate_number != null && (
                              <span style={{
                                fontSize: '0.72rem',
                                width: 'fit-content',
                                background: 'rgba(217,119,6,0.1)',
                                border: '1px solid rgba(217,119,6,0.25)',
                                borderRadius: 4,
                                padding: '1px 7px',
                                fontWeight: 800,
                                color: '#B45309'
                              }}>
                                Candidate #{c.candidate_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Team */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                          {c.team}
                        </td>

                        {/* Judges Count */}
                        <td style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {c.stage_judge_count > 0 ? `${c.stage_judge_count} judge${c.stage_judge_count !== 1 ? 's' : ''}` : '—'}
                        </td>

                        {/* Stage Score */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          {c.stage_judge_count > 0 && c.stage_avg > 0 ? (
                            <span style={{
                              fontWeight: 900,
                              fontSize: '1.1rem',
                              fontVariantNumeric: 'tabular-nums',
                              color: isFirst ? '#B45309' : 'var(--text-primary)'
                            }}>
                              {Number(c.stage_avg).toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '32px 0' }}>
              No locked scores submitted yet for this stage
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Overall Rankings Table Component ────────────────────────── */

function ResultSection({ show, title, rows, nameCol, teamCol }) {
  if (!show) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Trophy size={18} color="#D97706" strokeWidth={2.2} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Preliminary Standings (50% Overall): Tourism Video (10%) + Talent (20%) + Festival-Inspired Costume (20%)
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', padding: 12, background: 'var(--bg-elevated)', borderRadius: '50%', marginBottom: 12 }}>
            <Trophy size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>No locked scores yet</h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Rankings populate automatically as judges submit and lock their scores.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <th style={{ padding: '11px 18px', width: 64, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Rank</th>
                <th style={{ padding: '11px 18px', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{nameCol === 'team' ? 'Team Name' : 'Candidate Name'}</th>
                {teamCol && <th style={{ padding: '11px 18px', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Barangay</th>}
                <th style={{ padding: '11px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Judges Scored</th>
                <th style={{ padding: '11px 18px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Preliminary Total (50%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isFirst = idx === 0
                const isSecond = idx === 1
                const isThird = idx === 2

                return (
                  <tr key={idx} style={{
                    borderBottom: '1px solid var(--border)',
                    background: isFirst ? 'rgba(217,119,6,0.06)' : 'transparent'
                  }}>
                    {/* Rank Badge */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                        background: isFirst ? 'linear-gradient(135deg, #FDE68A 0%, #D97706 100%)' : isSecond ? 'linear-gradient(135deg, #F1F5F9 0%, #94A3B8 100%)' : isThird ? 'linear-gradient(135deg, #FFEDD5 0%, #C2410C 100%)' : 'var(--bg-elevated)',
                        color: (isFirst || isThird) ? '#FFFFFF' : isSecond ? '#0F172A' : 'var(--text-muted)',
                        boxShadow: isFirst ? '0 2px 6px rgba(180,130,30,0.3)' : 'none',
                        border: isFirst ? '1px solid #D97706' : isSecond ? '1px solid #CBD5E1' : isThird ? '1px solid #EA580C' : '1px solid var(--border)'
                      }}>
                        {idx + 1}
                      </span>
                    </td>

                    {/* Candidate Name */}
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
                        <span style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>{row[nameCol]}</span>
                        {row.candidate_number != null && (
                          <span style={{
                            fontSize: '0.72rem',
                            width: 'fit-content',
                            background: 'rgba(217,119,6,0.1)',
                            border: '1px solid rgba(217,119,6,0.25)',
                            borderRadius: 4,
                            padding: '1px 7px',
                            fontWeight: 800,
                            color: '#B45309'
                          }}>
                            Candidate #{row.candidate_number}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Team */}
                    {teamCol && (
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                        {row[teamCol]}
                      </td>
                    )}

                    {/* Judges count */}
                    <td style={{ padding: '14px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {row.judges_scored} judge{row.judges_scored !== 1 ? 's' : ''}
                    </td>

                    {/* Final Score */}
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 900,
                        fontSize: '1.25rem',
                        fontVariantNumeric: 'tabular-nums',
                        color: isFirst ? '#B45309' : 'var(--text-primary)'
                      }}>
                        {Number(row.final_score).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
