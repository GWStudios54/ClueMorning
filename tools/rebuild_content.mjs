import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "content", "source");
const generatedDir = path.join(root, "content", "generated");
const lexiconPath = path.join(root, "tools", "trail_lexicon.txt");
const outputPath = path.join(root, "src", "puzzles.js");
const END = "*";

function normalizeWord(v){return String(v||"").trim().toUpperCase().replace(/[^A-Z]/g,"")}
function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,rnd=Math.random){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function trailPathValid(word,grid){
  const W=4,target=normalizeWord(word); if(target.length<3||target.length>16) return false;
  function dfs(idx,pos,used){
    if(pos===target.length) return true;
    const r=Math.floor(idx/W),c=idx%W;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc) continue;
      const nr=r+dr,nc=c+dc;
      if(nr<0||nc<0||nr>=4||nc>=4) continue;
      const ni=nr*W+nc;
      if(used.has(ni)||grid[ni]!==target[pos]) continue;
      used.add(ni); if(dfs(ni,pos+1,used)) return true; used.delete(ni);
    }
    return false;
  }
  for(let i=0;i<grid.length;i++) if(grid[i]===target[0] && dfs(i,1,new Set([i]))) return true;
  return false;
}
async function readJson(p){ return JSON.parse(await fs.readFile(p, "utf8")); }
async function readLines(p){ return (await fs.readFile(p, "utf8")).split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
function makeTrie(words){
  const trie={};
  for(const raw of words){
    const word=normalizeWord(raw); if(!word) continue;
    let node=trie;
    for(const ch of word) node=node[ch] ||= {};
    node[END]=1;
  }
  return trie;
}
function solveTrailBoard(grid, trie){
  const found = new Set();
  function dfs(idx,node,prefix,used){
    const ch = grid[idx]; const child = node[ch]; if(!child) return;
    const next = prefix + ch; if(child[END] && next.length >= 3) found.add(next);
    const r=Math.floor(idx/4), c=idx%4;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(!dr && !dc) continue;
      const nr=r+dr, nc=c+dc; if(nr<0||nc<0||nr>=4||nc>=4) continue;
      const ni=nr*4+nc; if(used.has(ni)) continue;
      used.add(ni); dfs(ni, child, next, used); used.delete(ni);
    }
  }
  for(let i=0;i<grid.length;i++) dfs(i, trie, "", new Set([i]));
  return [...found].sort((a,b)=>a.length-b.length||a.localeCompare(b));
}
function differsByOne(a,b){return a.length===b.length&&[...a].reduce((n,ch,i)=>n+(ch!==b[i]),0)===1}
function buildWordSteps(commonWords, fullLexicon, startDate, days){
  const dictionary=[...new Set(fullLexicon.map(normalizeWord).filter(w=>w.length===4))].sort();
  const dictionarySet=new Set(dictionary);
  const core=[...new Set(commonWords.map(normalizeWord).filter(w=>w.length===4&&dictionarySet.has(w)))].sort();
  const buckets=new Map();
  for(const word of core){
    for(let i=0;i<4;i++){
      const key=word.slice(0,i)+'*'+word.slice(i+1);
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(word);
    }
  }
  const graph=new Map(core.map(w=>[w,new Set()]));
  for(const list of buckets.values()) for(const a of list) for(const b of list) if(a!==b) graph.get(a).add(b);
  const pairs=[];
  for(const start of core){
    const dist=new Map([[start,0]]),prev=new Map(),queue=[start];
    for(let qi=0;qi<queue.length;qi++){
      const word=queue[qi],d=dist.get(word);
      if(d>=6)continue;
      for(const next of graph.get(word)||[]){
        if(dist.has(next))continue;
        dist.set(next,d+1);prev.set(next,word);queue.push(next);
      }
    }
    for(const [target,d] of dist){
      if(start>=target||d<3||d>6)continue;
      const solution=[target];let cur=target;
      while(cur!==start){cur=prev.get(cur);solution.push(cur)}
      solution.reverse();
      if(solution.every((w,i)=>i===0||differsByOne(solution[i-1],w)))pairs.push({start,target,par:d,solution});
    }
  }
  if(pairs.length<days)throw new Error(`Need ${days} Word Steps pairs, found ${pairs.length}`);
  const rnd=mulberry32(hashString(startDate+'::clue-morning::steps'));
  const shuffled=shuffle(pairs,rnd);
  const selected=[];const endpointUse=new Map();
  for(const p of shuffled){
    const use=Math.max(endpointUse.get(p.start)||0,endpointUse.get(p.target)||0);
    if(use>=5)continue;
    selected.push(p);endpointUse.set(p.start,(endpointUse.get(p.start)||0)+1);endpointUse.set(p.target,(endpointUse.get(p.target)||0)+1);
    if(selected.length===days)break;
  }
  if(selected.length<days){for(const p of shuffled){if(selected.includes(p))continue;selected.push(p);if(selected.length===days)break}}
  return {dictionary,puzzles:selected};
}
function validateDeepCutPrompts(prompts){
  const ids=new Set();
  for(const p of prompts){
    if(!p?.id||!p?.prompt||!Array.isArray(p.answers)||p.answers.length<4)throw new Error(`Invalid Deep Cut prompt: ${p?.id||'unknown'}`);
    if(ids.has(p.id))throw new Error(`Duplicate Deep Cut prompt id: ${p.id}`);ids.add(p.id);
    const accepted=new Set();
    for(const a of p.answers){
      if(!a?.name)throw new Error(`Deep Cut prompt ${p.id} has an answer without a name`);
      for(const raw of [a.name,...(Array.isArray(a.aliases)?a.aliases:[])]){
        const key=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
        if(!key)throw new Error(`Deep Cut prompt ${p.id} has an empty answer`);
        if(accepted.has(key))throw new Error(`Duplicate Deep Cut answer/alias ${raw} in ${p.id}`);
        accepted.add(key);
      }
    }
  }
}
function buildDeepCutPuzzles(prompts,startDate,days){
  validateDeepCutPrompts(prompts);
  const usage=Array(prompts.length).fill(0),last=Array(prompts.length).fill(-999),puzzles=[],seen=new Set();
  for(let day=0;day<days;day++){
    const rnd=mulberry32(hashString(`${startDate}::deep-cut::${day}`));
    const ranked=prompts.map((_,i)=>({i,use:usage[i],last:last[i],r:rnd()})).sort((a,b)=>a.use-b.use||a.last-b.last||a.r-b.r);
    const chosen=[];
    for(const c of ranked){
      if(chosen.length===8)break;
      if(day-c.last<8)continue;
      chosen.push(c.i);
    }
    if(chosen.length<8){for(const c of ranked){if(chosen.length===8)break;if(!chosen.includes(c.i))chosen.push(c.i)}}
    const sig=chosen.join(':');
    if(seen.has(sig))throw new Error(`Duplicate Deep Cut daily set on day ${day}`);seen.add(sig);
    for(const i of chosen){usage[i]++;last[i]=day}
    puzzles.push(chosen);
  }
  return puzzles;
}
function buildYearPack({wordBank,groups,links,trails,steps,deepCuts,startDate,days}){
  const letterPool = [];
  for(const len of Object.keys(wordBank).map(Number).sort((a,b)=>a-b)) wordBank[len].forEach((_, idx) => letterPool.push({ length: len, answerIndex: idx }));
  const lrnd=mulberry32(hashString(startDate+"::clue-morning::letter"));
  const legacyLength=5+Math.floor(lrnd()*6);
  const legacyAnswerIndex=Math.floor(lrnd()*wordBank[legacyLength].length);
  const legacyGroupsIndex=Math.floor(mulberry32(hashString(startDate+"::clue-morning::groups"))()*groups.length);
  const legacyTrailIndex=Math.floor(mulberry32(hashString(startDate+"::clue-morning::trail"))()*Math.min(trails.length,12));
  const legacyLinkIndex=Math.floor(mulberry32(hashString(startDate+"::clue-morning::link"))()*links.length);
  const startFlat = Math.max(0, letterPool.findIndex(x => x.length===legacyLength && x.answerIndex===legacyAnswerIndex));
  const pack = [];
  for(let day=0; day<days; day++){
    const lp = letterPool[(startFlat + day*37) % letterPool.length];
    pack.push({
      length: day===0 ? legacyLength : lp.length,
      answerIndex: day===0 ? legacyAnswerIndex : lp.answerIndex,
      groupsIndex: day===0 ? legacyGroupsIndex : (legacyGroupsIndex + day*5) % groups.length,
      trailIndex: day===0 ? legacyTrailIndex : day % trails.length,
      linkIndex: day===0 ? legacyLinkIndex : (legacyLinkIndex + day*7) % links.length,
      stepsIndex: day % steps.length,
      deepCutIndex: day % deepCuts.length,
    });
  }
  return pack;
}
function renderModule({wordBank,groups,trails,links,stepsDictionary,steps,deepCutPrompts,deepCuts,startDate,yearPack}){
  return [
    `export const WORD_BANK = ${JSON.stringify(wordBank)};`,
    `export const GROUP_PUZZLES = ${JSON.stringify(groups)};`,
    `export const TRAIL_PUZZLES = ${JSON.stringify(trails)};`,
    `export const LINK_PUZZLES = ${JSON.stringify(links)};`,
    `export const WORD_STEPS_DICTIONARY = ${JSON.stringify(stepsDictionary)};`,
    `export const WORD_STEPS_PUZZLES = ${JSON.stringify(steps)};`,
    `export const DEEP_CUT_PROMPTS = ${JSON.stringify(deepCutPrompts)};`,
    `export const DEEP_CUT_PUZZLES = ${JSON.stringify(deepCuts)};`,
    `export const YEAR_PACK_START = ${JSON.stringify(startDate)};`,
    `export const YEAR_PACK = ${JSON.stringify(yearPack)};`,
    ""
  ].join("\n\n");
}
async function main(){
  const schedule = await readJson(path.join(sourceDir, "schedule.json"));
  const groups = await readJson(path.join(sourceDir, "groups.json"));
  const links = await readJson(path.join(sourceDir, "links.json"));
  const deepCutPrompts = await readJson(path.join(sourceDir, "deepcut_prompts.json"));
  const commonStepWords = await readLines(path.join(sourceDir, "steps_common_words.txt"));
  const trailSeeds = await readJson(path.join(sourceDir, "trail_seeds.json"));
  const lexicon = await readLines(lexiconPath);
  const wordBank = {};
  for(const len of [5,6,7,8,9,10]) wordBank[len] = await readLines(path.join(sourceDir, "word_bank", `${len}.txt`));
  const trie = makeTrie(lexicon);
  const trails = trailSeeds.map(seed => {
    const grid = seed.grid.map(ch => normalizeWord(ch));
    const longest = normalizeWord(seed.longest);
    const words = solveTrailBoard(grid, trie);
    if(!trailPathValid(longest, grid)) throw new Error(`Invalid longest Trail word path: ${longest}`);
    if(!words.includes(longest)) words.push(longest);
    words.sort((a,b)=>a.length-b.length||a.localeCompare(b));
    if(words.length < 20) throw new Error(`Trail board too thin: ${longest}`);
    return { grid, longest, words };
  });
  if(trails.length < schedule.days) throw new Error(`Need at least ${schedule.days} Trail boards, found ${trails.length}`);
  const stepBuild=buildWordSteps(commonStepWords,lexicon,schedule.startDate,schedule.days);
  const deepCuts=buildDeepCutPuzzles(deepCutPrompts,schedule.startDate,schedule.days);
  const yearPack = buildYearPack({ wordBank, groups, links, trails, steps:stepBuild.puzzles, deepCuts, startDate: schedule.startDate, days: schedule.days });
  if(new Set(yearPack.map(x => `${x.length}:${x.answerIndex}:${x.groupsIndex}:${x.trailIndex}:${x.linkIndex}:${x.stepsIndex}:${x.deepCutIndex}`)).size !== yearPack.length) throw new Error("Year pack contains duplicate full daily sets");
  const manifest = { rebuiltAt: new Date().toISOString(), yearPackStart: schedule.startDate, yearPackDays: yearPack.length, wordBankCounts: Object.fromEntries(Object.entries(wordBank).map(([k,v])=>[k,v.length])), groups: groups.length, links: links.length, trailBoards: trails.length, wordSteps: stepBuild.puzzles.length, wordStepsDictionary: stepBuild.dictionary.length, deepCutPrompts: deepCutPrompts.length, deepCutDailySets: deepCuts.length };
  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, "year_pack.json"), JSON.stringify(yearPack, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(generatedDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(generatedDir, "trail_solutions.json"), JSON.stringify(trails, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(generatedDir, "word_steps.json"), JSON.stringify(stepBuild.puzzles, null, 2) + "\n", "utf8");
  await fs.writeFile(path.join(generatedDir, "deep_cut.json"), JSON.stringify(deepCuts, null, 2) + "\n", "utf8");
  await fs.writeFile(outputPath, renderModule({wordBank,groups,trails,links,stepsDictionary:stepBuild.dictionary,steps:stepBuild.puzzles,deepCutPrompts,deepCuts,startDate:schedule.startDate,yearPack}), "utf8");
  console.log(`Rebuilt content: ${yearPack.length} scheduled days, ${trails.length} Trail boards, ${stepBuild.puzzles.length} Word Steps, ${deepCutPrompts.length} Deep Cut prompts.`);
}
main().catch(err => { console.error(err); process.exit(1); });
