// Clue Morning app loader + daily-game retention flow.
(() => {
  const CORE_SRC = '/app-core.js';
  const STATE_KEY = 'clue-morning-state-v2.4';
  const TZ = 'America/Los_Angeles';
  const GAMES = {
    letter:{name:'Letter Grid',panel:'letter',url:'https://cluemorning.com/games/letter-grid/'},
    groups:{name:'Four Groups',panel:'groups',url:'https://cluemorning.com/games/four-groups/'},
    trail:{name:'Letter Trail',panel:'trail',url:'https://cluemorning.com/games/letter-trail/'},
    link:{name:'Triple Link',panel:'link',url:'https://cluemorning.com/games/triple-link/'},
    steps:{name:'Word Steps',panel:'steps',url:'https://cluemorning.com/games/word-steps/'},
    deepcut:{name:'Deep Cut',panel:'deepcut',url:'https://cluemorning.com/games/deep-cut/'}
  };

  function pacificDateKey(d=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function readDay(){
    try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')?.days?.[pacificDateKey()]||{}}catch{return {}}
  }
  const initialDone=Object.fromEntries(Object.keys(GAMES).map(game=>[game,!!readDay()?.[game]?.done]));
  const shown=new Set(Object.entries(initialDone).filter(([,done])=>done).map(([game])=>game));

  function installScoreCards(){
    if(!document.querySelector('.app'))return;
    const style=document.createElement('style');
    style.id='daily-score-card-styles';
    style.textContent=`
      .daily-score-dialog{width:min(540px,92vw);text-align:center;padding:28px;max-height:min(86vh,760px);overflow:auto}
      .daily-score-dialog .dialog-close{position:absolute;right:16px;top:16px;float:none}
      .daily-score-kicker{display:block;margin-top:4px}
      .daily-score-dialog h2{font-size:clamp(2.25rem,8vw,3.25rem);margin:.25rem 0 .4rem}
      .daily-score-copy{color:var(--muted);margin:0 auto 16px;max-width:36ch;line-height:1.5}
      .daily-score-number{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:10px 0 8px}
      .daily-score-number strong{font:700 clamp(3.35rem,14vw,5rem)/.9 Georgia,"Times New Roman",serif;letter-spacing:-.05em}
      .daily-score-number span{font-weight:900;color:var(--muted)}
      .daily-score-detail{font-weight:850;margin:10px auto 14px;color:var(--dark)}
      .daily-score-marks{font-size:1.3rem;letter-spacing:.08em;line-height:1.45;margin:10px auto 18px;white-space:pre-wrap;overflow-wrap:anywhere}
      .daily-score-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
      .daily-score-actions button{min-height:52px;justify-content:center}
      .daily-share-status{min-height:1.4em;margin:12px 0 0;color:var(--muted);font-size:.83rem}
      .daily-score-reopen{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin:18px 0 4px}
      .daily-score-reopen button{min-width:145px}
      .deepcut-recap{display:grid;gap:8px;text-align:left;margin:18px 0 4px;padding-top:16px;border-top:1px solid var(--line)}
      .deepcut-recap-row{padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:var(--paper2)}
      .deepcut-recap-row strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:.95rem;margin-bottom:5px}
      .deepcut-recap-row span{display:block;color:var(--muted);font-size:.76rem;line-height:1.45}
      @media(max-width:520px){.daily-score-actions{grid-template-columns:1fr}.daily-score-reopen{display:grid}.daily-score-reopen button{width:100%}}
    `;
    document.head.appendChild(style);

    const dialog=document.createElement('dialog');
    dialog.id='dailyScoreDialog';
    dialog.className='daily-score-dialog';
    dialog.innerHTML=`
      <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close score"><span aria-hidden="true">×</span></button></form>
      <span id="dailyScoreKicker" class="game-label daily-score-kicker">GAME COMPLETE</span>
      <h2 id="dailyScoreTitle">Nice work.</h2>
      <p class="daily-score-copy">Your score is locked in. Share it, or keep the morning going.</p>
      <div class="daily-score-number"><strong id="dailyScoreValue">0</strong><span id="dailyScoreMax"></span></div>
      <div id="dailyScoreDetail" class="daily-score-detail"></div>
      <div id="dailyScoreMarks" class="daily-score-marks"></div>
      <div id="dailyScoreExtra"></div>
      <div class="daily-score-actions">
        <button id="dailyScoreMore" class="primary-button" type="button">Play More Games</button>
        <button id="dailyScoreShare" class="secondary-button" type="button">Share Score</button>
      </div>
      <p id="dailyShareStatus" class="daily-share-status" role="status" aria-live="polite"></p>
    `;
    document.querySelector('.app').appendChild(dialog);

    let currentGame=null,currentSnapshot=null,recapToken=0;
    const valueEl=dialog.querySelector('#dailyScoreValue'),maxEl=dialog.querySelector('#dailyScoreMax'),detailEl=dialog.querySelector('#dailyScoreDetail'),marksEl=dialog.querySelector('#dailyScoreMarks'),extraEl=dialog.querySelector('#dailyScoreExtra'),statusEl=dialog.querySelector('#dailyShareStatus');

    function isUnlimited(game){return !!document.querySelector(`#${GAMES[game].panel} .unlimited-play-bar`)}
    function letterMarks(s){
      return (s.guesses||[]).map(g=>(g.feedback||[]).map(v=>v==='green'?'🟩':v==='yellow'?'🟨':'⬛').join('')).join('\n');
    }
    function snapshot(game,s){
      const score=Number(s?.score||0);
      if(game==='letter')return {score,detail:s.won?`Solved in ${(s.guesses||[]).length}/6 guesses`:'No solve',marks:letterMarks(s)};
      if(game==='groups')return {score,detail:`${(s.solved||[]).length}/4 groups · ${Number(s.mistakes||0)} mistake${Number(s.mistakes||0)===1?'':'s'}`,marks:`${'🟩'.repeat((s.solved||[]).length)}${'⬛'.repeat(Math.max(0,4-(s.solved||[]).length))}`};
      if(game==='trail')return {score,detail:`${(s.words||[]).length} words${s.best?` · Best: ${s.best}`:''}`,marks:''};
      if(game==='link')return {score,detail:s.won?`Solved in ${Number(s.guesses||0)}/3 guesses`:'Missed today’s link',marks:s.won?'🟩':'⬛'};
      if(game==='steps'){
        const moves=Math.max(0,(s.path||[]).length-1),par=document.querySelector('#stepsPar')?.textContent||'';
        return {score,detail:s.won?`Solved in ${moves} move${moves===1?'':'s'}${par?` · Par ${par}`:''}`:'Path revealed',marks:s.won?'🟩':'⬛'};
      }
      const answers=s.answers||[],hits=answers.filter(a=>a.accepted).length,total=Math.max(8,answers.length||8);
      return {score,max:total*100,detail:`${hits}/${total} prompts landed`,marks:Array.from({length:total},(_,i)=>answers[i]?.accepted?'🟩':'⬛').join(''),promptIds:answers.map(a=>a.promptId).filter(Boolean)};
    }

    async function loadDeepCutRecap(data,token){
      if(!data.promptIds?.length)return;
      extraEl.innerHTML='<div class="deepcut-recap"><div class="deepcut-recap-row"><span>Loading the common and rare ends of today’s categories…</span></div></div>';
      try{
        const response=await fetch('/api/deepcut/recap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({promptIds:data.promptIds})});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Recap unavailable');if(token!==recapToken)return;
        extraEl.innerHTML=`<div class="deepcut-recap">${result.rows.map(row=>`<div class="deepcut-recap-row"><strong>${escapeHtml(row.prompt)}</strong><span>Most common: <b>${escapeHtml(row.mostCommon)}</b></span><span>Most rare: <b>${escapeHtml(row.rarest)}</b></span></div>`).join('')}</div>`;
      }catch{if(token===recapToken)extraEl.innerHTML=''}
    }
    function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

    function renderCard(game){
      const s=readDay()?.[game];if(!s?.done)return null;
      const data=snapshot(game,s);currentGame=game;currentSnapshot=data;recapToken++;
      dialog.querySelector('#dailyScoreKicker').textContent=`${GAMES[game].name.toUpperCase()} COMPLETE`;
      dialog.querySelector('#dailyScoreTitle').textContent=game==='deepcut'?'Nice cut.':'Nice work.';
      valueEl.textContent=data.score.toLocaleString();maxEl.textContent=data.max?`/ ${data.max.toLocaleString()}`:'';detailEl.textContent=data.detail||'';marksEl.textContent=data.marks||'';marksEl.hidden=!data.marks;extraEl.innerHTML='';statusEl.textContent='';
      if(game==='deepcut')void loadDeepCutRecap(data,recapToken);
      return data;
    }
    function showCard(game){if(isUnlimited(game)||!renderCard(game))return;if(!dialog.open)dialog.showModal()}
    function goMore(){if(dialog.open)dialog.close();try{const url=new URL(location.href);url.searchParams.delete('play');history.replaceState({},'',`${url.pathname}${url.search}${url.hash}`)}catch{}document.querySelector('[data-tab="today"]')?.click()}
    function shareBody(game,data,includeUrl=true){
      const lines=[`${GAMES[game].name} · Clue Morning`,data.max?`${data.score.toLocaleString()}/${data.max.toLocaleString()}`:`${data.score.toLocaleString()} points`,data.detail];
      if(data.marks)lines.push(data.marks);if(includeUrl)lines.push('',`Play: ${GAMES[game].url}`);return lines.filter(v=>v!==undefined&&v!==null&&v!=='').join('\n');
    }
    async function copy(text){
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
      const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
    }
    async function share(){
      if(!currentGame||!currentSnapshot)return;statusEl.textContent='';const game=currentGame,data=currentSnapshot;
      try{
        if(navigator.share){await navigator.share({title:`${GAMES[game].name} — Clue Morning`,text:shareBody(game,data,false),url:GAMES[game].url});statusEl.textContent='Shared.';return}
        await copy(shareBody(game,data,true));statusEl.textContent='Score copied — paste it anywhere.';
      }catch(err){if(err?.name==='AbortError')return;try{await copy(shareBody(game,data,true));statusEl.textContent='Score copied — paste it anywhere.'}catch{statusEl.textContent='Sharing is not available in this browser.'}}
    }
    dialog.querySelector('#dailyScoreMore').addEventListener('click',goMore);
    dialog.querySelector('#dailyScoreShare').addEventListener('click',()=>void share());

    function ensureReopen(game,s){
      const panel=document.querySelector(`#${GAMES[game].panel}`);if(!panel)return;
      let bar=panel.querySelector(`[data-score-reopen="${game}"]`);
      if(!bar){bar=document.createElement('div');bar.className='daily-score-reopen';bar.dataset.scoreReopen=game;bar.innerHTML='<button class="secondary-button" type="button" data-view-score>View Score Card</button><button class="primary-button" type="button" data-play-more>Play More Games</button>';panel.appendChild(bar);bar.querySelector('[data-view-score]').addEventListener('click',()=>showCard(game));bar.querySelector('[data-play-more]').addEventListener('click',goMore)}
      bar.hidden=!s?.done||isUnlimited(game);
    }

    let checkQueued=false;
    function checkCompletions(){
      checkQueued=false;const day=readDay();
      for(const game of Object.keys(GAMES)){
        const s=day?.[game];ensureReopen(game,s);
        if(s?.done&&!shown.has(game)&&!isUnlimited(game)){shown.add(game);setTimeout(()=>showCard(game),120)}
      }
    }
    function queueCheck(){if(checkQueued)return;checkQueued=true;setTimeout(checkCompletions,80)}
    const observer=new MutationObserver(queueCheck);observer.observe(document.querySelector('.app'),{subtree:true,childList:true,attributes:true,characterData:true});
    checkCompletions();
  }

  const core=document.createElement('script');core.src=CORE_SRC;core.async=false;core.onload=installScoreCards;core.onerror=()=>console.error('Clue Morning core failed to load.');document.body.appendChild(core);
})();
