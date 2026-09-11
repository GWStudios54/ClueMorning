const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORAGE_KEY="clue-morning-state-v2.4";
const PLAYER_KEY="clue-morning-player-id";
const NAME_KEY="clue-morning-leader-name";
const THEME_KEY="clue-morning-theme";
const LAST_VISIT_KEY="clue-morning-last-visit-local-date";
const UNLIMITED_KEY="clue-morning-unlimited-access-code";
const UNLIMITED_HISTORY_KEY="clue-morning-unlimited-history-v1";
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
let dailyRoot=null,dayRoot=null,currentDateRoot=null,unlimitedSession=null,unlimitedActive=false,unlimitedCounts={},deepCutReturnTab="today";
const DAILY_GAMES=["letter","groups","trail","link","steps","deepcut"];

function getPlayerId(){
  let id=localStorage.getItem(PLAYER_KEY);
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem(PLAYER_KEY,id)}
  return id;
}
function allDone(){return day&&DAILY_GAMES.every(g=>day[g]?.done)}
function totalScore(){return day?DAILY_GAMES.reduce((n,g)=>n+(day[g]?.score||0),0):0}
function statusMarkup(done){return `${svg(done?"i-check":"i-play")}${done?"DONE":"PLAY"}`}
function setStatus(id,done){const el=$(id);el.classList.toggle("done",done);el.innerHTML=statusMarkup(done)}

function selectTab(id){
  const previous=$(".tab.active")?.dataset.tab||"today";
  if(id==="deepcut"&&previous!=="deepcut")deepCutReturnTab=previous;
  document.documentElement.classList.toggle("deepcut-immersive",id==="deepcut");
  if(unlimitedSession&&id!==unlimitedSession.game&&id!=="unlimited")restoreDailyContext();
  $(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  $(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
  window.scrollTo({top:0,behavior:id==="deepcut"?"auto":"smooth"});
  if(id==="archive")renderArchive();
  if(id==="leaders")loadLeaderboard();
  if(id==="unlimited")renderUnlimitedLibrary();
  if(id==="deepcut"){warmDeepCutArchive();requestAnimationFrame(renderDeepCutArchive)}
}
$$('.tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
$('[data-open]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.open)));
$('#deepCutExit')?.addEventListener('click',()=>{if(unlimitedSession)exitUnlimited(true);else selectTab(deepCutReturnTab||'today')});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.classList.contains('deepcut-immersive')){$('#deepCutExit')?.click()}});
$('.brand').addEventListener('click',e=>{e.preventDefault();selectTab('today')});
$('#year').textContent=new Date().getFullYear();
$('#themeButton').addEventListener('click',()=>{applyTheme(activeTheme(),false);$('#themeDialog').showModal()});
$$('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.themeChoice,true);$('#themeDialog').close()}));

function updateStreak(){
  if(!currentDateKey)return;
  const doneDates=Object.entries(state.days).filter(([,v])=>DAILY_GAMES.every(g=>v[g]?.done)).map(([d])=>d);
  let streak=0,cursor=dateObj(currentDateKey);
  for(let i=0;i<370;i++){
    const y=cursor.getFullYear(),m=String(cursor.getMonth()+1).padStart(2,'0'),d=String(cursor.getDate()).padStart(2,'0'),key=`${y}-${m}-${d}`;
    if(doneDates.includes(key)){streak++;cursor.setDate(cursor.getDate()-1)}else if(i===0){cursor.setDate(cursor.getDate()-1)}else break;
  }
  $('#streakCount').textContent=streak;
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
  const el=$('#keyboard');el.innerHTML='';for(const ch of 'QWERTYUIOPASDFGHJKLZXCVBNM'){const k=document.createElement('div');k.className=`key ${grades[ch]||''}`;k.textContent=ch;el.appendChild(k)}
}
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
    for(let i=0;i<daily.letter.length;i++){const t=document.createElement('div');const active=!s.done&&r===s.guesses.length;t.className='tile'+(active?' draft-tile':'');if(active&&draft[i])t.textContent=draft[i];row.appendChild(t)}
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
    renderLetter();if(!s.done)input.focus({preventScroll:true});
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
  try{const r=await api('/api/groups/check',{words:s.selection,mistakesAfter});if(r.match){s.solved.push({name:r.name,words:r.words,difficulty:r.difficulty,difficultyLabel:r.difficultyLabel});s.score+=250+Math.max(0,(4-s.mistakes)*25);$('#groupMessage').textContent=`${r.name} · ${r.difficultyLabel||''}`.replace(/ · $/,'');s.selection=[];if(s.solved.length===4)s.done=true}else{s.mistakes++;s.selection=[];$('#groupMessage').textContent='Not a group.';if(s.mistakes>=4){s.done=true;s.solutions=r.solutions||[]}}renderGroups()}catch(err){$('#groupMessage').textContent=err.message}
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
async function finishTrail(){const s=day.trail;if(s.done&&s.longest){renderTrail();return}s.done=true;clearInterval(trailTick);trailPath=[];try{const r=await api('/api/trail/reveal',{finished:true});s.longest=r.longest||''}catch{}renderTrail()}
$('#trailStart').addEventListener('click',()=>{const s=day.trail;if(s.started)return;s.started=true;s.deadline=Date.now()+daily.trail.seconds*1000;saveState();renderTrail();trailTick=setInterval(()=>{if(remainingTrail()<=0)finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},250)});
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

// Triple Link
function renderLink(){
  const s=day.link;$('#linkClues').innerHTML=daily.link.clues.map(c=>`<div class="link-clue">${c}</div>`).join('');$('#linkGuesses').textContent=`${s.guesses}/3`;$('#linkScore').textContent=s.score.toLocaleString();$('#linkStatus').textContent=s.done?(s.won?'SOLVED':'MISSED'):'OPEN';$('#linkInput').disabled=s.done;$('#linkForm button').disabled=s.done;
  if(s.done&&!s.won&&s.answer){const msg=$('#linkMessage');msg.className='message bad';msg.innerHTML=`No more guesses.<div class="solution-note"><strong>${s.answer}</strong> — ${s.note||''}</div>`}
  updateHome();
}
$('#linkForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.link;if(s.done)return;const input=$('#linkInput'),guess=input.value.trim().toUpperCase().replace(/[^A-Z]/g,'');if(!guess)return;
  try{const attempt=s.guesses+1,r=await api('/api/link/guess',{guess,attempt});s.guesses++;input.value='';if(r.solved){s.won=true;s.done=true;s.answer=r.answer;s.note=r.note;s.score=[0,600,400,250][s.guesses]||250;$('#linkMessage').className='message good';$('#linkMessage').textContent=`${r.answer} — ${r.note}`}else if(s.guesses>=3){s.done=true;s.answer=r.answer||'';s.note=r.note||''}else{$('#linkMessage').className='message';$('#linkMessage').textContent='Not the link. Try again.'}renderLink()}catch(err){$('#linkMessage').textContent=err.message}
});

// Word Steps
function wordStepsScore(moves,par){return Math.max(400,1000-Math.max(0,moves-par)*100)}
function renderSteps(){
  const s=day.steps,moves=Math.max(0,s.path.length-1);$('#stepsMoves').textContent=`${moves}/${daily.steps.maxMoves}`;$('#stepsPar').textContent=daily.steps.par;$('#stepsScore').textContent=s.score.toLocaleString();$('#stepsStatus').textContent=s.done?(s.won?'SOLVED':'REVEALED'):'OPEN';$('#stepsStart').textContent=daily.steps.start;$('#stepsTarget').textContent=daily.steps.target;
  $('#stepsPath').innerHTML=s.path.map((w,i)=>`${i?'<span class="step-arrow">→</span>':''}<span class="step-word ${i===s.path.length-1?'current':''}">${escapeHtml(w)}</span>`).join('');
  $('#stepsInput').disabled=s.done;$('#stepsForm button').disabled=s.done;$('#stepsUndo').disabled=s.done||s.path.length<=1;$('#stepsGiveUp').disabled=s.done;
  if(s.done){const msg=$('#stepsMessage');msg.className=`message ${s.won?'good':'bad'}`;msg.innerHTML=s.won?`Reached ${daily.steps.target} in ${moves} move${moves===1?'':'s'} — ${s.score.toLocaleString()} points.`:`Path revealed.${s.solution?.length?`<div class="solution-note">${s.solution.map(escapeHtml).join(' → ')}</div>`:''}`}
  updateHome();
}
async function revealSteps(){const s=day.steps;if(s.done&&s.solution?.length){renderSteps();return}try{const r=await api('/api/steps/reveal',{finished:true});s.solution=r.solution||[]}catch{}s.done=true;s.won=false;s.score=0;renderSteps()}
$('#stepsForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.steps;if(s.done)return;const input=$('#stepsInput'),guess=input.value.trim().toUpperCase().replace(/[^A-Z]/g,'');if(guess.length!==4){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent='Enter exactly four letters.';return}const previous=s.path.at(-1);if(s.path.includes(guess)){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent='That word is already in your path.';return}
  try{const r=await api('/api/steps/check',{previous,guess});if(!r.accepted){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent=r.reason==='change'?`Change exactly one letter from ${previous}.`:`${guess} isn't in the Word Steps dictionary.`;return}s.path.push(guess);input.value='';const moves=s.path.length-1;if(r.solved){s.done=true;s.won=true;s.score=wordStepsScore(moves,daily.steps.par);$('#stepsMessage').className='message good'}else if(moves>=daily.steps.maxMoves){await revealSteps();return}else{$('#stepsMessage').className='message good';$('#stepsMessage').textContent=`${guess} works. Keep going.`}renderSteps()}catch(err){$('#stepsMessage').className='message bad';$('#stepsMessage').textContent=err.message}
});
$('#stepsUndo').addEventListener('click',()=>{const s=day.steps;if(s.done||s.path.length<=1)return;s.path.pop();$('#stepsMessage').className='message';$('#stepsMessage').textContent='Last step removed.';renderSteps()});
$('#stepsGiveUp').addEventListener('click',()=>{if(day.steps.done)return;if(confirm('Reveal one shortest path and finish Word Steps for today?'))void revealSteps()});

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
  requestAnimationFrame(renderDeepCutArchive);
}
function armDeepCutTimer(){clearInterval(deepCutTick);deepCutTick=setInterval(()=>{const s=day?.deepcut;if(!s?.started||s.done){clearInterval(deepCutTick);return}const left=remainingDeepCut();$('#deepCutTimer').textContent=fmtTime(left);if(left<=0)void timeoutDeepCut()},250)}
function finishDeepCut(){const s=day.deepcut;s.started=false;s.done=true;s.deadline=0;clearInterval(deepCutTick);renderDeepCut()}
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
  if(dayRoot.trail.started&&!dayRoot.trail.done){if(remainingTrail()<=0)void finishTrail();else trailTick=setInterval(()=>{if(remainingTrail()<=0)void finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},250)}
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

async function revealExistingFailures(){
  try{if(day.letter.done&&!day.letter.won&&!day.letter.answer&&day.letter.guesses.length>=6){const r=await api('/api/letter/reveal',{guesses:day.letter.guesses.length});day.letter.answer=r.answer}}catch{}
  try{if(day.groups.done&&day.groups.solved.length<4&&!day.groups.solutions){const r=await api('/api/groups/reveal',{mistakes:day.groups.mistakes});day.groups.solutions=r.solutions}}catch{}
  try{if(day.trail.done&&!day.trail.longest){const r=await api('/api/trail/reveal',{finished:true});day.trail.longest=r.longest}}catch{}
  try{if(day.link.done&&!day.link.won&&!day.link.answer&&day.link.guesses>=3){const r=await api('/api/link/reveal',{guesses:day.link.guesses});day.link.answer=r.answer;day.link.note=r.note}}catch{}
  try{if(day.steps.done&&!day.steps.won&&!day.steps.solution?.length){const r=await api('/api/steps/reveal',{finished:true});day.steps.solution=r.solution||[]}}catch{}
}

async function init(){
  try{
    daily=await api('/api/daily');currentDateKey=daily.date;state.days[currentDateKey]??={};day=state.days[currentDateKey];dailyRoot=daily;dayRoot=day;currentDateRoot=currentDateKey;
    $('#todayDate').textContent=dateObj(currentDateKey).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});$('#letterCardText').textContent=`Today's challenge is ${daily.letter.length} letters. Six guesses.`;
    day.letter??={guesses:[],score:0,done:false,won:false,start:Date.now(),elapsed:0,answer:''};day.groups??={solved:[],mistakes:0,score:0,done:false,selection:[],order:[...daily.groups.words],solutions:null};const trailGridKey=daily.trail.grid.join('');if(!day.trail?.gridKey||day.trail.gridKey!==trailGridKey)day.trail={started:false,done:false,deadline:0,words:[],score:0,best:'',longest:'',gridKey:trailGridKey};day.link??={guesses:0,score:0,done:false,won:false,answer:'',note:''};const stepsKey=`${daily.steps.start}:${daily.steps.target}`;if(!day.steps?.puzzleKey||day.steps.puzzleKey!==stepsKey)day.steps={puzzleKey:stepsKey,path:[daily.steps.start],score:0,done:false,won:false,solution:[]};const deepCutKey=daily.deepcut.prompts.map(p=>p.id).join('|');if(!day.deepcut?.puzzleKey||day.deepcut.puzzleKey!==deepCutKey)day.deepcut={puzzleKey:deepCutKey,started:false,round:0,answers:[],score:0,done:false,deadline:0};
    // Normalize any pre-hotfix guess strings without throwing.
    day.letter.guesses=day.letter.guesses.filter(Boolean).map(g=>typeof g==='string'?{word:g,feedback:Array(daily.letter.length).fill('gray')}:g);
    $('#wordLength').textContent=daily.letter.length;$('#letterSubhead').textContent=`Today is ${daily.letter.length} letters. You still only get six guesses.`;$('#guessInput').maxLength=daily.letter.length;
    await revealExistingFailures();renderLetter();renderGroups();renderTrail();renderLink();renderSteps();renderDeepCut();renderArchive();const requestedPlay=new URLSearchParams(location.search).get('play');if(DAILY_GAMES.includes(requestedPlay))selectTab(requestedPlay);
    if(!day.letter.done)letterTimer=setInterval(()=>$('#timer').textContent=fmtTime((Date.now()-day.letter.start)/1000),250);
    if(day.trail.started&&!day.trail.done){if(remainingTrail()<=0)await finishTrail();else trailTick=setInterval(()=>{if(remainingTrail()<=0)finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},250)}
    if(day.deepcut.started&&!day.deepcut.done){if(remainingDeepCut()<=0)await timeoutDeepCut();armDeepCutTimer()}
    updateHome();saveState();
  }catch(err){document.querySelector('main').innerHTML=`<div class="loading-card"><h2>Clue Morning couldn't load today's set.</h2><p>${escapeHtml(err.message)}</p><p>Refresh in a moment.</p></div>`}
}
init();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
