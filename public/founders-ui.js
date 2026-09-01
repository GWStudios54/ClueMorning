(()=>{
  const $=s=>document.querySelector(s);
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value};
  const addStyle=()=>{
    if(document.querySelector('link[href="/founders-ui.css"]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='/founders-ui.css';document.head.appendChild(l);
  };
  const replaceText=(root,from,to)=>{
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const n of nodes)if(n.nodeValue.includes(from))n.nodeValue=n.nodeValue.split(from).join(to);
  };
  const goTileworks=()=>{location.href='/games/tileworks/'};
  const tileworksNav=()=>{
    const nav=$('.tabs');
    if(!nav||nav.querySelector('[data-tileworks-tab]'))return;
    const b=document.createElement('button');b.type='button';b.className='tab tileworks-nav-tab';b.dataset.tileworksTab='1';b.setAttribute('aria-label','Open Tileworks');
    b.innerHTML='<span class="tileworks-tab-icon" aria-hidden="true">T<small>4</small></span><span>Tileworks</span>';
    b.addEventListener('click',goTileworks);
    const founderTab=$('#unlimitedTab'),leaders=nav.querySelector('[data-tab="leaders"]');
    nav.insertBefore(b,founderTab||leaders||null);
  };
  const homeTileworks=()=>{
    const grid=$('#today .game-cards');
    if(!grid||grid.querySelector('[data-tileworks-home]'))return;
    const b=document.createElement('button');b.type='button';b.className='game-card tileworks-home-card';b.dataset.tileworksHome='1';
    b.innerHTML='<div class="game-icon tileworks-mark" aria-hidden="true"><span>T</span><small>4</small></div><div class="game-copy"><span class="game-label">FULL WORD BOARD</span><h3>Tileworks</h3><p>Play a full 15×15 match against Aarin, Scarlet, Mia, or Annie.</p></div><span class="game-status">PLAY</span>';
    b.addEventListener('click',goTileworks);grid.appendChild(b);
  };
  const tileworksCard=()=>{
    const grid=$('#unlimitedLibraryGrid .game-cards');
    if(!grid||grid.querySelector('[data-founders-tileworks]'))return;
    const b=document.createElement('button');b.type='button';b.className='game-card founders-tileworks-card';b.dataset.foundersTileworks='1';
    b.innerHTML='<div class="game-icon tileworks-mark" aria-hidden="true"><span>T</span><small>4</small></div><div class="game-copy"><span class="game-label">FOUNDERS WORD BOARD</span><h3>Tileworks</h3><p>Classic 15×15 plus every alternate-board pack.</p></div><span class="game-status">PLAY</span>';
    b.addEventListener('click',goTileworks);grid.appendChild(b);
  };
  const archiveTileworks=()=>{
    const archive=$('#archive');if(!archive||archive.querySelector('[data-tileworks-pack]'))return;
    const card=document.createElement('div');card.className='pack-preview tileworks-pack-preview';card.dataset.tileworksPack='1';
    card.innerHTML='<span class="game-label">WORD BOARD GAME</span><h3>Tileworks</h3><p>Play a full crossword-tile match against Aarin, Scarlet, Mia, or Annie. The standard 15×15 board is the core game; alternate board sizes are content-pack extras and are included with Founders.</p><button class="secondary-button inverted" type="button"><span class="tileworks-button-mark">T</span><span>Play Tileworks</span></button>';
    card.querySelector('button').addEventListener('click',goTileworks);
    const founderCard=archive.querySelector('.unlimited-access-card');archive.insertBefore(card,founderCard||null);
  };
  const unlimitedPreview=()=>{
    const archive=$('#archive');if(!archive||archive.querySelector('[data-future-unlimited]'))return;
    const card=document.createElement('div');card.className='pack-preview premium-tier-preview';card.dataset.futureUnlimited='1';
    card.innerHTML='<span class="game-label">PREMIUM MEMBERSHIP — COMING LATER</span><h3>Clue Morning Unlimited</h3><p>The public premium tier will include every content pack while active, plus its own rotating rewards and premium extras. Founders keep permanent all-pack access and their legacy rewards.</p><button class="secondary-button inverted" type="button" disabled><span>Unlimited is coming later</span></button>';
    archive.appendChild(card);
  };
  const rewrite=()=>{
    addStyle();tileworksNav();homeTileworks();
    setText($('#unlimitedTab span'),'Founders');
    const access=$('.unlimited-access-card');
    if(access){
      setText(access.querySelector('.game-label'),'FOUNDERS ACCESS');
      setText(access.querySelector('h3'),'Clue Morning Founders');
      setText(access.querySelector('p'),'Permanent legacy access for the people who were here early. Founders get the reserve library, every content pack, alternate game modes and boards, and permanent Founder rewards.');
      setText(access.querySelector('#unlimitedForm button span'),'Unlock Founders');
      setText(access.querySelector('#openUnlimitedButton span'),'Open Founders Library');
      replaceText(access,'UNLIMITED ACTIVE','FOUNDERS ACTIVE');replaceText(access,'Unlimited is ready','Founders is ready');
    }
    const panel=$('#unlimited');
    if(panel){
      setText(panel.querySelector('.date-kicker'),'CLUE MORNING FOUNDERS');
      setText(panel.querySelector('.today-hero h2'),'The whole library.');
      setText(panel.querySelector('.today-hero p'),'Founders get permanent access to the reserve library and every content pack we release. Pick a game and keep going without touching tomorrow’s set.');
      setText(panel.querySelector('#unlimitedLibraryGate h3'),'Founders is locked on this browser.');
      setText(panel.querySelector('#unlimitedLibraryGate p'),'Activate your Founder code once, then the complete library stays ready here.');
      setText(panel.querySelector('#unlimitedGoActivate span'),'Go to Founder activation');
      panel.querySelectorAll('.game-label').forEach(el=>{const next=el.textContent.replace(/^UNLIMITED\b/,'FOUNDERS');if(next!==el.textContent)el.textContent=next});
      setText(panel.querySelector('.ritual-card strong'),'Founders play stays separate from the daily game.');
      replaceText(panel,'Unlimited','Founders');
      tileworksCard();
    }
    archiveTileworks();unlimitedPreview();
  };
  rewrite();
  const obs=new MutationObserver(()=>rewrite());
  const targets=[$('.unlimited-access-card'),$('#unlimited')].filter(Boolean);targets.forEach(t=>obs.observe(t,{subtree:true,childList:true,characterData:true}));
})();
