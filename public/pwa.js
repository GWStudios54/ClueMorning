// Clue Morning PWA bootstrap + notification settings.
(() => {
  const PREFS_KEY='clue-morning-push-prefs-v1';
  const DEVICE_KEY='clue-morning-push-device-v1';
  const PLAYER_KEY='clue-morning-player-id';
  const STATE_KEY='clue-morning-state-v2.4';
  const DAILY_GAMES=['letter','groups','trail','link','steps','deepcut'];
  const DEFAULTS={
    morningEnabled:true,
    morningTime:'07:00',
    streakEnabled:false,
    streakTime:'19:00',
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Los_Angeles'
  };
  let registration=null,dialog=null,config=null,syncTimer=null;

  function loadPrefs(){
    try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')}}catch{return {...DEFAULTS}}
  }
  function savePrefs(prefs){
    localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
    return prefs;
  }
  function deviceToken(){
    let token=localStorage.getItem(DEVICE_KEY);
    if(!token){
      token=crypto.randomUUID?crypto.randomUUID():`push-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_KEY,token);
    }
    return token;
  }
  function playerId(){return localStorage.getItem(PLAYER_KEY)||null}
  function supportsPush(){return 'PushManager' in window&&'Notification' in window&&'serviceWorker' in navigator}
  function isIos(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
  function isStandalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
  function dateKey(timeZone,date=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function previousDate(key){
    const [y,m,d]=key.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d,12));
    date.setUTCDate(date.getUTCDate()-1);
    return date.toISOString().slice(0,10);
  }
  function progressSnapshot(){
    const prefs=loadPrefs(),date=dateKey(prefs.timezone);
    let state={};
    try{state=JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{}
    const days=state.days||{},today=days[date]||{};
    const complete=key=>DAILY_GAMES.every(game=>days[key]?.[game]?.done);
    const completedCount=DAILY_GAMES.filter(game=>today?.[game]?.done).length;
    let cursor=date,streakCount=0;
    if(!complete(cursor))cursor=previousDate(cursor);
    for(let i=0;i<370&&complete(cursor);i++){
      streakCount++;
      cursor=previousDate(cursor);
    }
    return {progressDate:date,completedCount,streakCount};
  }
  function base64ToBytes(value){
    const padding='='.repeat((4-value.length%4)%4);
    const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  }
  async function api(path,body){
    const response=await fetch(path,body===undefined?{}:{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||data.reason||'Request failed.');
    return data;
  }
  async function getConfig(){
    if(config)return config;
    config=await api('/api/push/config');
    return config;
  }
  async function currentSubscription(){
    if(!registration)return null;
    try{return await registration.pushManager.getSubscription()}catch{return null}
  }
  function prefsPayload(){
    const prefs=loadPrefs();
    return {
      deviceToken:deviceToken(),
      playerId:playerId(),
      timezone:prefs.timezone,
      morningEnabled:!!prefs.morningEnabled,
      morningTime:prefs.morningTime,
      streakEnabled:!!prefs.streakEnabled,
      streakTime:prefs.streakTime,
      ...progressSnapshot()
    };
  }
  async function syncActivity(){
    const sub=await currentSubscription();
    if(!sub)return;
    try{await api('/api/push/activity',prefsPayload())}catch{}
  }
  async function syncPreferences(){
    const sub=await currentSubscription();
    if(!sub)return;
    await api('/api/push/preferences',prefsPayload());
  }
  async function storeSubscription(sub){
    await api('/api/push/subscribe',{
      ...prefsPayload(),
      subscription:sub.toJSON()
    });
  }

  function addStyles(){
    if(document.querySelector('#push-settings-styles'))return;
    const style=document.createElement('style');
    style.id='push-settings-styles';
    style.textContent=`
      .notification-button{position:relative}
      .notification-button.push-active::after{content:"";position:absolute;right:5px;top:5px;width:7px;height:7px;border-radius:50%;background:currentColor}
      .push-dialog{width:min(560px,92vw);max-height:min(86vh,760px);overflow:auto;padding:28px}
      .push-dialog h2{margin:.2rem 0 .45rem;font-family:Georgia,"Times New Roman",serif}
      .push-intro{margin:0 0 18px;color:var(--muted);line-height:1.5}
      .push-status{padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--paper2);font-size:.88rem;line-height:1.45;margin-bottom:16px}
      .push-setting{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:15px 0;border-top:1px solid var(--line)}
      .push-setting:first-of-type{border-top:0}
      .push-setting strong{display:block;margin-bottom:4px}
      .push-setting small{display:block;color:var(--muted);line-height:1.4;max-width:38ch}
      .push-setting-controls{display:flex;align-items:center;gap:10px}
      .push-setting input[type="time"]{min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--dark);padding:0 10px;font:inherit;font-weight:800}
      .push-switch{display:inline-flex;align-items:center;gap:7px;font-weight:850}
      .push-switch input{width:20px;height:20px;accent-color:var(--accent)}
      .push-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}
      .push-actions button{min-height:50px;justify-content:center}
      .push-footnote{margin:14px 0 0;color:var(--muted);font-size:.78rem;line-height:1.45}
      .push-test-status{min-height:1.3em;margin:10px 0 0;color:var(--muted);font-size:.82rem}
      @media(max-width:560px){
        .push-setting{grid-template-columns:1fr}
        .push-setting-controls{justify-content:space-between}
        .push-actions{grid-template-columns:1fr}
      }`;
    document.head.appendChild(style);
  }

  function makeBellButton(){
    const actions=document.querySelector('.header-actions');
    if(!actions||document.querySelector('#notificationButton'))return;
    const button=document.createElement('button');
    button.className='theme-button notification-button';
    button.id='notificationButton';
    button.type='button';
    button.title='Notification settings';
    button.setAttribute('aria-label','Notification settings');
    button.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Zm4 10h4"/></svg>';
    button.addEventListener('click',()=>{renderDialog();dialog.showModal()});
    actions.insertBefore(button,actions.firstChild);
  }

  function makeDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');
    dialog.className='push-dialog';
    dialog.id='pushDialog';
    dialog.innerHTML=`
      <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close notification settings"><span aria-hidden="true">×</span></button></form>
      <span class="game-label">DAILY REMINDERS</span>
      <h2>Clue Morning notifications</h2>
      <p class="push-intro">Start the morning ritual, or protect a streak. Nothing noisy.</p>
      <div id="pushStatus" class="push-status"></div>
      <div class="push-setting">
        <div><strong>Morning Puzzle</strong><small>One reminder when the fresh daily set is ready. If you already opened Clue Morning that day, we skip it.</small></div>
        <div class="push-setting-controls">
          <input id="pushMorningTime" type="time" step="900" aria-label="Morning notification time">
          <label class="push-switch"><input id="pushMorningEnabled" type="checkbox"><span>On</span></label>
        </div>
      </div>
      <div class="push-setting">
        <div><strong>Streak Save</strong><small>Optional evening reminder only when you have an active streak and today's core set is still unfinished.</small></div>
        <div class="push-setting-controls">
          <input id="pushStreakTime" type="time" step="900" aria-label="Streak reminder time">
          <label class="push-switch"><input id="pushStreakEnabled" type="checkbox"><span>On</span></label>
        </div>
      </div>
      <p id="pushTimezone" class="push-footnote"></p>
      <div class="push-actions">
        <button id="pushEnable" class="primary-button" type="button">Enable Notifications</button>
        <button id="pushTest" class="secondary-button" type="button">Send Test</button>
      </div>
      <button id="pushDisable" class="secondary-button" type="button" style="width:100%;margin-top:10px">Turn Notifications Off</button>
      <p id="pushTestStatus" class="push-test-status" role="status" aria-live="polite"></p>
    `;
    document.querySelector('.app')?.appendChild(dialog);
    dialog.querySelector('#pushMorningEnabled').addEventListener('change',onPrefsChanged);
    dialog.querySelector('#pushMorningTime').addEventListener('change',onPrefsChanged);
    dialog.querySelector('#pushStreakEnabled').addEventListener('change',onPrefsChanged);
    dialog.querySelector('#pushStreakTime').addEventListener('change',onPrefsChanged);
    dialog.querySelector('#pushEnable').addEventListener('click',()=>void enableNotifications());
    dialog.querySelector('#pushDisable').addEventListener('click',()=>void disableNotifications());
    dialog.querySelector('#pushTest').addEventListener('click',()=>void sendTest());
  }

  function readFields(){
    const prefs=loadPrefs();
    prefs.morningEnabled=dialog.querySelector('#pushMorningEnabled').checked;
    prefs.morningTime=dialog.querySelector('#pushMorningTime').value||DEFAULTS.morningTime;
    prefs.streakEnabled=dialog.querySelector('#pushStreakEnabled').checked;
    prefs.streakTime=dialog.querySelector('#pushStreakTime').value||DEFAULTS.streakTime;
    prefs.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||prefs.timezone||DEFAULTS.timezone;
    return savePrefs(prefs);
  }

  async function onPrefsChanged(){
    readFields();
    try{await syncPreferences();setTestStatus('Saved.')}catch{setTestStatus('Saved on this device.')}
    setTimeout(()=>setTestStatus(''),1400);
    await renderStatusOnly();
  }

  function setTestStatus(text){const el=dialog?.querySelector('#pushTestStatus');if(el)el.textContent=text}

  async function renderStatusOnly(){
    const button=document.querySelector('#notificationButton');
    const sub=await currentSubscription();
    button?.classList.toggle('push-active',!!sub);
    if(!dialog)return;
    const status=dialog.querySelector('#pushStatus');
    const enable=dialog.querySelector('#pushEnable'),disable=dialog.querySelector('#pushDisable'),test=dialog.querySelector('#pushTest');
    if(!supportsPush()){
      status.textContent=isIos()&&!isStandalone()
        ?'On iPhone or iPad, add Clue Morning to your Home Screen and open it there before enabling notifications.'
        :'This browser does not support web push notifications.';
      enable.disabled=true;disable.hidden=true;test.hidden=true;return;
    }
    if(Notification.permission==='denied'){
      status.textContent='Notifications are blocked in your browser or device settings. Allow Clue Morning there to turn them back on.';
      enable.disabled=true;disable.hidden=!sub;test.hidden=true;return;
    }
    if(sub){
      status.textContent='Notifications are on. Clue Morning will only send the reminders you selected below.';
      enable.textContent='Notifications Enabled';enable.disabled=true;disable.hidden=false;test.hidden=false;
    }else{
      status.textContent='Choose your reminders, then enable notifications. Your browser will ask for permission once.';
      enable.textContent='Enable Notifications';enable.disabled=false;disable.hidden=true;test.hidden=true;
    }
  }

  async function renderDialog(){
    makeDialog();
    const prefs=loadPrefs();
    dialog.querySelector('#pushMorningEnabled').checked=!!prefs.morningEnabled;
    dialog.querySelector('#pushMorningTime').value=prefs.morningTime||DEFAULTS.morningTime;
    dialog.querySelector('#pushStreakEnabled').checked=!!prefs.streakEnabled;
    dialog.querySelector('#pushStreakTime').value=prefs.streakTime||DEFAULTS.streakTime;
    dialog.querySelector('#pushTimezone').textContent=`Times use this device's time zone: ${prefs.timezone}. Morning Puzzle defaults to 7:00 AM; Streak Save defaults to 7:00 PM and starts off.`;
    setTestStatus('');
    void getConfig().catch(()=>{});
    await renderStatusOnly();
  }

  async function enableNotifications(){
    setTestStatus('');
    if(!supportsPush())return renderStatusOnly();
    if(isIos()&&!isStandalone()){
      setTestStatus('Add Clue Morning to your Home Screen first, then enable notifications from the installed app.');
      return;
    }
    try{
      readFields();
      const permissionPromise=Notification.requestPermission();
      const [permission,cfg]=await Promise.all([permissionPromise,getConfig()]);
      if(permission!=='granted')throw new Error(permission==='denied'?'Notification permission was blocked.':'Notification permission was not granted.');
      if(!cfg.enabled||!cfg.publicKey)throw new Error(cfg.reason||'Notification service is not ready.');
      let sub=await currentSubscription();
      if(!sub){
        sub=await registration.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:base64ToBytes(cfg.publicKey)
        });
      }
      await storeSubscription(sub);
      await syncActivity();
      setTestStatus('Notifications are enabled.');
      await renderStatusOnly();
    }catch(error){
      setTestStatus(error.message||'Could not enable notifications.');
      await renderStatusOnly();
    }
  }

  async function disableNotifications(){
    setTestStatus('');
    try{
      const sub=await currentSubscription();
      await api('/api/push/unsubscribe',{deviceToken:deviceToken()}).catch(()=>{});
      if(sub)await sub.unsubscribe();
      setTestStatus('Notifications are off.');
    }catch{setTestStatus('Notifications are off on this device.')}
    await renderStatusOnly();
  }

  async function sendTest(){
    setTestStatus('Sending…');
    try{
      await api('/api/push/test',{deviceToken:deviceToken()});
      setTestStatus('Test sent.');
    }catch(error){setTestStatus(error.message||'Could not send a test notification.')}
  }

  function startActivitySync(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(()=>{if(document.visibilityState==='visible')void syncActivity()},60000);
    window.addEventListener('focus',()=>void syncActivity());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void syncActivity()});
    window.addEventListener('pagehide',()=>void syncActivity());
  }

  async function init(){
    if(!('serviceWorker' in navigator))return;
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      registration.update().catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        window.dispatchEvent(new CustomEvent('cluemorning:pwa-ready'));
      });
    }catch(error){
      console.warn('Clue Morning PWA registration failed.',error);
      return;
    }
    addStyles();
    makeBellButton();
    makeDialog();
    await renderDialog();
    await syncActivity();
    startActivitySync();
  }

  if(document.readyState==='complete')void init();
  else window.addEventListener('load',()=>void init(),{once:true});
})();
