import {pickPuzzle,answersFor,normalize,shuffled,isPangram,scoreWord,rankFor,describeWord} from '/games/pangram-core.js';
const $=s=>document.querySelector(s);
let puzzle=null,center='',answers=[],answerSet=new Set(),found=new Set(),score=0,pangrams=0,revealed=false,previous='';

function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`.trim()}
function buildWheel(){
  const wheel=$('#letterWheel');wheel.innerHTML='';
  const outer=shuffled(puzzle.letters.filter(l=>l!==center));
  outer.forEach((letter,i)=>{const b=document.createElement('button');b.type='button';b.className='letter';b.dataset.pos=i;b.textContent=letter;b.addEventListener('click',()=>appendLetter(letter));wheel.appendChild(b)});
  const c=document.createElement('button');c.type='button';c.className='letter center';c.textContent=center;c.setAttribute('aria-label',`${center}, required center letter`);c.addEventListener('click',()=>appendLetter(center));wheel.appendChild(c);
}
function appendLetter(letter){const input=$('#wordInput');input.value=(input.value+letter).slice(0,19);input.focus()}
function render(){
  $('#heroScore').textContent=score;$('#foundCount').textContent=found.size;$('#pangramCount').textContent=pangrams;$('#rank').textContent=rankFor(found.size,answers.length);$('#foundMeta').textContent=`${found.size} of ${answers.length} found`;$('#progressBar').style.width=`${answers.length?Math.min(100,found.size/answers.length*100):0}%`;
  const list=$('#foundList');list.innerHTML='';if(!found.size){list.innerHTML='<span class="empty">Your words will stack up here.</span>'}else [...found].sort((a,b)=>b.length-a.length||a.localeCompare(b)).forEach(word=>{const span=document.createElement('span');span.className='found-word'+(isPangram(word,puzzle.letters)?' pangram':'');span.textContent=word;list.appendChild(span)});
}
function submitWord(raw){
  if(!puzzle||revealed)return;const word=normalize(raw);$('#wordInput').value='';
  if(word.length<4)return setMessage('Words need at least four letters.','bad');
  if(!word.includes(center))return setMessage(`Every word must use ${center}.`,'bad');
  if([...word].some(ch=>!puzzle.letters.includes(ch)))return setMessage('Use only the seven letters on the board.','bad');
  if(found.has(word))return setMessage('Already found.','bad');
  if(!answerSet.has(word))return setMessage(`${word} isn't in this board's word list.`,'bad');
  found.add(word);const points=scoreWord(word,puzzle.letters);score+=points;const pangram=isPangram(word,puzzle.letters);if(pangram)pangrams++;
  setMessage(`${describeWord(word,puzzle.letters)} · ${word} +${points}`,pangram?'good':'');render();
}
function reveal(){if(!puzzle)return;revealed=true;const box=$('#answerList');box.innerHTML='';answers.forEach(word=>{const span=document.createElement('span');span.textContent=`${found.has(word)?'✓ ':'• '}${word}${isPangram(word,puzzle.letters)?' ★':''}`;box.appendChild(span)});box.classList.add('open');$('#revealBtn').textContent='Answers revealed';$('#revealBtn').disabled=true;setMessage(`Board closed. You found ${found.size} of ${answers.length}.`)}
async function newPuzzle(){
  setMessage('Building a new seven-letter set…');$('#wordInput').disabled=true;$('#revealBtn').disabled=true;
  try{puzzle=await pickPuzzle('pangram',previous);previous=puzzle.anchor;center=puzzle.center;answers=answersFor(puzzle,center);answerSet=new Set(answers);found=new Set();score=0;pangrams=0;revealed=false;$('#answerList').classList.remove('open');$('#answerList').innerHTML='';$('#revealBtn').disabled=false;$('#revealBtn').textContent='Reveal answers';$('#wordInput').disabled=false;$('#wordInput').value='';buildWheel();render();setMessage(`Center letter ${center} is required. Find the pangram.`);$('#wordInput').focus()}catch(err){setMessage(err?.message||'Could not load the word board.','bad')}
}

$('#wordForm').addEventListener('submit',e=>{e.preventDefault();submitWord($('#wordInput').value)});
$('#shuffleBtn').addEventListener('click',()=>{if(puzzle)buildWheel()});
$('#clearBtn').addEventListener('click',()=>{$('#wordInput').value='';$('#wordInput').focus()});
$('#newBtn').addEventListener('click',newPuzzle);$('#revealBtn').addEventListener('click',reveal);
$('#wordInput').addEventListener('input',e=>{const next=normalize(e.target.value);if(next!==e.target.value)e.target.value=next});
newPuzzle();
