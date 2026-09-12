(()=>{
  if(location.pathname!=='/'&&location.pathname!=='/index.html')return;
  let interacted=false;
  const mark=event=>{if(event.isTrusted)interacted=true};
  addEventListener('pointerdown',mark,{capture:true,passive:true});
  addEventListener('keydown',mark,{capture:true});

  function showHome(){
    if(interacted)return;
    if(location.hash)history.replaceState(null,'',location.pathname+location.search);
    document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab==='today'));
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id==='today'));
    document.body.classList.remove(
      'trail-cartographer-active',
      'four-groups-case-file-active',
      'typesetter-active',
      'switchboard-active',
      'word-steps-rooftops-active',
      'deep-cut-active'
    );
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close?.());
  }

  showHome();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showHome,{once:true});
  addEventListener('pageshow',showHome);
  addEventListener('load',showHome,{once:true});
  [100,500,1200,2500].forEach(delay=>setTimeout(showHome,delay));
})();
