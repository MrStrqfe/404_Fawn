let nightModeEnabled = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggleNightMode') {
    nightModeEnabled = !nightModeEnabled;

    const existing = document.getElementById('fiscal-fox-night-mode');
    if (nightModeEnabled) {
      if (!existing) {
        const style = document.createElement('style');
        style.id = 'fiscal-fox-night-mode';
        style.textContent = `
          html { filter: invert(1) hue-rotate(180deg); }
          img, video, iframe, canvas, picture { filter: invert(1) hue-rotate(180deg); }
        `;
        document.head.appendChild(style);
      }
    } else {
      if (existing) existing.remove();
    }

    sendResponse({ nightMode: nightModeEnabled });
  }
});
