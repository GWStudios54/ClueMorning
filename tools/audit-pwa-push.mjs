import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pwa=read('public/pwa.js');
const sw=read('public/sw.js');
const worker=read('src/worker.js');
const push=read('src/push.js');
const wrangler=read('wrangler.jsonc');
const schema=read('schema.sql');

const checks=[
  ['PWA registers service worker',pwa.includes("serviceWorker.register('/sw.js'")],
  ['Permission request is user-driven',pwa.includes('Notification.requestPermission()')],
  ['Morning notification settings exist',pwa.includes('Morning Puzzle')&&pwa.includes('pushMorningTime')],
  ['Streak notification settings exist',pwa.includes('Streak Save')&&pwa.includes('pushStreakTime')],
  ['Push progress includes Last Call',pwa.includes("LAST_STATE_KEY='clue-morning-last-call-v1'")&&pwa.includes('lastDays[key]?.done')],
  ['Seven-game completion preserves legacy push sentinel',pwa.includes('rawCompleted>=7?6:Math.min(rawCompleted,5)')],
  ['Push streak copy describes seven-game set',pwa.includes("today's seven-game set is still unfinished")],
  ['Push subscription API exists',push.includes('/api/push/subscribe')],
  ['Push activity suppression API exists',push.includes('/api/push/activity')],
  ['Morning open suppression exists',push.includes('row.last_open_date!==localDate')],
  ['Streak completion suppression exists',push.includes('completed<6')],
  ['Worker has scheduled push handler',worker.includes('runPushSchedule')&&worker.includes('scheduled(')],
  ['Cron trigger is configured',wrangler.includes('*/15 * * * *')],
  ['D1 push subscriptions are declared',schema.includes('CREATE TABLE IF NOT EXISTS push_subscriptions')],
  ['Service worker handles push',sw.includes("addEventListener('push'")],
  ['No hard-coded VAPID private key in browser code',!pwa.includes('privateKey')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){
  console.error(`\n${failed.length} push/PWA audit check(s) failed.`);
  process.exit(1);
}
console.log('\nPush/PWA audit passed.');
