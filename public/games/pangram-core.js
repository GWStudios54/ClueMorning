const RAW_ANCHORS=[
  'PAINTER','PLASTER','DANCERS','CLIMATE','BOLSTER','GARDENS','ANOTHER','COUNTER','READING','CASTING',
  'DEALING','FLOWERS','MARKETS','PLACING','CRUISED','HOUSING','DETAILS','STORAGE','PLANETS','RETAINS',
  'TRAINED','PASTIME','GRANTED','PAINTED','BRACING','CARBONS','PLANTER','SCALING','THUNDER','ROUTINE',
  'VIOLETS','WARMEST','MACHINE','OUTSIDE','VINTAGE','TOUCHES','CHARMED','FARMING','ORCHIDS','MUSICAL'
];

export const SETS=RAW_ANCHORS.map(anchor=>({anchor,letters:[...new Set(anchor)]})).filter(x=>x.letters.length===7);
let lexiconPromise=null;

export function normalize(value){return String(value||'').toUpperCase().replace(/[^A-Z]/g,'')}
export function shuffled(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
export function isPangram(word,letters){const w=normalize(word);return letters.every(letter=>w.includes(letter))}
export function scoreWord(word,letters){const w=normalize(word);let score=w.length===4?1:Math.max(2,w.length-2);if(isPangram(w,letters))score+=15;return score}
export function rankFor(found,total){const pct=total?found/total:0;if(pct>=.8)return'BRILLIANT';if(pct>=.55)return'SHARP';if(pct>=.3)return'LOCKED IN';if(found>=1)return'WARMING UP';return'NEW BOARD'}

export async function loadLexicon(){
  if(lexiconPromise)return lexiconPromise;
  lexiconPromise=(async()=>{
    const response=await fetch('/trail-lexicon.txt',{cache:'force-cache'});if(!response.ok)throw new Error('Word library unavailable');
    const words=(await response.text()).split(/\s+/).map(normalize).filter(w=>w.length>=4&&w.length<=19);
    for(const set of SETS)words.push(set.anchor);
    return [...new Set(words)];
  })();
  return lexiconPromise;
}

function usesOnly(word,letters){const allowed=new Set(letters);for(const ch of word)if(!allowed.has(ch))return false;return true}

export async function analyzeSet(set){
  const lexicon=await loadLexicon();
  const words=lexicon.filter(word=>usesOnly(word,set.letters));
  const pangrams=words.filter(word=>isPangram(word,set.letters));
  const byCenter={};for(const letter of set.letters)byCenter[letter]=words.filter(word=>word.includes(letter));
  return {...set,words,pangrams,byCenter};
}

export async function pickPuzzle(mode='pangram',avoid=''){
  const pool=shuffled(SETS.filter(s=>s.anchor!==avoid));
  let fallback=null;
  for(const set of pool){
    const data=await analyzeSet(set);fallback=fallback||data;
    const counts=set.letters.map(letter=>data.byCenter[letter].length);
    if(mode==='all-seven'){
      if(data.pangrams.length&&Math.min(...counts)>=7)return data;
    }else{
      const eligible=set.letters.filter(letter=>data.byCenter[letter].length>=12);
      if(data.pangrams.length&&eligible.length){data.center=shuffled(eligible)[0];return data}
    }
  }
  if(!fallback)throw new Error('No pangram boards available');
  fallback.center=fallback.letters[0];return fallback;
}

export function answersFor(data,center){return (data.byCenter?.[center]||[]).slice().sort((a,b)=>a.length-b.length||a.localeCompare(b))}
export function describeWord(word,letters){return isPangram(word,letters)?'PANGRAM':word.length>=8?'RARE FIND':word.length>=6?'LONG WORD':'WORD'}

export function createDragWheel({wheel,readout,onSubmit,canDrag=()=>true,maxLength=19}){
  let dragging=false,pointerId=null,word='',lastTile=null,points=[];
  const line=()=>wheel.querySelector('.drag-polyline');
  function tileAt(x,y){const node=document.elementFromPoint(x,y);const tile=node?.closest?.('.letter');return tile&&wheel.contains(tile)?tile:null}
  function pointFor(tile){const wr=wheel.getBoundingClientRect(),tr=tile.getBoundingClientRect();return `${tr.left-wr.left+tr.width/2},${tr.top-wr.top+tr.height/2}`}
  function paint(){const poly=line();if(poly)poly.setAttribute('points',points.join(' '));if(readout){readout.textContent=word||'DRAG TO SPELL';readout.classList.toggle('active',!!word)}}
  function clear(){wheel.querySelectorAll('.letter.drag-hit').forEach(el=>el.classList.remove('drag-hit'));const poly=line();if(poly)poly.setAttribute('points','');word='';points=[];lastTile=null;if(readout){readout.textContent='DRAG TO SPELL';readout.classList.remove('active')}}
  function add(tile){if(!tile||word.length>=maxLength)return;const letter=tile.dataset.letter;if(!letter)return;word+=letter;points.push(pointFor(tile));tile.classList.add('drag-hit');paint()}
  function start(e){
    if(!canDrag()||e.button>0)return;const tile=e.target.closest('.letter');if(!tile)return;
    e.preventDefault();clear();dragging=true;pointerId=e.pointerId;lastTile=tile;try{wheel.setPointerCapture(pointerId)}catch{}add(tile)
  }
  function move(e){
    if(!dragging||e.pointerId!==pointerId)return;e.preventDefault();const tile=tileAt(e.clientX,e.clientY);
    if(tile===lastTile)return;if(!tile){lastTile=null;return}lastTile=tile;add(tile)
  }
  function finish(e,submit=true){
    if(!dragging||e.pointerId!==pointerId)return;e.preventDefault();const made=word;dragging=false;try{wheel.releasePointerCapture(pointerId)}catch{}pointerId=null;clear();if(submit&&made)onSubmit(made)
  }
  wheel.addEventListener('pointerdown',start);wheel.addEventListener('pointermove',move);wheel.addEventListener('pointerup',e=>finish(e,true));wheel.addEventListener('pointercancel',e=>finish(e,false));wheel.addEventListener('lostpointercapture',e=>{if(dragging&&e.pointerId===pointerId)finish(e,false)});
  return {clear,isDragging:()=>dragging};
}
