export const DEEP_CUT_MIN_ANSWERS = 8;
export const DEEP_CUT_QUALITY_CUTOVER_DAY = 6; // 2026-09-05; preserve launch week through Sep 4.
export const DEEP_CUT_QUALITY_CUTOVER_DATE = '2026-09-05';
export const DEEP_CUT_MIN_ACCESSIBLE_PER_DAY = 2;
export const DEEP_CUT_MAX_DEEP_PER_DAY = 2;

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

// These are broad enough that most players can get onto the board quickly, while
// still having enough depth for uncommon/rare answers. Every daily set gets at
// least two of these as anchors.
const ACCESSIBLE_IDS = new Set([
  'element',
  'state_capital',
  'president',
  'constellation',
  'shakespeare_play',
  'south_america',
  'europe',
  'africa',
  'asia',
  'eu',
  'quality_nolan_features',
  'quality_fincher_features',
  'quality_wes_anderson_features',
  'quality_beatles_uk_studio',
  'quality_pink_floyd_studio',
  'quality_queen_studio',
  'quality_radiohead_studio',
  'quality_metallica_studio',
  'quality_taylor_swift_studio_2024',
  'quality_mens_world_cup_hosts_2022',
  'quality_mens_world_cup_winners',
  'quality_summer_olympic_host_cities'
]);

// These are legitimate Deep Cut categories, but they require specialized recall.
// They stay in the game as spice rounds rather than dominating a whole day.
const DEEP_IDS = new Set([
  'quality_twelve_caesars',
  'quality_cranial_nerves',
  'quality_cloud_genera',
  'quality_phanerozoic_periods',
  'quality_si_prefixes',
  'quality_us_chief_justices',
  'quality_amino_acids',
  'quality_mohs_minerals',
  'quality_italy_regions',
  'quality_germany_states',
  'quality_spain_autonomous_communities',
  'quality_japan_prefectures',
  'quality_soviet_republics'
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

export function deepCutDifficulty(prompt){
  const id=String(prompt?.id||'');
  if(ACCESSIBLE_IDS.has(id))return {tier:'accessible',score:1};
  if(DEEP_IDS.has(id))return {tier:'deep',score:3};
  return {tier:'standard',score:2};
}

export function deepCutDailyBalance(indices,prompts){
  const tiers=indices.map(index=>deepCutDifficulty(prompts[index]).tier);
  const accessible=tiers.filter(tier=>tier==='accessible').length;
  const deep=tiers.filter(tier=>tier==='deep').length;
  return {
    accessible,
    standard:tiers.filter(tier=>tier==='standard').length,
    deep,
    valid:accessible>=DEEP_CUT_MIN_ACCESSIBLE_PER_DAY&&deep<=DEEP_CUT_MAX_DEEP_PER_DAY
  };
}

export function eligibleDeepCutIndices(prompts){
  return prompts.map((prompt,index)=>({index,...deepCutPromptQuality(prompt)})).filter(row=>row.eligible).map(row=>row.index);
}
