(()=>{
  const game=document.documentElement.dataset.gamePage||'';
  const supported=new Set(['letter','groups','trail','link','steps','deepcut','lastcall']);
  if(!supported.has(game))return;

  const HOME_SELECTORS=[
    '.typesetter-back',
    '.case-file-back',
    '.trail-cartographer-back',
    '[data-case-file-back]',
    '[data-cartographer-back]',
    '#linkExit',
    '#stepsExit',
    '#deepCutExit',
    '#lastcall .panel-head'
  ];

  function goHome(event){
    if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.()}
    location.assign('/');
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.(HOME_SELECTORS.join(','));
    if(!target)return;
    if(target.matches('#lastcall .panel-head')){
      const r=target.getBoundingClientRect();
      if(event.clientY>r.top+46)return;
    }
    goHome(event);
  },true);

  function activate(){
    document.documentElement.dataset.gameSession=game;
    const tab=document.querySelector('.tab[data-tab="'+game+'"]');
    const panel=document.getElementById(game);
    if(tab&&panel){
      tab.click();
      document.documentElement.dataset.gameSession=game;
      return true;
    }
    if(panel){
      document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p===panel));
      document.documentElement.dataset.gameSession=game;
      return true;
    }
    return false;
  }

  let tries=0;
  function ensureActive(){
    if(activate()||tries++>80)return;
    setTimeout(ensureActive,25);
  }
  ensureActive();
  addEventListener('pageshow',()=>{tries=0;ensureActive()});
})();