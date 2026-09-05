export const DEEP_CUT_MIN_ANSWERS = 7;
export const DEEP_CUT_QUALITY_CUTOVER_DAY = 6; // 2026-09-05; preserve launch week through Sep 4.
export const DEEP_CUT_QUALITY_CUTOVER_DATE = '2026-09-05';

const BASIC_RECALL_IDS = new Set([
  'us_state',
  'country',
  'rainbow',
  'lang_nato_alphabet',
  'lang_greek_alphabet',
  'mil_us_branches',
  'geo_continents',
  'geo_oceans',
  'space_planets',
  'food_basic_tastes',
  'food_mms_colors',
  'sports_baseball_positions'
]);

const PREFIX_RESTRICTION = /\b(?:beginning|starting) with (?:the letter )?["“”']?[A-Z0-9]["“”']?\.?$/i;

export function deepCutPromptQuality(prompt){
  const reasons=[];
  const id=String(prompt?.id||'');
  const text=String(prompt?.prompt||'').trim();
  const answers=Array.isArray(prompt?.answers)?prompt.answers:[];

  if(answers.length < DEEP_CUT_MIN_ANSWERS) reasons.push(`only ${answers.length} canonical answers`);
  if(BASIC_RECALL_IDS.has(id)) reasons.push('elementary recall list');
  if(/_initial_[a-z0-9]+$/i.test(id) || PREFIX_RESTRICTION.test(text)) reasons.push('single-letter prefix restriction');

  return {eligible:reasons.length===0,reasons};
}

export function eligibleDeepCutIndices(prompts){
  return prompts.map((prompt,index)=>({index,...deepCutPromptQuality(prompt)})).filter(row=>row.eligible).map(row=>row.index);
}
