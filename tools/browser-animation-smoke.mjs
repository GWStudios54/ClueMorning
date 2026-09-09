import fs from 'node:fs';
import http from 'node:http';
import {spawnSync} from 'node:child_process';

const js=fs.readFileSync(new URL('../public/animation-overhaul.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/animation-overhaul.css',import.meta.url),'utf8');

const page=`<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="/animation-overhaul.css"></head>
<body>
<section id="deepcut" class="panel active">
  <div class="panel-head"><h2>Deep Cut</h2></div>
  <div class="stats-row"><div><strong id="deepCutRound">1/8</strong></div><div><strong id="deepCutScore">0</strong></div><div><strong id="deepCutTimer">0:25</strong></div><div><strong id="deepCutStatus">READY</strong></div></div>
  <div id="deepCutPlay"><div class="deepcut-prompt-card"><span>YOUR PROMPT</span><h3 id="deepCutPrompt">Ready?</h3></div><form id="deepCutForm"></form></div>
  <div id="deepCutDone"></div>
  <div id="deepCutMessage" class="message"></div>
  <div id="deepCutHistory" class="deepcut-history"></div>
</section>
<script>
window.addEventListener('error',event=>{document.body.dataset.runtimeError=String(event.message||'error')});
window.addEventListener('unhandledrejection',()=>{document.body.dataset.runtimeError='promise'});
</script>
<script src="/animation-overhaul.js"></script>
<script>
setTimeout(()=>{
  const panel=document.querySelector('#deepcut');
  document.querySelector('#deepCutStatus').textContent='LIVE';
  document.querySelector('#deepCutPrompt').textContent='Name something uncommon.';
  document.querySelector('#deepCutTimer').textContent='0:04';
  const message=document.querySelector('#deepCutMessage');
  message.className='message good';
  message.textContent='RARE: Example — +100';
  const row=document.createElement('div');row.className='deepcut-result';row.textContent='Example';document.querySelector('#deepCutHistory').appendChild(row);
  setTimeout(()=>{
    document.body.dataset.motionInstalled=panel.dataset.motionInstalled||'false';
    document.body.dataset.motionState=panel.dataset.motionState||'';
    document.body.dataset.engine=window.ClueMotion?.engine||'';
    document.body.dataset.externalScripts=String([...document.scripts].filter(s=>s.src&&!s.src.startsWith(location.origin)).length);
  },80);
},80);
</script>
</body></html>`;

const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path==='/animation-overhaul.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(js);return}
  if(path==='/animation-overhaul.css'){res.writeHead(200,{'content-type':'text/css'});res.end(css);return}
  res.writeHead(200,{'content-type':'text/html'});res.end(page);
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
  const result=spawnSync(chromePath(),[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-default-apps','--disable-extensions','--disable-sync','--metrics-recording-only','--mute-audio','--no-first-run','--virtual-time-budget=900','--dump-dom',`http://127.0.0.1:${port}/${path}`
  ],{encoding:'utf8',timeout:20000});
  if(result.status!==0)throw new Error(`Chrome smoke failed: ${result.stderr||result.stdout}`);
  return result.stdout;
}

try{
  const enabled=dump('?motion-preview=deepcut');
  if(!enabled.includes('data-motion-installed="true"'))throw new Error('Preview did not install in Chromium');
  if(!enabled.includes('data-motion-state="live"'))throw new Error('Preview did not react to live state in Chromium');
  if(!enabled.includes('data-engine="waapi"'))throw new Error('Preview did not use WAAPI in Chromium');
  if(!enabled.includes('data-external-scripts="0"'))throw new Error('Preview loaded an external script in Chromium');
  if(enabled.includes('data-runtime-error='))throw new Error('Preview raised a browser runtime error');

  const disabled=dump('');
  if(!disabled.includes('data-motion-installed="false"'))throw new Error('Client preview gate failed when query parameter was absent');
  if(disabled.includes('data-runtime-error='))throw new Error('Disabled preview path raised a browser runtime error');

  console.log('Browser animation smoke passed: Chromium install/state reactions work, no external scripts load, and the client gate stays off by default.');
} finally {
  server.close();
}
