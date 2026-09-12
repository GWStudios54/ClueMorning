(()=>{
  const ART=Array.from({length:4},(_,i)=>'/letter-grid-test/live-'+String(i).padStart(2,'0')+'.b64');
  const BEST_KEY='clue-letter-grid-best';
  const CORE_STORE='clue-morning-state-v2.4';
  const $=s=>document.querySelector(s);
  const panel=$('#letter');if(!panel)return;
  let artPromise=null;

  function readBest(){
    let best=Number(localStorage.getItem(BEST_KEY)||0);
    try{
      const store=JSON.parse(localStorage.getItem(CORE_STORE)||'{}');
      for(const value of Object.values(store.days||{}))best=Math.max(best,Number(value?.letter?.score)||0);
    }catch{}
    return best;
  }
  function writeBest(score){
    const best=Math.max(readBest(),Number(score)||0);
    try{localStorage.setItem(BEST_KEY,String(best))}catch{}
    const el=$('#letterBest');if(el)el.textContent=best?best.toLocaleString():'—';
  }
  function fitBoard(){
    const length=Math.max(4,Math.min(10,Number(($('#wordLength')?.textContent||'').match(/\d+/)?.[0])||5));
    const board=$('#guessBoard');if(!board)return;
    const width=Math.min(81.8,length*8.18);
    board.style.width=width+'%';
    board.style.left=(50-width/2)+'%';
    panel.dataset.typesetterCols=String(length);
  }
  function loadArt(){
    if(!artPromise)artPromise=Promise.all(ART.map(async url=>{
      const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('Typesetter art '+r.status);return(await r.text()).trim();
    })).then(parts=>'url(data:image/webp;base64,'+parts.join('')+')');
    artPromise.then(value=>{panel.style.backgroundImage=value;panel.classList.add('typesetter-ready')})
      .catch(err=>{console.error(err);panel.classList.add('typesetter-ready')});
  }
  function isActive(){
    return panel.classList.contains('active')&&document.documentElement.dataset.gameSession==='letter';
  }
  function sync(){
    const active=isActive();
    document.body.classList.toggle('letter-typesetter-active',active);
    if(active){loadArt();fitBoard();writeBest(Number(($('#letterScore')?.textContent||'0').replace(/[^0-9]/g,''))||0)}
  }
  function mount(){
    if(panel.dataset.typesetterMounted)return;
    panel.dataset.typesetterMounted='1';
    panel.classList.add('letter-typesetter');

    const loading=document.createElement('div');loading.className='typesetter-loading';loading.textContent='SETTING THE TYPE…';panel.prepend(loading);
    const back=document.createElement('button');back.type='button';back.className='typesetter-back';back.textContent='← MORNING RUN';
    back.addEventListener('click',()=>document.querySelector('[data-tab="today"]')?.click());panel.appendChild(back);
    const help=document.createElement('button');help.type='button';help.className='typesetter-help';help.textContent='?';help.setAttribute('aria-label','Letter Grid help');
    help.addEventListener('click',()=>panel.querySelector('[data-help="letter"]')?.click());panel.appendChild(help);
    const title=document.createElement('div');title.className='typesetter-title';title.innerHTML='<small>LETTER GRID</small><strong>THE TYPESETTER</strong>';panel.appendChild(title);
    const note=document.createElement('div');note.className='typesetter-instruction';note.textContent='Set the word, then pull the press';panel.appendChild(note);
    const clear=document.createElement('button');clear.type='button';clear.className='typesetter-clear';clear.textContent='CLEAR';
    clear.addEventListener('click',()=>{const input=$('#guessInput');if(!input||input.disabled)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true})});panel.appendChild(clear);

    const press=$('#guessForm button span');if(press)press.textContent='PULL PRESS';
    const keyboard=$('#keyboard');
    if(keyboard){
      const annotateKeys=()=>keyboard.querySelectorAll('.key').forEach(key=>{key.setAttribute('role','button');key.tabIndex=0;key.setAttribute('aria-label','Type '+key.textContent.trim())});
      const typeKey=key=>{
        const input=$('#guessInput');if(!input||input.disabled)return;
        const max=Number($('#wordLength')?.textContent)||input.maxLength||10,ch=(key?.textContent||'').trim().toUpperCase();
        if(!/^[A-Z]$/.test(ch)||input.value.length>=max)return;
        input.value=(input.value+ch).slice(0,max);input.dispatchEvent(new Event('input',{bubbles:true}));
      };
      keyboard.addEventListener('click',event=>{const key=event.target.closest('.key');if(key)typeKey(key)});
      keyboard.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const key=event.target.closest('.key');if(!key)return;event.preventDefault();typeKey(key)});
      new MutationObserver(annotateKeys).observe(keyboard,{childList:true});annotateKeys();
    }
    const stats=[...panel.querySelectorAll(':scope>.stats-row .stat')];
    const labels=['LETTERS','GUESSES','SCORE','BEST'];stats.forEach((stat,i)=>{const label=stat.querySelector('span');if(label&&labels[i])label.textContent=labels[i]});
    writeBest(0);fitBoard();

    new MutationObserver(()=>{fitBoard();writeBest(Number(($('#letterScore')?.textContent||'0').replace(/[^0-9]/g,''))||0)})
      .observe(panel,{subtree:true,childList:true,characterData:true});
    new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-game-session']});
    window.addEventListener('resize',fitBoard,{passive:true});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();