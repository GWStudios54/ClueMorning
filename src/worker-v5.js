// Clue Morning routing worker. Keep owner controls isolated and deploy-safe.
import core from './worker-v4.js';
import {runContentAiSchedule} from './content-ai.js';

const PLAY_TARGETS={
  grid:'letter',letter:'letter',groups:'groups',trail:'trail',link:'link',steps:'steps',
  deepcut:'deepcut','deep-cut':'deepcut',lastcall:'lastcall','last-call':'lastcall'
};
const GAME_PATHS={
  letter:'/play/letter-grid/',
  groups:'/play/four-groups/',
  trail:'/play/letter-trail/',
  link:'/play/triple-link/',
  steps:'/play/word-steps/',
  deepcut:'/play/deep-cut/',
  lastcall:'/play/last-call/'
};
const GAME_PAGE_ROUTES=Object.fromEntries(Object.entries(GAME_PATHS).flatMap(([game,path])=>[[path,game],[path.replace(/\/$/,''),game]]));
const GAME_NAMES={letter:'Letter Grid',groups:'Four Groups',trail:'Letter Trail',link:'Triple Link',steps:'Word Steps',deepcut:'Deep Cut',lastcall:'Last Call'};
const GAME_SKINS={
  letter:{css:'/letter-typesetter.css?v=5',js:'/letter-typesetter.js?v=6'},
  groups:{css:'/four-groups-case-file.css?v=2',js:'/four-groups-case-file.js?v=2'},
  trail:{css:'/trail-cartographer.css?v=2',js:'/trail-cartographer.js?v=2'}
};
const OWNER_ADMIN_COOKIE='cm_owner_admin';
const OWNER_ADMIN_HASH='6616d27148a3b24037d545e8befbcd0ce77a1ba8b1eb3abbfd0aa690e1da371c';
const DAILY_COMPARE_COLUMNS={grid:'grid_score',groups:'groups_score',trail:'trail_score',link:'link_score',steps:'steps_score',deepcut:'deepcut_score'};

function json(data,status=200,extraHeaders={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extraHeaders}});
}
async function requestBody(request){try{return await request.clone().json()}catch{return {}}}
function pacificDateKey(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=t=>parts.find(p=>p.type===t)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function safePlayerId(value){const id=String(value||'');return /^[A-Za-z0-9-]{8,64}$/.test(id)?id:''}
function safeScore(value){const score=Number(value);return Number.isFinite(score)&&score>=0&&score<=1000000?Math.round(score):null}
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

async function competitionApi(request,env){
  if(request.method!=='GET')return json({error:'Method not allowed.'},405);
  if(!env.DB)return json({enabled:false,reason:'Leaderboard database is unavailable.'},503);
  const url=new URL(request.url),board=String(url.searchParams.get('board')||'').toLowerCase();
  const rawDate=String(url.searchParams.get('date')||pacificDateKey()),date=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate:pacificDateKey();
  const playerId=safePlayerId(url.searchParams.get('playerId')),score=safeScore(url.searchParams.get('score'));
  if(!playerId)return json({error:'Invalid player ID.'},400);
  if(score===null)return json({error:'Invalid score.'},400);
  if(board!=='today'&&board!=='lastcall'&&!DAILY_COMPARE_COLUMNS[board])return json({error:'Unknown daily leaderboard.'},400);
  try{
    let row;
    if(board==='today'){
      row=await env.DB.prepare(`WITH players AS (
          SELECT player_id FROM leaderboard WHERE date=?
          UNION
          SELECT player_id FROM leaderboard_game_scores WHERE date=? AND game IN ('grid','groups','trail','link','steps','deepcut','lastcall')
        ), legacy AS (
          SELECT * FROM leaderboard WHERE date=?
        ), games AS (
          SELECT player_id,
            MAX(CASE WHEN game='grid' THEN score END) AS grid_score,
            MAX(CASE WHEN game='groups' THEN score END) AS groups_score,
            MAX(CASE WHEN game='trail' THEN score END) AS trail_score,
            MAX(CASE WHEN game='link' THEN score END) AS link_score,
            MAX(CASE WHEN game='steps' THEN score END) AS steps_score,
            MAX(CASE WHEN game='deepcut' THEN score END) AS deepcut_score,
            MAX(CASE WHEN game='lastcall' THEN score END) AS lastcall_score
          FROM leaderboard_game_scores WHERE date=? AND game IN ('grid','groups','trail','link','steps','deepcut','lastcall') GROUP BY player_id
        ), daily AS (
          SELECT p.player_id,
            COALESCE(g.grid_score,l.grid_score,0)+COALESCE(g.groups_score,l.groups_score,0)+COALESCE(g.trail_score,l.trail_score,0)+
            COALESCE(g.link_score,l.link_score,0)+COALESCE(g.steps_score,l.steps_score,0)+COALESCE(g.deepcut_score,l.deepcut_score,0)+COALESCE(g.lastcall_score,0) AS score
          FROM players p LEFT JOIN legacy l ON l.player_id=p.player_id LEFT JOIN games g ON g.player_id=p.player_id
        )
        SELECT COUNT(*) AS opponents,
          COALESCE(SUM(CASE WHEN score>? THEN 1 ELSE 0 END),0) AS better,
          COALESCE(SUM(CASE WHEN score<? THEN 1 ELSE 0 END),0) AS lower,
          COALESCE(SUM(CASE WHEN score=? THEN 1 ELSE 0 END),0) AS tied
        FROM daily WHERE player_id<>?`).bind(date,date,date,date,score,score,score,playerId).first();
    }else if(board==='lastcall'){
      row=await env.DB.prepare(`SELECT COUNT(*) AS opponents,
          COALESCE(SUM(CASE WHEN score>? THEN 1 ELSE 0 END),0) AS better,
          COALESCE(SUM(CASE WHEN score<? THEN 1 ELSE 0 END),0) AS lower,
          COALESCE(SUM(CASE WHEN score=? THEN 1 ELSE 0 END),0) AS tied
        FROM leaderboard_game_scores WHERE date=? AND game='lastcall' AND player_id<>?`).bind(score,score,score,date,playerId).first();
    }else{
      const column=DAILY_COMPARE_COLUMNS[board];
      row=await env.DB.prepare(`WITH scores AS (
          SELECT player_id,score FROM leaderboard_game_scores WHERE date=? AND game=?
          UNION ALL
          SELECT player_id,${column} AS score FROM leaderboard WHERE date=?
        ), ranked AS (
          SELECT player_id,MAX(score) AS score FROM scores GROUP BY player_id
        )
        SELECT COUNT(*) AS opponents,
          COALESCE(SUM(CASE WHEN score>? THEN 1 ELSE 0 END),0) AS better,
          COALESCE(SUM(CASE WHEN score<? THEN 1 ELSE 0 END),0) AS lower,
          COALESCE(SUM(CASE WHEN score=? THEN 1 ELSE 0 END),0) AS tied
        FROM ranked WHERE player_id<>?`).bind(date,board,date,score,score,score,playerId).first();
    }
    const opponents=Number(row?.opponents||0),better=Number(row?.better||0),lower=Number(row?.lower||0),otherTies=Number(row?.tied||0);
    return json({enabled:true,board,date,score,rank:better+1,total:opponents+1,opponents,tied:otherTies+1,beatPercent:opponents?Math.round(lower*100/opponents):null});
  }catch(error){
    console.error('Leaderboard comparison failed',error);
    return json({enabled:false,reason:'Comparison is unavailable right now.'},503);
  }
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
  const requested=String(url.searchParams.get('play')||'').toLowerCase();
  const game=PLAY_TARGETS[requested];
  const target=new URL(game?GAME_PATHS[game]:'/',url);
  target.search='';
  return Response.redirect(target.toString(),301);
}

function stripHomepageRuntime(html,game){
  html=html.replace(/\s*<script[^>]+(?:founders-ui|extra-games|word-controls|daily-presentation-fix|daily-run-v2|presentation-v1|social|leaderboards-v2|performance-bridge|retention-hooks|competition|homepage-guard|pwa)\.js[^>]*><\/script>/gi,'');
  html=html.replace(/\s*<link[^>]+(?:daily-presentation-fix|presentation-v1|social|leaderboards-v2|retention-hooks)\.css[^>]*>/gi,'');
  if(game!=='lastcall'){
    html=html.replace(/\s*<script[^>]+last-call\.js[^>]*><\/script>/gi,'');
    html=html.replace(/\s*<link[^>]+last-call\.css[^>]*>/gi,'');
  }
  return html;
}

function stripUnrelatedGameMedia(html,game){
  if(game!=='steps')html=html.replaceAll('src="/word-steps-rooftops/pc.webp"','data-deferred-src="/word-steps-rooftops/pc.webp"');
  if(game!=='deepcut')html=html.replaceAll('src="/deepcut-archive/','data-deferred-src="/deepcut-archive/');
  return html;
}

async function dedicatedGamePage(request,env,ctx,game){
  const url=new URL(request.url);
  const shellUrl=new URL('/index.html?standalone-game='+encodeURIComponent(game),url);
  const shellRequest=new Request(shellUrl,{method:'GET',headers:request.headers});
  const response=await core.fetch(shellRequest,env,ctx);
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;

  let html=stripUnrelatedGameMedia(stripHomepageRuntime(await response.text(),game),game);
  const path=GAME_PATHS[game];
  const name=GAME_NAMES[game]||'Clue Morning';
  html=html.replace(/<html([^>]*)>/i,(match,attrs)=>'<html'+attrs+' data-game-page="'+game+'">');
  // index.html is authored at the site root. Dedicated /play/* documents need
  // the same base so relative styles, icons, manifest assets and links do not
  // resolve under /play/<game>/.
  if(!/<base\s/i.test(html))html=html.replace(/<head([^>]*)>/i,'<head$1>\n<base href="/">');
  html=html.replace(/<title>.*?<\/title>/is,'<title>'+name+' — Clue Morning</title>');
  html=html.replace(/<meta\s+name=["']robots["'][^>]*>/i,'<meta name="robots" content="noindex,follow">');
  html=html.replace(/<link\s+rel=["']canonical["'][^>]*>/i,'<link rel="canonical" href="https://cluemorning.com'+path+'">');
  if(!html.includes('/game-page.css'))html=html.replace('</head>','<link rel="stylesheet" href="/game-page.css?v=1">\n</head>');
  const skin=GAME_SKINS[game];
  if(skin?.css&&!html.includes(skin.css.split('?')[0]))html=html.replace('</head>','<link rel="stylesheet" href="'+skin.css+'">\n</head>');
  html=html.replace(/<script\s+src=["']\/?app\.js["'][^>]*><\/script>/i,'<script src="/app-core.js?v=dedicated-7"></script>');
  if(skin?.js&&!html.includes(skin.js.split('?')[0]))html=html.replace('</body>','<script src="'+skin.js+'"></script>\n</body>');
  if(game==='lastcall'){
    if(!html.includes('/last-call.css'))html=html.replace('</head>','<link rel="stylesheet" href="/last-call.css?v=1">\n</head>');
    if(!html.includes('/last-call.js'))html=html.replace('</body>','<script src="/last-call.js?v=3" defer></script>\n</body>');
  }
  html=html.replace('</body>','<script src="/game-page.js?v=2"></script>\n</body>');

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, max-age=0, must-revalidate');
  headers.delete('content-length');headers.delete('etag');
  return new Response(html,{status:200,headers});
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
  if(path==='/'||path==='/index.html'){
    // worker-v4 still injects the old duplicate run controller; v5 owns the lean runtime now.
    html=html.replace(/\s*<script[^>]+daily-run-v2\.js[^>]*><\/script>/gi,'');
    html=installPerformanceBridge(html);
    if(!html.includes('/retention-hooks.css')){
      html=html.replace('</head>','<link rel="stylesheet" href="/retention-hooks.css?v=1">\n</head>');
    }
    if(!html.includes('/deep-link.js')){
      html=html.replace('</body>','<script src="/deep-link.js?v=4" defer></script>\n</body>');
    }
    if(!html.includes('/retention-hooks.js')){
      html=html.replace('</body>','<script src="/retention-hooks.js?v=3" defer></script>\n</body>');
    }
    if(!html.includes('/competition.js')){
      html=html.replace('</body>','<script src="/competition.js?v=1" defer></script>\n</body>');
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
    if(path==='/api/leaderboard/compare')return competitionApi(request,env);
    if(path.startsWith('/api/admin/'))return adminApi(request,env,path);
    if(request.method==='GET'&&GAME_PAGE_ROUTES[path])return dedicatedGamePage(request,env,ctx,GAME_PAGE_ROUTES[path]);
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
