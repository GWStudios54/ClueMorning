function normalizeWord(value){
  return String(value||'').trim().toUpperCase().replace(/[^A-Z]/g,'');
}

function hashString(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){
    h^=str.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function mulberry32(a){
  return function(){
    let t=a+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return((t^t>>>14)>>>0)/4294967296;
  };
}

function shuffle(values,rnd){
  const out=[...values];
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function neighbors(index){
  const row=Math.floor(index/4),col=index%4;
  const out=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const nr=row+dr,nc=col+dc;
    if(nr<0||nc<0||nr>=4||nc>=4)continue;
    out.push(nr*4+nc);
  }
  return out;
}

function randomSelfAvoidingPath(length,rnd){
  const starts=shuffle(Array.from({length:16},(_,i)=>i),rnd);

  function dfs(path,used){
    if(path.length===length)return [...path];
    const current=path[path.length-1];
    const candidates=neighbors(current)
      .filter(index=>!used.has(index))
      .map(index=>({
        index,
        onward:neighbors(index).filter(next=>!used.has(next)).length,
        tie:rnd()
      }))
      .sort((a,b)=>a.onward-b.onward||a.tie-b.tie);

    for(const candidate of candidates){
      used.add(candidate.index);
      path.push(candidate.index);
      const result=dfs(path,used);
      if(result)return result;
      path.pop();
      used.delete(candidate.index);
    }
    return null;
  }

  for(const start of starts){
    const result=dfs([start],new Set([start]));
    if(result)return result;
  }
  return null;
}

function pathIsIrregularEnough(path){
  if(path.length<8)return true;
  let diagonals=0;
  let turns=0;
  let previousDirection=null;

  for(let i=1;i<path.length;i++){
    const from=path[i-1],to=path[i];
    const dr=Math.floor(to/4)-Math.floor(from/4);
    const dc=(to%4)-(from%4);
    if(dr!==0&&dc!==0)diagonals++;
    const direction=`${Math.sign(dr)},${Math.sign(dc)}`;
    if(previousDirection!==null&&direction!==previousDirection)turns++;
    previousDirection=direction;
  }

  const minimumDiagonals=path.length>=12?3:1;
  const minimumTurns=path.length>=12?6:3;
  return diagonals>=minimumDiagonals&&turns>=minimumTurns;
}

function rowSnake(topToBottom,leftToRight){
  const rows=topToBottom?[0,1,2,3]:[3,2,1,0];
  const path=[];
  rows.forEach((row,rowIndex)=>{
    const forward=rowIndex%2===0?leftToRight:!leftToRight;
    const cols=forward?[0,1,2,3]:[3,2,1,0];
    cols.forEach(col=>path.push(row*4+col));
  });
  return path;
}

function columnSnake(leftToRight,topToBottom){
  const cols=leftToRight?[0,1,2,3]:[3,2,1,0];
  const path=[];
  cols.forEach((col,colIndex)=>{
    const forward=colIndex%2===0?topToBottom:!topToBottom;
    const rows=forward?[0,1,2,3]:[3,2,1,0];
    rows.forEach(row=>path.push(row*4+col));
  });
  return path;
}

const OBVIOUS_SNAKES=[
  rowSnake(true,true),rowSnake(true,false),rowSnake(false,true),rowSnake(false,false),
  columnSnake(true,true),columnSnake(true,false),columnSnake(false,true),columnSnake(false,false)
];

function wordAlong(grid,path){
  return path.map(index=>grid[index]).join('');
}

export function isObviousTrailLayout(grid,longest){
  const target=normalizeWord(longest);
  if(target.length!==16)return false;
  return OBVIOUS_SNAKES.some(path=>wordAlong(grid,path)===target||wordAlong(grid,[...path].reverse())===target);
}

function remainingLetters(grid,longest){
  const counts=new Map();
  for(const raw of grid){
    const ch=normalizeWord(raw);
    counts.set(ch,(counts.get(ch)||0)+1);
  }
  for(const ch of longest){
    const left=(counts.get(ch)||0)-1;
    if(left<0)return null;
    counts.set(ch,left);
  }
  const leftovers=[];
  for(const [ch,count] of counts)for(let i=0;i<count;i++)leftovers.push(ch);
  return leftovers;
}

export function buildIrregularTrailGrid(seed,seedIndex=0,attempt=0){
  const original=Array.isArray(seed?.grid)?seed.grid.map(normalizeWord):[];
  const longest=normalizeWord(seed?.longest);
  if(original.length!==16||longest.length<3||longest.length>16)return null;

  const fillers=remainingLetters(original,longest);
  if(!fillers||fillers.length!==16-longest.length)return null;

  const rnd=mulberry32(hashString(`${longest}::trail-layout::${seedIndex}::${attempt}`));
  for(let pathTry=0;pathTry<8;pathTry++){
    const path=randomSelfAvoidingPath(longest.length,rnd);
    if(!path||!pathIsIrregularEnough(path))continue;

    const grid=Array(16).fill('');
    for(let i=0;i<longest.length;i++)grid[path[i]]=longest[i];
    const shuffledFillers=shuffle(fillers,rnd);
    let fillerIndex=0;
    for(let i=0;i<grid.length;i++)if(!grid[i])grid[i]=shuffledFillers[fillerIndex++];

    if(isObviousTrailLayout(grid,longest))continue;
    return grid;
  }
  return null;
}
