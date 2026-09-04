(()=>{
  const PLAYER_KEY='clue-morning-player-id',NAME_KEY='clue-morning-leader-name',BEST_KEY='clue-morning-record-bests-v1';
  const path=location.pathname.replace(/\/+$/,'');
  const game=path.endsWith('/games/all-seven')?'all-seven':path.endsWith('/games/pangram')?'pangram':path.endsWith('/games/tileworks')?'tileworks':'';
  if(!game)return;
  let timer=0,pendingScore=0,inFlight=false;
  function playerId(){let id='';try{id=localStorage.getItem(PLAYER_KEY)||''}catch{}if(!id){id=crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;try{localStorage.setItem(PLAYER_KEY,id)}catch{}}return id}
  function name(){let n='';try{n=localStorage.getItem(NAME_KEY)||''}catch{}if(n)return n;const compact=playerId().replace(/[^A-Za-z0-9]/g,'').toUpperCase();return `Player ${compact.slice(-4)||'0000'}`}
  function bests(){try{return JSON.parse(localStorage.getItem(BEST_KEY)||'{}')||{}}catch{return {}}}
  function saveBest(score){try{const b=bests();b[game]=Math.max(Number(b[game]||0),score);localStorage.setItem(BEST_KEY,JSON.stringify(b))}catch{}}
  function localBest(){return Number(bests()[game]||0)}
  function cleanScore(v){const n=Math.floor(Number(String(v??'').replace(/,/g,''))||0);return Math.max(0,Math.min(1000000,n))}
  async function send(score){
    score=cleanScore(score);if(score<=localBest()||score<=0)return;if(inFlight){pendingScore=Math.max(pendingScore,score);return}inFlight=true;
    try{const r=await fetch('/api/leaderboard/high-score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game,playerId:playerId(),name:name(),score}),keepalive:true});const j=await r.json();if(r.ok&&j.enabled!==false)saveBest(Number(j.score||score))}catch{}finally{inFlight=false;if(pendingScore>localBest()){const next=pendingScore;pendingScore=0;send(next)}else pendingScore=0}
  }
  function schedule(score){score=cleanScore(score);if(score<=localBest()||score<=pendingScore)return;pendingScore=score;clearTimeout(timer);timer=setTimeout(()=>{const next=pendingScore;pendingScore=0;send(next)},650)}

  if(game==='all-seven'||game==='pangram'){
    const score=document.querySelector('#heroScore');if(!score)return;const read=()=>schedule(score.textContent);new MutationObserver(read).observe(score,{subtree:true,childList:true,characterData:true});read();
  }else{
    const dialog=document.querySelector('#resultDialog'),score=document.querySelector('#resultPlayer');if(!dialog||!score)return;
    const read=()=>{if(dialog.open||dialog.hasAttribute('open'))schedule(score.textContent)};
    new MutationObserver(read).observe(dialog,{attributes:true,attributeFilter:['open']});new MutationObserver(read).observe(score,{subtree:true,childList:true,characterData:true});read();
  }
})();
