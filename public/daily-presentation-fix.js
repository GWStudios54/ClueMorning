(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const CORE_STORE='clue-morning-state-v2.4',LAST_STORE='clue-morning-last-call-v1';
  const CORE_GAMES=['letter','groups','trail','link','steps','deepcut'];
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
  function setText(el,v){if(el&&el.textContent!==String(v))el.textContent=String(v)}
  function latestDate(){const keys=[...Object.keys(read(CORE_STORE).days||{}),...Object.keys(read(LAST_STORE).days||{})].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();return keys.at(-1)||''}

  function removeRetiredDailyUi(){
    for(const el of $$('[data-tab="situation"],[data-tab="lockbox"],[data-dailyx-open="situation"],[data-dailyx-open="lockbox"],#situation,#lockbox'))el.remove();
    for(const id of ['homeSituationScore','homeLockboxScore']){const score=$(`#${id}`);if(score)score.closest('div')?.remove()}
  }
  function tileworksIcons(){
    $$('.tileworks-mark').forEach(icon=>{if(icon.dataset.polished)return;icon.dataset.polished='1';icon.innerHTML='<svg class="icon daily-game-line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M10.5 10.5h3v3h-3z"/></svg>'});
    $$('.tileworks-tab-icon').forEach(icon=>{if(icon.dataset.polished)return;icon.dataset.polished='1';icon.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>'})
  }
  function metrics(){
    const date=latestDate();if(!date)return {date:'',done:0,total:0,lastcall:0};
    const core=read(CORE_STORE).days?.[date]||{},last=read(LAST_STORE).days?.[date]||{};
    const coreDone=CORE_GAMES.filter(g=>core[g]?.done).length,coreScore=CORE_GAMES.reduce((n,g)=>n+Number(core[g]?.score||0),0),lastcall=Number(last.score||0);
    return {date,done:coreDone+(last.done?1:0),total:coreScore+lastcall,lastcall};
  }
  function fixRun(){
    const m=metrics(),count=$('#dailyRunCount');if(!count)return;
    setText(count,`${m.done}/7`);const fill=$('#dailyRunFill');if(fill){const w=`${Math.min(100,(m.done/7)*100)}%`;if(fill.style.width!==w)fill.style.width=w}
    const first=$('.daily-run-chip[data-run-at="2"]'),mid=$('.daily-run-chip[data-run-at="4"]'),final=$('.daily-run-chip[data-run-at="7"],.daily-run-chip[data-run-at="8"]');
    if(first)first.classList.toggle('earned',m.done>=2);if(mid)mid.classList.toggle('earned',m.done>=4);if(final){final.dataset.runAt='7';final.classList.toggle('earned',m.done>=7);setText(final.querySelector('small'),'all 7')}
    const name=$('#dailyRunName');if(name)setText(name,m.done>=7?'Super Streak. Morning cleared.':m.done>=4?'Hot Streak. Keep rolling.':m.done>=2?'Streak started.':'Build your run.');
    setText($('#homeLastCallScore'),m.lastcall.toLocaleString());setText($('#homeTotalScore'),m.total.toLocaleString());setText($('#todayTotal'),m.total.toLocaleString());
  }
  function fixCopy(){
    const hero=$('#today .today-hero p');if(hero)setText(hero,'Seven games. One morning run.');
    const about=$('#aboutDailyGames');if(about)setText(about,'Seven quick word, logic, trivia, and push-your-luck games, every morning.');
    const aboutP=$('#today .about-blurb p');if(aboutP)setText(aboutP,'Clue Morning is a free browser-based daily game collection. Seven different games land every morning, from wordplay and logic to trivia and push-your-luck knowledge. Tileworks and other endless modes stay separate from the daily set.');
  }
  function polish(){removeRetiredDailyUi();tileworksIcons();fixRun();fixCopy()}
  polish();const obs=new MutationObserver(polish);obs.observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('clue-lastcall-update',polish);window.addEventListener('storage',polish);
})();
