export const DEEP_CUT_MIN_ANSWERS = 10;
export const DEEP_CUT_QUALITY_CUTOVER_DAY = 6; // 2026-09-05; rebuild the post-launch rotation.
export const DEEP_CUT_QUALITY_CUTOVER_DATE = '2026-09-05';
export const DEEP_CUT_MIN_ACCESSIBLE_PER_DAY = 8;
export const DEEP_CUT_MAX_DEEP_PER_DAY = 0;
export const DEEP_CUT_MAX_SUBDIVISION_PER_DAY = 0;
export const DEEP_CUT_MAX_MOVIE_PER_DAY = 1;
export const DEEP_CUT_MAX_MUSIC_PER_DAY = 1;
export const DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY = 2;
export const DEEP_CUT_MAX_DOMAIN_PER_DAY = 2;

// Deep Cut is not supposed to test specialist vocabulary. The prompt should be
// recognizable to a general player; the difficulty should come from how far down
// the answer list the player can dig.
const SPECIALIST_IDS = new Set([
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
  'quality_soviet_republics',
  'quality_nobel_literature_2000_2024'
]);

const SUBDIVISION_IDS = new Set([
  'quality_italy_regions','quality_germany_states','quality_spain_autonomous_communities','quality_japan_prefectures'
]);

const MOVIE_IDS = new Set([
  'quality_nolan_features','quality_fincher_features','quality_wes_anderson_features','quality_scorsese_features','quality_coen_features',
  'quality_tarantino_features','quality_spielberg_features','quality_cameron_features_2025','quality_bond_eon_films','quality_pixar_features_2025',
  'quality_ghibli_features','quality_best_picture_2000_2024'
]);
const MUSIC_IDS = new Set([
  'quality_beatles_uk_studio','quality_pink_floyd_studio','quality_queen_studio','quality_radiohead_studio','quality_metallica_studio',
  'quality_madonna_studio','quality_taylor_swift_studio_2024','quality_led_zeppelin_studio','quality_foo_fighters_studio','quality_bowie_studio','quality_u2_studio'
]);

const PREFIX_RESTRICTION = /\b(?:beginning|starting) with (?:the letter )?["“”']?[A-Z0-9]["“”']?\.?$/i;
const RANGE_RESTRICTION = /\bbeginning with a letter from\b/i;
const SPECIALIST_TEXT = /\b(?:cranial nerve|phanerozoic|geologic(?:al)? period|prehistoric eon|mohs|amino acid|si prefix|autonomous communit|prefecture|soviet republic|chief justice|nobel prize in literature laureate)\b/i;

export function deepCutPromptQuality(prompt){
  const reasons=[];
  const id=String(prompt?.id||'');
  const text=String(prompt?.prompt||'').trim();
  const answers=Array.isArray(prompt?.answers)?prompt.answers:[];
  if(answers.length < DEEP_CUT_MIN_ANSWERS) reasons.push(`only ${answers.length} canonical answers`);
  if(SPECIALIST_IDS.has(id)||SPECIALIST_TEXT.test(text)) reasons.push('specialist-knowledge prompt');
  if(/_initial_[a-z0-9]+$/i.test(id)||PREFIX_RESTRICTION.test(text)) reasons.push('single-letter prefix restriction');
  if(/_range_[a-z0-9]+$/i.test(id)||RANGE_RESTRICTION.test(text)) reasons.push('alphabet-range restriction');
  return {eligible:reasons.length===0,reasons};
}

// Every eligible daily prompt is now treated as accessible. Deep Cut difficulty
// lives in the rarity ordering of its answers, not in whether the player knows the
// category at all.
export function deepCutDifficulty(prompt){
  return deepCutPromptQuality(prompt).eligible?{tier:'accessible',score:1}:{tier:'deep',score:3};
}

export function deepCutDomain(prompt){
  const id=String(prompt?.id||'').toLowerCase();
  const text=String(prompt?.prompt||'').toLowerCase();
  if(MOVIE_IDS.has(prompt?.id)||/\b(?:film|movie|best picture|pixar|ghibli)\b/.test(text))return 'movies';
  if(MUSIC_IDS.has(prompt?.id)||/\b(?:album|song|band|singer|musician|recording artist)\b/.test(text))return 'music';
  if(/\b(?:television|tv show|sitcom|series|emmy)\b/.test(text))return 'tv';
  if(/\b(?:nfl|nba|mlb|baseball|football|soccer|fifa|olympic|formula one|f1|sport|champion)\b/.test(text))return 'sports';
  if(/\b(?:country|countries|state|capital|continent|ocean|border|national park|river|mountain|city|sea|island|geograph)\b/.test(text))return 'geography';
  if(/\b(?:president|war|empire|dynasty|histor|apollo|astronaut|moonwalk|nato|supreme court)\b/.test(text))return 'history';
  if(/\b(?:element|planet|constellation|science|chemical|animal|dinosaur|space|biology|physics|mineral)\b/.test(text))return 'science';
  if(/\b(?:food|drink|cuisine|fruit|vegetable|cheese|candy|restaurant|taste)\b/.test(text))return 'food';
  if(/\b(?:game|pokemon|pokémon|video game|board game|card game)\b/.test(text))return 'games';
  if(/\b(?:brand|company|product|car|automaker|airline)\b/.test(text))return 'everyday';
  return 'general';
}

export function deepCutDailyBalance(indices,prompts){
  const tiers=indices.map(index=>deepCutDifficulty(prompts[index]).tier);
  const domains=indices.map(index=>deepCutDomain(prompts[index]));
  const domainCounts={};for(const domain of domains)domainCounts[domain]=(domainCounts[domain]||0)+1;
  const accessible=tiers.filter(tier=>tier==='accessible').length;
  const deep=tiers.filter(tier=>tier==='deep').length;
  const subdivisions=indices.filter(index=>SUBDIVISION_IDS.has(String(prompts[index]?.id||''))).length;
  const movies=domainCounts.movies||0,music=domainCounts.music||0,tv=domainCounts.tv||0;
  const entertainment=movies+music+tv;
  const maxDomain=Math.max(0,...Object.values(domainCounts));
  const withinCaps=deep<=DEEP_CUT_MAX_DEEP_PER_DAY&&subdivisions<=DEEP_CUT_MAX_SUBDIVISION_PER_DAY&&movies<=DEEP_CUT_MAX_MOVIE_PER_DAY&&music<=DEEP_CUT_MAX_MUSIC_PER_DAY&&entertainment<=DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY&&maxDomain<=DEEP_CUT_MAX_DOMAIN_PER_DAY;
  return {
    accessible,
    standard:tiers.filter(tier=>tier==='standard').length,
    deep,
    subdivisions,
    movies,
    music,
    entertainment,
    domains:domainCounts,
    withinCaps,
    valid:indices.length===8&&accessible>=DEEP_CUT_MIN_ACCESSIBLE_PER_DAY&&withinCaps
  };
}

export function eligibleDeepCutIndices(prompts){
  return prompts.map((prompt,index)=>({index,...deepCutPromptQuality(prompt)})).filter(row=>row.eligible).map(row=>row.index);
}
