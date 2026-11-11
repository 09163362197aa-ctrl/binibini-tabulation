import { supabase } from './supabase'

export const OFFICIAL_PAGEANT_CRITERIA = [
  // Parent Stages
  { id: 'stage_sw', key: 'sportswear', label: 'Sports Wear Competition', max_score: 30, display_order: 1, parent_id: null, competition_type: 'pageant' },
  { id: 'stage_tl', key: 'talent', label: 'Talent Competition', max_score: 35, display_order: 2, parent_id: null, competition_type: 'pageant' },
  { id: 'stage_qa', key: 'qa', label: 'Q & A', max_score: 35, display_order: 3, parent_id: null, competition_type: 'pageant' },

  // Children for Sports Wear (30% total)
  { id: 'sw_poise', key: 'sw_poise', label: 'Poise and Bearing', max_score: 15, display_order: 1, parent_id: 'stage_sw', competition_type: 'pageant' },
  { id: 'sw_personality', key: 'sw_personality', label: 'Personality and Confidence', max_score: 15, display_order: 2, parent_id: 'stage_sw', competition_type: 'pageant' },

  // Children for Talent (35% total)
  { id: 'tl_execution', key: 'tl_execution', label: 'Talent Execution', max_score: 20, display_order: 1, parent_id: 'stage_tl', competition_type: 'pageant' },
  { id: 'tl_creativity', key: 'tl_creativity', label: 'Creativity and Originality', max_score: 10, display_order: 2, parent_id: 'stage_tl', competition_type: 'pageant' },
  { id: 'tl_impact', key: 'tl_impact', label: 'Audience Impact', max_score: 5, display_order: 3, parent_id: 'stage_tl', competition_type: 'pageant' },

  // Children for Q & A (35% total)
  { id: 'qa_content', key: 'qa_content', label: 'Content of Answer', max_score: 15, display_order: 1, parent_id: 'stage_qa', competition_type: 'pageant' },
  { id: 'qa_clarity', key: 'qa_clarity', label: 'Clarity of Thought', max_score: 10, display_order: 2, parent_id: 'stage_qa', competition_type: 'pageant' },
  { id: 'qa_delivery', key: 'qa_delivery', label: 'Confidence and Delivery', max_score: 10, display_order: 3, parent_id: 'stage_qa', competition_type: 'pageant' },
]

export async function getPageantCriteria() {
  try {
    const { data: dbCriteria } = await supabase
      .from('criteria')
      .select('id, key, label, max_score, display_order, parent_id')
      .eq('competition_type', 'pageant')
      .order('display_order')

    if (!dbCriteria || dbCriteria.length === 0) {
      return OFFICIAL_PAGEANT_CRITERIA
    }

    const parents = dbCriteria.filter(c => !c.parent_id)
    const children = dbCriteria.filter(c => c.parent_id)

    const reqByStage = [
      // Stage 1 (Sports Wear)
      [
        { label: 'Poise and Bearing', max_score: 15 },
        { label: 'Personality and Confidence', max_score: 15 }
      ],
      // Stage 2 (Talent)
      [
        { label: 'Talent Execution', max_score: 20 },
        { label: 'Creativity and Originality', max_score: 10 },
        { label: 'Audience Impact', max_score: 5 }
      ],
      // Stage 3 (Q & A)
      [
        { label: 'Content of Answer', max_score: 15 },
        { label: 'Clarity of Thought', max_score: 10 },
        { label: 'Confidence and Delivery', max_score: 10 }
      ]
    ]

    const mapped = [...dbCriteria]

    parents.forEach((parent, stageIdx) => {
      const stageKids = children.filter(c => c.parent_id === parent.id)
      const reqKids = reqByStage[stageIdx] || []
      stageKids.forEach((kid, kidIdx) => {
        const req = reqKids[kidIdx]
        if (req) {
          const item = mapped.find(m => m.id === kid.id)
          if (item) {
            item.label = req.label
            item.max_score = req.max_score
          }
        }
      })
    })

    return mapped
  } catch (err) {
    console.error('Error in getPageantCriteria:', err)
    return OFFICIAL_PAGEANT_CRITERIA
  }
}
