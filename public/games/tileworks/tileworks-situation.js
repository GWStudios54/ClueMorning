(()=>{
  const STORE='clue-morning-tileworks-situation-v1';
  const LEGACY_STORE='clue-morning-daily-expansion-v1';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let data=loadStore(),daily=null,date='',puzzle=null,state=null,lexicon=new Set(),lexiconReady=false;
  let pending=new Map(),selectedTile=null,drag=null,ghost=null,overCell=null,currentMode='match',matchView={setupHidden:false,gameHidden:true};

  function loadStore(){try{const v=JSON.parse(localStorage.getItem(STORE)||'null');return v?.version===1?v:{version:1,days:{}}}catch{return {version:1,days:{}}}}
  function saveStore(){try{localStorage.setItem(STORE,JSON.stringify(data))}catch{}}
  function legacyState(){try{return JSON.parse(localStorage.getItem(LEGACY_STORE)||'{}')?.days?.[date]?.situation||null}catch{return null}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function dateLabel(key){try{return new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return key}}

  function ensureState(){
    if(!date||!puzzle)return;
    data.days??={};const key=`${date}:${puzzle.id}`;
    let saved=data.days[date];
    if(!saved||saved.key!==key){
      const legacy=legacyState();
      if(legacy?.key===key&&Array.isArray(legacy.board)&&Array.isArray(legacy.rack)){
        saved=structuredClone?structuredClone(legacy):JSON.parse(JSON.stringify(legacy));saved.key=key;
      }else{
        const board=Array(puzzle.size*puzzle.size).fill(null);for(const t of puzzle.board)board[t.index]={letter:t.letter,value:t.value,blank:false};
        saved={key,board,rack:puzzle.rack.map((x,i)=>({id:`${date}-tw-s-${i}`,letter:x.letter,value:x.value,blank:!!x.blank})),moves:0,score:0,done:false};
      }
      data.days[date]=saved;saveStore();
    }
    state=saved;
  }

  function rc(i,size=puzzle?.size||9){return [Math.floor(i/size),i%size]}
  function idx(r,c,size=puzzle?.size||9){return r*size+c}
  function inside(r,c,size=puzzle?.size||9){return r>=0&&c>=0&&r<size&&c<size}
  function readWord(board,r,c,dr,dc){while(inside(r-dr,c-dc)&&board[idx(r-dr,c-dc)]){r-=dr;c-=dc}const cells=[];while(inside(r,c)&&board[idx(r,c)]){cells.push(idx(r,c));r+=dr;c+=dc}return {cells,word:cells.map(i=>board[i].letter).join('')}}
  function tempBoard(){const board=state.board.map(x=>x?{...x}:null);for(const [i,t] of pending)board[i]={letter:t.letter,value:t.value,blank:t.blank};return board}
  function pendingDirection(){const cells=[...pending.keys()];if(cells.length<2)return null;const pts=cells.map(i=>rc(i)),sameR=pts.every(p=>p[0]===pts[0][0]),sameC=pts.every(p=>p[1]===pts[0][1]);return sameR?'H':sameC?'V':'X'}
  function connectedToCommitted(i){const [r,c]=rc(i);for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc;if(inside(rr,cc)&&state.board[idx(rr,cc)])return true}return false}
  function scoreWord(cells,board){let sum=0,mult=1;for(const i of cells){const t=board[i];let value=Number(t.value||0);if(pending.has(i)){const bonus=puzzle.bonuses?.[i];if(bonus==='dl')value*=2;if(bonus==='tl')value*=3;if(bonus==='dw')mult*=2;if(bonus==='tw')mult*=3}sum+=value}return sum*mult*10}

  function validate(){
    if(!state||state.done)return {ok:false,error:'This Situation is complete.'};
    if(!pending.size)return {ok:false,error:'Place at least one tile.'};
    if(!lexiconReady)return {ok:false,error:'Word library is still loading.'};
    const direction=pendingDirection();if(direction==='X')return {ok:false,error:'All tiles in one move must share a row or column.'};
    const board=tempBoard(),cells=[...pending.keys()];
    if(cells.length>1){const [r,c]=rc(cells[0]),main=readWord(board,r,c,direction==='V'?1:0,direction==='H'?1:0);if(!cells.every(i=>main.cells.includes(i)))return {ok:false,error:'Your tiles must form one continuous play with no gaps.'}}
    if(!cells.some(connectedToCommitted))return {ok:false,error:'Your move must connect to the existing board.'};
    const words=[],seen=new Set();for(const i of cells){const [r,c]=rc(i);for(const [dr,dc] of [[0,1],[1,0]]){const w=readWord(board,r,c,dr,dc);if(w.cells.length<2)continue;const key=w.cells.join(',');if(!seen.has(key)){seen.add(key);words.push(w)}}}
    if(!words.length)return {ok:false,error:'Make a word of at least two letters.'};
    for(const w of words)if(!lexicon.has(w.word))return {ok:false,error:`${w.word} is not in the Tileworks word list.`};
    let score=words.reduce((n,w)=>n+scoreWord(w.cells,board),0);if(pending.size===7)score+=500;
    return {ok:true,words,score};
  }

  function chooseBlank(){const value=String(prompt('Choose a letter for the blank tile:')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,1);return value||null}
  function place(tileId,cellIndex){
    if(!state||state.done||state.board[cellIndex]||pending.has(cellIndex))return false;
    const source=state.rack.find(t=>t.id===tileId);if(!source||[...pending.values()].some(t=>t.id===tileId))return false;
    const tile={...source};if(tile.blank){const letter=chooseBlank();if(!letter)return false;tile.letter=letter;tile.value=0}
    pending.set(cellIndex,tile);selectedTile=null;render();return true;
  }
  function recall(){pending.clear();selectedTile=null;render()}
  function playMove(){
    const v=validate();if(!v.ok)return;
    for(const [i,t] of pending)state.board[i]={letter:t.letter,value:t.value,blank:t.blank};
    const used=new Set([...pending.values()].map(t=>t.id));state.rack=state.rack.filter(t=>!used.has(t.id));state.score+=v.score;state.moves++;pending.clear();selectedTile=null;
    if(state.moves>=Number(puzzle.maxMoves||3)||!state.rack.length)state.done=true;saveStore();render();
  }
  function finishEarly(){if(!state||state.done||state.moves<1)return;state.done=true;pending.clear();selectedTile=null;saveStore();render()}

  function tileMarkup(tile,pendingTile=false){return `<span class="situation-board-tile${pendingTile?' pending':''}">${esc(tile.letter)}<small>${Number(tile.value||0)}</small></span>`}
  function renderBoard(){
    const board=$('#twSituationBoard');if(!board||!state)return;board.style.setProperty('--size',puzzle.size);board.innerHTML='';
    for(let i=0;i<state.board.length;i++){
      const cell=document.createElement('button');cell.type='button';cell.className='situation-cell';cell.dataset.cell=String(i);const bonus=puzzle.bonuses?.[i];if(bonus)cell.classList.add(bonus);
      const committed=state.board[i],draft=pending.get(i);if(committed)cell.innerHTML=tileMarkup(committed);else if(draft)cell.innerHTML=tileMarkup(draft,true);
      cell.disabled=!!committed||!!state.done;
      cell.addEventListener('click',()=>{if(draft){pending.delete(i);render();return}if(selectedTile)place(selectedTile,i)});
      board.appendChild(cell);
    }
  }
  function renderRack(){
    const rack=$('#twSituationRack');if(!rack||!state)return;rack.innerHTML='';const used=new Set([...pending.values()].map(t=>t.id));
    for(const tile of state.rack){const b=document.createElement('button');b.type='button';b.className='situation-rack-tile';b.dataset.tileId=tile.id;b.innerHTML=`${esc(tile.blank?'?':tile.letter)}<small>${Number(tile.value||0)}</small>`;if(used.has(tile.id))b.classList.add('used');if(selectedTile===tile.id)b.classList.add('selected');b.disabled=state.done||used.has(tile.id);b.addEventListener('click',()=>{selectedTile=selectedTile===tile.id?null:tile.id;renderRack()});rack.appendChild(b)}
    bindDrag();
  }
  function render(){
    if(!state||!puzzle)return;renderBoard();renderRack();const v=validate();
    $('#twSituationMoves').textContent=`${state.moves}/${Number(puzzle.maxMoves||3)}`;$('#twSituationScore').textContent=Number(state.score||0).toLocaleString();$('#twSituationRackCount').textContent=state.rack.length;$('#twSituationStatus').textContent=state.done?'DONE':state.moves?'LIVE':'OPEN';
    $('#situationModeSubhead').textContent=puzzle.title?`${puzzle.title} · Find the strongest three-move line you can.`:'Find the strongest three-move line you can.';$('#situationDate').textContent=dateLabel(date);
    const preview=$('#twSituationPreview');if(preview){preview.hidden=!pending.size;const strong=preview.querySelector('strong');if(strong)strong.textContent=v.ok?`${v.words.map(w=>w.word).join(' + ')} · +${v.score.toLocaleString()}`:(pending.size?'Invalid draft':'—')}
    $('#twSituationRecall').disabled=state.done||!pending.size;$('#twSituationPlay').disabled=state.done||!v.ok;$('#twSituationFinish').disabled=state.done||state.moves<1;
    const msg=$('#twSituationMessage');if(msg){if(state.done){msg.className='message good';msg.textContent=`Situation complete — ${Number(state.score||0).toLocaleString()} points in ${state.moves} move${state.moves===1?'':'s'}.`}else if(pending.size){msg.className=`message ${v.ok?'good':'bad'}`;msg.textContent=v.ok?'Valid line. Commit it when you are ready.':v.error}else{msg.className='message';msg.textContent=lexiconReady?'Find the strongest line you can. Your rack will not refill.':'Loading word library…'}}
  }

  function clearDrag(){overCell?.classList.remove('drag-over');overCell=null;ghost?.remove();ghost=null;drag=null}
  function bindDrag(){const rack=$('#twSituationRack');if(!rack||rack.dataset.dragBound)return;rack.dataset.dragBound='1';
    rack.addEventListener('pointerdown',e=>{const tile=e.target.closest('.situation-rack-tile');if(!tile||tile.disabled)return;drag={id:e.pointerId,tileId:tile.dataset.tileId,startX:e.clientX,startY:e.clientY,active:false};try{tile.setPointerCapture?.(e.pointerId)}catch{}});
    window.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(!drag.active&&Math.hypot(dx,dy)<8)return;if(!drag.active){drag.active=true;const source=state?.rack.find(t=>t.id===drag.tileId);ghost=document.createElement('div');ghost.className='situation-drag-ghost';ghost.textContent=source?.blank?'?':source?.letter||'';document.body.appendChild(ghost)}if(ghost){ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`}const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.situation-cell');if(overCell!==el){overCell?.classList.remove('drag-over');overCell=el;if(overCell&&!overCell.disabled&&!pending.has(Number(overCell.dataset.cell)))overCell.classList.add('drag-over')}});
    window.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const target=overCell&&!overCell.disabled?Number(overCell.dataset.cell):null,tileId=drag.tileId,active=drag.active;clearDrag();if(active&&Number.isInteger(target))place(tileId,target)});
    window.addEventListener('pointercancel',clearDrag);
  }

  function rememberMatchView(){matchView={setupHidden:$('#setup')?.hidden??false,gameHidden:$('#game')?.hidden??true}}
  function setMode(mode){
    if(mode!=='situation')mode='match';if(mode===currentMode)return;
    if(mode==='situation'){rememberMatchView();if($('#setup'))$('#setup').hidden=true;if($('#game'))$('#game').hidden=true;if($('#situationMode'))$('#situationMode').hidden=false}
    else{if($('#situationMode'))$('#situationMode').hidden=true;const setup=$('#setup'),game=$('#game');if(setup)setup.hidden=matchView.setupHidden;if(game)game.hidden=matchView.gameHidden;if(setup?.hidden&&game?.hidden)setup.hidden=false}
    currentMode=mode;$$('[data-tileworks-mode]').forEach(b=>b.classList.toggle('active',b.dataset.tileworksMode===mode));
    const url=new URL(location.href);if(mode==='situation')url.searchParams.set('mode','situation');else url.searchParams.delete('mode');history.replaceState({},'',`${url.pathname}${url.search}${url.hash}`);if(mode==='situation')render();
  }

  async function loadLexicon(){try{const r=await fetch('/trail-lexicon.txt',{cache:'force-cache'});if(!r.ok)throw new Error();lexicon=new Set((await r.text()).split(/\s+/).map(w=>w.toUpperCase().replace(/[^A-Z]/g,'')).filter(w=>w.length>=2&&w.length<=15));lexiconReady=true;render()}catch{const m=$('#twSituationMessage');if(m){m.className='message bad';m.textContent='The Tileworks word library could not load.'}}}
  async function boot(){
    $$('[data-tileworks-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.tileworksMode)));
    $('#twSituationRecall')?.addEventListener('click',recall);$('#twSituationPlay')?.addEventListener('click',playMove);$('#twSituationFinish')?.addEventListener('click',finishEarly);
    try{const r=await fetch('/api/daily',{cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error(j.error||'Situation is unavailable.');daily=j;date=j.date;puzzle=j.tileworksSituation||j.situation;if(!puzzle)throw new Error('Situation is unavailable today.');ensureState();render();void loadLexicon()}catch(error){const m=$('#twSituationMessage');if(m){m.className='message bad';m.textContent=error.message||'Situation could not load.'}}
    const requested=new URL(location.href).searchParams.get('mode');if(requested==='situation'){currentMode='match';setTimeout(()=>setMode('situation'),0)}
  }
  boot();
})();
