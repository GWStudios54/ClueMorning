import core,{pacificDateKey} from "./worker.js";
import { deepCutUnlimitedSession, auditDeepCutUnlimitedCatalog } from "./deep_cut_unlimited.js";

const DEEP_CUT_COUNT=5000;
const DEEP_CUT_SECONDS=25;
const DEEP_CUT_ROUNDS=8;
const TILE_VALUES={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,"?":0};
const SITUATIONS=[
  {id:"stone-star",title:"Crossroads",words:[['STONE',4,2,'H'],['STAR',4,2,'V']],rack:"ELAND?S"},
  {id:"light-lion",title:"Open Lanes",words:[['LIGHT',4,2,'H'],['LION',4,2,'V']],rack:"STARED?"},
  {id:"cloud-cold",title:"Weather Front",words:[['CLOUD',4,2,'H'],['COLD',4,2,'V']],rack:"STORMY?"},
  {id:"train-tree",title:"Junction",words:[['TRAIN',4,2,'H'],['TREE',4,2,'V']],rack:"SALEDR?"},
  {id:"house-hero",title:"Home Field",words:[['HOUSE',4,2,'H'],['HERO',4,2,'V']],rack:"STARED?"},
  {id:"water-warm",title:"High Water",words:[['WATER',4,2,'H'],['WARM',4,2,'V']],rack:"STONED?"},
  {id:"brave-bird",title:"Wing Play",words:[['BRAVE',4,2,'H'],['BIRD',4,2,'V']],rack:"STONER?"},
  {id:"dream-drop",title:"Late Position",words:[['DREAM',4,2,'H'],['DROP',4,2,'V']],rack:"STALER?"}
];
let LOCK_CODES=null;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function normalizeAnswer(v){return String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function scoreAnswer(answer,prompt){
  const key=normalizeAnswer(answer);if(!key)return {accepted:false,score:0};let index=-1,canonical="";
  for(let i=0;i<prompt.answers.length;i++){const a=prompt.answers[i],variants=[a.name,...(Array.isArray(a.aliases)?a.aliases:[])];if(variants.some(v=>normalizeAnswer(v)===key)){index=i;canonical=a.name;break}}
  if(index<0)return {accepted:false,score:0};const rarity=prompt.answers.length<=1?1:index/(prompt.answers.length-1),score=Math.max(30,Math.min(100,30+Math.round(70*Math.pow(rarity,0.85)))),tier=score>=85?"RARE":score>=60?"UNCOMMON":"COMMON";return {accepted:true,canonical,score,tier}
}
function slotNumber(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>=0?n%DEEP_CUT_COUNT:null}
async function body(request){try{return await request.clone().json()}catch{return {}}}
async function accessState(request,env,code){const url=new URL("/api/unlimited/status",request.url),probe=new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code})}),response=await core.fetch(probe,env);try{return await response.json()}catch{return {active:false}}}
async function handleDeepCut(request,env,path,b){
  const access=await accessState(request,env,b.code);if(!access.active)return json({ok:false,active:false,error:"Unlimited access is required."},403);const slot=slotNumber(b.slot);if(slot===null)return json({error:"Invalid Unlimited puzzle."},400);const prompts=deepCutUnlimitedSession(slot,DEEP_CUT_ROUNDS);
  if(path==="/api/unlimited/new")return json({ok:true,active:true,game:"deepcut",slot,count:DEEP_CUT_COUNT,counts:access.counts||{},puzzle:{deepcut:{prompts:prompts.map(p=>({id:p.id,prompt:p.prompt})),seconds:DEEP_CUT_SECONDS,rounds:DEEP_CUT_ROUNDS,maxScore:800}}});const prompt=prompts.find(p=>p.id===String(b.promptId||""));if(!prompt)return json({error:"That prompt is not part of this Unlimited set."},400);return json({ok:true,...scoreAnswer(b.answer,prompt)})
}

function dailyDate(request){const raw=new URL(request.url).searchParams.get('date')||pacificDateKey();return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:pacificDateKey()}
function situationBonuses(size=9){
  const map={},put=(kind,pts)=>pts.forEach(([r,c])=>{map[r*size+c]=kind});
  put('tw',[[0,0],[0,4],[0,8],[4,0],[4,8],[8,0],[8,4],[8,8]]);put('dw',[[1,1],[1,7],[2,2],[2,6],[6,2],[6,6],[7,1],[7,7]]);put('tl',[[1,4],[4,1],[4,7],[7,4]]);put('dl',[[0,2],[0,6],[2,0],[2,4],[2,8],[4,2],[4,6],[6,0],[6,4],[6,8],[8,2],[8,6]]);return map
}
function situationForDate(date){
  const size=9,t=SITUATIONS[hashString(`situation:${date}`)%SITUATIONS.length],cells=new Map();
  for(const [word,row,col,dir] of t.words){for(let p=0;p<word.length;p++){const r=row+(dir==='V'?p:0),c=col+(dir==='H'?p:0),i=r*size+c,ch=word[p],prev=cells.get(i);if(prev&&prev!==ch)throw new Error('Situation template conflict.');cells.set(i,ch)}}
  const board=[...cells].sort((a,b)=>a[0]-b[0]).map(([index,letter])=>({index,letter,value:TILE_VALUES[letter]||0}));const rack=[...t.rack].map(letter=>({letter,value:TILE_VALUES[letter]||0,blank:letter==='?'}));return {id:t.id,title:t.title,size,maxMoves:3,board,rack,bonuses:situationBonuses(size)}
}
function lockCodes(){if(LOCK_CODES)return LOCK_CODES;const out=[];for(let a=0;a<10;a++)for(let b=0;b<10;b++)if(b!==a)for(let c=0;c<10;c++)if(c!==a&&c!==b)for(let d=0;d<10;d++)if(d!==a&&d!==b&&d!==c)out.push(`${a}${b}${c}${d}`);LOCK_CODES=out;return out}
function lockFeedback(code,guess){let exact=0,common=0;for(let i=0;i<4;i++){if(code[i]===guess[i])exact++;if(code.includes(guess[i]))common++}return {exact,misplaced:common-exact}}
function sameFeedback(a,b){return a.exact===b.exact&&a.misplaced===b.misplaced}
function lockboxForDate(date){
  const all=lockCodes(),code=all[hashString(`lockbox:${date}`)%all.length],fixed=['0123','4567','8901','2345','6789','1357','2468','9074','3815','6204'],clues=[];let candidates=[...all];
  const add=guess=>{if(guess===code||new Set(guess).size!==4)return false;const f=lockFeedback(code,guess),next=candidates.filter(c=>sameFeedback(lockFeedback(c,guess),f));if(next.length===candidates.length&&clues.length>=5)return false;clues.push({guess,...f});candidates=next;return true};
  for(const g of fixed){if(clues.length>=5&&candidates.length===1)break;add(g)}
  let pos=hashString(`lockbox-extra:${date}`)%all.length,guard=0;while(candidates.length>1&&clues.length<8&&guard++<all.length){const g=all[pos];pos=(pos+137)%all.length;add(g)}
  if(candidates.length>1){for(const g of [...candidates]){if(candidates.length===1||clues.length>=10)break;add(g)}}
  return {code,public:{digits:4,uniqueDigits:true,maxAttempts:3,clues}}
}
async function dailyExpanded(request,env){const response=await core.fetch(request,env);if(!response.ok)return response;try{const data=await response.clone().json(),date=data.date||dailyDate(request),lock=lockboxForDate(date);data.situation=situationForDate(date);data.lockbox=lock.public;data.dailyGames=8;return json(data,response.status)}catch{return response}}
async function checkLockbox(request){const b=await body(request),date=dailyDate(request),guess=String(b.guess||'').replace(/\D/g,'').slice(0,4),attempt=Math.max(1,Math.min(3,Number(b.attempt)||1));if(guess.length!==4||new Set(guess).size!==4)return json({error:'Enter four different digits.'},400);const {code}=lockboxForDate(date),solved=guess===code,score=solved?({1:1000,2:700,3:450}[attempt]||450):0;return json({ok:true,solved,score,...(!solved&&attempt>=3?{answer:code}:{})})}
async function injectDailyAssets(request,env){
  const response=await core.fetch(request,env);if(!response.ok)return response;let text=await response.text();if(!text.includes('/daily-expansion.js')){text=text.replace('</head>','  <link rel="stylesheet" href="/daily-expansion.css?v=1">\n</head>').replace('</body>','<script src="/daily-expansion.js?v=1" defer></script>\n</body>')}
  text=text.replace('Play six free daily word, logic, and trivia games: Letter Grid, Four Groups, Letter Trail, Triple Link, Word Steps, and Deep Cut. A fresh set every morning.','Play eight free daily word, logic, deduction, and trivia games, including Situation and Lockbox. A fresh set every morning.').replaceAll('Six fresh word, logic, and trivia games every morning','Eight fresh word, logic, deduction, and trivia games every morning').replace('A free collection of six daily word, logic, and trivia games with a fresh set every morning.','A free collection of eight daily word, logic, deduction, and trivia games with a fresh set every morning.');
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store, max-age=0, must-revalidate');return new Response(text,{status:response.status,statusText:response.statusText,headers})
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="POST"&&path==="/api/unlimited/deepcut/check")return handleDeepCut(request,env,path,await body(request));
    if(request.method==="POST"&&path==="/api/unlimited/new"){const b=await body(request);if(String(b.game||"").toLowerCase()==="deepcut")return handleDeepCut(request,env,path,b)}
    if(request.method==="GET"&&path==="/api/daily")return dailyExpanded(request,env);
    if(request.method==="POST"&&path==="/api/lockbox/check")return checkLockbox(request);
    if(request.method==="GET"&&path==="/api/health"){
      const response=await core.fetch(request,env);try{const data=await response.clone().json(),audit=auditDeepCutUnlimitedCatalog();data.unlimitedDeepCutPrompts=audit.prompts;data.unlimitedDeepCutDomains=audit.domains;data.unlimitedDeepCutAudit=audit.ok;data.dailyGames=8;data.situationTemplates=SITUATIONS.length;data.lockbox='unique-solution';return json(data,response.status)}catch{}
    }
    if(request.method==="GET"&&(path==="/"||path==="/index.html"))return injectDailyAssets(request,env);
    return core.fetch(request,env);
  }
};