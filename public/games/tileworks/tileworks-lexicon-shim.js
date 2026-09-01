(()=>{
  const nativeFetch=window.fetch.bind(window);
  const NativeWorker=window.Worker;
  const TWO_LETTER_URL='/games/tileworks/tileworks-two-letter.txt';

  function isTrailLexicon(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      return raw&&new URL(raw,window.location.href).pathname==='/trail-lexicon.txt';
    }catch{return false}
  }

  window.fetch=async function(input,init){
    if(!isTrailLexicon(input))return nativeFetch(input,init);

    const [base,two]=await Promise.all([
      nativeFetch(input,init),
      nativeFetch(TWO_LETTER_URL,{cache:'force-cache'})
    ]);
    if(!base.ok||!two.ok)return base;

    const [baseText,twoText]=await Promise.all([base.text(),two.text()]);
    return new Response(`${baseText}\n${twoText}\n`,{
      status:base.status,
      statusText:base.statusText,
      headers:base.headers
    });
  };

  window.Worker=function(input,options){
    let url=input;
    try{
      const parsed=new URL(typeof input==='string'?input:input?.url,window.location.href);
      if(parsed.pathname==='/games/tileworks/tileworks-ai-worker.js'){
        parsed.searchParams.set('v','3');
        url=parsed.href;
      }
    }catch{}
    return new NativeWorker(url,options);
  };
  window.Worker.prototype=NativeWorker.prototype;
  Object.setPrototypeOf(window.Worker,NativeWorker);
})();
