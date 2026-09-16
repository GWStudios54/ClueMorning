import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')}
function assert(condition,message){if(!condition)throw new Error(`Owner-admin audit failed: ${message}`)}

const worker=read('src/worker.js');
const ui=read('public/founders-ui.js');
const pkg=JSON.parse(read('package.json'));

assert(worker.includes("const OWNER_ADMIN_COOKIE='cm_owner_admin'"),'owner admin must use a dedicated cookie');
assert(/const OWNER_ADMIN_HASH='[a-f0-9]{64}'/.test(worker),'only a SHA-256 owner-admin credential hash should be committed');
assert(!worker.includes('CMA-A-32BC9C89F07D7E7A182F7A46'),'plaintext owner-admin credential must never be committed');
assert(worker.includes('HttpOnly; Secure; SameSite=Strict'),'owner-admin cookie must be HttpOnly, Secure, and SameSite=Strict');
assert(worker.includes("path==='/api/admin/claim'")&&worker.includes("path==='/api/admin/status'")&&worker.includes("path==='/api/admin/deepcut/reset'"),'owner-admin API must expose claim, status, and Deep Cut reset only');
assert(worker.includes("if(!await ownerAdminActive(request))return json({ok:false,error:'Owner-admin access is required.'},403)"),'Deep Cut reset must require the owner-admin cookie');
assert(worker.includes("DELETE FROM leaderboard_game_scores WHERE date=? AND game='deepcut' AND player_id=?"),'server reset must target only today’s Deep Cut game score for the requested player');
assert(worker.includes('deepcut_score=0'),'legacy leaderboard Deep Cut score must be cleared without touching other game columns');
assert(worker.includes("const date=pacificDateKey()"),'admin reset must be locked to the current Pacific daily date');
assert(!worker.includes('DELETE FROM leaderboard_game_scores WHERE date=? AND player_id=?'),'reset must never delete every game for the player');

assert(ui.includes("if(!ownerAdmin)return"),'client reset control must remain unavailable without owner-admin status');
assert(ui.includes("/api/admin/deepcut/reset"),'client must use the isolated owner-admin Deep Cut endpoint');
assert(ui.includes("delete store.days[daily.date].deepcut"),'client reset must clear only the local Deep Cut state');
assert(ui.includes("delete store.days[daily.date].leaderboardPost"),'client must clear the aggregate post sentinel so a replay can repost correctly');
assert(!ui.includes('delete store.days[daily.date].letter')&&!ui.includes('delete store.days[daily.date].groups')&&!ui.includes('delete store.days[daily.date].trail'),'admin reset must not clear other daily games');
assert(ui.includes("new URL(location.href).searchParams.get('admin')==='owner'"),'owner-admin activation UI must be hidden behind the explicit owner route');
assert(ui.includes("type=\"password\""),'owner-admin code entry must use a password field');

assert(pkg.scripts?.test?.includes('node tools/audit-owner-admin.mjs'),'Cloudflare-safe npm test must include the owner-admin isolation audit');
assert(pkg.scripts?.['audit:admin']==='node tools/audit-owner-admin.mjs','owner-admin audit must be directly runnable');

console.log('Owner-admin audit passed: secure owner cookie, current-day/player-only Deep Cut reset, and isolated local state clearing.');
