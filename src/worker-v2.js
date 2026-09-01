import core from "./worker.js";
import { deepCutUnlimitedSession, auditDeepCutUnlimitedCatalog } from "./deep_cut_unlimited.js";

const DEEP_CUT_COUNT=5000;
const DEEP_CUT_SECONDS=25;
const DEEP_CUT_ROUNDS=8;

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}
function normalizeAnswer(v){return String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function scoreAnswer(answer,prompt){
  const key=normalizeAnswer(answer);if(!key)return {accepted:false,score:0};
  let index=-1,canonical="";
  for(let i=0;i<prompt.answers.length;i++){
    const a=prompt.answers[i],variants=[a.name,...(Array.isArray(a.aliases)?a.aliases:[])];
    if(variants.some(v=>normalizeAnswer(v)===key)){index=i;canonical=a.name;break}
  }
  if(index<0)return {accepted:false,score:0};
  const rarity=prompt.answers.length<=1?1:index/(prompt.answers.length-1);
  const score=Math.max(30,Math.min(100,30+Math.round(70*Math.pow(rarity,0.85))));
  const tier=score>=85?"RARE":score>=60?"UNCOMMON":"COMMON";
  return {accepted:true,canonical,score,tier};
}
function slotNumber(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>=0?n%DEEP_CUT_COUNT:null}
async function body(request){try{return await request.clone().json()}catch{return {}}}
async function accessState(request,env,code){
  const url=new URL("/api/unlimited/status",request.url);
  const probe=new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code})});
  const response=await core.fetch(probe,env);
  try{return await response.json()}catch{return {active:false}}
}
async function handleDeepCut(request,env,path,b){
  const access=await accessState(request,env,b.code);
  if(!access.active)return json({ok:false,active:false,error:"Unlimited access is required."},403);
  const slot=slotNumber(b.slot);if(slot===null)return json({error:"Invalid Unlimited puzzle."},400);
  const prompts=deepCutUnlimitedSession(slot,DEEP_CUT_ROUNDS);
  if(path==="/api/unlimited/new")return json({ok:true,active:true,game:"deepcut",slot,count:DEEP_CUT_COUNT,counts:access.counts||{},puzzle:{deepcut:{prompts:prompts.map(p=>({id:p.id,prompt:p.prompt})),seconds:DEEP_CUT_SECONDS,rounds:DEEP_CUT_ROUNDS,maxScore:800}}});
  const prompt=prompts.find(p=>p.id===String(b.promptId||""));
  if(!prompt)return json({error:"That prompt is not part of this Unlimited set."},400);
  return json({ok:true,...scoreAnswer(b.answer,prompt)});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="POST"&&path==="/api/unlimited/deepcut/check")return handleDeepCut(request,env,path,await body(request));
    if(request.method==="POST"&&path==="/api/unlimited/new"){
      const b=await body(request);
      if(String(b.game||"").toLowerCase()==="deepcut")return handleDeepCut(request,env,path,b);
    }
    if(request.method==="GET"&&path==="/api/health"){
      const response=await core.fetch(request,env);
      try{
        const data=await response.clone().json(),audit=auditDeepCutUnlimitedCatalog();
        data.unlimitedDeepCutPrompts=audit.prompts;
        data.unlimitedDeepCutDomains=audit.domains;
        data.unlimitedDeepCutAudit=audit.ok;
        return json(data,response.status);
      }catch{}
    }
    return core.fetch(request,env);
  }
};
