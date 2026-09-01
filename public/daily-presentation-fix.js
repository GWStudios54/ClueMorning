(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const CORE_STORE='clue-morning-state-v2.4',EXP_STORE='clue-morning-daily-expansion-v1',LAST_STORE='clue-morning-last-call-v1';
  const CORE_GAMES=['letter','groups','trail','link','steps','deepcut'];
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
  function setText(el,v){if(el&&el.textContent!==String(v))el.textContent=String(v)}
  function latestDate(){const keys=[...Object.keys(read(CORE_STORE).days||{}),...Object.keys(read(LAST_STORE).days||{})].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();return keys.at(-1)||''}

  function removeLockbox(){
    $('.tab[data-tab="lockbox"]')?.remove();$('[data-dailyx-open="lockbox"]')?.remove();$('#lockbox')?.remove();const score=$('#homeLockboxScore');if(score)score.closest('div')?.remove();
  }
  function situationIcon(){const icon=$('.situation-icon');if(!icon||icon.dataset.polished)return;icon.dataset.polished='1';icon.innerHTML='<svg class="icon daily-game-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/><path d="M14 14h6v6h-6z"/><path d="m12 17 2 0"/></svg>'}
  function tileworksIcons(){
    $$('.tileworks-mark').forEach(icon=>{if(icon.dataset.polished)return;icon.dataset.polished='1';icon.innerHTML='<svg class="icon daily-game-line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M10.5 10.5h3v3h-3z"/></svg>'});
    $$('.tileworks-tab-icon').forEach(icon=>{if(icon.dataset.polished)return;icon.dataset.polished='1';icon.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>'})
  }
  function metrics(){
    const date=latestDate();if(!date)return {date:'',done:0,total:0,situation:0,lastcall:0};const core=read(CORE_STORE).days?.[date]||{},exp=read(EXP_STORE).days?.[date]||{},last=read(LAST_STORE).days?.[date]||{};
    const coreDone=CORE_GAMES.filter(g=>core[g]?.done).length,coreScore=CORE_GAMES.reduce((n,g)=>n+Number(core[g]?.score||0),0),situation=Number(exp.situation?.score||0),lastcall=Number(last.score||0);
    return {date,done:coreDone+(exp.situation?.done?1:0)+(last.done?1:0),total:coreScore+situation+lastcall,situation,lastcall};
  }
  function fixRun(){
    const m=metrics(),count=$('#dailyRunCount');if(!count)return;setText(count,`${m.done}/8`);const fill=$('#dailyRunFill');if(fill){const w=`${Math.min(100,(m.done/8)*100)}%`;if(fill.style.width!==w)fill.style.width=w}
    const first=$('.daily-run-chip[data-run-at="2"]'),mid=$('.daily-run-chip[data-run-at="4"]'),final=$('.daily-run-chip[data-run-at="7"],.daily-run-chip[data-run-at="8"]');if(first)first.classList.toggle('earned',m.done>=2);if(mid)mid.classList.toggle('earned',m.done>=4);if(final){final.dataset.runAt='8';final.classList.toggle('earned',m.done>=8);setText(final.querySelector('small'),'all 8')}
    const name=$('#dailyRunName');if(name)setText(name,m.done>=8?'Super streak complete.':m.done>=4?'Hot streak. Keep going.':m.done>=2?'Streak alive.':'Build your run.');
    setText($('#homeSituationScore'),m.situation.toLocaleString());setText($('#homeLastCallScore'),m.lastcall.toLocaleString());setText($('#homeTotalScore'),m.total.toLocaleString());setText($('#todayTotal'),m.total.toLocaleString());
  }
  function fixCopy(){
    const hero=$('#today .today-hero p');if(hero)setText(hero,'Eight fresh puzzles are waiting.');const about=$('#aboutDailyGames');if(about)setText(about,'Eight quick word, logic, trivia, and tactical games, every morning.');const aboutP=$('#today .about-blurb p');if(aboutP)setText(aboutP,'Clue Morning is a free browser-based daily game collection. Eight different puzzles land every morning, from wordplay and logic to trivia, tactical tile play, and push-your-luck knowledge.');
  }
  function polish(){removeLockbox();situationIcon();tileworksIcons();fixRun();fixCopy()}
  polish();const obs=new MutationObserver(polish);obs.observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('clue-lastcall-update',polish);
})();
