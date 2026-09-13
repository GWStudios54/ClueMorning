(()=>{
  const CORE_STORE='clue-morning-state-v2.4';
  const LAST_STORE='clue-morning-last-call-v1';
  const TZ='America/Los_Angeles';
  const LAST_CALL_START='2026-08-31';
  const GAMES=[
    {id:'letter',name:'Letter Grid',tab:'letter'},
    {id:'groups',name:'Four Groups',tab:'groups'},
    {id:'trail',name:'Letter Trail',tab:'trail'},
    {id:'link',name:'Triple Link',tab:'link'},
    {id:'steps',name:'Word Steps',tab:'steps'},
    {id:'deepcut',name:'Deep Cut',tab:'deepcut'},
    {id:'lastcall',name:'Last Call',tab:'lastcall'}
  ];
  const CORE_IDS=GAMES.filter(g=>g.id!=='lastcall').map(g=>g.id);
  const DAILY_IDS=new Set(['today',...GAMES.map(g=>g.tab)]);
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let currentDate='';
  let previousDone=-1;
  let previousLastCallDone=null;
  let lastSignature='';
  let toastTimer=0;
  let renderQueued=false;

  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  function pacificDateKey(d=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function shiftDateKey(key,days){
    const [y,m,d]=String(key).split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d+days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  }
  function dateLabel(key){
    const [,month,day]=String(key).split('-').map(Number);
    const name=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.max(0,month-1)]||'';
    return `${name} ${day}`.trim();
  }
  function coreState(){return read(CORE_STORE)}
  function lastState(){return read(LAST_STORE)}
  function coreDay(key,core=coreState()){return core.days?.[key]||{}}
  function lastDay(key,last=lastState()){return last.days?.[key]||{}}
  function gameState(key,id,core,last){return id==='lastcall'?lastDay(key,last):coreDay(key,core)?.[id]||{}}
  function completeDay(key,core,last){
    const c=coreDay(key,core);
    if(!CORE_IDS.every(id=>c[id]?.done))return false;
    return key<LAST_CALL_START?true:!!lastDay(key,last).done;
  }
  function allKnownDates(core,last){
    return [...new Set([...Object.keys(core.days||{}),...Object.keys(last.days||{})])]
      .filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  }
  function totalFor(key,core,last){return GAMES.reduce((n,g)=>n+Number(gameState(key,g.id,core,last)?.score||0),0)}
  function streakFor(key,core,last){
    if(!key)return 0;
    let cursor=key,streak=0;
    for(let i=0;i<730;i++){
      if(completeDay(cursor,core,last)){streak++;cursor=shiftDateKey(cursor,-1);continue}
      if(i===0){cursor=shiftDateKey(cursor,-1);continue}
      break;
    }
    return streak;
  }
  function previousBest(key,core,last){
    let best=0;
    for(const d of allKnownDates(core,last)){
      if(d===key||!completeDay(d,core,last))continue;
      best=Math.max(best,totalFor(d,core,last));
    }
    return best;
  }
  function metrics(){
    const date=currentDate||pacificDateKey(),core=coreState(),last=lastState();
    const rows=GAMES.map(g=>({...g,done:!!gameState(date,g.id,core,last)?.done,score:Number(gameState(date,g.id,core,last)?.score||0)}));
    const done=rows.filter(r=>r.done).length;
    return {date,rows,done,total:rows.reduce((n,r)=>n+r.score,0),streak:streakFor(date,core,last),best:previousBest(date,core,last)};
  }
  function activeId(){return $('.panel.active')?.id||$('.tab.active')?.dataset.tab||'today'}
  function nextGame(m,from=activeId()){
    if(m.done>=GAMES.length)return null;
    const start=Math.max(-1,GAMES.findIndex(g=>g.tab===from));
    for(let step=1;step<=GAMES.length;step++){
      const g=GAMES[(start+step+GAMES.length)%GAMES.length];
      if(!m.rows.find(r=>r.id===g.id)?.done)return g;
    }
    return m.rows.find(r=>!r.done)||null;
  }
  function milestone(done){
    if(done>=7)return 'Morning cleared';
    if(done>=4)return `${7-done} to SUPER STREAK`;
    if(done>=2)return `${4-done} to Hot Streak`;
    if(done===1)return '1 more to a streak';
    return 'Start today’s run';
  }
  const GAME_ROUTES={letter:'/play/letter-grid/',groups:'/play/four-groups/',trail:'/play/letter-trail/',link:'/play/triple-link/',steps:'/play/word-steps/',deepcut:'/play/deep-cut/',lastcall:'/play/last-call/'};
  function openGame(game){
    if(!game)return;
    const route=GAME_ROUTES[game.id]||GAME_ROUTES[game.tab];
    if(route){location.assign(route);return}
    location.assign('/');
  }
  function openLeaders(){const b=$('.tab[data-tab="leaders"]');if(b)b.click()}
  function setText(selector,value){const el=$(selector);if(el&&el.textContent!==String(value))el.textContent=String(value)}

  const LANDING_TARGETS={
    letter:{status:'#letterCardStatus',score:'#homeLetterScore'},
    groups:{status:'#groupCardStatus',score:'#homeGroupScore'},
    trail:{status:'#trailCardStatus',score:'#homeTrailScore'},
    link:{status:'#linkCardStatus',score:'#homeLinkScore'},
    steps:{status:'#stepsCardStatus',score:'#homeStepsScore'},
    deepcut:{status:'#deepCutCardStatus',score:'#homeDeepCutScore'},
    lastcall:{status:'#lastCallCardStatus',score:'#homeLastCallScore'}
  };
  function statusMarkup(done){
    const icon=done?'i-check':'i-play';
    return `<svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>${done?'DONE':'PLAY'}`;
  }
  function syncLandingCards(m){
    for(const row of m.rows){
      const target=LANDING_TARGETS[row.id];if(!target)continue;
      const status=$(target.status);
      if(status){
        status.classList.toggle('done',row.done);
        const label=row.done?'DONE':'PLAY';
        if(!status.textContent?.includes(label))status.innerHTML=statusMarkup(row.done);
        const card=status.closest('.game-card');
        if(card)card.setAttribute('aria-label',`${row.name}${row.done?' — complete':''}`);
      }
      setText(target.score,row.score.toLocaleString());
    }
  }

  function ensureStrip(){
    if($('#retentionRunStrip')||!$('.tabs'))return;
    const strip=document.createElement('aside');
    strip.id='retentionRunStrip';
    strip.className='retention-run-strip';
    strip.innerHTML=`
      <div class="retention-run-copy">
        <span class="retention-kicker">MORNING RUN</span>
        <strong id="retentionRunStatus">0/7 · Start today’s run</strong>
      </div>
      <div class="retention-segments" id="retentionSegments" aria-label="Morning run progress">${GAMES.map(()=>'<i></i>').join('')}</div>
      <button id="retentionNext" class="retention-next" type="button">Start a game</button>
    `;
    $('.tabs').insertAdjacentElement('afterend',strip);
    $('#retentionNext')?.addEventListener('click',()=>{
      const m=metrics();
      if(m.done>=7)showReport();else openGame(nextGame(m));
    });
  }

  function ensureReport(){
    if($('#morningReportDialog')||!$('.app'))return;
    const d=document.createElement('dialog');
    d.id='morningReportDialog';
    d.className='morning-report-dialog';
    d.innerHTML=`
      <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close Morning Report"><span aria-hidden="true">×</span></button></form>
      <span class="retention-kicker">MORNING REPORT</span>
      <h2>Morning cleared.</h2>
      <div class="morning-report-hero">
        <div><strong id="morningReportTotal">0</strong><span>points</span></div>
        <div><strong id="morningReportStreak">0</strong><span>day streak</span></div>
      </div>
      <div id="morningReportBest" class="morning-report-best" hidden>NEW PERSONAL BEST</div>
      <div id="morningReportRows" class="morning-report-rows"></div>
      <p class="morning-report-return">Fresh set tomorrow. Keep the streak alive.</p>
      <div class="morning-report-actions">
        <button id="morningReportShare" class="primary-button" type="button">Share without spoilers</button>
        <button id="morningReportLeaders" class="secondary-button" type="button">See leaderboard</button>
      </div>
      <p id="morningReportShareStatus" class="morning-report-share-status" role="status" aria-live="polite"></p>
    `;
    $('.app').appendChild(d);
    $('#morningReportShare')?.addEventListener('click',()=>void shareReport());
    $('#morningReportLeaders')?.addEventListener('click',()=>{d.close();openLeaders()});
  }

  function renderReport(){
    ensureReport();
    const m=metrics(),rows=$('#morningReportRows');
    if(!rows)return;
    setText('#morningReportTotal',m.total.toLocaleString());
    setText('#morningReportStreak',m.streak.toLocaleString());
    const best=$('#morningReportBest');if(best)best.hidden=!(m.best>0&&m.total>m.best);
    rows.innerHTML=m.rows.map(r=>`<div class="morning-report-row"><span>${r.name}</span><strong>${r.done?r.score.toLocaleString():'—'}</strong><b>${r.done?'✓':''}</b></div>`).join('');
    setText('#morningReportShareStatus','');
  }
  function showReport(){renderReport();const d=$('#morningReportDialog');if(d&&!d.open)d.showModal()}
  function reportShareText(m){
    const best=m.best>0&&m.total>m.best?' · PERSONAL BEST':'';
    return [
      `Clue Morning · ${dateLabel(m.date)}`,
      `7/7 · SUPER STREAK${best}`,
      `${m.total.toLocaleString()} points · ${m.streak} day streak`,
      '',
      '✓ Letter Grid  ✓ Four Groups',
      '✓ Letter Trail ✓ Triple Link',
      '✓ Word Steps   ✓ Deep Cut',
      '✓ Last Call',
      '',
      'cluemorning.com'
    ].join('\n');
  }
  async function copy(text){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
    const a=document.createElement('textarea');a.value=text;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();
  }
  async function shareReport(){
    const m=metrics(),text=reportShareText(m),status=$('#morningReportShareStatus');if(status)status.textContent='';
    try{
      if(navigator.share){await navigator.share({title:'Clue Morning — Morning Report',text,url:'https://cluemorning.com/'});if(status)status.textContent='Shared.';return}
      await copy(text);if(status)status.textContent='Morning Report copied.';
    }catch(err){
      if(err?.name==='AbortError')return;
      try{await copy(text);if(status)status.textContent='Morning Report copied.'}catch{if(status)status.textContent='Sharing is not available in this browser.'}
    }
  }

  function ensureToast(){
    if($('#retentionToast'))return $('#retentionToast');
    const t=document.createElement('div');t.id='retentionToast';t.className='retention-toast';t.hidden=true;document.body.appendChild(t);return t;
  }
  function showToast(m){
    const t=ensureToast(),next=nextGame(m);if(!next)return;
    t.innerHTML=`<div><span class="retention-kicker">RUN CONTINUES</span><strong>${m.done}/7 complete</strong><small>${milestone(m.done)}</small></div><button type="button">Next: ${next.name}</button>`;
    t.hidden=false;
    t.querySelector('button')?.addEventListener('click',()=>{t.hidden=true;openGame(next)},{once:true});
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},6500);
  }

  function syncScoreDialog(m){
    const button=$('#dailyScoreMore');
    if(!button)return;
    if(m.done>=7)button.textContent='View Morning Report';
    else{const next=nextGame(m);button.textContent=next?`Next: ${next.name}`:'Play More Games'}
    const copyEl=$('#dailyScoreDialog .daily-score-copy');
    if(copyEl)copyEl.textContent=m.done>=7?'All seven are in. Your Morning Report is ready.':`${m.done}/7 complete. ${milestone(m.done)}.`;
  }

  function render(){
    const pacificToday=pacificDateKey();
    if(!currentDate||currentDate!==pacificToday){currentDate=pacificToday;previousDone=-1;previousLastCallDone=null;lastSignature=''}
    ensureStrip();ensureReport();
    const m=metrics(),lastCallDone=!!m.rows.find(r=>r.id==='lastcall')?.done;
    syncLandingCards(m);
    syncScoreDialog(m);
    const sig=`${m.date}:${m.done}:${m.total}:${m.streak}:${m.rows.map(r=>r.done?'1':'0').join('')}:${activeId()}`;
    if(sig===lastSignature)return;
    lastSignature=sig;
    try{window.dispatchEvent(new CustomEvent('clue:run-progress',{detail:{date:m.date,done:m.done,total:m.total,streak:m.streak}}))}catch{}
    const strip=$('#retentionRunStrip');if(strip)strip.hidden=!DAILY_IDS.has(activeId());
    setText('#retentionRunStatus',`${m.done}/7 · ${milestone(m.done)}`);
    $$('#retentionSegments i').forEach((el,i)=>el.classList.toggle('done',i<m.done));
    const nextButton=$('#retentionNext');
    if(nextButton){
      if(m.done>=7)nextButton.textContent='Morning Report';
      else{const next=nextGame(m);nextButton.textContent=next?`Next: ${next.name}`:'Start a game'}
    }
    setText('#todayTotal',m.total.toLocaleString());setText('#homeTotalScore',m.total.toLocaleString());setText('#streakCount',m.streak.toLocaleString());
    if(previousDone>=0&&m.done>previousDone){
      if(previousLastCallDone===false&&lastCallDone&&m.done>=7)setTimeout(showReport,180);
      else if(m.done>=7)setTimeout(showReport,180);
      else showToast(m);
    }
    previousDone=m.done;previousLastCallDone=lastCallDone;
  }
  function schedule(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render()})}

  document.addEventListener('click',event=>{
    const more=event.target?.closest?.('#dailyScoreMore');
    if(more){
      const m=metrics();event.preventDefault();event.stopImmediatePropagation();$('#dailyScoreDialog')?.close();if(m.done>=7)showReport();else openGame(nextGame(m));return;
    }
    if(event.target?.closest?.('.tab,[data-open],[data-lastcall-home]'))setTimeout(schedule,0);
  },true);
  document.addEventListener('submit',()=>setTimeout(schedule,0),true);
  window.addEventListener('clue:statechange',schedule);
  window.addEventListener('clue-lastcall-update',schedule);
  window.addEventListener('storage',schedule);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});

  function boot(){
    currentDate=pacificDateKey();render();
    try{fetch('/api/daily',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j?.date&&j.date!==currentDate){currentDate=j.date;previousDone=-1;previousLastCallDone=null;lastSignature='';schedule()}}).catch(()=>{})}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
