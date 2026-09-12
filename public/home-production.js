(()=>{
  const ids=["letterCardStatus","groupCardStatus","trailCardStatus","linkCardStatus","stepsCardStatus","deepCutCardStatus","lastCallCardStatus"];
  function syncRun(){
    const statuses=ids.map(id=>document.getElementById(id)).filter(Boolean);
    const done=statuses.filter(el=>el.classList.contains("done")).length;
    const count=document.getElementById("runCompleteCount");
    if(count)count.textContent=String(done);
    document.querySelectorAll("#today .progress-track i").forEach((segment,index)=>segment.classList.toggle("done",index<done));
  }
  function start(){
    syncRun();
    const target=document.getElementById("today");
    if(target)new MutationObserver(syncRun).observe(target,{subtree:true,attributes:true,attributeFilter:["class"]});
    addEventListener("pageshow",syncRun);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();