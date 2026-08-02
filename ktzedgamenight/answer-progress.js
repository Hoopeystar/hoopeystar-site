(() => {
  const animateOverlayAnswerBar = () => {
    const overlayAnswerScreen = document.querySelector('.ov-wrap .ov-correct-box')?.closest('.ov-wrap');
    if (!overlayAnswerScreen) return;

    const timerPanel = overlayAnswerScreen.querySelector('.ov-timer-num')?.closest('.ov-panel');
    const bar = timerPanel?.querySelector('.ov-timer-bar');
    if (!timerPanel || !bar || timerPanel.classList.contains('answer-overlay-timer')) return;

    timerPanel.classList.add('answer-overlay-timer');
    const duration = overlayAnswerScreen.querySelector('[data-label="// FUN FACT"]') ? 12 : 5;
    const startedAt = performance.now();

    const tick = () => {
      if (!timerPanel.isConnected) return;

      const remaining = Math.max(0, duration - (performance.now() - startedAt) / 1000);
      bar.style.width = `${(remaining / duration) * 100}%`;

      if (remaining > 0) requestAnimationFrame(tick);
      else timerPanel.classList.add('is-advancing');
    };

    requestAnimationFrame(tick);
  };

  const observer = new MutationObserver(animateOverlayAnswerBar);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', animateOverlayAnswerBar, { once: true });
})();
