// Competitive completion feedback for Clue Morning.
// Event-driven only: no broad DOM observers or polling loop.
(()=>{
  const CORE_STORE='clue-morning-state-v2.4';
  const LAST_STORE='clue-morning-last-call-v1';
  const PLAYER_KEY='clue-morning-player-id';
  const TZ='America/Los_Angeles';
  const GAMES={
    letter:{name:'Letter Grid',board:'grid',state:'letter'},
    groups:{name:'Four Groups',board:'groups',state:'groups'},
    trail:{name:'Letter Trail',board:'trail',state:'trail'},
    link:{name:'Triple Link',board:'link',state:'link'},
    steps:{name:'Word Steps',board:'steps',state:'steps'},
    deepcut:{name:'Deep Cut',board:'deepcut',state:'deepcut'},
    lastcall:{name:'Last Call',board:'lastcall',state:'lastcall'}
  };
  const SCORE_KICKERS=Object.fromEntries(Object.entries(GAMES).filter(([id])=>id!=='lastcall').map(([id,g])=>[`${g.name.toUpperCase()} COMPLETE`,id]));
  const $=s=>document.querySelector(s);
  let refreshTimer=0,requestToken=0;

  function installStyle(){
    if($('#competitionStyles'))return;
    const style=document.createElement('style');style.id='competitionStyles';style.textContent=`
      .competition-card{margin:16px 0 2px;padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:var(--paper2);text-align:left}
      .competition-card[hidden]{display:none}
      .competition-kicker{display:block;font-size:.68rem;font-weight:950;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
      .competition-card strong{display:block;font:700 1.04rem/1.25 Georgia,"Times New Roman",serif;color:var(--dark)}
      .competition-card small{display:block;color:var(--muted);font-size:.78rem;line-height:1.45;margin-top:4px}
      .competition-card button{width:100%;margin-top:11px;min-height:44px;justify-content:center}
      .competition-rank{font-weight:950;color:var(--dark)}
      .competition-beat{font-weight:900}
      .morning-competition{margin:14px 0 4px}
    `;document.head.appendChild(style);
  }
  function pacificDateKey(d=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  function playerId(){
    let id='';try{id=localStorage.getItem(PLAYER_KEY)||''}catch{}
    return /^[A-Za-z0-9-]{8,64}$/.test(id)?id:'';
  }
  function scoreFor(game,date){
    if(game==='lastcall')return Number(read(LAST_STORE).days?.[date]?.score||0);
    return Number(read(CORE_STORE).days?.[date]?.[GAMES[game].state]?.score||0);
  }
  function totalFor(date){
    const core=read(CORE_STORE).days?.[date]||{},last=read(LAST_STORE).days?.[date]||{};
    return Object.entries(GAMES).reduce((n,[id,g])=>n+(id==='lastcall'?Number(last.score||0):Number(core[g.state]?.score||0)),0);
  }
  function gameFromScoreDialog(){
    const dialog=$('#dailyScoreDialog');if(!dialog?.open)return '';
    const kicker=$('#dailyScoreKicker')?.textContent?.trim().toUpperCase()||'';return SCORE_KICKERS[kicker]||'';
  }
  function ensureScoreCard(){
    const actions=$('#dailyScoreDialog .daily-score-actions');if(!actions)return null;
    let card=$('#dailyCompetition');if(card)return card;
    card=document.createElement('section');card.id='dailyCompetition';card.className='competition-card';card.hidden=true;
    card.innerHTML='<span class="competition-kicker">TODAY\'S FIELD</span><strong data-competition-headline>Checking your place…</strong><small data-competition-detail></small><button class="secondary-button" type="button" data-competition-leader>View leaderboard</button>';
    actions.parentElement.insertBefore(card,actions);return card;
  }
  function ensureReportCard(){
    const actions=$('#morningReportDialog .morning-report-actions');if(!actions)return null;
    let card=$('#morningCompetition');if(card)return card;
    card=document.createElement('section');card.id='morningCompetition';card.className='competition-card morning-competition';card.hidden=true;
    card.innerHTML='<span class="competition-kicker">TODAY\'S FIELD</span><strong data-competition-headline>Checking your place…</strong><small data-competition-detail></small><button class="secondary-button" type="button" data-competition-leader>View overall leaderboard</button>';
    actions.parentElement.insertBefore(card,actions);return card;
  }
  function openLeaderboard(board){
    $('#dailyScoreDialog')?.close();$('#morningReportDialog')?.close();
    $('.tab[data-tab="leaders"]')?.click();
    const select=()=>{const button=$(`.leader-toggle[data-board="${board}"]`);if(button){button.click();return true}return false};
    requestAnimationFrame(()=>{if(!select())setTimeout(select,120)});
  }
  function renderComparison(card,data,game,board){
    if(!card)return;
    card.hidden=false;
    const headline=card.querySelector('[data-competition-headline]'),detail=card.querySelector('[data-competition-detail]'),button=card.querySelector('[data-competition-leader]');
    if(data.opponents===0){
      headline.textContent='You set the pace.';
      detail.textContent='You are the first score on this leaderboard today.';
    }else{
      const tied=data.tied>1?` · tied with ${data.tied-1}`:'';
      headline.innerHTML=`<span class="competition-rank">#${data.rank} of ${data.total}</span> today`;
      detail.innerHTML=`You beat <span class="competition-beat">${data.beatPercent}%</span> of today’s other players${tied}.`;
    }
    button.textContent=board==='today'?'View overall leaderboard':`View ${GAMES[game]?.name||'game'} leaderboard`;
    button.onclick=()=>openLeaderboard(board);
  }
  async function compare(board,score,date){
    const id=playerId();if(!id)return null;
    const q=new URLSearchParams({board,date,playerId:id,score:String(Math.max(0,Math.round(score)))});
    const r=await fetch(`/api/leaderboard/compare?${q}`,{cache:'no-store'});if(!r.ok)return null;const j=await r.json();return j.enabled?j:null;
  }
  async function refreshNow(){
    const token=++requestToken,date=pacificDateKey(),game=gameFromScoreDialog();
    if(game){
      const card=ensureScoreCard();
      if(card){
        card.hidden=false;card.querySelector('[data-competition-headline]').textContent='Checking your place…';card.querySelector('[data-competition-detail]').textContent='';
        try{const data=await compare(GAMES[game].board,scoreFor(game,date),date);if(token===requestToken&&data)renderComparison(card,data,game,GAMES[game].board);else if(token===requestToken)card.hidden=true}catch{if(token===requestToken)card.hidden=true}
      }
    }
    const report=$('#morningReportDialog');
    if(report?.open){
      const card=ensureReportCard();
      if(card){
        card.hidden=false;card.querySelector('[data-competition-headline]').textContent='Checking your place…';card.querySelector('[data-competition-detail]').textContent='';
        try{const data=await compare('today',totalFor(date),date);if(token===requestToken&&data)renderComparison(card,data,'','today');else if(token===requestToken)card.hidden=true}catch{if(token===requestToken)card.hidden=true}
      }
    }
  }
  function schedule(delay=220){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>requestAnimationFrame(refreshNow),delay)}

  installStyle();
  window.addEventListener('clue:statechange',()=>schedule());
  window.addEventListener('clue-lastcall-update',()=>schedule());
  window.addEventListener('hashchange',()=>schedule(120));
  window.addEventListener('pageshow',()=>schedule(120));
  document.addEventListener('click',event=>{if(event.target?.closest?.('button,[data-tab],[data-open]'))schedule()},true);
  document.addEventListener('submit',()=>schedule(),true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(120),{once:true});else schedule(120);
})();
