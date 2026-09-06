// Clue Morning app loader.
// Core puzzle logic remains in app-core.js; lightweight retention UI can live here
// without making the main game bundle harder to maintain.
(() => {
  const CORE_SRC = '/app-core.js';
  const STATE_KEY = 'clue-morning-state-v2.4';
  const SHARE_URL = 'https://cluemorning.com/games/deep-cut/';

  function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function deepCutWasDoneAtLoad() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return !!saved?.days?.[localDateKey()]?.deepcut?.done;
    } catch {
      return false;
    }
  }

  const alreadyDoneAtLoad = deepCutWasDoneAtLoad();

  function installDeepCutRetentionFlow() {
    const doneCard = document.querySelector('#deepCutDone');
    if (!doneCard) return;

    if (!document.querySelector('#deepcut-retention-styles')) {
      const style = document.createElement('style');
      style.id = 'deepcut-retention-styles';
      style.textContent = `
        .deepcut-done-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}
        .deepcut-done-actions .primary-button,.deepcut-done-actions .secondary-button{min-width:150px}
        .deepcut-result-dialog{width:min(500px,92vw);text-align:center;padding:28px}
        .deepcut-result-dialog .dialog-close{position:absolute;right:16px;top:16px;float:none}
        .deepcut-result-dialog h2{font-size:clamp(2.3rem,8vw,3.35rem);margin:.25rem 0 .5rem}
        .deepcut-result-kicker{display:block;margin-top:4px}
        .deepcut-result-copy{color:var(--muted);margin:0 auto 16px;max-width:34ch;line-height:1.5}
        .deepcut-result-score{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:8px 0 10px}
        .deepcut-result-score strong{font:700 clamp(3.25rem,14vw,5rem)/.9 Georgia,"Times New Roman",serif;letter-spacing:-.05em}
        .deepcut-result-score span{font-weight:900;color:var(--muted)}
        .deepcut-result-marks{font-size:1.45rem;letter-spacing:.12em;line-height:1.4;margin:12px auto 18px;overflow-wrap:anywhere}
        .deepcut-result-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
        .deepcut-result-actions button{min-height:52px;justify-content:center}
        .deepcut-share-status{min-height:1.4em;margin:12px 0 0;color:var(--muted);font-size:.83rem}
        @media(max-width:520px){.deepcut-result-actions{grid-template-columns:1fr}.deepcut-done-actions{display:grid}.deepcut-done-actions button{width:100%}}
      `;
      document.head.appendChild(style);
    }

    if (!document.querySelector('#deepCutDoneActions')) {
      const actions = document.createElement('div');
      actions.id = 'deepCutDoneActions';
      actions.className = 'deepcut-done-actions';
      actions.innerHTML = `
        <button id="deepCutDoneMore" class="primary-button" type="button">Play More Games</button>
        <button id="deepCutDoneShare" class="secondary-button" type="button">Share Score</button>
      `;
      doneCard.appendChild(actions);
    }

    let dialog = document.querySelector('#deepCutResultDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'deepCutResultDialog';
      dialog.className = 'deepcut-result-dialog';
      dialog.setAttribute('aria-labelledby', 'deepCutResultTitle');
      dialog.innerHTML = `
        <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close score"><span aria-hidden="true">×</span></button></form>
        <span class="game-label deepcut-result-kicker">DEEP CUT COMPLETE</span>
        <h2 id="deepCutResultTitle">Nice cut.</h2>
        <p class="deepcut-result-copy">Your score is locked in. Share it, or keep the morning going with five more daily games.</p>
        <div class="deepcut-result-score"><strong id="deepCutResultScore">0</strong><span id="deepCutResultMax">/ 800</span></div>
        <div id="deepCutResultMarks" class="deepcut-result-marks" aria-label="Round results"></div>
        <div class="deepcut-result-actions">
          <button id="deepCutResultMore" class="primary-button" type="button">Play More Games</button>
          <button id="deepCutResultShare" class="secondary-button" type="button">Share Score</button>
        </div>
        <p id="deepCutShareStatus" class="deepcut-share-status" role="status" aria-live="polite"></p>
      `;
      document.querySelector('.app')?.appendChild(dialog);
    }

    const doneMore = document.querySelector('#deepCutDoneMore');
    const doneShare = document.querySelector('#deepCutDoneShare');
    const resultMore = document.querySelector('#deepCutResultMore');
    const resultShare = document.querySelector('#deepCutResultShare');
    const shareStatus = document.querySelector('#deepCutShareStatus');
    let autoOpened = alreadyDoneAtLoad;

    function isUnlimited() {
      return !!document.querySelector('#deepcut .unlimited-play-bar');
    }

    function snapshot() {
      const score = Number((document.querySelector('#deepCutDoneScore')?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
      const roundText = document.querySelector('#deepCutRound')?.textContent || '8/8';
      const total = Math.max(1, Number(roundText.split('/')[1]) || 8);
      const rows = [...document.querySelectorAll('#deepCutHistory .deepcut-result')];
      const marks = Array.from({length: total}, (_, i) => {
        const badge = (rows[i]?.querySelector('.deepcut-tier')?.textContent || '').trim().toUpperCase();
        return badge && !/TIME|MISS/.test(badge) ? '🟩' : '⬛';
      }).join('');
      return {score, total, max: total * 100, marks};
    }

    function syncResultUi() {
      const data = snapshot();
      const scoreEl = document.querySelector('#deepCutResultScore');
      const maxEl = document.querySelector('#deepCutResultMax');
      const marksEl = document.querySelector('#deepCutResultMarks');
      if (scoreEl) scoreEl.textContent = data.score.toLocaleString();
      if (maxEl) maxEl.textContent = `/ ${data.max.toLocaleString()}`;
      if (marksEl) marksEl.textContent = data.marks;
      if (shareStatus) shareStatus.textContent = '';
      const unlimited = isUnlimited();
      if (doneMore) doneMore.textContent = unlimited ? 'Back to Unlimited' : 'Play More Games';
      if (doneShare) doneShare.hidden = unlimited;
      if (resultShare) resultShare.hidden = unlimited;
      if (resultMore) resultMore.textContent = unlimited ? 'Back to Unlimited' : 'Play More Games';
      return data;
    }

    function goPlayMore() {
      if (dialog?.open) dialog.close();
      if (isUnlimited()) {
        document.querySelector('[data-tab="unlimited"]')?.click();
        return;
      }
      try {
        const url = new URL(location.href);
        url.searchParams.delete('play');
        history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      } catch {}
      document.querySelector('[data-tab="today"]')?.click();
    }

    function shareText(data) {
      return `Deep Cut · Clue Morning\n${data.score.toLocaleString()}/${data.max.toLocaleString()}\n${data.marks}\n\nPlay today's Deep Cut: ${SHARE_URL}`;
    }

    async function copyFallback(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }

    async function shareScore() {
      const data = syncResultUi();
      const compact = `Deep Cut · Clue Morning\n${data.score.toLocaleString()}/${data.max.toLocaleString()}\n${data.marks}`;
      try {
        if (navigator.share) {
          await navigator.share({title: 'Deep Cut — Clue Morning', text: compact, url: SHARE_URL});
          if (shareStatus) shareStatus.textContent = 'Shared.';
          return;
        }
        await copyFallback(shareText(data));
        if (shareStatus) shareStatus.textContent = 'Score copied — paste it anywhere.';
      } catch (err) {
        if (err?.name === 'AbortError') return;
        try {
          await copyFallback(shareText(data));
          if (shareStatus) shareStatus.textContent = 'Score copied — paste it anywhere.';
        } catch {
          if (shareStatus) shareStatus.textContent = 'Sharing is not available in this browser.';
        }
      }
    }

    function showResult() {
      if (isUnlimited()) return;
      syncResultUi();
      if (!dialog.open) dialog.showModal();
    }

    doneMore?.addEventListener('click', goPlayMore);
    resultMore?.addEventListener('click', goPlayMore);
    doneShare?.addEventListener('click', () => void shareScore());
    resultShare?.addEventListener('click', () => void shareScore());

    let wasVisible = !doneCard.hidden;
    const observer = new MutationObserver(() => {
      const visible = !doneCard.hidden;
      syncResultUi();
      if (visible && !wasVisible && !isUnlimited() && !autoOpened) {
        autoOpened = true;
        setTimeout(showResult, 120);
      }
      wasVisible = visible;
    });
    observer.observe(doneCard, {attributes: true, attributeFilter: ['hidden']});
    syncResultUi();
  }

  const core = document.createElement('script');
  core.src = CORE_SRC;
  core.async = false;
  core.onload = installDeepCutRetentionFlow;
  core.onerror = () => console.error('Clue Morning core failed to load.');
  document.body.appendChild(core);
})();
