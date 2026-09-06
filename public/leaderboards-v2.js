(()=>{
  const PLAYER_KEY='clue-morning-player-id';
  const NAME_KEY='clue-morning-leader-name';
  const CORE_STORE='clue-morning-state-v2.4';
  const LASTCALL_STORE='clue-morning-last-call-v1';
  const CORE_GAMES={letter:'grid',groups:'groups',trail:'trail',link:'link',steps:'steps',deepcut:'deepcut'};
  const BOARDS=[
    {group:'Overall',items:[['today','Today'],['all','All Time']]},
    {group:'Daily games',items:[['grid','Letter Grid'],['groups','Four Groups'],['trail','Letter Trail'],['link','Triple Link'],['steps','Word Steps'],['deepcut','Deep Cut'],['lastcall','Last Call']]},
    {group:'All-time records',items:[['all-seven','All Seven'],['pangram','Pangram'],['tileworks','Tileworks']]}
  ];
  const LABELS=Object.fromEntries(BOARDS.flatMap(g=>g.items));
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  let board='today',date='',loading=false,syncQueued=false;
  const posted=new Set();

  function playerId(){
    let id='';try{id=localStorage.getItem(PLAYER_KEY)||''}catch{}
    if(!id){id=crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;try{localStorage.setItem(PLAYER_KEY,id)}catch{}}
    return id;
  }
  function savedName(){try{return localStorage.getItem(NAME_KEY)||''}catch{return ''}}
  function fallbackName(){const compact=playerId().replace(/[^A-Za-z0-9]/g,'').toUpperCase();return `Player ${compact.slice(-4)||'0000'}`}
  function displayName(){return savedName()||fallbackName()}
  function readStore(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  async function request(path,options={}){const r=await fetch(path,{cache:'no-store',...options});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||`Leaderboard request failed (${r.status}).`);return j}
  function postJson(path,payload){return request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})}

  function openLeaders(){
    $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='leaders'));
    $$('.panel').forEach(p=>p.classList.toggle('active',p.id==='leaders'));
    window.scrollTo({top:0,behavior:'smooth'});
    loadBoard();
  }

  function installNav(){
    const old=$('.tab[data-tab="leaders"]');
    if(old&&!old.dataset.leaderV2){const fresh=old.cloneNode(true);fresh.dataset.leaderV2='1';old.replaceWith(fresh);fresh.addEventListener('click',openLeaders)}
  }

  function installPanel(){
    const panel=$('#leaders');if(!panel||panel.dataset.leaderV2)return;panel.dataset.leaderV2='1';
    const intro=panel.querySelector('.panel-head p');if(intro)intro.textContent='Compare today’s scores game by game, or chase permanent records in All Seven, Pangram, and Tileworks.';
    const note=panel.querySelector('.leader-auto-note span');if(note)note.innerHTML=`Finished daily games post automatically. Until you choose a name, you'll appear as <strong id="leaderPlaceholderName">${esc(fallbackName())}</strong>.`;
    const input=$('#leaderName');if(input)input.value=savedName();

    const oldSave=$('#saveLeaderName');if(oldSave){const fresh=oldSave.cloneNode(true);oldSave.replaceWith(fresh);fresh.addEventListener('click',saveName)}
    const oldRefresh=$('#refreshLeaders');if(oldRefresh){const fresh=oldRefresh.cloneNode(true);oldRefresh.replaceWith(fresh);fresh.addEventListener('click',()=>{syncDailyScores(true);loadBoard()})}

    const sw=panel.querySelector('.leader-switch');if(sw){
      sw.className='leader-switch leader-switch-v2';sw.innerHTML='';
      for(const section of BOARDS){const group=document.createElement('div');group.className='leader-board-group';group.innerHTML=`<span class="leader-board-group-label">${esc(section.group)}</span><div class="leader-board-buttons"></div>`;const buttons=group.querySelector('.leader-board-buttons');for(const [id,label] of section.items){const b=document.createElement('button');b.type='button';b.className='leader-toggle';b.dataset.board=id;b.textContent=label;b.classList.toggle('active',id===board);b.addEventListener('click',()=>selectBoard(id));buttons.appendChild(b)}sw.appendChild(group)}
    }
    const list=$('#leaderboardList');if(list&&!$('#leaderBoardContext'))list.insertAdjacentHTML('beforebegin','<div id="leaderBoardContext" class="leaderboards-v2-note"></div>');
  }

  async function saveName(){
    const input=$('#leaderName'),msg=$('#leaderMessage'),name=(input?.value||'').trim().replace(/\s+/g,' ').slice(0,20);
    if(!name){if(msg){msg.className='message bad';msg.textContent='Choose a leaderboard name first.'}return}
    try{localStorage.setItem(NAME_KEY,name)}catch{}
    try{await postJson('/api/leaderboard/name',{playerId:playerId(),name});if(msg){msg.className='message good';msg.textContent=`Saved as ${name}.`}posted.clear();syncDailyScores(true);loadBoard()}
    catch(err){if(msg){msg.className='message bad';msg.textContent=`Name saved on this device, but the leaderboard update failed: ${err.message}`}}
  }

  function selectBoard(id){board=id;$$('.leader-toggle[data-board]').forEach(b=>b.classList.toggle('active',b.dataset.board===id));loadBoard()}
  function boardContext(){
    if(board==='today')return 'Today ranks every player with at least one posted daily score. The seven daily games are combined automatically.';
    if(board==='all')return 'All-time total points across days with posted daily scores.';
    if(['all-seven','pangram','tileworks'].includes(board))return `${LABELS[board]} · each player’s highest score ever.`;
    return `${LABELS[board]} · today’s leaderboard.`;
  }
  function subFor(row){
    if(board==='today')return `Grid ${Number(row.grid_score||0).toLocaleString()} · Groups ${Number(row.groups_score||0).toLocaleString()} · Trail ${Number(row.trail_score||0).toLocaleString()} · Link ${Number(row.link_score||0).toLocaleString()} · Steps ${Number(row.steps_score||0).toLocaleString()} · Deep Cut ${Number(row.deepcut_score||0).toLocaleString()} · Last Call ${Number(row.lastcall_score||0).toLocaleString()}`;
    if(board==='all')return `${Number(row.days||0).toLocaleString()} scored day${Number(row.days)===1?'':'s'}`;
    if(['all-seven','pangram','tileworks'].includes(board))return 'All-time best';
    return 'Today';
  }
  function renderRows(rows){
    const list=$('#leaderboardList');if(!list)return;list.innerHTML='';
    const context=$('#leaderBoardContext');if(context)context.textContent=boardContext();
    if(!rows.length){list.innerHTML=`<div class="empty-state">No ${esc(LABELS[board]||'leaderboard')} scores yet. First place is open.</div>`;return}
    rows.forEach((row,i)=>{const el=document.createElement('div');el.className='leader-row';el.innerHTML=`<span class="leader-rank">${i+1}</span><div><div class="leader-name">${esc(row.display_name||'Player')}</div><div class="leader-sub">${esc(subFor(row))}</div></div><div class="leader-score">${Number(row.score||0).toLocaleString()}</div>`;list.appendChild(el)})
  }
  async function loadBoard(){
    if(loading)return;loading=true;const list=$('#leaderboardList');if(list)list.innerHTML='<div class="empty-state">Loading leaderboard…</div>';const context=$('#leaderBoardContext');if(context)context.textContent=boardContext();
    try{const suffix=date?`&date=${encodeURIComponent(date)}`:'';const j=await request(`/api/leaderboard?board=${encodeURIComponent(board)}${suffix}`);if(!j.enabled){if(list)list.innerHTML=`<div class="empty-state">${esc(j.reason||'Leaderboard database is not enabled yet.')}</div>`;return}renderRows(j.rows||[])}catch(err){if(list)list.innerHTML=`<div class="empty-state">${esc(err.message)}</div>`}finally{loading=false}
  }

  async function submitDaily(game,score,force=false){
    if(!date)return;score=Number(score)||0;const key=`${date}:${game}:${score}:${displayName()}`;if(!force&&posted.has(key))return;posted.add(key);
    try{await postJson('/api/leaderboard/game-score',{date,game,playerId:playerId(),name:displayName(),score,complete:true});if($('#leaders')?.classList.contains('active')&&(board===game||board==='today'))loadBoard()}
    catch{posted.delete(key)}
  }
  function syncDailyScores(force=false){
    if(syncQueued&&!force)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;if(!date)return;
      const core=readStore(CORE_STORE).days?.[date]||{};for(const [stateKey,game] of Object.entries(CORE_GAMES)){const s=core[stateKey];if(s?.done)submitDaily(game,s.score||0,force)}
      const lc=readStore(LASTCALL_STORE).days?.[date];if(lc?.done)submitDaily('lastcall',lc.score||0,force);
    })
  }

  function bindScoreObservers(){
    const targets=['#todayTotal','#lastCallCardStatus','#lastCallScore'].map($).filter(Boolean);if(targets.length){const o=new MutationObserver(()=>syncDailyScores());targets.forEach(t=>o.observe(t,{subtree:true,childList:true,characterData:true,attributes:true}))}
  }

  async function boot(){
    installNav();installPanel();
    try{const d=await request('/api/daily');date=d.date||''}catch{}
    syncDailyScores();bindScoreObservers();setTimeout(bindScoreObservers,800);setTimeout(()=>syncDailyScores(),1200);
    window.addEventListener('clue-lastcall-update',e=>{if(e.detail?.date===date&&e.detail?.done)submitDaily('lastcall',e.detail.score||0)});
    if($('#leaders')?.classList.contains('active'))loadBoard();
  }
  boot();
})();
