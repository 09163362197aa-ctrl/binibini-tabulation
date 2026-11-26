/**
 * printReports.js — Official PDF Report Generator
 *
 * Uses jsPDF + jspdf-autotable to generate real PDF files.
 * Each function creates a PDF blob and opens it in a new browser tab
 * via the browser's native PDF viewer (no custom HTML page, no extra buttons).
 *
 * Paper Format: Long Bond Paper / Folio — 8.5" × 13" (215.9mm × 330.2mm)
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Long Bond Paper (8.5" × 13") in mm
const PAGE_W = 215.9
const PAGE_H = 330.2
const MARGIN = 14   // mm

// ─── Colour tokens ───────────────────────────────────────────────────────────
const CLR_HEADING = [15, 23, 42]      // dark navy
const CLR_SUBTEXT = [100, 116, 139]   // slate-500
const CLR_TABLE_HEADER_BG = [30, 41, 59]   // slate-800
const CLR_TABLE_HEADER_FG = [255, 255, 255]
const CLR_TOTAL_BG = [241, 245, 249]  // slate-100
const CLR_GOLD = [180, 130, 20]
const CLR_BORDER = [203, 213, 225]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newDoc() {
  return new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'portrait' })
}

function openPdf(doc, filename) {
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    // Fallback: direct download if popup blocked
    doc.save(filename + '.pdf')
  }
}

/**
 * Draw the standard report header block.
 * Returns the Y position after the header (where content should start).
 */
function drawHeader(doc, { sysTitle, title, subtitle }) {
  const x = MARGIN
  let y = MARGIN + 4

  // System title (small caps, muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...CLR_SUBTEXT)
  doc.text(sysTitle.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
  y += 5.5

  // Main title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...CLR_HEADING)
  doc.text(title, PAGE_W / 2, y, { align: 'center' })
  y += 7

  // Subtitle
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text(subtitle, PAGE_W / 2, y, { align: 'center' })
    y += 6
  }

  // Divider
  doc.setDrawColor(...CLR_BORDER)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 4

  // Timestamp right-aligned
  const ts = new Date().toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(...CLR_SUBTEXT)
  doc.text(`Generated: ${ts}`, PAGE_W - MARGIN, y, { align: 'right' })
  y += 5

  return y
}

/**
 * Draw the judge signature block at the bottom.
 * Each judge gets: a horizontal line + bold name + italic role title.
 * Rows with fewer judges (e.g., 5th judge, or 6/7 judges) are automatically centered.
 */
function drawSignatureBlock(doc, judges, roleLabel) {
  if (!judges || judges.length === 0) return

  const maxCols = 4
  const usableW = PAGE_W - MARGIN * 2
  const colW    = usableW / maxCols

  // Split judges into rows of at most maxCols (e.g. 4 on first row, remainder on next row)
  const rows = []
  for (let i = 0; i < judges.length; i += maxCols) {
    rows.push(judges.slice(i, i + maxCols))
  }

  const rowSpacing = 20
  const blockH   = 14 + (rows.length * rowSpacing)
  const startY   = PAGE_H - MARGIN - blockH

  // Section label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...CLR_SUBTEXT)
  const labelText = 'CERTIFIED CORRECT — BOARD OF JUDGES'
  doc.text(labelText, PAGE_W / 2, startY, { align: 'center' })

  // Thin rule under label
  doc.setDrawColor(...CLR_BORDER)
  doc.setLineWidth(0.3)
  const lblW = doc.getTextWidth(labelText)
  doc.line(PAGE_W / 2 - lblW / 2 - 2, startY + 1.5, PAGE_W / 2 + lblW / 2 + 2, startY + 1.5)

  const sigStartY = startY + 11

  rows.forEach((rowJudges, rIdx) => {
    const k = rowJudges.length
    // Center this row within the page
    const rowW = k * colW
    const rowStartX = (PAGE_W - rowW) / 2
    const cy = sigStartY + (rIdx * rowSpacing)

    rowJudges.forEach((j, cIdx) => {
      const cx = rowStartX + cIdx * colW + colW / 2

      // Signature line (width: colW - 8mm)
      doc.setDrawColor(...CLR_HEADING)
      doc.setLineWidth(0.5)
      doc.line(cx - colW / 2 + 4, cy, cx + colW / 2 - 4, cy)

      // Judge name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...CLR_HEADING)
      doc.text(j.name || '—', cx, cy + 4, { align: 'center' })

      // Role
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(...CLR_SUBTEXT)
      doc.text(roleLabel, cx, cy + 8, { align: 'center' })
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHEERDANCE TABULATION SHEET
// ─────────────────────────────────────────────────────────────────────────────

export function printCheerdanceTabulation({ teams, criteria, scores, judges, selectedJudgeId }) {
  const doc = newDoc()

  const activeJudges = selectedJudgeId && selectedJudgeId !== 'all'
    ? judges.filter(j => j.id === selectedJudgeId)
    : judges

  const subtitle = selectedJudgeId && selectedJudgeId !== 'all'
    ? `Individual Verification: ${activeJudges[0]?.name || 'Judge'}`
    : 'Official Verification Sheet — All Scoring Judges'

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Tabulation Report',
    title:    'Cheerdance Competition Tabulation Sheet',
    subtitle,
  })

  // Build table head & body with direct points cap
  const head = [['#', 'Team', ...criteria.map(c => `${c.label}\n(Max: ${c.max_score} pts)`), 'Total Points']]

  // Compute rows and sort by total descending
  const rowData = teams.map((team) => {
    let total = 0
    const critCells = criteria.map(crit => {
      const teamScores = scores.filter(s =>
        s.team_entry_id === team.team_entry_id &&
        s.criterion_id  === crit.id &&
        (selectedJudgeId && selectedJudgeId !== 'all' ? s.judge_id === selectedJudgeId : true)
      )
      if (teamScores.length === 0) return '—'

      // Direct scoring: s.value IS the exact points entered by the judge
      const sumDirect = teamScores.reduce((acc, s) => acc + Number(s.value || 0), 0)
      const avgDirect = sumDirect / teamScores.length

      total += avgDirect

      return avgDirect % 1 === 0 ? avgDirect.toString() : avgDirect.toFixed(2)
    })
    return {
      team: team.team,
      critCells,
      total
    }
  })

  // Sort ranked teams from highest to lowest score
  rowData.sort((a, b) => b.total - a.total)

  const body = rowData.map((row, idx) => [
    idx + 1,
    row.team,
    ...row.critCells,
    { content: row.total % 1 === 0 ? row.total.toString() : row.total.toFixed(2), styles: { fontStyle: 'bold' } }
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_TABLE_HEADER_BG,
      textColor: CLR_TABLE_HEADER_FG,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 10,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 36 },
      [criteria.length + 2]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Cheerdance Judge')
  openPdf(doc, 'Cheerdance_Tabulation_Sheet')
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHEERDANCE CHAMPION RANKING SHEET (Top 4)
// ─────────────────────────────────────────────────────────────────────────────

export function printCheerdanceRankings({ rankedTeams, judges }) {
  const doc  = newDoc()
  const top4 = rankedTeams.slice(0, 4)
  const rankLabels = ['CHAMPION', '1ST RUNNER-UP', '2ND RUNNER-UP', '3RD RUNNER-UP']

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Final Rankings Report',
    title:    'Cheerdance Competition — Official Champion & Winners',
    subtitle: 'Top 4 Final Ranking Standings',
  })

  y += 4

  top4.forEach((team, idx) => {
    const isChamp = idx === 0
    const boxH    = isChamp ? 34 : 27
    const boxX    = MARGIN
    const boxW    = PAGE_W - MARGIN * 2

    // Card background
    if (isChamp) {
      doc.setFillColor(255, 252, 220)
    } else {
      doc.setFillColor(248, 250, 252)
    }
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F')

    // Border
    doc.setDrawColor(isChamp ? 180 : 203, isChamp ? 130 : 213, isChamp ? 20 : 225)
    doc.setLineWidth(isChamp ? 0.8 : 0.3)
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'S')

    // Rank label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 12 : 9)
    doc.setTextColor(...(isChamp ? CLR_GOLD : CLR_SUBTEXT))
    doc.text(rankLabels[idx], boxX + 6, y + (isChamp ? 10 : 8))

    // Team name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 15 : 12)
    doc.setTextColor(...CLR_HEADING)
    doc.text(team.team, boxX + 6, y + (isChamp ? 20 : 17))

    // Score (right-aligned)
    const scoreNum = Number(team.final_score) || 0
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 20 : 15)
    doc.setTextColor(...(isChamp ? CLR_GOLD : CLR_HEADING))
    doc.text(scoreNum % 1 === 0 ? scoreNum.toString() : scoreNum.toFixed(2), boxX + boxW - 6, y + (isChamp ? 20 : 17), { align: 'right' })

    // "Total Points" label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text('Total Points', boxX + boxW - 6, y + (isChamp ? 26 : 22), { align: 'right' })

    y += boxH + 5
  })

  drawSignatureBlock(doc, judges, 'Official Cheerdance Judge')
  openPdf(doc, 'Cheerdance_Champion_Rankings')
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAGEANT PER-STAGE TABULATION SHEET
// ─────────────────────────────────────────────────────────────────────────────

export function printPageantStageTabulation({ stage, category, candidates, criteria, scores, judges, selectedJudgeId }) {
  const doc = newDoc()

  const catLabel    = category === 'ginoo' ? 'Ginoo Division' : 'Binibini Division'
  const filtered    = candidates.filter(c => c.category === category)
  const stageKids   = criteria.filter(c => c.parent_id === stage.id)

  const activeJudges = selectedJudgeId && selectedJudgeId !== 'all'
    ? judges.filter(j => j.id === selectedJudgeId)
    : judges

  const judgeNote = selectedJudgeId && selectedJudgeId !== 'all'
    ? `Individual Verification: ${activeJudges[0]?.name || 'Judge'}`
    : 'Official Verification Sheet — All Scoring Judges'

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Pageant Tabulation Report',
    title:    `${stage.label} — Tabulation Sheet`,
    subtitle: `Category: ${catLabel}   |   ${judgeNote}`,
  })

  // Build head / body with stage conversion weights
  const stageWeight = stage.max_score || 100
  const maxStageTotal = stageKids.reduce((sum, k) => sum + (k.max_score || 0), 0) || 100
  const head = [['#', 'Candidate Name', 'Barangay', ...stageKids.map(k => `${k.label}\n(${k.max_score}%)`), `Stage Total (100%)\n(Converted: ${stageWeight}%)`]]

  const rowData = filtered.map(c => {
    let stageTotal = 0
    const critCells = stageKids.map(kid => {
      const matchScores = scores.filter(s =>
        s.candidate_id  === c.candidate_id &&
        s.criterion_id  === kid.id &&
        (selectedJudgeId && selectedJudgeId !== 'all' ? s.judge_id === selectedJudgeId : true)
      )
      if (matchScores.length === 0) return '—'

      // Direct scoring: s.value is the exact points entered by the judge
      const sumDirect = matchScores.reduce((acc, s) => acc + Number(s.value || 0), 0)
      const avgDirect = sumDirect / matchScores.length
      stageTotal += avgDirect
      return avgDirect % 1 === 0 ? avgDirect.toString() : avgDirect.toFixed(2)
    })

    const numLabel = c.candidate_number != null ? `#${c.candidate_number}` : '—'
    return {
      numLabel,
      candidate: c.candidate,
      team: c.team,
      critCells,
      stageTotal
    }
  })

  // Sort by stage total descending
  rowData.sort((a, b) => b.stageTotal - a.stageTotal)

  const body = rowData.map((r, idx) => {
    const converted = ((r.stageTotal / maxStageTotal) * stageWeight).toFixed(2)
    return [
      idx + 1,
      r.candidate,
      r.team,
      ...r.critCells,
      { content: `${r.stageTotal.toFixed(2)} pts\n(${converted}%)`, styles: { fontStyle: 'bold', halign: 'center' } }
    ]
  })

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_TABLE_HEADER_BG,
      textColor: CLR_TABLE_HEADER_FG,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left',   cellWidth: 40 },
      2: { halign: 'left',   cellWidth: 32 },
      [stageKids.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_${stage.key || stage.label}_${category}_Tabulation`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAGEANT OVERALL RANKING SHEET (Ginoo OR Binibini — Top 4)
// ─────────────────────────────────────────────────────────────────────────────

export function printPageantOverallRankings({ category, topCandidates, judges }) {
  const doc      = newDoc()
  const candidatesToShow = topCandidates.slice(0, 6)
  const divLabel = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const rankLabels = ['RANK 1 — PRELIMINARY LEADER', 'RANK 2', 'RANK 3', 'RANK 4', 'RANK 5', 'RANK 6']

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — 50% Preliminary Competition',
    title:    `${divLabel} — Official Preliminary Standings Sheet`,
    subtitle: `Preliminary Phase (50% Overall): Tourism Video (10%), Talent (20%), Festival-Inspired Costume (20%)`,
  })

  y += 4

  candidatesToShow.forEach((c, idx) => {
    const isLead  = idx === 0
    const boxH    = isLead ? 32 : 24
    const boxX    = MARGIN
    const boxW    = PAGE_W - MARGIN * 2

    if (isLead) {
      doc.setFillColor(255, 252, 220)
    } else {
      doc.setFillColor(248, 250, 252)
    }
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F')
    doc.setDrawColor(isLead ? 180 : 203, isLead ? 130 : 213, isLead ? 20 : 225)
    doc.setLineWidth(isLead ? 0.8 : 0.3)
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'S')

    // Rank label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isLead ? 10 : 8.5)
    doc.setTextColor(...(isLead ? CLR_GOLD : CLR_SUBTEXT))
    doc.text(divLabel + ' · ' + (rankLabels[idx] || `RANK ${idx + 1}`), boxX + 6, y + (isLead ? 9 : 7))

    // Candidate name + number
    const nameStr = c.candidate + (c.candidate_number != null ? `  (#${c.candidate_number})` : '')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isLead ? 14 : 11)
    doc.setTextColor(...CLR_HEADING)
    doc.text(nameStr, boxX + 6, y + (isLead ? 19 : 15))

    // Team
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isLead ? 8.5 : 7.5)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text(c.team || '', boxX + 6, y + (isLead ? 26 : 21))

    // Score (right-aligned)
    const scoreNum = Number(c.final_score) || 0
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isLead ? 18 : 13)
    doc.setTextColor(...(isLead ? CLR_GOLD : CLR_HEADING))
    doc.text(`${(scoreNum % 1 === 0 ? scoreNum.toString() : scoreNum.toFixed(2))}%`, boxX + boxW - 6, y + (isLead ? 18 : 15), { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text('Preliminary Total (50% Max)', boxX + boxW - 6, y + (isLead ? 25 : 21), { align: 'right' })

    y += boxH + 4
  })

  drawSignatureBlock(doc, judges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_${divLabel}_Preliminary_Standings`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PAGEANT COMBINED OVERALL TABULATION SHEET (All Stages)
// ─────────────────────────────────────────────────────────────────────────────

export function printPageantOverallTabulation({ category, candidates, criteria, scores, judges, selectedJudgeId }) {
  const doc = newDoc()

  const divLabel     = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const catLabel     = category === 'ginoo' ? 'Ginoo Division' : 'Binibini Division'
  const filtered     = candidates.filter(c => c.category === category)
  const parentStages = criteria
    .filter(c => c.competition_type === 'pageant' && !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  const activeJudges = selectedJudgeId && selectedJudgeId !== 'all'
    ? judges.filter(j => j.id === selectedJudgeId)
    : judges

  const judgeNote = selectedJudgeId && selectedJudgeId !== 'all'
    ? `Individual Verification: ${activeJudges[0]?.name || 'Judge'}`
    : 'Official Verification Sheet — All Scoring Judges'

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Pageant Tabulation Report',
    title:    `${divLabel} — Combined Preliminary Tabulation Sheet`,
    subtitle: `Category: ${catLabel}   |   ${judgeNote}`,
  })

  // Build stage column titles with their weights (Overall 50%)
  const stageColMeta = parentStages.map(stage => {
    const kids = criteria.filter(c => c.parent_id === stage.id)
    const maxPts = kids.reduce((sum, k) => sum + (Number(k.max_score) || 0), 0) || 100
    const weight = Number(stage.max_score) || maxPts
    return {
      stage,
      kids,
      maxPts,
      weight,
      header: `${stage.label}\n(Weight: ${weight}%)`
    }
  })

  const totalMaxPts = stageColMeta.reduce((sum, s) => sum + s.weight, 0)
  const head = [['#', 'Candidate Name', 'Barangay', ...stageColMeta.map(s => s.header), `Preliminary Total\n(${totalMaxPts}% Max)`]]

  const rowData = filtered.map(c => {
    let overallTotal = 0
    const stageCells = stageColMeta.map(({ kids, maxPts, weight }) => {
      let stageSubtotal = 0
      let hasAnyScore = false

      kids.forEach(kid => {
        const matchScores = scores.filter(s =>
          s.candidate_id === c.candidate_id &&
          s.criterion_id === kid.id &&
          (selectedJudgeId && selectedJudgeId !== 'all' ? s.judge_id === selectedJudgeId : true)
        )
        if (matchScores.length > 0) {
          hasAnyScore = true
          const sumDirect = matchScores.reduce((acc, s) => acc + Number(s.value || 0), 0)
          stageSubtotal += (sumDirect / matchScores.length)
        }
      })

      if (!hasAnyScore) return '—'
      const stageWeighted = (stageSubtotal / maxPts) * weight
      overallTotal += stageWeighted
      return `${stageWeighted.toFixed(2)}%\n(${stageSubtotal.toFixed(1)}/100)`
    })

    const numLabel = c.candidate_number != null ? `#${c.candidate_number}` : '—'
    return {
      numLabel,
      candidate: c.candidate,
      team: c.team,
      stageCells,
      overallTotal
    }
  })

  // Sort by overallTotal descending
  rowData.sort((a, b) => b.overallTotal - a.overallTotal)

  const body = rowData.map((r, idx) => [
    idx + 1,
    r.candidate,
    r.team,
    ...r.stageCells,
    { content: `${(r.overallTotal % 1 === 0 ? r.overallTotal.toString() : r.overallTotal.toFixed(2))}%`, styles: { fontStyle: 'bold', halign: 'center' } }
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_TABLE_HEADER_BG,
      textColor: CLR_TABLE_HEADER_FG,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left',   cellWidth: 38 },
      2: { halign: 'left',   cellWidth: 30 },
      [stageColMeta.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_Overall_${divLabel}_Tabulation_Sheet`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. OFFICIAL 50% CORONATION NIGHT / AU SYSTEM ENCODING TRANSFER SHEET
// ─────────────────────────────────────────────────────────────────────────────

// ── RAW (non-converted) Preliminary Score Tabulation Sheet ──────────────────
// Shows each stage's average raw score out of its max points (e.g. 80/100),
// NOT converted to the weighted % used in the 50% preliminary total.
export function printPageantRawScoreTabulation({ category, candidates, criteria, scores, judges }) {
  const doc = newDoc()

  const divLabel     = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const filtered     = candidates.filter(c => c.category === category)
  const parentStages = criteria
    .filter(c => c.competition_type === 'pageant' && !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Preliminary Tabulation',
    title:    `${divLabel} — PRELIMINARY STAGE SCORES (RAW / NOT CONVERTED)`,
    subtitle: `Average raw scores per stage before percentage conversion   |   For verification purposes`,
  })

  const stageColMeta = parentStages.map(stage => {
    const kids   = criteria.filter(c => c.parent_id === stage.id)
    const maxPts = kids.reduce((sum, k) => sum + (Number(k.max_score) || 0), 0) || 100
    return {
      stage,
      kids,
      maxPts,
      header: `${stage.label}\n(Max: ${maxPts} pts)`
    }
  })

  // Compute raw averages per stage (no % conversion)
  const computed = filtered.map(c => {
    let grandTotal = 0
    let grandMax   = 0

    const stageBreakdown = stageColMeta.map(({ kids, maxPts }) => {
      let stageSubtotal = 0
      let hasAnyScore   = false

      kids.forEach(kid => {
        const matchScores = scores.filter(s =>
          s.candidate_id === c.candidate_id && s.criterion_id === kid.id
        )
        if (matchScores.length > 0) {
          hasAnyScore = true
          const avg = matchScores.reduce((acc, s) => acc + Number(s.value || 0), 0) / matchScores.length
          stageSubtotal += avg
        }
      })

      if (!hasAnyScore) return { raw: 0, maxPts, text: '—' }
      grandTotal += stageSubtotal
      grandMax   += maxPts
      return {
        raw:    stageSubtotal,
        maxPts,
        text:   `${stageSubtotal % 1 === 0 ? stageSubtotal : stageSubtotal.toFixed(2)} / ${maxPts}`
      }
    })

    return {
      candidate_id:     c.candidate_id,
      candidate_number: c.candidate_number != null ? Number(c.candidate_number) : 9999,
      numLabel:         c.candidate_number != null ? `#${c.candidate_number}` : '—',
      candidate:        c.candidate,
      team:             c.team,
      stageBreakdown,
      grandTotal: stageColMeta.length > 0 ? grandTotal / stageColMeta.length : 0,
      grandMax:   stageColMeta.length > 0 ? grandMax   / stageColMeta.length : 0
    }
  })

  // Sort highest raw average first
  computed.sort((a, b) => b.grandTotal - a.grandTotal)

  const head = [[
    '#',
    'Candidate Name',
    'Barangay',
    ...stageColMeta.map(s => s.header),
    `AVERAGE RAW SCORE\n(÷ ${stageColMeta.length} stages)`
  ]]

  const body = computed.map((r, idx) => [
    { content: (idx + 1).toString(), styles: { fontStyle: 'bold', halign: 'center' } },
    r.candidate_number != null ? `#${r.candidate_number} — ${r.candidate}` : r.candidate,
    r.team,
    ...r.stageBreakdown.map(s => ({ content: s.text, styles: { halign: 'center' } })),
    {
      content: `${r.grandTotal % 1 === 0 ? r.grandTotal : r.grandTotal.toFixed(2)}`,
      styles:  { fontStyle: 'bold', halign: 'center', fontSize: 9.5, textColor: [180, 83, 9] }
    }
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize:    8.5,
      cellPadding: 4,
      lineColor:   CLR_BORDER,
      lineWidth:   0.2,
    },
    headStyles: {
      fillColor:     [30, 41, 59],
      textColor:     [255, 255, 255],
      fontStyle:     'bold',
      fontSize:      7.5,
      halign:        'center',
      valign:        'middle',
      minCellHeight: 12,
    },
    columnStyles: {
      0:                           { halign: 'center', cellWidth: 16 },
      1:                           { halign: 'left',   cellWidth: 44 },
      2:                           { halign: 'left',   cellWidth: 36 },
      [stageColMeta.length + 3]:   { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199] },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, judges, 'Official Pageant Judge')
  openPdf(doc, `Binibining_Palayan_Preliminary_Raw_Scores`)
}

export function printPageantCoronationTransferSheet({ category, candidates, criteria, scores, judges }) {
  const doc = newDoc()

  const divLabel     = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const filtered     = candidates.filter(c => c.category === category)
  const parentStages = criteria
    .filter(c => c.competition_type === 'pageant' && !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Coronation Night Tabulation Transfer',
    title:    `${divLabel} — 50% PRELIMINARY SCORES (CORONATION NIGHT / AU SYSTEM ENCODING SHEET)`,
    subtitle: `Official Certified Transfer Scores for AU Coronation System Entry   |   50% Overall Preliminary Weight`,
  })

  // Build stage column titles with weights (10%, 20%, 20%)
  const stageColMeta = parentStages.map(stage => {
    const kids = criteria.filter(c => c.parent_id === stage.id)
    const maxPts = kids.reduce((sum, k) => sum + (Number(k.max_score) || 0), 0) || 100
    const weight = Number(stage.max_score) || maxPts
    return {
      stage,
      kids,
      maxPts,
      weight,
      header: `${stage.label}\n(${weight}% Max)`
    }
  })

  // Compute all candidate 50% scores
  const computed = filtered.map(c => {
    let overall50Total = 0
    const stageBreakdown = stageColMeta.map(({ kids, maxPts, weight }) => {
      let stageSubtotal = 0
      let hasAnyScore = false

      kids.forEach(kid => {
        const matchScores = scores.filter(s =>
          s.candidate_id === c.candidate_id && s.criterion_id === kid.id
        )
        if (matchScores.length > 0) {
          hasAnyScore = true
          const sumDirect = matchScores.reduce((acc, s) => acc + Number(s.value || 0), 0)
          stageSubtotal += (sumDirect / matchScores.length)
        }
      })

      if (!hasAnyScore) return { weighted: 0, text: '—' }
      const stageWeighted = (stageSubtotal / maxPts) * weight
      overall50Total += stageWeighted
      return {
        weighted: stageWeighted,
        text: `${stageWeighted.toFixed(2)}%`
      }
    })

    return {
      candidate_id: c.candidate_id,
      candidate_number: c.candidate_number != null ? Number(c.candidate_number) : 9999,
      numLabel: c.candidate_number != null ? `#${c.candidate_number}` : '—',
      candidate: c.candidate,
      team: c.team,
      stageBreakdown,
      overall50Total
    }
  })

  // Sort by 50% overall score descending (highest score first)
  computed.sort((a, b) => b.overall50Total - a.overall50Total)

  const head = [[
    '#',
    'Candidate Name',
    'Barangay',
    ...stageColMeta.map(s => s.header),
    '50% PRELIMINARY SCORE\n(FOR AU ENCODING)'
  ]]

  const body = computed.map((r, idx) => [
    { content: (idx + 1).toString(), styles: { fontStyle: 'bold', halign: 'center' } },
    r.candidate_number != null ? `#${r.candidate_number} — ${r.candidate}` : r.candidate,
    r.team,
    ...r.stageBreakdown.map(s => ({ content: s.text, styles: { halign: 'center' } })),
    {
      content: `${(r.overall50Total % 1 === 0 ? r.overall50Total.toString() : r.overall50Total.toFixed(3))}%`,
      styles: { fontStyle: 'bold', halign: 'center', fontSize: 9.5, textColor: [180, 83, 9] }
    }
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left',   cellWidth: 44 },
      2: { halign: 'left',   cellWidth: 36 },
      [stageColMeta.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199] },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, judges, 'Official Pageant Judge')
  openPdf(doc, `Binibining_Palayan_Coronation_50Percent_Transfer_Sheet`)
}

