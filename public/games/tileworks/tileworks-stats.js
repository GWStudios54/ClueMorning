(()=>{
  const $=s=>document.querySelector(s);
  const game=$('#game'),board=$('#board'),rack=$('#rack'),turnLabel=$('#turnLabel'),message=$('#message'),playerScore=$('#playerScore'),aiScore=$('#aiScore'),aiName=$('#aiName'),result=$('#resultDialog');
  if(!game||!board||!rack||!turnLabel||!result)return;

  const STORAGE='clue-morning-tileworks-stats-v1';
  let session=load(),analysisWorker=null,analysisReady=false,analysisSeq=0,lastTurnToken='',syncQueued=false;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const textLetter=tile=>String(tile?.childNodes?.[0]?.nodeValue||'').trim().toUpperCase();
  const num=el=>Number(String(el?.textContent||'').replace(/[^0-9.-]/g,''))||0;

  function fresh(){return {version:1,started:Date.now(),turns:[],luckSamples:[],bestPlay:null,biggestWord:null,biggestMiss:null,aiBest:null,tilesPlayed:0,bingos:0,crosswords:0,passes:0,exchanges:0}}
  function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v?.version===1?v:fresh()}catch{return fresh()}}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(session))}catch{}}
  function reset(){session=fresh();lastTurnToken='';save();setTimeout(queueSync,40)}

  function boardSnapshot(){
    const cells=[...board.querySelectorAll('.cell')],size=Math.round(Math.sqrt(cells.length)),arr=Array(cells.length).fill(null),bonuses={};
    for(const cell of cells){
      const i=Number(cell.dataset.index),tile=cell.querySelector('.board-tile:not(.pending)');
      if(tile){const letter=textLetter(tile),value=num(tile.querySelector('small'));arr[i]={letter,value,blank:value===0}}
      for(const kind of ['dl','tl','dw','tw','start'])if(cell.classList.contains(kind)){bonuses[i]=kind;break}
    }
    return {size,board:arr,bonuses};
  }
  function rackSnapshot(){return [...rack.querySelectorAll('.rack-tile')].filter(t=>!t.classList.contains('used')).map(t=>{const blank=(t.title||'').toLowerCase().includes('blank'),letter=blank?'?':textLetter(t),value=num(t.querySelector('small'));return {letter,value,blank}})}
  function leaveQuality(tiles){
    let score=0,vowels=0,cons=0;const counts={};
    for(const t of tiles){if(t.blank){score+=20;continue}const ch=t.letter;counts[ch]=(counts[ch]||0)+1;if('AEIOU'.includes(ch))vowels++;else cons++;score+=({S:4,E:3,R:3,A:2,I:2,N:2,T:2,L:1,D:1,U:1}[ch]||0)}
    for(const n of Object.values(counts))if(n>1)score-=(n-1)*2;if(counts.Q&&!counts.U)score-=13;if(counts.U&&!counts.Q)score-=1;if(vowels===0||cons===0)score-=7;else if(Math.abs(vowels-cons)<=2)score+=4;
    return score;
  }
  function luckForRack(tiles){return clamp(Math.round(50+leaveQuality(tiles)*1.8),0,100)}
  function turnToken(snap,tiles){return `${num(playerScore)}:${num(aiScore)}|${snap.board.map(x=>x?.letter||'.').join('')}|${tiles.map(x=>x.letter).join('')}`}

  function ensureWorker(){
    if(analysisWorker)return;
    analysisWorker=new Worker('/games/tileworks/tileworks-ai-worker.js');
    analysisWorker.onmessage=e=>{
      const d=e.data||{};if(d.type==='ready'){analysisReady=true;queueSync();return}
      if(d.type==='analysis'){
        const turn=session.turns.find(t=>t.requestId===d.requestId);if(!turn)return;
        turn.best=d.best?{word:d.best.word,score:d.best.score}:null;turn.examined=d.meta?.examined||0;updateMiss(turn);save();if(result.open)renderStats();
      }
    };
    analysisWorker.postMessage({type:'init'});
  }
  function updateMiss(turn){
    if(!turn?.best||!turn.action)return;const actual=turn.action==='play'?(turn.actualScore||0):0,gap=Math.max(0,turn.best.score-actual);if(gap<=0)return;
    const candidate={word:turn.best.word,score:turn.best.score,gap,actual:actual||0,action:turn.action};
    if(!session.biggestMiss||candidate.gap>session.biggestMiss.gap||(candidate.gap===session.biggestMiss.gap&&candidate.score>session.biggestMiss.score))session.biggestMiss=candidate;
  }
  function noteAiBest(){
    const s=message?.textContent||'',name=(aiName?.textContent||'').trim();if(!name)return;
    const m=s.match(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')} played ([A-Z]+) for (\\d+)`,'i'));
    if(m){const play={word:m[1].toUpperCase(),score:Number(m[2])};if(!session.aiBest||play.score>session.aiBest.score)session.aiBest=play}
  }
  function captureTurn(){
    if(game.hidden||!/^Your turn/i.test(turnLabel.textContent||'')||board.querySelector('.board-tile.pending'))return;
    const snap=boardSnapshot(),tiles=rackSnapshot();if(!snap.size||!tiles.length)return;
    const token=turnToken(snap,tiles);if(token===lastTurnToken)return;lastTurnToken=token;noteAiBest();
    const luck=luckForRack(tiles);session.luckSamples.push(luck);
    const requestId=`stats-${Date.now()}-${++analysisSeq}`,turn={token,requestId,luck,best:null,actualScore:null,words:[],action:null,tiles:0};session.turns.push(turn);save();
    ensureWorker();const send=()=>analysisWorker.postMessage({type:'analyze',requestId,board:snap.board,rack:tiles,size:snap.size,bonuses:snap.bonuses,bagCount:num($('#bagCount'))});
    if(analysisReady)send();else{const wait=setInterval(()=>{if(analysisReady){clearInterval(wait);send()}},40);setTimeout(()=>clearInterval(wait),5000)}
  }
  function currentTurn(){return [...session.turns].reverse().find(t=>!t.action)||session.turns.at(-1)||null}
  function capturePlay(){
    const preview=$('#preview');if(!preview||preview.hidden)return;const score=num(preview.querySelector('strong'));if(!Number.isFinite(score)||score<=0)return;
    const words=String(preview.querySelector('span')?.textContent||'').split('+').map(x=>x.trim().toUpperCase()).filter(Boolean);if(!words.length)return;
    const turn=currentTurn();if(!turn||turn.action)return;const tiles=board.querySelectorAll('.board-tile.pending').length;
    turn.action='play';turn.actualScore=score;turn.words=words;turn.tiles=tiles;session.tilesPlayed+=tiles;if(tiles===7)session.bingos++;if(words.length>1)session.crosswords+=words.length-1;
    const play={word:words[0],score};if(!session.bestPlay||score>session.bestPlay.score)session.bestPlay=play;
    for(const word of words){const candidate={word,length:word.length,score};if(!session.biggestWord||candidate.length>session.biggestWord.length||(candidate.length===session.biggestWord.length&&score>session.biggestWord.score))session.biggestWord=candidate}
    updateMiss(turn);save();
  }
  function capturePass(){const turn=currentTurn();if(turn&&!turn.action){turn.action='pass';turn.actualScore=0;session.passes++;updateMiss(turn);save()}}
  function captureExchange(){const btn=$('#exchangeBtn');if(!btn||!/^Exchange selected \([1-9]/.test(btn.textContent||''))return;const turn=currentTurn();if(turn&&!turn.action){turn.action='exchange';turn.actualScore=0;session.exchanges++;updateMiss(turn);save()}}

  function metrics(){
    const judged=session.turns.filter(t=>t.action==='play'&&t.best?.score>0);let actual=0,possible=0;for(const t of judged){actual+=Math.min(t.actualScore||0,t.best.score);possible+=t.best.score}
    const skill=possible?clamp(Math.round(actual/possible*100),0,100):null;
    const luck=session.luckSamples.length?Math.round(session.luckSamples.reduce((a,b)=>a+b,0)/session.luckSamples.length):null;
    const scoring=session.turns.filter(t=>t.action==='play'),avg=scoring.length?Math.round(scoring.reduce((n,t)=>n+(t.actualScore||0),0)/scoring.length):0;
    return {skill,luck,avg,plays:scoring.length};
  }
  function meter(label,value,sub){const display=value==null?'—':value;return `<div class="stat-meter"><div class="stat-meter-head"><span>${label}</span><strong>${display}${value==null?'':'/100'}</strong></div><div class="stat-track"><i style="width:${value==null?0:value}%"></i></div><small>${sub}</small></div>`}
  function record(label,main,sub=''){return `<div class="stat-record"><span>${label}</span><strong>${main||'—'}</strong>${sub?`<small>${sub}</small>`:''}</div>`}
  function renderStats(){
    let root=$('#matchStats');if(!root){root=document.createElement('section');root.id='matchStats';root.className='match-stats';const scores=result.querySelector('.result-scores');scores?.after(root)}
    noteAiBest();const m=metrics(),miss=session.biggestMiss,big=session.biggestWord,best=session.bestPlay,ai=session.aiBest;
    const missSub=miss?`${miss.score} pts available · ${miss.gap} left on the board${miss.action!=='play'?` after ${miss.action}`:''}`:'No larger scoring miss recorded.';
    root.innerHTML=`<div class="stats-title"><span>POST-MATCH REPORT</span><strong>How the match actually went</strong></div><div class="stat-meters">${meter('Skill',m.skill,'Move efficiency versus the strongest scoring play available from each rack.')}${meter('Luck',m.luck,'Estimated draw quality from rack balance, flexible letters, blanks, and awkward tiles.')}</div><div class="stat-records">${record('Biggest word',big?.word,big?`${big.length} letters`:``)}${record('Best play',best?.word,best?`${best.score} points`:``)}${record('Biggest missed',miss?.word,missSub)}${record(`${(aiName?.textContent||'Opponent').trim()} best`,ai?.word,ai?`${ai.score} points`:``)}</div><div class="stat-strip"><span><b>${m.avg}</b><small>avg move</small></span><span><b>${session.tilesPlayed}</b><small>tiles played</small></span><span><b>${session.bingos}</b><small>7-tile plays</small></span><span><b>${session.crosswords}</b><small>crosswords</small></span><span><b>${session.exchanges}</b><small>exchanges</small></span><span><b>${session.passes}</b><small>passes</small></span></div><p class="stats-note">Skill and Luck are game estimates, not ratings. Skill measures scoring efficiency; Luck estimates the quality of the racks you were dealt.</p>`;
  }
  function queueSync(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;captureTurn();if(result.open)renderStats()})}

  $('#playBtn')?.addEventListener('click',capturePlay,true);
  $('#passBtn')?.addEventListener('click',capturePass,true);
  $('#exchangeBtn')?.addEventListener('click',captureExchange,true);
  $('#startBtn')?.addEventListener('click',reset,true);
  $('#rematchBtn')?.addEventListener('click',reset,true);
  new MutationObserver(queueSync).observe(turnLabel,{subtree:true,childList:true,characterData:true});
  new MutationObserver(queueSync).observe(rack,{subtree:true,childList:true});
  new MutationObserver(()=>{if(result.open){renderStats();save()}}).observe(result,{attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
  ensureWorker();queueSync();
})();
