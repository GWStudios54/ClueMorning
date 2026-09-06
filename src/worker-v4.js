import core from './worker-v3.js';
import {DEEP_CUT_PROMPTS} from './puzzles.js';

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
async function body(request){try{return await request.clone().json()}catch{return {}}}

function promptRecap(id){
  const prompt=DEEP_CUT_PROMPTS.find(row=>row.id===id);
  if(!prompt||!Array.isArray(prompt.answers)||!prompt.answers.length)return null;
  return {
    id:prompt.id,
    prompt:prompt.prompt,
    mostCommon:prompt.answers[0]?.name||'',
    rarest:prompt.answers.at(-1)?.name||''
  };
}

async function withPwaBootstrap(response){
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  const html=await response.text();
  if(html.includes('/pwa.js'))return new Response(html,response);
  const injected=html.replace('</body>','<script src="/pwa.js" defer></script>\n</body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/api/deepcut/recap'){
      const b=await body(request),ids=Array.isArray(b.promptIds)?b.promptIds.map(String).slice(0,8):[];
      if(!ids.length)return json({ok:false,error:'No Deep Cut prompts supplied.'},400);
      const rows=ids.map(promptRecap);
      if(rows.some(row=>!row))return json({ok:false,error:'Unknown Deep Cut prompt.'},400);
      return json({ok:true,rows});
    }
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return withPwaBootstrap(response);
    return response;
  }
};
