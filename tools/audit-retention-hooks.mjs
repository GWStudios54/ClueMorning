import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const hooks=read('public/retention-hooks.js');
const css=read('public/retention-hooks.css');
const worker=read('src/worker-v5.js');
const sw=read('public/sw.js');

function assert(condition,message){
  if(!condition)throw new Error(`Retention audit failed: ${message}`);
}

execFileSync(process.execPath,['--check','public/retention-hooks.js'],{stdio:'inherit'});

for(const game of ['Letter Grid','Four Groups','Letter Trail','Triple Link','Word Steps','Deep Cut','Last Call']){
  assert(hooks.includes(`name:'${game}'`),`missing daily game ${game}`);
}
assert(hooks.includes("const CORE_STORE='clue-morning-state-v2.4'"),'core state store changed unexpectedly');
assert(hooks.includes("const LAST_STORE='clue-morning-last-call-v1'"),'Last Call state store changed unexpectedly');
assert(hooks.includes('MORNING REPORT'),'Morning Report UI is missing');
assert(hooks.includes('Share without spoilers'),'spoiler-free share action is missing');
assert(hooks.includes('NEW PERSONAL BEST'),'personal-best hook is missing');
assert(hooks.includes('SUPER STREAK'),'Super Streak hook is missing');
assert(hooks.includes("$('#dailyScoreMore')"),'per-game completion CTA is not connected');
assert(hooks.includes("window.addEventListener('clue-lastcall-update'"),'Last Call completion event is not connected');
assert(hooks.includes('previousLastCallDone===false&&lastCallDone'),'Last Call toast transition guard is missing');
assert(hooks.includes('shiftDateKey'),'date-only streak math is not hardened');

for(const selector of ['.retention-run-strip','.morning-report-dialog','.retention-toast']){
  assert(css.includes(selector),`missing style ${selector}`);
}
assert(css.includes('@media(max-width:680px)'),'mobile retention layout is missing');

for(const asset of ['/retention-hooks.css','/retention-hooks.js']){
  assert(worker.includes(asset),`worker does not inject ${asset}`);
  assert(sw.includes(`'${asset}'`),`service worker does not cache ${asset}`);
}
const cacheVersion=Number(sw.match(/const CACHE = 'clue-morning-pwa-v(\d+)'/)?.[1]||0);
assert(cacheVersion>=7,'PWA cache version regressed below the retention release baseline');

console.log('Retention hooks audit passed: 7-game run, next-game CTA, Morning Report, personal best, spoiler-free share, Last Call transition, Worker injection, and PWA caching.');
