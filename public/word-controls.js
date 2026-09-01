const WORD_CONTROL_KEY='clue-morning-word-control-v1';
const VALID=new Set(['tap','swipe']);

export function getWordControlMode(){
  try{const saved=localStorage.getItem(WORD_CONTROL_KEY);return VALID.has(saved)?saved:'tap'}catch{return'tap'}
}
export function setWordControlMode(mode){
  const next=VALID.has(mode)?mode:'tap';
  try{localStorage.setItem(WORD_CONTROL_KEY,next)}catch{}
  syncUi(next);
  window.dispatchEvent(new CustomEvent('clue-word-control-change',{detail:{mode:next}}));
  return next;
}

function injectStyle(){
  if(document.querySelector('#wordControlStyles'))return;
  const style=document.createElement('style');style.id='wordControlStyles';style.textContent=`
    .word-control-setting{display:flex;align-items:center;justify-content:center;gap:10px;margin:10px 0 14px;font:inherit}
    .word-control-setting>span{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:var(--muted,#777168)}
    .word-control-toggle{display:inline-grid;grid-template-columns:1fr 1fr;padding:3px;border:1px solid var(--line,#cfc6b8);border-radius:999px;background:rgba(255,255,255,.42);box-shadow:inset 0 1px rgba(255,255,255,.6)}
    .word-control-toggle button{min-width:74px;height:34px;padding:0 14px;border:0;border-radius:999px;background:transparent;color:var(--muted,#777168);font:inherit;font-size:.76rem;font-weight:900;letter-spacing:.04em;cursor:pointer}
    .word-control-toggle button.active{background:var(--ink,#1d1c1a);color:#fff;box-shadow:0 2px 7px rgba(0,0,0,.14)}
    .word-control-toggle button:focus-visible{outline:3px solid color-mix(in srgb,var(--accent,#e9aa38) 45%,transparent);outline-offset:2px}
    html[data-word-control="swipe"] .tap-actions{display:none!important}
    @media(max-width:420px){.word-control-setting{gap:7px}.word-control-toggle button{min-width:66px;padding:0 11px}}
  `;document.head.appendChild(style)
}

function toggleMarkup(scope){
  const wrap=document.createElement('div');wrap.className='word-control-setting';wrap.dataset.wordControlSetting=scope;
  wrap.innerHTML='<span>Controls</span><div class="word-control-toggle" role="group" aria-label="Word input controls"><button type="button" data-word-control-choice="tap">Tap</button><button type="button" data-word-control-choice="swipe">Swipe</button></div>';
  wrap.addEventListener('click',e=>{const button=e.target.closest('[data-word-control-choice]');if(button)setWordControlMode(button.dataset.wordControlChoice)});
  return wrap;
}

function mount(){
  injectStyle();
  const trail=document.querySelector('#trail');
  if(trail&&!trail.querySelector('[data-word-control-setting="trail"]')){
    const control=toggleMarkup('trail'),intro=trail.querySelector('#trailIntro');
    if(intro)intro.before(control);else trail.appendChild(control);
    installTrailGate();
  }
  const wheel=document.querySelector('#letterWheel'),readout=document.querySelector('#dragWord');
  if(wheel&&readout&&!document.querySelector('[data-word-control-setting="pangram"]')){
    const control=toggleMarkup('pangram');readout.before(control);
  }
  syncUi(getWordControlMode());
}

function syncUi(mode=getWordControlMode()){
  document.documentElement.dataset.wordControl=mode;
  document.querySelectorAll('[data-word-control-choice]').forEach(button=>{
    const selected=button.dataset.wordControlChoice===mode;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
  const readout=document.querySelector('#dragWord');
  if(readout&&!readout.classList.contains('active'))readout.textContent=mode==='tap'?'TAP TO SPELL':'SWIPE TO SPELL';
  const hint=document.querySelector('.drag-hint');
  if(hint)hint.textContent=mode==='tap'?'Tap letters, then Submit · letters may be reused':'Swipe through letters · release to submit · letters may be reused';
  const trailCurrent=document.querySelector('#trailCurrent');
  if(trailCurrent&&!trailCurrent.textContent.trim())trailCurrent.textContent=mode==='tap'?'Tap letters to spell':'Swipe across letters';
}

let trailGateInstalled=false;
function installTrailGate(){
  if(trailGateInstalled)return;const grid=document.querySelector('#trailGrid');if(!grid)return;trailGateInstalled=true;
  let startX=0,startY=0,pointerId=null,moved=false;
  grid.addEventListener('pointerdown',e=>{pointerId=e.pointerId;startX=e.clientX;startY=e.clientY;moved=false},{capture:true});
  grid.addEventListener('pointermove',e=>{
    if(pointerId!==e.pointerId)return;
    if(getWordControlMode()==='tap'){e.stopImmediatePropagation();return}
    if(Math.hypot(e.clientX-startX,e.clientY-startY)>=9)moved=true;
  },{capture:true});
  grid.addEventListener('pointerup',e=>{
    if(pointerId!==e.pointerId)return;const wasMoved=moved,mode=getWordControlMode();pointerId=null;moved=false;
    if(mode==='swipe'&&!wasMoved)setTimeout(()=>document.querySelector('#trailClear')?.click(),0);
  },{capture:true});
  grid.addEventListener('pointercancel',()=>{pointerId=null;moved=false},{capture:true});
  window.addEventListener('clue-word-control-change',()=>{document.querySelector('#trailClear')?.click();syncUi()});
}

window.ClueWordControls={getMode:getWordControlMode,setMode:setWordControlMode};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
