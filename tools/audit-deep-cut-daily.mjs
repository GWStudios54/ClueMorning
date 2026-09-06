import assert from 'node:assert/strict';
import {DEEP_CUT_PROMPTS,DEEP_CUT_PUZZLES} from '../src/puzzles.js';
import {
  DEEP_CUT_MIN_ANSWERS,
  DEEP_CUT_QUALITY_CUTOVER_DAY,
  DEEP_CUT_MIN_ACCESSIBLE_PER_DAY,
  DEEP_CUT_MAX_DEEP_PER_DAY,
  DEEP_CUT_MAX_SUBDIVISION_PER_DAY,
  DEEP_CUT_MAX_MOVIE_PER_DAY,
  DEEP_CUT_MAX_MUSIC_PER_DAY,
  DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY,
  DEEP_CUT_MAX_DOMAIN_PER_DAY,
  deepCutPromptQuality,
  deepCutDailyBalance,
  eligibleDeepCutIndices
} from './deep-cut-quality.mjs';

const REPEAT_GAP=6;
const eligible=eligibleDeepCutIndices(DEEP_CUT_PROMPTS);
assert.ok(eligible.length>=DEEP_CUT_MIN_ACCESSIBLE_PER_DAY*REPEAT_GAP,`Need at least ${DEEP_CUT_MIN_ACCESSIBLE_PER_DAY*REPEAT_GAP} common-knowledge Deep Cut prompts; found ${eligible.length}`);
assert.equal(DEEP_CUT_PUZZLES.length,365);

const lastSeen=new Map();
for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<DEEP_CUT_PUZZLES.length;day++){
  const set=DEEP_CUT_PUZZLES[day];
  assert.equal(set.length,8,`Day ${day} should have eight Deep Cut prompts`);
  assert.equal(new Set(set).size,8,`Day ${day} contains a duplicate prompt`);
  const balance=deepCutDailyBalance(set,DEEP_CUT_PROMPTS);
  assert.ok(balance.valid,`Day ${day} violates Deep Cut balance: ${JSON.stringify(balance)}`);
  assert.ok(balance.accessible>=DEEP_CUT_MIN_ACCESSIBLE_PER_DAY,`Day ${day} has only ${balance.accessible} accessible prompts`);
  assert.ok(balance.deep<=DEEP_CUT_MAX_DEEP_PER_DAY,`Day ${day} has ${balance.deep} specialist prompts`);
  assert.ok(balance.subdivisions<=DEEP_CUT_MAX_SUBDIVISION_PER_DAY,`Day ${day} has ${balance.subdivisions} administrative-subdivision prompts`);
  assert.ok(balance.movies<=DEEP_CUT_MAX_MOVIE_PER_DAY,`Day ${day} has ${balance.movies} movie prompts`);
  assert.ok(balance.music<=DEEP_CUT_MAX_MUSIC_PER_DAY,`Day ${day} has ${balance.music} music prompts`);
  assert.ok(balance.entertainment<=DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY,`Day ${day} has ${balance.entertainment} entertainment prompts`);
  assert.ok(Math.max(0,...Object.values(balance.domains))<=DEEP_CUT_MAX_DOMAIN_PER_DAY,`Day ${day} overuses one domain: ${JSON.stringify(balance.domains)}`);
  for(const index of set){
    const prompt=DEEP_CUT_PROMPTS[index];
    const quality=deepCutPromptQuality(prompt);
    assert.equal(quality.eligible,true,`${prompt?.id||index} scheduled after quality cutover: ${quality.reasons.join(', ')}`);
    if(lastSeen.has(index))assert.ok(day-lastSeen.get(index)>=REPEAT_GAP,`${prompt.id} repeated after only ${day-lastSeen.get(index)} days`);
    lastSeen.set(index,day);
  }
}

console.log(`Daily Deep Cut: ${eligible.length}/${DEEP_CUT_PROMPTS.length} prompts pass the common-knowledge gate; every post-cutover day has eight accessible prompts, max ${DEEP_CUT_MAX_MOVIE_PER_DAY} movie, max ${DEEP_CUT_MAX_MUSIC_PER_DAY} music, max ${DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY} entertainment total, ${DEEP_CUT_MIN_ANSWERS}+ answers per prompt, and at least a ${REPEAT_GAP}-day repeat gap.`);
