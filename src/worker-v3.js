import core from "./worker-v2.js";

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}

async function foundersResponse(response){
  try{
    const data=await response.clone().json();
    if(data&&data.active){
      data.tier="founders";
      data.entitlements={allPacks:true,archive:true,reserveLibrary:true,founderRewards:true};
      data.displayName="Founders";
    }
    return json(data,response.status);
  }catch{return response}
}

async function injectFoundersUi(response){
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html"))return response;
  let html=await response.text();
  if(!html.includes("/founders-ui.js")){
    html=html.replace("</body>",'<script src="/founders-ui.js" defer></script></body>');
  }
  const headers=new Headers(response.headers);
  headers.set("Cache-Control","no-store, max-age=0, must-revalidate");
  headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="POST"&&(path==="/api/unlimited/status"||path==="/api/unlimited/claim")){
      return foundersResponse(await core.fetch(request,env));
    }
    const response=await core.fetch(request,env);
    if(request.method==="GET"&&(path==="/"||path==="/index.html"))return injectFoundersUi(response);
    return response;
  }
};
