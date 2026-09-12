(()=>{
  const game=document.documentElement.dataset.gamePage||'';
  const supported=new Set(['letter','groups','trail','link','steps','deepcut','lastcall']);
  if(!supported.has(game))return;

  const HOME_SELECTORS=[
    '.typesetter-back',
    '.case-morning-run',
    '.trail-morning-run',
    '.case-file-back',
    '.trail-cartographer-back',
    '[data-case-file-back]',
    '[data-cartographer-back]',
    '#linkExit',
    '#stepsExit',
    '#deepCutExit'
  ];

  function goHome(event){
    if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.()}
    location.assign('/');
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.(HOME_SELECTORS.join(','));
    if(!target)return;
    goHome(event);
  },true);

  function ensureStandaloneBack(){
    if(game!=='lastcall')return;
    const panel=document.getElementById('lastcall');if(!panel||panel.querySelector('.game-page-back'))return;
    const back=document.createElement('button');back.type='button';back.className='game-page-back';back.textContent='← MORNING RUN';
    back.addEventListener('click',goHome);panel.prepend(back);
  }

  function activate(){
    ensureStandaloneBack();
    const panel=document.getElementById(game);if(!panel)return false;
    document.documentElement.dataset.gameSession=game;
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p===panel));
    return true;
  }

  activate();
  addEventListener('pageshow',activate);
})();