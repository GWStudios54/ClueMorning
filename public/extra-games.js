(()=>{
  const GAMES=[
    {id:'all-seven',name:'All Seven',label:'SEVEN-CENTER WORD HUNT',copy:'Master the same seven letters from every center. Pangrams can clear a stage instantly.',mark:'7',href:'/games/all-seven/'},
    {id:'pangram',name:'Pangram',label:'ENDLESS WORD HUNT',copy:'Seven letters. One required center. Find words, chase the pangram, then roll another set.',mark:'P',href:'/games/pangram/'}
  ];
  function add(){
    const target=document.querySelector('#morePlaySection .more-play-grid')||document.querySelector('#today .game-cards');if(!target)return;
    for(const game of GAMES){
      if(document.querySelector(`[data-extra-game="${game.id}"]`))continue;
      const b=document.createElement('button');b.type='button';b.className=`game-card extra-game-home-card ${game.id}-home-card`;b.dataset.extraGame=game.id;b.dataset.morePlayHome='1';
      b.innerHTML=`<div class="game-icon extra-game-mark" aria-hidden="true"><span>${game.mark}</span></div><div class="game-copy"><span class="game-label">${game.label}</span><h3>${game.name}</h3><p>${game.copy}</p></div><span class="game-status">PLAY</span>`;
      b.addEventListener('click',()=>{location.href=game.href});target.appendChild(b)
    }
  }
  add();new MutationObserver(add).observe(document.body,{subtree:true,childList:true});
})();
