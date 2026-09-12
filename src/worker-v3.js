import core from "./worker-v2.js";
import { pacificDateKey } from "./worker.js";
import { publicLastCall, checkLastCall, revealLastCall, LAST_CALL_ROUNDS } from "./last_call.js";

const DAILY_COLUMNS={grid:"grid_score",groups:"groups_score",trail:"trail_score",link:"link_score",steps:"steps_score",deepcut:"deepcut_score"};
const DAILY_GAMES=new Set([...Object.keys(DAILY_COLUMNS),"situation","lastcall"]);
const RECORD_GAMES=new Set(["all-seven","pangram","tileworks"]);
const DAILY_MAX={grid:6000,groups:1400,trail:100000,link:600,steps:1000,deepcut:800,situation:100000,lastcall:2000};
let leadersV2Ready=false;

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
async function body(request){try{return await request.clone().json()}catch{return {}}}
function requestDate(request,b={}){const raw=String(b.date||new URL(request.url).searchParams.get('date')||pacificDateKey());return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:pacificDateKey()}
function safeName(v){const name=String(v||"").trim().replace(/\s+/g," ").slice(0,20);return name&&/^([\p{L}\p{N}][\p{L}\p{N} ._'-]{0,19})$/u.test(name)?name:null}
function safePlayerId(v){const id=String(v||"");return /^[A-Za-z0-9-]{8,64}$/.test(id)?id:null}
function safeScore(v,max=1000000){const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=max?n:null}

async function ensureLeadersV2(env){
  if(!env.DB)return false;
  if(leadersV2Ready)return true;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard (
    date TEXT NOT NULL,
    player_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    grid_score INTEGER NOT NULL DEFAULT 0,
    groups_score INTEGER NOT NULL DEFAULT 0,
    trail_score INTEGER NOT NULL DEFAULT 0,
    link_score INTEGER NOT NULL DEFAULT 0,
    steps_score INTEGER NOT NULL DEFAULT 0,
    lineup_score INTEGER NOT NULL DEFAULT 0,
    deepcut_score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, player_id)
  )`).run();
  for(const sql of [
    "ALTER TABLE leaderboard ADD COLUMN steps_score INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE leaderboard ADD COLUMN lineup_score INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE leaderboard ADD COLUMN deepcut_score INTEGER NOT NULL DEFAULT 0"
  ]){try{await env.DB.prepare(sql).run()}catch{}}
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard_game_scores (
    date TEXT NOT NULL,
    game TEXT NOT NULL,
    player_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, game, player_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leaderboard_records (
    game TEXT NOT NULL,
    player_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game, player_id)
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lb_game_date_score ON leaderboard_game_scores(date,game,score DESC)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lb_game_player ON leaderboard_game_scores(player_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_lb_records_score ON leaderboard_records(game,score DESC)").run();
  leadersV2Ready=true;
  return true;
}

async function updateLeaderboardName(env,playerId,name){
  if(!env.DB||!playerId||!name)return;
  try{await ensureLeadersV2(env)}catch{return}
  await env.DB.prepare("UPDATE leaderboard_game_scores SET display_name=? WHERE player_id=?").bind(name,playerId).run();
  await env.DB.prepare("UPDATE leaderboard_records SET display_name=? WHERE player_id=?").bind(name,playerId).run();
}

async function postDailyGame(request,env){
  if(!env.DB)return json({enabled:false,reason:"Leaderboard database is not enabled yet."});
  try{await ensureLeadersV2(env)}catch{return json({enabled:false,reason:"Leaderboard database needs setup."},503)}
  const b=await body(request),date=requestDate(request,b),game=String(b.game||"").toLowerCase(),playerId=safePlayerId(b.playerId),name=safeName(b.name);
  const score=DAILY_GAMES.has(game)?safeScore(b.score,DAILY_MAX[game]):null;
  if(date!==pacificDateKey())return json({error:"Only today's game score can be posted."},400);
  if(!DAILY_GAMES.has(game))return json({error:"Unknown daily leaderboard game."},400);
  if(!playerId)return json({error:"Invalid player ID."},400);
  if(!name)return json({error:"Choose a valid leaderboard name."},400);
  if(score===null||b.complete!==true)return json({error:"Finish the game before posting its score."},400);
  await env.DB.prepare(`INSERT INTO leaderboard_game_scores(date,game,player_id,display_name,score,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(date,game,player_id) DO UPDATE SET
      display_name=excluded.display_name,
      score=excluded.score,
      updated_at=CURRENT_TIMESTAMP`).bind(date,game,playerId,name,score).run();
  await env.DB.prepare("UPDATE leaderboard_game_scores SET display_name=? WHERE player_id=?").bind(name,playerId).run();
  await env.DB.prepare("UPDATE leaderboard_records SET display_name=? WHERE player_id=?").bind(name,playerId).run();
  const rank=await env.DB.prepare("SELECT 1 + COUNT(*) AS rank FROM leaderboard_game_scores WHERE date=? AND game=? AND score>?").bind(date,game,score).first();
  return json({enabled:true,posted:true,date,game,score,rank:Number(rank?.rank||1)});
}

async function postHighScore(request,env){
  if(!env.DB)return json({enabled:false,reason:"Leaderboard database is not enabled yet."});
  try{await ensureLeadersV2(env)}catch{return json({enabled:false,reason:"Leaderboard database needs setup."},503)}
  const b=await body(request),game=String(b.game||"").toLowerCase(),playerId=safePlayerId(b.playerId),name=safeName(b.name),score=safeScore(b.score,1000000);
  if(!RECORD_GAMES.has(game))return json({error:"Unknown record leaderboard game."},400);
  if(!playerId)return json({error:"Invalid player ID."},400);
  if(!name)return json({error:"Choose a valid leaderboard name."},400);
  if(score===null)return json({error:"Invalid score."},400);
  await env.DB.prepare(`INSERT INTO leaderboard_records(game,player_id,display_name,score,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(game,player_id) DO UPDATE SET
      display_name=excluded.display_name,
      score=CASE WHEN excluded.score>leaderboard_records.score THEN excluded.score ELSE leaderboard_records.score END,
      updated_at=CURRENT_TIMESTAMP`).bind(game,playerId,name,score).run();
  await env.DB.prepare("UPDATE leaderboard_game_scores SET display_name=? WHERE player_id=?").bind(name,playerId).run();
  const saved=await env.DB.prepare("SELECT score FROM leaderboard_records WHERE game=? AND player_id=?").bind(game,playerId).first();
  const best=Number(saved?.score||score),rank=await env.DB.prepare("SELECT 1 + COUNT(*) AS rank FROM leaderboard_records WHERE game=? AND score>?").bind(game,best).first();
  return json({enabled:true,posted:true,game,score:best,rank:Number(rank?.rank||1)});
}

async function boardRows(env,date,board){
  if(board==="today"){
    const q=await env.DB.prepare(`WITH extra AS (
      SELECT player_id,
        MAX(CASE WHEN game='situation' THEN score ELSE 0 END) AS situation_score,
        MAX(CASE WHEN game='lastcall' THEN score ELSE 0 END) AS lastcall_score
      FROM leaderboard_game_scores WHERE date=? GROUP BY player_id
    )
    SELECT l.player_id,l.display_name,
      l.score+COALESCE(e.situation_score,0)+COALESCE(e.lastcall_score,0) AS score,
      l.grid_score,l.groups_score,l.trail_score,l.link_score,l.steps_score,l.deepcut_score,
      COALESCE(e.situation_score,0) AS situation_score,COALESCE(e.lastcall_score,0) AS lastcall_score
    FROM leaderboard l LEFT JOIN extra e ON e.player_id=l.player_id
    WHERE l.date=? ORDER BY score DESC,l.updated_at ASC LIMIT 50`).bind(date,date).all();
    return q.results||[];
  }
  if(board==="all"){
    const q=await env.DB.prepare(`WITH extra AS (
      SELECT date,player_id,SUM(score) AS extra_score
      FROM leaderboard_game_scores WHERE game IN ('situation','lastcall') GROUP BY date,player_id
    )
    SELECT l.player_id,MAX(l.display_name) AS display_name,
      SUM(l.score+COALESCE(e.extra_score,0)) AS score,COUNT(*) AS days
    FROM leaderboard l LEFT JOIN extra e ON e.date=l.date AND e.player_id=l.player_id
    GROUP BY l.player_id ORDER BY score DESC LIMIT 50`).all();
    return q.results||[];
  }
  if(RECORD_GAMES.has(board)){
    const q=await env.DB.prepare("SELECT player_id,display_name,score FROM leaderboard_records WHERE game=? ORDER BY score DESC,updated_at ASC LIMIT 50").bind(board).all();
    return q.results||[];
  }
  if(board==="situation"||board==="lastcall"){
    const q=await env.DB.prepare("SELECT player_id,display_name,score FROM leaderboard_game_scores WHERE date=? AND game=? ORDER BY score DESC,updated_at ASC LIMIT 50").bind(date,board).all();
    return q.results||[];
  }
  if(DAILY_COLUMNS[board]){
    const column=DAILY_COLUMNS[board];
    const q=await env.DB.prepare(`WITH scores AS (
      SELECT player_id,display_name,score,updated_at FROM leaderboard_game_scores WHERE date=? AND game=?
      UNION ALL
      SELECT player_id,display_name,${column} AS score,updated_at FROM leaderboard WHERE date=?
    )
    SELECT player_id,MAX(display_name) AS display_name,MAX(score) AS score,MIN(updated_at) AS updated_at
    FROM scores GROUP BY player_id ORDER BY score DESC,updated_at ASC LIMIT 50`).bind(date,board,date).all();
    return q.results||[];
  }
  return null;
}

async function leadersV2Get(request,env){
  if(!env.DB)return json({enabled:false,reason:"Leaderboard database is not enabled yet."});
  try{await ensureLeadersV2(env)}catch{return json({enabled:false,reason:"Leaderboard database needs setup."},503)}
  const url=new URL(request.url),board=String(url.searchParams.get("board")||"").toLowerCase(),date=requestDate(request);
  const rows=await boardRows(env,date,board);
  if(rows===null)return json({error:"Unknown leaderboard."},400);
  return json({enabled:true,board,date,rows});
}

async function foundersResponse(response){
  try{const data=await response.clone().json();if(data&&data.active){data.tier="founders";data.entitlements={allPacks:true,archive:true,reserveLibrary:true,founderRewards:true};data.displayName="Founders"}return json(data,response.status)}catch{return response}
}
async function dailyResponse(response){
  try{const data=await response.clone().json(),date=data.date||pacificDateKey();delete data.lockbox;data.lastcall=publicLastCall(date);data.dailyGames=8;return json(data,response.status)}catch{return response}
}
async function healthResponse(response){
  try{const data=await response.clone().json();data.dailyGames=8;data.lastCallRounds=LAST_CALL_ROUNDS;data.leaderboardBoards=13;delete data.lockbox;return json(data,response.status)}catch{return response}
}
async function injectFoundersUi(response){
  const type=response.headers.get("content-type")||"";if(!type.includes("text/html"))return response;let html=await response.text();
  html=html.replaceAll('including Situation and Lockbox','including Situation and Last Call').replaceAll('word, logic, deduction, and trivia','word, logic, trivia, and tactical').replaceAll('word, logic, deduction, and trivia games','word, logic, trivia, and tactical games');
  if(!html.includes("/daily-presentation-fix.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/daily-presentation-fix.css?v=2"></head>');
  if(!html.includes("/presentation-v1.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/presentation-v1.css?v=2"></head>');
  if(!html.includes("/social.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/social.css?v=1"></head>');
  if(!html.includes("/leaderboards-v2.css"))html=html.replace("</head>",'<link rel="stylesheet" href="/leaderboards-v2.css?v=1"></head>');
  if(!html.includes("/founders-ui.js"))html=html.replace("</body>",'<script src="/founders-ui.js" defer></script></body>');
  if(!html.includes("/extra-games.js"))html=html.replace("</body>",'<script src="/extra-games.js?v=1" defer></script></body>');
  if(!html.includes("/word-controls.js"))html=html.replace("</body>",'<script type="module" src="/word-controls.js?v=2"></script></body>');
  if(!html.includes("/daily-presentation-fix.js"))html=html.replace("</body>",'<script src="/daily-presentation-fix.js?v=2" defer></script></body>');
  if(!html.includes("/presentation-v1.js"))html=html.replace("</body>",'<script src="/presentation-v1.js?v=2" defer></script></body>');
  if(!html.includes("/social.js"))html=html.replace("</body>",'<script src="/social.js?v=1" defer></script></body>');
  if(!html.includes("/leaderboards-v2.js"))html=html.replace("</body>",'<script src="/leaderboards-v2.js?v=1" defer></script></body>');
  const headers=new Headers(response.headers);headers.set("Cache-Control","no-store, max-age=0, must-revalidate");headers.delete("content-length");return new Response(html,{status:response.status,statusText:response.statusText,headers})
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="GET"&&path==="/api/leaderboard"&&url.searchParams.has("board"))return leadersV2Get(request,env);
    if(request.method==="POST"&&path==="/api/leaderboard/game-score")return postDailyGame(request,env);
    if(request.method==="POST"&&path==="/api/leaderboard/high-score")return postHighScore(request,env);
    if(request.method==="POST"&&path==="/api/leaderboard/name"){
      const b=await body(request),playerId=safePlayerId(b.playerId),name=safeName(b.name),response=await core.fetch(request,env);
      if(response.ok&&playerId&&name)await updateLeaderboardName(env,playerId,name);
      return response;
    }
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
