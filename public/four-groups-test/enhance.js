(()=>{
  const BEST_KEY='clue-four-groups-best';
  const grid=document.querySelector('#grid'),score=document.querySelector('#score'),best=document.querySelector('#best'),pins=document.querySelector('#pins');
  const yarn=[document.querySelector('#yarnShadow'),document.querySelector('#yarnMain'),document.querySelector('#yarnLight')];
  let order=[],bestScore=Number(localStorage.getItem(BEST_KEY)||0);
  function syncOrder(){const active=new Set([...grid.children].map((c,i)=>c.classList.contains('selected')?i:-1).filter(i=>i>=0));order=order.filter(i=>active.has(i));for(const i of active)if(!order.includes(i))order.push(i)}
  function points(){const box=grid.getBoundingClientRect();return order.map(i=>{const r=grid.children[i].getBoundingClientRect();return{x:(r.left+r.width/2-box.left)/box.width*100,y:(r.top+r.height*.08-box.top)/box.height*100}})}
  function pathFor(pts){if(!pts.length)return'';return'M '+pts[0].x+' '+pts[0].y+pts.slice(1).map((p,i)=>{const a=pts[i],distance=Math.hypot(p.x-a.x,p.y-a.y),sag=Math.min(4.2,1.1+distance*.035);return' Q '+((a.x+p.x)/2)+' '+((a.y+p.y)/2+sag)+' '+p.x+' '+p.y}).join('')}
  function draw(){syncOrder();const pts=points(),d=pathFor(pts);yarn.forEach(el=>el.setAttribute('d',d));pins.innerHTML=pts.map(p=>`<circle class="knot-shadow" cx="${p.x+.42}" cy="${p.y+.6}" r="1.9"/><circle class="knot" cx="${p.x}" cy="${p.y}" r="1.65"/><circle class="knot-light" cx="${p.x-.45}" cy="${p.y-.5}" r=".43"/>`).join('');updateBest()}
  function updateBest(){const current=Number(score.textContent.replace(/\D/g,''))||0;if(current>bestScore){bestScore=current;localStorage.setItem(BEST_KEY,String(bestScore))}best.textContent=bestScore||'—'}
  grid.addEventListener('click',event=>{const card=event.target.closest('.card');if(card){const i=Number(card.dataset.i);if(!order.includes(i))order.push(i);requestAnimationFrame(draw)}});
  new MutationObserver(()=>requestAnimationFrame(draw)).observe(grid,{subtree:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(updateBest).observe(score,{childList:true,characterData:true,subtree:true});
  window.addEventListener('resize',draw,{passive:true});updateBest();draw();
})();
