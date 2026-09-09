(()=>{
  const $=s=>document.querySelector(s);
  const CORE_STORE='clue-morning-state-v2.4';
  const PLAYER_KEY='clue-morning-player-id';
  let ownerAdmin=false;
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
  async function requestJson(path,options={}){
    const r=await fetch(path,{cache:'no-store',credentials:'same-origin',...options});let j={};try{j=await r.json()}catch{}
    if(!r.ok)throw new Error(j.error||`Request failed (${r.status}).`);return j;
  }
  function postJson(path,payload){return requestJson(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})}
  function ownerAdminRequested(){try{return new URL(location.href).searchParams.get('admin')==='owner'}catch{return false}}
  function cleanOwnerAdminParam(){
    try{const url=new URL(location.href);if(!url.searchParams.has('admin'))return;url.searchParams.delete('admin');history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`)}catch{}
  }
  function playerId(){
    let id='';try{id=localStorage.getItem(PLAYER_KEY)||''}catch{}
    if(!/^[A-Za-z0-9-]{8,64}$/.test(id)){
      id=crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try{localStorage.setItem(PLAYER_KEY,id)}catch{}
    }
    return id;
  }
  function readCoreStore(){try{return JSON.parse(localStorage.getItem(CORE_STORE)||'{}')||{}}catch{return {}}}
  async function resetTodayDeepCut(button,status){
    if(!ownerAdmin)return;
    if(!confirm('Reset only your Deep Cut for today? Your Deep Cut answers and score will be cleared; every other game stays untouched.'))return;
    if(button)button.disabled=true;if(status){status.className='owner-admin-status';status.textContent='Resetting your Deep Cut…'}
    try{
      const daily=await requestJson('/api/daily');
      await postJson('/api/admin/deepcut/reset',{playerId:playerId()});
      const store=readCoreStore();store.days??={};store.days[daily.date]??={};delete store.days[daily.date].deepcut;delete store.days[daily.date].leaderboardPost;
      localStorage.setItem(CORE_STORE,JSON.stringify(store));
      if(status)status.textContent='Reset complete. Reloading Deep Cut…';
      const url=new URL(location.href);url.searchParams.delete('admin');url.hash='play=deepcut';setTimeout(()=>location.replace(url.toString()),180);
    }catch(err){if(status){status.className='owner-admin-status bad';status.textContent=err.message}if(button)button.disabled=false}
  }
  function ownerAdminControl(){
    const panel=$('#deepcut');if(!panel)return;let bar=panel.querySelector('[data-owner-admin-control]');
    if(!ownerAdmin){bar?.remove();return}
    if(bar)return;
    bar=document.createElement('div');bar.className='owner-admin-bar';bar.dataset.ownerAdminControl='1';
    bar.innerHTML='<div class="owner-admin-copy"><span>OWNER ADMIN</span><strong>Deep Cut test controls</strong><small>This reset targets only this browser/player and today’s Deep Cut score.</small></div><div class="owner-admin-actions"><button class="secondary-button" type="button">Reset today’s Deep Cut</button><p class="owner-admin-status" role="status" aria-live="polite"></p></div>';
    const button=bar.querySelector('button'),status=bar.querySelector('.owner-admin-status');button.addEventListener('click',()=>void resetTodayDeepCut(button,status));
    const head=panel.querySelector('.panel-head');if(head)head.insertAdjacentElement('afterend',bar);else panel.prepend(bar);
  }
  function ensureOwnerAdminDialog(){
    if(!ownerAdminRequested()||ownerAdmin||$('#ownerAdminDialog'))return;
    const d=document.createElement('dialog');d.id='ownerAdminDialog';d.className='owner-admin-dialog';
    d.innerHTML='<form id="ownerAdminForm"><span class="game-label">OWNER ONLY</span><h2>Activate owner admin</h2><p>Enter the private owner-admin code once. This browser will receive a secure admin cookie; Founder access by itself does not grant reset privileges.</p><label class="owner-admin-label">Owner-admin code<input id="ownerAdminCode" class="text-input" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label><p id="ownerAdminMessage" class="owner-admin-message" role="status" aria-live="polite"></p><div class="owner-admin-dialog-actions"><button class="primary-button" type="submit">Activate owner admin</button><button class="secondary-button" type="button" data-owner-admin-cancel>Cancel</button></div></form>';
    document.body.appendChild(d);
    d.querySelector('[data-owner-admin-cancel]').addEventListener('click',()=>{cleanOwnerAdminParam();d.close();d.remove()});
    d.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();const input=d.querySelector('#ownerAdminCode'),message=d.querySelector('#ownerAdminMessage'),button=d.querySelector('button[type="submit"]'),code=input.value.trim().toUpperCase().replace(/\s+/g,'');if(!code)return;
      button.disabled=true;message.className='owner-admin-message';message.textContent='Checking…';
      try{const r=await postJson('/api/admin/claim',{code});if(!r.active)throw new Error('Owner-admin activation failed.');ownerAdmin=true;input.value='';message.textContent='Owner admin active.';cleanOwnerAdminParam();rewrite();setTimeout(()=>{d.close();d.remove()},180)}
      catch(err){message.className='owner-admin-message bad';message.textContent=err.message;button.disabled=false}
    });
    d.showModal();setTimeout(()=>d.querySelector('#ownerAdminCode')?.focus(),0);
  }
  async function refreshOwnerAdmin(){
    try{const r=await requestJson('/api/admin/status');ownerAdmin=!!r.active}catch{ownerAdmin=false}
    if(ownerAdmin&&ownerAdminRequested())cleanOwnerAdminParam();rewrite();ensureOwnerAdminDialog();
  }
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
    if(!grid||document.querySelector('[data-tileworks-home]'))return;
    const b=document.createElement('button');b.type='button';b.className='game-card tileworks-home-card';b.dataset.tileworksHome='1';
    b.innerHTML='<div class="game-icon tileworks-mark" aria-hidden="true"><span>T</span><small>4</small></div><div class="game-copy"><span class="game-label">CROSSWORD TILE GAME</span><h3>Tileworks</h3><p>Play a full match, or take on the daily three-move Situation.</p></div><span class="game-status">PLAY</span>';
    b.addEventListener('click',goTileworks);grid.appendChild(b);
  };
  const tileworksCard=()=>{
    const grid=$('#unlimitedLibraryGrid .game-cards');
    if(!grid||grid.querySelector('[data-founders-tileworks]'))return;
    const b=document.createElement('button');b.type='button';b.className='game-card founders-tileworks-card';b.dataset.foundersTileworks='1';
    b.innerHTML='<div class="game-icon tileworks-mark" aria-hidden="true"><span>T</span><small>4</small></div><div class="game-copy"><span class="game-label">FOUNDERS WORD BOARD</span><h3>Tileworks</h3><p>Full Match, Situation, and every alternate-board pack.</p></div><span class="game-status">PLAY</span>';
    b.addEventListener('click',goTileworks);grid.appendChild(b);
  };
  const archiveTileworks=()=>{
    const archive=$('#archive');if(!archive||archive.querySelector('[data-tileworks-pack]'))return;
    const card=document.createElement('div');card.className='pack-preview tileworks-pack-preview';card.dataset.tileworksPack='1';
    card.innerHTML='<span class="game-label">WORD BOARD GAME</span><h3>Tileworks</h3><p>Play a full crossword-tile match against Aarin, Scarlet, Mia, or Annie, or jump into Situation for a fixed-rack three-move challenge. The standard 15×15 board and Situation are core modes; alternate board sizes are content-pack extras and are included with Founders.</p><button class="secondary-button inverted" type="button"><span class="tileworks-button-mark">T</span><span>Play Tileworks</span></button>';
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
    addStyle();tileworksNav();homeTileworks();ownerAdminControl();
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
  rewrite();ensureOwnerAdminDialog();void refreshOwnerAdmin();
  const obs=new MutationObserver(()=>rewrite());
  const targets=[$('.unlimited-access-card'),$('#unlimited'),$('#deepcut')].filter(Boolean);targets.forEach(t=>obs.observe(t,{subtree:true,childList:true,characterData:true}));
})();
