// Clue Morning app loader. Loads the core game bundle; the results/score
// dialog for each daily game lives in app-core.js itself now, shown right
// when a game finishes rather than polled for after the fact, so it works
// on the dedicated /play/<game>/ pages where games are actually played.
(() => {
  const CORE_SRC = '/app-core.js?v=6';
  const core=document.createElement('script');core.src=CORE_SRC;core.async=false;core.onerror=()=>console.error('Clue Morning core failed to load.');document.body.appendChild(core);
})();
