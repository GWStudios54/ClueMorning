(()=>{
  const BEST_KEY='clue-letter-grid-best';
  const CORE_STORE='clue-morning-state-v2.4';
  const $=s=>document.querySelector(s);
  const panel=$('#letter');if(!panel)return;

  function readBest(){
    let best=Number(localStorage.getItem(BEST_KEY)||0);
    try{
      const store=JSON.parse(localStorage.getItem(CORE_STORE)||'{}');
      for(const value of Object.values(store.days||{}))if(value?.letter?.done)best=Math.max(best,Number(value.letter.score)||0);
    }catch{}
    return best;
  }
  function writeBest(score,commit=false){
    let best=readBest();
    if(commit){
      best=Math.max(best,Number(score)||0);
      try{localStorage.setItem(BEST_KEY,String(best))}catch{}
    }
    const el=$('#letterBest'),display=best?best.toLocaleString():'—';
    if(el&&el.textContent!==display)el.textContent=display;
  }
  function fitBoard(){
    const length=Math.max(4,Math.min(10,Number(($('#wordLength')?.textContent||'').match(/\d+/)?.[0])||5));
    const board=$('#guessBoard');if(!board)return;
    const width=length*8.18;
    board.style.width=width+'%';
    board.style.left=(50-width/2)+'%';
    panel.dataset.typesetterCols=String(length);
  }
  function loadArt(){
    if(!panel.classList.contains('typesetter-ready'))panel.classList.add('typesetter-ready');
  }
  function isActive(){
    return panel.classList.contains('active')&&document.documentElement.dataset.gameSession==='letter';
  }
  function sync(){
    const active=isActive();
    document.body.classList.toggle('letter-typesetter-active',active);
    if(active){
      loadArt();fitBoard();
      const score=Number(($('#letterScore')?.textContent||'0').replace(/[^0-9]/g,''))||0;
      writeBest(score,!!$('#guessInput')?.disabled);
    }
  }
  function mount(){
    if(panel.dataset.typesetterMounted)return;
    panel.dataset.typesetterMounted='1';
    panel.classList.add('letter-typesetter');

    const loading=document.createElement('div');loading.className='typesetter-loading';loading.textContent='SETTING THE TYPE…';panel.prepend(loading);
    const back=document.createElement('button');back.type='button';back.className='typesetter-back';back.textContent='← MORNING RUN';
    back.addEventListener('click',()=>document.querySelector('[data-tab="today"]')?.click());panel.appendChild(back);
    const reset=document.createElement('button');reset.type='button';reset.className='typesetter-reset';reset.textContent='↻';reset.setAttribute('aria-label','Clear current proof');
    reset.addEventListener('click',()=>{
      const input=$('#guessInput');if(!input||input.disabled)return;
      input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});
    });panel.appendChild(reset);
    const title=document.createElement('div');title.className='typesetter-title';title.innerHTML='<small>LETTER GRID</small><strong>THE TYPESETTER</strong>';panel.appendChild(title);
    const note=document.createElement('div');note.className='typesetter-instruction';note.textContent='Set the word, then pull the press';panel.appendChild(note);
    const clear=document.createElement('button');clear.type='button';clear.className='typesetter-clear';clear.textContent='CLEAR';
    clear.addEventListener('click',()=>{const input=$('#guessInput');if(!input||input.disabled)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true})});panel.appendChild(clear);

    const press=$('#guessForm button span');if(press)press.textContent='PULL PRESS';
    const stats=[...panel.querySelectorAll(':scope>.stats-row .stat')];
    const labels=['LETTERS','GUESSES','SCORE','BEST'];stats.forEach((stat,i)=>{const label=stat.querySelector('span');if(label&&labels[i])label.textContent=labels[i]});
    writeBest(0);fitBoard();

    new MutationObserver(()=>{
      fitBoard();
      const score=Number(($('#letterScore')?.textContent||'0').replace(/[^0-9]/g,''))||0;
      writeBest(score,!!$('#guessInput')?.disabled);
    }).observe(panel,{subtree:true,childList:true,characterData:true});
    new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-game-session']});
    window.addEventListener('resize',fitBoard,{passive:true});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();