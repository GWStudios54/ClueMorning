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

assert(js.includes('motion@13.1.1/+esm'),'Motion runtime must be pinned to the reviewed production version');
assert(js.includes('@rive-app/canvas@2.42.0'),'Rive runtime bridge must be pinned');
assert(js.includes("prefers-reduced-motion: reduce"),'JavaScript motion must respect reduced-motion preferences');
assert(js.includes("#deepCutStatus")&&js.includes("#deepCutTimer")&&js.includes("#deepCutPrompt")&&js.includes("#deepCutMessage"),'Deep Cut animation must react to gameplay state, timer, prompts, and feedback');
assert(js.includes('correct_common')&&js.includes('correct_uncommon')&&js.includes('correct_rare'),'Deep Cut must expose tier-aware positive Rive reactions');
assert(js.includes('registerRive')&&js.includes('stateMachineInputs'),'Rive bridge must expose registration and state-machine triggers');
assert(js.includes('Rive asset could not load; keeping the native motion fallback'),'Rive failure must preserve the native fallback');

assert(css.includes('.cm-deepcut-page'),'Deep Cut must have a dedicated animated-page visual system');
assert(css.includes('.cm-is-urgent #deepCutTimer'),'final-five-second urgency treatment must exist');
assert(css.includes('.cm-flash-rare'),'rarity-tier feedback styling must exist');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'CSS animation must respect reduced-motion preferences');
assert(css.includes('.cm-rive-layer'),'Rive canvas layer must be styled independently of HTML gameplay');

assert(worker.includes('/animation-overhaul.css?v=1'),'worker must inject animation CSS on the app shell');
assert(worker.includes('/animation-overhaul.js?v=1'),'worker must inject animation JS on the app shell');
assert(sw.includes("clue-morning-pwa-v8"),'service-worker cache must be bumped for the animation release');
assert(sw.includes("'/animation-overhaul.css'")&&sw.includes("'/animation-overhaul.js'"),'animation assets must be cached in the PWA shell');
assert(pkg.scripts?.test?.includes('node tools/audit-animation-overhaul.mjs'),'full regression suite must gate the animation overhaul');
assert(pkg.scripts?.['audit:animation']==='node tools/audit-animation-overhaul.mjs','animation audit script must be directly runnable');

for(const input of ['Start','Prompt','CorrectCommon','CorrectUncommon','CorrectRare','Wrong','Urgent','Complete']){
  assert(brief.includes(`\`${input}\``),`Rive production brief must define ${input}`);
}
assert(brief.includes("state machine name: `DeepCut`")||brief.includes("State machine name: `DeepCut`"),'Rive production brief must lock the DeepCut state-machine name');

console.log('Animation overhaul audit passed.');
