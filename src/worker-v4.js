import core from './worker-v3.js';
import {DEEP_CUT_PROMPTS} from './puzzles.js';
import {handlePushRequest,runPushSchedule} from './push.js';

const DAILY_BOARDS=new Set(['grid','groups','trail','link','steps','deepcut','lastcall']);
const RECORD_BOARDS=new Set(['all-seven','pangram','tileworks']);
const LEGACY_COLUMN={grid:'grid_score',groups:'groups_score',trail:'trail_score',link:'link_score',steps:'steps_score',deepcut:'deepcut_score'};
let leaderboardReady=false;

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
async function body(request){try{return await request.clone().json()}catch{return {}}}
function pacificDateKey(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=t=>parts.find(p=>p.type===t)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function requestedDate(url){const raw=String(url.searchParams.get('date')||pacificDateKey());return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:pacificDateKey()}

function promptRecap(id){
  const prompt=DEEP_CUT_PROMPTS.find(row=>row.id===id);
  if(!prompt||!Array.isArray(prompt.answers)||!prompt.answers.length)return null;
  return {id:prompt.id,prompt:prompt.prompt,mostCommon:prompt.answers[0]?.name||'',rarest:prompt.answers.at(-1)?.name||''};
}

async function ensureLeaderboard(env){
  if(!env.DB)return false;if(leaderboardReady)return true;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard (
    date TEXT NOT NULL,player_id TEXT NOT NULL,display_name TEXT NOT NULL,score INTEGER NOT NULL,
    grid_score INTEGER NOT NULL DEFAULT 0,groups_score INTEGER NOT NULL DEFAULT 0,trail_score INTEGER NOT NULL DEFAULT 0,
    link_score INTEGER NOT NULL DEFAULT 0,steps_score INTEGER NOT NULL DEFAULT 0,lineup_score INTEGER NOT NULL DEFAULT 0,
    deepcut_score INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(date,player_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard_game_scores (
    date TEXT NOT NULL,game TEXT NOT NULL,player_id TEXT NOT NULL,display_name TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(date,game,player_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard_records (
    game TEXT NOT NULL,player_id TEXT NOT NULL,display_name TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(game,player_id)
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_lb_game_date_score ON leaderboard_game_scores(date,game,score DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_lb_records_score ON leaderboard_records(game,score DESC)').run();
  leaderboardReady=true;return true;
}

async function todayRows(env,date){
  const q=await env.DB.prepare(`WITH players AS (
      SELECT player_id FROM leaderboard WHERE date=?
      UNION
      SELECT player_id FROM leaderboard_game_scores WHERE date=? AND game IN ('grid','groups','trail','link','steps','deepcut','lastcall')
    ), legacy AS (
      SELECT * FROM leaderboard WHERE date=?
    ), games AS (
      SELECT player_id,MAX(display_name) AS display_name,
        MAX(CASE WHEN game='grid' THEN score END) AS grid_score,
        MAX(CASE WHEN game='groups' THEN score END) AS groups_score,
        MAX(CASE WHEN game='trail' THEN score END) AS trail_score,
        MAX(CASE WHEN game='link' THEN score END) AS link_score,
        MAX(CASE WHEN game='steps' THEN score END) AS steps_score,
        MAX(CASE WHEN game='deepcut' THEN score END) AS deepcut_score,
        MAX(CASE WHEN game='lastcall' THEN score END) AS lastcall_score,
        MIN(updated_at) AS first_post
      FROM leaderboard_game_scores WHERE date=? AND game IN ('grid','groups','trail','link','steps','deepcut','lastcall') GROUP BY player_id
    )
    SELECT p.player_id,COALESCE(g.display_name,l.display_name,'Player') AS display_name,
      COALESCE(g.grid_score,l.grid_score,0) AS grid_score,
      COALESCE(g.groups_score,l.groups_score,0) AS groups_score,
      COALESCE(g.trail_score,l.trail_score,0) AS trail_score,
      COALESCE(g.link_score,l.link_score,0) AS link_score,
      COALESCE(g.steps_score,l.steps_score,0) AS steps_score,
      COALESCE(g.deepcut_score,l.deepcut_score,0) AS deepcut_score,
      COALESCE(g.lastcall_score,0) AS lastcall_score,
      COALESCE(g.grid_score,l.grid_score,0)+COALESCE(g.groups_score,l.groups_score,0)+COALESCE(g.trail_score,l.trail_score,0)+
      COALESCE(g.link_score,l.link_score,0)+COALESCE(g.steps_score,l.steps_score,0)+COALESCE(g.deepcut_score,l.deepcut_score,0)+COALESCE(g.lastcall_score,0) AS score
    FROM players p LEFT JOIN legacy l ON l.player_id=p.player_id LEFT JOIN games g ON g.player_id=p.player_id
    ORDER BY score DESC,COALESCE(g.first_post,l.updated_at) ASC LIMIT 50`).bind(date,date,date,date).all();
  return q.results||[];
}

async function allRows(env){
  const q=await env.DB.prepare(`WITH keys AS (
      SELECT date,player_id FROM leaderboard
      UNION
      SELECT date,player_id FROM leaderboard_game_scores WHERE game IN ('grid','groups','trail','link','steps','deepcut','lastcall')
    ), legacy AS (
      SELECT * FROM leaderboard
    ), games AS (
      SELECT date,player_id,MAX(display_name) AS display_name,
        MAX(CASE WHEN game='grid' THEN score END) AS grid_score,
        MAX(CASE WHEN game='groups' THEN score END) AS groups_score,
        MAX(CASE WHEN game='trail' THEN score END) AS trail_score,
        MAX(CASE WHEN game='link' THEN score END) AS link_score,
        MAX(CASE WHEN game='steps' THEN score END) AS steps_score,
        MAX(CASE WHEN game='deepcut' THEN score END) AS deepcut_score,
        MAX(CASE WHEN game='lastcall' THEN score END) AS lastcall_score
      FROM leaderboard_game_scores WHERE game IN ('grid','groups','trail','link','steps','deepcut','lastcall') GROUP BY date,player_id
    ), daily AS (
      SELECT k.date,k.player_id,COALESCE(g.display_name,l.display_name,'Player') AS display_name,
        COALESCE(g.grid_score,l.grid_score,0)+COALESCE(g.groups_score,l.groups_score,0)+COALESCE(g.trail_score,l.trail_score,0)+
        COALESCE(g.link_score,l.link_score,0)+COALESCE(g.steps_score,l.steps_score,0)+COALESCE(g.deepcut_score,l.deepcut_score,0)+COALESCE(g.lastcall_score,0) AS score
      FROM keys k LEFT JOIN legacy l ON l.date=k.date AND l.player_id=k.player_id LEFT JOIN games g ON g.date=k.date AND g.player_id=k.player_id
    )
    SELECT player_id,MAX(display_name) AS display_name,SUM(score) AS score,COUNT(*) AS days
    FROM daily WHERE score>0 GROUP BY player_id ORDER BY score DESC LIMIT 50`).all();
  return q.results||[];
}

async function dailyGameRows(env,date,board){
  if(board==='lastcall'){
    const q=await env.DB.prepare("SELECT player_id,display_name,score FROM leaderboard_game_scores WHERE date=? AND game='lastcall' ORDER BY score DESC,updated_at ASC LIMIT 50").bind(date).all();
    return q.results||[];
  }
  const column=LEGACY_COLUMN[board];
  const q=await env.DB.prepare(`WITH scores AS (
      SELECT player_id,display_name,score,updated_at FROM leaderboard_game_scores WHERE date=? AND game=?
      UNION ALL
      SELECT player_id,display_name,${column} AS score,updated_at FROM leaderboard WHERE date=?
    )
    SELECT player_id,MAX(display_name) AS display_name,MAX(score) AS score,MIN(updated_at) AS updated_at
    FROM scores GROUP BY player_id ORDER BY score DESC,updated_at ASC LIMIT 50`).bind(date,board,date).all();
  return q.results||[];
}

async function boardResponse(url,env){
  if(!await ensureLeaderboard(env))return json({enabled:false,reason:'Leaderboard database is not enabled yet.'});
  const board=String(url.searchParams.get('board')||'').toLowerCase(),date=requestedDate(url);
  try{
    if(board==='today')return json({enabled:true,board,date,rows:await todayRows(env,date)});
    if(board==='all')return json({enabled:true,board,date,rows:await allRows(env)});
    if(DAILY_BOARDS.has(board))return json({enabled:true,board,date,rows:await dailyGameRows(env,date,board)});
    if(RECORD_BOARDS.has(board)){const q=await env.DB.prepare('SELECT player_id,display_name,score FROM leaderboard_records WHERE game=? ORDER BY score DESC,updated_at ASC LIMIT 50').bind(board).all();return json({enabled:true,board,date,rows:q.results||[]})}
    if(board==='situation')return json({error:'Situation is now a Tileworks mode, not a daily leaderboard.'},410);
    return json({error:'Unknown leaderboard.'},400);
  }catch(error){console.error('Leaderboard query failed',error);return json({enabled:false,reason:'Leaderboard could not load. Please try again.'},503)}
}

async function dailyResponseV4(response){
  try{const data=await response.clone().json();if(data.situation)data.tileworksSituation=data.situation;data.dailyGames=7;return json(data,response.status)}catch{return response}
}
async function healthResponseV4(response){
  try{const data=await response.clone().json();data.dailyGames=7;data.leaderboardBoards=12;data.situationMode='tileworks';return json(data,response.status)}catch{return response}
}

async function withSiteBootstrap(response){
  if(!response.ok)return response;const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replace(/\s*<link[^>]+daily-expansion\.css[^>]*>/gi,'').replace(/\s*<script[^>]+daily-expansion\.js[^>]*><\/script>/gi,'');
  html=html.replaceAll('Eight fresh puzzles are waiting.','Seven games. One morning run.').replaceAll('Eight fresh word, logic, deduction, and trivia games every morning','Seven fresh word, logic, trivia, and push-your-luck games every morning').replaceAll('eight daily word, logic, deduction, and trivia games, including Situation and Last Call','seven daily word, logic, trivia, and push-your-luck games, including Last Call').replaceAll('eight daily word, logic, deduction, and trivia games','seven daily word, logic, trivia, and push-your-luck games').replaceAll('including Situation and Last Call','including Last Call');
  const scripts=[];if(!html.includes('/daily-run-v2.js'))scripts.push('<script src="/daily-run-v2.js?v=1" defer></script>');if(!html.includes('/pwa.js'))scripts.push('<script src="/pwa.js" defer></script>');if(scripts.length)html=html.replace('</body>',`${scripts.join('\n')}\n</body>`);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store, max-age=0, must-revalidate');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/push/')){const pushResponse=await handlePushRequest(request,env);if(pushResponse)return pushResponse}
    if(request.method==='GET'&&url.pathname==='/api/leaderboard'&&url.searchParams.has('board'))return boardResponse(url,env);
    if(request.method==='POST'&&url.pathname==='/api/deepcut/recap'){
      const b=await body(request),ids=Array.isArray(b.promptIds)?b.promptIds.map(String).slice(0,8):[];
      if(!ids.length)return json({ok:false,error:'No Deep Cut prompts supplied.'},400);const rows=ids.map(promptRecap);if(rows.some(row=>!row))return json({ok:false,error:'Unknown Deep Cut prompt.'},400);return json({ok:true,rows});
    }
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET'&&url.pathname==='/api/daily')return dailyResponseV4(response);
    if(request.method==='GET'&&url.pathname==='/api/health')return healthResponseV4(response);
    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return withSiteBootstrap(response);
    return response;
  },
  async scheduled(controller,env,ctx){const scheduledAt=Number(controller?.scheduledTime)||Date.now();ctx.waitUntil(runPushSchedule(env,new Date(scheduledAt)))}
};
