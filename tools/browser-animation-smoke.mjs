import fs from 'node:fs';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';

const js=fs.readFileSync(new URL('../src/animation-overhaul.js.txt',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/animation-overhaul.css.txt',import.meta.url),'utf8');
const safeJs=js.replaceAll('</script','<\\/script');
const safeCss=css.replaceAll('</style','<\\/style');

const page=`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--paper:#f7f1e5;--dark:#423a31;--card:#fffdf8;--sun:#d9ad62;--muted:#746d64;--line:#d8cfc2;--danger:#b85d4f;--gold:#c89b4f}
body{margin:0}.app{max-width:900px;margin:auto;padding:10px}.panel{display:none}.panel.active{display:block}.stats-row{height:46px}.deepcut-prompt-card{height:100px}.guess-form{height:40px}
</style><style id="clue-motion-inline-style">${safeCss}</style></head>
<body><main class="app"><header class="masthead">Header</header><nav class="tabs"><button data-tab="deepcut" type="button">Deep Cut</button></nav>
<section id="today" class="panel active">Today</section>
<section id="deepcut" class="panel">
  <div class="panel-head"><h2>Deep Cut</h2></div>
  <div class="stats-row"><strong id="deepCutRound">1/8</strong><strong id="deepCutScore">0</strong><strong id="deepCutTimer">0:25</strong><strong id="deepCutStatus">READY</strong></div>
  <div id="deepCutIntro"><button id="deepCutStart" type="button">Start</button></div>
  <div id="deepCutPlay"><div class="deepcut-prompt-card"><h3 id="deepCutPrompt">Name something uncommon.</h3></div><form id="deepCutForm"><input id="deepCutInput"><button>Submit</button></form></div>
  <div id="deepCutDone"></div><div id="deepCutMessage" class="message"></div><div id="deepCutHistory"></div>
</section></main>
<script>
window.addEventListener('error',event=>{document.body.dataset.runtimeError=String(event.message||'error')});
window.addEventListener('unhandledrejection',event=>{document.body.dataset.runtimeError=String(event.reason||'promise')});
document.querySelector('[data-tab="deepcut"]').addEventListener('click',()=>{document.querySelector('#today').classList.remove('active');document.querySelector('#deepcut').classList.add('active')});
</script>
<script id="clue-motion-inline-script">${safeJs}</script>
<script>
setTimeout(async()=>{
  const panel=document.querySelector('#deepcut');
  document.querySelector('#deepCutStart').click();
  await fetch('/api/deepcut/check',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  setTimeout(()=>{
    window.ClueMotion?.renderer?.stopLoop?.();
    document.body.dataset.motionInstalled=panel.dataset.motionInstalled||'false';
    document.body.dataset.motionState=panel.dataset.motionState||'';
    document.body.dataset.lastMotionEvent=panel.dataset.lastMotionEvent||'';
    document.body.dataset.canvasRendered=panel.dataset.canvasRendered||'false';
    document.body.dataset.engine=window.ClueMotion?.engine||'';
    document.body.dataset.focus=String(document.body.classList.contains('cm-deepcut-focus'));
    document.body.dataset.canvas=String(Boolean(document.querySelector('.cm-deepcut-canvas')));
    document.body.dataset.externalScripts=String([...document.scripts].filter(s=>s.src).length);
    document.body.dataset.inlineStyle=String(Boolean(document.querySelector('#clue-motion-inline-style')));
    document.body.dataset.inlineScript=String(Boolean(document.querySelector('#clue-motion-inline-script')));
    document.body.dataset.smokeSettled='true';
  },650);
},100);
</script></body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/deepcut/check'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({accepted:true,tier:'RARE',canonical:'Example',score:100}));
    return;
  }
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end(page);
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();

function chromePath(){
  for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    const found=spawnSync('which',[bin],{encoding:'utf8'});
    if(found.status===0&&found.stdout.trim())return found.stdout.trim();
  }
  throw new Error('Chromium/Chrome executable not found on CI runner');
}

function dump(path){
  return new Promise((resolve,reject)=>{
    const child=spawn(chromePath(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-default-apps','--disable-extensions','--disable-sync','--disable-background-timer-throttling','--disable-renderer-backgrounding','--metrics-recording-only','--mute-audio','--no-first-run','--window-size=390,844','--virtual-time-budget=2600','--dump-dom',`http://127.0.0.1:${port}/${path}`
    ],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Chrome smoke timed out'))},20000);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{stdout+=chunk});
    child.stderr.on('data',chunk=>{stderr+=chunk});
    child.on('error',error=>{clearTimeout(timer);reject(error)});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0){reject(new Error(`Chrome smoke failed: ${stderr||stdout}`));return}
      resolve(stdout);
    });
  });
}

try{
  const enabled=await dump('?motion-preview=deepcut');
  if(!enabled.includes('data-smoke-settled="true"'))throw new Error('Canvas preview smoke did not reach its checkpoint');
  if(!enabled.includes('data-motion-installed="true"'))throw new Error('Canvas preview did not install in Chromium');
  if(!enabled.includes('data-canvas-rendered="true"'))throw new Error('Canvas preview did not render a real frame in Chromium');
  if(!enabled.includes('data-engine="canvas2d"'))throw new Error('Preview did not use Canvas 2D');
  if(!enabled.includes('data-last-motion-event="correct_rare"'))throw new Error('Rare answer did not drive the renderer directly');
  if(!enabled.includes('data-focus="true"'))throw new Error('Deep Cut preview did not enter focused mode');
  if(!enabled.includes('data-canvas="true"'))throw new Error('Deep Cut canvas element is missing');
  if(!enabled.includes('data-external-scripts="0"'))throw new Error('Preview loaded an external script');
  if(!enabled.includes('data-inline-style="true"')||!enabled.includes('data-inline-script="true"'))throw new Error('Preview did not use inline Worker-bundled payloads');
  if(enabled.includes('data-runtime-error='))throw new Error('Canvas preview raised a browser runtime error');

  const disabled=await dump('');
  if(!disabled.includes('data-motion-installed="false"'))throw new Error('Client preview gate failed when query parameter was absent');
  if(!disabled.includes('data-focus="false"'))throw new Error('Disabled preview unexpectedly entered focus mode');
  if(disabled.includes('data-runtime-error='))throw new Error('Disabled preview path raised a browser runtime error');

  console.log('Browser animation smoke passed: focused Canvas 2D rendered a frame, a real Deep Cut API result drove the rare-answer scene, no external scripts loaded, and the preview gate stayed off by default.');
} finally {
  await new Promise(resolve=>server.close(resolve));
}
