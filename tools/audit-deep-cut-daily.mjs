import assert from 'node:assert/strict';
import {DEEP_CUT_PROMPTS,DEEP_CUT_PUZZLES} from '../src/puzzles.js';
import {
  DEEP_CUT_MIN_ANSWERS,
  DEEP_CUT_QUALITY_CUTOVER_DAY,
  deepCutPromptQuality,
  eligibleDeepCutIndices
} from './deep-cut-quality.mjs';

const eligible=eligibleDeepCutIndices(DEEP_CUT_PROMPTS);
assert.ok(eligible.length>=64,`Need at least 64 quality Deep Cut prompts; found ${eligible.length}`);
assert.equal(DEEP_CUT_PUZZLES.length,365);

const lastSeen=new Map();
for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<DEEP_CUT_PUZZLES.length;day++){
  const set=DEEP_CUT_PUZZLES[day];
  assert.equal(set.length,8,`Day ${day} should have eight Deep Cut prompts`);
  assert.equal(new Set(set).size,8,`Day ${day} contains a duplicate prompt`);
  for(const index of set){
    const prompt=DEEP_CUT_PROMPTS[index];
    const quality=deepCutPromptQuality(prompt);
    assert.equal(quality.eligible,true,`${prompt?.id||index} scheduled after quality cutover: ${quality.reasons.join(', ')}`);
    if(lastSeen.has(index))assert.ok(day-lastSeen.get(index)>=8,`${prompt.id} repeated after only ${day-lastSeen.get(index)} days`);
    lastSeen.set(index,day);
  }
}

console.log(`Daily Deep Cut: ${eligible.length}/${DEEP_CUT_PROMPTS.length} prompts pass the quality gate; all post-cutover rounds have ${DEEP_CUT_MIN_ANSWERS}+ answers and an 8-day repeat gap.`);
