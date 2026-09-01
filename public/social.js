(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const CORE_STORE='clue-morning-state-v2.4',EXP_STORE='clue-morning-daily-expansion-v1',LAST_STORE='clue-morning-last-call-v1';
  const EXPANSION_START='2026-08-31',BASE_URL='https://cluemorning.com/';
  const GAMES=[
    {id:'letter',name:'Letter Grid',short:'Grid'},
    {id:'groups',name:'Four Groups',short:'Groups'},
    {id:'trail',name:'Letter Trail',short:'Trail'},
    {id:'link',name:'Triple Link',short:'Link'},
    {id:'steps',name:'Word Steps',short:'Steps'},
    {id:'deepcut',name:'Deep Cut',short:'Deep Cut'},
    {id:'situation',name:'Situation',short:'Situation'},
    {id:'lastcall',name:'Last Call',short:'Last Call'}
  ];
  let currentDate='',scheduled=false,sharing=false;

  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
  function coreDay(date){return read(CORE_STORE).days?.[date]||{}}
  function expDay(date){return read(EXP_STORE).days?.[date]||{}}
  function lastDay(date){return read(LAST_STORE).days?.[date]||{}}
  function latestDate(){
    const keys=[...Object.keys(read(CORE_STORE).days||{}),...Object.keys(read(EXP_STORE).days||{}),...Object.keys(read(LAST_STORE).days||{})].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    return keys.at(-1)||'';
  }
  function dateLabel(date,full=false){
    if(!date)return 'Today';const d=new Date(date+'T12:00:00');
    return d.toLocaleDateString(undefined,full?{weekday:'long',month:'long',day:'numeric'}:{month:'short',day:'numeric'});
  }
  function number(v){return Number(v||0)}
  function plural(n,one,many=one+'s'){return Number(n)===1?one:many}
  function gameState(date,id){
    if(id==='situation')return expDay(date).situation||{};
    if(id==='lastcall')return lastDay(date)||{};
    return coreDay(date)[id]||{};
  }
  function gameDone(date,id){return !!gameState(date,id).done}
  function gameScore(date,id){return number(gameState(date,id).score)}
  function fullComplete(date){
    const core=coreDay(date),base=['letter','groups','trail','link','steps','deepcut'].every(g=>core[g]?.done);if(!base)return false;
    if(date<EXPANSION_START)return true;
    return !!expDay(date).situation?.done&&!!lastDay(date).done;
  }
  function dayStreak(date){
    if(!date)return 0;let cursor=new Date(date+'T12:00:00'),streak=0;
    for(let i=0;i<730;i++){
      const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;
      if(fullComplete(key)){streak++;cursor.setDate(cursor.getDate()-1);continue}
      if(i===0){cursor.setDate(cursor.getDate()-1);continue}break;
    }
    return streak;
  }
  function letterPattern(s){
    if(!Array.isArray(s.guesses)||!s.guesses.length)return '';
    const tile=x=>x==='green'?'🟩':x==='yellow'?'🟨':'⬛';
    return s.guesses.map(g=>Array.isArray(g.feedback)?g.feedback.map(tile).join(''):'').filter(Boolean).join('\n');
  }
  function result(date,id){
    const s=gameState(date,id),score=gameScore(date,id),done=!!s.done;let summary='Not played';
    if(id==='letter'&&done){const n=s.guesses?.length||0;summary=s.won?`${n}/6 guesses`:'Missed'}
    if(id==='groups'&&done){const solved=s.solved?.length||0,m=number(s.mistakes);summary=`${solved}/4 groups · ${m} ${plural(m,'miss','misses')}`}
    if(id==='trail'&&done){const words=s.words?.length||0,best=String(s.best||'').length;summary=`${words} ${plural(words,'word')}${best?` · best ${best} letters`:''}`}
    if(id==='link'&&done){summary=s.won?`${number(s.guesses)}/3 guesses`:'Missed'}
    if(id==='steps'&&done){const moves=Math.max(0,(s.path?.length||1)-1);summary=s.won?`${moves} ${plural(moves,'move')}`:'Revealed'}
    if(id==='deepcut'&&done){const answers=Array.isArray(s.answers)?s.answers:[],accepted=answers.filter(a=>a.accepted).length,rare=answers.filter(a=>a.accepted&&a.tier==='RARE').length;summary=`${accepted}/8 valid${rare?` · ${rare} rare`:''}`}
    if(id==='situation'&&done){const moves=number(s.moves);summary=`${moves}/3 moves`}
    if(id==='lastcall'&&done){const depth=number(s.correctCount);summary=s.jackpot?'Jackpot · 6/6':s.bustId?`Bust · ${depth}/6`:s.banked?`Banked · ${depth}/6`:`${depth}/6`}
    return {id,name:GAMES.find(g=>g.id===id)?.name||id,short:GAMES.find(g=>g.id===id)?.short||id,done,score,summary,state:s};
  }
  function snapshot(date=currentDate||latestDate()){
    const games=GAMES.map(g=>result(date,g.id)),done=games.filter(g=>g.done).length,total=games.reduce((n,g)=>n+g.score,0),streak=dayStreak(date);
    const tier=done>=8?'SUPER STREAK':done>=4?'HOT STREAK':done>=2?'STREAK':'MORNING IN PROGRESS';
    return {date,games,done,total,streak,tier,complete:done===8};
  }

  function shareIcon(){return '<svg class="icon social-share-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>'}
  function injectReport(){
    if($('#morningReport'))return true;const today=$('#today'),strip=today?.querySelector('.score-strip');if(!today||!strip)return false;
    const section=document.createElement('section');section.id='morningReport';section.className='morning-report';
    section.innerHTML=`<div class="morning-report-head"><div><span class="game-label">MORNING REPORT</span><h2 id="morningReportTitle">Your morning, at a glance.</h2><p id="morningReportSub">Finish the set to unlock the complete share card.</p></div><div class="morning-report-badge"><strong id="morningReportCount">0/8</strong><span id="morningReportTier">IN PROGRESS</span></div></div><div id="morningReportGrid" class="morning-report-grid"></div><div class="morning-report-footer"><div class="morning-report-total"><span>Daily total</span><strong id="morningReportTotal">0</strong><small id="morningReportStreak">No day streak yet</small></div><div class="morning-report-actions"><button id="morningReportShare" class="primary-button social-share-button" type="button" disabled>${shareIcon()}<span>Finish all 8 to share</span></button><p id="morningReportShareNote">Individual results can be shared as soon as each game is complete.</p></div></div>`;
    strip.after(section);$('#morningReportShare')?.addEventListener('click',()=>shareMorning());return true;
  }
  function injectPanelShares(){
    for(const g of GAMES){const panel=$('#'+g.id);if(!panel||panel.querySelector(`[data-social-game="${g.id}"]`))continue;const wrap=document.createElement('div');wrap.className='social-game-share';wrap.dataset.socialGame=g.id;wrap.hidden=true;wrap.innerHTML=`<button class="secondary-button social-share-button" type="button">${shareIcon()}<span>Share result</span></button><small>Share without revealing the answer.</small>`;wrap.querySelector('button').addEventListener('click',()=>shareGame(g.id));panel.appendChild(wrap)}
  }
  function toast(message){
    let t=$('#socialToast');if(!t){t=document.createElement('div');t.id='socialToast';t.className='social-toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2200);
  }
  function renderReport(){
    const s=snapshot();if(!s.date)return;const grid=$('#morningReportGrid');if(!grid)return;
    $('#morningReportCount').textContent=`${s.done}/8`;$('#morningReportTier').textContent=s.tier;$('#morningReportTotal').textContent=s.total.toLocaleString();$('#morningReportTitle').textContent=s.complete?'Morning cleared.':'Your morning, at a glance.';
    $('#morningReportSub').textContent=s.complete?'Your Super Streak is ready to share.':`${8-s.done} ${plural(8-s.done,'game')} left before the full Morning Report unlocks.`;
    $('#morningReportStreak').textContent=s.streak?`${s.streak}-day streak`:'No day streak yet';
    const share=$('#morningReportShare');if(share){share.disabled=!s.complete||sharing;share.querySelector('span').textContent=s.complete?'Share Morning Report':'Finish all 8 to share'}
    grid.innerHTML='';for(const g of s.games){const item=document.createElement('div');item.className=`morning-report-game${g.done?' done':''}`;item.innerHTML=`<span class="morning-report-check">${g.done?'✓':'·'}</span><div><strong>${g.name}</strong><small>${g.done?g.summary:'Still waiting'}</small></div><b>${g.done?g.score.toLocaleString():'—'}</b>`;grid.appendChild(item)}
    for(const g of s.games){const wrap=$(`[data-social-game="${g.id}"]`);if(wrap){wrap.hidden=!g.done;const button=wrap.querySelector('button');if(button)button.disabled=sharing}}
  }
  function buildGameText(s,g){
    const lines=[`Clue Morning · ${dateLabel(s.date,true)}`,`${g.name}: ${g.summary}`,`${g.score.toLocaleString()} points`];
    if(g.id==='letter'){const pattern=letterPattern(g.state);if(pattern)lines.push('',pattern)}
    if(s.done>=2)lines.push('',`${s.tier} · ${s.done}/8 complete`);if(s.streak)lines.push(`🔥 ${s.streak}-day streak`);lines.push(BASE_URL);return lines.join('\n');
  }
  function buildMorningText(s){
    const lines=[`CLUE MORNING · ${dateLabel(s.date,true)}`,`${s.tier} · ${s.total.toLocaleString()} points`];if(s.streak)lines.push(`🔥 ${s.streak}-day streak`);lines.push('');
    for(const g of s.games)lines.push(`${g.done?'✓':'·'} ${g.name} — ${g.done?g.summary:'Not finished'}${g.done?` · ${g.score.toLocaleString()}`:''}`);lines.push('',BASE_URL);return lines.join('\n');
  }
  function palette(){
    const cs=getComputedStyle(document.documentElement),get=(n,f)=>cs.getPropertyValue(n).trim()||f;return {paper:get('--paper','#f7f1e5'),card:get('--card','#fffaf0'),ink:get('--ink','#29241c'),muted:get('--muted','#756d60'),line:get('--line','#d6c9b5'),sun:get('--sun','#d8a348'),green:get('--green','#657b63'),green2:get('--green2','#dfe9dc')};
  }
  function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath()}
  function canvasBlob(canvas){return new Promise(resolve=>canvas.toBlob(resolve,'image/png',.94))}
  async function renderShareImage(s,gameId=null){
    const p=palette(),canvas=document.createElement('canvas'),report=!gameId;canvas.width=1200;canvas.height=report?1500:900;const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.fillStyle=p.paper;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=p.sun;ctx.fillRect(0,0,canvas.width,12);
    ctx.fillStyle=p.ink;ctx.font='800 54px Georgia, serif';ctx.fillText('Clue Morning',80,105);ctx.fillStyle=p.muted;ctx.font='700 24px system-ui, sans-serif';ctx.fillText(dateLabel(s.date,true).toUpperCase(),82,146);
    if(report){
      ctx.fillStyle=p.ink;ctx.font='800 72px Georgia, serif';ctx.fillText('Morning Report',80,245);ctx.fillStyle=p.green;ctx.font='900 28px system-ui, sans-serif';ctx.fillText(s.tier,82,294);ctx.fillStyle=p.ink;ctx.font='800 50px Georgia, serif';ctx.textAlign='right';ctx.fillText(s.total.toLocaleString(),1120,248);ctx.fillStyle=p.muted;ctx.font='700 21px system-ui, sans-serif';ctx.fillText('POINTS',1120,282);ctx.textAlign='left';
      const startY=345,boxW=500,boxH=205,gapX=40,gapY=28;
      s.games.forEach((g,i)=>{const col=i%2,row=Math.floor(i/2),x=80+col*(boxW+gapX),y=startY+row*(boxH+gapY);ctx.fillStyle=g.done?p.card:p.paper;ctx.strokeStyle=g.done?p.green:p.line;ctx.lineWidth=g.done?3:2;rounded(ctx,x,y,boxW,boxH,24);ctx.fill();ctx.stroke();ctx.fillStyle=g.done?p.green:p.muted;ctx.font='900 28px system-ui, sans-serif';ctx.fillText(g.done?'✓':'·',x+28,y+47);ctx.fillStyle=p.ink;ctx.font='800 31px Georgia, serif';ctx.fillText(g.name,x+70,y+48);ctx.fillStyle=p.muted;ctx.font='650 21px system-ui, sans-serif';ctx.fillText(g.done?g.summary:'Still waiting',x+28,y+100);ctx.fillStyle=p.ink;ctx.font='800 34px Georgia, serif';ctx.fillText(g.done?g.score.toLocaleString():'—',x+28,y+157);ctx.fillStyle=p.muted;ctx.font='700 17px system-ui, sans-serif';ctx.fillText(g.done?'POINTS':'',x+140,y+156)});
      const footY=1310;ctx.fillStyle=p.ink;ctx.font='800 35px Georgia, serif';ctx.fillText(s.streak?`${s.streak}-day streak`:'Morning complete',80,footY);ctx.fillStyle=p.muted;ctx.font='650 23px system-ui, sans-serif';ctx.fillText('Eight games. One morning run.',80,footY+46);ctx.textAlign='right';ctx.fillStyle=p.ink;ctx.font='800 24px system-ui, sans-serif';ctx.fillText('cluemorning.com',1120,footY+45);ctx.textAlign='left';
    }else{
      const g=s.games.find(x=>x.id===gameId);if(!g)return null;ctx.fillStyle=p.muted;ctx.font='900 24px system-ui, sans-serif';ctx.fillText('DAILY RESULT',82,230);ctx.fillStyle=p.ink;ctx.font='800 76px Georgia, serif';ctx.fillText(g.name,80,310);ctx.fillStyle=p.green;ctx.font='900 30px system-ui, sans-serif';ctx.fillText(g.summary.toUpperCase(),82,366);ctx.fillStyle=p.card;ctx.strokeStyle=p.line;ctx.lineWidth=2;rounded(ctx,80,430,1040,245,30);ctx.fill();ctx.stroke();ctx.fillStyle=p.muted;ctx.font='700 22px system-ui, sans-serif';ctx.fillText('SCORE',120,490);ctx.fillStyle=p.ink;ctx.font='800 86px Georgia, serif';ctx.fillText(g.score.toLocaleString(),118,585);ctx.fillStyle=p.muted;ctx.font='700 22px system-ui, sans-serif';ctx.fillText(`${s.tier} · ${s.done}/8 COMPLETE`,120,635);ctx.fillStyle=p.ink;ctx.font='800 25px system-ui, sans-serif';ctx.fillText('cluemorning.com',80,810);
    }
    return canvasBlob(canvas);
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true}catch{}
    try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch{return false}
  }
  async function sharePayload({title,text,fileName,blob}){
    if(navigator.share){
      try{
        if(blob&&window.File&&navigator.canShare){const file=new File([blob],fileName,{type:'image/png'});if(navigator.canShare({files:[file]})){await navigator.share({title,text,files:[file],url:BASE_URL});return 'shared'}}
        await navigator.share({title,text,url:BASE_URL});return 'shared';
      }catch(err){if(err?.name==='AbortError')return 'cancelled'}
    }
    const ok=await copyText(`${text}\n${BASE_URL}`);return ok?'copied':'failed';
  }
  async function shareGame(id){
    if(sharing)return;const s=snapshot(),g=s.games.find(x=>x.id===id);if(!g?.done)return;sharing=true;renderReport();
    try{const blob=await renderShareImage(s,id),result=await sharePayload({title:`Clue Morning — ${g.name}`,text:buildGameText(s,g),fileName:`clue-morning-${id}-${s.date}.png`,blob});if(result==='copied')toast('Result copied to clipboard.');else if(result==='failed')toast('Could not open sharing on this browser.')}finally{sharing=false;renderReport()}
  }
  async function shareMorning(){
    if(sharing)return;const s=snapshot();if(!s.complete)return;sharing=true;renderReport();
    try{const blob=await renderShareImage(s),result=await sharePayload({title:'Clue Morning — Morning Report',text:buildMorningText(s),fileName:`clue-morning-report-${s.date}.png`,blob});if(result==='copied')toast('Morning Report copied to clipboard.');else if(result==='failed')toast('Could not open sharing on this browser.')}finally{sharing=false;renderReport()}
  }
  function run(){if(!currentDate)currentDate=latestDate();injectReport();injectPanelShares();renderReport()}
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run()})}
  async function boot(){
    try{const r=await fetch('/api/daily',{cache:'no-store'}),j=await r.json();if(r.ok&&j.date)currentDate=j.date}catch{}if(!currentDate)currentDate=latestDate();run();const obs=new MutationObserver(queue);obs.observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('clue-lastcall-update',queue);window.addEventListener('storage',queue);
  }
  boot();
})();
