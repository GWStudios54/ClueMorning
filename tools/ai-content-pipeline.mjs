import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  deepCutHistoryIssues,
  deepCutPromptIssues,
  fourGroupsBoardIssues,
  validateFourGroupsCollection
} from './content-integrity.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const sourceDir=path.join(root,'content','source');
const generatedDir=path.join(root,'content','generated');

function arg(name,fallback){
  const prefix=`--${name}=`;
  const hit=process.argv.slice(2).find(v=>v.startsWith(prefix));
  return hit?hit.slice(prefix.length):fallback;
}
function intArg(name,fallback){const value=Number(arg(name,fallback));return Number.isFinite(value)&&value>0?Math.floor(value):fallback}
function stripFence(text){
  const raw=String(text??'').trim();
  if(!raw.startsWith('```'))return raw;
  return raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
}
function normalizeEndpoint(endpoint){return String(endpoint||'').replace(/\/+$/,'')}

const game=arg('game',process.env.CLUE_AI_GAME||'four-groups');
const count=intArg('count',Number(process.env.CLUE_AI_COUNT)||30);
const maxAttempts=intArg('attempts',Math.max(count*5,20));
const endpoint=normalizeEndpoint(process.env.CLUE_AI_ENDPOINT);
const model=process.env.CLUE_AI_MODEL;
const apiKey=process.env.CLUE_AI_API_KEY||'';
const outputPath=path.resolve(root,arg('out',process.env.CLUE_AI_OUT||'content/generated/ai_candidates.json'));

if(!['four-groups','deep-cut'].includes(game))throw new Error('--game must be four-groups or deep-cut');
if(!endpoint)throw new Error('Set CLUE_AI_ENDPOINT to an OpenAI-compatible chat-completions endpoint, e.g. a hosted model or local Ollama gateway.');
if(!model)throw new Error('Set CLUE_AI_MODEL to the model name exposed by CLUE_AI_ENDPOINT.');

async function callAi(system,user){
  const headers={'content-type':'application/json'};
  if(apiKey)headers.authorization=`Bearer ${apiKey}`;
  const response=await fetch(endpoint,{
    method:'POST',headers,
    body:JSON.stringify({
      model,
      messages:[{role:'system',content:system},{role:'user',content:user}],
      temperature:0.35
    })
  });
  if(!response.ok)throw new Error(`AI request failed ${response.status}: ${(await response.text()).slice(0,1000)}`);
  const body=await response.json();
  const text=body?.choices?.[0]?.message?.content ?? body?.message?.content ?? body?.response ?? body?.output_text;
  if(!text)throw new Error(`AI response did not contain usable text: ${JSON.stringify(body).slice(0,1000)}`);
  return String(text);
}

async function jsonAi(system,user){
  const text=await callAi(system,user);
  try{return JSON.parse(stripFence(text));}
  catch(error){throw new Error(`AI returned invalid JSON: ${error.message}; response=${text.slice(0,1200)}`)}
}

const groupsHistory=JSON.parse(await fs.readFile(path.join(sourceDir,'groups.json'),'utf8'));
const deepCutFiles=(await fs.readdir(sourceDir)).filter(name=>/^deepcut(?:_quality_.*)?\.json$/i.test(name));
const deepCutHistory=[];
for(const file of deepCutFiles){
  const value=JSON.parse(await fs.readFile(path.join(sourceDir,file),'utf8'));
  if(Array.isArray(value))deepCutHistory.push(...value);
}

function generationPrompt(){
  if(game==='four-groups')return {
    system:'You create fair, polished daily word-group puzzles. Return JSON only. Never explain outside the JSON.',
    user:`Create one Four Groups board as a JSON array of exactly four objects. Each object must be {"name":"category label","words":["WORD","WORD","WORD","WORD"]}. Requirements: exactly 16 unique visible tiles; four groups of four; no duplicated or near-duplicated tiles; each intended group must be defensible; minimize accidental alternate 4-word solutions; mix easy through hard groups; avoid trivia requiring a niche fandom; do not repeat these recent category labels: ${groupsHistory.slice(-24).flat().map(g=>g.name).join(' | ')}.`
  };
  return {
    system:'You create fair, factual Deep Cut prompts for a daily answer-rarity game. Return JSON only. Never explain outside the JSON.',
    user:'Create one Deep Cut prompt as JSON: {"id":"ai-short-slug","prompt":"Name ...","answers":[{"name":"canonical answer","aliases":[]}...]}. The clue must be broad common knowledge, while answer rarity creates the difficulty. Supply at least 8 unquestionably correct canonical answers, with aliases only when genuinely needed. Avoid subjective, disputed, time-sensitive, or technically arguable membership. Do not make the clue so broad that validation is impossible.'
  };
}

function deterministicIssues(candidate){
  if(game==='four-groups'){
    const local=fourGroupsBoardIssues(candidate,'candidate');
    const collection=validateFourGroupsCollection([...groupsHistory,candidate]);
    const historyOnly=validateFourGroupsCollection(groupsHistory).issues;
    const newHistoryIssues=collection.issues.slice(historyOnly.length);
    return [...local,...newHistoryIssues];
  }
  return [...deepCutPromptIssues(candidate),...deepCutHistoryIssues(candidate,deepCutHistory)];
}

async function critic(candidate){
  if(game==='four-groups')return jsonAi(
    'You are an adversarial puzzle editor. Your job is to reject ambiguous Four Groups boards. Return JSON only.',
    `Audit this board aggressively. Try to create alternate valid groups of four, identify tiles that fit multiple categories, unfairly obscure categories, duplicate concepts, or weak wordplay. A board is valid only if its intended partition is reasonably unique and every category is fair. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Board:\n${JSON.stringify(candidate)}`
  );
  return jsonAi(
    'You are an adversarial fact checker for a daily trivia-answer game. Return JSON only.',
    `Audit this Deep Cut prompt. Check that every listed answer clearly satisfies the clue, the clue is objective and timeless enough for scheduled use, aliases do not create duplicate answers, and obvious valid answers are not excluded merely because they are common. Return {"valid":true|false,"confidence":0-1,"issues":["..."]}. Candidate:\n${JSON.stringify(candidate)}`
  );
}

const approved=[];
const rejected=[];
for(let attempt=1;attempt<=maxAttempts && approved.length<count;attempt++){
  try{
    const prompt=generationPrompt();
    const candidate=await jsonAi(prompt.system,prompt.user);
    const issues=deterministicIssues(candidate);
    if(issues.length){rejected.push({attempt,stage:'deterministic',issues,candidate});continue}
    const review=await critic(candidate);
    if(review?.valid!==true || Number(review?.confidence??0)<0.75){
      rejected.push({attempt,stage:'ai-critic',issues:Array.isArray(review?.issues)?review.issues:['AI critic did not approve candidate.'],review,candidate});
      continue;
    }
    approved.push(candidate);
    if(game==='four-groups')groupsHistory.push(candidate);else deepCutHistory.push(candidate);
    console.log(`Approved ${approved.length}/${count} after ${attempt} attempt(s).`);
  }catch(error){
    rejected.push({attempt,stage:'exception',issues:[error.message]});
    console.warn(`Attempt ${attempt} failed: ${error.message}`);
  }
}

await fs.mkdir(path.dirname(outputPath),{recursive:true});
const report={
  generatedAt:new Date().toISOString(),game,model,requested:count,attempts:maxAttempts,
  approvedCount:approved.length,rejectedCount:rejected.length,
  approved,rejected,
  note:'Candidates are intentionally not published automatically. Review the approved list, then append accepted Four Groups boards to content/source/groups.json or accepted Deep Cut prompts to a deepcut_quality_*.json source file and run npm run rebuild:content.'
};
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8');
if(approved.length<count){
  console.error(`Only ${approved.length}/${count} candidates passed. Report: ${path.relative(root,outputPath)}`);
  process.exitCode=1;
}else console.log(`AI content batch complete: ${approved.length} approved candidates. Report: ${path.relative(root,outputPath)}`);
