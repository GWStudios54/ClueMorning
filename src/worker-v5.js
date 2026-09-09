// Clue Morning routing worker. Keep preview-only features gated, fail-open, and deploy-safe.
import core from './worker-v4.js';
import {runContentAiSchedule} from './content-ai.js';
import animationCssSource from './animation-overhaul.css.txt';
import animationJsSource from './animation-overhaul.js.txt';

const PLAY_TARGETS={
  grid:'letter',letter:'letter',groups:'groups',trail:'trail',link:'link',steps:'steps',
  deepcut:'deepcut','deep-cut':'deepcut',lastcall:'lastcall','last-call':'lastcall'
};

// Wrangler bundles .txt imports into the Worker. Preview visitors therefore receive
// animation code inline with the HTML response: no CDN and no standalone asset request.
const INLINE_ANIMATION_CSS=animationCssSource.replaceAll('</style','<\\/style');
const INLINE_ANIMATION_JS=animationJsSource.replaceAll('</script','<\\/script');
const INLINE_ANIMATION_STYLE=`<style id="clue-motion-inline-style">${INLINE_ANIMATION_CSS}</style>`;
const INLINE_ANIMATION_SCRIPT=`<script id="clue-motion-inline-script">${INLINE_ANIMATION_JS}</script>`;

function legacyPlayRedirect(url){
  const raw=String(url.searchParams.get('play')||'').toLowerCase();
  const play=PLAY_TARGETS[raw]||'';
  const target=new URL('/',url);
  target.search='';
  if(play)target.hash=`play=${play}`;
  return Response.redirect(target.toString(),301);
}

async function polishDeepLinks(response,path,url){
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replaceAll('/?play=','/#play=');
  if(path==='/games/last-call/')html=html.replace('href="/">Play today’s Last Call','href="/#play=lastcall">Play today’s Last Call');
  const previewMotion=(path==='/'||path==='/index.html')&&url.searchParams.get('motion-preview')==='deepcut';
  if(path==='/'||path==='/index.html'){
    if(!html.includes('/retention-hooks.css')){
      html=html.replace('</head>','<link rel="stylesheet" href="/retention-hooks.css?v=1">\n</head>');
    }
    if(!html.includes('/deep-link.js')){
      html=html.replace('</body>','<script src="/deep-link.js?v=1" defer></script>\n</body>');
    }
    if(!html.includes('/retention-hooks.js')){
      html=html.replace('</body>','<script src="/retention-hooks.js?v=1" defer></script>\n</body>');
    }
    if(previewMotion){
      if(!html.includes('name="clue-motion-preview"')){
        html=html.replace('</head>','<meta name="clue-motion-preview" content="deepcut">\n</head>');
      }
      if(!html.includes('id="clue-motion-inline-style"')){
        html=html.replace('</head>',`${INLINE_ANIMATION_STYLE}\n</head>`);
      }
      if(!html.includes('id="clue-motion-inline-script"')){
        html=html.replace('</body>',`${INLINE_ANIMATION_SCRIPT}\n</body>`);
      }
    }
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  if(previewMotion){
    headers.set('cache-control','no-store');
    headers.set('x-clue-motion-preview','deepcut-inline');
  }
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='GET'&&(path==='/'||path==='/index.html')&&url.searchParams.has('play'))return legacyPlayRedirect(url);
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET')return polishDeepLinks(response,path,url);
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
