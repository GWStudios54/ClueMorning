import {buildPushPayload} from '@block65/webcrypto-web-push';

const VAPID_SUBJECT='https://cluemorning.com';
const DEFAULT_MORNING='07:00';
const DEFAULT_STREAK='19:00';
const TOKEN_RE=/^[A-Za-z0-9-]{16,96}$/;
const PLAYER_RE=/^[A-Za-z0-9-]{8,64}$/;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const TIME_RE=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
let tablesReady=false;

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

async function requestBody(request){
  try{return await request.clone().json()}catch{return {}}
}

function sameOrigin(request){
  const origin=request.headers.get('origin');
  if(!origin)return false;
  try{
    const url=new URL(origin);
    return origin==='https://cluemorning.com'||url.hostname==='localhost'||url.hostname==='127.0.0.1';
  }catch{return false}
}

function base64url(bytes){
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for(let i=0;i<view.length;i++)binary+=String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function safeToken(value){const v=String(value||'');return TOKEN_RE.test(v)?v:null}
function safePlayer(value){const v=String(value||'');return PLAYER_RE.test(v)?v:null}
function safeDate(value){const v=String(value||'');return DATE_RE.test(v)?v:null}
function safeTime(value,fallback){const v=String(value||'');return TIME_RE.test(v)?v:fallback}
function safeCount(value,max=9999){const n=Number(value);return Number.isInteger(n)&&n>=0&&n<=max?n:0}
function safeTimezone(value){
  const tz=String(value||'').slice(0,80);
  if(!tz)return 'America/Los_Angeles';
  try{new Intl.DateTimeFormat('en-US',{timeZone:tz}).format(new Date());return tz}catch{return 'America/Los_Angeles'}
}

function safeSubscription(value){
  const endpoint=String(value?.endpoint||'');
  const p256dh=String(value?.keys?.p256dh||'');
  const auth=String(value?.keys?.auth||'');
  if(!endpoint.startsWith('https://')||endpoint.length>4096)return null;
  if(!p256dh||p256dh.length>512||!auth||auth.length>256)return null;
  return {endpoint,p256dh,auth};
}

async function ensureTables(env){
  if(!env.DB)return false;
  if(tablesReady)return true;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_config (
    id INTEGER PRIMARY KEY CHECK (id=1),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    device_token TEXT PRIMARY KEY,
    player_id TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    morning_enabled INTEGER NOT NULL DEFAULT 1,
    morning_time TEXT NOT NULL DEFAULT '07:00',
    streak_enabled INTEGER NOT NULL DEFAULT 0,
    streak_time TEXT NOT NULL DEFAULT '19:00',
    last_open_date TEXT,
    progress_date TEXT,
    completed_count INTEGER NOT NULL DEFAULT 0,
    streak_count INTEGER NOT NULL DEFAULT 0,
    last_morning_date TEXT,
    last_streak_date TEXT,
    last_test_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_push_active ON push_subscriptions(morning_enabled,streak_enabled)').run();
  tablesReady=true;
  return true;
}

async function vapidKeys(env){
  if(!await ensureTables(env))return null;
  let row=await env.DB.prepare('SELECT public_key,private_key FROM push_config WHERE id=1').first();
  if(!row){
    const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const rawPublic=await crypto.subtle.exportKey('raw',pair.publicKey);
    const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
    if(!privateJwk?.d)throw new Error('Unable to export the VAPID private key.');
    const publicKey=base64url(rawPublic),privateKey=privateJwk.d;
    await env.DB.prepare('INSERT OR IGNORE INTO push_config(id,public_key,private_key) VALUES(1,?,?)')
      .bind(publicKey,privateKey).run();
    row=await env.DB.prepare('SELECT public_key,private_key FROM push_config WHERE id=1').first();
  }
  return row?{subject:VAPID_SUBJECT,publicKey:row.public_key,privateKey:row.private_key}:null;
}

function localClock(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const get=type=>parts.find(p=>p.type===type)?.value||'';
  return {
    date:`${get('year')}-${get('month')}-${get('day')}`,
    minutes:Number(get('hour'))*60+Number(get('minute'))
  };
}

function previousDate(key){
  const [year,month,day]=key.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day,12));
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}

function targetMinutes(time){
  const [hour,minute]=time.split(':').map(Number);
  return hour*60+minute;
}

function dueAfter(clock,time,maxLateMinutes){
  const diff=clock.minutes-targetMinutes(time);
  return diff>=0&&diff<=maxLateMinutes;
}

async function sendPush(env,row,payload,options={}){
  const vapid=await vapidKeys(env);
  if(!vapid)return {ok:false,status:503};
  const subscription={
    endpoint:row.endpoint,
    expirationTime:null,
    keys:{p256dh:row.p256dh,auth:row.auth}
  };
  try{
    const init=await buildPushPayload({
      data:payload,
      options:{
        ttl:options.ttl||3600,
        urgency:options.urgency||'normal',
        topic:options.topic
      }
    },subscription,vapid);
    const response=await fetch(subscription.endpoint,init);
    if(response.status===404||response.status===410){
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE device_token=?').bind(row.device_token).run();
    }
    return {ok:response.ok,status:response.status};
  }catch(error){
    console.error('Clue Morning push failed',error);
    return {ok:false,status:0};
  }
}

async function config(env){
  if(!env.DB)return json({enabled:false,reason:'Notification storage is not available.'},503);
  try{
    const vapid=await vapidKeys(env);
    return json({
      enabled:!!vapid,
      publicKey:vapid?.publicKey||null,
      defaults:{morningEnabled:true,morningTime:DEFAULT_MORNING,streakEnabled:false,streakTime:DEFAULT_STREAK}
    });
  }catch(error){
    console.error('Push config failed',error);
    return json({enabled:false,reason:'Notifications are not ready yet.'},503);
  }
}

async function subscribe(request,env){
  if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
  if(!await ensureTables(env))return json({error:'Notification storage is unavailable.'},503);
  const b=await requestBody(request),device=safeToken(b.deviceToken),sub=safeSubscription(b.subscription);
  if(!device||!sub)return json({error:'Invalid notification subscription.'},400);
  const player=safePlayer(b.playerId),timezone=safeTimezone(b.timezone);
  const morningEnabled=b.morningEnabled!==false?1:0,streakEnabled=b.streakEnabled===true?1:0;
  const morningTime=safeTime(b.morningTime,DEFAULT_MORNING),streakTime=safeTime(b.streakTime,DEFAULT_STREAK);
  const progressDate=safeDate(b.progressDate),completed=safeCount(b.completedCount,20),streak=safeCount(b.streakCount,10000);
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND device_token<>?').bind(sub.endpoint,device).run();
  await env.DB.prepare(`INSERT INTO push_subscriptions(
      device_token,player_id,endpoint,p256dh,auth,timezone,morning_enabled,morning_time,
      streak_enabled,streak_time,last_open_date,progress_date,completed_count,streak_count,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(device_token) DO UPDATE SET
      player_id=excluded.player_id,endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth,
      timezone=excluded.timezone,morning_enabled=excluded.morning_enabled,morning_time=excluded.morning_time,
      streak_enabled=excluded.streak_enabled,streak_time=excluded.streak_time,last_open_date=excluded.last_open_date,
      progress_date=excluded.progress_date,completed_count=excluded.completed_count,streak_count=excluded.streak_count,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(device,player,sub.endpoint,sub.p256dh,sub.auth,timezone,morningEnabled,morningTime,
      streakEnabled,streakTime,progressDate,progressDate,completed,streak).run();
  return json({ok:true});
}

async function preferences(request,env){
  if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
  if(!await ensureTables(env))return json({error:'Notification storage is unavailable.'},503);
  const b=await requestBody(request),device=safeToken(b.deviceToken);
  if(!device)return json({error:'Invalid notification device.'},400);
  const timezone=safeTimezone(b.timezone);
  const result=await env.DB.prepare(`UPDATE push_subscriptions SET
      timezone=?,morning_enabled=?,morning_time=?,streak_enabled=?,streak_time=?,updated_at=CURRENT_TIMESTAMP
      WHERE device_token=?`)
    .bind(timezone,b.morningEnabled!==false?1:0,safeTime(b.morningTime,DEFAULT_MORNING),
      b.streakEnabled===true?1:0,safeTime(b.streakTime,DEFAULT_STREAK),device).run();
  return json({ok:true,updated:Number(result.meta?.changes||0)>0});
}

async function activity(request,env){
  if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
  if(!await ensureTables(env))return json({error:'Notification storage is unavailable.'},503);
  const b=await requestBody(request),device=safeToken(b.deviceToken),date=safeDate(b.progressDate);
  if(!device||!date)return json({error:'Invalid notification activity.'},400);
  await env.DB.prepare(`UPDATE push_subscriptions SET
      last_open_date=?,progress_date=?,completed_count=?,streak_count=?,timezone=?,updated_at=CURRENT_TIMESTAMP
      WHERE device_token=?`)
    .bind(date,date,safeCount(b.completedCount,20),safeCount(b.streakCount,10000),safeTimezone(b.timezone),device).run();
  return json({ok:true});
}

async function unsubscribe(request,env){
  if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
  if(!await ensureTables(env))return json({error:'Notification storage is unavailable.'},503);
  const b=await requestBody(request),device=safeToken(b.deviceToken);
  if(!device)return json({error:'Invalid notification device.'},400);
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE device_token=?').bind(device).run();
  return json({ok:true});
}

function sqliteTimeMs(value){
  if(!value)return 0;
  return Date.parse(String(value).replace(' ','T')+'Z')||0;
}

async function testPush(request,env){
  if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
  if(!await ensureTables(env))return json({error:'Notification storage is unavailable.'},503);
  const b=await requestBody(request),device=safeToken(b.deviceToken);
  if(!device)return json({error:'Invalid notification device.'},400);
  const row=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE device_token=?').bind(device).first();
  if(!row)return json({error:'This device is not subscribed.'},404);
  if(Date.now()-sqliteTimeMs(row.last_test_at)<30000)return json({error:'Give the test notification a few seconds before sending another.'},429);
  const sent=await sendPush(env,row,{
    title:'☀️ Clue Morning',
    body:'Notifications are working.',
    icon:'/icon-192.png',
    badge:'/icon-192.png',
    tag:'clue-morning-test',
    url:'/'
  },{ttl:60,urgency:'high',topic:'cm-test'});
  if(!sent.ok)return json({error:'The push service did not accept the test notification.',status:sent.status},502);
  await env.DB.prepare('UPDATE push_subscriptions SET last_test_at=CURRENT_TIMESTAMP WHERE device_token=?').bind(device).run();
  return json({ok:true});
}

export async function handlePushRequest(request,env){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/api/push/config')return config(env);
  if(request.method==='POST'&&path==='/api/push/subscribe')return subscribe(request,env);
  if(request.method==='POST'&&path==='/api/push/preferences')return preferences(request,env);
  if(request.method==='POST'&&path==='/api/push/activity')return activity(request,env);
  if(request.method==='POST'&&path==='/api/push/unsubscribe')return unsubscribe(request,env);
  if(request.method==='POST'&&path==='/api/push/test')return testPush(request,env);
  return null;
}

async function sendMorning(env,row,localDate){
  const sent=await sendPush(env,row,{
    title:'☀️ Good morning',
    body:"Today's Clue Morning is ready.",
    icon:'/icon-192.png',
    badge:'/icon-192.png',
    tag:`clue-morning-${localDate}`,
    url:'/'
  },{ttl:21600,urgency:'normal',topic:`morning-${localDate.replaceAll('-','')}`});
  if(sent.ok)await env.DB.prepare('UPDATE push_subscriptions SET last_morning_date=? WHERE device_token=?')
    .bind(localDate,row.device_token).run();
}

async function sendStreak(env,row,localDate){
  const days=Number(row.streak_count||0);
  const sent=await sendPush(env,row,{
    title:`🔥 ${days} day${days===1?'':'s'} strong`,
    body:"Today's set is still waiting for you.",
    icon:'/icon-192.png',
    badge:'/icon-192.png',
    tag:`clue-streak-${localDate}`,
    url:'/'
  },{ttl:7200,urgency:'normal',topic:`streak-${localDate.replaceAll('-','')}`});
  if(sent.ok)await env.DB.prepare('UPDATE push_subscriptions SET last_streak_date=? WHERE device_token=?')
    .bind(localDate,row.device_token).run();
}

export async function runPushSchedule(env,now=new Date()){
  if(!await ensureTables(env))return;
  const query=await env.DB.prepare(`SELECT * FROM push_subscriptions
    WHERE morning_enabled=1 OR streak_enabled=1
    ORDER BY updated_at DESC LIMIT 5000`).all();
  const rows=query.results||[],pacificDate=localClock(now,'America/Los_Angeles').date;
  const jobs=[];
  for(const row of rows){
    const timezone=safeTimezone(row.timezone),clock=localClock(now,timezone),localDate=clock.date;
    const morningDue=Number(row.morning_enabled)===1
      &&row.last_morning_date!==localDate
      &&row.last_open_date!==localDate
      &&pacificDate===localDate
      &&dueAfter(clock,safeTime(row.morning_time,DEFAULT_MORNING),12*60);
    if(morningDue)jobs.push(()=>sendMorning(env,row,localDate));
    const progressCurrent=row.progress_date===localDate;
    const progressYesterday=row.progress_date===previousDate(localDate);
    const completed=progressCurrent?Number(row.completed_count||0):0;
    const streak=Number(row.streak_count||0);
    const activeStreak=streak>0&&(progressCurrent||(progressYesterday&&Number(row.completed_count||0)>=6));
    const streakDue=Number(row.streak_enabled)===1
      &&row.last_streak_date!==localDate
      &&activeStreak
      &&completed<6
      &&dueAfter(clock,safeTime(row.streak_time,DEFAULT_STREAK),90);
    if(streakDue)jobs.push(()=>sendStreak(env,row,localDate));
  }
  for(let i=0;i<jobs.length;i+=10){
    await Promise.all(jobs.slice(i,i+10).map(job=>job()));
  }
}
