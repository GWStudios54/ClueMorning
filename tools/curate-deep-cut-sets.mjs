import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DEEP_CUT_MIN_ANSWERS,
  DEEP_CUT_QUALITY_CUTOVER_DAY,
  DEEP_CUT_QUALITY_CUTOVER_DATE,
  deepCutPromptQuality,
  eligibleDeepCutIndices
} from './deep-cut-quality.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const sourcePath=path.join(root,'content','source','deepcut_prompts.json');
const schedulePath=path.join(root,'content','source','schedule.json');
const generatedPath=path.join(root,'content','generated','deep_cut.json');
const reportPath=path.join(root,'content','generated','deep_cut_quality.json');
const modulePath=path.join(root,'src','puzzles.js');

function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

const prompts=JSON.parse(await fs.readFile(sourcePath,'utf8'));
const schedule=JSON.parse(await fs.readFile(schedulePath,'utf8'));
const baseline=JSON.parse(await fs.readFile(generatedPath,'utf8'));
const eligible=eligibleDeepCutIndices(prompts);

if(eligible.length<64){
  throw new Error(`Deep Cut quality gate left only ${eligible.length} eligible prompts; need at least 64 to keep an eight-day no-repeat window.`);
}
if(baseline.length!==schedule.days){
  throw new Error(`Deep Cut baseline has ${baseline.length} sets; expected ${schedule.days}.`);
}

const usage=Array(prompts.length).fill(0);
const last=Array(prompts.length).fill(-999);
const sets=[];
const signatures=new Set();

for(let day=0;day<Math.min(DEEP_CUT_QUALITY_CUTOVER_DAY,schedule.days);day++){
  const set=[...baseline[day]];
  sets.push(set);
  signatures.add(set.join(':'));
  for(const index of set){
    if(eligible.includes(index)){usage[index]++;last[index]=day;}
  }
}

for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<schedule.days;day++){
  const rnd=mulberry32(hashString(`${schedule.startDate}::deep-cut-quality::${day}`));
  const ranked=eligible.map(index=>({index,use:usage[index],last:last[index],r:rnd()}))
    .sort((a,b)=>a.use-b.use||a.last-b.last||a.r-b.r);
  const chosen=[];
  for(const row of ranked){
    if(chosen.length===8)break;
    if(day-row.last<8)continue;
    chosen.push(row.index);
  }
  if(chosen.length<8){
    throw new Error(`Could not build quality Deep Cut set for day ${day} without violating the eight-day repeat window.`);
  }
  const sig=chosen.join(':');
  if(signatures.has(sig))throw new Error(`Duplicate Deep Cut daily set on day ${day}`);
  signatures.add(sig);
  for(const index of chosen){usage[index]++;last[index]=day;}
  sets.push(chosen);
}

for(let day=DEEP_CUT_QUALITY_CUTOVER_DAY;day<sets.length;day++){
  for(const index of sets[day]){
    const quality=deepCutPromptQuality(prompts[index]);
    if(!quality.eligible)throw new Error(`Weak prompt scheduled after cutover: ${prompts[index]?.id} (${quality.reasons.join(', ')})`);
  }
}

await fs.writeFile(generatedPath,JSON.stringify(sets,null,2)+'\n','utf8');

let moduleText=await fs.readFile(modulePath,'utf8');
const startMarker='export const DEEP_CUT_PUZZLES = ';
const endMarker='\n\nexport const YEAR_PACK_START = ';
const start=moduleText.indexOf(startMarker);
const end=moduleText.indexOf(endMarker,start);
if(start<0||end<0)throw new Error('Could not locate DEEP_CUT_PUZZLES in src/puzzles.js');
moduleText=moduleText.slice(0,start)+startMarker+JSON.stringify(sets)+';'+moduleText.slice(end);
await fs.writeFile(modulePath,moduleText,'utf8');

const excluded=prompts.map((prompt,index)=>({index,id:prompt.id,prompt:prompt.prompt,...deepCutPromptQuality(prompt)}))
  .filter(row=>!row.eligible)
  .map(({eligible:_,...row})=>row);
const report={
  cutoverDate:DEEP_CUT_QUALITY_CUTOVER_DATE,
  cutoverDay:DEEP_CUT_QUALITY_CUTOVER_DAY,
  minimumCanonicalAnswers:DEEP_CUT_MIN_ANSWERS,
  totalPrompts:prompts.length,
  eligiblePrompts:eligible.length,
  excludedPrompts:excluded.length,
  excluded
};
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');

console.log(`Deep Cut quality curation: ${eligible.length}/${prompts.length} prompts eligible; ${sets.length-DEEP_CUT_QUALITY_CUTOVER_DAY} future daily sets rebuilt.`);
