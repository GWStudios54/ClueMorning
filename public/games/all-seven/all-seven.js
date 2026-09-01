import {pickPuzzle,answersFor,normalize,shuffled,isPangram,scoreWord,describeWord} from '/games/pangram-core.js';
const $=s=>document.querySelector(s);const TARGET=3;
let puzzle=null,centers=[],center='',current=0,answers=[],answerSet=new Set(),found=new Set(),cleared=new Set(),stageWords=0,stageTarget=TARGET,score=0,pangrams=0,previous='',finished=false;

function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`.trim()}
function buildWheel(){
  const wheel=$('#letterWheel');wheel.innerHTML='';const outer=shuffled(puzzle.letters.filter(l=>l!==center));
  outer.forEach((letter,i)=>{const b=document.createElement('button');b.type='button';b.className='letter';b.dataset.pos=i;b.textContent=letter;b.addEventListener('click',()=>appendLetter(letter));wheel.appendChild(b)});
  const c=document.createElement('button');c.type='button';c.className='letter center';c.textContent=center;c.setAttribute('aria-label',`${center}, required center letter`);c.addEventListener('click',()=>appendLetter(center));wheel.appendChild(c)
}
function appendLetter(letter){if(finished)return;const input=$('#wordInput');input.value=(input.value+letter).slice(0,19);input.focus()}
function renderTrack(){
  const track=$('#centerTrack');track.innerHTML='';centers.forEach((letter,i)=>{const b=document.createElement('button');b.type='button';b.className='center-chip';b.textContent=letter;b.disabled=true;if(cleared.has(letter))b.classList.add('done');if(i===current&&!finished)b.classList.add('active');track.appendChild(b)});
  const mastery=$('#mastery');mastery.innerHTML='';centers.forEach(letter=>{const span=document.createElement('span');if(cleared.has(letter))span.className='done';mastery.appendChild(span)})
}
function render(){
  $('#heroScore').textContent=score;$('#centerCount').textContent=`${cleared.size}/7`;$('#foundCount').textContent=found.size;$('#pangramCount').textContent=pangrams;$('#foundMeta').textContent=`${found.size} unique words`;
  $('#stageNote').textContent=finished?'All seven centers mastered.':`${center} center · ${stageWords}/${stageTarget} new words to clear`;
  renderTrack();const list=$('#foundList');list.innerHTML='';if(!found.size)list.innerHTML='<span class="empty">Every accepted word is spent for this run.</span>';else [...found].reverse().forEach(word=>{const span=document.createElement('span');span.className='found-word'+(isPangram(word,puzzle.letters)?' pangram':'');span.textContent=word;list.appendChild(span)})
}
function closeReveal(){const box=$('#answerList');box.classList.remove('open');box.innerHTML='';$('#revealBtn').textContent='Reveal current center';$('#revealBtn').disabled=finished}
function enterCenter(){
  if(cleared.size===7){finishRun();return}
  center=centers[current];answers=answersFor(puzzle,center);answerSet=new Set(answers);const remaining=answers.filter(w=>!found.has(w));stageWords=0;stageTarget=Math.min(TARGET,remaining.length);
  if(stageTarget===0){cleared.add(center);current=(current+1)%centers.length;while(cleared.has(centers[current])&&cleared.size<7)current=(current+1)%centers.length;enterCenter();return}
  closeReveal();buildWheel();render();setMessage(`Center ${center}. Find ${stageTarget} new word${stageTarget===1?'':'s'} or land a fresh pangram.`);$('#wordInput').focus()
}
function clearCenter(viaPangram=false){
  if(cleared.has(center))return;cleared.add(center);score+=25;render();setMessage(`${viaPangram?'PANGRAM CLEAR':'CENTER CLEAR'} · ${center} +25`,'good');
  if(cleared.size===7){setTimeout(finishRun,500);return}
  setTimeout(()=>{do{current=(current+1)%centers.length}while(cleared.has(centers[current]));enterCenter()},650)
}
function finishRun(){finished=true;score+=100;$('#wordInput').disabled=true;$('#revealBtn').disabled=true;render();setMessage(`ALL SEVEN · run mastered +100 · ${score} points`,'good')}
function submitWord(raw){
  if(!puzzle||finished)return;const word=normalize(raw);$('#wordInput').value='';
  if(word.length<4)return setMessage('Words need at least four letters.','bad');
  if(!word.includes(center))return setMessage(`This center requires ${center}.`,'bad');
  if([...word].some(ch=>!puzzle.letters.includes(ch)))return setMessage('Use only the seven letters on the board.','bad');
  if(found.has(word))return setMessage('That word is already spent for this run.','bad');
  if(!answerSet.has(word))return setMessage(`${word} isn't in this center's word list.`,'bad');
  found.add(word);stageWords++;const points=scoreWord(word,puzzle.letters);score+=points;const pangram=isPangram(word,puzzle.letters);if(pangram)pangrams++;
  setMessage(`${describeWord(word,puzzle.letters)} · ${word} +${points}`,pangram?'good':'');render();if(pangram||stageWords>=stageTarget)clearCenter(pangram)
}
function reveal(){if(!puzzle||finished)return;const box=$('#answerList');if(box.classList.contains('open')){closeReveal();return}box.innerHTML='';answers.forEach(word=>{const span=document.createElement('span');span.textContent=`${found.has(word)?'✓ ':'• '}${word}${isPangram(word,puzzle.letters)?' ★':''}`;box.appendChild(span)});box.classList.add('open');$('#revealBtn').textContent='Hide answers'}
async function newRun(){
  setMessage('Building a seven-center run…');finished=false;$('#wordInput').disabled=true;$('#revealBtn').disabled=true;
  try{puzzle=await pickPuzzle('all-seven',previous);previous=puzzle.anchor;centers=shuffled(puzzle.letters);center='';current=0;answers=[];answerSet=new Set();found=new Set();cleared=new Set();stageWords=0;score=0;pangrams=0;$('#wordInput').disabled=false;$('#wordInput').value='';enterCenter()}catch(err){setMessage(err?.message||'Could not load the word board.','bad')}
}

$('#wordForm').addEventListener('submit',e=>{e.preventDefault();submitWord($('#wordInput').value)});
$('#shuffleBtn').addEventListener('click',()=>{if(puzzle)buildWheel()});
$('#clearBtn').addEventListener('click',()=>{$('#wordInput').value='';$('#wordInput').focus()});
$('#newBtn').addEventListener('click',newRun);$('#revealBtn').addEventListener('click',reveal);
$('#wordInput').addEventListener('input',e=>{const next=normalize(e.target.value);if(next!==e.target.value)e.target.value=next});
newRun();
