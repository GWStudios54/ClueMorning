import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const index=read('./public/index.html');
const core=read('./public/app-core.js');
const deepLink=read('./public/deep-link.js');
const router=read('./src/worker-v5.js');

const productionSkins=[
  'trail-cartographer.css','trail-cartographer.js',
  'four-groups-case-file.css','four-groups-case-file.js'
];
for(const asset of productionSkins){
  assert.equal(index.includes(asset),false,`Shared homepage must not load ${asset}`);
}

for(const className of ['link-immersive','steps-immersive','deepcut-immersive']){
  assert.equal(
    core.includes(`classList.toggle('${className}'`)||core.includes(`classList.add('${className}'`),
    false,
    `Shared game runtime must not activate global class ${className}`
  );
}
for(const className of ['case-file-active','trail-cartographer-active']){
  assert.equal(
    core.includes(`classList.toggle('${className}'`)||core.includes(`classList.add('${className}'`),
    false,
    `Shared game runtime must not activate global class ${className}`
  );
}

assert.ok(core.includes("classList.remove('link-immersive','deepcut-immersive','steps-immersive')"),
  'Core must defensively clear legacy immersive html classes');
assert.ok(deepLink.includes("addEventListener('hashchange',returnHome)"),
  'Legacy game fragments must be neutralized during same-document navigation');
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
