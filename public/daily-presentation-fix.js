(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

  function removeLockbox(){
    $('.tab[data-tab="lockbox"]')?.remove();
    $('[data-dailyx-open="lockbox"]')?.remove();
    $('#lockbox')?.remove();
    const score=$('#homeLockboxScore');if(score)score.closest('div')?.remove();
  }

  function situationIcon(){
    const icon=$('.situation-icon');if(!icon||icon.dataset.polished)return;
    icon.dataset.polished='1';
    icon.innerHTML='<svg class="icon daily-game-line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/><path d="M14 14h6v6h-6z"/><path d="m12 17 2 0"/></svg>';
  }

  function tileworksIcons(){
    $$('.tileworks-mark').forEach(icon=>{
      if(icon.dataset.polished)return;icon.dataset.polished='1';
      icon.innerHTML='<svg class="icon daily-game-line-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M10.5 10.5h3v3h-3z"/></svg>';
    });
    $$('.tileworks-tab-icon').forEach(icon=>{
      if(icon.dataset.polished)return;icon.dataset.polished='1';
      icon.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
    });
  }

  function fixRun(){
    const count=$('#dailyRunCount');if(!count)return;
    const m=String(count.textContent||'0/8').match(/(\d+)/),done=Math.min(7,Number(m?.[1]||0));
    const desired=`${done}/7`;if(count.textContent!==desired)count.textContent=desired;
    const fill=$('#dailyRunFill'),width=`${Math.min(100,(done/7)*100)}%`;if(fill&&fill.style.width!==width)fill.style.width=width;
    const final=$('.daily-run-chip[data-run-at="8"],.daily-run-chip[data-run-at="7"]');if(final){if(final.dataset.runAt!=='7')final.dataset.runAt='7';const small=final.querySelector('small');if(small&&small.textContent!=='all daily games')small.textContent='all daily games';final.classList.toggle('earned',done>=7)}
    const mid=$('.daily-run-chip[data-run-at="4"]');if(mid)mid.classList.toggle('earned',done>=4);
    const first=$('.daily-run-chip[data-run-at="2"]');if(first)first.classList.toggle('earned',done>=2);
    const name=$('#dailyRunName'),label=done>=7?'Super streak complete.':done>=4?'Hot streak. Keep going.':done>=2?'Streak alive.':'Build your run.';if(name&&name.textContent!==label)name.textContent=label;
  }

  function fixCopy(){
    const hero=$('#today .today-hero p');if(hero&&/Eight fresh puzzles/i.test(hero.textContent))hero.textContent='Seven fresh puzzles are waiting.';
    const about=$('#aboutDailyGames');if(about&&/^Eight quick/i.test(about.textContent))about.textContent='Seven quick word, logic, deduction, and trivia games, every morning.';
    const aboutP=$('#today .about-blurb p');if(aboutP&&/Eight different puzzles/i.test(aboutP.textContent))aboutP.textContent='Clue Morning is a free browser-based daily game collection. Seven different puzzles land every morning while we build the eighth slot, from wordplay and logic to trivia and tactical tile play.';
  }

  function polish(){removeLockbox();situationIcon();tileworksIcons();fixRun();fixCopy()}
  polish();
  const obs=new MutationObserver(polish);obs.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
