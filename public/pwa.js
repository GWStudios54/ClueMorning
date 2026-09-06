// Clue Morning PWA bootstrap.
(() => {
  if (!('serviceWorker' in navigator)) return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Keep the app shell fresh without interrupting an active puzzle.
      registration.update().catch(() => {});

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.dispatchEvent(new CustomEvent('cluemorning:pwa-ready'));
      });
    } catch (error) {
      console.warn('Clue Morning PWA registration failed.', error);
    }
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
})();
