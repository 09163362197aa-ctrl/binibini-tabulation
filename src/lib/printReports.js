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
import palayanLogoUrl from '../assets/pdf/palayan-logo.png'
import crownUrl from '../assets/pdf/crown.png'
import titleUrl from '../assets/pdf/title.png'
import ictLogoUrl from '../assets/ict.png'

// Preload PDF brand images so synchronous jsPDF calls can embed them immediately
function preloadImg(src) {
  const img = new Image()
  img.src = src
  return img
}
const IMG_PALAYAN = preloadImg(palayanLogoUrl)
const IMG_CROWN = preloadImg(crownUrl)
const IMG_TITLE = preloadImg(titleUrl)
const IMG_ICT = preloadImg(ictLogoUrl)

function isImgReady(img) {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

// Long Bond Paper (8.5" × 13") in mm
const PAGE_W = 215.9
const PAGE_H = 330.2
const MARGIN = 8    // mm

// ─── Colour tokens (Royal Emerald Green + Gold + White Glitter) ─────────────
const CLR_EMERALD_DARK = [10, 39, 30]     // deep emerald shadow
const CLR_EMERALD = [14, 52, 41]     // royal emerald green
const CLR_HEADING = [14, 46, 36]     // deep emerald-ink
const CLR_SUBTEXT = [82, 107, 98]    // muted emerald-slate
const CLR_TABLE_HEADER_BG = [14, 52, 41]  // royal emerald green
const CLR_TABLE_HEADER_FG = [255, 255, 255]
const CLR_TOTAL_BG = [254, 249, 231]  // soft champagne gold tint
const CLR_GOLD = [212, 175, 55]   // metallic gold
const CLR_GOLD_DARK = [166, 124, 20]   // deep gold for text
const CLR_BORDER = [206, 222, 215]  // soft emerald-gray border
const CLR_ALT_ROW = [246, 250, 248]  // subtle mint-white zebra row

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate the optimal body-row minCellHeight so the table fills the page
 * WITHOUT overflowing. Uses compact cellPadding (1.5mm) and stretches row
 * height to fill remaining vertical space.
 *
 * @param {number} numDataRows  - number of body rows in the table
 * @param {number} numJudges    - number of judges (affects signature block height)
 * @param {number} tableStartY  - Y position (mm) where the table starts
 * @returns {{ cellPadding: number, minRowHeight: number }}
 */
function calcTableLayout(numDataRows, numJudges, tableStartY) {
  const judgeRows  = Math.ceil(Math.max(numJudges, 1) / 5)
  const sigBlockH  = 13 + judgeRows * 20 + 9 + 14   // pill + cards + ICT footer
  const usableH    = PAGE_H - MARGIN - tableStartY - sigBlockH - 12  // 12mm gaps
  const headerH    = 13   // estimated header row height
  const availData  = usableH - headerH
  const minRowH    = Math.max(7.5, Math.min(16, availData / numDataRows))
  return { cellPadding: 1.5, minRowHeight: minRowH }
}

function newDoc() {
  return new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'portrait' })
}

function openPdf(doc, filename) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    // Fallback: direct download if popup blocked
    doc.save(filename + '.pdf')
  }
}

/**
 * Draw a delicate 4-point sparkle star at (cx, cy) with radius r.
 */
function drawSparkle(doc, cx, cy, r, color) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.28)
  doc.line(cx - r, cy, cx + r, cy)
  doc.line(cx, cy - r, cx, cy + r)
  const d = r * 0.45
  doc.setLineWidth(0.18)
  doc.line(cx - d, cy - d, cx + d, cy + d)
  doc.line(cx - d, cy + d, cx + d, cy - d)
}

/**
 * Draw the official report header block in Royal Emerald Green, Gold & White Glitter:
 * Palayan Logo (top-left), centered Binibining Palayan 2026 Title image, Crown (top-right).
 * Returns the Y position after the header (where content should start).
 */
function drawHeader(doc, { sysTitle, title, subtitle }) {
  const usableW = PAGE_W - MARGIN * 2
  const bannerY = MARGIN
  const bannerH = 30

  // Deep Emerald Green banner
  doc.setFillColor(...CLR_EMERALD)
  doc.roundedRect(MARGIN, bannerY, usableW, bannerH, 2.5, 2.5, 'F')

  // Subtle darker emerald corner depth accents
  doc.setFillColor(...CLR_EMERALD_DARK)
  doc.triangle(MARGIN, bannerY, MARGIN + 34, bannerY, MARGIN, bannerY + 14, 'F')
  doc.triangle(MARGIN + usableW, bannerY + bannerH - 1.2, MARGIN + usableW - 38, bannerY + bannerH - 1.2, MARGIN + usableW, bannerY + bannerH - 15, 'F')

  // Delicate gold & white glitter dots + sparkles (kept out of the center title area)
  const glitterDots = [
    // Left glitter cluster
    [MARGIN + 22, bannerY + 5, 0.45, [255, 255, 255]],
    [MARGIN + 27, bannerY + 9, 0.35, [245, 215, 110]],
    [MARGIN + 31, bannerY + 4, 0.30, [255, 255, 255]],
    [MARGIN + 36, bannerY + 11, 0.40, [212, 175, 55]],
    [MARGIN + 24, bannerY + 18, 0.35, [245, 215, 110]],
    [MARGIN + 18, bannerY + 23, 0.50, [212, 175, 55]],
    [MARGIN + 29, bannerY + 24, 0.30, [255, 255, 255]],
    [MARGIN + 42, bannerY + 7, 0.30, [255, 255, 255]],
    [MARGIN + 47, bannerY + 21, 0.35, [245, 215, 110]],
    [MARGIN + 54, bannerY + 6, 0.25, [255, 255, 255]],
    // Right glitter cluster
    [MARGIN + usableW - 24, bannerY + 5, 0.45, [255, 255, 255]],
    [MARGIN + usableW - 30, bannerY + 9, 0.35, [245, 215, 110]],
    [MARGIN + usableW - 36, bannerY + 4, 0.30, [255, 255, 255]],
    [MARGIN + usableW - 41, bannerY + 12, 0.40, [212, 175, 55]],
    [MARGIN + usableW - 26, bannerY + 21, 0.45, [212, 175, 55]],
    [MARGIN + usableW - 34, bannerY + 24, 0.35, [255, 255, 255]],
    [MARGIN + usableW - 46, bannerY + 22, 0.35, [245, 215, 110]],
    [MARGIN + usableW - 52, bannerY + 7, 0.28, [255, 255, 255]],
  ]
  glitterDots.forEach(([gx, gy, gr, col]) => {
    doc.setFillColor(...col)
    doc.circle(gx, gy, gr, 'F')
  })

  // 4-point white & gold sparkles
  drawSparkle(doc, MARGIN + 26, bannerY + 6.5, 1.5, [255, 255, 255])
  drawSparkle(doc, MARGIN + 40, bannerY + 19, 1.2, [245, 215, 110])
  drawSparkle(doc, MARGIN + 56, bannerY + 9, 1.0, [255, 255, 255])
  drawSparkle(doc, MARGIN + usableW - 28, bannerY + 6.5, 1.5, [255, 255, 255])
  drawSparkle(doc, MARGIN + usableW - 42, bannerY + 19, 1.3, [245, 215, 110])
  drawSparkle(doc, MARGIN + usableW - 55, bannerY + 10, 1.0, [255, 255, 255])

  // Subtle gold inner border around banner
  doc.setDrawColor(...CLR_GOLD)
  doc.setLineWidth(0.35)
  doc.roundedRect(MARGIN + 0.8, bannerY + 0.8, usableW - 1.6, bannerH - 1.6, 2, 2, 'S')

  // Gold accent bar at bottom of banner
  doc.setFillColor(...CLR_GOLD)
  doc.rect(MARGIN, bannerY + bannerH - 1.2, usableW, 1.2, 'F')

  // Top-left: small Palayan City logo
  const logoSize = 11
  const logoX = MARGIN + 5
  const logoY = bannerY + 4
  if (isImgReady(IMG_PALAYAN)) {
    doc.addImage(IMG_PALAYAN, 'PNG', logoX, logoY, logoSize, logoSize)
  }

  // Top-right: small Crown (moved to right side)
  if (isImgReady(IMG_CROWN)) {
    const crownW = 13.5
    const crownH = crownW * (329 / 500) // preserve exact 500x329 aspect ratio (~8.88mm)
    const crownX = MARGIN + usableW - crownW - 5
    const crownY = bannerY + 4.5
    doc.addImage(IMG_CROWN, 'PNG', crownX, crownY, crownW, crownH)
  }

  // Center: Big Title image (Binibining Palayan 2026)
  if (isImgReady(IMG_TITLE)) {
    const titleW = 54
    const titleH = titleW * (536 / 1200) // preserve exact 1200x536 aspect ratio (~24.1mm)
    const titleX = (PAGE_W - titleW) / 2
    const titleY = bannerY + (bannerH - 1.2 - titleH) / 2
    doc.addImage(IMG_TITLE, 'PNG', titleX, titleY, titleW, titleH)
  }

  let y = bannerY + bannerH + 4.5

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...CLR_HEADING)
  doc.text(title, PAGE_W / 2, y, { align: 'center' })
  y += 4.2

  // Small system title (e.g. BINIBINING PALAYAN — OFFICIAL PAGEANT TABULATION REPORT)
  if (sysTitle) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(...CLR_GOLD_DARK)
    doc.text(sysTitle.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
    y += 3.8
  }

  // Small subtitle (e.g. Official Verification Sheet — All Scoring Judges)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(...CLR_SUBTEXT)
    doc.text(subtitle, PAGE_W / 2, y, { align: 'center' })
    y += 3.8
  }

  // Gold & emerald divider
  doc.setDrawColor(...CLR_GOLD)
  doc.setLineWidth(0.45)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 3.5

  return y
}

/**
 * Draw the judge signature block at the bottom.
 * Each judge gets: a horizontal line + bold name + italic role title.
 * Rows with fewer judges (e.g., 5th judge, or 6/7 judges) are automatically centered.
 */
function drawSignatureBlock(doc, judges, roleLabel) {
  if (!judges || judges.length === 0) return

  // Fit up to 5 judges on a single row so 5-judge panels never wrap onto a 2nd page
  const maxCols = 5
  const usableW = PAGE_W - MARGIN * 2
  const colW = usableW / Math.min(maxCols, Math.max(judges.length, 4))

  const rows = []
  for (let i = 0; i < judges.length; i += maxCols) {
    rows.push(judges.slice(i, i + maxCols))
  }

  const rowSpacing = 20
  const footerHeight = 9
  const blockH = 13 + (rows.length * rowSpacing) + footerHeight
  const tableEndY = doc.lastAutoTable?.finalY || 0
  const minAfterTable = tableEndY + 8

  let startY
  if (minAfterTable + blockH > PAGE_H - MARGIN) {
    doc.addPage()
    startY = MARGIN + 10
  } else {
    startY = minAfterTable
  }

  // Gold-flanked Emerald Pill Header: "CERTIFIED CORRECT — BOARD OF JUDGES"
  const labelText = 'CERTIFIED CORRECT — BOARD OF JUDGES'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  const lblW = doc.getTextWidth(labelText)
  const pillW = lblW + 10
  const pillH = 5.2
  const pillX = (PAGE_W - pillW) / 2
  const pillY = startY - 3.6

  // Gold horizontal lines flanking the pill
  doc.setDrawColor(...CLR_GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, startY - 1, pillX - 3, startY - 1)
  doc.line(pillX + pillW + 3, startY - 1, PAGE_W - MARGIN, startY - 1)

  // Emerald pill with gold border
  doc.setFillColor(...CLR_EMERALD)
  doc.setDrawColor(...CLR_GOLD)
  doc.setLineWidth(0.35)
  doc.roundedRect(pillX, pillY, pillW, pillH, 2.5, 2.5, 'FD')

  // Pill text in crisp white/gold
  doc.setTextColor(254, 243, 199)
  doc.text(labelText, PAGE_W / 2, startY + 0.1, { align: 'center' })

  const sigStartY = startY + 6

  rows.forEach((rowJudges, rIdx) => {
    const k = rowJudges.length
    const rowW = k * colW
    const rowStartX = (PAGE_W - rowW) / 2
    const cy = sigStartY + (rIdx * rowSpacing)

    rowJudges.forEach((j, cIdx) => {
      const cardX = rowStartX + cIdx * colW + 1.5
      const cardW = colW - 3
      const cardH = 16.5
      const cx = cardX + cardW / 2

      // Elegant signature card with soft mint-ivory fill & border
      doc.setFillColor(247, 251, 249)
      doc.setDrawColor(...CLR_BORDER)
      doc.setLineWidth(0.25)
      doc.roundedRect(cardX, cy, cardW, cardH, 1.5, 1.5, 'FD')

      // Subtle gold top accent bar on each judge card
      doc.setFillColor(...CLR_GOLD)
      doc.rect(cardX, cy, cardW, 0.7, 'F')

      // Signature line inside card
      const sigLineY = cy + 8.5
      doc.setDrawColor(...CLR_EMERALD)
      doc.setLineWidth(0.35)
      doc.line(cardX + 3.5, sigLineY, cardX + cardW - 3.5, sigLineY)

      // Judge name (bold deep emerald)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...CLR_HEADING)
      doc.text(j.name || '—', cx, sigLineY + 3.4, { align: 'center' })

      // Role (gold-amber italic)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6.2)
      doc.setTextColor(...CLR_GOLD_DARK)
      doc.text(roleLabel, cx, sigLineY + 6.5, { align: 'center' })
    })
  })

  // Footer below judges: small ICT logo + "Powered by ICT Division"
  const lastRowY = sigStartY + (rows.length - 1) * rowSpacing + 18
  const footerY = lastRowY + 4
  const footerText = 'Powered by ICT Division'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...CLR_SUBTEXT)

  const ictSize = 5.5
  const textW = doc.getTextWidth(footerText)
  const gap = 2
  const totalFooterW = (isImgReady(IMG_ICT) ? ictSize + gap : 0) + textW
  const fx = (PAGE_W - totalFooterW) / 2

  if (isImgReady(IMG_ICT)) {
    doc.addImage(IMG_ICT, 'PNG', fx, footerY - 4.2, ictSize, ictSize)
    doc.text(footerText, fx + ictSize + gap, footerY)
  } else {
    doc.text(footerText, PAGE_W / 2, footerY, { align: 'center' })
  }
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
    title: 'Cheerdance Competition Tabulation Sheet',
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
        s.criterion_id === crit.id &&
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
    alternateRowStyles: { fillColor: CLR_ALT_ROW },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Cheerdance Judge')
  openPdf(doc, 'Cheerdance_Tabulation_Sheet')
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHEERDANCE CHAMPION RANKING SHEET (Top 4)
// ─────────────────────────────────────────────────────────────────────────────

export function printCheerdanceRankings({ rankedTeams, judges }) {
  const doc = newDoc()
  const top4 = rankedTeams.slice(0, 4)
  const rankLabels = ['CHAMPION', '1ST RUNNER-UP', '2ND RUNNER-UP', '3RD RUNNER-UP']

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Final Rankings Report',
    title: 'Cheerdance Competition — Official Champion & Winners',
    subtitle: 'Top 4 Final Ranking Standings',
  })

  y += 4

  top4.forEach((team, idx) => {
    const isChamp = idx === 0
    const boxH = isChamp ? 34 : 27
    const boxX = MARGIN
    const boxW = PAGE_W - MARGIN * 2

    // Card background
    if (isChamp) {
      doc.setFillColor(255, 252, 220)
    } else {
      doc.setFillColor(...CLR_ALT_ROW)
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

  const catLabel = category === 'ginoo' ? 'Ginoo Division' : 'Binibini Division'
  const filtered = candidates.filter(c => c.category === category)
  const stageKids = criteria.filter(c => c.parent_id === stage.id)

  const activeJudges = selectedJudgeId && selectedJudgeId !== 'all'
    ? judges.filter(j => j.id === selectedJudgeId)
    : judges

  const judgeNote = selectedJudgeId && selectedJudgeId !== 'all'
    ? `Individual Verification: ${activeJudges[0]?.name || 'Judge'}`
    : 'Official Verification Sheet — All Scoring Judges'

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Official Pageant Tabulation Report',
    title: `${stage.label} — Tabulation Sheet`,
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
        s.candidate_id === c.candidate_id &&
        s.criterion_id === kid.id &&
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

  const { cellPadding: stagePad, minRowHeight: stageRowH } = calcTableLayout(filtered.length, activeJudges.length, y)

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: stagePad,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_TABLE_HEADER_BG,
      textColor: CLR_TABLE_HEADER_FG,
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 10,
    },
    bodyStyles: { minCellHeight: stageRowH },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 40 },
      2: { halign: 'left', cellWidth: 32 },
      [stageKids.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
    },
    alternateRowStyles: { fillColor: CLR_ALT_ROW },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_${stage.key || stage.label}_${category}_Tabulation`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAGEANT OVERALL RANKING SHEET (Ginoo OR Binibini — Top 4)
// ─────────────────────────────────────────────────────────────────────────────

export function printPageantOverallRankings({ category, topCandidates, judges }) {
  const doc = newDoc()
  const candidatesToShow = topCandidates.slice(0, 6)
  const divLabel = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const rankLabels = ['RANK 1 — PRELIMINARY LEADER', 'RANK 2', 'RANK 3', 'RANK 4', 'RANK 5', 'RANK 6']

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — 50% Preliminary Competition',
    title: `${divLabel} — Official Preliminary Standings Sheet`,
    subtitle: `Preliminary Phase (50% Overall): Tourism Video (10%), Talent (20%), Festival-Inspired Costume (20%)`,
  })

  y += 4

  candidatesToShow.forEach((c, idx) => {
    const isLead = idx === 0
    const boxH = isLead ? 32 : 24
    const boxX = MARGIN
    const boxW = PAGE_W - MARGIN * 2

    if (isLead) {
      doc.setFillColor(255, 252, 220)
    } else {
      doc.setFillColor(...CLR_ALT_ROW)
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

  const divLabel = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const catLabel = category === 'ginoo' ? 'Ginoo Division' : 'Binibini Division'
  const filtered = candidates.filter(c => c.category === category)
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
    title: `${divLabel} — Combined Preliminary Tabulation Sheet`,
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
      return `${stageWeighted.toFixed(2)}%`
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

  const { cellPadding: overallPad, minRowHeight: overallRowH } = calcTableLayout(filtered.length, activeJudges.length, y)

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: overallPad,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_TABLE_HEADER_BG,
      textColor: CLR_TABLE_HEADER_FG,
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 10,
    },
    bodyStyles: { minCellHeight: overallRowH },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 44 },
      2: { halign: 'left', cellWidth: 30 },
      [stageColMeta.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: CLR_TOTAL_BG },
    },
    alternateRowStyles: { fillColor: CLR_ALT_ROW },
  })

  drawSignatureBlock(doc, activeJudges, 'Official Pageant Judge')
  openPdf(doc, `Pageant_Overall_${divLabel}_Tabulation_Sheet`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. OFFICIAL 50% CORONATION NIGHT / AU SYSTEM ENCODING TRANSFER SHEET
// ─────────────────────────────────────────────────────────────────────────────

export function printPageantCoronationTransferSheet({ category, candidates, criteria, scores, judges }) {
  const doc = newDoc()

  const divLabel = category === 'ginoo' ? 'GINOO' : 'BINIBINI'
  const filtered = candidates.filter(c => c.category === category)
  const parentStages = criteria
    .filter(c => c.competition_type === 'pageant' && !c.parent_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  let y = drawHeader(doc, {
    sysTitle: 'Binibining Palayan — Coronation Night Tabulation Transfer',
    title: `${divLabel} — 50% PRELIMINARY SCORES (CORONATION NIGHT / AU SYSTEM ENCODING SHEET)`,
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

  const { cellPadding: coronPad, minRowHeight: coronRowH } = calcTableLayout(filtered.length, judges.length, y)

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: coronPad,
      lineColor: CLR_BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: CLR_EMERALD,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12,
    },
    bodyStyles: { minCellHeight: coronRowH },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 44 },
      2: { halign: 'left', cellWidth: 36 },
      [stageColMeta.length + 3]: { halign: 'center', fontStyle: 'bold', fillColor: [254, 243, 199] },
    },
    alternateRowStyles: { fillColor: CLR_ALT_ROW },
  })

  drawSignatureBlock(doc, judges, 'Official Pageant Judge')
  openPdf(doc, `Binibining_Palayan_Coronation_50Percent_Transfer_Sheet`)
}

