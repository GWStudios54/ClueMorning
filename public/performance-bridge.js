// Clue Morning runtime performance bridge.
// Legacy UI modules once watched the entire DOM. Route those broad observers
// through explicit state/interaction signals so timers and text updates stay cheap.
(()=>{
  const NativeMutationObserver=window.MutationObserver;
  const hotObservers=new Set();
  const STATE_KEYS=new Set([
    'clue-morning-state-v2.4',
    'clue-morning-last-call-v1',
    'clue-morning-unlimited-history-v1',
    'clue-morning-leader-name'
  ]);
  let queued=false;

  function broadTarget(target,options={}){
    if(!target||!options.subtree)return false;
    return target===document.body||
      target===document.documentElement||
      target.id==='deepcut'||
      target.classList?.contains('app');
  }

  function flush(reason='state'){
    queued=false;
    for(const observer of [...hotObservers]){
      try{observer._callback([],observer)}catch(error){console.error('Clue Morning UI refresh failed',error)}
    }
    try{window.dispatchEvent(new CustomEvent('clue:statechange',{detail:{reason}}))}catch{}
  }

  function signal(reason='state'){
    if(queued)return;
    queued=true;
    setTimeout(()=>requestAnimationFrame(()=>flush(reason)),60);
  }

  class RoutedMutationObserver{
    constructor(callback){
      if(typeof callback!=='function')throw new TypeError('MutationObserver callback must be a function');
      this._callback=callback;
      this._hot=false;
      this._native=new NativeMutationObserver((records)=>callback(records,this));
    }
    observe(target,options={}){
      if(broadTarget(target,options)){
        this._hot=true;
        hotObservers.add(this);
        return;
      }
      this._native.observe(target,options);
    }
    disconnect(){
      this._native.disconnect();
      if(this._hot){hotObservers.delete(this);this._hot=false}
    }
    takeRecords(){return this._native.takeRecords()}
  }

  window.MutationObserver=RoutedMutationObserver;
  window.ClueRuntimeSignal=signal;

  try{
    const nativeSetItem=Storage.prototype.setItem;
    const nativeRemoveItem=Storage.prototype.removeItem;
    const nativeClear=Storage.prototype.clear;
    Storage.prototype.setItem=function(key,value){
      const watched=STATE_KEYS.has(String(key));
      let before=null;
      if(watched){try{before=this.getItem(key)}catch{}}
      nativeSetItem.call(this,key,value);
      if(watched&&before!==String(value))signal(`storage:${key}`);
    };
    Storage.prototype.removeItem=function(key){
      const watched=STATE_KEYS.has(String(key));
      nativeRemoveItem.call(this,key);
      if(watched)signal(`storage:${key}`);
    };
    Storage.prototype.clear=function(){nativeClear.call(this);signal('storage:clear')};
  }catch(error){console.warn('Clue Morning storage event bridge unavailable',error)}

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('button,a,[data-open],[data-tab]'))signal('interaction');
  },true);
  document.addEventListener('submit',()=>signal('submit'),true);
  window.addEventListener('hashchange',()=>signal('hash'));
  window.addEventListener('storage',event=>{if(!event.key||STATE_KEYS.has(event.key))signal('cross-tab')});
  window.addEventListener('clue-lastcall-update',()=>signal('lastcall'));
  window.addEventListener('pageshow',()=>signal('pageshow'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)signal('visible')});
  window.addEventListener('load',()=>signal('load'),{once:true});
})();
