(()=>{
  const playHash=()=>new URLSearchParams(location.hash.replace(/^#/,'')).has('play');
  function returnHome(){
    if(!playHash())return;
    delete document.documentElement.dataset.gameSession;
    history.replaceState(null,'',location.pathname+location.search);
    document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.tab==='today'));
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id==='today'));
    document.documentElement.classList.remove('link-immersive','steps-immersive','deepcut-immersive');
    document.body.classList.remove('case-file-active','trail-cartographer-active','letter-typesetter-active');
  }
  returnHome();
  addEventListener('hashchange',returnHome);
  addEventListener('pageshow',returnHome);
})();
