import {DEEP_CUT_PROMPTS,GROUP_PUZZLES} from './puzzles.js';

export const WORKERS_AI_MODEL='@cf/zai-org/glm-4.7-flash';
export const FREE_DAILY_NEURONS=10000;
export const CLUE_AI_DAILY_NEURON_CAP=2000;
export const CLUE_AI_FREE_HEADROOM=FREE_DAILY_NEURONS-CLUE_AI_DAILY_NEURON_CAP;
export const DAILY_AI_PLAN=Object.freeze({
  'four-groups':{target:1,maxAttempts:2,generationMaxTokens:600,criticMaxTokens:400},
  'deep-cut':{target:1,maxAttempts:2,generationMaxTokens:900,criticMaxTokens:500}
});

// Cloudflare's current neuron rates for @cf/zai-org/glm-4.7-flash.
// Keeping these explicit lets us reserve an upper bound before every request.
export const MODEL_NEURONS_PER_MILLION_INPUT=5500;
export const MODEL_NEURONS_PER_MILLION_OUTPUT=36400;

function normalize(value){
  return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/&/g,'AND').replace(/[^A-Z0-9]/g,'');
}
function jsonText(value){try{return JSON.stringify(value)}catch{return 'null'}}
function utcDate(now=new Date()){return now.toISOString().slice(0,10)}
function estimatedPromptTokens(messages){
  // Deliberately conservative for English JSON/puzzle prompts: about one token per 3 chars.
  const chars=(messages||[]).reduce((n,m)=>n+String(m?.role||'').length+String(m?.content||'').length,n=0);
  return Math.max(1,Math.ceil(chars/3));
}
export function estimateNeurons(promptTokens,completionTokens){
  const input=Math.max(0,Number(promptTokens)||0)*MODEL_NEURONS_PER_MILLION_INPUT/1_000_000;
  const output=Math.max(0,Number(completionTokens)||0)*MODEL_NEURONS_PER_MILLION_OUTPUT/1_000_000;
  return input+output;
}
export function reserveNeurons(messages,maxTokens){return estimateNeurons(estimatedPromptTokens(messages),maxTokens)}

class BudgetStop extends Error{constructor(message){super(message);this.name='BudgetStop'}}
function isAllocationError(error){return /3036|daily free allocation|used up your daily free allocation|account limited/i.test(String(error?.message||error))}

async function ensureAiTables(env){
  if(!env.DB)throw new Error('Workers AI content generation requires the existing DB binding so neuron usage can be tracked before inference.');
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_neuron_usage (
    date_utc TEXT PRIMARY KEY,
    neurons REAL NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_content_runs (
    date_utc TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    model TEXT NOT NULL,
    approved_groups INTEGER NOT NULL DEFAULT 0,
    approved_deepcut INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    neurons REAL NOT NULL DEFAULT 0,
    note TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_content_candidates (
    id TEXT PRIMARY KEY,
    date_utc TEXT NOT NULL,
    game TEXT NOT NULL,
    status TEXT NOT NULL,
    candidate_json TEXT,
    review_json TEXT,
    issues_json TEXT,
    model TEXT NOT NULL,
    neurons REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_candidates_status_game ON ai_content_candidates(status,game,created_at DESC)').run();
}
async function claimDailyRun(env,date){
  const result=await env.DB.prepare(`INSERT OR IGNORE INTO ai_content_runs(date_utc,status,model,note) VALUES(?,?,?,?)`)
    .bind(date,'running',WORKERS_AI_MODEL,`Daily cap ${CLUE_AI_DAILY_NEURON_CAP}/${FREE_DAILY_NEURONS} free neurons; one approved candidate per game at most.`).run();
  return Number(result?.meta?.changes||0)>0;
}
async function usageFor(env,date){
  const row=await env.DB.prepare('SELECT neurons,request_count FROM ai_neuron_usage WHERE date_utc=?').bind(date).first();
  return {neurons:Number(row?.neurons||0),requests:Number(row?.request_count||0)};
}
async function addUsage(env,date,neurons){
  await env.DB.prepare(`INSERT INTO ai_neuron_usage(date_utc,neurons,request_count,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(date_utc) DO UPDATE SET neurons=neurons+excluded.neurons,request_count=request_count+1,updated_at=CURRENT_TIMESTAMP`)
    .bind(date,Number(neurons)||0).run();
}
async function storeCandidate(env,{date,game,status,candidate=null,review=null,issues=[],neurons=0}){
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO ai_content_candidates(id,date_utc,game,status,candidate_json,review_json,issues_json,model,neurons)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,date,game,status,candidate==null?null:jsonText(candidate),review==null?null:jsonText(review),jsonText(issues),WORKERS_AI_MODEL,Number(neurons)||0).run();
  return id;
}
function parseAiJson(result){
  const raw=result?.response??result;
  if(raw && typeof raw==='object' && !Array.isArray(raw))return raw;
  const text=String(raw??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!text)throw new Error('Workers AI returned an empty response.');
  try{return JSON.parse(text)}catch(error){throw new Error(`Workers AI returned invalid JSON: ${error.message}`)}
}
async function runJson(env,date,messages,maxTokens,temperature=0.25){
  if(!env.AI)throw new Error('Cloudflare Workers AI binding AI is not configured.');
  const reserved=reserveNeurons(messages,maxTokens);
  const before=await usageFor(env,date);
  if(before.neurons+reserved>CLUE_AI_DAILY_NEURON_CAP){
    throw new BudgetStop(`Skipping AI request: ${before.neurons.toFixed(2)} neurons used and ${reserved.toFixed(2)} reserved would exceed Clue Morning's ${CLUE_AI_DAILY_NEURON_CAP}-neuron daily cap.`);
  }
  let result;
  try{
    result=await env.AI.run(WORKERS_AI_MODEL,{messages,max_tokens:maxTokens,temperature,response_format:{type:'json_object'}});
  }catch(error){
    if(isAllocationError(error))throw new BudgetStop('Cloudflare reports the account-wide 10,000-neuron free allocation is exhausted; no further AI requests will run today.');
    throw error;
  }
  const promptTokens=Number(result?.usage?.prompt_tokens);
  const completionTokens=Number(result?.usage?.completion_tokens);
  const actual=Number.isFinite(promptTokens)&&Number.isFinite(completionTokens)?estimateNeurons(promptTokens,completionTokens):reserved;
  await addUsage(env,date,actual);
  return {data:parseAiJson(result),neurons:actual};
}

function fourGroupsIssues(board,history){
  const issues=[];
  if(!Array.isArray(board)||board.length!==4)return ['Board must contain exactly four groups.'];
  const names=new Set(),tiles=new Set(),groupSigs=[];
  for(const group of board){
    const name=String(group?.name??'').trim(),nameKey=normalize(name);
    if(!nameKey)issues.push('A group is missing a name.');
    else if(names.has(nameKey))issues.push(`Duplicate group name: ${name}.`);
    names.add(nameKey);
    if(!Array.isArray(group?.words)||group.words.length!==4){issues.push(`Group ${name||'?'} must contain exactly four tiles.`);continue}
    const local=[];
    for(const raw of group.words){const key=normalize(raw);if(!key)issues.push(`Group ${name||'?'} contains an empty tile.`);else if(tiles.has(key))issues.push(`Duplicate tile: ${raw}.`);else tiles.add(key);if(key)local.push(key)}
    groupSigs.push(`${nameKey}::${local.sort().join('|')}`);
  }
  if(tiles.size!==16)issues.push(`Board has ${tiles.size} unique tiles instead of 16.`);
  const boardSig=groupSigs.sort().join('|||');
  for(const old of history||[]){
    if(!Array.isArray(old))continue;
    const oldGroups=old.map(g=>`${normalize(g?.name)}::${(g?.words||[]).map(normalize).filter(Boolean).sort().join('|')}`).sort();
    if(oldGroups.join('|||')===boardSig)issues.push('Board exactly repeats an existing Four Groups board.');
    for(const sig of groupSigs)if(oldGroups.includes(sig))issues.push('Board exactly repeats an existing Four Groups group.');
  }
  return [...new Set(issues)];
}
function deepCutKeys(prompt){const keys=new Set();for(const a of prompt?.answers||[])for(const raw of [a?.name,...(Array.isArray(a?.aliases)?a.aliases:[])]){const key=normalize(raw);if(key)keys.add(key)}return keys}
function deepCutIssues(prompt,history){
  const issues=[];
  if(!prompt?.id||!String(prompt?.prompt??'').trim())issues.push('Deep Cut candidate needs an id and prompt.');
  if(!Array.isArray(prompt?.answers)||prompt.answers.length<8)issues.push('Deep Cut candidate must include at least eight canonical answers.');
  const seen=new Map();
  for(let i=0;i<(prompt?.answers?.length||0);i++){
    const answer=prompt.answers[i];if(!String(answer?.name??'').trim())issues.push(`Answer ${i+1} has no canonical name.`);
    for(const raw of [answer?.name,...(Array.isArray(answer?.aliases)?answer.aliases:[])]){const key=normalize(raw);if(!key)continue;if(seen.has(key)&&seen.get(key)!==i)issues.push(`Accepted answer/alias repeats across entries: ${raw}.`);else seen.set(key,i)}
  }
  const candidateKeys=deepCutKeys(prompt),promptKey=normalize(prompt?.prompt);
  for(const old of history||[]){
    if(promptKey&&promptKey===normalize(old?.prompt))issues.push(`Prompt duplicates existing Deep Cut prompt ${old?.id||''}.`);
    const oldKeys=deepCutKeys(old);let overlap=0;for(const key of candidateKeys)if(oldKeys.has(key))overlap++;
    if(overlap>=4)issues.push(`Answer set overlaps heavily with existing Deep Cut prompt ${old?.id||''}.`);
  }
  return [...new Set(issues)];
}
async function queuedHistory(env,game){
  const rows=await env.DB.prepare(`SELECT candidate_json FROM ai_content_candidates WHERE game=? AND status='approved' ORDER BY created_at DESC LIMIT 100`).bind(game).all();
  const out=[];for(const row of rows?.results||[]){try{out.push(JSON.parse(row.candidate_json))}catch{}}
  return out;
}
function generationMessages(game,history){
  if(game==='four-groups'){
    const recentLabels=(history||[]).slice(-24).flatMap(board=>(board||[]).map(g=>g?.name)).filter(Boolean).slice(-48);
    return [
      {role:'system',content:'Create fair, polished daily word-group puzzles. Return JSON only.'},
      {role:'user',content:`Create exactly one Four Groups puzzle as {"groups":[{"name":"category","words":["A","B","C","D"]},...]} with exactly four groups. Requirements: 16 unique visible tiles, four defensible groups of four, no duplicate or near-duplicate tiles, minimize accidental alternate groups, mix accessible through difficult categories, avoid niche-fandom trivia, and do not reuse these recent category labels: ${recentLabels.join(' | ')||'none'}.`}
    ];
  }
  const recentPrompts=(history||[]).slice(-20).map(p=>p?.prompt).filter(Boolean);
  return [
    {role:'system',content:'Create fair, factual Deep Cut prompts for a daily answer-rarity game. Return JSON only.'},
    {role:'user',content:`Create one object {"id":"ai-short-slug","prompt":"Name ...","answers":[{"name":"canonical answer","aliases":[]}...]}. The clue must be objective, common-knowledge, and stable over time. Include at least 8 unquestionably correct canonical answers. Aliases only when genuinely needed. Avoid subjective, disputed, or technically arguable membership. Avoid repeating these recent prompts: ${recentPrompts.join(' | ')||'none'}.`}
  ];
}
function criticMessages(game,candidate){
  if(game==='four-groups')return [
    {role:'system',content:'You are an adversarial puzzle editor. Reject ambiguous Four Groups boards. Return JSON only.'},
    {role:'user',content:`Try to break this board. Look for alternate valid groups of four, tiles that naturally fit multiple groups, unfair obscurity, duplicate concepts, weak wordplay, or misleading labels. Approve only if the intended partition is reasonably unique and fair. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Board: ${jsonText(candidate)}`}
  ];
  return [
    {role:'system',content:'You are an adversarial fact checker for a daily trivia-answer game. Return JSON only.'},
    {role:'user',content:`Audit this Deep Cut prompt. Every listed answer must clearly satisfy the clue, the clue must be objective and stable, aliases must not create duplicates, and membership must not depend on a technicality. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Candidate: ${jsonText(candidate)}`}
  ];
}
async function histories(env){
  const queuedGroups=await queuedHistory(env,'four-groups');
  const queuedDeepCut=await queuedHistory(env,'deep-cut');
  return {
    'four-groups':[...GROUP_PUZZLES,...queuedGroups],
    'deep-cut':[...DEEP_CUT_PROMPTS,...queuedDeepCut]
  };
}
async function generateOne(env,date,game,history,plan){
  let totalNeurons=0;
  for(let attempt=1;attempt<=plan.maxAttempts;attempt++){
    const generation=await runJson(env,date,generationMessages(game,history),plan.generationMaxTokens,0.35);totalNeurons+=generation.neurons;
    const candidate=game==='four-groups'?(generation.data?.groups??generation.data):generation.data;
    const issues=game==='four-groups'?fourGroupsIssues(candidate,history):deepCutIssues(candidate,history);
    if(issues.length){await storeCandidate(env,{date,game,status:'rejected',candidate,issues,neurons:generation.neurons});continue}
    const critique=await runJson(env,date,criticMessages(game,candidate),plan.criticMaxTokens,0.1);totalNeurons+=critique.neurons;
    const review=critique.data,criticIssues=Array.isArray(review?.issues)?review.issues:[];
    if(review?.valid!==true||Number(review?.confidence||0)<0.8){await storeCandidate(env,{date,game,status:'rejected',candidate,review,issues:criticIssues.length?criticIssues:['AI critic did not approve the candidate.'],neurons:generation.neurons+critique.neurons});continue}
    await storeCandidate(env,{date,game,status:'approved',candidate,review,issues:criticIssues,neurons:generation.neurons+critique.neurons});
    history.push(candidate);
    return {approved:1,neurons:totalNeurons};
  }
  return {approved:0,neurons:totalNeurons};
}

export async function runContentAiSchedule(env,now=new Date()){
  if(!env?.AI||!env?.DB)return {ran:false,reason:'AI or DB binding unavailable'};
  const date=utcDate(now);
  await ensureAiTables(env);
  if(!await claimDailyRun(env,date))return {ran:false,reason:'daily batch already claimed'};
  let approvedGroups=0,approvedDeepCut=0,status='complete',note='';
  try{
    const history=await histories(env);
    for(const game of ['four-groups','deep-cut']){
      const plan=DAILY_AI_PLAN[game];
      for(let i=0;i<plan.target;i++){
        const result=await generateOne(env,date,game,history[game],plan);
        if(game==='four-groups')approvedGroups+=result.approved;else approvedDeepCut+=result.approved;
      }
    }
  }catch(error){
    if(error instanceof BudgetStop||isAllocationError(error)){status='budget-stop';note=error.message}
    else{status='error';note=String(error?.message||error);console.error('Workers AI content batch failed',error)}
  }
  const usage=await usageFor(env,date);
  await env.DB.prepare(`UPDATE ai_content_runs SET status=?,approved_groups=?,approved_deepcut=?,request_count=?,neurons=?,note=?,completed_at=CURRENT_TIMESTAMP WHERE date_utc=?`)
    .bind(status,approvedGroups,approvedDeepCut,usage.requests,usage.neurons,note||`Kept Clue Morning under ${CLUE_AI_DAILY_NEURON_CAP} neurons, leaving ${CLUE_AI_FREE_HEADROOM} of Cloudflare's free daily allocation unused as headroom.`,date).run();
  return {ran:true,date,status,approvedGroups,approvedDeepCut,requests:usage.requests,neurons:usage.neurons,cap:CLUE_AI_DAILY_NEURON_CAP,freeDaily:FREE_DAILY_NEURONS};
}
