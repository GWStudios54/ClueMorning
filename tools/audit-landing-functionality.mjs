import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const index=read('public/index.html');
const retention=read('public/retention-hooks.js');
const presentation=read('public/presentation-v1.js');
const alignment=read('public/control-alignment.css');
const sw=read('public/sw.js');
const router=read('src/worker.js');
const standalone=['public/games/all-seven/index.html','public/games/pangram/index.html','public/games/tileworks/index.html'].map(read);

const games={
  letter:['#letterCardStatus','/play/letter-grid/'],
  groups:['#groupCardStatus','/play/four-groups/'],
  trail:['#trailCardStatus','/play/letter-trail/'],
  link:['#linkCardStatus','/play/triple-link/'],
  steps:['#stepsCardStatus','/play/word-steps/'],
  deepcut:['#deepCutCardStatus','/play/deep-cut/'],
  lastcall:['#lastCallCardStatus','/play/last-call/']
};
for(const [id,[status,route]] of Object.entries(games)){
  assert.ok(retention.includes(`${id}:{status:'${status}'`),`missing authoritative card state for ${id}`);
  assert.ok(index.includes(`data-game-route="${id}"`),`missing landing card for ${id}`);
  assert.ok(index.includes(`href="${route}"`),`missing landing route for ${id}`);
  assert.ok(router.includes(`${id}:'${route}'`),`missing worker route for ${id}`);
}
assert.ok(retention.includes('syncLandingCards(m)'), 'landing card state is not synchronized');
assert.ok(retention.includes("closest?.('#streakCard')")&&retention.includes('openArchive()'),'streak button is not connected to Archive');
assert.ok(retention.includes('View archive · ${m.streak} day streak'),'streak button does not publish an accessible live label');
assert.ok(retention.includes("row.done?'DONE':'PLAY'"), 'card status labels are not state-driven');
assert.ok(presentation.includes('function revealTab(tab,smooth)'), 'mobile navigation reveal is missing');
assert.ok(presentation.includes("nav.addEventListener('click'"), 'navigation reveal is not bound');
assert.ok(alignment.includes('align-items:center')&&alignment.includes('justify-content:center')&&alignment.includes('text-align:center'),'shared control alignment is incomplete');
assert.ok(index.includes('/control-alignment.css?v=1'),'shared alignment stylesheet is not loaded');
for(const page of standalone)assert.ok(page.includes('/control-alignment.css?v=1'),'standalone game is missing shared control alignment');
assert.ok(sw.includes("'/control-alignment.css'"),'shared alignment stylesheet is not cached');
assert.equal(sw.includes('?shell='),false,'service worker activation must not redirect or reset an active page');
assert.ok(sw.includes("clue-morning-pwa-v57"),'PWA cache version was not advanced');
console.log('Landing functionality audit passed: seven-game state, routes, navigation reveal, control alignment, and non-disruptive PWA activation.');
