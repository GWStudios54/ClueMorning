import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const ui=read('public/competition.js');
const worker=read('src/worker-v5.js');
const sw=read('public/sw.js');
function assert(condition,message){if(!condition)throw new Error(`Competition audit failed: ${message}`)}

execFileSync(process.execPath,['--check','public/competition.js'],{stdio:'inherit'});

assert(ui.includes("/api/leaderboard/compare"),'comparison API is not called');
assert(ui.includes("View overall leaderboard"),'overall leaderboard CTA is missing');
assert(ui.includes("View ${GAMES[game]?.name||'game'} leaderboard"),'game leaderboard CTA is missing');
assert(ui.includes('beatPercent'),'beat-percent feedback is missing');
assert(ui.includes('#dailyScoreDialog'),'per-game score card is not wired');
assert(ui.includes('#morningReportDialog'),'Morning Report comparison is not wired');
assert(!ui.includes('MutationObserver'),'competition UI must remain event-driven');
assert(!ui.includes('setInterval('),'competition UI must not poll');

assert(worker.includes("path==='/api/leaderboard/compare'"),'worker comparison route is missing');
assert(worker.includes('DAILY_COMPARE_COLUMNS'),'daily-game comparison mapping is missing');
assert(worker.includes('beatPercent'),'worker comparison percentile is missing');
assert(worker.includes('/competition.js?v=1'),'worker does not inject competition UI');
assert(worker.includes("board==='today'"),'overall daily comparison is missing');
assert(sw.includes("'/competition.js'"),'service worker does not cache competition UI');
const cacheVersion=Number(sw.match(/const CACHE = 'clue-morning-pwa-v(\d+)'/)?.[1]||0);
assert(cacheVersion>=11,'PWA cache version was not bumped for competition release');

console.log('Competition audit passed: per-game rank, beat percentage, overall Morning Report comparison, leaderboard CTAs, and event-driven runtime.');
