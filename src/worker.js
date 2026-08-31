import { WORD_BANK, GROUP_PUZZLES, TRAIL_PUZZLES, LINK_PUZZLES, WORD_STEPS_DICTIONARY, WORD_STEPS_PUZZLES, DEEP_CUT_PROMPTS, DEEP_CUT_PUZZLES, YEAR_PACK_START, YEAR_PACK } from "./puzzles.js";

const TZ = "America/Los_Angeles";
const MAX_GUESSES = 6;
const TRAIL_SECONDS = 150;
const STEPS_MAX_MOVES = 8;
const DEEP_CUT_SECONDS = 25;
const DEEP_CUT_ROUNDS = 8;
const WORD_STEPS_SET = new Set(WORD_STEPS_DICTIONARY);
const GROUP_SET_DIFFICULTY = ["Tricky","Easy","Easy","Medium","Medium","Hard","Medium","Hard","Tricky","Hard","Medium","Hard"];
const GROUP_DIFFICULTY_ORDER = [
  [0,3,2,1],[2,0,3,1],[0,2,1,3],[1,3,0,2],[0,1,3,2],[0,1,3,2],
  [0,1,3,2],[1,0,3,2],[0,1,3,2],[1,0,2,3],[0,1,3,2],[1,0,3,2]
];
const GROUP_LEVELS = [
  {difficulty:"easy",difficultyLabel:"Easy"},
  {difficulty:"medium",difficultyLabel:"Medium"},
  {difficulty:"hard",difficultyLabel:"Hard"},
  {difficulty:"tricky",difficultyLabel:"Tricky"}
];
let leaderboardSchemaReady = false;

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,rnd=Math.random){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pacificDateKey(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function allowedDate(request){
  const u=new URL(request.url), asked=u.searchParams.get("date");
  if(!asked) return pacificDateKey();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asked)) return null;
  return asked <= pacificDateKey() ? asked : null;
}
function ymdToUtc(dateKey){const [y,m,d]=dateKey.split("-").map(Number);return Date.UTC(y,m-1,d)}
function yearPackEntry(date){const delta=Math.floor((ymdToUtc(date)-ymdToUtc(YEAR_PACK_START))/86400000);return delta>=0&&delta<YEAR_PACK.length?YEAR_PACK[delta]:null}
function pickDailyLegacy(date){
  const lseed=hashString(date+"::clue-morning::letter"), lrnd=mulberry32(lseed);
  const length=5+Math.floor(lrnd()*6);
  const answer=WORD_BANK[length][Math.floor(lrnd()*WORD_BANK[length].length)];
  const gseed=hashString(date+"::clue-morning::groups"), grnd=mulberry32(gseed);
  const groupsIndex=Math.floor(grnd()*GROUP_PUZZLES.length), groups=GROUP_PUZZLES[groupsIndex];
  const tseed=hashString(date+"::clue-morning::trail"), trnd=mulberry32(tseed);
  const trail=TRAIL_PUZZLES[Math.floor(trnd()*Math.min(TRAIL_PUZZLES.length,12))];
  const xseed=hashString(date+"::clue-morning::link"), xrnd=mulberry32(xseed);
  const link=LINK_PUZZLES[Math.floor(xrnd()*LINK_PUZZLES.length)];
  const steps=WORD_STEPS_PUZZLES[Math.floor(mulberry32(hashString(date+"::clue-morning::steps"))()*WORD_STEPS_PUZZLES.length)];
  const deepCutIndices=DEEP_CUT_PUZZLES[Math.floor(mulberry32(hashString(date+"::clue-morning::deep-cut"))()*DEEP_CUT_PUZZLES.length)];
  const deepcut={prompts:deepCutIndices.map(i=>DEEP_CUT_PROMPTS[i])};
  return {date,length,answer,groups,groupsIndex,gseed,trail,link,steps,deepcut};
}
function pickDaily(date){
  const scheduled=yearPackEntry(date);
  if(!scheduled) return pickDailyLegacy(date);
  const length=Number(scheduled.length);
  const answer=WORD_BANK[length][scheduled.answerIndex];
  const groups=GROUP_PUZZLES[scheduled.groupsIndex];
  const trail=TRAIL_PUZZLES[scheduled.trailIndex];
  const link=LINK_PUZZLES[scheduled.linkIndex];
  const steps=WORD_STEPS_PUZZLES[scheduled.stepsIndex ?? 0];
  const deepCutIndices=DEEP_CUT_PUZZLES[scheduled.deepCutIndex ?? 0];
  const deepcut={prompts:deepCutIndices.map(i=>DEEP_CUT_PROMPTS[i])};
  const gseed=hashString(date+"::clue-morning::groups::scheduled::"+scheduled.groupsIndex);
  return {date,length,answer,groups,groupsIndex:scheduled.groupsIndex,gseed,trail,link,steps,deepcut};
}
function groupWithDifficulty(p,index){
  const group=p.groups[index],order=GROUP_DIFFICULTY_ORDER[p.groupsIndex]||[0,1,2,3],rank=Math.max(0,order.indexOf(index)),meta=GROUP_LEVELS[rank]||GROUP_LEVELS[1];
  return {...group,...meta};
}
function normalizeWord(v){return String(v||"").toUpperCase().replace(/[^A-Z]/g,"")}
function evaluateGuess(guess,target){
  const res=Array(target.length).fill("gray"),counts={};
  for(let i=0;i<target.length;i++){if(guess[i]===target[i])res[i]="green";else counts[target[i]]=(counts[target[i]]||0)+1}
  for(let i=0;i<target.length;i++){if(res[i]==="green")continue;const ch=guess[i];if((counts[ch]||0)>0){res[i]="yellow";counts[ch]--}}
  return res;
}
function trailPathValid(word,grid){
  const W=4,H=4,target=normalizeWord(word); if(target.length<3||target.length>16) return false;
  function dfs(idx,pos,used){
    if(pos===target.length) return true;
    const r=Math.floor(idx/W),c=idx%W;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue; const nr=r+dr,nc=c+dc; if(nr<0||nc<0||nr>=H||nc>=W)continue;
      const ni=nr*W+nc; if(used.has(ni)||grid[ni]!==target[pos])continue;
      used.add(ni); if(dfs(ni,pos+1,used))return true; used.delete(ni);
    }
    return false;
  }
  for(let i=0;i<grid.length;i++) if(grid[i]===target[0] && dfs(i,1,new Set([i]))) return true;
  return false;
}
async function bodyJson(request){try{return await request.json()}catch{return {}}}

function trailDictionaryWord(word, trail){
  const w=normalizeWord(word);
  if(w.length<3||w.length>16) return false;
  return Array.isArray(trail.words) && trail.words.includes(w);
}
function differsByOne(a,b){return a.length===b.length&&[...a].reduce((n,ch,i)=>n+(ch!==b[i]),0)===1}
function wordStepsDictionaryWord(word){const w=normalizeWord(word);return w.length===4&&WORD_STEPS_SET.has(w)}
function normalizeAnswer(v){
  return String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
}
function deepCutResult(answer,prompt){
  const key=normalizeAnswer(answer); if(!key)return {accepted:false,score:0};
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

async function ensureLeaderboardSchema(env){
  if(!env.DB) return false;
  if(leaderboardSchemaReady) return true;
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
  for(const sql of ["ALTER TABLE leaderboard ADD COLUMN steps_score INTEGER NOT NULL DEFAULT 0","ALTER TABLE leaderboard ADD COLUMN lineup_score INTEGER NOT NULL DEFAULT 0","ALTER TABLE leaderboard ADD COLUMN deepcut_score INTEGER NOT NULL DEFAULT 0"]){try{await env.DB.prepare(sql).run()}catch{}}
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leaderboard_date_score ON leaderboard(date, score DESC)").run();
  leaderboardSchemaReady=true;
  return true;
}
function safeName(v){
  const name=String(v||"").trim().replace(/\s+/g," ").slice(0,20);
  if(!name||!/^([\p{L}\p{N}][\p{L}\p{N} ._'-]{0,19})$/u.test(name)) return null;
  return name;
}
function scoreParts(v){
  const s=v&&typeof v==="object"?v:{};
  const keys=["grid","groups","trail","link","steps","deepcut"], max={grid:6000,groups:1400,trail:100000,link:600,steps:1000,deepcut:800}, out={};
  for(const k of keys){const n=Number(s[k]);if(!Number.isInteger(n)||n<0||n>max[k])return null;out[k]=n}
  return out;
}

async function leaderboardApi(request,env,date,path){
  if(!env.DB) return json({enabled:false,reason:"Leaderboard database is not enabled yet."});
  try{await ensureLeaderboardSchema(env)}catch(e){return json({enabled:false,reason:"Leaderboard database needs setup."},503)}
  const url=new URL(request.url);
  if(request.method==="GET" && path==="/api/leaderboard"){
    const scope=url.searchParams.get("scope")==="all"?"all":"daily";
    if(scope==="all"){
      const q=await env.DB.prepare(`SELECT player_id, MAX(display_name) AS display_name, SUM(score) AS score, COUNT(*) AS days
        FROM leaderboard GROUP BY player_id ORDER BY score DESC LIMIT 20`).all();
      return json({enabled:true,scope,rows:q.results||[]});
    }
    const q=await env.DB.prepare(`SELECT display_name, score, grid_score, groups_score, trail_score, link_score, steps_score, deepcut_score
      FROM leaderboard WHERE date=? ORDER BY score DESC, updated_at ASC LIMIT 20`).bind(date).all();
    return json({enabled:true,scope,date,rows:q.results||[]});
  }
  if(request.method==="POST" && path==="/api/leaderboard/name"){
    const b=await bodyJson(request), name=safeName(b.name), playerId=String(b.playerId||"");
    if(!name) return json({error:"Choose a leaderboard name using letters, numbers, spaces, apostrophes, dashes, periods, or underscores."},400);
    if(!/^[A-Za-z0-9-]{8,64}$/.test(playerId)) return json({error:"Invalid player ID."},400);
    const result=await env.DB.prepare("UPDATE leaderboard SET display_name=? WHERE player_id=?").bind(name,playerId).run();
    return json({enabled:true,saved:true,name,updated:Number(result?.meta?.changes||0)});
  }
  if(request.method==="POST" && path==="/api/leaderboard/submit"){
    if(date!==pacificDateKey()) return json({error:"Only today's score can be posted."},400);
    const b=await bodyJson(request), name=safeName(b.name), playerId=String(b.playerId||"");
    const scores=scoreParts(b.scores);
    if(!name) return json({error:"Choose a leaderboard name using letters, numbers, spaces, apostrophes, dashes, periods, or underscores."},400);
    if(!/^[A-Za-z0-9-]{8,64}$/.test(playerId)) return json({error:"Invalid player ID."},400);
    if(!scores||b.complete!==true) return json({error:"Finish all six puzzles before posting today's score."},400);
    const total=scores.grid+scores.groups+scores.trail+scores.link+scores.steps+scores.deepcut;
    await env.DB.prepare(`INSERT INTO leaderboard(date,player_id,display_name,score,grid_score,groups_score,trail_score,link_score,steps_score,deepcut_score,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(date,player_id) DO UPDATE SET
        display_name=excluded.display_name,
        score=excluded.score,
        grid_score=excluded.grid_score,
        groups_score=excluded.groups_score,
        trail_score=excluded.trail_score,
        link_score=excluded.link_score,
        steps_score=excluded.steps_score,
        deepcut_score=excluded.deepcut_score,
        updated_at=CURRENT_TIMESTAMP`)
      .bind(date,playerId,name,total,scores.grid,scores.groups,scores.trail,scores.link,scores.steps,scores.deepcut).run();
    // Keep one chosen display name consistent across this player's prior leaderboard entries.
    await env.DB.prepare("UPDATE leaderboard SET display_name=? WHERE player_id=?").bind(name,playerId).run();
    const rankRow=await env.DB.prepare("SELECT 1 + COUNT(*) AS rank FROM leaderboard WHERE date=? AND score>?").bind(date,total).first();
    return json({enabled:true,posted:true,score:total,rank:Number(rankRow?.rank||1)});
  }
  return json({error:"Not found."},404);
}

async function api(request,env){
  const url=new URL(request.url), path=url.pathname;
  const date=allowedDate(request); if(!date) return json({error:"Invalid date."},400);
  if(path==="/api/leaderboard"||path==="/api/leaderboard/submit"||path==="/api/leaderboard/name") return leaderboardApi(request,env,date,path);
  const p=pickDaily(date);
  if(request.method==="GET" && path==="/api/health") return json({ok:true,service:"clue-morning",version:"2.6.3",date:pacificDateKey(),leaderboard:Boolean(env.DB),trailBoards:TRAIL_PUZZLES.length,wordSteps:WORD_STEPS_PUZZLES.length,deepCutPrompts:DEEP_CUT_PROMPTS.length,deepCutDailySets:DEEP_CUT_PUZZLES.length,yearPackStart:YEAR_PACK_START,yearPackDays:YEAR_PACK.length});
  if(request.method==="GET" && path==="/api/daily"){
    const shuffled=shuffle(p.groups.flatMap(g=>g.words),mulberry32(p.gseed+33));
    return json({
      date,resetTimeZone:TZ,
      letter:{length:p.length,maxGuesses:MAX_GUESSES},
      groups:{words:shuffled,mistakesAllowed:4,difficulty:GROUP_SET_DIFFICULTY[p.groupsIndex]||"Medium"},
      trail:{grid:p.trail.grid,minLength:3,seconds:TRAIL_SECONDS},
      link:{clues:p.link.clues,maxGuesses:3},
      steps:{start:p.steps.start,target:p.steps.target,par:p.steps.par,maxMoves:STEPS_MAX_MOVES},
      deepcut:{prompts:p.deepcut.prompts.map(x=>({id:x.id,prompt:x.prompt})),seconds:DEEP_CUT_SECONDS,rounds:DEEP_CUT_ROUNDS,maxScore:800},
      leaderboard:{enabled:Boolean(env.DB)}
    });
  }
  if(request.method==="POST" && path==="/api/letter/guess"){
    const b=await bodyJson(request), guess=normalizeWord(b.guess), attempt=Math.max(1,Number(b.attempt)||1);
    if(guess.length!==p.length) return json({ok:false,error:`Need exactly ${p.length} letters.`},400);
    const feedback=evaluateGuess(guess,p.answer), solved=guess===p.answer;
    return json({ok:true,feedback,solved,...(!solved&&attempt>=MAX_GUESSES?{answer:p.answer}:{})});
  }
  if(request.method==="POST" && path==="/api/letter/reveal"){
    const b=await bodyJson(request); if(Number(b.guesses)<MAX_GUESSES) return json({error:"The answer is revealed after six guesses."},403);
    return json({ok:true,answer:p.answer});
  }
  if(request.method==="POST" && path==="/api/groups/check"){
    const b=await bodyJson(request), selected=Array.isArray(b.words)?b.words.map(normalizeWord):[];
    if(selected.length!==4||new Set(selected).size!==4) return json({ok:false,error:"Choose four different words."},400);
    const key=[...selected].sort().join("|");
    const matchIndex=p.groups.findIndex(g=>[...g.words].sort().join("|")===key),match=matchIndex>=0?groupWithDifficulty(p,matchIndex):null;
    if(match) return json({ok:true,match:true,name:match.name,words:match.words,difficulty:match.difficulty,difficultyLabel:match.difficultyLabel});
    const failed=Number(b.mistakesAfter)>=4;
    return json({ok:true,match:false,...(failed?{solutions:p.groups.map((_,i)=>groupWithDifficulty(p,i))}:{})});
  }
  if(request.method==="POST" && path==="/api/groups/reveal"){
    const b=await bodyJson(request); if(Number(b.mistakes)<4) return json({error:"Solutions are revealed after four mistakes."},403);
    return json({ok:true,solutions:p.groups.map((_,i)=>groupWithDifficulty(p,i))});
  }
  if(request.method==="POST" && path==="/api/trail/check"){
    const b=await bodyJson(request), word=normalizeWord(b.word);
    if(word.length<3) return json({ok:false,error:"Words need at least 3 letters."},400);
    if(!trailPathValid(word,p.trail.grid)) return json({ok:true,accepted:false,reason:"path",length:word.length});
    const accepted=trailDictionaryWord(word,p.trail);
    return json({ok:true,accepted,reason:accepted?"word":"dictionary",length:word.length});
  }
  if(request.method==="POST" && path==="/api/trail/reveal"){
    const b=await bodyJson(request); if(b.finished!==true) return json({error:"The longest word is revealed when time expires."},403);
    return json({ok:true,longest:p.trail.longest});
  }
  if(request.method==="POST" && path==="/api/link/guess"){
    const b=await bodyJson(request), guess=normalizeWord(b.guess), attempt=Math.max(1,Number(b.attempt)||1), solved=guess===p.link.answer;
    return json({ok:true,solved,...(solved||attempt>=3?{answer:p.link.answer,note:p.link.note}:{})});
  }
  if(request.method==="POST" && path==="/api/link/reveal"){
    const b=await bodyJson(request); if(Number(b.guesses)<3) return json({error:"The answer is revealed after three guesses."},403);
    return json({ok:true,answer:p.link.answer,note:p.link.note});
  }
  if(request.method==="POST" && path==="/api/steps/check"){
    const b=await bodyJson(request), previous=normalizeWord(b.previous), guess=normalizeWord(b.guess);
    if(previous.length!==4||guess.length!==4) return json({ok:false,error:"Word Steps uses four-letter words."},400);
    if(!wordStepsDictionaryWord(guess)) return json({ok:true,accepted:false,reason:"dictionary"});
    if(!differsByOne(previous,guess)) return json({ok:true,accepted:false,reason:"change"});
    return json({ok:true,accepted:true,solved:guess===p.steps.target});
  }
  if(request.method==="POST" && path==="/api/steps/reveal"){
    const b=await bodyJson(request); if(b.finished!==true) return json({error:"Finish or give up before revealing the path."},403);
    return json({ok:true,solution:p.steps.solution});
  }
  if(request.method==="POST" && path==="/api/deepcut/check"){
    const b=await bodyJson(request),promptId=String(b.promptId||""),prompt=p.deepcut.prompts.find(x=>x.id===promptId);
    if(!prompt)return json({ok:false,error:"That prompt is not part of today's Deep Cut."},400);
    return json({ok:true,...deepCutResult(b.answer,prompt)});
  }
  return json({error:"Not found."},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")) return api(request,env);
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    if(request.mode==="navigate" || url.pathname==="/" || url.pathname.endsWith(".html") || ["/app.js","/styles.css","/sw.js"].includes(url.pathname)){
      headers.set("Cache-Control","no-store, max-age=0, must-revalidate");
    }
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};

export { pickDaily, evaluateGuess, trailPathValid, trailDictionaryWord, wordStepsDictionaryWord, differsByOne, deepCutResult, pacificDateKey, safeName, scoreParts };
