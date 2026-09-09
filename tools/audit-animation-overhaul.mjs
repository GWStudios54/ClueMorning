import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')}
function assert(condition,message){if(!condition)throw new Error(`Animation overhaul audit failed: ${message}`)}

execFileSync(process.execPath,['--check',new URL('../public/animation-overhaul.js',import.meta.url).pathname],{stdio:'inherit'});

const js=read('public/animation-overhaul.js');
const css=read('public/animation-overhaul.css');
const worker=read('src/worker-v5.js');
const sw=read('public/sw.js');
const pkg=JSON.parse(read('package.json'));
const brief=read('docs/DEEP_CUT_RIVE_BRIEF.md');

assert(!/https?:\/\//.test(js),'animation runtime must not fetch or import third-party code');
assert(!js.includes('import('),'animation runtime must not use dynamic imports');
assert(js.includes("const PREVIEW_PARAM = 'motion-preview'"),'client must double-gate the preview by URL parameter');
assert(js.includes("const PREVIEW_VALUE = 'deepcut'"),'Deep Cut must be the only preview target');
assert(js.includes("publicApi.engine = 'waapi'"),'preview must use the browser Web Animations API');
assert(js.includes("typeof el.animate !== 'function'"),'animation must fail open when Web Animations is unavailable');
assert(js.includes("prefers-reduced-motion: reduce"),'JavaScript motion must respect reduced-motion preferences');
assert(js.includes('requestAnimationFrame'),'DOM state synchronization must be coalesced to animation frames');
assert(js.includes("document.visibilityState === 'hidden'"),'hidden tabs must skip animation work');
assert(js.includes("#deepCutStatus")&&js.includes("#deepCutTimer")&&js.includes("#deepCutPrompt")&&js.includes("#deepCutMessage"),'Deep Cut animation must react to gameplay state, timer, prompts, and feedback');
assert(js.includes('correct_common')&&js.includes('correct_uncommon')&&js.includes('correct_rare'),'Deep Cut must preserve tier-aware positive reactions');
assert(js.includes('registerRive')&&js.includes('stateMachineInputs'),'Rive bridge must remain available without loading a runtime');
assert(js.includes('animation preview disabled after a safe failure'),'boot failure must leave the game usable');

assert(css.includes('.cm-deepcut-page'),'Deep Cut must have a dedicated animated-page visual system');
assert(css.includes('.cm-is-urgent #deepCutTimer'),'final-five-second urgency treatment must exist');
assert(css.includes('.cm-flash-rare'),'rarity-tier feedback styling must exist');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'CSS animation must respect reduced-motion preferences');
assert(css.includes('.cm-rive-layer'),'future Rive canvas layer must remain independent of HTML gameplay');
assert(css.includes('contain:paint'),'ambient layer must contain paint work');
assert(css.includes('.cm-scene-paper-b,.cm-scene-pencil,.cm-steam-b,.cm-steam-c,.cm-scene-ring{display:none}'),'mobile preview must shed nonessential ambient animation');
assert(css.includes('animation-play-state:paused'),'inactive Deep Cut panels must pause ambient loops');

assert(worker.includes("url.searchParams.get('motion-preview')==='deepcut'"),'worker must gate preview injection by explicit Deep Cut query parameter');
assert(worker.includes('/animation-overhaul.css?v=2'),'preview CSS must use a versioned asset');
assert(worker.includes('/animation-overhaul.js?v=2'),'preview JS must use a versioned asset');
assert(worker.includes("headers.set('cache-control','no-store')"),'preview HTML must not be cached into the normal homepage path');
assert(worker.includes("headers.set('x-clue-motion-preview','deepcut')"),'preview response must expose a smoke-test marker');

const cacheVersion=Number(sw.match(/const CACHE = 'clue-morning-pwa-v(\d+)'/)?.[1]||0);
assert(cacheVersion>=9,'service-worker cache must advance beyond the failed animation rollout');
assert(!sw.includes("'/animation-overhaul.css'")&&!sw.includes("'/animation-overhaul.js'"),'normal PWA app shell must not preload preview animation assets');
assert(sw.includes("url.searchParams.has('motion-preview')"),'service worker must recognize preview requests');
assert(sw.includes('response.ok && !previewRequest'),'service worker must not cache preview responses');
assert(pkg.scripts?.test?.includes('node tools/audit-animation-overhaul.mjs'),'full regression suite must gate the animation preview');
assert(pkg.scripts?.['audit:animation']==='node tools/audit-animation-overhaul.mjs','animation audit script must be directly runnable');

for(const input of ['Start','Prompt','CorrectCommon','CorrectUncommon','CorrectRare','Wrong','Urgent','Complete']){
  assert(brief.includes(`\`${input}\``),`Rive production brief must define ${input}`);
}
assert(brief.includes("state machine name: `DeepCut`")||brief.includes("State machine name: `DeepCut`"),'Rive production brief must lock the DeepCut state-machine name');

console.log('Animation preview audit passed: dependency-free WAAPI, explicit preview gate, fail-open boot, mobile load shedding, no PWA preload/cache, and inert Rive bridge.');
