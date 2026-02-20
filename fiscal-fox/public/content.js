const hostname = window.location.hostname;
let nightModeEnabled = false;

function applyNightMode(enabled) {
  const existing = document.getElementById('fiscal-fox-night-mode');
  if (enabled) {
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
}

// On page load, auto-apply night mode based on global setting or per-site setting
chrome.storage.sync.get(['globalNightMode', 'rememberPerSite', 'nightModeSites'], (data) => {
  const perSite = data.rememberPerSite && data.nightModeSites && data.nightModeSites[hostname];
  if (data.globalNightMode || perSite) {
    nightModeEnabled = true;
    applyNightMode(true);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getState') {
    sendResponse({ nightMode: nightModeEnabled });
    return;
  }

  if (msg.action === 'toggleNightMode') {
    nightModeEnabled = !nightModeEnabled;
    applyNightMode(nightModeEnabled);

    // Save state per site if rememberPerSite is enabled
    chrome.storage.sync.get(['rememberPerSite', 'nightModeSites'], (data) => {
      if (data.rememberPerSite) {
        const sites = data.nightModeSites || {};
        sites[hostname] = nightModeEnabled;
        chrome.storage.sync.set({ nightModeSites: sites });
      }
      sendResponse({ nightMode: nightModeEnabled });
    });

    return true; // keep message channel open for async sendResponse
  }
});
