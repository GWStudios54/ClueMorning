import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const worker=read('src/worker-v4.js');
const leaders=read('public/leaderboards-v2.js');
const presentation=read('public/presentation-v1.js');
const social=read('public/social.js');
const tileHtml=read('public/games/tileworks/index.html');
const tileSituation=read('public/games/tileworks/tileworks-situation.js');
const dailyRun=read('public/daily-run-v2.js');

const checks=[
  ['worker reports seven daily games',worker.includes('data.dailyGames=7')],
  ['Situation is exposed to Tileworks',worker.includes('data.tileworksSituation=data.situation')],
  ['standalone Situation leaderboard is retired',worker.includes("board==='situation'")&&worker.includes('Tileworks mode')],
  ['Today leaderboard unions per-game scores',worker.includes("SELECT player_id FROM leaderboard_game_scores WHERE date=?")],
  ['leaderboard client has no Situation board',!leaders.includes("['situation','Situation']")],
  ['leaderboard client does not post Situation',!leaders.includes("submitDaily('situation'")],
  ['daily presentation is seven games',presentation.includes('0 of 7 complete')&&presentation.includes('all seven')&&!presentation.includes("['situation','Situation']")],
  ['Morning Report is seven games',social.includes('const DAILY_COUNT=7')&&!social.includes("id:'situation'")],
  ['daily run controller uses seven-game super streak',dailyRun.includes('data-run-at="7"')],
  ['Tileworks exposes Full Match and Situation modes',tileHtml.includes('data-tileworks-mode="match"')&&tileHtml.includes('data-tileworks-mode="situation"')],
  ['Tileworks loads Situation implementation',tileHtml.includes('/games/tileworks/tileworks-situation.js')],
  ['Situation preserves three-move rules',tileSituation.includes("maxMoves||3")&&tileSituation.includes('Your rack will not refill.')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){
  console.error(`\n${failed.length} Situation/leaderboard regression check(s) failed.`);
  process.exit(1);
}
console.log(`\nSituation fold + leaderboard audit passed (${checks.length} checks).`);
