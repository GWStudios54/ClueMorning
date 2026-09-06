import core from './worker-v4.js';

const PLAY_TARGETS=new Set(['letter','groups','trail','link','steps','deepcut','lastcall']);

function legacyPlayRedirect(url){
  const play=String(url.searchParams.get('play')||'').toLowerCase();
  if(!PLAY_TARGETS.has(play))return null;
  const target=new URL('/',url);
  target.search='';
  target.hash=`play=${play}`;
  return Response.redirect(target.toString(),301);
}

async function polishDeepLinks(response,path){
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  html=html.replaceAll('/?play=','/#play=');
  if((path==='/'||path==='/index.html')&&!html.includes('/deep-link.js')){
    html=html.replace('</body>','<script src="/deep-link.js?v=1" defer></script>\n</body>');
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==='GET'&&(path==='/'||path==='/index.html')&&url.searchParams.has('play')){
      const redirect=legacyPlayRedirect(url);
      if(redirect)return redirect;
    }
    const response=await core.fetch(request,env,ctx);
    if(request.method==='GET')return polishDeepLinks(response,path);
    return response;
  },
  async scheduled(controller,env,ctx){
    if(core.scheduled)return core.scheduled(controller,env,ctx);
  }
};
