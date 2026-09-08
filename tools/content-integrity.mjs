export function normalizeContentKey(value){
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .trim()
    .toUpperCase()
    .replace(/&/g,'AND')
    .replace(/[^A-Z0-9]/g,'');
}

export function fourGroupsBoardIssues(board, boardIndex='?'){
  const issues=[];
  if(!Array.isArray(board)) return [`Board ${boardIndex} is not an array.`];
  if(board.length!==4) issues.push(`Board ${boardIndex} must contain exactly 4 groups; found ${board.length}.`);

  const names=new Map();
  const words=new Map();
  for(let groupIndex=0;groupIndex<board.length;groupIndex++){
    const group=board[groupIndex];
    if(!group || typeof group!=='object'){
      issues.push(`Board ${boardIndex}, group ${groupIndex} is not an object.`);
      continue;
    }
    const name=String(group.name ?? '').trim();
    const nameKey=normalizeContentKey(name);
    if(!nameKey) issues.push(`Board ${boardIndex}, group ${groupIndex} has no name.`);
    else if(names.has(nameKey)) issues.push(`Board ${boardIndex} repeats group name "${name}" (groups ${names.get(nameKey)} and ${groupIndex}).`);
    else names.set(nameKey,groupIndex);

    if(!Array.isArray(group.words)){
      issues.push(`Board ${boardIndex}, group "${name||groupIndex}" has no words array.`);
      continue;
    }
    if(group.words.length!==4) issues.push(`Board ${boardIndex}, group "${name||groupIndex}" must contain exactly 4 words; found ${group.words.length}.`);

    const local=new Set();
    for(const rawWord of group.words){
      const word=String(rawWord ?? '').trim();
      const key=normalizeContentKey(word);
      if(!key){
        issues.push(`Board ${boardIndex}, group "${name||groupIndex}" contains an empty word.`);
        continue;
      }
      if(local.has(key)) issues.push(`Board ${boardIndex}, group "${name||groupIndex}" repeats "${word}".`);
      local.add(key);
      if(words.has(key)){
        const previous=words.get(key);
        issues.push(`Board ${boardIndex} repeats tile "${word}" in "${previous.name}" and "${name||groupIndex}".`);
      }else words.set(key,{name:name||String(groupIndex),groupIndex});
    }
  }

  if(words.size!==16) issues.push(`Board ${boardIndex} must resolve to 16 unique tiles; found ${words.size}.`);
  return issues;
}

export function validateFourGroupsCollection(boards){
  const issues=[];
  if(!Array.isArray(boards)) return {valid:false,issues:['Four Groups source is not an array.']};
  const boardSignatures=new Map();
  const groupSignatures=new Map();
  for(let boardIndex=0;boardIndex<boards.length;boardIndex++){
    const board=boards[boardIndex];
    issues.push(...fourGroupsBoardIssues(board,boardIndex));
    if(!Array.isArray(board)) continue;

    const groups=[];
    for(const group of board){
      if(!group || !Array.isArray(group.words)) continue;
      const words=group.words.map(normalizeContentKey).filter(Boolean).sort();
      const signature=`${normalizeContentKey(group.name)}::${words.join('|')}`;
      if(groupSignatures.has(signature)) issues.push(`Board ${boardIndex} exactly repeats a group from board ${groupSignatures.get(signature)}: "${group.name}".`);
      else groupSignatures.set(signature,boardIndex);
      groups.push(signature);
    }
    const boardSignature=groups.sort().join('|||');
    if(boardSignature){
      if(boardSignatures.has(boardSignature)) issues.push(`Board ${boardIndex} exactly repeats board ${boardSignatures.get(boardSignature)}.`);
      else boardSignatures.set(boardSignature,boardIndex);
    }
  }
  return {valid:issues.length===0,issues};
}

export function deepCutAcceptedKeys(prompt){
  const keys=new Set();
  for(const answer of Array.isArray(prompt?.answers)?prompt.answers:[]){
    for(const raw of [answer?.name,...(Array.isArray(answer?.aliases)?answer.aliases:[])]){
      const key=normalizeContentKey(raw);
      if(key) keys.add(key);
    }
  }
  return keys;
}

export function deepCutPromptIssues(prompt,label=prompt?.id||'unknown'){
  const issues=[];
  if(!prompt?.id) issues.push(`${label} is missing an id.`);
  if(!String(prompt?.prompt??'').trim()) issues.push(`${label} is missing prompt text.`);
  if(!Array.isArray(prompt?.answers) || prompt.answers.length<4) issues.push(`${label} must have at least 4 canonical answers.`);
  const accepted=new Map();
  for(let answerIndex=0;answerIndex<(prompt?.answers?.length||0);answerIndex++){
    const answer=prompt.answers[answerIndex];
    if(!String(answer?.name??'').trim()) issues.push(`${label} answer ${answerIndex} has no name.`);
    for(const raw of [answer?.name,...(Array.isArray(answer?.aliases)?answer.aliases:[])]){
      const key=normalizeContentKey(raw);
      if(!key) continue;
      if(accepted.has(key) && accepted.get(key)!==answerIndex) issues.push(`${label} repeats accepted answer/alias "${raw}" across answer entries.`);
      else accepted.set(key,answerIndex);
    }
  }
  return issues;
}

export function deepCutSetAnswerCollisions(set,prompts){
  const collisions=[];
  const seen=new Map();
  for(const index of set||[]){
    const prompt=prompts?.[index];
    if(!prompt) continue;
    for(const key of deepCutAcceptedKeys(prompt)){
      if(seen.has(key) && seen.get(key).index!==index){
        const previous=seen.get(key);
        collisions.push({
          key,
          firstIndex:previous.index,
          firstId:previous.id,
          secondIndex:index,
          secondId:prompt.id
        });
      }else seen.set(key,{index,id:prompt.id});
    }
  }
  return collisions;
}

export function deepCutHistoryIssues(candidate,existingPrompts){
  const issues=[];
  const candidatePromptKey=normalizeContentKey(candidate?.prompt);
  const candidateAnswers=deepCutAcceptedKeys(candidate);
  for(const existing of existingPrompts||[]){
    if(candidatePromptKey && candidatePromptKey===normalizeContentKey(existing?.prompt)) issues.push(`Prompt text duplicates ${existing.id}.`);
    const overlap=[...candidateAnswers].filter(key=>deepCutAcceptedKeys(existing).has(key));
    if(overlap.length>=Math.min(4,Math.max(1,candidateAnswers.size))) issues.push(`Answer set overlaps heavily with ${existing.id} (${overlap.length} accepted forms).`);
  }
  return issues;
}
