import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const hooks=read('public/retention-hooks.js');
const bridge=read('public/performance-bridge.js');
const css=read('public/retention-hooks.css');
const worker=read('src/worker.js');
const sw=read('public/sw.js');
const presentation=read('public/presentation-v1.js');
const app=read('public/app.js');

function assert(condition,message){
  if(!condition)throw new Error(`Retention audit failed: ${message}`);
}

execFileSync(process.execPath,['--check','public/retention-hooks.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','public/performance-bridge.js'],{stdio:'inherit'});

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
assert(hooks.includes("window.addEventListener('clue:statechange'"),'retention UI is not connected to runtime state events');
assert(hooks.includes("CustomEvent('clue:run-progress'"),'retention UI must publish authoritative run progress');
assert(presentation.includes("window.addEventListener('clue:run-progress'"),'homepage presentation must consume authoritative run progress');
assert(presentation.includes("window.addEventListener('clue:statechange'"),'homepage presentation must refresh from runtime state events');
assert(!presentation.includes('new MutationObserver'),'homepage presentation must not watch the whole DOM');
assert(!app.includes('new MutationObserver'),'score-card flow must not watch the whole app DOM');
assert(app.includes("const CORE_SRC = '/app-core.js?v=6'"),'homepage must request the optimized core version');
assert(!hooks.includes('new MutationObserver'),'retention UI must not watch the DOM');
assert(!hooks.includes('setInterval('),'retention UI must not poll continuously');

assert(bridge.includes('NativeMutationObserver'),'performance bridge must preserve targeted native observers');
assert(bridge.includes("target.id==='deepcut'"),'Deep Cut broad observer routing is missing');
assert(bridge.includes("target.classList?.contains('app')"),'app-wide observer routing is missing');
assert(bridge.includes("target===document.body"),'body-wide observer routing is missing');
assert(bridge.includes("Storage.prototype.setItem"),'state-write event bridge is missing');
assert(bridge.includes("CustomEvent('clue:statechange'"),'runtime state event is missing');

for(const selector of ['.retention-run-strip','.morning-report-dialog','.retention-toast']){
  assert(css.includes(selector),`missing style ${selector}`);
}
assert(css.includes('@media(max-width:680px)'),'mobile retention layout is missing');

for(const asset of ['/performance-bridge.js','/retention-hooks.css','/retention-hooks.js']){
  assert(worker.includes(asset),`worker does not inject ${asset}`);
  assert(sw.includes(`'${asset}'`),`service worker does not cache ${asset}`);
}
assert(!worker.includes('daily-run-v2.js'),'worker must not reference the retired duplicate daily-run controller');
const bridgeIndex=worker.indexOf('/performance-bridge.js');
const appIndex=worker.indexOf('app\\.js');
assert(bridgeIndex>=0&&appIndex>=0,'runtime injection markers are missing');
const cacheVersion=Number(sw.match(/const CACHE = 'clue-morning-pwa-v(\d+)'/)?.[1]||0);
assert(cacheVersion>=10,'PWA cache version did not advance for the optimized runtime');

console.log('Retention hooks audit passed: event-driven 7-game run, Morning Report, next-game CTA, optimized observer routing, and PWA caching.');
