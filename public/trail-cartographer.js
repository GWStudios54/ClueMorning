(()=>{
  const ART_PARTS=Array.from({length:24},(_,i)=>`/trail-test/bg/bg-${String(i).padStart(2,'0')}.b64`);
  let artPromise=null,selectionOrder=[];
  const $=s=>document.querySelector(s);
  function loadArt(panel){
    if(!artPromise)artPromise=Promise.all(ART_PARTS.map(async url=>{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error(`Trail art ${r.status}`);return(await r.text()).trim()})).then(parts=>`url(data:image/webp;base64,${parts.join('')})`);
    artPromise.then(value=>{panel.style.backgroundImage=value}).catch(err=>console.error(err));
  }
  function mount(){
    const panel=$('#trail'),grid=$('#trailGrid'),play=$('#trailPlay');if(!panel||!grid||!play||panel.dataset.cartographerMounted)return;
    panel.dataset.cartographerMounted='1';panel.classList.add('trail-cartographer');loadArt(panel);
    const clearLabel=$('#trailClear span'),submitLabel=$('#trailSubmit span');if(clearLabel)clearLabel.textContent='CLEAR';if(submitLabel)submitLabel.textContent='MARK WORD';
    const back=document.createElement('button');back.type='button';back.className='trail-morning-run';back.textContent='← MORNING RUN';back.addEventListener('click',()=>{history.replaceState(null,'',location.pathname+location.search);document.querySelector('[data-tab="today"]')?.click()});panel.appendChild(back);
    const board=document.createElement('div');board.className='trail-cart-board';grid.before(board);board.appendChild(grid);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('trail-cart-trace');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.innerHTML='<polyline points=""></polyline><g></g>';board.appendChild(svg);
    function draw(){
      const cells=[...grid.querySelectorAll('.trail-cell')],active=new Set(cells.map((c,i)=>c.classList.contains('selected')?i:-1).filter(i=>i>=0));
      selectionOrder=selectionOrder.filter(i=>active.has(i));
      for(const i of active)if(!selectionOrder.includes(i))selectionOrder.push(i);
      const head=cells.findIndex(c=>c.classList.contains('trail-head'));if(head>=0&&selectionOrder.includes(head)){selectionOrder=selectionOrder.filter(i=>i!==head);selectionOrder.push(head)}
      const br=grid.getBoundingClientRect(),centers=cells.map(c=>{const r=c.getBoundingClientRect();return{x:(r.left+r.width/2-br.left)/br.width*100,y:(r.top+r.height/2-br.top)/br.height*100}});
      svg.querySelector('polyline').setAttribute('points',selectionOrder.map(i=>`${centers[i]?.x||0},${centers[i]?.y||0}`).join(' '));
      svg.querySelector('g').innerHTML=selectionOrder.map(i=>`<circle cx="${centers[i]?.x||0}" cy="${centers[i]?.y||0}" r="1.7"/>`).join('');
      const current=$('#trailCurrent');if(current&&!selectionOrder.length&&/tap or drag/i.test(current.textContent))current.textContent='Trace a route across the map';
    }
    new MutationObserver(()=>requestAnimationFrame(draw)).observe(grid,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>requestAnimationFrame(draw),{passive:true});draw();
  }
  function sync(){const panel=$('#trail');if(!panel)return;const active=panel.classList.contains('active')&&document.documentElement.dataset.gameSession==='trail';document.body.classList.toggle('trail-cartographer-active',active);if(active)loadArt(panel)}
  function boot(){mount();sync();const panel=$('#trail');if(panel)new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
