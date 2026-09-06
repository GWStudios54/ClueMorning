(()=>{
  const CORE_STORE='clue-morning-state-v2.4';
  const LAST_STORE='clue-morning-last-call-v1';
  const START='2026-08-31';
  const CORE=['letter','groups','trail','link','steps','deepcut'];
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let date='',scheduled=false;

  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dateObj=key=>new Date(`${key}T12:00:00`);

  function coreDay(key){return read(CORE_STORE).days?.[key]||{}}
  function lastDay(key){return read(LAST_STORE).days?.[key]||{}}
  function completeDay(key){
    const core=coreDay(key);if(!CORE.every(g=>core[g]?.done))return false;
    return key<START?true:!!lastDay(key).done;
  }
  function streakFor(key){
    if(!key)return 0;let cursor=dateObj(key),streak=0;
    for(let i=0;i<730;i++){
      const k=dateKey(cursor);
      if(completeDay(k)){streak++;cursor.setDate(cursor.getDate()-1);continue}
      if(i===0){cursor.setDate(cursor.getDate()-1);continue}
      break;
    }
    return streak;
  }

  function removeRetiredDailyUi(){
    for(const el of $$('[data-tab="situation"],[data-tab="lockbox"],[data-dailyx-open="situation"],[data-dailyx-open="lockbox"],#situation,#lockbox'))el.remove();
    for(const id of ['homeSituationScore','homeLockboxScore']){const el=$(`#${id}`);if(el)el.parentElement?.remove()}
  }

  function ensureRunCard(){
    if($('#dailyRunCard')||!$('#today'))return;
    const hero=$('#today .today-hero');if(!hero)return;
    hero.insertAdjacentHTML('afterend',`<section id="dailyRunCard" class="daily-run-card"><div class="daily-run-head"><div><span>TODAY'S RUN</span><strong id="dailyRunName">Build your run.</strong></div><b id="dailyRunCount" class="daily-run-count">0/7</b></div><div class="daily-run-track"><i id="dailyRunFill"></i></div><div class="daily-run-milestones"><div class="daily-run-chip" data-run-at="2"><b>STREAK</b><small>2 games</small></div><div class="daily-run-chip" data-run-at="4"><b>HOT STREAK</b><small>4 games</small></div><div class="daily-run-chip super" data-run-at="7"><b>SUPER STREAK</b><small>all 7</small></div></div></section>`);
  }

  function polishTileworks(){
    let style=$('#tileworksModeLabelStyle');if(!style){style=document.createElement('style');style.id='tileworksModeLabelStyle';style.textContent='.presentation-pass-v1 .more-play-grid .tileworks-home-card::before{content:"TWO MODES"}';document.head.appendChild(style)}
    const card=$('[data-tileworks-home]');if(card){const label=card.querySelector('.game-label'),copy=card.querySelector('.game-copy p');if(label)label.textContent='CROSSWORD TILE GAME';if(copy)copy.textContent='Play a full match, or take on the daily three-move Situation.'}
    const heading=$('#morePlaySection .more-play-heading p');if(heading)heading.textContent='Full Match and Situation live together in Tileworks.';
  }

  function render(){
    if(!date)return;removeRetiredDailyUi();ensureRunCard();polishTileworks();
    const core=coreDay(date),last=lastDay(date),coreScore=CORE.reduce((n,g)=>n+Number(core[g]?.score||0),0),lastScore=Number(last.score||0),total=coreScore+lastScore;
    const done=CORE.filter(g=>core[g]?.done).length+(date<START?0:(last.done?1:0)),count=date<START?6:7;
    const set=(sel,value)=>{const el=$(sel);if(el&&el.textContent!==String(value))el.textContent=String(value)};
    set('#todayTotal',total.toLocaleString());set('#homeTotalScore',total.toLocaleString());set('#dailyRunCount',`${done}/${count}`);
    const fill=$('#dailyRunFill');if(fill)fill.style.width=`${Math.min(100,done/count*100)}%`;
    $$('[data-run-at]').forEach(el=>el.classList.toggle('earned',done>=Number(el.dataset.runAt)));
    set('#dailyRunName',done>=count?'Super Streak. Morning cleared.':done>=4?'Hot Streak. Keep rolling.':done>=2?'Streak started.':'Build your run.');
    set('#streakCount',streakFor(date));
    const hero=$('#today .today-hero p');if(hero)hero.textContent='Seven games. One morning run.';
    const about=$('#aboutDailyGames');if(about)about.textContent='Seven quick word, logic, trivia, and push-your-luck games, every morning.';
    const aboutP=$('#today .about-blurb p');if(aboutP)aboutP.textContent='Clue Morning is a free browser-based daily game collection. Seven different games land every morning, with Tileworks and other endless modes waiting when the daily set is done.';
  }

  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}
  async function boot(){
    try{const r=await fetch('/api/daily',{cache:'no-store'}),j=await r.json();if(r.ok&&j.date)date=j.date}catch{}
    if(!date){const keys=[...Object.keys(read(CORE_STORE).days||{}),...Object.keys(read(LAST_STORE).days||{})].sort();date=keys.at(-1)||dateKey(new Date())}
    render();new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('clue-lastcall-update',queue);window.addEventListener('storage',queue);
  }
  boot();
})();
