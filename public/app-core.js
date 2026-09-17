const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORAGE_KEY="clue-morning-state-v2.4";
const PLAYER_KEY="clue-morning-player-id";
const NAME_KEY="clue-morning-leader-name";
const THEME_KEY="clue-morning-theme";
const LAST_VISIT_KEY="clue-morning-last-visit-local-date";
const UNLIMITED_KEY="clue-morning-unlimited-access-code";
const UNLIMITED_HISTORY_KEY="clue-morning-unlimited-history-v1";
const DAILY_CACHE_KEY="clue-morning-daily-cache-v1";
const THEMES={paper:{name:"Morning Paper",color:"#f7f1e5"},bloom:{name:"Dawn Bloom",color:"#fff5f3"},blue:{name:"Blue Hour",color:"#f3f7fa"},hearth:{name:"Hearth",color:"#fff5e8"},lavender:{name:"Lavender Haze",color:"#faf7ff"}};
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return {}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function api(path,body=null){
  if(unlimitedSession&&body&&/^\/api\/(letter|groups|trail|link|steps|deepcut)\//.test(path)){
    path=path.replace('/api/','/api/unlimited/');body={...body,code:unlimitedCode(),slot:unlimitedSession.slot,game:unlimitedSession.game};
  }
  const opt=body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{};
  return fetch(path,opt).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Request failed");return j});
}
function pacificDateKey(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function readDailyCache(){
  try{const cached=JSON.parse(localStorage.getItem(DAILY_CACHE_KEY)||'null');return cached?.data?.date?cached:null}catch{return null}
}
function writeDailyCache(data){
  try{localStorage.setItem(DAILY_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch{}
}
async function requestDaily(timeoutMs=12000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch('/api/daily',{cache:'no-store',signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Today's set is not available yet.");
    writeDailyCache(data);return data;
  }finally{clearTimeout(timer)}
}
async function loadDaily(){
  const cached=readDailyCache(),today=pacificDateKey();
  if(cached?.data?.date===today)return cached.data;
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{return await requestDaily()}catch(error){lastError=error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,180))}
  }
  throw new Error(lastError?.name==='AbortError'?"Today's set took too long to respond.":"Today's set could not be reached.");
}
function fmtTime(sec){sec=Math.max(0,Math.floor(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`}
function dateObj(key){return new Date(key+"T12:00:00")}
function svg(id){return `<svg class="icon"><use href="#${id}"/></svg>`}

function localDateKey(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function timeGreeting(d=new Date()){
  const hour=d.getHours();
  if(hour>=5&&hour<12)return "Good morning.";
  if(hour>=12&&hour<17)return "Good afternoon.";
  return "Good evening.";
}
function updateDayGreeting(){
  const el=$('#dayGreeting');
  if(!el)return;
  const today=localDateKey();
  let last='';
  try{last=localStorage.getItem(LAST_VISIT_KEY)||''}catch{}
  el.textContent=last===today?'Welcome Back!':timeGreeting();
  try{localStorage.setItem(LAST_VISIT_KEY,today)}catch{}
}

function activeTheme(){const saved=localStorage.getItem(THEME_KEY)||document.documentElement.dataset.theme||'paper';return THEMES[saved]?saved:'paper'}
function applyTheme(key,persist=true){if(!THEMES[key])key='paper';document.documentElement.dataset.theme=key;if(persist)localStorage.setItem(THEME_KEY,key);const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=THEMES[key].color;$$('[data-theme-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.themeChoice===key));const btn=$('#themeButton');if(btn)btn.title=`Color theme: ${THEMES[key].name}`}
applyTheme(activeTheme(),false);
updateDayGreeting();

let state=loadState();state.days??={};
let daily=null,day=null,currentDateKey=null,letterTimer=null,trailTick=null,deepCutTick=null,deepCutBusy=false,trailPath=[],trailDragging=false,trailPointerId=null,leaderScope="daily",leaderAutoPosting=false;
let dailyRoot=null,dayRoot=null,currentDateRoot=null,unlimitedSession=null,unlimitedActive=false,unlimitedCounts={},linkReturnTab="today",deepCutReturnTab="today",stepsReturnTab="today";
const DAILY_GAMES=["letter","groups","trail","link","steps","deepcut"];

function randomPlayerId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  if(crypto.getRandomValues){
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function getPlayerId(){
  let id=localStorage.getItem(PLAYER_KEY);
  if(!id){id=randomPlayerId();localStorage.setItem(PLAYER_KEY,id)}
  return id;
}
function allDone(){return day&&DAILY_GAMES.every(g=>day[g]?.done)}
function totalScore(){return day?DAILY_GAMES.reduce((n,g)=>n+(day[g]?.score||0),0):0}
function statusMarkup(done){return `${svg(done?"i-check":"i-play")}${done?"DONE":"PLAY"}`}
function setStatus(id,done){const el=$(id);el.classList.toggle("done",done);el.innerHTML=statusMarkup(done)}

function immersiveSessionIs(id){
  return document.documentElement.dataset.gameSession===id&&!!$('#'+id)?.classList.contains('active');
}
function visualGameActive(id){
  const dedicated=document.documentElement.dataset.gamePage||'';
  if(dedicated)return dedicated===id;
  return immersiveSessionIs(id)||!!$('#'+id)?.classList.contains('active');
}
function syncLinkImmersive({repairScroll=false}={}){
  const shouldBeImmersive=immersiveSessionIs('link');
  const wasImmersive=document.documentElement.classList.contains('link-immersive');
  document.documentElement.classList.toggle('link-immersive',shouldBeImmersive);
  if(shouldBeImmersive)void warmLinkSwitchboard();
  if(repairScroll&&wasImmersive&&!shouldBeImmersive)window.scrollTo({top:0,behavior:'auto'});
  return shouldBeImmersive;
}
function syncDeepCutImmersive({repairScroll=false}={}){
  const shouldBeImmersive=immersiveSessionIs('deepcut');
  const wasImmersive=document.documentElement.classList.contains('deepcut-immersive');
  document.documentElement.classList.toggle('deepcut-immersive',shouldBeImmersive);
  if(shouldBeImmersive)requestAnimationFrame(renderDeepCutArchive);
  if(repairScroll&&wasImmersive&&!shouldBeImmersive)window.scrollTo({top:0,behavior:'auto'});
  return shouldBeImmersive;
}
function syncStepsImmersive({repairScroll=false}={}){
  const shouldBeImmersive=immersiveSessionIs('steps');
  const wasImmersive=document.documentElement.classList.contains('steps-immersive');
  document.documentElement.classList.toggle('steps-immersive',shouldBeImmersive);
  if(shouldBeImmersive){void warmStepsRooftops();requestAnimationFrame(()=>stepsSyncRooftopsPosition())}
  if(repairScroll&&wasImmersive&&!shouldBeImmersive)window.scrollTo({top:0,behavior:'auto'});
  return shouldBeImmersive;
}
function syncImmersiveShell(options={}){
  const link=syncLinkImmersive(options);
  const deep=syncDeepCutImmersive(options);
  const steps=syncStepsImmersive(options);
  return link||deep||steps;
}
function selectTab(id){
  if(id==='today')delete document.documentElement.dataset.gameSession;
  else if(['groups','trail','link','steps','deepcut','letter'].includes(id))document.documentElement.dataset.gameSession=id;
  const previous=$(".tab.active")?.dataset.tab||"today";
  if(id==="link"&&previous!=="link")linkReturnTab=previous;
  if(id==="deepcut"&&previous!=="deepcut")deepCutReturnTab=previous;
  if(id==="steps"&&previous!=="steps")stepsReturnTab=previous;
  if(unlimitedSession&&id!==unlimitedSession.game&&id!=="unlimited")restoreDailyContext();
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
  syncImmersiveShell();
  window.scrollTo({top:0,behavior:(id==="link"||id==="deepcut"||id==="steps")?"auto":"smooth"});
  if(id==="archive")renderArchive();
  if(id==="leaders")loadLeaderboard();
  if(id==="unlimited")renderUnlimitedLibrary();
  if(id==="link"){void warmLinkSwitchboard();requestAnimationFrame(renderLink)}
  if(id==="deepcut"){warmDeepCutArchive();requestAnimationFrame(renderDeepCutArchive)}
  if(id==="steps"){void warmStepsRooftops();requestAnimationFrame(()=>stepsSyncRooftopsPosition())}
}
document.querySelectorAll('.tab[data-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.open)));
let immersivePanelSyncQueued=false;
const queueImmersivePanelSync=()=>{
  if(immersivePanelSyncQueued)return;immersivePanelSyncQueued=true;
  requestAnimationFrame(()=>{
    immersivePanelSyncQueued=false;
    const activePanel=document.querySelector('.panel.active')?.id||'';
    const session=document.documentElement.dataset.gameSession||'';
    if(session&&activePanel!==session)delete document.documentElement.dataset.gameSession;
    syncImmersiveShell({repairScroll:true});
  });
};
document.querySelectorAll('.panel').forEach(panel=>new MutationObserver(queueImmersivePanelSync).observe(panel,{attributes:true,attributeFilter:['class']}));
$('#linkExit')?.addEventListener('click',()=>{if(unlimitedSession)exitUnlimited(true);else selectTab(linkReturnTab||'today')});
$('#deepCutExit')?.addEventListener('click',()=>{if(unlimitedSession)exitUnlimited(true);else selectTab(deepCutReturnTab||'today')});
$('#stepsExit')?.addEventListener('click',()=>{if(unlimitedSession)exitUnlimited(true);else selectTab(stepsReturnTab||'today')});
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(document.documentElement.classList.contains('link-immersive'))$('#linkExit')?.click();
  else if(document.documentElement.classList.contains('deepcut-immersive'))$('#deepCutExit')?.click();
  else if(document.documentElement.classList.contains('steps-immersive'))$('#stepsExit')?.click();
});
window.addEventListener('pageshow',()=>syncImmersiveShell({repairScroll:true}));
window.addEventListener('popstate',()=>requestAnimationFrame(()=>syncImmersiveShell({repairScroll:true})));
window.addEventListener('hashchange',()=>requestAnimationFrame(()=>syncImmersiveShell({repairScroll:true})));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncImmersiveShell({repairScroll:true})});
$('.brand').addEventListener('click',e=>{e.preventDefault();selectTab('today')});
$('#year').textContent=new Date().getFullYear();
$('#themeButton').addEventListener('click',()=>{applyTheme(activeTheme(),false);$('#themeDialog').showModal()});
$$('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.themeChoice,true);$('#themeDialog').close()}));

function currentStreakCount(){
  if(!currentDateKey)return 0;
  const doneDates=Object.entries(state.days).filter(([,v])=>DAILY_GAMES.every(g=>v[g]?.done)).map(([d])=>d);
  let streak=0,cursor=dateObj(currentDateKey);
  for(let i=0;i<370;i++){
    const y=cursor.getFullYear(),m=String(cursor.getMonth()+1).padStart(2,'0'),d=String(cursor.getDate()).padStart(2,'0'),key=`${y}-${m}-${d}`;
    if(doneDates.includes(key)){streak++;cursor.setDate(cursor.getDate()-1)}else if(i===0){cursor.setDate(cursor.getDate()-1)}else break;
  }
  return streak;
}
function updateStreak(){
  $('#streakCount').textContent=currentStreakCount();
}
function updateHome(){
  if(!day)return;
  if(unlimitedSession)return;
  const scores={letter:day.letter?.score||0,groups:day.groups?.score||0,trail:day.trail?.score||0,link:day.link?.score||0,steps:day.steps?.score||0,deepcut:day.deepcut?.score||0};
  $('#homeLetterScore').textContent=scores.letter.toLocaleString();$('#homeGroupScore').textContent=scores.groups.toLocaleString();$('#homeTrailScore').textContent=scores.trail.toLocaleString();$('#homeLinkScore').textContent=scores.link.toLocaleString();$('#homeStepsScore').textContent=scores.steps.toLocaleString();$('#homeDeepCutScore').textContent=scores.deepcut.toLocaleString();
  $('#homeTotalScore').textContent=totalScore().toLocaleString();$('#todayTotal').textContent=totalScore().toLocaleString();
  setStatus('#letterCardStatus',!!day.letter?.done);setStatus('#groupCardStatus',!!day.groups?.done);setStatus('#trailCardStatus',!!day.trail?.done);setStatus('#linkCardStatus',!!day.link?.done);setStatus('#stepsCardStatus',!!day.steps?.done);setStatus('#deepCutCardStatus',!!day.deepcut?.done);
  updateStreak();saveState();void maybeAutoPostLeaderboard();
}

// Letter Grid
function letterPartial(feedback){return feedback.filter(x=>x==='green').length*100+feedback.filter(x=>x==='yellow').length*35}
function letterMultiplier(){return 1+(daily.letter.length-5)*.18}
function letterScore(won,attempt,elapsed,best){let raw=best;if(won){raw+=750+Math.max(0,600-Math.floor(elapsed)*3)+Math.max(0,500-(attempt-1)*100)}return Math.round(raw*letterMultiplier())}
function renderKeyboard(){
  const ranks={gray:1,yellow:2,green:3},grades={};
  for(const g of day.letter.guesses){for(let i=0;i<g.word.length;i++){const ch=g.word[i],grade=g.feedback[i];if(!grades[ch]||ranks[grade]>ranks[grades[ch]])grades[ch]=grade}}
  const el=$('#keyboard');el.innerHTML='';
  for(const letters of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){
    const row=document.createElement('div');row.className='key-row';
    for(const ch of letters){
      const k=document.createElement('button'),label=document.createElement('span');
      k.type='button';k.className=`key ${grades[ch]||''}`;k.dataset.key=ch;k.setAttribute('aria-label','Type '+ch);
      label.textContent=ch;k.appendChild(label);row.appendChild(k);
    }
    el.appendChild(row);
  }
}
function typeLetterKey(ch){
  const input=$('#guessInput');if(!input||input.disabled)return;
  const max=Number(daily?.letter?.length)||input.maxLength||10,key=String(ch||'').trim().toUpperCase();
  if(!/^[A-Z]$/.test(key)||input.value.length>=max)return;
  input.value=(input.value+key).slice(0,max);input.dispatchEvent(new Event('input',{bubbles:true}));
}
$('#keyboard').addEventListener('click',event=>{const key=event.target.closest('.key');if(key)typeLetterKey(key.dataset.key||key.textContent)});
$('#keyboard').addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const key=event.target.closest('.key');if(!key)return;event.preventDefault();typeLetterKey(key.dataset.key||key.textContent)});
function letterDraft(){
  const input=$('#guessInput');
  return (input?.value||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,daily?.letter?.length||0);
}
function renderLetterBoard(){
  if(!day?.letter||!daily?.letter)return;
  const s=day.letter,board=$('#guessBoard'),draft=s.done?'':letterDraft();board.innerHTML='';
  for(const g of s.guesses){const row=document.createElement('div');row.className='guess-row';row.style.gridTemplateColumns=`repeat(${daily.letter.length},auto)`;[...g.word].forEach((ch,i)=>{const t=document.createElement('div');t.className=`tile ${g.feedback[i]}`;t.textContent=ch;row.appendChild(t)});board.appendChild(row)}
  for(let r=s.guesses.length;r<6;r++){
    const row=document.createElement('div');row.className='guess-row'+(!s.done&&r===s.guesses.length?' active-guess-row':'');row.style.gridTemplateColumns=`repeat(${daily.letter.length},auto)`;
    for(let i=0;i<daily.letter.length;i++){const t=document.createElement('div');const active=!s.done&&r===s.guesses.length;t.className='tile'+(active?' draft-tile'+(draft[i]?' filled':''):'');if(active&&draft[i])t.textContent=draft[i];row.appendChild(t)}
    board.appendChild(row);
  }
  board.classList.toggle('typing',document.activeElement===$('#guessInput'));
  const button=$('#guessForm button');if(button)button.disabled=s.done||draft.length!==daily.letter.length;
}
function renderLetter(){
  const s=day.letter,input=$('#guessInput');
  input.disabled=s.done;renderLetterBoard();
  $('#guessCount').textContent=`${s.guesses.length}/6`;$('#letterScore').textContent=s.score.toLocaleString();renderKeyboard();
  if(s.done){$('#timer').textContent=fmtTime(s.elapsed||0);const msg=$('#letterMessage');msg.className=`message ${s.won?'good':'bad'}`;msg.innerHTML=s.won?`Solved — ${s.score.toLocaleString()} points.`:`No solve.${s.answer?`<div class="solution-note">The word was <strong>${s.answer}</strong>.</div>`:''}`}
  updateHome();
}
$('#guessInput').addEventListener('input',e=>{
  const input=e.currentTarget,clean=input.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,daily?.letter?.length||0);if(input.value!==clean)input.value=clean;renderLetterBoard();
});
$('#guessInput').addEventListener('focus',renderLetterBoard);
$('#guessInput').addEventListener('blur',renderLetterBoard);
$('#guessBoard').addEventListener('pointerdown',()=>{if(day?.letter&&!day.letter.done)$('#guessInput').focus({preventScroll:true})});
$('#guessForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.letter;if(s.done)return;const input=$('#guessInput'),guess=letterDraft();
  if(guess.length!==daily.letter.length){$('#letterMessage').textContent=`Need exactly ${daily.letter.length} letters.`;input.focus({preventScroll:true});return}
  if(s.guesses.some(g=>g.word===guess)){ $('#letterMessage').textContent='You already tried that guess.';input.select();return }
  try{
    const attempt=s.guesses.length+1,r=await api('/api/letter/guess',{guess,attempt});s.guesses.push({word:guess,feedback:r.feedback});input.value='';
    const best=Math.max(...s.guesses.map(g=>letterPartial(g.feedback))),elapsed=(Date.now()-s.start)/1000;
    if(r.solved||s.guesses.length>=6){s.done=true;s.won=r.solved;s.elapsed=elapsed;s.answer=r.answer||s.answer||'';s.score=letterScore(r.solved,s.guesses.length,elapsed,best);clearInterval(letterTimer)}else s.score=letterScore(false,s.guesses.length,elapsed,best);
    renderLetter();if(s.done)showResultDialog('letter');else input.focus({preventScroll:true});
  }catch(err){$('#letterMessage').textContent=err.message}
});

// Four Groups
function groupKey(g){return [...g.words].sort().join('|')}
function groupDifficultyInfo(g){
  const key=['easy','medium','hard','tricky'].includes(g?.difficulty)?g.difficulty:'medium';
  const labels={easy:'Easy',medium:'Medium',hard:'Hard',tricky:'Tricky'};return {key,label:g?.difficultyLabel||labels[key]};
}
function groupBox(g,revealed=false){
  const meta=groupDifficultyInfo(g),box=document.createElement('div');box.className=`solved-group difficulty-${meta.key}${revealed?' revealed':''}`;
  box.innerHTML=`<div class="group-result-head"><strong>${g.name}</strong><em>${meta.label}</em></div><span>${g.words.join(' · ')}</span>`;return box;
}
function renderGroups(){
  const s=day.groups,solvedWords=new Set(s.solved.flatMap(x=>x.words)),remaining=s.order.filter(w=>!solvedWords.has(w));
  const solved=$('#solvedGroups');solved.innerHTML='';
  for(const g of s.solved)solved.appendChild(groupBox(g));
  if(s.done&&s.solved.length<4&&Array.isArray(s.solutions)){
    const keys=new Set(s.solved.map(groupKey));for(const g of s.solutions){if(keys.has(groupKey(g)))continue;solved.appendChild(groupBox(g,true))}
  }
  const grid=$('#groupGrid');grid.innerHTML='';
  if(!s.done){for(const w of remaining){const b=document.createElement('button');b.type='button';b.className='word-card'+(s.selection.includes(w)?' selected':'');b.textContent=w;b.addEventListener('click',()=>{if(s.selection.includes(w))s.selection=s.selection.filter(x=>x!==w);else if(s.selection.length<4)s.selection.push(w);renderGroups()});grid.appendChild(b)}}
  $('#groupsFound').textContent=`${s.solved.length}/4`;$('#mistakesLeft').textContent=Math.max(0,4-s.mistakes);$('#groupScore').textContent=s.score.toLocaleString();$('#groupDifficulty').textContent=s.done?(daily.groups.difficulty||'Medium'):'—';$('#submitGroupBtn').disabled=s.done||s.selection.length!==4;$('#shuffleBtn').disabled=s.done;$('#deselectBtn').disabled=s.done;
  if(s.done){const msg=$('#groupMessage');msg.className=`message ${s.solved.length===4?'good':'bad'}`;const diff=daily.groups.difficulty||'Medium';msg.textContent=s.solved.length===4?`All four groups — ${s.score.toLocaleString()} points. ${diff} set.`:`Four mistakes. All solutions are shown above. ${diff} set.`}
  updateHome();
}
$('#submitGroupBtn').addEventListener('click',async()=>{
  const s=day.groups;if(s.selection.length!==4||s.done)return;const mistakesAfter=s.mistakes+1;
  try{const r=await api('/api/groups/check',{words:s.selection,mistakesAfter});if(r.match){s.solved.push({name:r.name,words:r.words,difficulty:r.difficulty,difficultyLabel:r.difficultyLabel});s.score+=250+Math.max(0,(4-s.mistakes)*25);$('#groupMessage').textContent=`${r.name} · ${r.difficultyLabel||''}`.replace(/ · $/,'');s.selection=[];if(s.solved.length===4)s.done=true}else{s.mistakes++;s.selection=[];$('#groupMessage').textContent='Not a group.';if(s.mistakes>=4){s.done=true;s.solutions=r.solutions||[]}}renderGroups();if(s.done)showResultDialog('groups')}catch(err){$('#groupMessage').textContent=err.message}
});
$('#shuffleBtn').addEventListener('click',()=>{const s=day.groups,solved=new Set(s.solved.flatMap(x=>x.words)),r=s.order.filter(w=>!solved.has(w));for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}s.order=[...s.order.filter(w=>solved.has(w)),...r];renderGroups()});
$('#deselectBtn').addEventListener('click',()=>{day.groups.selection=[];renderGroups()});

// Letter Trail
function trailPoints(n){if(n===3)return 100;if(n===4)return 200;if(n===5)return 400;if(n===6)return 700;if(n===7)return 1100;return 1600+(n-8)*300}
function remainingTrail(){return Math.max(0,Math.ceil((day.trail.deadline-Date.now())/1000))}
function adjacent(a,b){const ar=Math.floor(a/4),ac=a%4,br=Math.floor(b/4),bc=b%4;return Math.max(Math.abs(ar-br),Math.abs(ac-bc))===1}
function canExtendTrail(i){return !trailPath.includes(i)&&(!trailPath.length||adjacent(trailPath.at(-1),i))}
function paintTrailSelection(){
  const grid=$('#trailGrid'),cells=[...grid.querySelectorAll('.trail-cell')];
  cells.forEach((cell,i)=>{cell.classList.toggle('selected',trailPath.includes(i));cell.classList.toggle('trail-head',i===trailPath.at(-1))});
  $('#trailCurrent').textContent=trailPath.length?trailPath.map(i=>daily.trail.grid[i]).join(''):'Tap or drag across letters';
}
function startTrailSelection(i,pointerId=null){
  trailDragging=true;trailPointerId=pointerId;
  if(trailPath.length&&canExtendTrail(i))trailPath.push(i);else trailPath=[i];
  paintTrailSelection();
}
function stopTrailSelection(){trailDragging=false;trailPointerId=null}
function trailGestureCandidate(x,y){
  if(!trailPath.length)return null;
  const cells=[...$('#trailGrid').querySelectorAll('.trail-cell')],current=trailPath.at(-1),from=cells[current];if(!from)return null;
  const fr=from.getBoundingClientRect(),fx=fr.left+fr.width/2,fy=fr.top+fr.height/2,dx=x-fx,dy=y-fy,travel=Math.hypot(dx,dy);
  if(travel<Math.min(fr.width,fr.height)*.24)return null;
  const previous=trailPath.length>1?trailPath.at(-2):null;let best=null;
  for(let i=0;i<cells.length;i++){
    if(i!==previous&&(trailPath.includes(i)||!adjacent(current,i)))continue;if(i===previous&&!adjacent(current,i))continue;
    const r=cells[i].getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,vx=cx-fx,vy=cy-fy,len=Math.hypot(vx,vy);if(!len)continue;
    const dot=dx*vx+dy*vy,cos=dot/(travel*len),progress=dot/(len*len);
    if(cos<.72||progress<.34)continue;
    const centerDistance=Math.hypot(x-cx,y-cy)/len,score=cos*2+Math.min(progress,1.2)-centerDistance*.18;
    if(!best||score>best.score)best={index:i,score};
  }
  return best?.index??null;
}
function extendTrailToward(x,y){
  if(!trailDragging)return;
  for(let step=0;step<3;step++){
    const i=trailGestureCandidate(x,y);if(i===null)return;const previous=trailPath.length>1?trailPath.at(-2):null;
    if(i===previous){trailPath.pop();paintTrailSelection();return}
    if(!canExtendTrail(i))return;trailPath.push(i);paintTrailSelection();
  }
}
function renderTrailGrid(){const g=$('#trailGrid');g.innerHTML='';daily.trail.grid.forEach((ch,i)=>{const b=document.createElement('button');b.type='button';b.dataset.index=String(i);b.className='trail-cell';b.textContent=ch;b.disabled=!day.trail.started||day.trail.done;g.appendChild(b)});paintTrailSelection()}
function renderTrail(){
  const s=day.trail;$('#trailFound').textContent=s.words.length;$('#trailScore').textContent=s.score.toLocaleString();$('#trailBest').textContent=s.best||'—';$('#trailIntro').hidden=s.started;$('#trailPlay').hidden=!s.started;$('#trailWords').innerHTML=s.words.map(w=>`<span class="found-word">${w}</span>`).join('');if(s.started&&!s.done)$('#trailTimer').textContent=fmtTime(remainingTrail());
  if(s.done){$('#trailTimer').textContent='0:00';const msg=$('#trailMessage');msg.className='message';msg.innerHTML=`Time — ${s.words.length} words, ${s.score.toLocaleString()} points.${s.longest?`<div class="solution-note">Longest possible word: <strong>${s.longest}</strong> (${s.longest.length})</div>`:''}`}
  renderTrailGrid();updateHome();
}
async function finishTrail(){const s=day.trail;if(s.done&&s.longest){renderTrail();return}s.done=true;clearInterval(trailTick);trailPath=[];try{const r=await api('/api/trail/reveal',{finished:true});s.longest=r.longest||''}catch{}renderTrail();showResultDialog('trail')}
$('#trailStart').addEventListener('click',()=>{const s=day.trail;if(s.started)return;s.started=true;s.deadline=Date.now()+daily.trail.seconds*1000;saveState();renderTrail();trailTick=setInterval(()=>{if(remainingTrail()<=0)finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},1000)});
$('#trailGrid').addEventListener('pointerdown',e=>{const cell=e.target.closest('.trail-cell');if(!cell||!day.trail.started||day.trail.done)return;e.preventDefault();try{$('#trailGrid').setPointerCapture(e.pointerId)}catch{}startTrailSelection(Number(cell.dataset.index),e.pointerId)});
$('#trailGrid').addEventListener('pointermove',e=>{if(!trailDragging||!day.trail.started||day.trail.done||(trailPointerId!==null&&e.pointerId!==trailPointerId))return;e.preventDefault();extendTrailToward(e.clientX,e.clientY)});
$('#trailGrid').addEventListener('pointerup',e=>{if(trailPointerId===e.pointerId){try{$('#trailGrid').releasePointerCapture(e.pointerId)}catch{}stopTrailSelection()}});
$('#trailGrid').addEventListener('pointercancel',stopTrailSelection);
window.addEventListener('pointerup',e=>{if(trailDragging&&trailPointerId===e.pointerId)stopTrailSelection()});
window.addEventListener('pointercancel',stopTrailSelection);
$('#trailClear').addEventListener('click',()=>{trailPath=[];stopTrailSelection();renderTrailGrid()});
$('#trailSubmit').addEventListener('click',async()=>{
  const s=day.trail;if(!trailPath.length||s.done)return;const word=trailPath.map(i=>daily.trail.grid[i]).join('');trailPath=[];
  if(s.words.includes(word)){ $('#trailMessage').textContent=`${word} already counted.`;renderTrail();return }
  try{const r=await api('/api/trail/check',{word});if(r.accepted){s.words.push(word);s.score+=trailPoints(r.length);if(!s.best||word.length>s.best.length)s.best=word;$('#trailMessage').className='message good';$('#trailMessage').textContent=`${word} +${trailPoints(r.length).toLocaleString()}`}else{$('#trailMessage').className='message bad';$('#trailMessage').textContent=r.reason==='path'?`${word} cannot be traced on this board.`:`${word} isn't recognized as an English dictionary word.`}renderTrail()}catch(err){$('#trailMessage').className='message bad';$('#trailMessage').textContent=err.message;renderTrail()}
});

// Triple Link — The Switchboard
let linkSwitchboardPromise=null,linkSwitchboardReady=false;

async function warmLinkSwitchboard(){
  const frame=$('#linkSwitchboardFrame'),img=$('#linkSwitchboardImage');
  if(!frame||!img)return;
  if(linkSwitchboardReady){frame.classList.add('ready');return}
  if(linkSwitchboardPromise)return linkSwitchboardPromise;
  linkSwitchboardPromise=(async()=>{
    try{
      const urls=Array.from({length:10},(_,i)=>'/triple-link-test/final-bg/bg-'+String(i).padStart(2,'0')+'.b64');
      const chunks=await Promise.all(urls.map(async url=>{
        const response=await fetch(url,{cache:'force-cache'});
        if(!response.ok)throw new Error('Switchboard background '+response.status);
        return (await response.text()).trim();
      }));
      await new Promise((resolve,reject)=>{
        const done=()=>{img.removeEventListener('load',done);img.removeEventListener('error',fail);resolve()};
        const fail=()=>{img.removeEventListener('load',done);img.removeEventListener('error',fail);reject(new Error('Switchboard image decode failed'))};
        img.addEventListener('load',done,{once:true});
        img.addEventListener('error',fail,{once:true});
        img.src='data:image/webp;base64,'+chunks.join('');
        if(img.complete&&img.naturalWidth)done();
      });
      linkSwitchboardReady=true;
      frame.classList.add('ready');
    }catch(err){
      console.error('Triple Link Switchboard failed to load',err);
      frame.classList.add('ready');
    }
  })();
  return linkSwitchboardPromise;
}
function linkSanitize(value){return String(value||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,24)}
function linkPotentialScore(s){
  if(s?.done)return s.score||0;
  return [600,400,250,0][Math.max(0,Math.min(3,s?.guesses||0))]||0;
}
function linkFitTextBox(el,minPx=7){
  if(!el)return;
  el.style.fontSize='';
  let size=parseFloat(getComputedStyle(el).fontSize)||16;
  while(size>minPx&&(el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight)){
    size-=.5;el.style.fontSize=size+'px';
  }
}
function fitLinkSwitchboardText(){
  $$('#linkClues .link-clue-live').forEach(el=>linkFitTextBox(el,7));
  linkFitTextBox($('#linkAnswer'),9);
  linkFitTextBox($('#linkMessage'),7);
  if($('#linkResult')?.classList.contains('show'))linkFitTextBox($('#linkResult'),7);
}
function linkSetMessage(text,type=''){
  const msg=$('#linkMessage');if(!msg)return;
  msg.textContent=text;
  msg.className='link-live link-fit link-feedback'+(type?' '+type:'');
  requestAnimationFrame(fitLinkSwitchboardText);
}
function linkSyncPlate(){
  const s=day?.link,plate=$('#linkAnswer'),input=$('#linkInput');
  if(!plate||!input||!s)return;
  plate.textContent=s.done&&s.answer?s.answer:linkSanitize(input.value);
  requestAnimationFrame(()=>linkFitTextBox(plate,9));
}
function linkSyncAttempts(){
  const s=day?.link;if(!s)return;
  const remaining=Math.max(0,3-(s.guesses||0));
  $$('[data-link-attempt]').forEach((el,i)=>el.classList.toggle('on',i<remaining));
}
function linkPulseWrong(){
  const frame=$('#linkSwitchboardFrame');if(!frame)return;
  frame.classList.remove('wrong');void frame.offsetWidth;frame.classList.add('wrong');
  setTimeout(()=>frame.classList.remove('wrong'),260);
  try{navigator.vibrate?.(22)}catch{}
}
function linkPlayWinSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(AudioCtx){
      const ctx=new AudioCtx(),now=ctx.currentTime;
      [[523.25,0],[659.25,.11],[783.99,.22]].forEach(([freq,delay])=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='triangle';osc.frequency.value=freq;
        gain.gain.setValueAtTime(.0001,now+delay);
        gain.gain.exponentialRampToValueAtTime(.075,now+delay+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.48);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now+delay);osc.stop(now+delay+.5);
      });
      setTimeout(()=>ctx.close().catch(()=>{}),1000);
    }
  }catch{}
  try{navigator.vibrate?.([24,24,42])}catch{}
}
function linkPulseSuccess(){
  const frame=$('#linkSwitchboardFrame');if(!frame)return;
  frame.classList.remove('success');void frame.offsetWidth;frame.classList.add('success');
  linkPlayWinSound();
}
function renderLink(){
  const s=day?.link;if(!s||!daily?.link)return;
  if(visualGameActive('link'))void warmLinkSwitchboard();
  const clueClasses=['one','two','three'];
  $('#linkClues').innerHTML=daily.link.clues.map((raw,i)=>{
    const clean=String(raw||'').replace(/_+/g,' ').replace(/\s+/g,' ').trim();
    return `<div class="link-fit link-clue-live ${clueClasses[i]||''}">${escapeHtml(clean)}</div>`;
  }).join('');
  const remaining=Math.max(0,3-(s.guesses||0));
  $('#linkGuesses').textContent=`${remaining}/3`;
  $('#linkScore').textContent=linkPotentialScore(s).toLocaleString();
  $('#linkStreak').textContent=currentStreakCount().toLocaleString();

  const input=$('#linkInput'),connect=$('#linkConnect'),clear=$('#linkClear'),topClear=$('#linkTopClear');
  input.disabled=!!s.done;
  connect.disabled=!!s.done;
  clear.disabled=!!s.done;
  topClear.disabled=!!s.done;
  linkSyncAttempts();
  linkSyncPlate();

  const frame=$('#linkSwitchboardFrame'),result=$('#linkResult'),msg=$('#linkMessage');
  frame.classList.toggle('success',!!(s.done&&s.won));
  $$('#linkClues .link-clue-live').forEach(el=>el.classList.toggle('connected',!!s.done));
  $('#linkAnswer').classList.toggle('locked',!!s.done);

  result.className='link-result';
  result.innerHTML='';
  msg.style.visibility='';
  if(s.done&&s.won){
    msg.style.visibility='hidden';
    result.classList.add('show','win');
    result.innerHTML=
      '<div class="link-win-title">CONNECTED!</div>'+
      '<div class="link-win-links">'+escapeHtml(s.note||s.answer||'')+'</div>'+
      '<div class="link-win-points">+'+(s.score||0).toLocaleString()+'</div>';
  }else if(s.done){
    msg.style.visibility='hidden';
    result.classList.add('show');
    result.innerHTML='<strong>'+escapeHtml(s.answer||'')+'</strong>'+(s.note?' · '+escapeHtml(s.note):'');
  }else if(!msg.textContent.trim()){
    linkSetMessage('Three lines are waiting.');
  }
  requestAnimationFrame(fitLinkSwitchboardText);
  updateHome();
}
$('#linkInput').addEventListener('input',e=>{
  const clean=linkSanitize(e.currentTarget.value);
  if(e.currentTarget.value!==clean)e.currentTarget.value=clean;
  linkSyncPlate();
});
$('#linkForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const s=day.link;if(s.done)return;
  const input=$('#linkInput'),guess=linkSanitize(input.value);
  if(!guess){linkSetMessage('Patch in one word first.','bad');return}
  try{
    const attempt=s.guesses+1,r=await api('/api/link/guess',{guess,attempt});
    s.guesses++;
    input.value='';
    if(r.solved){
      s.won=true;s.done=true;s.answer=r.answer;s.note=r.note;s.score=[0,600,400,250][s.guesses]||250;
      linkSetMessage('Connection complete.','good');
      renderLink();
      linkPulseSuccess();
      setTimeout(()=>showResultDialog('link'),600);
    }else if(s.guesses>=3){
      s.done=true;s.answer=r.answer||'';s.note=r.note||'';s.score=0;
      linkPulseWrong();
      renderLink();
      showResultDialog('link');
    }else{
      linkPulseWrong();
      linkSetMessage(guess+' does not connect all three. Try again.','bad');
      renderLink();
      input.focus();
    }
  }catch(err){
    linkSetMessage(err.message||'Could not check that connection.','bad');
  }
});
function clearLinkEntry(){
  const s=day?.link;if(!s||s.done)return;
  const input=$('#linkInput');input.value='';
  linkSyncPlate();
  linkSetMessage('Three lines are waiting.');
  input.focus();
}
$('#linkClear')?.addEventListener('click',clearLinkEntry);
$('#linkTopClear')?.addEventListener('click',clearLinkEntry);
window.addEventListener('resize',()=>requestAnimationFrame(fitLinkSwitchboardText),{passive:true});

// Word Steps — Rooftops
const STEPS_ROOFTOPS_NODES=[
  {x:50,y:97.03,edge:'ladder'},{x:50,y:85.00,edge:'ladder'},{x:50,y:72.19,edge:'ladder'},
  {x:50,y:61.09,edge:'ladder'},{x:50,y:50.94,edge:'ladder'},{x:50,y:40.63,edge:'ladder'},
  {x:50,y:30.78,edge:'ladder'},{x:50,y:22.19,edge:'ladder'},{x:50,y:17.50,edge:null}
];
const STEPS_ROOFTOPS_LANDING_TWEAK=[0.00,0.06,0.10,0.12,0.12,0.10,0.08,0.05,0.00];
const STEPS_ROOFTOPS_CAMERA=[-51.2,-46.2,-40.0,-33.5,-27.0,-20.5,-14.0,-7.0,0];
let stepsRooftopsPromise=null,stepsRooftopsReady=false,stepsAnimating=false,stepsCurrentNode=0;

function wordStepsScore(moves,par){return Math.max(400,1000-Math.max(0,moves-par)*100)}
function stepsSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function warmStepsRooftops(){
  const stage=$('#stepsRooftopsStage'),img=$('#stepsRooftopsImage');
  if(!stage||!img)return;
  if(stepsRooftopsReady){stage.classList.add('ready');return}
  if(stepsRooftopsPromise)return stepsRooftopsPromise;
  stepsRooftopsPromise=(async()=>{
    try{
      const urls=['/word-steps-rooftops/bg-00.b64','/word-steps-rooftops/bg-01.b64','/word-steps-rooftops/bg-02.b64'];
      const chunks=await Promise.all(urls.map(async url=>{
        const response=await fetch(url,{cache:'force-cache'});
        if(!response.ok)throw new Error('Rooftops background '+response.status);
        return (await response.text()).trim();
      }));
      await new Promise((resolve,reject)=>{
        const done=()=>{img.removeEventListener('load',done);img.removeEventListener('error',fail);resolve()};
        const fail=()=>{img.removeEventListener('load',done);img.removeEventListener('error',fail);reject(new Error('Rooftops image decode failed'))};
        img.addEventListener('load',done,{once:true});
        img.addEventListener('error',fail,{once:true});
        img.src='data:image/webp;base64,'+chunks.join('');
        if(img.complete&&img.naturalWidth)done();
      });
      stepsRooftopsReady=true;
      stage.classList.add('ready');
    }catch(err){
      console.error('Word Steps Rooftops failed to load',err);
      stage.classList.add('ready');
    }
  })();
  return stepsRooftopsPromise;
}
function stepsNodeForState(){
  const s=day?.steps;if(!s)return 0;
  if(s.won&&s.path?.at(-1)===daily?.steps?.target)return 8;
  return Math.min(Math.max(0,(s.path?.length||1)-1),7);
}
function stepsSetCamera(i){
  const world=$('#stepsRooftopsWorld');if(!world)return;
  const node=Math.max(0,Math.min(8,i));
  world.style.transform='translateY('+STEPS_ROOFTOPS_CAMERA[node]+'%)';
}
function stepsSetPosition(i){
  const climber=$('#stepsClimber');if(!climber)return;
  const node=Math.max(0,Math.min(8,i)),n=STEPS_ROOFTOPS_NODES[node];
  climber.style.left=n.x+'%';
  climber.style.top=(n.y+STEPS_ROOFTOPS_LANDING_TWEAK[node])+'%';
}
function stepsSyncRooftopsPosition(){
  if(!day?.steps||stepsAnimating)return;
  stepsCurrentNode=stepsNodeForState();
  stepsSetPosition(stepsCurrentNode);
  stepsSetCamera(stepsCurrentNode);
}
function stepsFace(from,to){
  const climber=$('#stepsClimber');if(!climber)return;
  climber.classList.toggle('facing-left',STEPS_ROOFTOPS_NODES[to].x<STEPS_ROOFTOPS_NODES[from].x);
}
function stepsRenderRooftopsPath(){
  const s=day?.steps,layer=$('#stepsPath');if(!s||!layer||!daily?.steps)return;
  layer.innerHTML='';
  const targetWord=daily.steps.target;
  s.path.forEach((word,i)=>{
    const node=word===targetWord?8:Math.min(i,7),n=STEPS_ROOFTOPS_NODES[node],el=document.createElement('span');
    el.className='step-word'+(node===stepsCurrentNode?' current':'')+(node!==0&&node!==4&&node!==8?' micro':'');
    el.textContent=word;
    const side=node===0||node===8?50:(node%2?35.5:64.5);
    el.style.left=side+'%';
    el.style.top=n.y+'%';
    layer.appendChild(el);
  });
  if(s.path.at(-1)!==targetWord){
    const n=STEPS_ROOFTOPS_NODES[8],target=document.createElement('span');
    target.className='step-word target';
    target.textContent=targetWord;
    target.style.left='50%';
    target.style.top=n.y+'%';
    layer.appendChild(target);
  }
}
function stepsDisableControls(disabled=true){
  const s=day?.steps;
  const input=$('#stepsInput'),submit=$('#stepsForm button'),undo=$('#stepsUndo');
  if(input)input.disabled=disabled||!!s?.done;
  if(submit)submit.disabled=disabled||!!s?.done;
  if(undo)undo.disabled=disabled||!!s?.done||(s?.path?.length||0)<=1;
}
async function stepsMoveCharacter(to,{fast=false}={}){
  const climber=$('#stepsClimber');
  to=Math.max(0,Math.min(8,to));
  if(to===stepsCurrentNode){stepsSetPosition(to);stepsSetCamera(to);return}
  if(!climber){stepsCurrentNode=to;return}
  const from=stepsCurrentNode,factor=fast?.68:1;
  stepsAnimating=true;
  stepsDisableControls(true);
  stepsFace(from,to);
  climber.classList.remove('walking','climbing','hopping');
  const mode=STEPS_ROOFTOPS_NODES[Math.min(from,7)].edge||'ladder';
  if(mode==='walk')climber.classList.add('walking');
  else if(mode==='hop')climber.classList.add('hopping');
  else climber.classList.add('climbing');
  stepsSetCamera(to);
  stepsSetPosition(to);
  await stepsSleep((mode==='hop'?390:560)*factor);
  stepsCurrentNode=to;
  climber.classList.remove('walking','climbing','hopping');
  stepsAnimating=false;
}
async function stepsSummitRun(){
  while(stepsCurrentNode<8)await stepsMoveCharacter(stepsCurrentNode+1,{fast:true});
}
function renderSteps(){
  const s=day.steps,moves=Math.max(0,s.path.length-1),shownScore=s.done?s.score:wordStepsScore(moves,daily.steps.par);
  $('#stepsMoves').textContent=`${moves}/${daily.steps.maxMoves}`;
  $('#stepsPar').textContent=daily.steps.par;
  $('#stepsScore').textContent=shownScore.toLocaleString();
  $('#stepsStatus').textContent=s.done?(s.won?'SOLVED':'REVEALED'):'OPEN';
  $('#stepsStart').textContent=daily.steps.start;
  $('#stepsTarget').textContent=daily.steps.target;
  if(visualGameActive('steps'))void warmStepsRooftops();
  if(!stepsAnimating)stepsSyncRooftopsPosition();
  stepsRenderRooftopsPath();
  stepsDisableControls(stepsAnimating);
  if(s.done){
    const msg=$('#stepsMessage');
    msg.className=`message ${s.won?'good':'bad'}`;
    msg.innerHTML=s.won?`Reached ${daily.steps.target} in ${moves} move${moves===1?'':'s'} — ${s.score.toLocaleString()} points.`:`Path revealed.${s.solution?.length?`<div class="solution-note">${s.solution.map(escapeHtml).join(' → ')}</div>`:''}`;
  }
  updateHome();
}
async function revealSteps(){
  const s=day.steps;
  if(s.done&&s.solution?.length){renderSteps();return}
  try{const r=await api('/api/steps/reveal',{finished:true});s.solution=r.solution||[]}catch{}
  s.done=true;s.won=false;s.score=0;renderSteps();showResultDialog('steps');
}
$('#stepsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const s=day.steps;if(s.done||stepsAnimating)return;
  const input=$('#stepsInput'),guess=input.value.trim().toUpperCase().replace(/[^A-Z]/g,'');
  if(guess.length!==4){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent='Enter exactly four letters.';return}
  const previous=s.path.at(-1);
  if(s.path.includes(guess)){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent='That word is already in your path.';return}
  try{
    const r=await api('/api/steps/check',{previous,guess});
    if(!r.accepted){
      $('#stepsMessage').className='message bad';
      $('#stepsMessage').textContent=r.reason==='change'?`Change exactly one letter from ${previous}.`:`${guess} isn't in the Word Steps dictionary.`;
      return;
    }
    s.path.push(guess);input.value='';
    const moves=s.path.length-1;
    stepsRenderRooftopsPath();
    stepsDisableControls(true);
    if(r.solved){
      $('#stepsMessage').className='message good';
      $('#stepsMessage').textContent='Target found. Take the roof.';
      await stepsSummitRun();
      s.done=true;s.won=true;s.score=wordStepsScore(moves,daily.steps.par);
      renderSteps();
      showResultDialog('steps');
      return;
    }
    const next=Math.min(moves,7);
    await stepsMoveCharacter(next);
    if(moves>=daily.steps.maxMoves){await revealSteps();return}
    $('#stepsMessage').className='message good';
    $('#stepsMessage').textContent=`${guess} holds. Keep climbing.`;
    renderSteps();
  }catch(err){
    stepsAnimating=false;
    $('#stepsMessage').className='message bad';
    $('#stepsMessage').textContent=err.message;
    renderSteps();
  }
});
$('#stepsUndo').addEventListener('click',async()=>{
  const s=day.steps;if(s.done||s.path.length<=1||stepsAnimating)return;
  s.path.pop();
  stepsRenderRooftopsPath();
  stepsDisableControls(true);
  await stepsMoveCharacter(Math.max(0,stepsCurrentNode-1),{fast:true});
  $('#stepsMessage').className='message';
  $('#stepsMessage').textContent='Dropped back one rooftop.';
  renderSteps();
});

// Deep Cut
const DEEPCUT_ARCHIVE_LANDINGS=[
  {scene:0,y:.185,zone:'Newsroom Lobby'},
  {scene:0,y:.375,zone:'City Desk'},
  {scene:0,y:.565,zone:'Copy Desk'},
  {scene:0,y:.755,zone:'Print Floor'},
  {scene:0,y:.945,zone:'Morgue Files'},
  {scene:1,y:.941,zone:'Reference Hall'},
  {scene:2,y:.227,zone:'Natural History'},
  {scene:2,y:.488,zone:'Clockwork Museum'},
  {scene:2,y:.756,zone:'Specimen Vault'},
  {scene:2,y:.987,zone:'Deep Stacks'},
  {scene:3,y:.158,zone:'Atlas Gallery'},
  {scene:3,y:.326,zone:'Fossil Hall'},
  {scene:3,y:.495,zone:'Botanical Cabinet'},
  {scene:3,y:.671,zone:'Orrery Hall'},
  {scene:3,y:.832,zone:'Submerged Collection'},
  {scene:3,y:.985,zone:'Abyssal Zoology'},
  {scene:4,y:.289,zone:'Forbidden Observatory'},
  {scene:4,y:.547,zone:'Relic Gallery'},
  {scene:4,y:.842,zone:'Astral Stacks'},
  {scene:5,y:.132,zone:'Celestial Archive'},
  {scene:5,y:.286,zone:'Meteor Vault'},
  {scene:5,y:.405,zone:'Impossible Index'},
  {scene:5,y:.575,zone:'Black Shelf'},
  {scene:5,y:.724,zone:'Final Catalog'},
  {scene:5,y:.865,zone:'The Final Shelf'}
];
const DEEPCUT_ARCHIVE_FEET_PER_FLOOR=675;

function deepCutArchiveFloorsForScore(score){
  score=Number(score)||0;
  if(score>=85)return 3;
  if(score>=60)return 2;
  if(score>=30)return 1;
  return 0;
}
function deepCutArchiveStop(s=day?.deepcut){
  return Math.min(24,(s?.answers||[]).reduce((n,a)=>n+(a?.accepted?deepCutArchiveFloorsForScore(a.score):0),0));
}
function renderDeepCutArchive(){
  const s=day?.deepcut,stage=$('#deepCutArchiveStage'),world=$('#deepCutArchiveWorld'),stack=$('#deepCutArchiveStack'),elevator=$('#deepCutArchiveElevator');
  if(!s||!stage||!world||!stack||!elevator||stage.clientWidth<2||stage.clientHeight<2)return;
  const scenes=[...stack.querySelectorAll('.deepcut-archive-scene')],stop=deepCutArchiveStop(s),item=DEEPCUT_ARCHIVE_LANDINGS[stop],scene=scenes[item.scene];
  if(!scene||scene.offsetHeight<2)return;
  const landingY=scene.offsetTop+(scene.offsetHeight*item.y),pitch=scene.offsetHeight*Number(scene.dataset.pitch||.2);
  const carHeight=Math.max(92,Math.min(210,pitch*.86));
  elevator.style.height=Math.round(carHeight)+'px';
  const anchor=Math.min(stage.clientHeight*.53,stage.clientHeight-112),desiredWorldY=anchor-landingY,worldY=Math.min(8,desiredWorldY);
  world.style.transform='translate3d(-50%,'+Math.round(worldY)+'px,0)';
  const landingScreenY=worldY+landingY;
  elevator.style.top=Math.round(landingScreenY-(carHeight/2)+2)+'px';
  const depth=$('#deepCutArchiveDepth'),zone=$('#deepCutArchiveZone'),doneDepth=$('#deepCutDoneDepth'),doneZone=$('#deepCutDoneZone');
  if(depth)depth.textContent=(stop*DEEPCUT_ARCHIVE_FEET_PER_FLOOR).toLocaleString();
  if(zone)zone.textContent=item.zone;
  if(doneDepth)doneDepth.textContent=String(stop);
  if(doneZone)doneZone.textContent=item.zone;
}
let deepCutArchiveWarmed=false,deepCutArchiveResizeRaf=0;
function warmDeepCutArchive(){
  if(deepCutArchiveWarmed)return;
  const stack=$('#deepCutArchiveStack');if(!stack)return;
  deepCutArchiveWarmed=true;
  for(const img of stack.querySelectorAll('img[loading="lazy"]')){const preload=new Image();preload.src=img.src}
}
function deepCutArchivePulse(score){
  if((Number(score)||0)<85)return;
  const flash=$('#deepCutArchiveFlash');if(!flash)return;
  flash.classList.remove('on');
  requestAnimationFrame(()=>{flash.classList.add('on');setTimeout(()=>flash.classList.remove('on'),120)});
}
function remainingDeepCut(){const s=day.deepcut;return s?.deadline?Math.max(0,(s.deadline-Date.now())/1000):(daily?.deepcut?.seconds||25)}
function deepCutPrompt(){return daily.deepcut.prompts[day.deepcut.round]||null}
function renderDeepCut(){
  const s=day.deepcut,total=daily.deepcut.rounds||8,roundShown=s.done?total:Math.min(total,s.round+1);
  $('#deepCutRound').textContent=`${roundShown}/${total}`;$('#deepCutScore').textContent=(s.score||0).toLocaleString();$('#deepCutTimer').textContent=s.started&&!s.done?fmtTime(remainingDeepCut()):'0:25';$('#deepCutStatus').textContent=s.done?'DONE':s.started?'LIVE':'READY';
  $('#deepCutIntro').hidden=s.started||s.done;$('#deepCutPlay').hidden=!s.started||s.done;$('#deepCutDone').hidden=!s.done;
  const current=deepCutPrompt();if(current)$('#deepCutPrompt').textContent=current.prompt;
  const history=$('#deepCutHistory');history.innerHTML='';
  for(const a of s.answers){
    const row=document.createElement('div'),floors=a.accepted?deepCutArchiveFloorsForScore(a.score):0;row.className='deepcut-result';const badge=a.accepted?(a.tier||'ACCEPTED'):(a.timedOut?'TIME':'MISS');
    row.innerHTML=`<div><span class="deepcut-tier ${String(badge).toLowerCase()}">${escapeHtml(badge)}</span><strong>${escapeHtml(a.answer||'No answer')}</strong><small>${escapeHtml(a.prompt||'')}</small></div><b>+${Number(a.score||0)}${floors?` · ↓${floors}`:''}</b>`;history.appendChild(row)
  }
  const input=$('#deepCutInput'),button=$('#deepCutForm button');input.disabled=!s.started||s.done||deepCutBusy;button.disabled=input.disabled;
  if(s.done){$('#deepCutDoneScore').textContent=(s.score||0).toLocaleString();const msg=$('#deepCutMessage');msg.className='message good';msg.textContent=`${unlimitedSession?'Unlimited':'Daily'} Deep Cut complete — ${s.score.toLocaleString()} points.`}
  updateHome();
  if(visualGameActive('deepcut'))requestAnimationFrame(renderDeepCutArchive);
}
function armDeepCutTimer(){clearInterval(deepCutTick);deepCutTick=setInterval(()=>{const s=day?.deepcut;if(!s?.started||s.done){clearInterval(deepCutTick);return}const left=remainingDeepCut();$('#deepCutTimer').textContent=fmtTime(left);if(left<=0)void timeoutDeepCut()},1000)}
function finishDeepCut(){const s=day.deepcut;s.started=false;s.done=true;s.deadline=0;clearInterval(deepCutTick);renderDeepCut();setTimeout(()=>showResultDialog('deepcut'),500)}
async function timeoutDeepCut(){const s=day.deepcut;if(deepCutBusy||!s.started||s.done||remainingDeepCut()>0)return;deepCutBusy=true;const prompt=deepCutPrompt();s.answers.push({promptId:prompt?.id||'',prompt:prompt?.prompt||'',answer:'',accepted:false,timedOut:true,tier:'TIME',score:0});s.round++;$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent='Time. No descent for that prompt.';if(s.round>=daily.deepcut.rounds){deepCutBusy=false;finishDeepCut();return}s.deadline=Date.now()+daily.deepcut.seconds*1000;deepCutBusy=false;renderDeepCut();$('#deepCutInput').focus()}
$('#deepCutStart').addEventListener('click',()=>{const s=day.deepcut;if(s.done)return;warmDeepCutArchive();s.started=true;s.deadline=Date.now()+daily.deepcut.seconds*1000;$('#deepCutMessage').className='message';$('#deepCutMessage').textContent='Think past the first obvious answer. The Archive rewards deeper cuts.';renderDeepCut();armDeepCutTimer();$('#deepCutInput').focus()});
$('#deepCutForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.deepcut;if(deepCutBusy||!s.started||s.done)return;const prompt=deepCutPrompt(),input=$('#deepCutInput'),answer=input.value.trim();if(!answer){$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent='Type one answer before you submit.';return}deepCutBusy=true;input.disabled=true;
  try{
    const r=await api('/api/deepcut/check',{promptId:prompt.id,answer}),msg=$('#deepCutMessage');
    if(!r.accepted){
      input.value='';deepCutBusy=false;input.disabled=false;msg.className='message bad';msg.textContent=`${answer} wasn't accepted. Keep guessing — the clock is still running.`;
      if(remainingDeepCut()<=0){void timeoutDeepCut();return}input.focus();return;
    }
    const item={promptId:prompt.id,prompt:prompt.prompt,answer:r.canonical||answer,accepted:true,tier:r.tier||'COMMON',score:Number(r.score||0)};
    const floors=deepCutArchiveFloorsForScore(item.score);
    s.answers.push(item);s.score+=item.score;s.round++;input.value='';msg.className='message good';msg.textContent=`${item.tier}: ${item.answer} — +${item.score} · ${floors} floor${floors===1?'':'s'} deeper`;
    if(s.round>=daily.deepcut.rounds){deepCutBusy=false;finishDeepCut();deepCutArchivePulse(item.score);return}
    s.deadline=Date.now()+daily.deepcut.seconds*1000;deepCutBusy=false;renderDeepCut();deepCutArchivePulse(item.score);$('#deepCutInput').focus();
  }catch(err){deepCutBusy=false;input.disabled=false;$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent=err.message}
});
window.addEventListener('resize',()=>{
  if(!$('#deepcut')?.classList.contains('active'))return;
  cancelAnimationFrame(deepCutArchiveResizeRaf);
  deepCutArchiveResizeRaf=requestAnimationFrame(renderDeepCutArchive);
},{passive:true});


// Leaderboard
function leaderboardName(){try{return localStorage.getItem(NAME_KEY)||''}catch{return ''}}
function placeholderLeaderboardName(){const compact=getPlayerId().replace(/[^A-Za-z0-9]/g,'').toUpperCase();return `Player ${compact.slice(-4)||'0000'}`}
function leaderboardDisplayName(){return leaderboardName()||placeholderLeaderboardName()}
function scorePayload(){return {grid:day.letter.score||0,groups:day.groups.score||0,trail:day.trail.score||0,link:day.link.score||0,steps:day.steps.score||0,deepcut:day.deepcut.score||0}}
function updateLeaderboardIdentity(){
  const saved=leaderboardName(),fallback=placeholderLeaderboardName(),input=$('#leaderName'),label=$('#leaderPlaceholderName');
  if(input&&document.activeElement!==input)input.value=saved;
  if(label)label.textContent=fallback;
}
async function maybeAutoPostLeaderboard(force=false){
  if(!daily?.leaderboard?.enabled||!allDone()||leaderAutoPosting)return;
  const name=leaderboardDisplayName(),score=totalScore(),previous=day.leaderboardPost||{};
  if(!force&&previous.date===currentDateKey&&previous.name===name&&previous.score===score)return;
  leaderAutoPosting=true;
  try{
    const r=await api('/api/leaderboard/submit',{playerId:getPlayerId(),name,scores:scorePayload(),complete:true});
    if(!r.enabled)return;
    day.leaderboardPost={date:currentDateKey,name,score,postedAt:Date.now()};saveState();
    const msg=$('#leaderMessage');if(msg){msg.className='message good';msg.textContent=`Score posted automatically as ${name} — currently #${r.rank} today.`}
    if($('#leaders')?.classList.contains('active'))loadLeaderboard();
  }catch(err){
    const msg=$('#leaderMessage');if(msg&&$('#leaders')?.classList.contains('active')){msg.className='message bad';msg.textContent=err.message}
  }finally{leaderAutoPosting=false}
}
async function loadLeaderboard(){
  if(!daily)return;const list=$('#leaderboardList');list.innerHTML='<div class="empty-state">Loading leaderboard…</div>';
  try{const r=await api(`/api/leaderboard?scope=${leaderScope}&date=${currentDateKey}`);if(!r.enabled){list.innerHTML='<div class="empty-state">Leaderboard is ready in the site code, but its Cloudflare D1 database has not been enabled yet.</div>';return}if(!r.rows.length){list.innerHTML='<div class="empty-state">No scores yet. First place is wide open.</div>';return}list.innerHTML='';r.rows.forEach((row,i)=>{const el=document.createElement('div');el.className='leader-row';const sub=leaderScope==='daily'?`Grid ${row.grid_score} · Groups ${row.groups_score} · Trail ${row.trail_score} · Link ${row.link_score} · Steps ${row.steps_score||0} · Deep Cut ${row.deepcut_score||0}`:`${row.days} completed day${Number(row.days)===1?'':'s'}`;el.innerHTML=`<span class="leader-rank">${i+1}</span><div><div class="leader-name">${escapeHtml(row.display_name)}</div><div class="leader-sub">${sub}</div></div><div class="leader-score">${Number(row.score).toLocaleString()}</div>`;list.appendChild(el)})}catch(err){list.innerHTML=`<div class="empty-state">${escapeHtml(err.message)}</div>`}
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
updateLeaderboardIdentity();
$('#saveLeaderName').addEventListener('click',async()=>{const name=$('#leaderName').value.trim().replace(/\s+/g,' ').slice(0,20);if(!name){$('#leaderMessage').className='message bad';$('#leaderMessage').textContent='Choose a leaderboard name first.';return}localStorage.setItem(NAME_KEY,name);updateLeaderboardIdentity();const msg=$('#leaderMessage');msg.className='message good';msg.textContent=`Saved as ${name}.`;try{if(daily?.leaderboard?.enabled)await api('/api/leaderboard/name',{playerId:getPlayerId(),name})}catch(err){msg.className='message bad';msg.textContent=`Name saved on this device, but the leaderboard update failed: ${err.message}`;return}if(allDone())void maybeAutoPostLeaderboard(true);else if($('#leaders')?.classList.contains('active'))loadLeaderboard()});
$('#refreshLeaders').addEventListener('click',loadLeaderboard);$$('.leader-toggle').forEach(b=>b.addEventListener('click',()=>{leaderScope=b.dataset.board;$$('.leader-toggle').forEach(x=>x.classList.toggle('active',x===b));loadLeaderboard()}));

// Unlimited entitlement + library
function unlimitedCode(){try{return localStorage.getItem(UNLIMITED_KEY)||''}catch{return ''}}
function unlimitedHistory(){try{return JSON.parse(localStorage.getItem(UNLIMITED_HISTORY_KEY))||{}}catch{return {}}}
function saveUnlimitedHistory(v){try{localStorage.setItem(UNLIMITED_HISTORY_KEY,JSON.stringify(v))}catch{}}
function nextUnlimitedSlot(game,count){
  count=Math.max(1,Number(count)||1);const history=unlimitedHistory();let seen=Array.isArray(history[game])?history[game].filter(n=>Number.isInteger(n)&&n>=0&&n<count):[];
  if(seen.length>=count)seen=[];const used=new Set(seen);let slot=0;
  if(crypto.getRandomValues){const a=new Uint32Array(1);for(let i=0;i<64;i++){crypto.getRandomValues(a);slot=a[0]%count;if(!used.has(slot))break}}
  else{for(let i=0;i<64;i++){slot=Math.floor(Math.random()*count);if(!used.has(slot))break}}
  return {slot,commit(){seen.push(slot);history[game]=seen.slice(-count);saveUnlimitedHistory(history)}};
}
function stopPuzzleTimers(){clearInterval(letterTimer);clearInterval(trailTick);clearInterval(deepCutTick);letterTimer=trailTick=deepCutTick=null;deepCutBusy=false;trailDragging=false;trailPointerId=null;trailPath=[]}
function clearPuzzleMessages(){for(const id of ['#letterMessage','#groupMessage','#trailMessage','#linkMessage','#stepsMessage','#deepCutMessage']){const el=$(id);if(el){el.className='message';el.textContent=''}}for(const id of ['#guessInput','#linkInput','#stepsInput','#deepCutInput']){const el=$(id);if(el)el.value=''}}
function renderUnlimitedAccess(active=false){
  unlimitedActive=active;const form=$('#unlimitedForm'),status=$('#unlimitedStatus'),input=$('#unlimitedCode'),badge=$('#unlimitedBadge'),open=$('#openUnlimitedButton'),tab=$('#unlimitedTab');
  if(form)form.hidden=active;if(input&&!active&&document.activeElement!==input)input.value='';if(open)open.hidden=!active;if(tab)tab.hidden=!active;
  if(status){status.className=`message ${active?'good':''}`;status.textContent=active?'Unlimited is ready on this device. Your daily set stays untouched while you play from the library.':'Use a private access code once and this browser will remember it.'}
  if(badge){badge.hidden=!active;badge.textContent=active?'UNLIMITED ACTIVE':''}
  renderUnlimitedLibrary();
}
async function refreshUnlimitedAccess(){
  const code=unlimitedCode();if(!code){renderUnlimitedAccess(false);return false}
  try{const r=await api('/api/unlimited/status',{code});if(r.active){unlimitedCounts=r.counts||{};renderUnlimitedAccess(true);return true}}catch{}
  try{localStorage.removeItem(UNLIMITED_KEY)}catch{}renderUnlimitedAccess(false);return false;
}
$('#unlimitedForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const input=$('#unlimitedCode'),code=input.value.trim().toUpperCase().replace(/\s+/g,'');if(!code)return;
  const button=$('#unlimitedForm button');button.disabled=true;
  try{const r=await api('/api/unlimited/claim',{code});if(!r.active)throw new Error('That Unlimited access code is not valid.');localStorage.setItem(UNLIMITED_KEY,code);unlimitedCounts=r.counts||{};input.value='';renderUnlimitedAccess(true);selectTab('unlimited')}
  catch(err){const status=$('#unlimitedStatus');status.className='message bad';status.textContent=err.message}
  finally{button.disabled=false}
});
function formatLibraryCount(n,label='puzzles'){n=Number(n)||0;return `${n.toLocaleString()} ${label}`}
function renderUnlimitedLibrary(){
  const gate=$('#unlimitedLibraryGate'),grid=$('#unlimitedLibraryGrid');if(!gate||!grid)return;
  gate.hidden=unlimitedActive;grid.hidden=!unlimitedActive;
  const copy={letter:['unlimitedLetterCount','words'],groups:['unlimitedGroupsCount','boards'],trail:['unlimitedTrailCount','boards'],link:['unlimitedLinkCount','links'],steps:['unlimitedStepsCount','ladders'],deepcut:['unlimitedDeepCutCount','sets']};
  for(const [game,[id,label]] of Object.entries(copy)){const el=$('#'+id);if(el)el.textContent=formatLibraryCount(unlimitedCounts[game],label)}
}
$('#openUnlimitedButton')?.addEventListener('click',()=>selectTab('unlimited'));
$('#unlimitedGoActivate')?.addEventListener('click',()=>selectTab('archive'));
function unlimitedGameName(game){return {letter:'Letter Grid',groups:'Four Groups',trail:'Letter Trail',link:'Triple Link',steps:'Word Steps',deepcut:'Deep Cut'}[game]||game}
function mountUnlimitedBar(game){
  $$('.unlimited-play-bar').forEach(x=>x.remove());const panel=$('#'+game),head=panel?.querySelector('.panel-head');if(!panel||!head)return;
  const bar=document.createElement('div');bar.className='ritual-card unlimited-play-bar';bar.innerHTML=`<span class="ritual-dot"></span><div><strong>Unlimited · ${unlimitedGameName(game)} #${unlimitedSession.slot+1}</strong><p>This round is from the reserve library. It does not touch today's set or leaderboard.</p></div><div class="group-actions"><button class="secondary-button" type="button" data-unlimited-new>New puzzle</button><button class="secondary-button" type="button" data-unlimited-back>Library</button></div>`;panel.insertBefore(bar,head);
  bar.querySelector('[data-unlimited-new]').addEventListener('click',()=>void startUnlimitedGame(game));bar.querySelector('[data-unlimited-back]').addEventListener('click',()=>exitUnlimited(true));
}
function resumeDailyTimers(){
  if(!dayRoot||!dailyRoot)return;
  if(!dayRoot.letter.done)letterTimer=setInterval(()=>$('#timer').textContent=fmtTime((Date.now()-dayRoot.letter.start)/1000),250);
  if(dayRoot.trail.started&&!dayRoot.trail.done){if(remainingTrail()<=0)void finishTrail();else trailTick=setInterval(()=>{if(remainingTrail()<=0)void finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},1000)}
  if(dayRoot.deepcut.started&&!dayRoot.deepcut.done){if(remainingDeepCut()<=0)void timeoutDeepCut();else armDeepCutTimer()}
}
function restoreDailyContext(){
  if(!dailyRoot||!dayRoot)return;stopPuzzleTimers();unlimitedSession=null;daily=dailyRoot;day=dayRoot;currentDateKey=currentDateRoot;$$('.unlimited-play-bar').forEach(x=>x.remove());clearPuzzleMessages();
  $('#wordLength').textContent=daily.letter.length;$('#letterSubhead').textContent=`Today is ${daily.letter.length} letters. You still only get six guesses.`;$('#guessInput').maxLength=daily.letter.length;
  renderLetter();renderGroups();renderTrail();renderLink();renderSteps();renderDeepCut();resumeDailyTimers();
}
function exitUnlimited(toLibrary=true){restoreDailyContext();selectTab(toLibrary?'unlimited':'today')}
async function startUnlimitedGame(game){
  if(!unlimitedActive){selectTab('archive');return}if(!DAILY_GAMES.includes(game))return;
  if(unlimitedSession)restoreDailyContext();stopPuzzleTimers();clearPuzzleMessages();
  const count=Number(unlimitedCounts[game])||1,pick=nextUnlimitedSlot(game,count),code=unlimitedCode();
  try{
    const r=await api('/api/unlimited/new',{code,game,slot:pick.slot});pick.commit();unlimitedCounts=r.counts||unlimitedCounts;unlimitedSession={game,slot:r.slot,count:r.count};daily={date:'Unlimited',leaderboard:{enabled:false},...r.puzzle};day={};currentDateKey='unlimited';
    if(game==='letter'){day.letter={guesses:[],score:0,done:false,won:false,start:Date.now(),elapsed:0,answer:''};$('#wordLength').textContent=daily.letter.length;$('#letterSubhead').textContent=`Unlimited challenge · ${daily.letter.length} letters · six guesses.`;$('#guessInput').maxLength=daily.letter.length;renderLetter();letterTimer=setInterval(()=>$('#timer').textContent=fmtTime((Date.now()-day.letter.start)/1000),250)}
    if(game==='groups'){day.groups={solved:[],mistakes:0,score:0,done:false,selection:[],order:[...daily.groups.words],solutions:null};renderGroups()}
    if(game==='trail'){const gridKey=daily.trail.grid.join('');day.trail={started:false,done:false,deadline:0,words:[],score:0,best:'',longest:'',gridKey};renderTrail()}
    if(game==='link'){day.link={guesses:0,score:0,done:false,won:false,answer:'',note:''};renderLink()}
    if(game==='steps'){day.steps={puzzleKey:`${daily.steps.start}:${daily.steps.target}`,path:[daily.steps.start],score:0,done:false,won:false,solution:[]};renderSteps()}
    if(game==='deepcut'){day.deepcut={puzzleKey:daily.deepcut.prompts.map(p=>p.id).join('|'),started:false,round:0,answers:[],score:0,done:false,deadline:0};renderDeepCut()}
    mountUnlimitedBar(game);selectTab(game);renderUnlimitedLibrary();
  }catch(err){restoreDailyContext();const status=$('#unlimitedLibraryStatus');if(status){status.className='message bad';status.textContent=err.message}selectTab('unlimited')}
}
$$('[data-unlimited-game]').forEach(b=>b.addEventListener('click',()=>void startUnlimitedGame(b.dataset.unlimitedGame)));
void refreshUnlimitedAccess();

// Archive + help
function renderArchive(){
  const el=$('#archiveList'),rows=Object.entries(state.days).filter(([,v])=>Object.values(v).some(x=>x?.done)).sort((a,b)=>b[0].localeCompare(a[0]));el.innerHTML='';if(!rows.length){el.innerHTML='<div class="empty-state">Finish a puzzle and your first day will appear here.</div>';return}
  for(const [d,v] of rows.slice(0,60)){const scores=DAILY_GAMES.map(g=>v[g]?.score||0),total=scores.reduce((a,b)=>a+b,0),complete=DAILY_GAMES.every(g=>v[g]?.done),date=dateObj(d),row=document.createElement('div');row.className='archive-row';row.innerHTML=`<div><strong>${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</strong><br><small>Grid ${scores[0]} · Groups ${scores[1]} · Trail ${scores[2]} · Link ${scores[3]} · Steps ${scores[4]} · Deep Cut ${scores[5]}</small></div><span class="archive-score">${total.toLocaleString()}</span><span class="archive-badge">${complete?'SET COMPLETE':'IN PROGRESS'}</span>`;el.appendChild(row)}
}
const help={
  letter:'<h2>Letter Grid</h2><p>Guess a 5–10 letter word in six tries. Green is the right letter in the right place; gold is the right letter in the wrong place. Longer words score more. If you miss it, the answer is revealed.</p>',
  groups:'<h2>Four Groups</h2><p>Select four words with a shared connection. Find all four before making four mistakes. Solved groups are color-coded from Easy through Tricky, and the completed board shows its overall set difficulty.</p>',
  trail:'<h2>Letter Trail</h2><p>Trace any dictionary English word of at least three letters by tapping or smoothly dragging toward touching tiles. Horizontal, vertical, and diagonal moves count; a tile cannot repeat inside one word. Drag back one tile to correct a path. Every valid word scores.</p>',
  link:'<h2>Triple Link</h2><p>One word makes a familiar phrase or compound with all three clues. You get three guesses. If you miss, the answer and all three completed links are revealed.</p>',
  steps:'<h2>Word Steps</h2><p>Start with one four-letter word and reach the target by changing exactly one letter at a time. Every intermediate step must be a recognized word. You can undo moves; solve within eight moves for points.</p>',
  deepcut:'<h2>Deep Cut</h2><p>Eight quick open-answer trivia prompts. You get 25 seconds for each one. Invalid guesses do not end the prompt, so keep trying until you find a valid answer or time runs out. Correct answers score from 30 to 100 points. Common answers descend one Archive floor, stronger cuts descend two, and answers worth 85–100 descend three. Eight perfect answers reach the Final Shelf.</p>'
};
$$('[data-help]').forEach(b=>b.addEventListener('click',()=>{$('#helpContent').innerHTML=help[b.dataset.help];$('#helpDialog').showModal()}));

async function revealExistingFailures(game=''){
  try{if(game==='letter'&&day.letter.done&&!day.letter.won&&!day.letter.answer&&day.letter.guesses.length>=6){const r=await api('/api/letter/reveal',{guesses:day.letter.guesses.length});day.letter.answer=r.answer}}catch{}
  try{if(game==='groups'&&day.groups.done&&day.groups.solved.length<4&&!day.groups.solutions){const r=await api('/api/groups/reveal',{mistakes:day.groups.mistakes});day.groups.solutions=r.solutions}}catch{}
  try{if(game==='trail'&&day.trail.done&&!day.trail.longest){const r=await api('/api/trail/reveal',{finished:true});day.trail.longest=r.longest}}catch{}
  try{if(game==='link'&&day.link.done&&!day.link.won&&!day.link.answer&&day.link.guesses>=3){const r=await api('/api/link/reveal',{guesses:day.link.guesses});day.link.answer=r.answer;day.link.note=r.note}}catch{}
  try{if(game==='steps'&&day.steps.done&&!day.steps.won&&!day.steps.solution?.length){const r=await api('/api/steps/reveal',{finished:true});day.steps.solution=r.solution||[]}}catch{}
}

// Results dialog: shown once, right at the moment a daily game finishes on
// its own dedicated page (this is the only page that game is ever played on
// today, so this is the only place a "you're done" moment can happen).
const GAME_META={
  letter:{name:'Letter Grid',url:'https://cluemorning.com/games/letter-grid/'},
  groups:{name:'Four Groups',url:'https://cluemorning.com/games/four-groups/'},
  trail:{name:'Letter Trail',url:'https://cluemorning.com/games/letter-trail/'},
  link:{name:'Triple Link',url:'https://cluemorning.com/games/triple-link/'},
  steps:{name:'Word Steps',url:'https://cluemorning.com/games/word-steps/'},
  deepcut:{name:'Deep Cut',url:'https://cluemorning.com/games/deep-cut/'}
};
let resultDialogEl=null,resultShareState=null,resultRecapToken=0;
// Other game scripts (Last Call, Tileworks Situation, Pangram, All Seven)
// call window.clueMorningShowResult(key, {name,url}, {score,detail,marks,max})
// directly - they keep their own state, so they build their own snapshot
// rather than going through resultSnapshot(), which only knows the 6 daily
// games' day[game] shape.
function resultSnapshot(game,s){
  const score=Number(s?.score||0);
  if(game==='letter')return {score,detail:s.won?`Solved in ${(s.guesses||[]).length}/6 guesses`:'No solve',marks:(s.guesses||[]).map(g=>(g.feedback||[]).map(v=>v==='green'?'🟩':v==='yellow'?'🟨':'⬛').join('')).join('\n')};
  if(game==='groups')return {score,detail:`${(s.solved||[]).length}/4 groups · ${Number(s.mistakes||0)} mistake${Number(s.mistakes||0)===1?'':'s'}`,marks:`${'🟩'.repeat((s.solved||[]).length)}${'⬛'.repeat(Math.max(0,4-(s.solved||[]).length))}`};
  if(game==='trail')return {score,detail:`${(s.words||[]).length} words${s.best?` · Best: ${s.best}`:''}`,marks:''};
  if(game==='link')return {score,detail:s.won?`Solved in ${Number(s.guesses||0)}/3 guesses`:'Missed today’s link',marks:s.won?'🟩':'⬛'};
  if(game==='steps'){const moves=Math.max(0,(s.path||[]).length-1);return {score,detail:s.won?`Solved in ${moves} move${moves===1?'':'s'}${daily?.steps?.par?` · Par ${daily.steps.par}`:''}`:'Path revealed',marks:s.won?'🟩':'⬛'};}
  const answers=s.answers||[],hits=answers.filter(a=>a.accepted).length,total=Math.max(8,answers.length||8);
  return {score,max:total*100,detail:`${hits}/${total} prompts landed`,marks:Array.from({length:total},(_,i)=>answers[i]?.accepted?'🟩':'⬛').join(''),promptIds:answers.map(a=>a.promptId).filter(Boolean)};
}
async function loadResultRecap(box,data,token){
  if(!data.promptIds?.length)return;
  box.innerHTML='<div class="deepcut-recap"><div class="deepcut-recap-row"><span>Loading the common and rare ends of today’s categories…</span></div></div>';
  try{
    const result=await api('/api/deepcut/recap',{promptIds:data.promptIds});
    if(token!==resultRecapToken)return;
    box.innerHTML=`<div class="deepcut-recap">${result.rows.map(row=>`<div class="deepcut-recap-row"><strong>${escapeHtml(row.prompt)}</strong><span>Most common: <b>${escapeHtml(row.mostCommon)}</b></span><span>Most rare: <b>${escapeHtml(row.rarest)}</b></span></div>`).join('')}</div>`;
  }catch{if(token===resultRecapToken)box.innerHTML=''}
}
function resultShareBody(meta,data,includeUrl=true){
  const lines=[`${meta.name} · Clue Morning`,data.max?`${data.score.toLocaleString()}/${data.max.toLocaleString()}`:`${data.score.toLocaleString()} points`,data.detail];
  if(data.marks)lines.push(data.marks);if(includeUrl)lines.push('',`Play: ${meta.url}`);return lines.filter(v=>v!==undefined&&v!==null&&v!=='').join('\n');
}
async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
}
async function shareResult(){
  if(!resultShareState||!resultDialogEl)return;const {meta,data}=resultShareState,statusEl=resultDialogEl.querySelector('#dailyShareStatus');statusEl.textContent='';
  try{
    if(navigator.share){await navigator.share({title:`${meta.name} — Clue Morning`,text:resultShareBody(meta,data,false),url:meta.url});statusEl.textContent='Shared.';return}
    await copyText(resultShareBody(meta,data,true));statusEl.textContent='Score copied — paste it anywhere.';
  }catch(err){if(err?.name==='AbortError')return;try{await copyText(resultShareBody(meta,data,true));statusEl.textContent='Score copied — paste it anywhere.'}catch{statusEl.textContent='Sharing is not available in this browser.'}}
}
function ensureResultDialog(){
  if(resultDialogEl)return resultDialogEl;
  const style=document.createElement('style');style.id='daily-score-card-styles';style.textContent=`
    .daily-score-dialog{width:min(540px,92vw);text-align:center;padding:28px;max-height:min(86vh,760px);overflow:auto}
    .daily-score-dialog .dialog-close{position:absolute;right:16px;top:16px;float:none}
    .daily-score-kicker{display:block;margin-top:4px}
    .daily-score-dialog h2{font-size:clamp(2.25rem,8vw,3.25rem);margin:.25rem 0 .4rem}
    .daily-score-copy{color:var(--muted);margin:0 auto 16px;max-width:36ch;line-height:1.5}
    .daily-score-number{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:10px 0 8px}
    .daily-score-number strong{font:700 clamp(3.35rem,14vw,5rem)/.9 Georgia,"Times New Roman",serif;letter-spacing:-.05em}
    .daily-score-number span{font-weight:900;color:var(--muted)}
    .daily-score-detail{font-weight:850;margin:10px auto 14px;color:var(--dark)}
    .daily-score-marks{font-size:1.3rem;letter-spacing:.08em;line-height:1.45;margin:10px auto 18px;white-space:pre-wrap;overflow-wrap:anywhere}
    .daily-score-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
    .daily-score-actions button{min-height:52px;justify-content:center}
    .daily-share-status{min-height:1.4em;margin:12px 0 0;color:var(--muted);font-size:.83rem}
    .deepcut-recap{display:grid;gap:8px;text-align:left;margin:18px 0 4px;padding-top:16px;border-top:1px solid var(--line)}
    .deepcut-recap-row{padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:var(--paper2)}
    .deepcut-recap-row strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:.95rem;margin-bottom:5px}
    .deepcut-recap-row span{display:block;color:var(--muted);font-size:.76rem;line-height:1.45}
    .daily-score-reminder{display:flex;align-items:center;gap:12px;text-align:left;margin:18px 0 0;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:var(--paper2)}
    .daily-score-reminder p{flex:1;margin:0;font-size:.86rem;line-height:1.4;color:var(--dark)}
    .daily-score-reminder-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
    .daily-score-reminder-actions button{min-height:38px;padding:0 14px;font-size:.8rem}
    .daily-score-reminder-dismiss{background:none;border:0;color:var(--muted);font-size:.76rem;text-decoration:underline;cursor:pointer;padding:2px}
    @media(max-width:520px){.daily-score-actions{grid-template-columns:1fr}.daily-score-reminder{flex-direction:column;align-items:stretch;text-align:center}}
  `;
  document.head.appendChild(style);
  const dialog=document.createElement('dialog');dialog.id='dailyScoreDialog';dialog.className='daily-score-dialog';
  dialog.innerHTML=`
    <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close score"><span aria-hidden="true">×</span></button></form>
    <span id="dailyScoreKicker" class="game-label daily-score-kicker">GAME COMPLETE</span>
    <h2 id="dailyScoreTitle">Nice work.</h2>
    <p class="daily-score-copy">Your score is locked in. Share it, or keep the morning going.</p>
    <div class="daily-score-number"><strong id="dailyScoreValue">0</strong><span id="dailyScoreMax"></span></div>
    <div id="dailyScoreDetail" class="daily-score-detail"></div>
    <div id="dailyScoreMarks" class="daily-score-marks"></div>
    <div id="dailyScoreExtra"></div>
    <div class="daily-score-actions">
      <button id="dailyScoreMore" class="primary-button" type="button">Play More Games</button>
      <button id="dailyScoreShare" class="secondary-button" type="button">Share Score</button>
    </div>
    <p id="dailyShareStatus" class="daily-share-status" role="status" aria-live="polite"></p>
    <div id="dailyScoreReminder" class="daily-score-reminder" hidden>
      <p>Come back tomorrow for a fresh set. Want a reminder when it's ready?</p>
      <div class="daily-score-reminder-actions">
        <button id="dailyScoreReminderEnable" class="secondary-button" type="button">Remind Me</button>
        <button id="dailyScoreReminderDismiss" class="daily-score-reminder-dismiss" type="button">Not now</button>
      </div>
    </div>
  `;
  (document.querySelector('.app')||document.body).appendChild(dialog);
  dialog.querySelector('#dailyScoreMore').addEventListener('click',()=>{
    dialog.close();
    const homeTab=document.querySelector('[data-tab="today"]');
    if(homeTab)homeTab.click();else location.assign('/');
  });
  dialog.querySelector('#dailyScoreShare').addEventListener('click',()=>void shareResult());
  dialog.querySelector('#dailyScoreReminderEnable').addEventListener('click',async event=>{
    const button=event.currentTarget,box=dialog.querySelector('#dailyScoreReminder');
    button.disabled=true;button.textContent='Enabling…';
    try{
      await window.clueMorningPush?.enable();
      if(await window.clueMorningPush?.isSubscribed()){box.hidden=true;return}
      button.disabled=false;button.textContent='Remind Me';
    }catch{button.disabled=false;button.textContent='Remind Me'}
  });
  dialog.querySelector('#dailyScoreReminderDismiss').addEventListener('click',()=>{
    try{localStorage.setItem(PUSH_NUDGE_DISMISSED_KEY,new Date().toISOString().slice(0,10))}catch{}
    dialog.querySelector('#dailyScoreReminder').hidden=true;
  });
  resultDialogEl=dialog;return dialog;
}
const PUSH_NUDGE_DISMISSED_KEY='clue-morning-push-nudge-dismissed';
async function syncPushReminderVisibility(dialog){
  const box=dialog.querySelector('#dailyScoreReminder');if(!box)return;
  const push=window.clueMorningPush;
  if(!push?.isSupported?.()){box.hidden=true;return}
  try{
    const dismissedOn=localStorage.getItem(PUSH_NUDGE_DISMISSED_KEY);
    if(dismissedOn===new Date().toISOString().slice(0,10)){box.hidden=true;return}
  }catch{}
  let subscribed=false;
  try{subscribed=await push.isSubscribed()}catch{}
  box.hidden=subscribed;
}
function renderResultDialog(meta,data,title,recap){
  const dialog=ensureResultDialog();
  resultShareState={meta,data};resultRecapToken++;const token=resultRecapToken;
  dialog.querySelector('#dailyScoreKicker').textContent=`${meta.name.toUpperCase()} COMPLETE`;
  dialog.querySelector('#dailyScoreTitle').textContent=title||'Nice work.';
  dialog.querySelector('#dailyScoreValue').textContent=data.score.toLocaleString();
  dialog.querySelector('#dailyScoreMax').textContent=data.max?`/ ${data.max.toLocaleString()}`:'';
  dialog.querySelector('#dailyScoreDetail').textContent=data.detail||'';
  const marksEl=dialog.querySelector('#dailyScoreMarks');marksEl.textContent=data.marks||'';marksEl.hidden=!data.marks;
  const extraEl=dialog.querySelector('#dailyScoreExtra');extraEl.innerHTML='';
  dialog.querySelector('#dailyShareStatus').textContent='';
  if(recap)void recap(extraEl,token);
  void syncPushReminderVisibility(dialog);
  if(!dialog.open)dialog.showModal();
}
function showResultDialog(game){
  if(unlimitedSession)return;
  const s=day?.[game];if(!s?.done)return;
  const data=resultSnapshot(game,s),meta=GAME_META[game]||{name:game,url:'https://cluemorning.com/'};
  renderResultDialog(meta,data,game==='deepcut'?'Nice cut.':'Nice work.',game==='deepcut'?(box,token)=>loadResultRecap(box,data,token):null);
}
// Exposed for other game scripts (last-call.js, tileworks-situation.js,
// pangram.js, all-seven.js) that keep their own state outside app-core.js's
// day object, so they compute their own snapshot and call this directly.
window.clueMorningShowResult=function(meta,data,title){renderResultDialog(meta,data,title,null)};

function renderInitialGame(game){
  if(game==='letter')renderLetter();
  else if(game==='groups')renderGroups();
  else if(game==='trail')renderTrail();
  else if(game==='link')renderLink();
  else if(game==='steps')renderSteps();
  else if(game==='deepcut')renderDeepCut();
  else updateHome();
}

async function init(){
  try{
    daily=await (window.clueMorningDailyPromise||(window.clueMorningDailyPromise=loadDaily()));currentDateKey=daily.date;state.days[currentDateKey]??={};day=state.days[currentDateKey];dailyRoot=daily;dayRoot=day;currentDateRoot=currentDateKey;
    $('#todayDate').textContent=dateObj(currentDateKey).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});$('#letterCardText').textContent=`Today's challenge is ${daily.letter.length} letters. Six guesses.`;
    day.letter??={guesses:[],score:0,done:false,won:false,start:Date.now(),elapsed:0,answer:''};day.groups??={solved:[],mistakes:0,score:0,done:false,selection:[],order:[...daily.groups.words],solutions:null};const trailGridKey=daily.trail.grid.join('');if(!day.trail?.gridKey||day.trail.gridKey!==trailGridKey)day.trail={started:false,done:false,deadline:0,words:[],score:0,best:'',longest:'',gridKey:trailGridKey};day.link??={guesses:0,score:0,done:false,won:false,answer:'',note:''};const stepsKey=`${daily.steps.start}:${daily.steps.target}`;if(!day.steps?.puzzleKey||day.steps.puzzleKey!==stepsKey)day.steps={puzzleKey:stepsKey,path:[daily.steps.start],score:0,done:false,won:false,solution:[]};const deepCutKey=daily.deepcut.prompts.map(p=>p.id).join('|');if(!day.deepcut?.puzzleKey||day.deepcut.puzzleKey!==deepCutKey)day.deepcut={puzzleKey:deepCutKey,started:false,round:0,answers:[],score:0,done:false,deadline:0};
    // Normalize any pre-hotfix guess strings without throwing.
    day.letter.guesses=day.letter.guesses.filter(Boolean).map(g=>typeof g==='string'?{word:g,feedback:Array(daily.letter.length).fill('gray')}:g);
    $('#wordLength').textContent=daily.letter.length;$('#letterSubhead').textContent=`Today is ${daily.letter.length} letters. You still only get six guesses.`;$('#guessInput').maxLength=daily.letter.length;
    const initialGame=document.documentElement.dataset.gamePage||'';
    const recovery=revealExistingFailures(initialGame);
    renderInitialGame(initialGame);
    void recovery.then(()=>{
      saveState();
      if((document.documentElement.dataset.gamePage||'')===initialGame)renderInitialGame(initialGame);
    }).catch(()=>{});
    if(initialGame==='letter'&&!day.letter.done)letterTimer=setInterval(()=>$('#timer').textContent=fmtTime((Date.now()-day.letter.start)/1000),1000);
    if(initialGame==='trail'&&day.trail.started&&!day.trail.done){if(remainingTrail()<=0)await finishTrail();else trailTick=setInterval(()=>{if(remainingTrail()<=0)finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},1000)}
    if(initialGame==='deepcut'&&day.deepcut.started&&!day.deepcut.done){if(remainingDeepCut()<=0)await timeoutDeepCut();else armDeepCutTimer()}
  }catch(err){document.querySelector('main').innerHTML=`<div class="loading-card"><h2>Clue Morning couldn't load today's set.</h2><p>${escapeHtml(err.message)}</p><p>Check your connection and try again.</p><button class="primary-button" type="button" onclick="location.reload()">Try again</button></div>`}
}
init();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
