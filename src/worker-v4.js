import core from './worker-v3.js';
import {DEEP_CUT_PROMPTS} from './puzzles.js';
import {handlePushRequest,runPushSchedule} from './push.js';

const DAILY_BOARDS=new Set(['grid','groups','trail','link','steps','deepcut','lastcall']);
const RECORD_BOARDS=new Set(['all-seven','pangram','tileworks']);
const LEGACY_COLUMN={grid:'grid_score',groups:'groups_score',trail:'trail_score',link:'link_score',steps:'steps_score',deepcut:'deepcut_score'};
const DAILY_GUIDE_PATHS=new Set(['/games/letter-grid/','/games/four-groups/','/games/letter-trail/','/games/triple-link/','/games/word-steps/','/games/deep-cut/']);
const SEO_PAGES={
  '/games/tileworks/':{
    name:'Tileworks',
    title:'Tileworks — Free Crossword Tile Word Game | Clue Morning',
    description:'Play Tileworks, a free crossword tile word game with full AI matches, premium squares, rack strategy, and a daily three-move Situation mode.',
    ogTitle:'Tileworks — Free Crossword Tile Word Game',
    ogDescription:'Build words on a premium-square board in a full AI match, or take on the daily three-move Situation.'
  },
  '/games/pangram/':{
    name:'Pangram',
    title:'Pangram — Free Seven-Letter Word Game | Clue Morning',
    description:'Play Pangram, an endless seven-letter word hunt. Every word must use the center letter; use all seven letters for a pangram bonus.',
    ogTitle:'Pangram — Free Seven-Letter Word Game',
    ogDescription:'Find words from seven letters, use the required center letter every time, and chase the pangram bonus.'
  },
  '/games/all-seven/':{
    name:'All Seven',
    title:'All Seven — Free Seven-Center Word Hunt | Clue Morning',
    description:'Play All Seven, a multi-stage seven-letter word game. Clear every center letter by finding new words or landing pangrams across one run.',
    ogTitle:'All Seven — Free Seven-Center Word Hunt',
    ogDescription:'One seven-letter set, seven required centers, and a full run built around words and pangrams.'
  }
};
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
  for(const sql of [
    'ALTER TABLE leaderboard ADD COLUMN steps_score INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE leaderboard ADD COLUMN lineup_score INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE leaderboard ADD COLUMN deepcut_score INTEGER NOT NULL DEFAULT 0'
  ]){try{await env.DB.prepare(sql).run()}catch{}}
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

function escRe(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function setTitle(html,value){return /<title>.*?<\/title>/is.test(html)?html.replace(/<title>.*?<\/title>/is,`<title>${value}</title>`):html.replace('</head>',`<title>${value}</title>\n</head>`)}
function setMetaName(html,name,content){const re=new RegExp(`<meta\\s+name=["']${escRe(name)}["'][^>]*>`,'i'),tag=`<meta name="${name}" content="${content}">`;return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}\n</head>`)}
function setMetaProperty(html,name,content){const re=new RegExp(`<meta\\s+property=["']${escRe(name)}["'][^>]*>`,'i'),tag=`<meta property="${name}" content="${content}">`;return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}\n</head>`)}
function setCanonical(html,url){const re=/<link\s+rel=["']canonical["'][^>]*>/i,tag=`<link rel="canonical" href="${url}">`;return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}\n</head>`)}
function appendHead(html,markup){return html.replace('</head>',`${markup}\n</head>`)}

function applyHomepageSeo(html){
  const title='Clue Morning — 7 Free Daily Word, Logic & Trivia Games';
  const description='Play seven free daily word, logic, trivia, and push-your-luck games. Letter Grid, Four Groups, Deep Cut, Last Call, and more refresh every morning.';
  const social='Seven fresh word, logic, trivia, and push-your-luck games every morning, free in your browser.';
  html=setTitle(html,title);
  html=setMetaName(html,'description',description);
  html=setMetaName(html,'robots','index,follow,max-image-preview:large');
  html=setCanonical(html,'https://cluemorning.com/');
  html=setMetaProperty(html,'og:type','website');
  html=setMetaProperty(html,'og:site_name','Clue Morning');
  html=setMetaProperty(html,'og:locale','en_US');
  html=setMetaProperty(html,'og:title',title);
  html=setMetaProperty(html,'og:description',social);
  html=setMetaProperty(html,'og:url','https://cluemorning.com/');
  html=setMetaProperty(html,'og:image','https://cluemorning.com/icon-512.png');
  html=setMetaName(html,'twitter:card','summary');
  html=setMetaName(html,'twitter:title',title);
  html=setMetaName(html,'twitter:description',social);
  html=setMetaName(html,'twitter:image','https://cluemorning.com/icon-512.png');
  const schema={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebSite','@id':'https://cluemorning.com/#website',name:'Clue Morning',url:'https://cluemorning.com/',description:'A free collection of seven daily word, logic, trivia, and push-your-luck games with a fresh shared set every morning.'},
      {'@type':'CollectionPage','@id':'https://cluemorning.com/#daily-games',name:'Clue Morning Daily Games',url:'https://cluemorning.com/',isPartOf:{'@id':'https://cluemorning.com/#website'},mainEntity:{'@type':'ItemList',numberOfItems:7,itemListElement:[
        {'@type':'ListItem',position:1,name:'Letter Grid',url:'https://cluemorning.com/games/letter-grid/'},
        {'@type':'ListItem',position:2,name:'Four Groups',url:'https://cluemorning.com/games/four-groups/'},
        {'@type':'ListItem',position:3,name:'Letter Trail',url:'https://cluemorning.com/games/letter-trail/'},
        {'@type':'ListItem',position:4,name:'Triple Link',url:'https://cluemorning.com/games/triple-link/'},
        {'@type':'ListItem',position:5,name:'Word Steps',url:'https://cluemorning.com/games/word-steps/'},
        {'@type':'ListItem',position:6,name:'Deep Cut',url:'https://cluemorning.com/games/deep-cut/'},
        {'@type':'ListItem',position:7,name:'Last Call',url:'https://cluemorning.com/games/last-call/'}
      ]}}
    ]
  };
  html=html.replace(/<script\s+type=["']application\/ld\+json["']>.*?<\/script>/is,`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
  html=html.replaceAll('Six fresh puzzles are waiting.','Seven games. One morning run.')
    .replaceAll('Six quick word, logic, and trivia games, every morning.','Seven quick word, logic, trivia, and push-your-luck games, every morning.')
    .replaceAll('Clue Morning is a free browser-based daily game collection. Play Letter Grid, Four Groups, Letter Trail, Triple Link, Word Steps, and Deep Cut without an app download.','Clue Morning is a free browser-based daily game collection. Seven games land every morning: Letter Grid, Four Groups, Letter Trail, Triple Link, Word Steps, Deep Cut, and Last Call.')
    .replaceAll('finish all six puzzles.','finish all seven games.')
    .replaceAll('Today’s six games','Today’s seven games');
  if(!html.includes('/games/last-call/'))html=html.replace('<a href="/games/deep-cut/">Deep Cut guide</a></nav>','<a href="/games/deep-cut/">Deep Cut guide</a><a href="/games/last-call/">Last Call guide</a><a href="/games/">All games</a></nav>');
  return html;
}

function applyDailyGuidePolish(html){
  html=html.replaceAll('href="/">Today’s six games</a>','href="/games/">All games</a>')
    .replaceAll('six free daily games','seven free daily games')
    .replaceAll('free six-game daily set','free seven-game daily set')
    .replaceAll('six-game daily set','seven-game daily set')
    .replaceAll('Free daily word, logic, and trivia games.','Free daily word, logic, trivia, and push-your-luck games.');
  html=setMetaProperty(html,'og:locale','en_US');
  html=setMetaName(html,'twitter:image','https://cluemorning.com/icon-512.png');
  if(!html.includes('href="/games/last-call/"'))html=html.replace('</nav>\n    </section>','<a href="/games/last-call/">Last Call</a><a href="/games/">All games</a></nav>\n    </section>');
  return html;
}

function applyBonusSeo(html,path){
  const cfg=SEO_PAGES[path];if(!cfg)return html;const canonical=`https://cluemorning.com${path}`;
  html=setTitle(html,cfg.title);
  html=setMetaName(html,'description',cfg.description);
  html=setMetaName(html,'robots','index,follow,max-image-preview:large');
  html=setCanonical(html,canonical);
  html=setMetaProperty(html,'og:type','website');
  html=setMetaProperty(html,'og:site_name','Clue Morning');
  html=setMetaProperty(html,'og:locale','en_US');
  html=setMetaProperty(html,'og:title',cfg.ogTitle);
  html=setMetaProperty(html,'og:description',cfg.ogDescription);
  html=setMetaProperty(html,'og:url',canonical);
  html=setMetaProperty(html,'og:image','https://cluemorning.com/icon-512.png');
  html=setMetaName(html,'twitter:card','summary');
  html=setMetaName(html,'twitter:title',cfg.ogTitle);
  html=setMetaName(html,'twitter:description',cfg.ogDescription);
  html=setMetaName(html,'twitter:image','https://cluemorning.com/icon-512.png');
  if(!/application\/ld\+json/i.test(html)){
    const schema={'@context':'https://schema.org','@graph':[
      {'@type':'WebPage','@id':`${canonical}#page`,name:cfg.ogTitle,url:canonical,description:cfg.description,isPartOf:{'@type':'WebSite',name:'Clue Morning',url:'https://cluemorning.com/'},breadcrumb:{'@id':`${canonical}#breadcrumbs`}},
      {'@type':'BreadcrumbList','@id':`${canonical}#breadcrumbs`,itemListElement:[
        {'@type':'ListItem',position:1,name:'Clue Morning',item:'https://cluemorning.com/'},
        {'@type':'ListItem',position:2,name:'Games',item:'https://cluemorning.com/games/'},
        {'@type':'ListItem',position:3,name:cfg.name,item:canonical}
      ]}
    ]};
    html=appendHead(html,`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
  }
  return html;
}

async function withHtmlPolish(response,path){
  if(!response.ok)return response;const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;
  let html=await response.text();const home=path==='/'||path==='/index.html';
  if(home){
    html=html.replace(/\s*<script[^>]+daily-expansion\.js[^>]*><\/script>/gi,'');
    html=html.replaceAll('Eight fresh puzzles are waiting.','Seven games. One morning run.').replaceAll('Eight fresh word, logic, deduction, and trivia games every morning','Seven fresh word, logic, trivia, and push-your-luck games every morning').replaceAll('eight daily word, logic, deduction, and trivia games, including Situation and Last Call','seven daily word, logic, trivia, and push-your-luck games, including Last Call').replaceAll('eight daily word, logic, deduction, and trivia games','seven daily word, logic, trivia, and push-your-luck games').replaceAll('including Situation and Last Call','including Last Call');
    html=applyHomepageSeo(html);
    const scripts=[];if(!html.includes('/daily-run-v2.js'))scripts.push('<script src="/daily-run-v2.js?v=1" defer></script>');if(!html.includes('/pwa.js'))scripts.push('<script src="/pwa.js" defer></script>');if(scripts.length)html=html.replace('</body>',`${scripts.join('\n')}\n</body>`);
  }else if(DAILY_GUIDE_PATHS.has(path))html=applyDailyGuidePolish(html);
  else if(SEO_PAGES[path])html=applyBonusSeo(html,path);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');headers.set('cache-control',home?'no-store, max-age=0, must-revalidate':'public, max-age=900');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(url.pathname.startsWith('/api/push/')){const pushResponse=await handlePushRequest(request,env);if(pushResponse)return pushResponse}
    if(request.method==='GET'&&(path==='/games/lineup/'||path==='/games/lineup'))return Response.redirect(new URL('/games/deep-cut/',url),301);
    if(request.method==='GET'&&url.pathname==='/api/leaderboard'&&url.searchParams.has('board'))return boardResponse(url,env);
    if(request.method==='POST'&&url.pathname==='/api/deepcut/recap'){
      const b=await body(request),ids=Array.isArray(b.promptIds)?b.promptIds.map(String).slice(0,8):[];
      if(!ids.length)return json({ok:false,error:'No Deep Cut prompts supplied.'},400);const rows=ids.map(promptRecap);if(rows.some(row=>!row))return json({ok:false,error:'Unknown Deep Cut prompt.'},400);return json({ok:true,rows});
    }
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET'&&url.pathname==='/api/daily')return dailyResponseV4(response);
    if(request.method==='GET'&&url.pathname==='/api/health')return healthResponseV4(response);
    if(request.method==='GET'&&(path==='/'||path==='/index.html'||DAILY_GUIDE_PATHS.has(path)||SEO_PAGES[path]))return withHtmlPolish(response,path);
    return response;
  },
  async scheduled(controller,env,ctx){const scheduledAt=Number(controller?.scheduledTime)||Date.now();ctx.waitUntil(runPushSchedule(env,new Date(scheduledAt)))}
};
