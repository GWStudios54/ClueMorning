const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ACCESS_KEY='clue-morning-unlimited-access-code';
const SAVE_KEY='clue-morning-tileworks-save-v1';
const VALUES={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,'?':0};
const BASE_COUNTS={A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2};
const BOARD_CONFIGS={9:{name:'Pocket',bag:55,pack:true},11:{name:'Compact',bag:72,pack:true},15:{name:'Standard',bag:100,pack:false},19:{name:'Grand',bag:140,pack:true}};
const AI={beginner:{name:'Aarin',label:'Beginner'},standard:{name:'Scarlet',label:'Standard'},hard:{name:'Mia',label:'Hard'},grandmaster:{name:'Annie',label:'Grandmaster'}};
let dictionary=new Set(),worker=null,workerReady=false,founder=false,state=null,selectedRack=null,cursorCell=null,exchangeMode=false,exchangeSelected=new Set(),pending=new Map(),thinking=false;

function normalizeWord(v){return String(v||'').toUpperCase().replace(/[^A-Z]/g,'')}
function tileId(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
function shuffled(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function boardIndex(r,c,size=state?.size){return r*size+c}
function rc(index,size=state?.size){return [Math.floor(index/size),index%size]}
function inBounds(r,c,size=state?.size){return r>=0&&c>=0&&r<size&&c<size}
function boardEmpty(){return state.board.every(x=>!x)}
function rackValue(rack){return rack.reduce((n,t)=>n+(t?.value||0),0)}
function setMessage(text,type=''){const el=$('#message');if(!el)return;el.textContent=text;el.className=`message ${type}`.trim()}
function setThinking(on){thinking=on;$('#playBtn').disabled=on;$('#exchangeBtn').disabled=on;$('#passBtn').disabled=on;$('#recallBtn').disabled=on;$('#shuffleBtn').disabled=on;if(on)setMessage(`${AI[state.difficulty].name} is searching the board…`,'thinking')}
function save(){if(!state)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify({...state,pending:[]}))}catch{}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch{}}
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return s&&s.version===1&&!s.over?s:null}catch{return null}}

function makeBag(target){
  const base=[];for(const [letter,count] of Object.entries(BASE_COUNTS))for(let i=0;i<count;i++)base.push(letter);
  const letters=[];while(letters.length<target){letters.push(...shuffled(base))}letters.length=target;
  return shuffled(letters.map(letter=>({id:tileId(),letter,value:VALUES[letter],blank:letter==='?'})));
}
function draw(rack,count=7){while(rack.length<count&&state.bag.length)rack.push(state.bag.pop())}
function symmetrical(points,size){const out=new Set();for(const [r,c] of points){for(const [rr,cc] of [[r,c],[r,size-1-c],[size-1-r,c],[size-1-r,size-1-c],[c,r],[c,size-1-r],[size-1-c,r],[size-1-c,size-1-r]])if(inBounds(rr,cc,size))out.add(`${rr},${cc}`)}return [...out].map(s=>s.split(',').map(Number))}
function makeBonuses(size){
  const mid=Math.floor(size/2),q=Math.max(2,Math.floor(size/4)),e=Math.max(1,Math.floor(size/7));
  const map={};const put=(kind,pts)=>{for(const [r,c] of symmetrical(pts,size)){const i=boardIndex(r,c,size);if(i!==boardIndex(mid,mid,size)&&!map[i])map[i]=kind}};
  put('tw',[[0,0],[0,mid]]);put('dw',[[e,e],[q,q],[mid-e,mid-e]]);put('tl',[[e,mid],[q,Math.max(1,q-1)]]);put('dl',[[0,q],[e,Math.max(1,q-1)],[q,mid]]);map[boardIndex(mid,mid,size)]='start';return map;
}
function newState(size,difficulty){
  const s={version:1,size,difficulty,bonuses:makeBonuses(size),board:Array(size*size).fill(null),bag:[],playerRack:[],aiRack:[],playerScore:0,aiScore:0,turn:'player',scoreless:0,over:false,moveNo:1,lastMove:'',direction:'H'};
  state=s;s.bag=makeBag(BOARD_CONFIGS[size].bag);draw(s.playerRack);draw(s.aiRack);return s;
}

async function loadDictionary(){
  try{
    const r=await fetch('/trail-lexicon.txt',{cache:'force-cache'});if(!r.ok)throw new Error('Word library unavailable');
    const words=(await r.text()).split(/\s+/).map(normalizeWord).filter(w=>w.length>=2&&w.length<=19);dictionary=new Set(words);
    $('#dictionaryState').textContent=`Word library ready · ${dictionary.size.toLocaleString()} accepted words`;$('#dictionaryState').className='loading ready';$('#startBtn').disabled=false;
    worker=new Worker('/games/tileworks/tileworks-ai-worker.js');
    worker.onmessage=e=>{if(e.data?.type==='ready'){workerReady=true}else if(e.data?.type==='move')finishAiTurn(e.data.move,e.data.meta)};
    worker.postMessage({type:'init'});
  }catch{$('#dictionaryState').textContent='Could not load the Tileworks word library.';$('#dictionaryState').className='loading bad'}
}
async function checkFounder(){
  let code='';try{code=localStorage.getItem(ACCESS_KEY)||''}catch{}
  if(code)try{const r=await fetch('/api/unlimited/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});const j=await r.json();founder=!!j.active}catch{}
  $('#tierBadge').textContent=founder?'FOUNDERS · ALL PACKS':'BASE GAME';
  $$('.pack-choice').forEach(label=>{const input=label.querySelector('input');input.disabled=!founder;label.classList.toggle('locked',!founder)});
  $('#packNote').textContent=founder?'Founders active — every Tileworks board pack is unlocked.':'Alternate board sizes are content-pack boards. Founders own every pack automatically.';
}

function renderSetup(){const saved=loadSave();$('#resumeBtn').hidden=!saved}
function renderAll(){if(!state)return;renderScores();renderBoard();renderRack();renderControls();save()}
function renderScores(){
  const ai=AI[state.difficulty];$('#playerScore').textContent=state.playerScore;$('#aiScore').textContent=state.aiScore;$('#aiName').textContent=ai.name;$('#aiLevel').textContent=ai.label;$('#bagCount').textContent=state.bag.length;$('#playerRackCount').textContent=`${state.playerRack.length} tiles`;$('#turnLabel').textContent=state.turn==='player'?'Your turn':`${ai.name}'s turn`;$('#playerScoreCard').classList.toggle('active-side',state.turn==='player'&&!state.over);$('#aiScoreCard').classList.toggle('active-side',state.turn==='ai'&&!state.over)
}
function renderBoard(){
  const board=$('#board');board.style.setProperty('--size',state.size);board.innerHTML='';const mid=Math.floor(state.size/2);
  for(let i=0;i<state.board.length;i++){
    const cell=document.createElement('button');cell.type='button';cell.className='cell';cell.dataset.index=i;const bonus=state.bonuses[i];if(bonus)cell.classList.add(bonus);if(i===boardIndex(mid,mid))cell.classList.add('start');if(cursorCell===i)cell.classList.add('cursor');
    const placed=pending.get(i)||state.board[i];if(placed){const t=document.createElement('span');t.className='board-tile'+(pending.has(i)?' pending':'');t.textContent=placed.letter;const sm=document.createElement('small');sm.textContent=placed.value;t.appendChild(sm);cell.appendChild(t)}
    cell.addEventListener('click',()=>onCell(i));board.appendChild(cell)
  }
}
function renderRack(){
  const rack=$('#rack');rack.innerHTML='';for(let i=0;i<state.playerRack.length;i++){
    const tile=state.playerRack[i],used=[...pending.values()].some(p=>p.rackIndex===i),b=document.createElement('button');b.type='button';b.className='rack-tile';if(used)b.classList.add('used');if(exchangeMode&&exchangeSelected.has(i))b.classList.add('exchange-selected');else if(!exchangeMode&&selectedRack===i)b.classList.add('selected');b.textContent=tile.blank?' ':tile.letter;const sm=document.createElement('small');sm.textContent=tile.value;b.appendChild(sm);b.title=tile.blank?'Blank tile':`${tile.letter} · ${tile.value}`;b.addEventListener('click',()=>onRack(i));rack.appendChild(b)
  }
}
function renderControls(){
  const player=state.turn==='player'&&!thinking&&!state.over;$('#recallBtn').disabled=!player||pending.size===0;$('#shuffleBtn').disabled=!player||pending.size>0;$('#passBtn').disabled=!player||pending.size>0;$('#playBtn').disabled=!player||pending.size===0;$('#directionBtn').disabled=!player||pending.size>1;$('#exchangeBtn').disabled=!player||pending.size>0||state.bag.length<7;$('#exchangeBtn').textContent=exchangeMode?`Exchange selected (${exchangeSelected.size})`:'Exchange';$('#directionBtn').textContent=state.direction==='V'?'Down ↓':'Across →'
}
function onRack(i){if(state.turn!=='player'||thinking||state.over)return;if(exchangeMode){exchangeSelected.has(i)?exchangeSelected.delete(i):exchangeSelected.add(i);renderRack();renderControls();return}if([...pending.values()].some(p=>p.rackIndex===i))return;selectedRack=selectedRack===i?null:i;renderRack()}
function onCell(i){
  if(state.turn!=='player'||thinking||state.over)return;cursorCell=i;
  if(pending.has(i)){const p=pending.get(i);pending.delete(i);selectedRack=p.rackIndex;previewPending();renderAll();return}
  if(state.board[i]){renderBoard();return}
  if(selectedRack===null){renderBoard();return}
  const tile=state.playerRack[selectedRack];let letter=tile.letter;if(tile.blank){letter=normalizeWord(prompt('Choose a letter for the blank tile:')||'').slice(0,1);if(!letter){renderBoard();return}}
  pending.set(i,{...tile,letter,value:tile.blank?0:tile.value,rackIndex:selectedRack});selectedRack=null;previewPending();renderAll()
}
function recallPending(){pending.clear();selectedRack=null;cursorCell=null;$('#preview').hidden=true;setMessage(boardEmpty()?'Place a word through the center star.':'Build from the existing board.');renderAll()}
function tempBoard(){const b=state.board.map(x=>x?{...x}:null);for(const [i,t] of pending)b[i]={letter:t.letter,value:t.value,blank:t.blank};return b}
function neighborsExisting(i){const [r,c]=rc(i);for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&state.board[boardIndex(rr,cc)])return true}return false}
function readWord(board,r,c,dr,dc){while(inBounds(r-dr,c-dc)&&board[boardIndex(r-dr,c-dc)]){r-=dr;c-=dc}const cells=[];while(inBounds(r,c)&&board[boardIndex(r,c)]){cells.push(boardIndex(r,c));r+=dr;c+=dc}return {cells,word:cells.map(i=>board[i].letter).join('')}}
function placementDirection(){
  const cells=[...pending.keys()];if(cells.length>1){const pts=cells.map(i=>rc(i)),sameR=pts.every(x=>x[0]===pts[0][0]),sameC=pts.every(x=>x[1]===pts[0][1]);if(sameR)return'H';if(sameC)return'V';return null}
  const i=cells[0],[r,c]=rc(i);if((inBounds(r,c-1)&&state.board[boardIndex(r,c-1)])||(inBounds(r,c+1)&&state.board[boardIndex(r,c+1)]))return'H';if((inBounds(r-1,c)&&state.board[boardIndex(r-1,c)])||(inBounds(r+1,c)&&state.board[boardIndex(r+1,c)]))return'V';return state.direction||'H'
}
function scoreWord(cells,board){let sum=0,mult=1;for(const i of cells){const tile=board[i],isNew=pending.has(i);let val=tile.value;if(isNew){const bonus=state.bonuses[i];if(bonus==='dl')val*=2;if(bonus==='tl')val*=3;if(bonus==='dw'||bonus==='start')mult*=2;if(bonus==='tw')mult*=3}sum+=val}return sum*mult}
function validatePending(){
  if(!pending.size)return {ok:false,error:'Place at least one tile.'};const dir=placementDirection();if(!dir)return {ok:false,error:'All new tiles must be in one row or one column.'};const board=tempBoard(),cells=[...pending.keys()],first=boardEmpty();
  const [r0,c0]=rc(cells[0]),main=readWord(board,r0,c0,dir==='V'?1:0,dir==='H'?1:0);if(main.cells.length<2)return {ok:false,error:'A play must make a word of at least two letters.'};if(!cells.every(i=>main.cells.includes(i)))return {ok:false,error:'Tiles must form one continuous word with no gaps.'};
  if(first){const center=boardIndex(Math.floor(state.size/2),Math.floor(state.size/2));if(!main.cells.includes(center))return {ok:false,error:'The opening word must cover the center star.'}}else if(!cells.some(neighborsExisting))return {ok:false,error:'Your play must connect to a tile already on the board.'};
  const words=[main],crossDir=dir==='H'?[1,0]:[0,1];for(const i of cells){const [r,c]=rc(i),w=readWord(board,r,c,crossDir[0],crossDir[1]);if(w.cells.length>1)words.push(w)}
  const unique=[],seen=new Set();for(const w of words){const k=w.cells.join(',');if(!seen.has(k)){seen.add(k);unique.push(w)}}for(const w of unique)if(!dictionary.has(w.word))return {ok:false,error:`${w.word} is not in the Tileworks word list.`,badWord:w.word};
  let score=unique.reduce((n,w)=>n+scoreWord(w.cells,board),0);if(pending.size===7)score+=50;return {ok:true,dir,words:unique,score,board}
}
function previewPending(){
  if(!pending.size){$('#preview').hidden=true;return}const v=validatePending(),el=$('#preview');el.hidden=false;if(v.ok){el.innerHTML=`<span>${v.words.map(w=>w.word).join(' + ')}</span><strong>${v.score} pts</strong>`;setMessage('Valid play. Commit it when you are ready.','good')}else{el.innerHTML='<span>Draft</span><strong>—</strong>';setMessage(v.error,v.badWord?'bad':'')}
}
function consumePendingFromRack(){const used=[...pending.values()].map(p=>p.rackIndex).sort((a,b)=>b-a);for(const i of used)state.playerRack.splice(i,1)}
async function playPending(){
  if(thinking)return;const v=validatePending();if(!v.ok){setMessage(v.error,'bad');return}
  for(const [i,t] of pending)state.board[i]={letter:t.letter,value:t.value,blank:t.blank};consumePendingFromRack();state.playerScore+=v.score;state.scoreless=v.score?0:state.scoreless+1;state.lastMove=`You played ${v.words[0].word} for ${v.score}.`;pending.clear();selectedRack=null;cursorCell=null;draw(state.playerRack);$('#preview').hidden=true;if(checkEnd())return;state.turn='ai';renderAll();setMessage(`${state.lastMove} ${AI[state.difficulty].name} is thinking…`,'thinking');await aiTurn()
}
function exchangeSelectedTiles(){
  if(!exchangeMode){exchangeMode=true;exchangeSelected.clear();setMessage('Select one or more rack tiles, then press Exchange again.');renderAll();return}
  if(!exchangeSelected.size){exchangeMode=false;setMessage('Exchange cancelled.');renderAll();return}
  if(state.bag.length<7){exchangeMode=false;exchangeSelected.clear();setMessage('There are not enough tiles left in the bag to exchange.','bad');renderAll();return}
  const idxs=[...exchangeSelected].sort((a,b)=>b-a),returned=[];for(const i of idxs)returned.push(state.playerRack.splice(i,1)[0]);draw(state.playerRack,7);state.bag=shuffled([...state.bag,...returned]);state.scoreless++;state.lastMove=`You exchanged ${returned.length} tile${returned.length===1?'':'s'}.`;exchangeMode=false;exchangeSelected.clear();if(checkEnd())return;state.turn='ai';renderAll();void aiTurn()
}
function passTurn(){if(pending.size||thinking)return;state.scoreless++;state.lastMove='You passed.';if(checkEnd())return;state.turn='ai';renderAll();void aiTurn()}
function shuffleRack(){state.playerRack=shuffled(state.playerRack);renderRack();save()}
async function aiTurn(){setThinking(true);renderScores();while(!workerReady)await new Promise(r=>setTimeout(r,60));worker.postMessage({type:'move',board:state.board,rack:state.aiRack,size:state.size,bonuses:state.bonuses,difficulty:state.difficulty,bagCount:state.bag.length,scoreless:state.scoreless})}
function finishAiTurn(move,meta={}){
  if(!state||state.over)return;const ai=AI[state.difficulty];
  if(move){for(const p of move.placements)state.board[p.index]={letter:p.letter,value:p.value,blank:p.blank};const used=move.usedRackIndices.sort((a,b)=>b-a);for(const i of used)state.aiRack.splice(i,1);state.aiScore+=move.score;state.scoreless=move.score?0:state.scoreless+1;draw(state.aiRack);state.lastMove=`${ai.name} played ${move.word} for ${move.score}.`;setMessage(`${state.lastMove}${state.difficulty==='grandmaster'&&meta.examined?` Annie examined ${meta.examined.toLocaleString()} legal candidates.`:''}`)}
  else if(state.bag.length>=7&&state.aiRack.length){const n=Math.min(state.difficulty==='beginner'?2:Math.max(2,Math.floor(state.aiRack.length/2)),state.aiRack.length),returned=state.aiRack.splice(0,n);draw(state.aiRack,7);state.bag=shuffled([...state.bag,...returned]);state.scoreless++;state.lastMove=`${ai.name} exchanged ${n} tiles.`;setMessage(state.lastMove)}else{state.scoreless++;state.lastMove=`${ai.name} passed.`;setMessage(state.lastMove)}
  setThinking(false);if(checkEnd())return;state.turn='player';state.moveNo++;renderAll();setMessage(`${state.lastMove} Your turn.`)
}
function checkEnd(){
  const rackOut=state.bag.length===0&&(state.playerRack.length===0||state.aiRack.length===0),stalled=state.scoreless>=6;if(!rackOut&&!stalled)return false;const pRemain=rackValue(state.playerRack),aRemain=rackValue(state.aiRack);state.playerScore-=pRemain;state.aiScore-=aRemain;if(rackOut&&state.playerRack.length===0)state.playerScore+=aRemain;if(rackOut&&state.aiRack.length===0)state.aiScore+=pRemain;state.over=true;state.turn='over';clearSave();renderAll();showResult(stalled?'Six consecutive scoreless turns ended the match.':'The bag is empty and a rack has been cleared.');return true
}
function showResult(reason){const ai=AI[state.difficulty],win=state.playerScore>state.aiScore,tie=state.playerScore===state.aiScore;$('#resultTitle').textContent=tie?'Draw.':win?'You win.':`${ai.name} wins.`;$('#resultText').textContent=`${reason} Remaining rack values were deducted.`;$('#resultPlayer').textContent=state.playerScore;$('#resultAi').textContent=state.aiScore;$('#resultAiName').childNodes[0].nodeValue=`${ai.name} `;$('#resultDialog').showModal()}
function startMatch(size,difficulty){state=newState(size,difficulty);pending=new Map();selectedRack=null;cursorCell=null;exchangeMode=false;exchangeSelected.clear();$('#setup').hidden=true;$('#game').hidden=false;$('#resultDialog').close();setMessage('Place the opening word through the center star.');renderAll()}
function resumeMatch(){const s=loadSave();if(!s)return;state=s;state.direction=state.direction||'H';pending=new Map();selectedRack=null;cursorCell=null;exchangeMode=false;exchangeSelected.clear();$('#setup').hidden=true;$('#game').hidden=false;setMessage(state.turn==='player'?'Match resumed. Your turn.':`${AI[state.difficulty].name}'s turn.`);renderAll();if(state.turn==='ai')void aiTurn()}
function setupScreen(){state=null;pending.clear();$('#game').hidden=true;$('#setup').hidden=false;$('#resultDialog').close();renderSetup()}

$('#directionBtn').addEventListener('click',()=>{if(pending.size>1)return;state.direction=state.direction==='H'?'V':'H';renderControls()});
$('#recallBtn').addEventListener('click',recallPending);$('#shuffleBtn').addEventListener('click',shuffleRack);$('#exchangeBtn').addEventListener('click',exchangeSelectedTiles);$('#passBtn').addEventListener('click',passTurn);$('#playBtn').addEventListener('click',()=>void playPending());
$('#startBtn').addEventListener('click',()=>{const size=Number(document.querySelector('input[name="boardSize"]:checked').value),difficulty=document.querySelector('input[name="difficulty"]:checked').value;if(BOARD_CONFIGS[size].pack&&!founder)return;startMatch(size,difficulty)});
$('#resumeBtn').addEventListener('click',resumeMatch);$('#rematchBtn').addEventListener('click',()=>startMatch(state.size,state.difficulty));$('#setupBtn').addEventListener('click',setupScreen);
window.addEventListener('keydown',e=>{if(!state||state.turn!=='player'||thinking||state.over||exchangeMode)return;if(e.key==='Escape'){recallPending();return}if(e.key==='Backspace'&&pending.size){const last=[...pending.keys()].at(-1),p=pending.get(last);pending.delete(last);selectedRack=p.rackIndex;previewPending();renderAll();e.preventDefault();return}const letter=normalizeWord(e.key);if(letter.length!==1)return;let i=state.playerRack.findIndex((t,idx)=>![...pending.values()].some(p=>p.rackIndex===idx)&&!t.blank&&t.letter===letter);if(i<0)i=state.playerRack.findIndex((t,idx)=>![...pending.values()].some(p=>p.rackIndex===idx)&&t.blank);if(i<0)return;selectedRack=i;if(cursorCell===null)cursorCell=boardIndex(Math.floor(state.size/2),Math.floor(state.size/2));onCell(cursorCell);const [r,c]=rc(cursorCell),dr=state.direction==='V'?1:0,dc=state.direction==='H'?1:0;let rr=r+dr,cc=c+dc;while(inBounds(rr,cc)&&state.board[boardIndex(rr,cc)]){rr+=dr;cc+=dc}if(inBounds(rr,cc))cursorCell=boardIndex(rr,cc);renderAll();e.preventDefault()});

document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
await checkFounder();renderSetup();await loadDictionary();
