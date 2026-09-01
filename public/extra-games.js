(()=>{
  const GAMES=[
    {id:'all-seven',name:'All Seven',label:'SEVEN-CENTER WORD HUNT',copy:'Master the same seven letters from every center. Pangrams can clear a stage instantly.',mark:'7',href:'/games/all-seven/'},
    {id:'pangram',name:'Pangram',label:'ENDLESS WORD HUNT',copy:'Seven letters. One required center. Find words, chase the pangram, then roll another set.',mark:'P',href:'/games/pangram/'}
  ];
  function style(){
    if(document.querySelector('#extraGamesStyle'))return;const s=document.createElement('style');s.id='extraGamesStyle';s.textContent=`
      #morePlaySection .more-play-grid{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}
      #morePlaySection .more-play-grid .game-card{position:relative;min-height:126px;margin:0;border-radius:18px;grid-template-columns:54px 1fr auto;gap:12px;padding:16px}
      #morePlaySection .more-play-grid .game-icon{width:52px;height:52px;border-radius:15px}
      #morePlaySection .extra-game-mark{display:grid;place-items:center;background:linear-gradient(145deg,#f0cf86,#e3a93e);color:#251b0c;font-weight:950;font-size:1.65rem}
      #morePlaySection .pangram-home-card .extra-game-mark{background:linear-gradient(145deg,#cad8c8,#8ca58b)}
      #morePlaySection .extra-game-home-card .game-copy p{font-size:.76rem;line-height:1.35}
      @media(max-width:900px){#morePlaySection .more-play-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }
  function cardFor(game){
    let b=document.querySelector(`[data-extra-game="${game.id}"]`);if(b)return b;
    b=document.createElement('button');b.type='button';b.className=`game-card extra-game-home-card ${game.id}-home-card`;b.dataset.extraGame=game.id;b.dataset.morePlayHome='1';
    b.innerHTML=`<div class="game-icon extra-game-mark" aria-hidden="true"><span>${game.mark}</span></div><div class="game-copy"><span class="game-label">${game.label}</span><h3>${game.name}</h3><p>${game.copy}</p></div><span class="game-status">PLAY</span>`;
    b.addEventListener('click',()=>{location.href=game.href});return b
  }
  function sync(){
    style();const more=document.querySelector('#morePlaySection .more-play-grid');const home=document.querySelector('#today .game-cards');const target=more||home;if(!target)return;
    const heading=document.querySelector('#morePlaySection .more-play-heading p');if(heading)heading.textContent="The daily set ends. These don't.";
    for(const game of GAMES){const card=cardFor(game);if(card.parentElement!==target)target.appendChild(card)}
  }
  sync();new MutationObserver(sync).observe(document.body,{subtree:true,childList:true});
})();
