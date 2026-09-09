import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')}
function assert(condition,message){if(!condition)throw new Error(`Animation overhaul audit failed: ${message}`)}

const js=read('src/animation-overhaul.js.txt');
const css=read('src/animation-overhaul.css.txt');
const worker=read('src/worker-v5.js');
const sw=read('public/sw.js');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/site-regression.yml');

assert(!/https?:\/\//.test(js),'animation runtime must not fetch or import third-party code');
assert(!js.includes('import('),'animation runtime must not use dynamic imports');
assert(js.includes("const PREVIEW_PARAM = 'motion-preview'"),'client must gate the preview by URL parameter');
assert(js.includes("const PREVIEW_VALUE = 'deepcut'"),'Deep Cut must remain the only preview target');
assert(js.includes("publicApi.engine = 'canvas2d'"),'preview must identify Canvas 2D as its rendering engine');
assert(js.includes("getContext?.('2d'")||js.includes("getContext('2d'"),'preview must create a Canvas 2D renderer');
assert(js.includes('requestAnimationFrame'),'renderer must use requestAnimationFrame');
assert(js.includes("document.visibilityState === 'hidden'"),'renderer must stop work for hidden tabs');
assert(js.includes('dprCap = mobile ? 1.35 : 1.75'),'renderer must cap device pixel ratio on mobile and desktop');
assert(js.includes('state.quality = avg > 24 ? .58 : 1'),'renderer must shed particle quality when frame time degrades');
assert(js.includes("startButton?.addEventListener('click'"),'Deep Cut start must drive the renderer directly');
assert(js.includes("form.addEventListener('submit'"),'Deep Cut submissions must drive renderer state directly');
assert(js.includes("path === '/api/deepcut/check'")&&js.includes("path === '/api/unlimited/deepcut/check'"),'renderer must recognize both daily and unlimited Deep Cut checks');
for(const eventName of ['wrong','correct_common','correct_uncommon','correct_rare','timeout','urgent','complete']){
  assert(js.includes(`'${eventName}'`)||js.includes('correct_${safeTier}'),`renderer must support ${eventName}`);
}
assert(!js.includes('MutationObserver'),'preview must not infer game state through MutationObserver');
assert(!js.includes('stateMachineInputs')&&!js.includes('registerRive'),'preview must not carry the unused Rive bridge');
assert(!js.includes('offsetWidth'),'preview must not force synchronous layout to restart animations');
const rectReads=(js.match(/getBoundingClientRect/g)||[]).length;
assert(rectReads<=1,'layout reads must be limited to stage resize, not answer effects');
assert(js.includes('canvas.dataset.rendered'),'browser smoke must be able to prove a real canvas frame rendered');
assert(js.includes("document.body.classList.add('cm-deepcut-focus')"),'preview must enter a focused Deep Cut scene');
assert(js.includes('Clue Morning canvas preview disabled after a safe failure.'),'boot failures must leave the base game usable');

assert(css.includes('.cm-deepcut-stage'),'Deep Cut must have a dedicated canvas stage');
assert(css.includes('.cm-deepcut-canvas'),'canvas must own the animated scene');
assert(css.includes('body.cm-deepcut-focus'),'preview must isolate the Deep Cut experience from the rest of the portal');
assert(css.includes('contain:strict')||css.includes('contain:layout paint style'),'preview must contain canvas/layout work');
assert(css.includes('.cm-canvas-urgent'),'final-five-second urgency styling must exist');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'reduced-motion styling must exist');
assert(!css.includes('@keyframes'),'scene animation must not fall back to CSS keyframe loops');
assert(!css.includes('.cm-rive-layer'),'obsolete Rive layer must be removed');
assert(!css.includes('backdrop-filter:blur'),'preview must avoid blur-heavy compositing');

assert(worker.includes("import animationCssSource from './animation-overhaul.css.txt'"),'Worker must bundle animation CSS as a text module');
assert(worker.includes("import animationJsSource from './animation-overhaul.js.txt'"),'Worker must bundle animation JS as a text module');
assert(worker.includes('clue-motion-inline-style')&&worker.includes('clue-motion-inline-script'),'preview must inject bundled style and script inline');
assert(!worker.includes('/animation-overhaul.css?v=')&&!worker.includes('/animation-overhaul.js?v='),'Worker must not request standalone animation assets');
assert(worker.includes("url.searchParams.get('motion-preview')==='deepcut'"),'Worker must gate preview injection by explicit Deep Cut query parameter');
assert(worker.includes("headers.set('cache-control','no-store')"),'preview HTML must not be cached into the normal homepage path');
assert(worker.includes("headers.set('x-clue-motion-preview','deepcut-inline')"),'preview response must expose a production smoke marker');

const cacheVersion=Number(sw.match(/const CACHE = 'clue-morning-pwa-v(\d+)'/)?.[1]||0);
assert(cacheVersion>=9,'service-worker cache must remain beyond the failed animation rollout');
assert(!sw.includes("'/animation-overhaul.css'")&&!sw.includes("'/animation-overhaul.js'"),'normal PWA app shell must not preload obsolete standalone animation assets');
assert(sw.includes("url.searchParams.has('motion-preview')"),'service worker must recognize preview requests');
assert(sw.includes('response.ok && !previewRequest'),'service worker must not cache preview responses');
assert(pkg.scripts?.test?.includes('node tools/audit-animation-overhaul.mjs'),'Cloudflare npm test must retain static animation architecture validation');
assert(!pkg.scripts?.test?.includes('browser-animation-smoke.mjs'),'Cloudflare npm test must never require a Chrome binary');
assert(pkg.scripts?.['audit:animation:browser']==='node tools/browser-animation-smoke.mjs','browser smoke must remain directly runnable');
assert(workflow.includes('npm run audit:animation:browser'),'GitHub Actions must run the real-browser smoke separately');
assert(workflow.includes('wrangler deploy --dry-run'),'GitHub Actions must still verify the Worker bundle');

console.log('Animation preview audit passed: focused Canvas 2D scene, direct Deep Cut events, adaptive mobile rendering, no DOM observers/keyframe scene loops, inline Worker bundle, and Cloudflare-safe tests.');
