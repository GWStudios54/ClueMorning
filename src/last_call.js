const ROUNDS=[
  {id:'world-cup-champs',tag:'SPORTS',prompt:'Which six of these countries have won the men’s FIFA World Cup through 2022?',safe:['Brazil','Germany','Italy','Argentina','France','Spain'],bust:['Netherlands','Portugal','Belgium','Croatia','Mexico','Sweden']},
  {id:'nolan-films',tag:'FILM',prompt:'Which six of these films were directed by Christopher Nolan?',safe:['Inception','Memento','Dunkirk','Interstellar','The Prestige','Oppenheimer'],bust:['Arrival','Fight Club','Sicario','Gravity','Zodiac','1917']},
  {id:'pixar-features',tag:'FILM',prompt:'Which six of these are Pixar feature films?',safe:['Toy Story','Cars','Ratatouille','WALL-E','Up','Coco'],bust:['Shrek','Frozen','Ice Age','Rio','Bolt','Moana']},
  {id:'beatles-albums',tag:'MUSIC',prompt:'Which six of these belong to the Beatles’ core UK studio-album catalogue?',safe:['Abbey Road','Revolver','Rubber Soul','Help!','Let It Be','Sgt. Pepper’s Lonely Hearts Club Band'],bust:['Pet Sounds','Rumours','Tommy','Led Zeppelin IV','The Wall','A Night at the Opera']},
  {id:'germany-borders',tag:'GEOGRAPHY',prompt:'Which six of these countries share a land border with Germany?',safe:['Denmark','Poland','Czechia','Austria','Switzerland','France'],bust:['Italy','Croatia','Spain','Hungary','Slovenia','Lithuania']},
  {id:'brazil-borders',tag:'GEOGRAPHY',prompt:'Which six of these countries share a land border with Brazil?',safe:['Argentina','Bolivia','Colombia','Peru','Venezuela','Uruguay'],bust:['Mexico','Chile','Ecuador','Panama','Costa Rica','Nicaragua']},
  {id:'people-elements',tag:'SCIENCE',prompt:'Which six of these chemical elements were named after people?',safe:['Einsteinium','Curium','Fermium','Mendelevium','Nobelium','Copernicium'],bust:['Oxygen','Neon','Argon','Silver','Tin','Sulfur']},
  {id:'greek-letters',tag:'LANGUAGE',prompt:'Which six of these are letters of the Greek alphabet?',safe:['Alpha','Beta','Gamma','Delta','Lambda','Omega'],bust:['Taurus','Orion','Vega','Aquila','Sirius','Lyra']},
  {id:'shakespeare-tragedies',tag:'LITERATURE',prompt:'Which six of these Shakespeare plays are tragedies?',safe:['Hamlet','Macbeth','Othello','King Lear','Romeo and Juliet','Julius Caesar'],bust:['Twelfth Night','Much Ado About Nothing','As You Like It','The Tempest','A Midsummer Night’s Dream','The Taming of the Shrew']},
  {id:'summer-olympic-hosts',tag:'SPORTS',prompt:'Which six of these countries hosted the Summer Olympics by the end of 2024?',safe:['Greece','France','United Kingdom','United States','Japan','China'],bust:['India','South Africa','Egypt','Argentina','Indonesia','Turkey']},
  {id:'si-base-units',tag:'SCIENCE',prompt:'Which six of these are SI base units rather than derived units?',safe:['second','metre','kilogram','ampere','kelvin','mole'],bust:['newton','joule','watt','pascal','volt','ohm']},
  {id:'states-no-a',tag:'GEOGRAPHY',prompt:'Which six of these U.S. states contain no letter A in their names?',safe:['Ohio','Illinois','Missouri','Mississippi','Tennessee','Kentucky'],bust:['Alabama','California','Texas','Alaska','Nevada','Kansas']},
  {id:'best-picture',tag:'FILM',prompt:'Which six of these films won the Academy Award for Best Picture?',safe:['Gladiator','Chicago','The Departed','No Country for Old Men','The Hurt Locker','Parasite'],bust:['Brokeback Mountain','Avatar','La La Land','The Social Network','Gravity','Mad Max: Fury Road']},
  {id:'chinese-zodiac',tag:'CULTURE',prompt:'Which six of these animals are in the Chinese zodiac?',safe:['Rat','Ox','Tiger','Rabbit','Dragon','Snake'],bust:['Cat','Bear','Wolf','Eagle','Fox','Lion']},
  {id:'ancient-wonders',tag:'HISTORY',prompt:'Which six of these belong to the Seven Wonders of the Ancient World?',safe:['Great Pyramid of Giza','Hanging Gardens of Babylon','Statue of Zeus at Olympia','Temple of Artemis at Ephesus','Mausoleum at Halicarnassus','Colossus of Rhodes'],bust:['Stonehenge','Colosseum','Great Wall of China','Petra','Machu Picchu','Taj Mahal']},
  {id:'gen1-pokemon-types',tag:'GAMES',prompt:'Which six of these were Pokémon types in Generation I?',safe:['Fire','Water','Electric','Psychic','Ghost','Dragon'],bust:['Dark','Steel','Fairy','Light','Sound','Cosmic']}
];

function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(values,seed){const out=[...values],r=rng(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}

export function lastCallForDate(date){
  const round=ROUNDS[hashString(`last-call:${date}`)%ROUNDS.length];
  const entries=[...round.safe.map((label,i)=>({id:`s${i}`,label,correct:true})),...round.bust.map((label,i)=>({id:`b${i}`,label,correct:false}))];
  const options=shuffle(entries,hashString(`last-call-options:${date}:${round.id}`));
  return {round,options};
}
export function publicLastCall(date){
  const {round,options}=lastCallForDate(date);
  return {id:round.id,tag:round.tag,prompt:round.prompt,safeCount:round.safe.length,options:options.map(({id,label})=>({id,label}))};
}
export function checkLastCall(date,optionId){
  const {options}=lastCallForDate(date),option=options.find(x=>x.id===String(optionId||''));
  if(!option)return null;
  return {id:option.id,label:option.label,correct:option.correct};
}
export function revealLastCall(date){
  const {options}=lastCallForDate(date);
  return options.map(({id,label,correct})=>({id,label,correct}));
}
export const LAST_CALL_ROUNDS=ROUNDS.length;
