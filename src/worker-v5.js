import core from './worker-v4.js';
import {runContentAiSchedule} from './content-ai.js';

const PLAY_TARGETS={
  grid:'letter',letter:'letter',groups:'groups',trail:'trail',link:'link',steps:'steps',
  deepcut:'deepcut','deep-cut':'deepcut',lastcall:'lastcall','last-call':'lastcall'
};

function legacyPlayRedirect(url){
  const raw=String(url.searchParams.get('play')||'').toLowerCase();
  const play=PLAY_TARGETS[raw]||'';
  const target=new URL('/',url);
  target.search='';
  if(play)target.hash=`play=${play}`;
  return Response.redirect(target.toString(),301);
}

async function polishDeepLinks(response,path){
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replaceAll('/?play=','/#play=');
  if(path==='/games/last-call/')html=html.replace('href="/">Play today’s Last Call','href="/#play=lastcall">Play today’s Last Call');
  if(path==='/'||path==='/index.html'){
    if(!html.includes('/retention-hooks.css')){
      html=html.replace('</head>','<link rel="stylesheet" href="/retention-hooks.css?v=1">\n</head>');
    }
    if(!html.includes('/animation-overhaul.css')){
      html=html.replace('</head>','<link rel="stylesheet" href="/animation-overhaul.css?v=1">\n</head>');
    }
    if(!html.includes('/deep-link.js')){
      html=html.replace('</body>','<script src="/deep-link.js?v=1" defer></script>\n</body>');
    }
    if(!html.includes('/retention-hooks.js')){
      html=html.replace('</body>','<script src="/retention-hooks.js?v=1" defer></script>\n</body>');
    }
    if(!html.includes('/animation-overhaul.js')){
      html=html.replace('</body>','<script src="/animation-overhaul.js?v=1" defer></script>\n</body>');
    }
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='GET'&&(path==='/'||path==='/index.html')&&url.searchParams.has('play'))return legacyPlayRedirect(url);
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET')return polishDeepLinks(response,path);
    return response;
  },
  async scheduled(controller,env,ctx){
    try{if(core.scheduled)await core.scheduled(controller,env,ctx)}catch(error){console.error('Core scheduled task failed',error)}
    const scheduledAt=Number(controller?.scheduledTime)||Date.now();
    ctx.waitUntil(runContentAiSchedule(env,new Date(scheduledAt)).then(result=>{
      if(result?.ran)console.log('Workers AI content batch',JSON.stringify(result));
    }).catch(error=>console.error('Workers AI scheduled content task failed',error)));
  }
};
