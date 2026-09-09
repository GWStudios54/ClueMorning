// Clue Morning animation system: shared web-native motion layer + optional Rive bridge.
(() => {
  'use strict';

  const MOTION_URL = 'https://cdn.jsdelivr.net/npm/motion@13.1.1/+esm';
  const RIVE_RUNTIME_URL = 'https://unpkg.com/@rive-app/canvas@2.42.0';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rivePages = new Map();
  let motionModulePromise = null;
  let riveRuntimePromise = null;

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

  function loadMotion() {
    if (!motionModulePromise) motionModulePromise = import(MOTION_URL);
    return motionModulePromise;
  }

  function waapi(el, keyframes, options = {}) {
    if (!el || reducedMotion.matches || typeof el.animate !== 'function') return null;
    const duration = Math.max(0, Number(options.duration || .3) * 1000);
    const easing = typeof options.ease === 'string' ? options.ease : 'ease-out';
    try {
      return el.animate(keyframes, { duration, easing, fill: 'both' });
    } catch {
      return null;
    }
  }

  function motion(el, keyframes, options = {}) {
    if (!el || reducedMotion.matches) return Promise.resolve(null);
    return loadMotion()
      .then(({ animate }) => animate(el, keyframes, options))
      .catch(() => waapi(el, keyframes, options));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing) {
        if (window.rive) resolve();
        else existing.addEventListener('load', resolve, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Rive runtime failed to load')), { once: true });
      document.head.appendChild(script);
    });
  }

  function loadRiveRuntime() {
    if (!riveRuntimePromise) {
      riveRuntimePromise = (window.rive ? Promise.resolve() : loadScript(RIVE_RUNTIME_URL)).then(() => {
        if (!window.rive?.Rive) throw new Error('Rive runtime unavailable');
        return window.rive;
      });
    }
    return riveRuntimePromise;
  }

  function findRiveTrigger(record, eventName) {
    const stateMachine = record?.config?.stateMachine;
    if (!record?.instance || !stateMachine) return null;
    let inputs = [];
    try { inputs = record.instance.stateMachineInputs(stateMachine) || []; } catch { return null; }
    const wanted = RIVE_EVENT_INPUTS[eventName] || [eventName];
    return wanted.map(name => inputs.find(input => input.name === name)).find(Boolean) || null;
  }

  function fireRive(page, eventName) {
    const record = rivePages.get(page);
    const input = findRiveTrigger(record, eventName);
    if (!input) return;
    try {
      if (typeof input.fire === 'function') input.fire();
      else if ('value' in input) input.value = true;
    } catch {}
  }

  async function mountRive(page) {
    const record = rivePages.get(page);
    if (!record?.config?.src || record.instance) return record?.instance || null;
    const canvas = document.querySelector(`[data-rive-page="${page}"] canvas`);
    if (!canvas) return null;
    try {
      const rive = await loadRiveRuntime();
      const config = record.config;
      record.instance = new rive.Rive({
        src: config.src,
        canvas,
        autoplay: true,
        autoBind: true,
        artboard: config.artboard || undefined,
        stateMachines: config.stateMachine || undefined,
        onLoad: () => {
          try { record.instance.resizeDrawingSurfaceToCanvas(); } catch {}
          canvas.closest('.cm-rive-layer')?.classList.add('is-live');
          canvas.closest('.cm-page-atmosphere')?.classList.add('has-rive');
        }
      });
      return record.instance;
    } catch (error) {
      console.warn('Clue Morning Rive asset could not load; keeping the native motion fallback.', error);
      return null;
    }
  }

  function registerRive(page, config) {
    const prior = rivePages.get(page);
    try { prior?.instance?.cleanup?.(); } catch {}
    rivePages.set(page, { config: { ...config }, instance: null });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => void mountRive(page), { once: true });
    } else {
      void mountRive(page);
    }
  }

  function parseClock(value) {
    const match = String(value || '').trim().match(/^(\d+):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function createBurst(layer, tier) {
    if (!layer || reducedMotion.matches) return;
    const count = tier === 'rare' ? 14 : tier === 'uncommon' ? 10 : 8;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('i');
      spark.className = `cm-burst-spark cm-burst-${tier}`;
      const angle = (Math.PI * 2 * i) / count + (i % 2 ? .12 : -.08);
      const radius = 58 + (i % 4) * 16;
      spark.style.setProperty('--burst-x', `${Math.cos(angle) * radius}px`);
      spark.style.setProperty('--burst-y', `${Math.sin(angle) * radius}px`);
      spark.style.setProperty('--burst-r', `${-24 + i * 11}deg`);
      spark.style.setProperty('--burst-delay', `${i * 12}ms`);
      frag.appendChild(spark);
    }
    layer.appendChild(frag);
    window.setTimeout(() => layer.querySelectorAll('.cm-burst-spark').forEach(node => node.remove()), 900);
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

  function installDeepCut() {
    const panel = document.querySelector('#deepcut');
    if (!panel || panel.dataset.motionInstalled === 'true') return;
    panel.dataset.motionInstalled = 'true';
    panel.classList.add('cm-animated-page', 'cm-deepcut-page');

    const atmosphere = document.createElement('div');
    atmosphere.className = 'cm-page-atmosphere cm-deepcut-atmosphere';
    atmosphere.innerHTML = sceneMarkup();
    panel.prepend(atmosphere);

    const promptCard = panel.querySelector('.deepcut-prompt-card');
    const prompt = panel.querySelector('#deepCutPrompt');
    const form = panel.querySelector('#deepCutForm');
    const score = panel.querySelector('#deepCutScore');
    const timer = panel.querySelector('#deepCutTimer');
    const status = panel.querySelector('#deepCutStatus');
    const round = panel.querySelector('#deepCutRound');
    const message = panel.querySelector('#deepCutMessage');
    const history = panel.querySelector('#deepCutHistory');
    const burstLayer = atmosphere.querySelector('.cm-burst-layer');

    let previous = {
      active: false,
      status: '',
      prompt: '',
      round: '',
      message: '',
      historyCount: 0,
      urgentRound: ''
    };

    function animateEntrance() {
      if (reducedMotion.matches) return;
      const head = panel.querySelector('.panel-head');
      const stats = panel.querySelector('.stats-row');
      motion(head, { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0)'] }, { duration: .36, ease: 'ease-out' });
      motion(stats, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: .42, delay: .04, ease: 'ease-out' });
      if (promptCard && !promptCard.closest('[hidden]')) motion(promptCard, { opacity: [.72, 1], transform: ['translateY(14px) rotate(-.35deg)', 'translateY(0) rotate(0deg)'] }, { duration: .44, delay: .07, ease: 'ease-out' });
    }

    function animatePrompt() {
      if (!promptCard) return;
      panel.classList.remove('cm-is-urgent');
      previous.urgentRound = '';
      fireRive('deepcut', 'prompt');
      motion(promptCard, {
        opacity: [.42, 1],
        transform: ['translateY(12px) scale(.985) rotate(-.45deg)', 'translateY(0) scale(1) rotate(0deg)']
      }, { duration: .38, ease: 'ease-out' });
      if (prompt) motion(prompt, { opacity: [.15, 1], transform: ['translateY(7px)', 'translateY(0)'] }, { duration: .3, ease: 'ease-out' });
    }

    function animateWrong() {
      fireRive('deepcut', 'wrong');
      motion(form || promptCard, {
        transform: ['translateX(0)', 'translateX(-8px)', 'translateX(7px)', 'translateX(-4px)', 'translateX(3px)', 'translateX(0)']
      }, { duration: .34, ease: 'ease-out' });
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
      window.setTimeout(() => panel.classList.remove(`cm-flash-${tier}`), 720);
      motion(promptCard, {
        transform: ['translateY(0) scale(1)', 'translateY(-2px) scale(1.022)', 'translateY(0) scale(1)']
      }, { duration: .42, ease: 'ease-out' });
      motion(score, {
        transform: ['scale(1)', 'scale(1.15)', 'scale(1)']
      }, { duration: .38, ease: 'ease-out' });
      createBurst(burstLayer, tier);
    }

    function animateHistoryAddition() {
      const result = history?.querySelector('.deepcut-result:last-child');
      if (!result) return;
      motion(result, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: .32, ease: 'ease-out' });
    }

    function animateStart() {
      fireRive('deepcut', 'start');
      motion(atmosphere.querySelector('.cm-scene-glow'), { opacity: [.35, .78] }, { duration: .7, ease: 'ease-out' });
      motion(promptCard, { opacity: [.2, 1], transform: ['translateY(18px) scale(.98)', 'translateY(0) scale(1)'] }, { duration: .46, ease: 'ease-out' });
    }

    function animateComplete() {
      panel.classList.remove('cm-is-urgent');
      fireRive('deepcut', 'complete');
      panel.classList.add('cm-is-complete');
      motion(panel.querySelector('#deepCutDone'), { opacity: [0, 1], transform: ['translateY(12px) scale(.98)', 'translateY(0) scale(1)'] }, { duration: .5, ease: 'ease-out' });
      motion(atmosphere.querySelector('.cm-scene-paper-a'), { transform: ['rotate(7deg) translateY(0)', 'rotate(4deg) translateY(4px)'] }, { duration: .7, ease: 'ease-out' });
      motion(atmosphere.querySelector('.cm-scene-paper-b'), { transform: ['rotate(-8deg) translateY(0)', 'rotate(-4deg) translateY(5px)'] }, { duration: .7, ease: 'ease-out' });
    }

    function sync() {
      const active = panel.classList.contains('active');
      const statusText = status?.textContent?.trim() || '';
      const promptText = prompt?.textContent?.trim() || '';
      const roundText = round?.textContent?.trim() || '';
      const messageText = message?.textContent?.trim() || '';
      const historyCount = history?.querySelectorAll('.deepcut-result').length || 0;
      const seconds = parseClock(timer?.textContent);

      panel.dataset.motionState = statusText.toLowerCase() || 'ready';

      if (active && !previous.active) animateEntrance();
      if (statusText === 'LIVE' && previous.status !== 'LIVE') animateStart();
      if (statusText === 'DONE' && previous.status !== 'DONE') animateComplete();
      if (promptText && previous.prompt && promptText !== previous.prompt) animatePrompt();
      if (messageText && messageText !== previous.message) {
        if (message?.classList.contains('good')) animateCorrect(messageText);
        else if (message?.classList.contains('bad')) animateWrong();
      }
      if (historyCount > previous.historyCount) animateHistoryAddition();

      const urgent = statusText === 'LIVE' && seconds !== null && seconds <= 5;
      if (urgent) {
        panel.classList.add('cm-is-urgent');
        if (previous.urgentRound !== roundText) {
          previous.urgentRound = roundText;
          fireRive('deepcut', 'urgent');
        }
      } else if (statusText !== 'LIVE' || seconds === null || seconds > 5) {
        panel.classList.remove('cm-is-urgent');
      }

      previous.active = active;
      previous.status = statusText;
      previous.prompt = promptText;
      previous.round = roundText;
      previous.message = messageText;
      previous.historyCount = historyCount;
    }

    const contentObserver = new MutationObserver(sync);
    contentObserver.observe(panel, { subtree: true, childList: true, characterData: true });
    const panelObserver = new MutationObserver(sync);
    panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  const publicApi = window.ClueMotion || {};
  publicApi.registerRive = registerRive;
  publicApi.fireRive = fireRive;
  publicApi.motion = motion;
  publicApi.versions = { motion: '13.1.1', rive: '2.42.0' };
  window.ClueMotion = publicApi;

  function boot() {
    installDeepCut();
    window.dispatchEvent(new CustomEvent('clue-motion-ready', { detail: publicApi.versions }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
