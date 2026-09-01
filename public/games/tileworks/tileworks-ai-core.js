const VALUES={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10};
let DICT=new Set(),BY_LENGTH=new Map(),POS_INDEX=new Map(),ready=false;
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const EVERYDAY=new Set(`
AM AN AS AT BE BY DO GO HE IF IN IS IT ME MY NO OF OH ON OR SO TO UP US WE
ACE ACT ADD AGE AGO AID AIM AIR ALL AND ANY ARE ARM ART ASK ATE BAD BAG BAR BAT BAY BED BEE BET BIG BIT BOX BOY BUS BUY CAN CAR CAT COP COW CRY CUP CUT DAY DID DIE DIG DOG DRY EAR EAT END FAR FAT FEW FIT FIX FLY FOR FUN GET GOD GOT GUN GUY HAD HAS HAT HER HIM HIS HIT HOT HOW ICE JOB JOY KEY KID LAW LAY LEG LET LIE LOT LOW MAD MAN MAP MAY MEN MET MIX MOM MUD NEW NOT NOW ODD OFF OLD ONE OUR OUT OWN PAY PEN PET PIE PIG PIN PUT RED RID RUN SAD SAT SAY SEA SEE SET SHE SHY SIR SIT SIX SKY SON SUN TEN THE TIE TOP TOY TRY TWO USE WAR WAY WHO WHY WIN YES YET YOU
ABLE ACID AGED ALSO AREA ARMY AWAY BABY BACK BALL BAND BANK BASE BATH BEAR BEAT BEEN BEER BELL BELT BEST BILL BIRD BLOW BLUE BOAT BODY BOMB BOND BONE BOOK BOOM BOOT BORN BOSS BOTH BOWL BULK BURN BUSH BUSY CAKE CALL CALM CAME CAMP CARD CARE CASE CASH CAST CELL CHAT CHIP CITY CLUB COAL COAT CODE COLD COME COOK COOL COPE COPY CORD CORE COST CREW CROP DARK DATA DATE DAWN DAYS DEAD DEAL DEAR DEBT DEEP DESK DIAL DIET DOOR DOWN DRAW DROP DRUG EACH EARN EASE EAST EASY EDGE ELSE EVEN EVER FACE FACT FAIL FAIR FALL FARM FAST FATE FEAR FEED FEEL FEET FELL FELT FILE FILL FILM FIND FINE FIRE FIRM FISH FIVE FLAT FLOW FOOD FOOT FORD FORM FORT FOUR FREE FROM FUEL FULL FUND GAIN GAME GATE GAVE GEAR GENE GIFT GIRL GIVE GLAD GOAL GOES GOLD GOLF GONE GOOD GRAY GREW GROW HALF HALL HAND HANG HARD HARM HATE HAVE HEAD HEAR HEAT HELD HELL HELP HERE HERO HIGH HILL HIRE HOLD HOLE HOLY HOME HOPE HOST HOUR HUGE HUNT IDEA INCH INTO IRON ITEM JACK JAIL JOIN JUMP JUST KEEP KEPT KICK KILL KIND KING KNEE KNEW KNOW LACK LADY LAID LAKE LAND LANE LAST LATE LEAD LEFT LEND LESS LIFE LIFT LIKE LINE LINK LIST LIVE LOAD LOAN LOCK LONG LOOK LORD LOSE LOST LOVE LUCK MADE MAIL MAIN MAKE MALE MANY MARK MASS MEAL MEAN MEAT MEET MENU MILE MILK MIND MINE MISS MODE MOON MORE MOVE MUCH MUST NAME NEAR NECK NEED NEWS NEXT NICE NINE NONE NOSE NOTE OKAY ONCE ONLY ONTO OPEN OVER PACE PACK PAGE PAID PAIN PAIR PARK PART PASS PAST PATH PEAK PICK PINK PIPE PLAN PLAY PLOT POOL POOR PORT POST PULL PURE PUSH RACE RAIN RANK RATE READ REAL REAR RENT REST RICE RICH RIDE RING RISE ROAD ROCK ROLE ROOM ROOT ROSE RULE SAFE SAID SALE SALT SAME SAND SAVE SEAT SEED SEEK SEEM SEEN SELL SEND SENT SHIP SHOP SHOT SHOW SHUT SICK SIDE SIGN SITE SIZE SKIN SLOW SNOW SOFT SOIL SOLD SOLE SOME SONG SOON SORT SOUL STAR STAY STEP STOP SUCH SUIT SURE TAKE TALE TALK TALL TANK TAPE TASK TEAM TEAR TELL TEND TERM TEST TEXT THAN THAT THEM THEN THEY THIN THIS TIME TINY TOLD TOLL TONE TOOK TOOL TOUR TOWN TREE TRIP TRUE TURN TYPE UNIT UPON USED USER VARY VAST VERY VIEW VOTE WAGE WAIT WAKE WALK WALL WANT WARD WARM WASH WAVE WAYS WEAK WEAR WEEK WELL WENT WERE WEST WHAT WHEN WIDE WIFE WILD WILL WIND WINE WING WIRE WISE WISH WITH WOOD WORD WORE WORK YARD YEAR YOUR ZERO ZONE
APPLE BLADE BRAVE BRICK CANDY CHAIR CHARM CLOUD CRANE CROWN DREAM DRIFT EARTH FIELD FLAME GLASS GRAPE HONEY HOUSE LIGHT MARCH METAL MONEY NIGHT OCEAN PAPER PEARL PLANT PRIDE QUIET RIVER ROBIN SHORE SMILE SOLAR STONE STORM TABLE TIGER TRAIL WATER WHEAT WORLD YOUTH ABOUT ABOVE AFTER AGAIN ALONE ALONG AMONG ANGEL ANGRY BEACH BEGIN BLACK BREAD BREAK BRING BROWN BUILD CARRY CATCH CAUSE CLEAN CLEAR CLOSE COULD DANCE DRINK DRIVE EARLY EMPTY ENJOY ENTER EVERY FAITH FLOOR FOCUS FORCE FRAME FRESH FRONT FRUIT FUNNY GREAT GREEN GROUP HAPPY HEART HEAVY HORSE HOTEL HUMAN IDEAL IMAGE LARGE LATER LEARN LEAVE LEMON LEVEL MAGIC MAJOR MAYBE MIGHT MUSIC NEVER NORTH OTHER PARTY PEACE PHONE PLACE PLAIN PLANE POWER PRICE PROUD QUICK REACH RIGHT ROUND SCORE SHORT SMALL SOUND SOUTH SPACE SPEAK SPEED SPEND START STILL SWEET TEACH THEIR THERE THESE THING THINK THREE UNDER VALUE VOICE WATCH WHITE WHOLE WOMAN WRITE WRONG YOUNG
ANCHOR BASKET BRIDGE BREEZE BRIGHT CANDLE CASTLE CIRCLE COPPER DESERT FOREST GARDEN GOLDEN HARBOR ISLAND JACKET LITTLE MAGNET MARBLE MARKET MEADOW MIRROR MONKEY ORANGE PEBBLE POCKET RABBIT SILVER SPRING STREAM SUMMER THUNDER TRAVEL VALLEY WINTER YELLOW ACTION ALMOST ALWAYS ANSWER AROUND BEAUTY BEFORE BETTER BORDER BOTTLE BRANCH BUTTON CAMERA CHANGE CHOICE CHURCH COFFEE CORNER COUPLE COURSE DANGER DINNER DOCTOR DOLLAR FAMILY FATHER FRIEND FUTURE GROUND HEALTH INSIDE LETTER MIDDLE MOTHER NUMBER OFFICE PEOPLE PERSON PLAYER POINTS PRETTY PUBLIC SCHOOL SECOND SHOULD SIMPLE SINGLE STREET STRONG SYSTEM THANKS THOUGH TODAY TOGETHER WINDOW
`.trim().split(/\s+/));

const STANDARD_EXTRA=new Set(`
ANCHORS BALANCE CAPTAIN CARAMEL COMPASS CRYSTAL DOLPHIN FARMERS FESTIVE HARVEST JOURNAL KINGDOM LANTERN MACHINE MORNING MOUNTAIN MYSTERY ORCHARD PAINTER RAINBOW SAILORS THUNDER VILLAGE WHISPER WILDLIFE
BLUEBIRD CAMPFIRE CROSSING ELEPHANT FOUNTAIN HILLSIDE KEYBOARD NOTEBOOK PAINTING RAINDROP SEASHELL STARLIGHT TREASURE UMBRELLA WINDMILL WOODLAND SNOWBALL MOONBEAM SUNRISES BOOKSHELF
ABILITY ACCOUNT ADDRESS ADVICE AGAINST ALREADY ANOTHER ANYTHING APPEAR APPROACH ARTICLE BECAUSE BECOME BEHIND BELIEVE BENEFIT BETWEEN BUSINESS CERTAIN CHANCE COMPANY CONTROL COUNTRY CREATE CULTURE DECIDE DIFFERENCE EARTHLY ENOUGH EXAMPLE EXPERIENCE EXPLAIN FAVORITE FINALLY FOLLOW FORWARD FRIENDLY GENERAL HISTORY IMPORTANT INCLUDE INTEREST LANGUAGE LARGEST MEETING MOMENT NATURAL NOTHING OPINION OUTSIDE PERFECT PROBLEM QUESTION REALLY REASON RESULT RETURN SERVICE SPECIAL STORY STUDENT SUPPORT THROUGH TOWARD TRUTH USING USUALLY WATERED WITHOUT WORKING
`.trim().split(/\s+/));

function normalize(v){return String(v||'').toUpperCase().replace(/[^A-Z]/g,'')}
function idx(r,c,size){return r*size+c}
function rc(i,size){return[Math.floor(i/size),i%size]}
function inside(r,c,size){return r>=0&&c>=0&&r<size&&c<size}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

function commonStem(word){
  const candidates=[];
  if(word.endsWith('IES')&&word.length>4)candidates.push(word.slice(0,-3)+'Y');
  if(word.endsWith('ES')&&word.length>4)candidates.push(word.slice(0,-2),word.slice(0,-1));
  if(word.endsWith('S')&&word.length>3)candidates.push(word.slice(0,-1));
  if(word.endsWith('ING')&&word.length>5)candidates.push(word.slice(0,-3),word.slice(0,-3)+'E');
  if(word.endsWith('ED')&&word.length>4)candidates.push(word.slice(0,-2),word.slice(0,-1),word.slice(0,-2)+'E');
  if(word.endsWith('ER')&&word.length>4)candidates.push(word.slice(0,-2),word.slice(0,-1));
  if(word.endsWith('LY')&&word.length>4)candidates.push(word.slice(0,-2));
  return candidates;
}
function beginnerFriendly(word){
  if(EVERYDAY.has(word))return true;
  if(word.length<=6&&word.endsWith('S')&&EVERYDAY.has(word.slice(0,-1)))return true;
  return false;
}
function standardFriendly(word){
  if(EVERYDAY.has(word)||STANDARD_EXTRA.has(word))return true;
  for(const stem of commonStem(word))if(EVERYDAY.has(stem)||STANDARD_EXTRA.has(stem))return true;
  return false;
}
function wordAllowed(word,difficulty){
  if(difficulty==='beginner')return word.length<=6&&beginnerFriendly(word);
  if(difficulty==='standard')return word.length<=9&&standardFriendly(word);
  return true;
}

async function init(){
  const r=await fetch('/trail-lexicon.txt',{cache:'force-cache'}),text=await r.text(),words=[...new Set(text.split(/\s+/).map(normalize).filter(w=>w.length>=2&&w.length<=19))];
  for(const w of words){if(!BY_LENGTH.has(w.length))BY_LENGTH.set(w.length,[]);BY_LENGTH.get(w.length).push(w)}
  for(const [len,list] of BY_LENGTH){const per=Array.from({length:len},()=>new Map());for(const w of list)for(let p=0;p<len;p++){const m=per[p],ch=w[p];if(!m.has(ch))m.set(ch,[]);m.get(ch).push(w)}POS_INDEX.set(len,per)}
  DICT=new Set(words);ready=true;postMessage({type:'ready',count:DICT.size});
}
function occupied(board,i){return !!board[i]}
function adjacentPerpendicular(board,i,orientation,size){const[r,c]=rc(i,size),dirs=orientation==='H'?[[1,0],[-1,0]]:[[0,1],[0,-1]];return dirs.some(([dr,dc])=>inside(r+dr,c+dc,size)&&occupied(board,idx(r+dr,c+dc,size)))}
function crossPattern(board,i,orientation,size){
  const[r,c]=rc(i,size),dr=orientation==='H'?1:0,dc=orientation==='H'?0:1;let rr=r-dr,cc=c-dc,prefix='';while(inside(rr,cc,size)&&board[idx(rr,cc,size)]){prefix=board[idx(rr,cc,size)].letter+prefix;rr-=dr;cc-=dc}rr=r+dr;cc=c+dc;let suffix='';while(inside(rr,cc,size)&&board[idx(rr,cc,size)]){suffix+=board[idx(rr,cc,size)].letter;rr+=dr;cc+=dc}return {prefix,suffix}
}
function crossAllowed(board,i,orientation,size,cache,difficulty){
  const key=`${difficulty}:${orientation}:${i}`;if(cache.has(key))return cache.get(key);const {prefix,suffix}=crossPattern(board,i,orientation,size);if(!prefix&&!suffix){cache.set(key,null);return null}const set=new Set();for(const ch of ALPHABET){const word=prefix+ch+suffix;if(DICT.has(word)&&wordAllowed(word,difficulty))set.add(ch)}cache.set(key,set);return set
}
function getPool(len,fixed){const list=BY_LENGTH.get(len)||[];if(!fixed.length)return list;const per=POS_INDEX.get(len);let best=list;for(const f of fixed){const arr=per?.[f.pos]?.get(f.letter)||[];if(arr.length<best.length)best=arr}return best}
function assignRack(word,emptyPositions,rack){
  const used=new Set(),assign=[];for(const p of emptyPositions){const ch=word[p];let found=-1;for(let i=0;i<rack.length;i++)if(!used.has(i)&&!rack[i].blank&&rack[i].letter===ch){found=i;break}if(found<0)for(let i=0;i<rack.length;i++)if(!used.has(i)&&rack[i].blank){found=i;break}if(found<0)return null;used.add(found);assign.push({pos:p,rackIndex:found,letter:ch,blank:!!rack[found].blank,value:rack[found].blank?0:VALUES[ch]})}return assign
}
function wordCells(start,line,len,orientation,size){const cells=[];for(let p=0;p<len;p++)cells.push(orientation==='H'?idx(line,start+p,size):idx(start+p,line,size));return cells}
function wordScore(cells,placements,board,bonuses){let sum=0,mult=1;const pmap=new Map(placements.map(p=>[p.index,p]));for(const i of cells){const p=pmap.get(i),tile=p||board[i];let val=tile.value;if(p){const b=bonuses[i];if(b==='dl')val*=2;if(b==='tl')val*=3;if(b==='dw'||b==='start')mult*=2;if(b==='tw')mult*=3}sum+=val}return sum*mult}
function crossCells(board,placement,orientation,size){const[r,c]=rc(placement.index,size),dr=orientation==='H'?1:0,dc=orientation==='H'?0:1;let rr=r-dr,cc=c-dc,before=[];while(inside(rr,cc,size)&&board[idx(rr,cc,size)]){before.unshift(idx(rr,cc,size));rr-=dr;cc-=dc}rr=r+dr;cc=c+dc;const after=[];while(inside(rr,cc,size)&&board[idx(rr,cc,size)]){after.push(idx(rr,cc,size));rr+=dr;cc+=dc}return [...before,placement.index,...after]}
function scoreCandidate(mainCells,placements,board,bonuses,orientation,size){let score=wordScore(mainCells,placements,board,bonuses);for(const p of placements){const cells=crossCells(board,p,orientation,size);if(cells.length>1)score+=wordScore(cells,placements,board,bonuses)}if(placements.length===7)score+=50;return score}
function leaveScore(rack,used){const left=rack.filter((_,i)=>!used.includes(i));if(!left.length)return 18;let score=0,v=0,c=0;const counts={};for(const t of left){if(t.blank){score+=20;continue}counts[t.letter]=(counts[t.letter]||0)+1;if('AEIOU'.includes(t.letter))v++;else c++;score+=({S:4,E:3,R:3,A:2,I:2,N:2,T:2,L:1,D:1,U:1}[t.letter]||0)}for(const n of Object.values(counts))if(n>1)score-=(n-1)*2;if(counts.Q&&!counts.U)score-=13;if(counts.U&&!counts.Q)score-=1;if(v===0||c===0)score-=7;else if(Math.abs(v-c)<=2)score+=4;return score}
function rackPoints(rack,used=[]){const set=new Set(used);return rack.reduce((n,t,i)=>n+(set.has(i)?0:(t.value||0)),0)}
function exposureRisk(board,bonuses,size){let risk=0;for(const [k,b] of Object.entries(bonuses)){if(!['tw','dw','tl','dl'].includes(b))continue;const i=Number(k);if(board[i])continue;const[r,c]=rc(i,size);let near=false;for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]])if(inside(r+dr,c+dc,size)&&board[idx(r+dr,c+dc,size)])near=true;if(near)risk+=b==='tw'?8:b==='dw'?5:b==='tl'?2.5:1.5}return risk}
function evaluate(move,rack,board,bonuses,size,difficulty,bagCount,beforeRisk){
  const leave=leaveScore(rack,move.usedRackIndices);if(difficulty==='beginner')return move.score;if(difficulty==='standard')return move.score+.25*leave;
  const after=board.map(x=>x?{...x}:null);for(const p of move.placements)after[p.index]={letter:p.letter,value:p.value,blank:p.blank};const control=beforeRisk-exposureRisk(after,bonuses,size);
  if(difficulty==='hard')return move.score+.62*leave+.5*control;
  let v=move.score+1.2*leave+1.15*control;if(move.usedRackIndices.length===7)v+=24;if(bagCount<=7)v+=(rackPoints(rack)-rackPoints(rack,move.usedRackIndices))*.7;if(bagCount===0&&move.usedRackIndices.length===rack.length)v+=150;return v
}
function difficultyMaxLen(d,size){return d==='beginner'?Math.min(6,size):d==='standard'?Math.min(9,size):d==='hard'?Math.min(13,size):size}
function legalMoves(board,rack,size,bonuses,difficulty,bagCount){
  const first=board.every(x=>!x),center=idx(Math.floor(size/2),Math.floor(size/2),size),crossCache=new Map(),moves=[],maxLen=difficultyMaxLen(difficulty,size),beforeRisk=exposureRisk(board,bonuses,size);let examined=0;
  for(const orientation of ['H','V'])for(let line=0;line<size;line++)for(let start=0;start<size;start++){
    for(let len=2;len<=Math.min(maxLen,size-start);len++){
      const prev=orientation==='H'?(start?idx(line,start-1,size):-1):(start?idx(start-1,line,size):-1),nextPos=start+len,next=orientation==='H'?(nextPos<size?idx(line,nextPos,size):-1):(nextPos<size?idx(nextPos,line,size):-1);if((prev>=0&&board[prev])||(next>=0&&board[next]))continue;
      const cells=wordCells(start,line,len,orientation,size),fixed=[],empty=[];for(let p=0;p<len;p++){const t=board[cells[p]];if(t)fixed.push({pos:p,letter:t.letter});else empty.push(p)}if(!empty.length||empty.length>rack.length)continue;if(first&&!cells.includes(center))continue;if(!first&&!fixed.length&&!empty.some(p=>adjacentPerpendicular(board,cells[p],orientation,size)))continue;
      const allowed=new Map();let impossible=false;for(const p of empty){const a=crossAllowed(board,cells[p],orientation,size,crossCache,difficulty);if(a&&a.size===0){impossible=true;break}allowed.set(p,a)}if(impossible)continue;
      const pool=getPool(len,fixed);for(const word of pool){if(!wordAllowed(word,difficulty))continue;let ok=true;for(const f of fixed)if(word[f.pos]!==f.letter){ok=false;break}if(!ok)continue;for(const p of empty){const a=allowed.get(p);if(a&&!a.has(word[p])){ok=false;break}}if(!ok)continue;const assigned=assignRack(word,empty,rack);if(!assigned)continue;const placements=assigned.map(a=>({index:cells[a.pos],letter:a.letter,value:a.value,blank:a.blank,rackIndex:a.rackIndex})),usedRackIndices=assigned.map(a=>a.rackIndex),score=scoreCandidate(cells,placements,board,bonuses,orientation,size),move={word,orientation,start,line,placements,usedRackIndices,score};move.eval=evaluate(move,rack,board,bonuses,size,difficulty,bagCount,beforeRisk);moves.push(move);examined++}
    }
  }
  return {moves,examined}
}
function chooseMove(moves,difficulty,board,rack){
  if(!moves.length)return null;moves.sort((a,b)=>b.eval-a.eval||b.score-a.score||b.word.length-a.word.length||a.word.localeCompare(b.word));if(difficulty==='grandmaster')return moves[0];
  const seed=hash(board.map(x=>x?.letter||'.').join('')+'|'+rack.map(x=>x.letter).join('')+'|'+difficulty),bestScore=Math.max(...moves.map(m=>m.score));
  const profile=difficulty==='beginner'?{lo:.45,hi:.62,spread:.1}:difficulty==='standard'?{lo:.7,hi:.84,spread:.08}:{lo:.89,hi:.97,spread:.045};
  const frac=profile.lo+((seed%1000)/999)*(profile.hi-profile.lo),target=bestScore*frac;
  const ranked=[...moves].sort((a,b)=>Math.abs(a.score-target)-Math.abs(b.score-target)||b.eval-a.eval||b.score-a.score);
  const near=ranked.filter(m=>Math.abs(m.score-target)<=Math.max(2,bestScore*profile.spread)).slice(0,difficulty==='beginner'?7:difficulty==='standard'?5:3);
  const pool=near.length?near:ranked.slice(0,difficulty==='beginner'?5:difficulty==='standard'?4:2);return pool[seed%pool.length]
}
onmessage=async e=>{const d=e.data||{};if(d.type==='init'){if(!ready)await init();return}if(d.type==='move'){if(!ready)await init();const {moves,examined}=legalMoves(d.board,d.rack,d.size,d.bonuses,d.difficulty,d.bagCount),move=chooseMove(moves,d.difficulty,d.board,d.rack),bestScore=moves.length?Math.max(...moves.map(m=>m.score)):0;postMessage({type:'move',move,meta:{examined,total:moves.length,bestScore,chosenEfficiency:move&&bestScore?Math.round(move.score/bestScore*100):0,vocabulary:d.difficulty==='beginner'?'everyday':d.difficulty==='standard'?'familiar':'full'}})}};
