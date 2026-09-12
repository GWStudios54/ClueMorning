import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const index=read('./public/index.html');
const core=read('./public/app-core.js');
const deepLink=read('./public/deep-link.js');
const homeGuard=read('./public/homepage-guard.js');
const lastCall=read('./public/last-call.js');
const router=read('./src/worker-v5.js');

const productionSkins=[
  'trail-cartographer.css?v=2','trail-cartographer.js?v=2',
  'four-groups-case-file.css?v=2','four-groups-case-file.js?v=2',
  'letter-typesetter.css?v=1','letter-typesetter.js?v=2'
];
for(const asset of productionSkins){
  assert.ok(index.includes(asset),`Shared homepage should load gated skin ${asset}`);
}

assert.ok(core.includes("document.documentElement.dataset.gameSession===id"),
  'Immersive layouts must require an explicit game session');
assert.ok(core.includes("delete document.documentElement.dataset.gameSession"),
  'Returning to Today must destroy the active game session');
assert.ok(core.includes("new MutationObserver(queueImmersivePanelSync)")&&core.includes("attributeFilter:['class']"),
  'Immersive shell must resync when any script changes the active panel');
assert.ok(core.includes("if(session&&activePanel!==session)delete document.documentElement.dataset.gameSession"),
  'Panel reconciliation must discard stale game sessions');
for(const [path,session,bodyClass] of [
  ['./public/four-groups-case-file.js','groups','case-file-active'],
  ['./public/trail-cartographer.js','trail','trail-cartographer-active'],
  ['./public/letter-typesetter.js','letter','letter-typesetter-active']
]){
  const source=read(path);
  assert.ok(source.includes(`dataset.gameSession==='${session}'`),
    `${path} must require the ${session} game session`);
  assert.ok(source.includes(`classList.toggle('${bodyClass}',active)`),
    `${path} should scope its body class to the gated active state`);
}
assert.ok(lastCall.includes("document.documentElement.dataset.gameSession='lastcall'"),
  'Last Call must enter through an explicit game session instead of bouncing through Today');
for(const className of ['link-immersive','steps-immersive','deepcut-immersive']){
  assert.ok(core.includes(`classList.toggle('${className}',shouldBeImmersive)`),
    `${className} must be synchronized from the explicit session gate`);
}

assert.ok(deepLink.includes("addEventListener('hashchange',returnHome)"),
  'Legacy game fragments must be neutralized during same-document navigation');
assert.ok(deepLink.includes("delete document.documentElement.dataset.gameSession")&&deepLink.includes("'letter-typesetter-active'"),
  'Legacy fragment cleanup must destroy the session and clear Typesetter');
assert.ok(homeGuard.includes("delete document.documentElement.dataset.gameSession")&&homeGuard.includes("'letter-typesetter-active'"),
  'Homepage guard must destroy the session and clear every production body shell');
assert.equal(deepLink.includes('openRequested'),false,
  'Legacy fragment client must never reopen a game automatically');
assert.equal(router.includes("target.hash=`play=${play}`"),false,
  'Legacy query routes must not create persistent game fragments');
assert.equal(router.includes("replaceAll('/?play=','/#play=')"),false,
  'Served HTML must not rewrite links into persistent game fragments');

const guidePaths=[
  'letter-grid','four-groups','letter-trail','triple-link','word-steps','deep-cut','last-call'
];
for(const game of guidePaths){
  const html=read(`./public/games/${game}/index.html`);
  assert.equal(/href="\/(?:\?play=|#play=)/.test(html),false,
    `${game} guide must not create a persistent play route`);
}

console.log('GAME ISOLATION AUDIT PASSED');
