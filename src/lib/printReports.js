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
 */
function drawSignatureBlock(doc, judges, roleLabel) {
  const usableW = PAGE_W - MARGIN * 2
  const cols    = Math.min(judges.length, 4)
  const colW    = usableW / cols

  // Measure remaining space — place block near page bottom
  const blockH   = 28
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

  let sigY = startY + 10
  judges.forEach((j, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx  = MARGIN + col * colW + colW / 2
    const cy  = sigY + row * 22

    // Signature line
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

  // Build head / body with direct max points
  const head = [['No.', 'Candidate Name', 'Barangay', ...stageKids.map(k => `${k.label}\n(Max: ${k.max_score} pts)`), 'Stage Total']]

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

  const body = rowData.map(r => [
    r.numLabel,
    r.candidate,
    r.team,
    ...r.critCells,
    { content: r.stageTotal % 1 === 0 ? r.stageTotal.toString() : r.stageTotal.toFixed(2), styles: { fontStyle: 'bold' } }
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
      minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
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
  const top4     = topCandidates.slice(0, 4)
  const divLabel = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const rankLabels = ['CHAMPION', '1ST RUNNER-UP', '2ND RUNNER-UP', '3RD RUNNER-UP']

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Final Rankings',
    title:    `${divLabel} — Official Champion & Winners Sheet`,
    subtitle: `Combined Total: All Stages, All Judges`,
  })

  y += 4

  top4.forEach((c, idx) => {
    const isChamp = idx === 0
    const boxH    = isChamp ? 36 : 28
    const boxX    = MARGIN
    const boxW    = PAGE_W - MARGIN * 2

    if (isChamp) {
      doc.setFillColor(255, 252, 220)
    } else {
      doc.setFillColor(248, 250, 252)
    }
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F')
    doc.setDrawColor(isChamp ? 180 : 203, isChamp ? 130 : 213, isChamp ? 20 : 225)
    doc.setLineWidth(isChamp ? 0.8 : 0.3)
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'S')

    // Rank label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 12 : 9)
    doc.setTextColor(...(isChamp ? CLR_GOLD : CLR_SUBTEXT))
    doc.text(divLabel + ' ' + rankLabels[idx], boxX + 6, y + (isChamp ? 10 : 8))

    // Candidate name + number
    const nameStr = c.candidate + (c.candidate_number != null ? `  (#${c.candidate_number})` : '')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 15 : 12)
    doc.setTextColor(...CLR_HEADING)
    doc.text(nameStr, boxX + 6, y + (isChamp ? 20 : 17))

    // Team
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(isChamp ? 9 : 8)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text(c.team, boxX + 6, y + (isChamp ? 27 : 23))

    // Score (right-aligned)
    const scoreNum = Number(c.final_score) || 0
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isChamp ? 20 : 15)
    doc.setTextColor(...(isChamp ? CLR_GOLD : CLR_HEADING))
    doc.text(scoreNum % 1 === 0 ? scoreNum.toString() : scoreNum.toFixed(2), boxX + boxW - 6, y + (isChamp ? 20 : 17), { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text('Final Combined Total', boxX + boxW - 6, y + (isChamp ? 27 : 23), { align: 'right' })

    y += boxH + 5
  })

  drawSignatureBlock(doc, judges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_${divLabel}_Official_Rankings`)
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
    title:    `${divLabel} — Combined Overall Tabulation Sheet`,
    subtitle: `Category: ${catLabel}   |   ${judgeNote}`,
  })

  // Build stage column titles with their max total points
  const stageColMeta = parentStages.map(stage => {
    const kids = criteria.filter(c => c.parent_id === stage.id)
    const maxPts = kids.reduce((sum, k) => sum + (k.max_score || 0), 0)
    return {
      stage,
      kids,
      maxPts,
      header: `${stage.label}\n(Max: ${maxPts} pts)`
    }
  })

  const totalMaxPts = stageColMeta.reduce((sum, s) => sum + s.maxPts, 0)
  const head = [['No.', 'Candidate Name', 'Barangay', ...stageColMeta.map(s => s.header), `Combined Total\n(Max: ${totalMaxPts} pts)`, 'Rank']]

  const rowData = filtered.map(c => {
    let overallTotal = 0
    const stageCells = stageColMeta.map(({ kids }) => {
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
      overallTotal += stageSubtotal
      return stageSubtotal % 1 === 0 ? stageSubtotal.toString() : stageSubtotal.toFixed(2)
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
    r.numLabel,
    r.candidate,
    r.team,
    ...r.stageCells,
    { content: r.overallTotal % 1 === 0 ? r.overallTotal.toString() : r.overallTotal.toFixed(2), styles: { fontStyle: 'bold' } },
    { content: (idx + 1).toString(), styles: { fontStyle: 'bold', halign: 'center' } }
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
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left',   cellWidth: 38 },
      2: { halign: 'left',   cellWidth: 30 },
      [stageColMeta.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
      [stageColMeta.length + 4]: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_Overall_${divLabel}_Tabulation_Sheet`)
}

