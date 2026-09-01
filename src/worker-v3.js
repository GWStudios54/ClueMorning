import core from "./worker-v2.js";
import { pacificDateKey } from "./worker.js";
import { publicLastCall, checkLastCall, revealLastCall, LAST_CALL_ROUNDS } from "./last_call.js";

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
async function body(request){try{return await request.clone().json()}catch{return {}}}
function requestDate(request,b={}){const raw=String(b.date||new URL(request.url).searchParams.get('date')||pacificDateKey());return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:pacificDateKey()}

async function foundersResponse(response){
  try{const data=await response.clone().json();if(data&&data.active){data.tier="founders";data.entitlements={allPacks:true,archive:true,reserveLibrary:true,founderRewards:true};data.displayName="Founders"}return json(data,response.status)}catch{return response}
}
async function dailyResponse(response){
  try{const data=await response.clone().json(),date=data.date||pacificDateKey();delete data.lockbox;data.lastcall=publicLastCall(date);data.dailyGames=8;return json(data,response.status)}catch{return response}
}
async function healthResponse(response){
  try{const data=await response.clone().json();data.dailyGames=8;data.lastCallRounds=LAST_CALL_ROUNDS;delete data.lockbox;return json(data,response.status)}catch{return response}
}
async function injectFoundersUi(response){
  const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;let html=await response.text();
  html=html.replaceAll('including Situation and Lockbox','including Situation and Last Call').replaceAll('word, logic, deduction, and trivia','word, logic, trivia, and tactical').replaceAll('word, logic, deduction, and trivia games','word, logic, trivia, and tactical games');
  if(!html.includes("/daily-presentation-fix.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/daily-presentation-fix.css?v=2"></head>');
  if(!html.includes("/last-call.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/last-call.css?v=1"></head>');
  if(!html.includes("/presentation-v1.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/presentation-v1.css?v=1"></head>');
  if(!html.includes("/social.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/social.css?v=1"></head>');
  if(!html.includes("/founders-ui.js"))html=html.replace("</body>",'<script src="/founders-ui.js" defer></script></body>');
  if(!html.includes("/extra-games.js"))html=html.replace("</body>",'<script src="/extra-games.js?v=1" defer></script></body>');
  if(!html.includes("/word-controls.js"))html=html.replace("</body>",'<script type="module" src="/word-controls.js?v=1"></script></body>');
  if(!html.includes("/daily-presentation-fix.js"))html=html.replace("</body>",'<script src="/daily-presentation-fix.js?v=2" defer></script></body>');
  if(!html.includes("/last-call.js"))html=html.replace("</body>",'<script src="/last-call.js?v=1" defer></script></body>');
  if(!html.includes("/presentation-v1.js"))html=html.replace("</body>",'<script src="/presentation-v1.js?v=1" defer></script></body>');
  if(!html.includes("/social.js"))html=html.replace("</body>",'<script src="/social.js?v=1" defer></script></body>');
  const headers=new Headers(response.headers);headers.set("Cache-Control","no-store, max-age=0, must-revalidate");headers.delete("content-length");return new Response(html,{status:response.status,statusText:response.statusText,headers})
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="POST"&&(path==="/api/unlimited/status"||path==="/api/unlimited/claim"))return foundersResponse(await core.fetch(request,env));
    if(request.method==="POST"&&path==="/api/lastcall/check"){const b=await body(request),date=requestDate(request,b),result=checkLastCall(date,b.optionId);if(!result)return json({error:'That choice is not part of today’s Last Call.'},400);return json({ok:true,...result})}
    if(request.method==="POST"&&path==="/api/lastcall/reveal"){const b=await body(request),date=requestDate(request,b);if(b.finished!==true)return json({error:'Finish or bank the round before revealing the board.'},403);return json({ok:true,options:revealLastCall(date)})}
    if(path==="/api/lockbox/check")return json({error:'Lockbox has been retired.'},410);
    const response=await core.fetch(request,env);
    if(request.method==="GET"&&path==="/api/daily")return dailyResponse(response);
    if(request.method==="GET"&&path==="/api/health")return healthResponse(response);
    if(request.method==="GET"&&(path==="/"||path==="/index.html"))return injectFoundersUi(response);
    return response;
  }
};
