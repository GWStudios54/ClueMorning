import fs from 'node:fs';
import assert from 'node:assert/strict';
import worker,{pickDaily,evaluateGuess,trailPathValid,trailDictionaryWord,wordStepsDictionaryWord,differsByOne,deepCutResult,safeName,scoreParts} from './src/worker.js';
import {TRAIL_PUZZLES,WORD_STEPS_PUZZLES,DEEP_CUT_PROMPTS,DEEP_CUT_PUZZLES,YEAR_PACK,YEAR_PACK_START} from './src/puzzles.js';

for(const p of TRAIL_PUZZLES){
  assert.equal(p.grid.length,16);
  assert.equal(p.longest.length,16);
  assert.equal(trailPathValid(p.longest,p.grid),true,`Longest word is not path-valid: ${p.longest}`);
  assert.ok(Array.isArray(p.words) && p.words.length >= 20,`Trail board has too few dictionary words: ${p.longest}`);
  assert.equal(trailDictionaryWord(p.longest,p),true);
}

for(const p of WORD_STEPS_PUZZLES){
  assert.equal(p.start.length,4);assert.equal(p.target.length,4);
  assert.ok(p.par>=3&&p.par<=6);
  assert.equal(p.solution[0],p.start);assert.equal(p.solution.at(-1),p.target);
  assert.equal(p.solution.length,p.par+1);
  for(let i=1;i<p.solution.length;i++)assert.equal(differsByOne(p.solution[i-1],p.solution[i]),true,`${p.solution[i-1]} -> ${p.solution[i]}`);
  for(const w of p.solution)assert.equal(wordStepsDictionaryWord(w),true,`Word Steps solution word missing from dictionary: ${w}`);
}

assert.ok(DEEP_CUT_PROMPTS.length>=100);
assert.equal(DEEP_CUT_PROMPTS.find(p=>p.id==='constellation')?.answers.length,88,'Modern constellation prompt should contain all 88 constellations');
assert.ok(DEEP_CUT_PROMPTS.find(p=>p.id==='shakespeare_play')?.answers.length>=38,'Shakespeare prompt should include the standard 38-play set used by Clue Morning');
const promptIds=new Set();
for(const p of DEEP_CUT_PROMPTS){
  assert.ok(p.id&&p.prompt&&Array.isArray(p.answers)&&p.answers.length>=4);
  assert.equal(promptIds.has(p.id),false,`Duplicate Deep Cut prompt id: ${p.id}`);promptIds.add(p.id);
  let prior=0;
  for(let i=0;i<p.answers.length;i++){
    const r=deepCutResult(p.answers[i].name,p);
    assert.equal(r.accepted,true,`${p.id}: ${p.answers[i].name}`);
    assert.ok(r.score>=30&&r.score<=100);
    assert.ok(r.score>=prior,`${p.id} rarity ordering must not decrease`);prior=r.score;
  }
  const alias=p.answers.find(a=>Array.isArray(a.aliases)&&a.aliases.length);
  if(alias)assert.equal(deepCutResult(alias.aliases[0],p).canonical,alias.name);
  assert.equal(deepCutResult('definitely-not-an-answer',p).accepted,false);
}
for(const set of DEEP_CUT_PUZZLES){assert.equal(set.length,8);assert.equal(new Set(set).size,8);for(const i of set)assert.ok(i>=0&&i<DEEP_CUT_PROMPTS.length)}

assert.deepEqual(evaluateGuess('APPLE','ALLEY'),['green','gray','gray','yellow','yellow']);
assert.equal(safeName('Annie'),'Annie');
assert.equal(safeName('Player A1B2'),'Player A1B2');
assert.equal(safeName('<script>'),null);
assert.deepEqual(scoreParts({grid:100,groups:200,trail:300,link:400,steps:500,deepcut:600}),{grid:100,groups:200,trail:300,link:400,steps:500,deepcut:600});
assert.equal(scoreParts({grid:999999,groups:0,trail:0,link:0,steps:0,deepcut:0}),null);
assert.equal(scoreParts({grid:0,groups:0,trail:0,link:0,steps:0,deepcut:801}),null);
assert.equal(TRAIL_PUZZLES.length,365);
assert.equal(WORD_STEPS_PUZZLES.length,365);
assert.equal(DEEP_CUT_PUZZLES.length,365);
assert.equal(YEAR_PACK.length,365);
assert.equal(YEAR_PACK_START,'2026-08-30');
assert.equal(new Set(YEAR_PACK.map(x=>`${x.length}:${x.answerIndex}:${x.groupsIndex}:${x.trailIndex}:${x.linkIndex}:${x.stepsIndex}:${x.deepCutIndex}`)).size,365);
for(const f of ['./content/source/trail_seeds.json','./content/source/steps_common_words.txt','./content/source/deepcut_prompts.json','./tools/rebuild_content.mjs','./public/robots.txt','./public/sitemap.xml','./public/about/index.html','./public/games/word-steps/index.html','./public/games/deep-cut/index.html'])assert.equal(fs.existsSync(f),true,`Missing ${f}`);
const appSource=fs.readFileSync('./public/app.js','utf8');assert.ok(appSource.includes("QWERTYUIOPASDFGHJKLZXCVBNM"),'Letter Grid keyboard should use QWERTY order');assert.ok(appSource.includes('Keep guessing — the clock is still running.'),'Deep Cut invalid guesses should preserve the active prompt');

const p=pickDaily('2026-08-30');
const p2=pickDaily('2026-08-31');
assert.notDeepEqual([p.length,p.answer,p.groups[0].name,p.trail.longest,p.link.answer,p.steps.start,p.steps.target,p.deepcut.prompts.map(x=>x.id).join('|')],[p2.length,p2.answer,p2.groups[0].name,p2.trail.longest,p2.link.answer,p2.steps.start,p2.steps.target,p2.deepcut.prompts.map(x=>x.id).join('|')]);
assert.ok(p.answer);assert.equal(p.groups.length,4);assert.equal(p.trail.grid.length,16);assert.equal(p.trail.longest.length,16);assert.equal(p.link.clues.length,3);assert.equal(p.steps.solution.length,p.steps.par+1);assert.equal(p.deepcut.prompts.length,8);
const env={ASSETS:{fetch:()=>new Response('asset')}};
let r=await worker.fetch(new Request('https://x.test/api/daily?date=2026-08-30'),env);assert.equal(r.status,200);let j=await r.json();
assert.equal('answer' in j.letter,false);assert.equal('solutions' in j.groups,false);assert.equal('longest' in j.trail,false);assert.equal('answer' in j.link,false);assert.equal('solution' in j.steps,false);assert.equal(j.groups.words.length,16);assert.ok(['Easy','Medium','Hard','Tricky'].includes(j.groups.difficulty));assert.equal(j.steps.start.length,4);assert.equal(j.steps.target.length,4);assert.equal(j.deepcut.prompts.length,8);assert.equal('answers' in j.deepcut.prompts[0],false);assert.equal(j.deepcut.seconds,25);assert.equal(j.leaderboard.enabled,false);
r=await worker.fetch(new Request('https://x.test/api/unlimited/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'CMU-X-NOTAREALACCESSCODE00'})}),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.active,false);

r=await worker.fetch(new Request('https://x.test/api/letter/guess?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guess:'ZZZZZ',attempt:6})}),env);
if(p.length===5){j=await r.json();assert.ok('answer' in j)}

r=await worker.fetch(new Request('https://x.test/api/groups/check?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({words:p.groups[0].words,mistakesAfter:1})}),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.match,true);assert.ok(['easy','medium','hard','tricky'].includes(j.difficulty));assert.ok(j.difficultyLabel);

r=await worker.fetch(new Request('https://x.test/api/trail/reveal?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({finished:true})}),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.longest.length,16);
r=await worker.fetch(new Request('https://x.test/api/leaderboard?scope=daily&date=2026-08-30'),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.enabled,false);

const nextStep=p.steps.solution[1];
r=await worker.fetch(new Request('https://x.test/api/steps/check?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({previous:p.steps.start,guess:nextStep})}),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.accepted,true);
r=await worker.fetch(new Request('https://x.test/api/steps/check?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({previous:p.steps.start,guess:p.steps.target})}),env);j=await r.json();if(!differsByOne(p.steps.start,p.steps.target))assert.equal(j.accepted,false);
r=await worker.fetch(new Request('https://x.test/api/steps/reveal?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({finished:true})}),env);j=await r.json();assert.deepEqual(j.solution,p.steps.solution);

const dc=p.deepcut.prompts[0],dcAnswer=dc.answers[0].name;
r=await worker.fetch(new Request('https://x.test/api/deepcut/check?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({promptId:dc.id,answer:dcAnswer})}),env);assert.equal(r.status,200);j=await r.json();assert.equal(j.accepted,true);assert.equal(j.canonical,dcAnswer);assert.ok(j.score>=30&&j.score<=100);
r=await worker.fetch(new Request('https://x.test/api/deepcut/check?date=2026-08-30',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({promptId:dc.id,answer:'not-a-real-answer'})}),env);j=await r.json();assert.equal(j.accepted,false);assert.equal(j.score,0);

// Regression: current Aug 30 board must accept ordinary words that the old live API rejected.
const current=pickDaily('2026-08-30');
if(current.trail.longest==='UNPREDICTABILITY'){
  assert.equal(trailPathValid('TAB',current.trail.grid),true);
  assert.equal(trailPathValid('CIDER',current.trail.grid),true);
  assert.equal(trailDictionaryWord('TAB',current.trail),true);
  assert.equal(trailDictionaryWord('CIDER',current.trail),true);
}

// Performance sanity: 100k local dictionary checks should be comfortably sub-second on Node.
const sample=current.trail;
const start=performance.now();
for(let i=0;i<100000;i++) trailDictionaryWord(i%2?'TAB':'CIDER',sample);
const ms=performance.now()-start;
assert.ok(ms < 1000,`Trail local dictionary lookup unexpectedly slow: ${ms.toFixed(1)}ms`);
console.log(`Trail dictionary benchmark: 100k checks in ${ms.toFixed(1)}ms`);
console.log('ALL TESTS PASSED');
