import {pickPuzzle,answersFor,shuffled,isPangram,scoreWord,rankFor,describeWord,createDragWheel,showRunResult} from '/games/pangram-core.js';
const $=s=>document.querySelector(s);
let puzzle=null,center='',answers=[],answerSet=new Set(),found=new Set(),score=0,pangrams=0,revealed=false,previous='';

function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`.trim()}
function buildWheel(){
  const wheel=$('#letterWheel');wheel.innerHTML='<svg class="drag-lines" aria-hidden="true"><polyline class="drag-polyline"></polyline></svg>';
  const outer=shuffled(puzzle.letters.filter(l=>l!==center));
  outer.forEach((letter,i)=>{const b=document.createElement('button');b.type='button';b.className='letter';b.dataset.pos=i;b.dataset.letter=letter;b.textContent=letter;b.setAttribute('aria-label',letter);wheel.appendChild(b)});
  const c=document.createElement('button');c.type='button';c.className='letter center';c.dataset.letter=center;c.textContent=center;c.setAttribute('aria-label',`${center}, required center letter`);wheel.appendChild(c);
}
function render(){
  $('#heroScore').textContent=score;$('#foundCount').textContent=found.size;$('#pangramCount').textContent=pangrams;$('#rank').textContent=rankFor(found.size,answers.length);$('#foundMeta').textContent=`${found.size} of ${answers.length} found`;$('#progressBar').style.width=`${answers.length?Math.min(100,found.size/answers.length*100):0}%`;
  const list=$('#foundList');list.innerHTML='';if(!found.size){list.innerHTML='<span class="empty">Your words will stack up here.</span>'}else [...found].sort((a,b)=>b.length-a.length||a.localeCompare(b)).forEach(word=>{const span=document.createElement('span');span.className='found-word'+(isPangram(word,puzzle.letters)?' pangram':'');span.textContent=word;list.appendChild(span)});
}
function submitWord(word){
  if(!puzzle||revealed)return;
  if(word.length<4)return setMessage('Words need at least four letters.','bad');
  if(!word.includes(center))return setMessage(`Every word must use ${center}.`,'bad');
  if(found.has(word))return setMessage('Already found.','bad');
  if(!answerSet.has(word))return setMessage(`${word} isn't in this board's word list.`,'bad');
  found.add(word);const points=scoreWord(word,puzzle.letters);score+=points;const pangram=isPangram(word,puzzle.letters);if(pangram)pangrams++;
  setMessage(`${describeWord(word,puzzle.letters)} · ${word} +${points}`,pangram?'good':'');render();
}
function reveal(){
  if(!puzzle||revealed)return;revealed=true;dragController.clear();const box=$('#answerList');box.innerHTML='';answers.forEach(word=>{const span=document.createElement('span');span.textContent=`${found.has(word)?'✓ ':'• '}${word}${isPangram(word,puzzle.letters)?' ★':''}`;box.appendChild(span)});box.classList.add('open');$('#revealBtn').textContent='Answers revealed';$('#revealBtn').disabled=true;setMessage(`Board closed. You found ${found.size} of ${answers.length}.`);
  showRunResult({
    title:'Board closed.',
    detail:`${score.toLocaleString()} points · ${found.size} of ${answers.length} words · ${pangrams} pangram${pangrams===1?'':'s'}.`,
    shareText:`Pangram · Clue Morning\n${score.toLocaleString()} points\n${found.size}/${answers.length} words · ${pangrams} pangram${pangrams===1?'':'s'}`,
    shareUrl:'https://cluemorning.com/games/pangram/',
    shareTitle:'Pangram — Clue Morning'
  });
}
async function newPuzzle(){
  setMessage('Building a new seven-letter set…');$('#revealBtn').disabled=true;dragController.clear();
  try{puzzle=await pickPuzzle('pangram',previous);previous=puzzle.anchor;center=puzzle.center;answers=answersFor(puzzle,center);answerSet=new Set(answers);found=new Set();score=0;pangrams=0;revealed=false;$('#answerList').classList.remove('open');$('#answerList').innerHTML='';$('#revealBtn').disabled=false;$('#revealBtn').textContent='Reveal answers';buildWheel();render();setMessage(`Center letter ${center} is required. Tap letters then Submit, or drag and release.`)}catch(err){setMessage(err?.message||'Could not load the word board.','bad')}
}

const dragController=createDragWheel({wheel:$('#letterWheel'),readout:$('#dragWord'),onSubmit:submitWord,canDrag:()=>!!puzzle&&!revealed,submitButton:$('#tapSubmitBtn'),clearButton:$('#tapClearBtn')});
$('#shuffleBtn').addEventListener('click',()=>{if(puzzle){buildWheel();dragController.clear()}});
$('#newBtn').addEventListener('click',newPuzzle);$('#revealBtn').addEventListener('click',reveal);
newPuzzle();
