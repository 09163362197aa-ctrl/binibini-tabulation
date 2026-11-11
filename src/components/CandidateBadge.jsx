import React from 'react'
import { Crown, Sparkles, Award } from 'lucide-react'

/**
 * Hanging Pageant Ribbon Badge
 * Gives contestant numbers a prestigious pageant sash / medal ribbon appearance.
 */
export function CandidateRibbon({ number, category = 'ginoo', size = 'default', className = '', style = {} }) {
  if (number == null) return null
  const isGinoo = category === 'ginoo'
  const isCompact = size === 'compact'

  return (
    <div
      className={`candidate-ribbon ${isGinoo ? 'ginoo' : 'binibini'} ${isCompact ? 'compact' : ''} ${className}`}
      style={style}
      title={`Candidate #${number} (${isGinoo ? 'Ginoo' : 'Binibini'})`}
    >
      <div className="candidate-ribbon-icon">
        <Crown size={isCompact ? 11 : 13} strokeWidth={2.4} />
      </div>
      <span className="candidate-ribbon-label">NO.</span>
      <span className="candidate-ribbon-num">{number}</span>
    </div>
  )
}

/**
 * Pageant Sash / Ribbon Pill Badge
 * Used in headers, tables, rankings, and summary lists.
 */
export function CandidatePill({ number, category = 'ginoo', className = '', style = {} }) {
  if (number == null) return null
  const isGinoo = category === 'ginoo'

  return (
    <span
      className={`candidate-ribbon-pill ${isGinoo ? 'ginoo' : 'binibini'} ${className}`}
      style={style}
      title={`Candidate #${number}`}
    >
      <Crown size={12} strokeWidth={2.4} className="pill-crown-icon" />
      <span>#{number}</span>
    </span>
  )
}

export default CandidateRibbon
