import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const index=read('./public/index.html');
const router=read('./src/worker-v5.js');
const legacyWorker=read('./src/worker-v3.js');
const shell=read('./public/game-page.js');
const shellCss=read('./public/game-page.css');
const retention=read('./public/retention-hooks.js');
const wrangler=read('./wrangler.jsonc');
const sw=read('./public/sw.js');
const core=read('./public/app-core.js');

const routes={
  letter:'/play/letter-grid/',
  groups:'/play/four-groups/',
  trail:'/play/letter-trail/',
  link:'/play/triple-link/',
  steps:'/play/word-steps/',
  deepcut:'/play/deep-cut/',
  lastcall:'/play/last-call/'
};

for(const [game,path] of Object.entries(routes)){
  assert.ok(index.includes(`data-game-route="${game}"`),`homepage missing route marker for ${game}`);
  assert.ok(index.includes(`href="${path}"`),`homepage missing dedicated href ${path}`);
  assert.ok(router.includes(`${game}:'${path}'`),`worker missing dedicated route for ${game}`);
  assert.ok(retention.includes(`${game}:'${path}'`),`retention CTA missing dedicated route for ${game}`);
}

assert.equal(/class="game-card"[^>]*data-open=/.test(index),false,'homepage game cards must not activate in-document panels');
assert.ok(router.includes('async function dedicatedGamePage'),'dedicated game document generator is missing');
assert.ok(router.includes('<base href="/">'),'dedicated game documents must resolve relative homepage assets from the site root');
assert.ok(router.includes("stripHomepageRuntime(await response.text(),game)"),'play pages must strip homepage runtimes');
for(const runtime of ['word-controls','retention-hooks','presentation-v1','social','competition','homepage-guard','pwa']){
  assert.ok(router.includes(runtime),`dedicated runtime stripping is missing ${runtime}`);
}
assert.ok(router.includes('/app-core.js?v=dedicated-4'),'play pages must load the optimized stable core directly, not app.js score-card wrapper');
assert.ok(router.includes('/game-page.css?v=1')&&router.includes('/game-page.js?v=2'),'play page shell assets are missing');
const typesetter=read('./public/letter-typesetter.js');
const typesetterCss=read('./public/letter-typesetter.css');
assert.ok(typesetter.includes("typesetter-reset")&&typesetter.includes("reset.textContent='↻'"),'production Typesetter must retain the approved test reset control');
assert.equal(index.includes('styles.css">\\n'),false,'homepage must not emit a literal \\n after the base stylesheet');
assert.equal(index.includes('loading="eager"'),false,'hidden production game media must not be eager-loaded from the shared document');
assert.ok(index.includes('steps-rooftops-climber" src="/word-steps-rooftops/pc.webp" alt="" aria-hidden="true" loading="lazy"'),'Word Steps character must stay lazy until its game is opened');
assert.ok(router.includes('function stripUnrelatedGameMedia'),'dedicated documents must strip unrelated game media sources');
assert.ok(router.includes("if(game!=='steps')")&&router.includes("if(game!=='deepcut')"),'dedicated media stripping must cover Rooftops and Deep Cut');
assert.ok(typesetterCss.includes('data:image/webp;base64,'),'production Typesetter must carry its approved artwork in the skin itself');
assert.equal(typesetter.includes("Promise.all(ART.map"),false,'production Typesetter must not block on runtime artwork chunk fetches');
assert.ok(typesetter.includes("const width=length*8.18"),'production Typesetter must retain approved variable proof width');
assert.ok(typesetterCss.includes("#keyboard .key-row")&&typesetterCss.includes("nth-child(1) .key{width:9%}")&&typesetterCss.includes("nth-child(2) .key{width:9.9%}")&&typesetterCss.includes("nth-child(3) .key{width:12%}"),'production Typesetter must retain approved three-row keyboard geometry');
assert.ok(typesetterCss.includes("top:31.05%")&&typesetterCss.includes("top:65.2%")&&typesetterCss.includes("top:76.35%"),'production Typesetter must retain approved proof, keyboard, and action positions');
assert.ok(shell.includes("dataset.gameSession=game"),'dedicated controller must set explicit game session');
assert.equal(shell.includes('setTimeout(ensureActive'),false,'dedicated controller must not poll for an already-parsed panel');
assert.ok(core.includes("const initialGame=document.documentElement.dataset.gamePage||''"),'core must identify the dedicated game before initial rendering');
assert.ok(core.includes('DAILY_CACHE_KEY="clue-morning-daily-cache-v1"'),'daily payload cache is missing');
assert.ok(core.includes('cached?.data?.date===today'),'daily cache must be date validated');
assert.ok(core.includes("signal:controller.signal")&&core.includes('timeoutMs=6000'),'daily loading must have a bounded timeout');
assert.ok(core.includes('for(let attempt=0;attempt<2;attempt++)'),'daily loading must retry once');
assert.ok(core.includes('>Try again</button>'),'load failure must offer a retry action');
assert.ok(core.includes('await revealExistingFailures(initialGame)'),'failure reveals must be scoped to the opened dedicated game');
assert.ok(core.includes("if(initialGame==='letter')renderLetter()")&&core.includes("else if(initialGame==='deepcut')renderDeepCut()"),'dedicated core must render only the selected game at startup');
assert.ok(core.includes("if(visualGameActive('link'))void warmLinkSwitchboard()"),'Switchboard artwork must not warm while hidden');
assert.ok(core.includes("if(visualGameActive('steps'))void warmStepsRooftops()"),'Rooftops artwork must not warm while hidden');
assert.ok(shell.includes("location.assign('/')"),'dedicated games need a direct Morning Run exit');
assert.ok(shellCss.includes('main.app>.panel.active')&&shellCss.includes('#today'),'dedicated CSS must expose only the selected game panel');
assert.ok(!legacyWorker.includes('if(!html.includes("/last-call.js"))'),'homepage must not inject Last Call gameplay');
assert.ok(!legacyWorker.includes('if(!html.includes("/last-call.css"))'),'homepage must not inject Last Call gameplay styles');
assert.ok(wrangler.includes('"/play/*"'),'Cloudflare must run the worker first for dedicated play routes');
assert.equal(sw.includes("'/letter-typesetter.css'"),false,'PWA install must not prefetch the heavy Typesetter skin');
assert.equal(sw.includes("'/word-steps-rooftops/bg-00.b64'"),false,'PWA install must not prefetch Rooftops artwork');
assert.equal(sw.includes("'/deepcut-archive/newsroom.webp'"),false,'PWA install must not prefetch Deep Cut artwork');
assert.ok(sw.includes('cache.put(request, response.clone())'),'game assets must still cache on demand after first use');
assert.ok(Number(sw.match(/clue-morning-pwa-v(\d+)/)?.[1]||0)>=39,'PWA cache must be bumped for route isolation');

console.log('DEDICATED GAME PAGE AUDIT PASSED');
