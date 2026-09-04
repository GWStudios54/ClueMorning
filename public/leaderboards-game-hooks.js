(()=>{
  const PLAYER_KEY='clue-morning-player-id',NAME_KEY='clue-morning-leader-name',BEST_KEY='clue-morning-record-bests-v1';
  const path=location.pathname.replace(/\/+$/,'');
  const game=path.endsWith('/games/all-seven')?'all-seven':path.endsWith('/games/pangram')?'pangram':path.endsWith('/games/tileworks')?'tileworks':'';
  if(!game)return;
  let timer=0,pendingScore=0,inFlight=false,lastSeenScore=0,runAnnounced=false,notice=null;

  function playerId(){let id='';try{id=localStorage.getItem(PLAYER_KEY)||''}catch{}if(!id){id=crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;try{localStorage.setItem(PLAYER_KEY,id)}catch{}}return id}
  function name(){let n='';try{n=localStorage.getItem(NAME_KEY)||''}catch{}if(n)return n;const compact=playerId().replace(/[^A-Za-z0-9]/g,'').toUpperCase();return `Player ${compact.slice(-4)||'0000'}`}
  function bests(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}')||{}}catch{return {}}}
  function saveBest(score){try{const b=bests();b[game]=Math.max(Number(b[game]||0),score);localStorage.setItem(BEST_KEY,JSON.stringify(b))}catch{}}
  function localBest(){return Number(bests()[game]||0)}
  function cleanScore(v){const n=Math.floor(Number(String(v??'').replace(/,/g,''))||0);return Math.max(0,Math.min(1000000,n))}

  function installNotice(){
    if(notice?.isConnected)return notice;
    if(!document.querySelector('#clueRecordNoticeStyle')){
      const style=document.createElement('style');style.id='clueRecordNoticeStyle';style.textContent=`
        .clue-record-notice{margin:0 auto 18px;padding:14px 16px;border:1px solid rgba(164,122,43,.35);border-radius:16px;background:linear-gradient(180deg,#fff9e8,#f4e4b9);color:#382d1f;box-shadow:0 10px 24px rgba(70,49,20,.10);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;max-width:760px}
        .clue-record-notice[hidden]{display:none!important}.clue-record-notice.record-pop{animation:clueRecordPop .42s ease}
        .clue-record-medal{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#d8a348;color:#fff;font:900 1.2rem Georgia,serif;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
        .clue-record-copy{min-width:0}.clue-record-copy span{display:block;font-size:.68rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase;color:#7b5e27}.clue-record-copy strong{display:block;font:700 1.5rem/1.05 Georgia,serif;margin-top:2px}.clue-record-rank{font-size:.76rem;font-weight:850;color:#6e5b3d;white-space:nowrap}
        #resultDialog .clue-record-notice{margin:14px 0 16px;max-width:none}
        @keyframes clueRecordPop{0%{transform:scale(.96);opacity:.35}60%{transform:scale(1.015)}100%{transform:scale(1);opacity:1}}
        @media(max-width:620px){.clue-record-notice{grid-template-columns:auto 1fr;padding:12px 13px}.clue-record-rank{grid-column:2;white-space:normal;margin-top:-6px}.clue-record-medal{width:38px;height:38px}}
      `;document.head.appendChild(style);
    }
    notice=document.createElement('div');notice.id='clueRecordNotice';notice.className='clue-record-notice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    notice.innerHTML='<div class="clue-record-medal">★</div><div class="clue-record-copy"><span>NEW HIGH SCORE</span><strong>0</strong></div><div class="clue-record-rank"></div>';
    if(game==='tileworks'){
      const anchor=document.querySelector('#resultDialog .result-scores');anchor?.insertAdjacentElement('beforebegin',notice);
    }else{
      const hero=document.querySelector('.hero');hero?.insertAdjacentElement('afterend',notice);
    }
    return notice;
  }
  function resetRun(){runAnnounced=false;lastSeenScore=0;pendingScore=0;clearTimeout(timer);const el=installNotice();if(el)el.hidden=true}
  function showRecord(score,rank,pulse){
    const el=installNotice();if(!el)return;const value=el.querySelector('.clue-record-copy strong'),rankEl=el.querySelector('.clue-record-rank');
    if(value)value.textContent=score.toLocaleString();if(rankEl)rankEl.textContent=rank?`#${Number(rank).toLocaleString()} all time`:'All-time personal best';
    el.hidden=false;if(pulse){el.classList.remove('record-pop');void el.offsetWidth;el.classList.add('record-pop')}
  }

  async function send(score){
    score=cleanScore(score);const before=localBest();if(score<=before||score<=0)return;if(inFlight){pendingScore=Math.max(pendingScore,score);return}inFlight=true;
    try{
      const r=await fetch('/api/leaderboard/high-score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game,playerId:playerId(),name:name(),score}),keepalive:true});const j=await r.json();
      if(r.ok&&j.enabled!==false){const best=cleanScore(j.score||score),improved=best>before&&score>=best;saveBest(best);if(improved){showRecord(best,j.rank,!runAnnounced);runAnnounced=true}}
    }catch{}finally{inFlight=false;if(pendingScore>localBest()){const next=pendingScore;pendingScore=0;send(next)}else pendingScore=0}
  }
  function schedule(score){
    score=cleanScore(score);if(score<lastSeenScore)resetRun();lastSeenScore=score;if(score<=localBest()||score<=pendingScore||score<=0)return;
    pendingScore=score;clearTimeout(timer);timer=setTimeout(()=>{const next=pendingScore;pendingScore=0;send(next)},650)
  }

  installNotice();
  if(game==='all-seven'||game==='pangram'){
    const score=document.querySelector('#heroScore');if(!score)return;const read=()=>schedule(score.textContent);new MutationObserver(read).observe(score,{subtree:true,childList:true,characterData:true});read();
  }else{
    const dialog=document.querySelector('#resultDialog'),score=document.querySelector('#resultPlayer');if(!dialog||!score)return;
    const read=()=>{if(dialog.open||dialog.hasAttribute('open'))schedule(score.textContent)};
    new MutationObserver(()=>{if(dialog.open||dialog.hasAttribute('open'))read();else resetRun()}).observe(dialog,{attributes:true,attributeFilter:['open']});
    new MutationObserver(read).observe(score,{subtree:true,childList:true,characterData:true});read();
  }
})();
