const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORAGE_KEY="clue-morning-state-v2.4";
const PLAYER_KEY="clue-morning-player-id";
const NAME_KEY="clue-morning-leader-name";
const THEME_KEY="clue-morning-theme";
const LAST_VISIT_KEY="clue-morning-last-visit-local-date";
const THEMES={paper:{name:"Morning Paper",color:"#f7f1e5"},bloom:{name:"Dawn Bloom",color:"#fff5f3"},blue:{name:"Blue Hour",color:"#f3f7fa"},hearth:{name:"Hearth",color:"#fff5e8"},lavender:{name:"Lavender Haze",color:"#faf7ff"}};
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return {}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function api(path,body=null){
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
let daily=null,day=null,currentDateKey=null,letterTimer=null,trailTick=null,deepCutTick=null,deepCutBusy=false,trailPath=[],trailDragging=false,leaderScope="daily",leaderAutoPosting=false;
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
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  $$(".panel").forEach(p=>p.classList.toggle("active",p.id===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="archive")renderArchive();
  if(id==="leaders")loadLeaderboard();
}
$$('.tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.open)));
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
  const el=$('#keyboard');el.innerHTML='';for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const k=document.createElement('div');k.className=`key ${grades[ch]||''}`;k.textContent=ch;el.appendChild(k)}
}
function renderLetter(){
  const s=day.letter,board=$('#guessBoard');board.innerHTML='';
  for(const g of s.guesses){const row=document.createElement('div');row.className='guess-row';row.style.gridTemplateColumns=`repeat(${daily.letter.length},auto)`;[...g.word].forEach((ch,i)=>{const t=document.createElement('div');t.className=`tile ${g.feedback[i]}`;t.textContent=ch;row.appendChild(t)});board.appendChild(row)}
  for(let r=s.guesses.length;r<6;r++){const row=document.createElement('div');row.className='guess-row';row.style.gridTemplateColumns=`repeat(${daily.letter.length},auto)`;for(let i=0;i<daily.letter.length;i++){const t=document.createElement('div');t.className='tile';row.appendChild(t)}board.appendChild(row)}
  $('#guessCount').textContent=`${s.guesses.length}/6`;$('#letterScore').textContent=s.score.toLocaleString();renderKeyboard();
  const input=$('#guessInput'),button=$('#guessForm button');input.disabled=s.done;button.disabled=s.done;
  if(s.done){$('#timer').textContent=fmtTime(s.elapsed||0);const msg=$('#letterMessage');msg.className=`message ${s.won?'good':'bad'}`;msg.innerHTML=s.won?`Solved — ${s.score.toLocaleString()} points.`:`No solve today.${s.answer?`<div class="solution-note">The word was <strong>${s.answer}</strong>.</div>`:''}`}
  updateHome();
}
$('#guessForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.letter;if(s.done)return;const input=$('#guessInput'),guess=input.value.trim().toUpperCase().replace(/[^A-Z]/g,'');
  if(guess.length!==daily.letter.length){$('#letterMessage').textContent=`Need exactly ${daily.letter.length} letters.`;return}
  if(s.guesses.some(g=>g.word===guess)){ $('#letterMessage').textContent='You already tried that guess.';return }
  try{
    const attempt=s.guesses.length+1,r=await api('/api/letter/guess',{guess,attempt});s.guesses.push({word:guess,feedback:r.feedback});input.value='';
    const best=Math.max(...s.guesses.map(g=>letterPartial(g.feedback))),elapsed=(Date.now()-s.start)/1000;
    if(r.solved||s.guesses.length>=6){s.done=true;s.won=r.solved;s.elapsed=elapsed;s.answer=r.answer||s.answer||'';s.score=letterScore(r.solved,s.guesses.length,elapsed,best);clearInterval(letterTimer)}else s.score=letterScore(false,s.guesses.length,elapsed,best);
    renderLetter();
  }catch(err){$('#letterMessage').textContent=err.message}
});

// Four Groups
function groupKey(g){return [...g.words].sort().join('|')}
function renderGroups(){
  const s=day.groups,solvedWords=new Set(s.solved.flatMap(x=>x.words)),remaining=s.order.filter(w=>!solvedWords.has(w));
  const solved=$('#solvedGroups');solved.innerHTML='';
  for(const g of s.solved){const box=document.createElement('div');box.className='solved-group';box.innerHTML=`<strong>${g.name}</strong><span>${g.words.join(' · ')}</span>`;solved.appendChild(box)}
  if(s.done&&s.solved.length<4&&Array.isArray(s.solutions)){
    const keys=new Set(s.solved.map(groupKey));for(const g of s.solutions){if(keys.has(groupKey(g)))continue;const box=document.createElement('div');box.className='solved-group revealed';box.innerHTML=`<strong>${g.name}</strong><span>${g.words.join(' · ')}</span>`;solved.appendChild(box)}
  }
  const grid=$('#groupGrid');grid.innerHTML='';
  if(!s.done){for(const w of remaining){const b=document.createElement('button');b.type='button';b.className='word-card'+(s.selection.includes(w)?' selected':'');b.textContent=w;b.addEventListener('click',()=>{if(s.selection.includes(w))s.selection=s.selection.filter(x=>x!==w);else if(s.selection.length<4)s.selection.push(w);renderGroups()});grid.appendChild(b)}}
  $('#groupsFound').textContent=`${s.solved.length}/4`;$('#mistakesLeft').textContent=Math.max(0,4-s.mistakes);$('#groupScore').textContent=s.score.toLocaleString();$('#submitGroupBtn').disabled=s.done||s.selection.length!==4;$('#shuffleBtn').disabled=s.done;$('#deselectBtn').disabled=s.done;
  if(s.done){const msg=$('#groupMessage');msg.className=`message ${s.solved.length===4?'good':'bad'}`;msg.textContent=s.solved.length===4?`All four groups — ${s.score.toLocaleString()} points.`:'Four mistakes. All solutions are shown above.'}
  updateHome();
}
$('#submitGroupBtn').addEventListener('click',async()=>{
  const s=day.groups;if(s.selection.length!==4||s.done)return;const mistakesAfter=s.mistakes+1;
  try{const r=await api('/api/groups/check',{words:s.selection,mistakesAfter});if(r.match){s.solved.push({name:r.name,words:r.words});s.score+=250+Math.max(0,(4-s.mistakes)*25);$('#groupMessage').textContent=r.name;s.selection=[];if(s.solved.length===4)s.done=true}else{s.mistakes++;s.selection=[];$('#groupMessage').textContent='Not a group.';if(s.mistakes>=4){s.done=true;s.solutions=r.solutions||[]}}renderGroups()}catch(err){$('#groupMessage').textContent=err.message}
});
$('#shuffleBtn').addEventListener('click',()=>{const s=day.groups,solved=new Set(s.solved.flatMap(x=>x.words)),r=s.order.filter(w=>!solved.has(w));for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}s.order=[...s.order.filter(w=>solved.has(w)),...r];renderGroups()});
$('#deselectBtn').addEventListener('click',()=>{day.groups.selection=[];renderGroups()});

// Letter Trail
function trailPoints(n){if(n===3)return 100;if(n===4)return 200;if(n===5)return 400;if(n===6)return 700;if(n===7)return 1100;return 1600+(n-8)*300}
function remainingTrail(){return Math.max(0,Math.ceil((day.trail.deadline-Date.now())/1000))}
function adjacent(a,b){const ar=Math.floor(a/4),ac=a%4,br=Math.floor(b/4),bc=b%4;return Math.max(Math.abs(ar-br),Math.abs(ac-bc))===1}
function canExtendTrail(i){return !trailPath.includes(i)&&(!trailPath.length||adjacent(trailPath.at(-1),i))}
function startTrailSelection(i){trailDragging=true;if(trailPath.length&&canExtendTrail(i))trailPath.push(i);else trailPath=[i];renderTrailGrid()}
function extendTrailSelection(i){if(!trailDragging||!canExtendTrail(i))return;trailPath.push(i);renderTrailGrid()}
function stopTrailSelection(){trailDragging=false}
function renderTrailGrid(){const g=$('#trailGrid');g.innerHTML='';daily.trail.grid.forEach((ch,i)=>{const b=document.createElement('button');b.type='button';b.dataset.index=String(i);b.className='trail-cell'+(trailPath.includes(i)?' selected':'');b.textContent=ch;b.disabled=!day.trail.started||day.trail.done;g.appendChild(b)});$('#trailCurrent').textContent=trailPath.length?trailPath.map(i=>daily.trail.grid[i]).join(''):'Tap or drag across letters'}
function trailCellAtPoint(x,y){const el=document.elementFromPoint(x,y);return el?.closest?.('.trail-cell')||null}
function renderTrail(){
  const s=day.trail;$('#trailFound').textContent=s.words.length;$('#trailScore').textContent=s.score.toLocaleString();$('#trailBest').textContent=s.best||'—';$('#trailIntro').hidden=s.started;$('#trailPlay').hidden=!s.started;$('#trailWords').innerHTML=s.words.map(w=>`<span class="found-word">${w}</span>`).join('');if(s.started&&!s.done)$('#trailTimer').textContent=fmtTime(remainingTrail());
  if(s.done){$('#trailTimer').textContent='0:00';const msg=$('#trailMessage');msg.className='message';msg.innerHTML=`Time — ${s.words.length} words, ${s.score.toLocaleString()} points.${s.longest?`<div class="solution-note">Longest possible word: <strong>${s.longest}</strong> (${s.longest.length})</div>`:''}`}
  renderTrailGrid();updateHome();
}
async function finishTrail(){const s=day.trail;if(s.done&&s.longest){renderTrail();return}s.done=true;clearInterval(trailTick);trailPath=[];try{const r=await api('/api/trail/reveal',{finished:true});s.longest=r.longest||''}catch{}renderTrail()}
$('#trailStart').addEventListener('click',()=>{const s=day.trail;if(s.started)return;s.started=true;s.deadline=Date.now()+daily.trail.seconds*1000;saveState();renderTrail();trailTick=setInterval(()=>{if(remainingTrail()<=0)finishTrail();else $('#trailTimer').textContent=fmtTime(remainingTrail())},250)});
$('#trailGrid').addEventListener('pointerdown',e=>{const cell=e.target.closest('.trail-cell');if(!cell||!day.trail.started||day.trail.done)return;e.preventDefault();startTrailSelection(Number(cell.dataset.index))});
$('#trailGrid').addEventListener('pointermove',e=>{if(!trailDragging||!day.trail.started||day.trail.done)return;const cell=trailCellAtPoint(e.clientX,e.clientY);if(!cell||!$('#trailGrid').contains(cell))return;e.preventDefault();extendTrailSelection(Number(cell.dataset.index))});
window.addEventListener('pointerup',stopTrailSelection);
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
  if(s.done&&!s.won&&s.answer){const msg=$('#linkMessage');msg.className='message bad';msg.innerHTML=`No more guesses today.<div class="solution-note"><strong>${s.answer}</strong> — ${s.note||''}</div>`}
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
function remainingDeepCut(){const s=day.deepcut;return s?.deadline?Math.max(0,(s.deadline-Date.now())/1000):(daily?.deepcut?.seconds||25)}
function deepCutPrompt(){return daily.deepcut.prompts[day.deepcut.round]||null}
function renderDeepCut(){
  const s=day.deepcut,total=daily.deepcut.rounds||8,roundShown=s.done?total:Math.min(total,s.round+1);
  $('#deepCutRound').textContent=`${roundShown}/${total}`;$('#deepCutScore').textContent=(s.score||0).toLocaleString();$('#deepCutTimer').textContent=s.started&&!s.done?fmtTime(remainingDeepCut()):'0:25';$('#deepCutStatus').textContent=s.done?'DONE':s.started?'LIVE':'READY';
  $('#deepCutIntro').hidden=s.started||s.done;$('#deepCutPlay').hidden=!s.started||s.done;$('#deepCutDone').hidden=!s.done;
  const current=deepCutPrompt();if(current)$('#deepCutPrompt').textContent=current.prompt;
  const history=$('#deepCutHistory');history.innerHTML='';
  for(const a of s.answers){const row=document.createElement('div');row.className='deepcut-result';const badge=a.accepted?(a.tier||'ACCEPTED'):(a.timedOut?'TIME':'MISS');row.innerHTML=`<div><span class="deepcut-tier ${String(badge).toLowerCase()}">${escapeHtml(badge)}</span><strong>${escapeHtml(a.answer||'No answer')}</strong><small>${escapeHtml(a.prompt||'')}</small></div><b>+${Number(a.score||0)}</b>`;history.appendChild(row)}
  const input=$('#deepCutInput'),button=$('#deepCutForm button');input.disabled=!s.started||s.done||deepCutBusy;button.disabled=input.disabled;
  if(s.done){$('#deepCutDoneScore').textContent=(s.score||0).toLocaleString();const msg=$('#deepCutMessage');msg.className='message good';msg.textContent=`Daily Deep Cut complete — ${s.score.toLocaleString()} points.`}
  updateHome();
}
function armDeepCutTimer(){clearInterval(deepCutTick);deepCutTick=setInterval(()=>{const s=day?.deepcut;if(!s?.started||s.done){clearInterval(deepCutTick);return}const left=remainingDeepCut();$('#deepCutTimer').textContent=fmtTime(left);if(left<=0)void timeoutDeepCut()},250)}
function finishDeepCut(){const s=day.deepcut;s.started=false;s.done=true;s.deadline=0;clearInterval(deepCutTick);renderDeepCut()}
async function timeoutDeepCut(){const s=day.deepcut;if(deepCutBusy||!s.started||s.done||remainingDeepCut()>0)return;deepCutBusy=true;const prompt=deepCutPrompt();s.answers.push({promptId:prompt?.id||'',prompt:prompt?.prompt||'',answer:'',accepted:false,timedOut:true,tier:'TIME',score:0});s.round++;$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent='Time. No points for that prompt.';if(s.round>=daily.deepcut.rounds){deepCutBusy=false;finishDeepCut();return}s.deadline=Date.now()+daily.deepcut.seconds*1000;deepCutBusy=false;renderDeepCut();$('#deepCutInput').focus()}
$('#deepCutStart').addEventListener('click',()=>{const s=day.deepcut;if(s.done)return;s.started=true;s.deadline=Date.now()+daily.deepcut.seconds*1000;$('#deepCutMessage').className='message';$('#deepCutMessage').textContent='Think past the first obvious answer.';renderDeepCut();armDeepCutTimer();$('#deepCutInput').focus()});
$('#deepCutForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=day.deepcut;if(deepCutBusy||!s.started||s.done)return;const prompt=deepCutPrompt(),input=$('#deepCutInput'),answer=input.value.trim();if(!answer){$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent='Type one answer before you submit.';return}deepCutBusy=true;input.disabled=true;
  try{const r=await api('/api/deepcut/check',{promptId:prompt.id,answer});const item={promptId:prompt.id,prompt:prompt.prompt,answer:r.canonical||answer,accepted:!!r.accepted,tier:r.tier||'MISS',score:Number(r.score||0)};s.answers.push(item);s.score+=item.score;s.round++;input.value='';const msg=$('#deepCutMessage');if(item.accepted){msg.className='message good';msg.textContent=`${item.tier}: ${item.answer} — +${item.score}` }else{msg.className='message bad';msg.textContent=`${answer} wasn't accepted for that category.`}if(s.round>=daily.deepcut.rounds){deepCutBusy=false;finishDeepCut();return}s.deadline=Date.now()+daily.deepcut.seconds*1000;deepCutBusy=false;renderDeepCut();$('#deepCutInput').focus()}catch(err){deepCutBusy=false;input.disabled=false;$('#deepCutMessage').className='message bad';$('#deepCutMessage').textContent=err.message}
});

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

// Archive + help
function renderArchive(){
  const el=$('#archiveList'),rows=Object.entries(state.days).filter(([,v])=>Object.values(v).some(x=>x?.done)).sort((a,b)=>b[0].localeCompare(a[0]));el.innerHTML='';if(!rows.length){el.innerHTML='<div class="empty-state">Finish a puzzle and your first day will appear here.</div>';return}
  for(const [d,v] of rows.slice(0,60)){const scores=DAILY_GAMES.map(g=>v[g]?.score||0),total=scores.reduce((a,b)=>a+b,0),complete=DAILY_GAMES.every(g=>v[g]?.done),date=dateObj(d),row=document.createElement('div');row.className='archive-row';row.innerHTML=`<div><strong>${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</strong><br><small>Grid ${scores[0]} · Groups ${scores[1]} · Trail ${scores[2]} · Link ${scores[3]} · Steps ${scores[4]} · Deep Cut ${scores[5]}</small></div><span class="archive-score">${total.toLocaleString()}</span><span class="archive-badge">${complete?'SET COMPLETE':'IN PROGRESS'}</span>`;el.appendChild(row)}
}
const help={
  letter:'<h2>Letter Grid</h2><p>Guess a 5–10 letter word in six tries. Green is the right letter in the right place; gold is the right letter in the wrong place. Longer words score more. If you miss it, the answer is revealed.</p>',
  groups:'<h2>Four Groups</h2><p>Select four words with a shared connection. Find all four before making four mistakes. If you run out of mistakes, every remaining solution is revealed.</p>',
  trail:'<h2>Letter Trail</h2><p>Trace any dictionary English word of at least three letters by tapping or dragging through touching tiles. Horizontal, vertical, and diagonal moves count; a tile cannot repeat inside one word. Every valid word scores. When time expires, Clue Morning reveals only the longest possible word on the board.</p>',
  link:'<h2>Triple Link</h2><p>One word makes a familiar phrase or compound with all three clues. You get three guesses. If you miss, the answer and all three completed links are revealed.</p>',
  steps:'<h2>Word Steps</h2><p>Start with one four-letter word and reach the target by changing exactly one letter at a time. Every intermediate step must be a recognized word. You can undo moves; solve within eight moves for points.</p>',
  deepcut:'<h2>Deep Cut</h2><p>Eight quick open-answer trivia prompts. You get 25 seconds for each one and one answer per prompt. Correct answers score from 30 to 100 points: familiar answers score less, while less-obvious valid answers score more.</p>'
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
    daily=await api('/api/daily');currentDateKey=daily.date;state.days[currentDateKey]??={};day=state.days[currentDateKey];
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
