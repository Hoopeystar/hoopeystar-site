(() => {
  if (new URLSearchParams(window.location.search).get('overlay') !== '1') return;

  let activeQuestion = '';
  let displayedScores = new Map();
  let restoring = false;

  const syncOverlayScores = () => {
    if (restoring) return;

    const overlay = document.querySelector('.ov-wrap');
    const standings = overlay?.querySelector('.ov-panel[data-label="// STANDINGS"]');
    if (!overlay || !standings) return;

    // The correct-officers box only exists once the round-result phase begins.
    // At that point the newly awarded scores are allowed onto the overlay.
    if (overlay.querySelector('.ov-correct-box')) {
      activeQuestion = '';
      displayedScores.clear();
      return;
    }

    const question = overlay.querySelector('.ov-q-num')?.textContent?.trim() || '';
    const rows = [...standings.querySelectorAll('.ov-lb-row')];

    if (question !== activeQuestion) {
      activeQuestion = question;
      displayedScores = new Map(rows.map((row, order) => [
        row.querySelector('.ov-lb-name')?.textContent?.trim(),
        {
          score: row.querySelector('.ov-lb-score')?.textContent,
          rank: row.querySelector('.ov-lb-rank')?.textContent,
          order
        }
      ]));
      return;
    }

    restoring = true;
    rows.forEach((row) => {
      const name = row.querySelector('.ov-lb-name')?.textContent?.trim();
      const score = row.querySelector('.ov-lb-score');
      const snapshot = displayedScores.get(name);
      const rank = row.querySelector('.ov-lb-rank');
      if (score && snapshot && score.textContent !== snapshot.score) {
        score.textContent = snapshot.score;
      }
      if (rank && snapshot && rank.textContent !== snapshot.rank) {
        rank.textContent = snapshot.rank;
      }
    });
    rows
      .filter((row) => displayedScores.has(row.querySelector('.ov-lb-name')?.textContent?.trim()))
      .sort((a, b) => {
        const aName = a.querySelector('.ov-lb-name')?.textContent?.trim();
        const bName = b.querySelector('.ov-lb-name')?.textContent?.trim();
        return displayedScores.get(aName).order - displayedScores.get(bName).order;
      })
      .forEach((row) => standings.appendChild(row));
    restoring = false;
  };

  new MutationObserver(syncOverlayScores).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('DOMContentLoaded', syncOverlayScores, { once: true });
})();
