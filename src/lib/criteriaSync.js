import { supabase } from './supabase'

export const OFFICIAL_PAGEANT_CRITERIA = [
  // Parent Stages (Overall 50%)
  { id: 'stage_tv', key: 'tourism_video', label: 'Tourism Video', max_score: 10, display_order: 1, parent_id: null, competition_type: 'pageant' },
  { id: 'stage_tl', key: 'talent', label: 'Talent Competition', max_score: 20, display_order: 2, parent_id: null, competition_type: 'pageant' },
  { id: 'stage_fc', key: 'festival_costume', label: 'Festival-Inspired Costume', max_score: 20, display_order: 3, parent_id: null, competition_type: 'pageant' },

  // Children for Tourism Video (10% overall, 100% stage total)
  { id: 'tv_creativity', key: 'tv_creativity', label: 'Creativity & Originality', max_score: 30, display_order: 1, parent_id: 'stage_tv', competition_type: 'pageant' },
  { id: 'tv_promotion', key: 'tv_promotion', label: 'Tourism Promotion & Destination Showcase', max_score: 30, display_order: 2, parent_id: 'stage_tv', competition_type: 'pageant' },
  { id: 'tv_production', key: 'tv_production', label: 'Video Production & Technical Quality', max_score: 20, display_order: 3, parent_id: 'stage_tv', competition_type: 'pageant' },
  { id: 'tv_cultural', key: 'tv_cultural', label: 'Cultural Identity & Local Storytelling', max_score: 20, display_order: 4, parent_id: 'stage_tv', competition_type: 'pageant' },

  // Children for Talent Competition (20% overall, 100% stage total)
  { id: 'tl_creativity', key: 'tl_creativity', label: 'Creativity & Originality', max_score: 40, display_order: 1, parent_id: 'stage_tl', competition_type: 'pageant' },
  { id: 'tl_mastery', key: 'tl_mastery', label: 'Mastery & Technical Skill', max_score: 30, display_order: 2, parent_id: 'stage_tl', competition_type: 'pageant' },
  { id: 'tl_presence', key: 'tl_presence', label: 'Stage Presence & Confidence', max_score: 20, display_order: 3, parent_id: 'stage_tl', competition_type: 'pageant' },
  { id: 'tl_impact', key: 'tl_impact', label: 'Audience Impact', max_score: 10, display_order: 4, parent_id: 'stage_tl', competition_type: 'pageant' },

  // Children for Festival-Inspired Costume (20% overall, 100% stage total)
  { id: 'fc_creativity', key: 'fc_creativity', label: 'Creativity & Design Concept', max_score: 30, display_order: 1, parent_id: 'stage_fc', competition_type: 'pageant' },
  { id: 'fc_relevance', key: 'fc_relevance', label: 'Relevance to Culture & Heritage (The Chosen Palayan Delicacy)', max_score: 30, display_order: 2, parent_id: 'stage_fc', competition_type: 'pageant' },
  { id: 'fc_poise', key: 'fc_poise', label: 'Poise, Confidence & Projection', max_score: 20, display_order: 3, parent_id: 'stage_fc', competition_type: 'pageant' },
  { id: 'fc_impact', key: 'fc_impact', label: 'Overall Impact & Visual Appeal', max_score: 20, display_order: 4, parent_id: 'stage_fc', competition_type: 'pageant' },
]

let _criteriaCache = null

export async function getPageantCriteria(forceRefresh = false) {
  if (_criteriaCache && !forceRefresh) {
    return _criteriaCache
  }

  try {
    const { data: dbCriteria } = await supabase
      .from('criteria')
      .select('id, key, label, max_score, display_order, parent_id')
      .eq('competition_type', 'pageant')
      .order('display_order')

    if (!dbCriteria || dbCriteria.length === 0) {
      _criteriaCache = OFFICIAL_PAGEANT_CRITERIA
      return OFFICIAL_PAGEANT_CRITERIA
    }

    _criteriaCache = dbCriteria
    return dbCriteria
  } catch (err) {
    console.error('Error in getPageantCriteria:', err)
    return _criteriaCache || OFFICIAL_PAGEANT_CRITERIA
  }
}
