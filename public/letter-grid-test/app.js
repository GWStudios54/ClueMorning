(()=>{
  const ROWS=6,BEST_KEY='clue-letter-grid-test-best';
  const CHALLENGES=[
    {answer:'INKED',valid:['INKED','TRAIN','STONE','CRANE','PRINT','SHINE','PAINT','LEARN']},
    {answer:'TYPE',valid:['TYPE','TIME','TONE','TIRE','TAPE','MATE','PINE','LINE']},
    {answer:'BRIGHT',valid:['BRIGHT','PLANET','STREAM','POCKET','SILVER','MARKET','CANDLE','CASTLE','WINTER','GARDEN','THREAD','LETTER','PRINTS','COFFEE','ORANGE','PURPLE']}
  ];
  const world=document.querySelector('#world'),proof=document.querySelector('#proof'),keyboard=document.querySelector('#keyboard'),toast=document.querySelector('#toast');
  let challenge=0,row=0,current='',done=false,bestScore=Number(localStorage.getItem(BEST_KEY)||0),keyState={};
  const active=()=>CHALLENGES[challenge],cols=()=>active().answer.length;
  Promise.all(Array.from({length:5},(_,i)=>fetch(`./blank-${String(i).padStart(2,'0')}.b64`).then(r=>{if(!r.ok)throw Error(r.status);return r.text()}))).then(parts=>{world.style.backgroundImage=`url(data:image/webp;base64,${parts.join('')})`;world.classList.add('ready')}).catch(()=>document.querySelector('.loading').textContent='PRINT SHOP ART FAILED TO LOAD');
  for(const letters of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){const line=document.createElement('div');line.className='key-row';for(const ch of letters){const b=document.createElement('button');b.className='key';b.textContent=ch;b.dataset.key=ch;b.onclick=()=>type(ch);line.appendChild(b)}keyboard.appendChild(line)}
  function buildProof(){proof.innerHTML='';proof.style.setProperty('--cols',cols());const width=cols()*8.18;proof.style.width=width+'%';proof.style.left=(50-width/2)+'%';for(let i=0;i<ROWS*cols();i++){const c=document.createElement('div');c.className='cell';proof.appendChild(c)}document.querySelector('.stats .stat strong').textContent=cols()}
  function rank(s){return{absent:1,present:2,correct:3}[s]||0}
  function paint(){for(let c=0;c<cols();c++){const cell=proof.children[row*cols()+c];if(!cell)return;cell.textContent=current[c]||'';cell.classList.toggle('filled',!!current[c])}[...keyboard.querySelectorAll('.key')].forEach(k=>{k.className='key'+(keyState[k.dataset.key]?' '+keyState[k.dataset.key]:'')});document.querySelector('#guessStat').textContent=`${row}/6`;document.querySelector('#best').textContent=bestScore||'—';document.querySelector('.press').disabled=current.length!==cols()||done}
  function type(ch){if(done||current.length>=cols())return;current+=ch;paint()}
  function clear(){if(done)return;current=current.slice(0,-1);paint()}
  function feedback(guess){const answer=active().answer,out=Array(cols()).fill('absent'),left={};for(let i=0;i<cols();i++){if(guess[i]===answer[i])out[i]='correct';else left[answer[i]]=(left[answer[i]]||0)+1}for(let i=0;i<cols();i++)if(out[i]!=='correct'&&left[guess[i]]){out[i]='present';left[guess[i]]--}return out}
  function flash(msg,bad=false){toast.textContent=msg;toast.className='toast show'+(bad?' bad':'');clearTimeout(flash.t);flash.t=setTimeout(()=>toast.className='toast',1500)}
  function submit(){if(done||current.length!==cols())return;if(!active().valid.includes(current)){flash(`${current} is not in this test dictionary.`,true);return}const guess=current,result=feedback(guess),usedRow=row;result.forEach((state,i)=>{const cell=proof.children[usedRow*cols()+i];cell.className='cell '+state;const ch=guess[i];if(rank(state)>rank(keyState[ch]))keyState[ch]=state});row++;current='';if(guess===active().answer){done=true;const points=Math.max(100,700-row*100);document.querySelector('#score').textContent=points;bestScore=Math.max(bestScore,points);localStorage.setItem(BEST_KEY,String(bestScore));flash(`PERFECT IMPRESSION — ${points} points.`)}else if(row>=ROWS){done=true;flash(`OUT OF PROOFS — the word was ${active().answer}.`,true)}paint()}
  function reset(){challenge=(challenge+1)%CHALLENGES.length;row=0;current='';done=false;keyState={};document.querySelector('#score').textContent='0';buildProof();paint();flash(`Fresh ${cols()}-letter proof loaded.`)}
  document.querySelector('.clear').onclick=clear;document.querySelector('.press').onclick=submit;document.querySelector('.reset').onclick=reset;document.querySelector('.back').onclick=()=>location.href='/?play=letter';document.addEventListener('keydown',e=>{const k=e.key.toUpperCase();if(/^[A-Z]$/.test(k))type(k);else if(e.key==='Backspace')clear();else if(e.key==='Enter')submit()});buildProof();paint();
})();
