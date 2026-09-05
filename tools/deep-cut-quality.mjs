export const DEEP_CUT_MIN_ANSWERS = 8;
export const DEEP_CUT_QUALITY_CUTOVER_DAY = 6; // 2026-09-05; preserve launch week through Sep 4.
export const DEEP_CUT_QUALITY_CUTOVER_DATE = '2026-09-05';

const BASIC_RECALL_IDS = new Set([
  'us_state',
  'country',
  'rainbow',
  'nato',
  'greek',
  'planets',
  'continents',
  'canada',
  'zodiac',
  'cardranks',
  'baseball',
  'months',
  'chinesezodiac',
  'ivy',
  'quality_canada_provinces_territories',
  // Legacy/alternate IDs kept here so future source refreshes cannot revive them.
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
const RANGE_RESTRICTION = /\bbeginning with a letter from\b/i;
const ELEMENTARY_RECALL = [
  /^Name a NATO phonetic alphabet code word\.?$/i,
  /^Name a planet in the Solar System\.?$/i,
  /^Name a continent\.?$/i,
  /^Name a Canadian province or territory\.?$/i,
  /^Name a (?:Western )?zodiac sign\.?$/i,
  /^Name a standard playing-card rank\.?$/i,
  /^Name a standard baseball fielding position\.?$/i,
  /^Name a month of the year\.?$/i,
  /^Name an animal in the Chinese zodiac\.?$/i,
  /^Name a traditional rainbow color\.?$/i,
  /^Name a letter (?:of|in) the Greek alphabet\.?$/i,
  /^Name an Ivy League university\.?$/i
];

export function deepCutPromptQuality(prompt){
  const reasons=[];
  const id=String(prompt?.id||'');
  const text=String(prompt?.prompt||'').trim();
  const answers=Array.isArray(prompt?.answers)?prompt.answers:[];

  if(answers.length < DEEP_CUT_MIN_ANSWERS) reasons.push(`only ${answers.length} canonical answers`);
  if(BASIC_RECALL_IDS.has(id)||ELEMENTARY_RECALL.some(pattern=>pattern.test(text))) reasons.push('elementary recall list');
  if(/_initial_[a-z0-9]+$/i.test(id)||PREFIX_RESTRICTION.test(text)) reasons.push('single-letter prefix restriction');
  if(/_range_[a-z0-9]+$/i.test(id)||RANGE_RESTRICTION.test(text)) reasons.push('alphabet-range restriction');

  return {eligible:reasons.length===0,reasons};
}

export function eligibleDeepCutIndices(prompts){
  return prompts.map((prompt,index)=>({index,...deepCutPromptQuality(prompt)})).filter(row=>row.eligible).map(row=>row.index);
}
