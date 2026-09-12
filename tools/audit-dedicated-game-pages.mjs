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
assert.ok(router.includes('/app-core.js?v=dedicated-1'),'play pages must load the stable core directly, not app.js score-card wrapper');
assert.ok(router.includes('/game-page.css?v=1')&&router.includes('/game-page.js?v=1'),'play page shell assets are missing');
assert.ok(shell.includes("dataset.gameSession=game"),'dedicated controller must set explicit game session');
assert.ok(shell.includes("location.assign('/')"),'dedicated games need a direct Morning Run exit');
assert.ok(shellCss.includes('main.app>.panel.active')&&shellCss.includes('#today'),'dedicated CSS must expose only the selected game panel');
assert.ok(!legacyWorker.includes('if(!html.includes("/last-call.js"))'),'homepage must not inject Last Call gameplay');
assert.ok(!legacyWorker.includes('if(!html.includes("/last-call.css"))'),'homepage must not inject Last Call gameplay styles');
assert.ok(wrangler.includes('"/play/*"'),'Cloudflare must run the worker first for dedicated play routes');
assert.ok(sw.includes("'/game-page.css'")&&sw.includes("'/game-page.js'"),'PWA must cache dedicated shell assets');
assert.ok(Number(sw.match(/clue-morning-pwa-v(\d+)/)?.[1]||0)>=39,'PWA cache must be bumped for route isolation');

console.log('DEDICATED GAME PAGE AUDIT PASSED');
