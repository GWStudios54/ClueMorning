// Clue Morning animation preview: dependency-free, fail-open, Deep Cut only.
(() => {
  'use strict';

  const PREVIEW_PARAM = 'motion-preview';
  const PREVIEW_VALUE = 'deepcut';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const runningAnimations = new WeakMap();
  const rivePages = new Map();

  function previewEnabled() {
    try {
      return new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === PREVIEW_VALUE;
    } catch {
      return false;
    }
  }

  function animate(el, keyframes, options = {}) {
    if (!el || reducedMotion?.matches || typeof el.animate !== 'function') return null;
    try {
      runningAnimations.get(el)?.cancel?.();
      const animation = el.animate(keyframes, {
        duration: Math.max(0, Number(options.duration ?? .3) * 1000),
        delay: Math.max(0, Number(options.delay ?? 0) * 1000),
        easing: typeof options.ease === 'string' ? options.ease : 'ease-out',
        fill: 'none'
      });
      runningAnimations.set(el, animation);
      const clear = () => {
        if (runningAnimations.get(el) === animation) runningAnimations.delete(el);
      };
      animation.addEventListener?.('finish', clear, { once: true });
      animation.addEventListener?.('cancel', clear, { once: true });
      return animation;
    } catch {
      return null;
    }
  }

  const RIVE_EVENT_INPUTS = {
    start: ['Start'],
    prompt: ['Prompt'],
    correct_common: ['CorrectCommon', 'Correct'],
    correct_uncommon: ['CorrectUncommon', 'Correct'],
    correct_rare: ['CorrectRare', 'Correct'],
    wrong: ['Wrong'],
    urgent: ['Urgent'],
    complete: ['Complete']
  };

  // Rive stays inert until a future self-hosted runtime creates an instance and attaches it here.
  function registerRive(page, config = {}) {
    const prior = rivePages.get(page);
    try { prior?.instance?.cleanup?.(); } catch {}
    rivePages.set(page, {
      instance: config.instance || null,
      stateMachine: config.stateMachine || 'DeepCut'
    });
  }

  function fireRive(page, eventName) {
    const record = rivePages.get(page);
    if (!record?.instance || !record.stateMachine) return;
    try {
      const inputs = record.instance.stateMachineInputs(record.stateMachine) || [];
      const wanted = RIVE_EVENT_INPUTS[eventName] || [eventName];
      const input = wanted.map(name => inputs.find(item => item.name === name)).find(Boolean);
      if (!input) return;
      if (typeof input.fire === 'function') input.fire();
      else if ('value' in input) input.value = true;
    } catch {}
  }

  function parseClock(value) {
    const match = String(value || '').trim().match(/^(\d+):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function sceneMarkup() {
    return `
      <div class="cm-fallback-scene" aria-hidden="true">
        <div class="cm-scene-glow"></div>
        <div class="cm-scene-paper cm-scene-paper-a"><span></span><span></span><span></span><b></b></div>
        <div class="cm-scene-paper cm-scene-paper-b"><span></span><span></span><span></span><b></b></div>
        <div class="cm-scene-pencil"><i></i></div>
        <div class="cm-scene-cup"><i class="cm-steam cm-steam-a"></i><i class="cm-steam cm-steam-b"></i><i class="cm-steam cm-steam-c"></i></div>
        <div class="cm-scene-ring"></div>
      </div>
      <div class="cm-rive-layer" data-rive-page="deepcut" aria-hidden="true"><canvas></canvas></div>
      <div class="cm-burst-layer" aria-hidden="true"></div>
    `;
  }

  function createBurst(layer, tier) {
    if (!layer || reducedMotion?.matches) return;
    const count = tier === 'rare' ? 12 : tier === 'uncommon' ? 9 : 7;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('i');
      spark.className = `cm-burst-spark cm-burst-${tier}`;
      const angle = (Math.PI * 2 * i) / count + (i % 2 ? .1 : -.07);
      const radius = 52 + (i % 4) * 14;
      spark.style.setProperty('--burst-x', `${Math.cos(angle) * radius}px`);
      spark.style.setProperty('--burst-y', `${Math.sin(angle) * radius}px`);
      spark.style.setProperty('--burst-r', `${-20 + i * 12}deg`);
      spark.style.setProperty('--burst-delay', `${i * 10}ms`);
      frag.appendChild(spark);
    }
    layer.appendChild(frag);
    window.setTimeout(() => layer.querySelectorAll('.cm-burst-spark').forEach(node => node.remove()), 820);
  }

  function installDeepCut() {
    const panel = document.querySelector('#deepcut');
    if (!panel || panel.dataset.motionInstalled === 'true') return;

    const promptCard = panel.querySelector('.deepcut-prompt-card');
    const prompt = panel.querySelector('#deepCutPrompt');
    const form = panel.querySelector('#deepCutForm');
    const score = panel.querySelector('#deepCutScore');
    const timer = panel.querySelector('#deepCutTimer');
    const status = panel.querySelector('#deepCutStatus');
    const round = panel.querySelector('#deepCutRound');
    const message = panel.querySelector('#deepCutMessage');
    const history = panel.querySelector('#deepCutHistory');
    if (!promptCard || !prompt || !timer || !status || !round || !message || !history) return;

    panel.dataset.motionInstalled = 'true';
    panel.classList.add('cm-animated-page', 'cm-deepcut-page');

    const atmosphere = document.createElement('div');
    atmosphere.className = 'cm-page-atmosphere cm-deepcut-atmosphere';
    atmosphere.innerHTML = sceneMarkup();
    panel.prepend(atmosphere);
    const burstLayer = atmosphere.querySelector('.cm-burst-layer');

    const previous = {
      active: false,
      status: '',
      prompt: '',
      round: '',
      message: '',
      historyCount: 0,
      urgentRound: ''
    };
    let syncFrame = 0;

    function positionBurstOrigin() {
      if (!burstLayer) return;
      const promptRect = promptCard.getBoundingClientRect();
      const atmosphereRect = atmosphere.getBoundingClientRect();
      burstLayer.style.setProperty('--burst-origin-x', `${promptRect.left - atmosphereRect.left + promptRect.width / 2}px`);
      burstLayer.style.setProperty('--burst-origin-y', `${promptRect.top - atmosphereRect.top + promptRect.height / 2}px`);
    }

    function animateEntrance() {
      const head = panel.querySelector('.panel-head');
      const stats = panel.querySelector('.stats-row');
      animate(head, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: .28 });
      animate(stats, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] }, { duration: .32, delay: .025 });
      if (!promptCard.closest('[hidden]')) {
        animate(promptCard, { opacity: [.72, 1], transform: ['translateY(10px) rotate(-.25deg)', 'translateY(0) rotate(0deg)'] }, { duration: .34, delay: .04 });
      }
    }

    function animatePrompt() {
      panel.classList.remove('cm-is-urgent');
      previous.urgentRound = '';
      fireRive('deepcut', 'prompt');
      animate(promptCard, { opacity: [.48, 1], transform: ['translateY(9px) scale(.99)', 'translateY(0) scale(1)'] }, { duration: .28 });
      animate(prompt, { opacity: [.2, 1], transform: ['translateY(5px)', 'translateY(0)'] }, { duration: .22 });
    }

    function animateWrong() {
      fireRive('deepcut', 'wrong');
      animate(form || promptCard, { transform: ['translateX(0)', 'translateX(-6px)', 'translateX(5px)', 'translateX(-3px)', 'translateX(0)'] }, { duration: .26 });
    }

    function tierFromMessage(text) {
      const first = String(text || '').split(':', 1)[0].trim().toLowerCase();
      if (first.includes('rare')) return 'rare';
      if (first.includes('uncommon')) return 'uncommon';
      return 'common';
    }

    function animateCorrect(text) {
      const tier = tierFromMessage(text);
      fireRive('deepcut', `correct_${tier}`);
      panel.classList.remove('cm-flash-common', 'cm-flash-uncommon', 'cm-flash-rare');
      void panel.offsetWidth;
      panel.classList.add(`cm-flash-${tier}`);
      window.setTimeout(() => panel.classList.remove(`cm-flash-${tier}`), 680);
      animate(promptCard, { transform: ['scale(1)', 'scale(1.018)', 'scale(1)'] }, { duration: .32 });
      animate(score, { transform: ['scale(1)', 'scale(1.12)', 'scale(1)'] }, { duration: .28 });
      positionBurstOrigin();
      createBurst(burstLayer, tier);
    }

    function animateHistoryAddition() {
      const result = history.querySelector('.deepcut-result:last-child');
      animate(result, { opacity: [0, 1], transform: ['translateY(7px)', 'translateY(0)'] }, { duration: .24 });
    }

    function animateStart() {
      fireRive('deepcut', 'start');
      animate(atmosphere.querySelector('.cm-scene-glow'), { opacity: [.36, .68] }, { duration: .45 });
      animate(promptCard, { opacity: [.35, 1], transform: ['translateY(12px) scale(.99)', 'translateY(0) scale(1)'] }, { duration: .34 });
    }

    function animateComplete() {
      panel.classList.remove('cm-is-urgent');
      fireRive('deepcut', 'complete');
      panel.classList.add('cm-is-complete');
      animate(panel.querySelector('#deepCutDone'), { opacity: [0, 1], transform: ['translateY(8px) scale(.99)', 'translateY(0) scale(1)'] }, { duration: .34 });
    }

    function syncNow() {
      syncFrame = 0;
      if (document.visibilityState === 'hidden') return;
      const active = panel.classList.contains('active');
      const statusText = status.textContent?.trim() || '';
      const promptText = prompt.textContent?.trim() || '';
      const roundText = round.textContent?.trim() || '';
      const messageText = message.textContent?.trim() || '';
      const historyCount = history.querySelectorAll('.deepcut-result').length;
      const seconds = parseClock(timer.textContent);

      panel.dataset.motionState = statusText.toLowerCase() || 'ready';
      if (active && !previous.active) animateEntrance();
      if (statusText === 'LIVE' && previous.status !== 'LIVE') animateStart();
      if (statusText === 'DONE' && previous.status !== 'DONE') animateComplete();
      if (promptText && previous.prompt && promptText !== previous.prompt) animatePrompt();
      if (messageText && messageText !== previous.message) {
        if (message.classList.contains('good')) animateCorrect(messageText);
        else if (message.classList.contains('bad')) animateWrong();
      }
      if (historyCount > previous.historyCount) animateHistoryAddition();

      const urgent = statusText === 'LIVE' && seconds !== null && seconds <= 5;
      panel.classList.toggle('cm-is-urgent', urgent);
      if (urgent && previous.urgentRound !== roundText) {
        previous.urgentRound = roundText;
        fireRive('deepcut', 'urgent');
      }
      if (!urgent && (statusText !== 'LIVE' || seconds === null || seconds > 5)) previous.urgentRound = '';

      previous.active = active;
      previous.status = statusText;
      previous.prompt = promptText;
      previous.round = roundText;
      previous.message = messageText;
      previous.historyCount = historyCount;
    }

    function queueSync() {
      if (syncFrame) return;
      syncFrame = window.requestAnimationFrame(syncNow);
    }

    const contentObserver = new MutationObserver(queueSync);
    for (const node of [status, timer, prompt, message, history]) {
      contentObserver.observe(node, { subtree: true, childList: true, characterData: true, attributes: node === message, attributeFilter: node === message ? ['class'] : undefined });
    }
    const panelObserver = new MutationObserver(queueSync);
    panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', positionBurstOrigin, { passive: true });
    document.addEventListener('visibilitychange', queueSync, { passive: true });
    queueSync();
  }

  const publicApi = window.ClueMotion || {};
  publicApi.registerRive = registerRive;
  publicApi.fireRive = fireRive;
  publicApi.animate = animate;
  publicApi.preview = PREVIEW_VALUE;
  publicApi.engine = 'waapi';
  window.ClueMotion = publicApi;

  function boot() {
    if (!previewEnabled()) return;
    try {
      installDeepCut();
      window.dispatchEvent(new CustomEvent('clue-motion-ready', { detail: { preview: PREVIEW_VALUE, engine: 'waapi' } }));
    } catch (error) {
      console.warn('Clue Morning animation preview disabled after a safe failure.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
