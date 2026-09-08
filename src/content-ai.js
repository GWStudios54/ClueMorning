import {DEEP_CUT_PROMPTS,GROUP_PUZZLES} from './puzzles.js';

export const WORKERS_AI_MODEL='@cf/zai-org/glm-4.7-flash';
export const FREE_DAILY_NEURONS=10000;
export const CLUE_AI_DAILY_NEURON_CAP=2000;
export const CLUE_AI_FREE_HEADROOM=FREE_DAILY_NEURONS-CLUE_AI_DAILY_NEURON_CAP;
export const MODEL_NEURONS_PER_MILLION_INPUT=5500;
export const MODEL_NEURONS_PER_MILLION_OUTPUT=36400;
export const DAILY_AI_PLAN=Object.freeze({
  'four-groups':{target:1,maxAttempts:2,generationMaxTokens:600,criticMaxTokens:400},
  'deep-cut':{target:1,maxAttempts:2,generationMaxTokens:900,criticMaxTokens:500}
});

class BudgetStop extends Error{constructor(message){super(message);this.name='BudgetStop'}}

function norm(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/&/g,'AND').replace(/[^A-Z0-9]/g,'')}
function utcDate(date=new Date()){return date.toISOString().slice(0,10)}
function safeJson(value){try{return JSON.stringify(value)}catch{return 'null'}}
function promptTokenReserve(messages){const chars=(messages||[]).reduce((n,m)=>n+String(m?.role||'').length+String(m?.content||'').length,0);return Math.max(1,Math.ceil(chars/3))}
export function estimateNeurons(promptTokens,completionTokens){return Math.max(0,Number(promptTokens)||0)*MODEL_NEURONS_PER_MILLION_INPUT/1_000_000+Math.max(0,Number(completionTokens)||0)*MODEL_NEURONS_PER_MILLION_OUTPUT/1_000_000}
export function reserveNeurons(messages,maxTokens){return estimateNeurons(promptTokenReserve(messages),maxTokens)}
function allocationError(error){return /3036|daily free allocation|account limited|used up your daily free allocation/i.test(String(error?.message||error))}

async function ensureTables(env){
  if(!env.DB)throw new Error('DB binding is required so AI usage can be budgeted before inference.');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_neuron_usage (date_utc TEXT PRIMARY KEY,neurons REAL NOT NULL DEFAULT 0,request_count INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_content_runs (date_utc TEXT PRIMARY KEY,status TEXT NOT NULL,model TEXT NOT NULL,approved_groups INTEGER NOT NULL DEFAULT 0,approved_deepcut INTEGER NOT NULL DEFAULT 0,request_count INTEGER NOT NULL DEFAULT 0,neurons REAL NOT NULL DEFAULT 0,note TEXT,started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_content_candidates (id TEXT PRIMARY KEY,date_utc TEXT NOT NULL,game TEXT NOT NULL,status TEXT NOT NULL,candidate_json TEXT,review_json TEXT,issues_json TEXT,model TEXT NOT NULL,neurons REAL NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_candidates_status_game ON ai_content_candidates(status,game,created_at DESC)').run();
}
async function claimDay(env,date){const r=await env.DB.prepare('INSERT OR IGNORE INTO ai_content_runs(date_utc,status,model,note) VALUES(?,?,?,?)').bind(date,'running',WORKERS_AI_MODEL,`One Four Groups + one Deep Cut candidate max; ${CLUE_AI_DAILY_NEURON_CAP}/${FREE_DAILY_NEURONS} neuron cap.`).run();return Number(r?.meta?.changes||0)>0}
async function usage(env,date){const row=await env.DB.prepare('SELECT neurons,request_count FROM ai_neuron_usage WHERE date_utc=?').bind(date).first();return {neurons:Number(row?.neurons||0),requests:Number(row?.request_count||0)}}
async function addUsage(env,date,neurons){await env.DB.prepare('INSERT INTO ai_neuron_usage(date_utc,neurons,request_count,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(date_utc) DO UPDATE SET neurons=neurons+excluded.neurons,request_count=request_count+1,updated_at=CURRENT_TIMESTAMP').bind(date,Number(neurons)||0).run()}
async function saveCandidate(env,{date,game,status,candidate=null,review=null,issues=[],neurons=0}){await env.DB.prepare('INSERT INTO ai_content_candidates(id,date_utc,game,status,candidate_json,review_json,issues_json,model,neurons) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),date,game,status,candidate==null?null:safeJson(candidate),review==null?null:safeJson(review),safeJson(issues),WORKERS_AI_MODEL,Number(neurons)||0).run()}

function parseAi(result){
  const raw=result?.response??result;
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))return raw;
  const text=String(raw??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!text)throw new Error('Workers AI returned an empty response.');
  try{return JSON.parse(text)}catch(error){throw new Error(`Workers AI returned invalid JSON: ${error.message}`)}
}
async function aiJson(env,date,messages,maxTokens,temperature){
  if(!env.AI)throw new Error('Workers AI binding AI is unavailable.');
  const reserved=reserveNeurons(messages,maxTokens),before=await usage(env,date);
  if(before.neurons+reserved>CLUE_AI_DAILY_NEURON_CAP)throw new BudgetStop(`Stopped before inference: ${before.neurons.toFixed(2)} used + ${reserved.toFixed(2)} reserved would exceed ${CLUE_AI_DAILY_NEURON_CAP} neurons.`);
  let result;
  try{result=await env.AI.run(WORKERS_AI_MODEL,{messages,max_tokens:maxTokens,temperature,response_format:{type:'json_object'}})}
  catch(error){if(allocationError(error))throw new BudgetStop('Cloudflare says the account-wide free neuron allocation is exhausted for today.');throw error}
  const p=Number(result?.usage?.prompt_tokens),c=Number(result?.usage?.completion_tokens);
  const charged=Number.isFinite(p)&&Number.isFinite(c)?estimateNeurons(p,c):reserved;
  await addUsage(env,date,charged);
  return {data:parseAi(result),neurons:charged};
}

function groupSignature(group){return `${norm(group?.name)}::${(group?.words||[]).map(norm).filter(Boolean).sort().join('|')}`}
function fourIssues(board,history){
  if(!Array.isArray(board)||board.length!==4)return ['Board must contain exactly four groups.'];
  const issues=[],names=new Set(),tiles=new Set(),sigs=[];
  for(const group of board){
    const name=String(group?.name??'').trim(),nk=norm(name);if(!nk)issues.push('A group is missing a name.');else if(names.has(nk))issues.push(`Duplicate group name: ${name}.`);names.add(nk);
    if(!Array.isArray(group?.words)||group.words.length!==4){issues.push(`Group ${name||'?'} must contain exactly four tiles.`);continue}
    for(const raw of group.words){const key=norm(raw);if(!key)issues.push(`Group ${name||'?'} contains an empty tile.`);else if(tiles.has(key))issues.push(`Duplicate tile: ${raw}.`);else tiles.add(key)}
    sigs.push(groupSignature(group));
  }
  if(tiles.size!==16)issues.push(`Board has ${tiles.size} unique tiles instead of 16.`);
  const boardSig=[...sigs].sort().join('|||');
  for(const old of history||[]){if(!Array.isArray(old))continue;const oldSigs=old.map(groupSignature).sort();if(oldSigs.join('|||')===boardSig)issues.push('Board exactly repeats an existing Four Groups board.');for(const sig of sigs)if(oldSigs.includes(sig))issues.push('Board exactly repeats an existing Four Groups group.')}
  return [...new Set(issues)];
}
function deepKeys(prompt){const keys=new Set();for(const answer of prompt?.answers||[])for(const raw of [answer?.name,...(Array.isArray(answer?.aliases)?answer.aliases:[])]){const key=norm(raw);if(key)keys.add(key)}return keys}
function deepIssues(prompt,history){
  const issues=[];if(!prompt?.id||!String(prompt?.prompt??'').trim())issues.push('Candidate needs an id and prompt.');if(!Array.isArray(prompt?.answers)||prompt.answers.length<8)issues.push('Candidate needs at least eight canonical answers.');
  const accepted=new Map();for(let i=0;i<(prompt?.answers?.length||0);i++){const answer=prompt.answers[i];if(!String(answer?.name??'').trim())issues.push(`Answer ${i+1} has no canonical name.`);for(const raw of [answer?.name,...(Array.isArray(answer?.aliases)?answer.aliases:[])]){const key=norm(raw);if(!key)continue;if(accepted.has(key)&&accepted.get(key)!==i)issues.push(`Accepted answer/alias repeats across entries: ${raw}.`);else accepted.set(key,i)}}
  const keys=deepKeys(prompt),pk=norm(prompt?.prompt);for(const old of history||[]){if(pk&&pk===norm(old?.prompt))issues.push(`Prompt duplicates ${old?.id||'an existing prompt'}.`);let overlap=0;const oldKeys=deepKeys(old);for(const key of keys)if(oldKeys.has(key))overlap++;if(overlap>=4)issues.push(`Answer set overlaps heavily with ${old?.id||'an existing prompt'}.`)}
  return [...new Set(issues)];
}
async function queued(env,game){const rows=await env.DB.prepare("SELECT candidate_json FROM ai_content_candidates WHERE game=? AND status='approved' ORDER BY created_at DESC LIMIT 100").bind(game).all();const out=[];for(const row of rows?.results||[]){try{out.push(JSON.parse(row.candidate_json))}catch{}}return out}
async function histories(env){return {'four-groups':[...GROUP_PUZZLES,...await queued(env,'four-groups')],'deep-cut':[...DEEP_CUT_PROMPTS,...await queued(env,'deep-cut')]}}

function generationMessages(game,history){
  if(game==='four-groups'){
    const labels=(history||[]).slice(-24).flatMap(board=>(board||[]).map(g=>g?.name)).filter(Boolean).slice(-48);
    return [{role:'system',content:'Create fair, polished daily word-group puzzles. Return JSON only.'},{role:'user',content:`Create one Four Groups puzzle as {"groups":[{"name":"category","words":["A","B","C","D"]},...]} with exactly four groups. Use 16 unique visible tiles. Make every group defensible, minimize accidental alternate groups, mix accessible through difficult categories, avoid niche-fandom trivia, and do not reuse these recent category labels: ${labels.join(' | ')||'none'}.`}];
  }
  const prompts=(history||[]).slice(-20).map(p=>p?.prompt).filter(Boolean);
  return [{role:'system',content:'Create fair, factual Deep Cut prompts for a daily answer-rarity game. Return JSON only.'},{role:'user',content:`Create {"id":"ai-short-slug","prompt":"Name ...","answers":[{"name":"canonical answer","aliases":[]}...]}. The clue must be objective, common-knowledge, stable over time, and have at least 8 unquestionably correct canonical answers. Avoid subjective, disputed, technically arguable, or time-sensitive membership. Do not repeat these recent prompts: ${prompts.join(' | ')||'none'}.`}];
}
function criticMessages(game,candidate){
  if(game==='four-groups')return [{role:'system',content:'You are an adversarial Four Groups editor. Return JSON only.'},{role:'user',content:`Try to break this board. Find alternate valid groups of four, tiles that fit multiple groups, unfair obscurity, duplicate concepts, weak wordplay, or misleading labels. Approve only if the intended partition is reasonably unique and fair. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Board: ${safeJson(candidate)}`}];
  return [{role:'system',content:'You are an adversarial fact checker for a daily trivia-answer game. Return JSON only.'},{role:'user',content:`Audit this Deep Cut prompt. Every listed answer must clearly satisfy the clue; the clue must be objective and stable; aliases must not create duplicates; membership must not depend on a technicality. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Candidate: ${safeJson(candidate)}`}];
}
async function generateCandidate(env,date,game,history,plan){
  for(let attempt=1;attempt<=plan.maxAttempts;attempt++){
    const gen=await aiJson(env,date,generationMessages(game,history),plan.generationMaxTokens,0.35);
    const candidate=game==='four-groups'?(gen.data?.groups??gen.data):gen.data;
    const issues=game==='four-groups'?fourIssues(candidate,history):deepIssues(candidate,history);
    if(issues.length){await saveCandidate(env,{date,game,status:'rejected',candidate,issues,neurons:gen.neurons});continue}
    const crit=await aiJson(env,date,criticMessages(game,candidate),plan.criticMaxTokens,0.1),review=crit.data,criticIssues=Array.isArray(review?.issues)?review.issues:[];
    const total=gen.neurons+crit.neurons;
    if(review?.valid!==true||Number(review?.confidence||0)<0.8){await saveCandidate(env,{date,game,status:'rejected',candidate,review,issues:criticIssues.length?criticIssues:['AI critic did not approve the candidate.'],neurons:total});continue}
    await saveCandidate(env,{date,game,status:'approved',candidate,review,issues:criticIssues,neurons:total});history.push(candidate);return 1;
  }
  return 0;
}

export async function runContentAiSchedule(env,now=new Date()){
  if(!env?.AI||!env?.DB)return {ran:false,reason:'AI or DB binding unavailable'};
  const date=utcDate(now);await ensureTables(env);if(!await claimDay(env,date))return {ran:false,reason:'daily batch already claimed'};
  let approvedGroups=0,approvedDeepCut=0,status='complete',note='';
  try{const history=await histories(env);for(const game of ['four-groups','deep-cut']){const plan=DAILY_AI_PLAN[game];for(let i=0;i<plan.target;i++){const approved=await generateCandidate(env,date,game,history[game],plan);if(game==='four-groups')approvedGroups+=approved;else approvedDeepCut+=approved}}}
  catch(error){if(error instanceof BudgetStop||allocationError(error)){status='budget-stop';note=error.message}else{status='error';note=String(error?.message||error);console.error('Workers AI content batch failed',error)}}
  const used=await usage(env,date);if(used.neurons>CLUE_AI_DAILY_NEURON_CAP){status='error';note=`Budget invariant violated: tracked ${used.neurons.toFixed(2)} neurons > cap ${CLUE_AI_DAILY_NEURON_CAP}.`}
  await env.DB.prepare('UPDATE ai_content_runs SET status=?,approved_groups=?,approved_deepcut=?,request_count=?,neurons=?,note=?,completed_at=CURRENT_TIMESTAMP WHERE date_utc=?').bind(status,approvedGroups,approvedDeepCut,used.requests,used.neurons,note||`Reserved ${CLUE_AI_FREE_HEADROOM} of the ${FREE_DAILY_NEURONS} free daily neurons as headroom.`,date).run();
  return {ran:true,date,status,approvedGroups,approvedDeepCut,requests:used.requests,neurons:used.neurons,cap:CLUE_AI_DAILY_NEURON_CAP,freeDaily:FREE_DAILY_NEURONS};
}
