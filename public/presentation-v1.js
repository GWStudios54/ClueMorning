(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const DAILY=[
    ['letter','Letter Grid'],['groups','Four Groups'],['trail','Letter Trail'],['link','Triple Link'],
    ['steps','Word Steps'],['deepcut','Deep Cut'],['lastcall','Last Call']
  ];
  const selector=id=>id==='lastcall'?'[data-lastcall-home]':`[data-game-route="${id}"]`;
  let scheduled=false;

  function decorateNavigation(){
    const nav=$('.tabs');if(!nav)return;
    const dailyTabs=new Set(['today','letter','groups','trail','link','steps','deepcut','lastcall']);
    $$('.tabs .tab').forEach(tab=>{
      const id=tab.dataset.tab||tab.dataset.gameRoute||'';tab.classList.toggle('nav-daily',dailyTabs.has(id));
      tab.classList.toggle('nav-extra',tab.classList.contains('tileworks-nav-tab'));
      tab.classList.toggle('nav-utility',['unlimited','leaders','archive'].includes(id));
    });
  }

  function dailyGrid(){
    const grid=$('#today .game-cards');if(!grid)return null;grid.classList.add('daily-game-grid');
    const ordered=DAILY.map(([id])=>grid.querySelector(selector(id))).filter(Boolean),current=[...grid.children].filter(el=>ordered.includes(el));
    const alreadyOrdered=current.length===ordered.length&&current.every((el,i)=>el===ordered[i]);
    if(!alreadyOrdered)for(const card of ordered)grid.appendChild(card);
    return grid;
  }

  function dailyHeading(grid){
    if(!grid||$('#dailyGridHeading'))return;
    const head=document.createElement('div');head.id='dailyGridHeading';head.className='daily-grid-heading';
    head.innerHTML='<div><span>TODAY\'S SET</span><h2>Today\'s Seven</h2></div><p>Finish any two to start a streak. Clear all seven for a Super Streak.</p>';
    grid.before(head);
  }

  function morePlay(){
    const tile=document.querySelector('[data-tileworks-home]');if(!tile)return;
    let section=$('#morePlaySection');
    if(!section){
      section=document.createElement('section');section.id='morePlaySection';section.className='more-play-section';
      section.innerHTML='<div class="more-play-heading"><div><span>MORE TO PLAY</span><h2>Stay at the table.</h2></div><p>Tileworks now includes Full Match and Situation modes.</p></div><div class="more-play-grid"></div>';
      const strip=$('#today .score-strip'),ritual=$('#today .ritual-card');
      if(strip)strip.after(section);else if(ritual)ritual.before(section);else $('#today')?.appendChild(section);
    }
    const target=section.querySelector('.more-play-grid');if(target&&tile.parentElement!==target)target.appendChild(tile);
  }

  function heroProgress(){
    const total=$('#today .daily-total');if(!total)return;
    let el=total.querySelector('.hero-complete');if(!el){el=document.createElement('div');el.className='hero-complete';el.innerHTML='<i></i><span>0 of 7 complete</span>';total.appendChild(el)}
    const run=$('#dailyRunCount'),m=String(run?.textContent||'0/7').match(/(\d+)\s*\/\s*(\d+)/),done=Math.max(0,Math.min(7,Number(m?.[1]||0)));
    const label=el.querySelector('span'),next=`${done} of 7 complete`;if(label&&label.textContent!==next)label.textContent=next;
  }

  function completionStates(){
    const grid=$('#today .game-cards');if(!grid)return;
    for(const [id,name] of DAILY){
      const card=grid.querySelector(selector(id));if(!card)continue;const status=card.querySelector('.game-status');
      const done=!!status&&(status.classList.contains('done')||/DONE/i.test(status.textContent||''));card.classList.toggle('presentation-complete',done);const label=`${name}${done?' — complete':''}`;if(card.getAttribute('aria-label')!==label)card.setAttribute('aria-label',label);
    }
  }

  function simplifyHeroCopy(){const p=$('#today .today-hero p');if(p&&/(Eight|Seven) fresh puzzles are waiting|Eight games\. One morning run/i.test(p.textContent||''))p.textContent='Seven games. One morning run.'}
  function run(){document.body.classList.add('presentation-pass-v1');decorateNavigation();const grid=dailyGrid();dailyHeading(grid);morePlay();heroProgress();completionStates();simplifyHeroCopy()}
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run()})}
  run();const obs=new MutationObserver(queue);obs.observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('clue-lastcall-update',queue);window.addEventListener('storage',queue);
})();
