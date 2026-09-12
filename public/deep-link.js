(()=>{
  const aliases={
    grid:'letter',letter:'letter',groups:'groups',trail:'trail',link:'link',steps:'steps',
    deepcut:'deepcut','deep-cut':'deepcut',lastcall:'lastcall','last-call':'lastcall'
  };
  let retry=0,stopTimer=0;

  function requestedGame(){
    const raw=new URLSearchParams(location.hash.replace(/^#/,'')).get('play')||'';
    return aliases[String(raw).toLowerCase()]||'';
  }

  function openRequested(){
    const game=requestedGame();
    if(!game)return true;
    const tab=document.querySelector(`.tab[data-tab="${game}"]`);
    const opener=document.querySelector(`[data-open="${game}"]`);
    const lastCall=document.querySelector('[data-lastcall-home]');
    const target=tab||opener||(game==='lastcall'?lastCall:null);
    if(target)target.click();
    return !!document.getElementById(game)?.classList.contains('active');
  }

  function clearPlayHash(){
    if(!requestedGame())return;
    history.replaceState(null,'',location.pathname+location.search);
  }

  function run(){
    clearInterval(retry);clearTimeout(stopTimer);
    const nav=performance.getEntriesByType?.('navigation')?.[0];
    if(nav?.type==='reload'&&requestedGame()){
      clearPlayHash();
      document.querySelector('.tab[data-tab="today"]')?.click();
      return;
    }
    if(openRequested())return;
    retry=setInterval(()=>{if(openRequested())clearInterval(retry)},120);
    stopTimer=setTimeout(()=>clearInterval(retry),5000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
  window.addEventListener('hashchange',run);
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('button,a');
    if(control&&/morning run/i.test(control.textContent||''))clearPlayHash();
  },true);
})();
