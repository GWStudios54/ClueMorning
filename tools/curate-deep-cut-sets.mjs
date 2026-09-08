import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DEEP_CUT_MIN_ANSWERS,
  DEEP_CUT_QUALITY_CUTOVER_DAY,
  DEEP_CUT_QUALITY_CUTOVER_DATE,
  DEEP_CUT_MIN_ACCESSIBLE_PER_DAY,
  DEEP_CUT_MAX_DEEP_PER_DAY,
  DEEP_CUT_MAX_SUBDIVISION_PER_DAY,
  DEEP_CUT_MAX_MOVIE_PER_DAY,
  DEEP_CUT_MAX_MUSIC_PER_DAY,
  DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY,
  DEEP_CUT_MAX_DOMAIN_PER_DAY,
  deepCutPromptQuality,
  deepCutDifficulty,
  deepCutDomain,
  deepCutDailyBalance,
  eligibleDeepCutIndices
} from './deep-cut-quality.mjs';
import {applyDeepCutRarityOrder} from './deep-cut-rarity-order.mjs';
import {deepCutSetAnswerCollisions} from './content-integrity.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const sourceDir=path.join(root,'content','source');
const sourcePath=path.join(sourceDir,'deepcut_prompts.json');
const schedulePath=path.join(sourceDir,'schedule.json');
const generatedPath=path.join(root,'content','generated','deep_cut.json');
const reportPath=path.join(root,'content','generated','deep_cut_quality.json');
const modulePath=path.join(root,'src','puzzles.js');
const REPEAT_GAP=6;

function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function answerKey(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function validatePrompt(prompt,sourceLabel){
  if(!prompt?.id||!prompt?.prompt||!Array.isArray(prompt.answers)||prompt.answers.length<4)throw new Error(`Invalid Deep Cut prompt in ${sourceLabel}: ${prompt?.id||'unknown'}`);
  const accepted=new Set();
  for(const answer of prompt.answers){
    if(!answer?.name)throw new Error(`${prompt.id} has an answer without a name`);
    const local=new Set();
    for(const raw of [answer.name,...(Array.isArray(answer.aliases)?answer.aliases:[])]){
      const key=answerKey(raw);if(!key)throw new Error(`${prompt.id} has an empty answer or alias`);if(local.has(key))continue;if(accepted.has(key))throw new Error(`${prompt.id} repeats an accepted answer across entries: ${raw}`);local.add(key);
    }
    for(const key of local)accepted.add(key);
  }
}
function replaceExport(moduleText,name,value,nextName){
  const startMarker=`export const ${name} = `,endMarker=`\n\nexport const ${nextName} = `,start=moduleText.indexOf(startMarker),end=moduleText.indexOf(endMarker,start);
  if(start<0||end<0)throw new Error(`Could not locate ${name} in src/puzzles.js`);
  return moduleText.slice(0,start)+startMarker+JSON.stringify(value)+';'+moduleText.slice(end);
}

const basePrompts=JSON.parse(await fs.readFile(sourcePath,'utf8'));
const qualitySourceFiles=(await fs.readdir(sourceDir)).filter(name=>/^deepcut_quality_.*\.json$/i.test(name)).sort();
const qualitySources=[];
for(const name of qualitySourceFiles){const list=JSON.parse(await fs.readFile(path.join(sourceDir,name),'utf8'));if(!Array.isArray(list))throw new Error(`${name} must contain a JSON array.`);qualitySources.push({name,prompts:list})}
const supplementPrompts=qualitySources.flatMap(source=>source.prompts);
const schedule=JSON.parse(await fs.readFile(schedulePath,'utf8'));
const baseline=JSON.parse(await fs.readFile(generatedPath,'utf8'));

if(!Array.isArray(basePrompts))throw new Error('Deep Cut base prompt source must be an array.');
const ids=new Set();
for(const prompt of basePrompts){validatePrompt(prompt,'deepcut_prompts.json');if(ids.has(prompt.id))throw new Error(`Duplicate Deep Cut prompt id: ${prompt.id}`);ids.add(prompt.id)}
for(const source of qualitySources){for(const prompt of source.prompts){validatePrompt(prompt,source.name);if(ids.has(prompt.id))throw new Error(`Duplicate Deep Cut prompt id across sources: ${prompt.id}`);ids.add(prompt.id)}}

const prompts=applyDeepCutRarityOrder([...basePrompts,...supplementPrompts]);
const promptSources=[...basePrompts.map(()=>"base"),...qualitySources.flatMap(source=>source.prompts.map(()=>source.name))];
const eligible=eligibleDeepCutIndices(prompts);
const accessibleEligible=eligible.filter(index=>deepCutDifficulty(prompts[index]).tier==='accessible');
const minimumPool=DEEP_CUT_MIN_ACCESSIBLE_PER_DAY*REPEAT_GAP;
if(eligible.length<minimumPool)throw new Error(`Deep Cut common-knowledge gate left only ${eligible.length} eligible prompts; need at least ${minimumPool} for the repeat window.`);
if(accessibleEligible.length<minimumPool)throw new Error(`Deep Cut has only ${accessibleEligible.length} accessible prompts; need at least ${minimumPool}.`);
if(baseline.length!==schedule.days)throw new Error(`Deep Cut baseline has ${baseline.length} sets; expected ${schedule.days}.`);

const eligibleSet=new Set(eligible),usage=Array(prompts.length).fill(0),last=Array(prompts.length).fill(-999),sets=[],signatures=new Set();
for(let day=0;day<Math.min(DEEP_CUT_QUALITY_CUTOVER_DAY,schedule.days);day++){
  const set=[...baseline[day]];sets.push(set);signatures.add(set.join(':'));for(const index of set){if(eligibleSet.has(index)){usage[index]++;last[index]=day}}
}

function chooseSet(day,available){
  let attempts=0;
  function search(chosen,start){
    if(chosen.length===8)return deepCutDailyBalance(chosen,prompts).valid&&deepCutSetAnswerCollisions(chosen,prompts).length===0?chosen:null;
    if(available.length-start<8-chosen.length)return null;
    for(let i=start;i<available.length;i++){
      const index=available[i].index,trial=[...chosen,index];
      if(deepCutSetAnswerCollisions(trial,prompts).length)continue;
      if(!deepCutDailyBalance(trial,prompts).withinCaps)continue;
      attempts++;if(attempts>250000)return null;
      const found=search(trial,i+1);if(found)return found;
    }
    return null;
  }
  const chosen=search([],0);
  if(!chosen)throw new Error(`Could not build a varied common-knowledge Deep Cut set with unique accepted answers for day ${day} from ${available.length} available prompts.`);
  return chosen;
}

for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<schedule.days;day++){
  const rnd=mulberry32(hashString(`${schedule.startDate}::deep-cut-common-knowledge::${day}`));
  const ranked=eligible.map(index=>({index,use:usage[index],last:last[index],r:rnd(),difficulty:deepCutDifficulty(prompts[index]),domain:deepCutDomain(prompts[index])}))
    .sort((a,b)=>a.use-b.use||a.last-b.last||a.r-b.r);
  const available=ranked.filter(row=>day-row.last>=REPEAT_GAP);
  let chosen=chooseSet(day,available),sig=chosen.join(':');
  if(signatures.has(sig)){
    let replaced=false;
    for(const candidate of available){
      if(chosen.includes(candidate.index))continue;
      for(let position=chosen.length-1;position>=0;position--){
        const trial=[...chosen];trial[position]=candidate.index;const trialSig=trial.join(':');
        if(new Set(trial).size!==8||signatures.has(trialSig)||deepCutSetAnswerCollisions(trial,prompts).length||!deepCutDailyBalance(trial,prompts).valid)continue;
        chosen=trial;sig=trialSig;replaced=true;break;
      }
      if(replaced)break;
    }
    if(!replaced)throw new Error(`Could not make Deep Cut day ${day} unique without violating common-knowledge, answer uniqueness, variety, or repeat rules.`);
  }
  signatures.add(sig);for(const index of chosen){usage[index]++;last[index]=day}sets.push(chosen);
}

for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<sets.length;day++){
  const balance=deepCutDailyBalance(sets[day],prompts);if(!balance.valid)throw new Error(`Unbalanced Deep Cut set on day ${day}: ${JSON.stringify(balance)}`);
  const collisions=deepCutSetAnswerCollisions(sets[day],prompts);if(collisions.length)throw new Error(`Deep Cut set ${day} contains overlapping accepted answers: ${collisions.map(c=>`${c.key} (${c.firstId}/${c.secondId})`).join(', ')}`);
  for(const index of sets[day]){const quality=deepCutPromptQuality(prompts[index]);if(!quality.eligible)throw new Error(`Weak prompt scheduled after cutover: ${prompts[index]?.id} (${quality.reasons.join(', ')})`)}
}

await fs.writeFile(generatedPath,JSON.stringify(sets,null,2)+'\n','utf8');
let moduleText=await fs.readFile(modulePath,'utf8');moduleText=replaceExport(moduleText,'DEEP_CUT_PROMPTS',prompts,'DEEP_CUT_PUZZLES');moduleText=replaceExport(moduleText,'DEEP_CUT_PUZZLES',sets,'YEAR_PACK_START');await fs.writeFile(modulePath,moduleText,'utf8');

function detail(index){return {index,id:prompts[index].id,prompt:prompts[index].prompt,canonicalAnswers:prompts[index].answers.length,source:promptSources[index],difficulty:deepCutDifficulty(prompts[index]).tier,domain:deepCutDomain(prompts[index])}}
const eligibleDetails=eligible.map(detail);
const excluded=prompts.map((prompt,index)=>({index,id:prompt.id,prompt:prompt.prompt,source:promptSources[index],...deepCutPromptQuality(prompt)})).filter(row=>!row.eligible).map(({eligible:_,...row})=>row);
const firstCuratedSet=(sets[DEEP_CUT_QUALITY_CUTOVER_DAY]||[]).map(detail),firstCuratedBalance=deepCutDailyBalance(sets[DEEP_CUT_QUALITY_CUTOVER_DAY]||[],prompts);
const report={
  cutoverDate:DEEP_CUT_QUALITY_CUTOVER_DATE,cutoverDay:DEEP_CUT_QUALITY_CUTOVER_DAY,minimumCanonicalAnswers:DEEP_CUT_MIN_ANSWERS,minimumRepeatGapDays:REPEAT_GAP,
  doctrine:'Common-knowledge prompts; difficulty comes from answer rarity; accepted answers may not overlap within a daily set.',
  dailyDifficultyRule:{minimumAccessible:DEEP_CUT_MIN_ACCESSIBLE_PER_DAY,maximumDeep:DEEP_CUT_MAX_DEEP_PER_DAY,maximumAdministrativeSubdivision:DEEP_CUT_MAX_SUBDIVISION_PER_DAY,maximumMovies:DEEP_CUT_MAX_MOVIE_PER_DAY,maximumMusic:DEEP_CUT_MAX_MUSIC_PER_DAY,maximumEntertainment:DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY,maximumAnyDomain:DEEP_CUT_MAX_DOMAIN_PER_DAY},
  basePrompts:basePrompts.length,qualitySourceFiles:qualitySources.map(source=>({name:source.name,prompts:source.prompts.length})),supplementPrompts:supplementPrompts.length,totalPrompts:prompts.length,eligiblePrompts:eligible.length,
  eligibleByDifficulty:{accessible:eligible.filter(index=>deepCutDifficulty(prompts[index]).tier==='accessible').length,standard:eligible.filter(index=>deepCutDifficulty(prompts[index]).tier==='standard').length,deep:eligible.filter(index=>deepCutDifficulty(prompts[index]).tier==='deep').length},
  excludedPrompts:excluded.length,futureDailySets:sets.length-DEEP_CUT_QUALITY_CUTOVER_DAY,uniqueDailySets:signatures.size,firstCuratedDay:{date:DEEP_CUT_QUALITY_CUTOVER_DATE,balance:firstCuratedBalance,prompts:firstCuratedSet},eligible:eligibleDetails,excluded
};
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(`Deep Cut common-knowledge curation: ${eligible.length}/${prompts.length} prompts eligible; ${sets.length-DEEP_CUT_QUALITY_CUTOVER_DAY} future daily sets rebuilt.`);
console.log(`Daily variety: 8 accessible prompts, no overlapping accepted answers; max ${DEEP_CUT_MAX_MOVIE_PER_DAY} movie, ${DEEP_CUT_MAX_MUSIC_PER_DAY} music, ${DEEP_CUT_MAX_ENTERTAINMENT_PER_DAY} entertainment total; minimum repeat gap ${REPEAT_GAP} days.`);
console.log(`First curated day ${DEEP_CUT_QUALITY_CUTOVER_DATE}: ${firstCuratedSet.map(row=>`${row.id}[${row.domain}]`).join(', ')}`);
