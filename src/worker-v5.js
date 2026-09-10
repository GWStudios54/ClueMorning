// Clue Morning routing worker. Keep owner controls isolated and deploy-safe.
import core from './worker-v4.js';
import {runContentAiSchedule} from './content-ai.js';

const PLAY_TARGETS={
  grid:'letter',letter:'letter',groups:'groups',trail:'trail',link:'link',steps:'steps',
  deepcut:'deepcut','deep-cut':'deepcut',lastcall:'lastcall','last-call':'lastcall'
};
const OWNER_ADMIN_COOKIE='cm_owner_admin';
const OWNER_ADMIN_HASH='6616d27148a3b24037d545e8befbcd0ce77a1ba8b1eb3abbfd0aa690e1da371c';

function json(data,status=200,extraHeaders={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extraHeaders}});
}
async function requestBody(request){try{return await request.clone().json()}catch{return {}}}
function pacificDateKey(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=t=>parts.find(p=>p.type===t)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function normalizeAdminCode(value){return String(value||'').trim().toUpperCase().replace(/\s+/g,'')}
async function sha256Hex(value){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function validOwnerAdminCode(value){
  const code=normalizeAdminCode(value);
  if(!/^CMA-[A-Z]-[A-F0-9]{24}$/.test(code))return false;
  return (await sha256Hex(code))===OWNER_ADMIN_HASH;
}
function cookieValue(request,name){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim());
  }
  return '';
}
async function ownerAdminActive(request){return validOwnerAdminCode(cookieValue(request,OWNER_ADMIN_COOKIE))}
function ownerAdminCookie(code){
  return `${OWNER_ADMIN_COOKIE}=${encodeURIComponent(normalizeAdminCode(code))}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`;
}
async function adminApi(request,env,path){
  if(path==='/api/admin/claim'){
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    const b=await requestBody(request),code=normalizeAdminCode(b.code);
    if(!await validOwnerAdminCode(code))return json({ok:false,active:false,error:'That owner-admin code is not valid.'},403);
    return json({ok:true,active:true,role:'owner-admin'},200,{'set-cookie':ownerAdminCookie(code)});
  }
  if(path==='/api/admin/status'){
    if(request.method!=='GET')return json({error:'Method not allowed.'},405);
    const active=await ownerAdminActive(request);
    return json({ok:true,active,role:active?'owner-admin':'none'});
  }
  if(path==='/api/admin/deepcut/reset'){
    if(request.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!await ownerAdminActive(request))return json({ok:false,error:'Owner-admin access is required.'},403);
    const b=await requestBody(request),playerId=String(b.playerId||'');
    if(!/^[A-Za-z0-9-]{8,64}$/.test(playerId))return json({error:'Invalid player ID.'},400);
    if(!env.DB)return json({error:'Leaderboard database is unavailable.'},503);
    const date=pacificDateKey();
    let changed=0;
    try{
      const result=await env.DB.prepare("DELETE FROM leaderboard_game_scores WHERE date=? AND game='deepcut' AND player_id=?").bind(date,playerId).run();
      changed+=Number(result?.meta?.changes||0);
    }catch(error){console.error('Owner-admin Deep Cut game-score reset failed',error);return json({error:'Deep Cut reset could not update the leaderboard.'},503)}
    try{
      const result=await env.DB.prepare("UPDATE leaderboard SET score=CASE WHEN score>=deepcut_score THEN score-deepcut_score ELSE 0 END,deepcut_score=0,updated_at=CURRENT_TIMESTAMP WHERE date=? AND player_id=?").bind(date,playerId).run();
      changed+=Number(result?.meta?.changes||0);
    }catch(error){console.warn('Legacy Deep Cut leaderboard reset skipped',error)}
    return json({ok:true,reset:true,date,game:'deepcut',playerId,changed});
  }
  return json({error:'Not found.'},404);
}

function legacyPlayRedirect(url){
  const raw=String(url.searchParams.get('play')||'').toLowerCase();
  const play=PLAY_TARGETS[raw]||'';
  const target=new URL('/',url);
  target.search='';
  if(play)target.hash=`play=${play}`;
  return Response.redirect(target.toString(),301);
}

function installPerformanceBridge(html){
  if(html.includes('/performance-bridge.js'))return html;
  const bridge='<script src="/performance-bridge.js?v=1"></script>\n';
  const appScript=/<script\s+src=["']\/?app\.js["'][^>]*><\/script>/i;
  if(appScript.test(html))return html.replace(appScript,match=>bridge+match);
  return html.replace('</body>',bridge+'</body>');
}

async function polishDeepLinks(response,path){
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replaceAll('/?play=','/#play=');
  if(path==='/games/last-call/')html=html.replace('href="/">Play today’s Last Call','href="/#play=lastcall">Play today’s Last Call');
  if(path==='/'||path==='/index.html'){
    // worker-v4 still injects the old duplicate run controller; v5 owns the lean runtime now.
    html=html.replace(/\s*<script[^>]+daily-run-v2\.js[^>]*><\/script>/gi,'');
    html=installPerformanceBridge(html);
    if(!html.includes('/retention-hooks.css')){
      html=html.replace('</head>','<link rel="stylesheet" href="/retention-hooks.css?v=1">\n</head>');
    }
    if(!html.includes('/deep-link.js')){
      html=html.replace('</body>','<script src="/deep-link.js?v=1" defer></script>\n</body>');
    }
    if(!html.includes('/retention-hooks.js')){
      html=html.replace('</body>','<script src="/retention-hooks.js?v=2" defer></script>\n</body>');
    }
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(path.startsWith('/api/admin/'))return adminApi(request,env,path);
    if(request.method==='GET'&&(path==='/'||path==='/index.html')&&url.searchParams.has('play'))return legacyPlayRedirect(url);
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET')return polishDeepLinks(response,path);
    return response;
  },
  async scheduled(controller,env,ctx){
    try{if(core.scheduled)await core.scheduled(controller,env,ctx)}catch(error){console.error('Core scheduled task failed',error)}
    const scheduledAt=Number(controller?.scheduledTime)||Date.now();
    ctx.waitUntil(runContentAiSchedule(env,new Date(scheduledAt)).then(result=>{
      if(result?.ran)console.log('Workers AI content batch',JSON.stringify(result));
    }).catch(error=>console.error('Workers AI scheduled content task failed',error)));
  }
};
