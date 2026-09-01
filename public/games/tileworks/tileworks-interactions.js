(()=>{
  const board=document.querySelector('#board'),rack=document.querySelector('#rack'),aiScore=document.querySelector('#aiScore'),aiCard=document.querySelector('#aiScoreCard');
  if(!board||!rack)return;

  let drag=null,ghost=null,overCell=null,suppressTrustedClickUntil=0;
  let committedSnapshot=new Map(),snapshotReady=false,lastAiScore=Number(aiScore?.textContent)||0,scanQueued=false;

  const tileText=tile=>tile?String(tile.childNodes[0]?.nodeValue||tile.textContent||'').trim():'';
  const cellAtPoint=(x,y)=>document.elementFromPoint(x,y)?.closest?.('#board .cell')||null;
  const currentCell=index=>board.querySelector(`.cell[data-index="${index}"]`);
  const clearOver=()=>{if(overCell)overCell.classList.remove('drag-over');overCell=null};
  const removeGhost=()=>{ghost?.remove();ghost=null};
  const cancelDrag=()=>{clearOver();removeGhost();drag=null};

  function makeGhost(source,x,y){
    const tile=source.matches('.rack-tile')?source:source.querySelector('.board-tile.pending');
    if(!tile)return;
    ghost=tile.cloneNode(true);ghost.classList.remove('used','selected','exchange-selected','pending');ghost.classList.add('tile-drag-ghost');document.body.appendChild(ghost);moveGhost(x,y);
  }
  function moveGhost(x,y){if(ghost){ghost.style.left=`${x}px`;ghost.style.top=`${y}px`}}
  function startPotential(e,source,type){
    if(e.button!==undefined&&e.button!==0)return;
    if(type==='rack'&&(source.disabled||source.classList.contains('used')))return;
    drag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,source,type,active:false};
    try{source.setPointerCapture?.(e.pointerId)}catch{}
  }
  function movePotential(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);
    if(!drag.active&&distance<7)return;
    if(!drag.active){drag.active=true;makeGhost(drag.source,e.clientX,e.clientY);drag.source.classList.add('drag-source')}
    e.preventDefault();moveGhost(e.clientX,e.clientY);clearOver();const cell=cellAtPoint(e.clientX,e.clientY);if(cell&&!cell.querySelector('.board-tile')){overCell=cell;cell.classList.add('drag-over')}
  }
  function finishPotential(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const info=drag,wasActive=info.active,drop=wasActive?cellAtPoint(e.clientX,e.clientY):null,dropIndex=drop?.dataset.index;
    info.source.classList.remove('drag-source');clearOver();removeGhost();drag=null;
    if(!wasActive)return;
    suppressTrustedClickUntil=performance.now()+450;e.preventDefault();
    if(dropIndex==null||drop.querySelector('.board-tile'))return;
    if(info.type==='rack'){
      info.source.click();
      currentCell(dropIndex)?.click();
    }else if(info.type==='pending'){
      const sourceIndex=info.source.dataset.index;if(sourceIndex===dropIndex)return;
      currentCell(sourceIndex)?.click();
      currentCell(dropIndex)?.click();
    }
  }

  rack.addEventListener('pointerdown',e=>{const tile=e.target.closest('.rack-tile');if(tile)startPotential(e,tile,'rack')});
  board.addEventListener('pointerdown',e=>{const cell=e.target.closest('.cell');if(cell?.querySelector('.board-tile.pending'))startPotential(e,cell,'pending')});
  document.addEventListener('pointermove',movePotential,{passive:false});
  document.addEventListener('pointerup',finishPotential,{passive:false});
  document.addEventListener('pointercancel',cancelDrag);
  document.addEventListener('click',e=>{if(e.isTrusted&&performance.now()<suppressTrustedClickUntil&&(e.target.closest('#rack')||e.target.closest('#board'))){e.preventDefault();e.stopImmediatePropagation()}},true);

  function queueScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(()=>{scanQueued=false;scanCommittedTiles()})}
  function scanCommittedTiles(){
    const current=new Map();
    board.querySelectorAll('.cell').forEach(cell=>{const tile=cell.querySelector('.board-tile:not(.pending)');if(tile)current.set(Number(cell.dataset.index),{letter:tileText(tile),tile})});
    const score=Number(aiScore?.textContent)||0;
    if(!snapshotReady){committedSnapshot=new Map([...current].map(([i,v])=>[i,v.letter]));lastAiScore=score;snapshotReady=true;return}
    const added=[...current].filter(([i,v])=>committedSnapshot.get(i)!==v.letter);
    if(added.length){
      const aiMove=score>lastAiScore;added.sort((a,b)=>a[0]-b[0]);
      added.forEach(([,v],n)=>{v.tile.style.setProperty('--tile-delay',`${n*105}ms`);v.tile.classList.add(aiMove?'ai-play-tile':'player-play-tile')});
      if(aiMove&&aiCard){aiCard.classList.remove('ai-score-pop');void aiCard.offsetWidth;aiCard.classList.add('ai-score-pop')}
    }
    committedSnapshot=new Map([...current].map(([i,v])=>[i,v.letter]));lastAiScore=score;
  }
  new MutationObserver(queueScan).observe(board,{subtree:true,childList:true});
  if(aiScore)new MutationObserver(queueScan).observe(aiScore,{subtree:true,childList:true,characterData:true});
  queueScan();
})();
