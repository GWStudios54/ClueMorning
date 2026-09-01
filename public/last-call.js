(()=>{
  const STORE='clue-morning-last-call-v1',LADDER=[0,100,250,500,850,1300,2000];
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const svgBell='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 15h10M8 15V10a4 4 0 0 1 8 0v5M5 18h14M10 21h4"/><path d="M12 4V2"/></svg>';
  let data=load(),daily=null,date='',puzzle=null,day=null,revealMap=new Map(),busy=false;
  function load(){try{const v=JSON.parse(localStorage.getItem(STORE)||'null');return v?.version===1?v:{version:1,days:{}}}catch{return {version:1,days:{}}}}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(data))}catch{}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function statusMarkup(done){return `<svg class="icon"><use href="#${done?'i-check':'i-play'}"/></svg>${done?'DONE':'PLAY'}`}
  function currentPot(){return LADDER[Math.min(day?.correctCount||0,LADDER.length-1)]||0}

  function injectUI(){
    if($('#lastcall')||!$('#today'))return;
    const nav=$('.tabs'),tileTab=nav?.querySelector('.tileworks-nav-tab'),founder=$('#unlimitedTab'),leaders=nav?.querySelector('[data-tab="leaders"]');
    if(nav){const b=document.createElement('button');b.className='tab';b.type='button';b.dataset.tab='lastcall';b.innerHTML=`<svg class="lastcall-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 15h10M8 15V10a4 4 0 0 1 8 0v5M5 18h14M10 21h4M12 4V2"/></svg><span>Last Call</span>`;nav.insertBefore(b,tileTab||founder||leaders||null);b.addEventListener('click',()=>openPanel())}
    const cards=$('#today .game-cards'),tileCard=cards?.querySelector('[data-tileworks-home]');
    if(cards){const b=document.createElement('button');b.className='game-card';b.type='button';b.dataset.lastcallHome='1';b.innerHTML=`<div class="game-icon lastcall-icon">${svgBell}</div><div class="game-copy"><span class="game-label">PUSH YOUR LUCK</span><h3>Last Call</h3><p>Six safe answers. Six traps. Bank your points before you get greedy.</p></div><span class="game-status" id="lastCallCardStatus">${statusMarkup(false)}</span>`;cards.insertBefore(b,tileCard||null);b.addEventListener('click',()=>openPanel())}
    const strip=$('#today .score-strip'),total=strip?.querySelector('.score-strip-total');if(strip&&!$('#homeLastCallScore'))total?.insertAdjacentHTML('beforebegin','<div><span>Last Call</span><strong id="homeLastCallScore">0</strong></div>');
    const panel=document.createElement('section');panel.id='lastcall';panel.className='panel';panel.innerHTML=`<div class="panel-head"><div><span class="game-label">TODAY'S PUSH</span><h2>Last Call</h2><p>Every correct pick grows the pot. One fake wipes it out.</p></div><button class="round-button" id="lastCallHelp" type="button" aria-label="Last Call help"><svg class="icon"><use href="#i-help"/></svg></button></div><div class="stats-row three"><div class="stat"><strong id="lastCallDepth">0/6</strong><span>safe picks</span></div><div class="stat"><strong id="lastCallScore">0</strong><span>banked score</span></div><div class="stat"><strong id="lastCallStatus">OPEN</strong><span>status</span></div></div><div class="lastcall-table"><span id="lastCallTag" class="lastcall-category">TODAY</span><h3 id="lastCallPrompt">Loading today's board…</h3><p>Exactly six choices are safe. Tap one at a time. You can bank after any correct answer.</p><div class="lastcall-pot"><div><span>CURRENT POT</span><strong id="lastCallPot">0</strong></div><small id="lastCallNext">First safe pick is worth 100.</small></div><div id="lastCallOptions" class="lastcall-options"></div><div class="lastcall-actions"><button id="lastCallBank" class="primary-button" type="button" disabled><span>Bank <b class="lastcall-bank-value">0</b></span></button></div><p class="lastcall-risk-note">Pick a fake before banking and today's Last Call scores zero.</p></div><div id="lastCallMessage" class="message lastcall-message"></div>`;
    const leadersPanel=$('#leaders');if(leadersPanel)leadersPanel.before(panel);else $('#today').after(panel);
    $('#lastCallHelp')?.addEventListener('click',()=>{const d=$('#helpDialog'),c=$('#helpContent');if(!d||!c)return;c.innerHTML='<h2>Last Call</h2><p>Twelve answers are on the board: six fit the category and six are traps. Every safe pick raises your pot. Bank whenever you want and keep those points. Hit a trap before banking and you bust for zero. Find all six safe answers and the jackpot banks automatically.</p>';d.showModal()});
    $('#lastCallBank')?.addEventListener('click',bank);
  }

  function openPanel(){
    const today=$('.tab[data-tab="today"]');if(today&&!$('#today')?.classList.contains('active'))today.click();
    requestAnimationFrame(()=>{$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='lastcall'));$$('.panel').forEach(p=>p.classList.toggle('active',p.id==='lastcall'));window.scrollTo({top:0,behavior:'smooth'});render()});
  }
  function ensureDay(){
    data.days??={};day=data.days[date]??={};const key=`${date}:${puzzle.id}`;
    if(day.key!==key){day={key,correctCount:0,picks:[],bustId:'',score:0,done:false,banked:false,jackpot:false};data.days[date]=day;save()}
  }
  async function reveal(){
    if(!day?.done||revealMap.size)return;
    try{const r=await fetch('/api/lastcall/reveal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date,finished:true})});const j=await r.json();if(r.ok)revealMap=new Map((j.options||[]).map(o=>[o.id,!!o.correct]))}catch{}
    renderOptions();
  }
  function renderOptions(){
    const grid=$('#lastCallOptions');if(!grid||!puzzle)return;grid.innerHTML='';const picked=new Set(day?.picks||[]);
    for(const o of puzzle.options){const b=document.createElement('button');b.type='button';b.className='lastcall-option';b.textContent=o.label;const known=revealMap.get(o.id);if(picked.has(o.id))b.classList.add('picked-safe');if(day?.done&&known===true)b.classList.add('reveal-safe');if(day?.done&&known===false)b.classList.add('reveal-fake');if(day?.bustId===o.id)b.classList.add('bust');b.disabled=busy||!!day?.done||picked.has(o.id);b.addEventListener('click',()=>pick(o.id));grid.appendChild(b)}
  }
  function render(){
    if(!puzzle||!day)return;const pot=currentPot(),done=!!day.done;
    $('#lastCallTag').textContent=puzzle.tag||'TODAY';$('#lastCallPrompt').textContent=puzzle.prompt;$('#lastCallDepth').textContent=`${day.correctCount||0}/${puzzle.safeCount||6}`;$('#lastCallScore').textContent=Number(day.score||0).toLocaleString();$('#lastCallPot').textContent=pot.toLocaleString();
    const status=day.jackpot?'JACKPOT':day.bustId?'BUST':day.banked?'BANKED':day.correctCount?'LIVE':'OPEN';$('#lastCallStatus').textContent=status;
    const next=$('#lastCallNext'),nextValue=LADDER[Math.min((day.correctCount||0)+1,LADDER.length-1)]||pot;if(next)next.textContent=done?(day.jackpot?'All six. Maximum pot secured.':day.bustId?'The pot is gone.':'Points secured.'):day.correctCount?`One more safe answer pushes the pot to ${nextValue.toLocaleString()}.`:'First safe pick is worth 100.';
    const bank=$('#lastCallBank');if(bank){bank.disabled=busy||done||(day.correctCount||0)<1;const val=bank.querySelector('.lastcall-bank-value');if(val)val.textContent=pot.toLocaleString()}
    const card=$('#lastCallCardStatus');if(card){card.classList.toggle('done',done);card.innerHTML=statusMarkup(done)}const hs=$('#homeLastCallScore');if(hs)hs.textContent=Number(day.score||0).toLocaleString();
    const msg=$('#lastCallMessage');if(msg){if(day.jackpot){msg.className='message good lastcall-message';msg.textContent=`Six for six. Jackpot — ${day.score.toLocaleString()} points.`}else if(day.bustId){msg.className='message bad lastcall-message';msg.textContent='BUST. You pushed one answer too far and lost the pot.'}else if(day.banked){msg.className='message good lastcall-message';msg.textContent=`Banked ${day.score.toLocaleString()} points.`}else if(day.correctCount){msg.className='message good lastcall-message';msg.textContent=`Safe. ${pot.toLocaleString()} points are sitting on the table.`}else{msg.className='message lastcall-message';msg.textContent='How far do you trust yourself?'}}
    renderOptions();save();window.dispatchEvent(new CustomEvent('clue-lastcall-update',{detail:{date,done,score:day.score||0}}));if(done)void reveal();
  }
  async function pick(optionId){
    if(busy||day.done)return;busy=true;renderOptions();
    try{const r=await fetch('/api/lastcall/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date,optionId})}),j=await r.json();if(!r.ok)throw new Error(j.error||'Last Call could not check that answer.');if(j.correct){day.picks.push(optionId);day.correctCount++;if(day.correctCount>=puzzle.safeCount){day.done=true;day.jackpot=true;day.score=currentPot()}}else{day.done=true;day.bustId=optionId;day.score=0}save()}catch(err){const m=$('#lastCallMessage');if(m){m.className='message bad lastcall-message';m.textContent=err.message}}finally{busy=false;render()}
  }
  function bank(){if(busy||day.done||day.correctCount<1)return;day.done=true;day.banked=true;day.score=currentPot();save();render()}
  async function boot(){
    injectUI();
    try{const r=await fetch('/api/daily',{cache:'no-store'}),j=await r.json();if(!r.ok||!j.lastcall)throw new Error(j.error||'Last Call is not available today.');daily=j;date=j.date;puzzle=j.lastcall;ensureDay();render();if(day.done)void reveal()}catch(err){const m=$('#lastCallMessage');if(m){m.className='message bad lastcall-message';m.textContent=err.message}}
  }
  boot();
})();
