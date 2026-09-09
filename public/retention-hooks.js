(()=>{
  const CORE_STORE='clue-morning-state-v2.4';
  const LAST_STORE='clue-morning-last-call-v1';
  const TZ='America/Los_Angeles';
  const GAMES=[
    {id:'letter',name:'Letter Grid',tab:'letter'},
    {id:'groups',name:'Four Groups',tab:'groups'},
    {id:'trail',name:'Letter Trail',tab:'trail'},
    {id:'link',name:'Triple Link',tab:'link'},
    {id:'steps',name:'Word Steps',tab:'steps'},
    {id:'deepcut',name:'Deep Cut',tab:'deepcut'},
    {id:'lastcall',name:'Last Call',tab:'lastcall'}
  ];
  const DAILY_IDS=new Set(['today',...GAMES.map(g=>g.tab)]);
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let currentDate='';
  let previousDone=-1;
  let lastSignature='';
  let toastTimer=0;

  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  function pacificDateKey(d=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function dateObj(key){return new Date(`${key}T12:00:00`)}
  function coreDay(key){return read(CORE_STORE).days?.[key]||{}}
  function lastDay(key){return read(LAST_STORE).days?.[key]||{}}
  function gameState(key,id){return id==='lastcall'?lastDay(key):coreDay(key)?.[id]||{}}
  function gameScore(key,id){return Number(gameState(key,id)?.score||0)}
  function gameDone(key,id){return !!gameState(key,id)?.done}
  function completeDay(key){return GAMES.every(g=>gameDone(key,g.id))}
  function totalFor(key){return GAMES.reduce((n,g)=>n+gameScore(key,g.id),0)}
  function allKnownDates(){
    return [...new Set([
      ...Object.keys(read(CORE_STORE).days||{}),
      ...Object.keys(read(LAST_STORE).days||{})
    ])].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  }
  function streakFor(key){
    if(!key)return 0;
    let cursor=dateObj(key),streak=0;
    for(let i=0;i<730;i++){
      const k=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
      if(completeDay(k)){streak++;cursor.setDate(cursor.getDate()-1);continue}
      if(i===0){cursor.setDate(cursor.getDate()-1);continue}
      break;
    }
    return streak;
  }
  function previousBest(key){
    let best=0;
    for(const d of allKnownDates()){
      if(d===key||!completeDay(d))continue;
      best=Math.max(best,totalFor(d));
    }
    return best;
  }
  function metrics(){
    const date=currentDate||pacificDateKey();
    const rows=GAMES.map(g=>({...g,done:gameDone(date,g.id),score:gameScore(date,g.id)}));
    const done=rows.filter(r=>r.done).length;
    return {date,rows,done,total:rows.reduce((n,r)=>n+r.score,0),streak:streakFor(date),best:previousBest(date)};
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
    if(done>=4)return `${7-done} to Super Streak`;
    if(done>=2)return `${4-done} to Hot Streak`;
    if(done===1)return '1 more to a streak';
    return 'Start today’s run';
  }
  function openGame(game){
    if(!game)return;
    const tab=$(`.tab[data-tab="${game.tab}"]`);
    if(tab){tab.click();return}
    const home=game.id==='lastcall'?$('[data-lastcall-home]'):$(`[data-open="${game.tab}"]`);
    if(home){home.click();return}
    location.hash=`play=${game.tab}`;
  }
  function openLeaders(){const b=$('.tab[data-tab="leaders"]');if(b)b.click()}

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
    $('#morningReportTotal').textContent=m.total.toLocaleString();
    $('#morningReportStreak').textContent=m.streak.toLocaleString();
    const best=$('#morningReportBest');
    if(best)best.hidden=!(m.best>0&&m.total>m.best);
    rows.innerHTML=m.rows.map(r=>`<div class="morning-report-row"><span>${r.name}</span><strong>${r.done?r.score.toLocaleString():'—'}</strong><b>${r.done?'✓':''}</b></div>`).join('');
    const status=$('#morningReportShareStatus');if(status)status.textContent='';
  }
  function showReport(){
    renderReport();
    const d=$('#morningReportDialog');
    if(d&&!d.open)d.showModal();
  }

  function reportShareText(m){
    const date=new Intl.DateTimeFormat('en-US',{timeZone:TZ,month:'short',day:'numeric'}).format(dateObj(m.date));
    const best=m.best>0&&m.total>m.best?' · PERSONAL BEST':'';
    return [
      `Clue Morning · ${date}`,
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
    const m=metrics(),text=reportShareText(m),status=$('#morningReportShareStatus');
    if(status)status.textContent='';
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
    const t=document.createElement('div');t.id='retentionToast';t.className='retention-toast';t.hidden=true;
    document.body.appendChild(t);return t;
  }
  function showToast(m){
    const t=ensureToast(),next=nextGame(m);
    if(!next)return;
    t.innerHTML=`<div><span class="retention-kicker">RUN CONTINUES</span><strong>${m.done}/7 complete</strong><small>${milestone(m.done)}</small></div><button type="button">Next: ${next.name}</button>`;
    t.hidden=false;
    t.querySelector('button')?.addEventListener('click',()=>{t.hidden=true;openGame(next)},{once:true});
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},6500);
  }

  function wireScoreDialog(m){
    const button=$('#dailyScoreMore');
    if(!button)return;
    if(!button.dataset.retentionWired){
      button.dataset.retentionWired='1';
      button.addEventListener('click',event=>{
        const now=metrics();
        event.preventDefault();event.stopImmediatePropagation();
        $('#dailyScoreDialog')?.close();
        if(now.done>=7)showReport();else openGame(nextGame(now));
      },true);
    }
    if(m.done>=7)button.textContent='View Morning Report';
    else{
      const next=nextGame(m);
      button.textContent=next?`Next: ${next.name}`:'Play More Games';
    }
    const copy=$('#dailyScoreDialog .daily-score-copy');
    if(copy&&m.done<7)copy.textContent=`${m.done}/7 complete. ${milestone(m.done)}.`;
    else if(copy)copy.textContent='All seven are in. Your Morning Report is ready.';
  }

  function render(){
    ensureStrip();ensureReport();
    const m=metrics();
    const sig=`${m.date}:${m.done}:${m.total}:${m.rows.map(r=>r.done?'1':'0').join('')}:${activeId()}`;
    if(sig===lastSignature){wireScoreDialog(m);return}
    lastSignature=sig;
    const strip=$('#retentionRunStrip');
    if(strip)strip.hidden=!DAILY_IDS.has(activeId());
    const status=$('#retentionRunStatus');if(status)status.textContent=`${m.done}/7 · ${milestone(m.done)}`;
    $$('#retentionSegments i').forEach((el,i)=>el.classList.toggle('done',i<m.done));
    const nextButton=$('#retentionNext');
    if(nextButton){
      if(m.done>=7)nextButton.textContent='Morning Report';
      else{const next=nextGame(m);nextButton.textContent=next?`Next: ${next.name}`:'Start a game'}
    }
    wireScoreDialog(m);
    if(previousDone>=0&&m.done>previousDone){
      if(m.done>=7)setTimeout(showReport,260);
      else if(gameDone(m.date,'lastcall'))showToast(m);
    }
    previousDone=m.done;
  }

  function boot(){
    currentDate=pacificDateKey();
    try{fetch('/api/daily',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j?.date){currentDate=j.date;lastSignature='';render()}}).catch(()=>{})}catch{}
    render();
    const observer=new MutationObserver(()=>requestAnimationFrame(render));
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
    window.addEventListener('storage',()=>{lastSignature='';render()});
    window.addEventListener('clue-lastcall-update',()=>{lastSignature='';render()});
    window.addEventListener('hashchange',()=>{lastSignature='';render()});
    setInterval(()=>{const key=pacificDateKey();if(key!==currentDate){currentDate=key;previousDone=-1;lastSignature=''}render()},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
