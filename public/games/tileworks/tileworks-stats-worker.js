importScripts('/games/tileworks/tileworks-ai-worker.js');

onmessage=async e=>{
  const d=e.data||{};
  if(d.type==='init'){
    if(!ready)await init();
    return;
  }
  if(d.type!=='analyze')return;
  if(!ready)await init();
  const {moves,examined}=legalMoves(d.board,d.rack,d.size,d.bonuses,'grandmaster',d.bagCount);
  let best=null;
  for(const move of moves){
    if(!best||move.score>best.score||(move.score===best.score&&move.eval>best.eval)||(move.score===best.score&&move.eval===best.eval&&move.word.length>best.word.length))best=move;
  }
  postMessage({type:'analysis',requestId:d.requestId,best:best?{word:best.word,score:best.score,placements:best.placements.length}:null,meta:{examined,total:moves.length}});
};
