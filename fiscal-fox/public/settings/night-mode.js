// ── Night Mode Settings ──────────────────────────────────────────────

const nightModeToggle      = document.getElementById('nightModeToggle');
const rememberPerSiteToggle = document.getElementById('rememberPerSite');
const showBadgeToggle      = document.getElementById('showBadge');

// Load saved settings
chrome.storage.sync.get(['globalNightMode', 'rememberPerSite', 'showBadge'], (data) => {
  nightModeToggle.checked      = !!data.globalNightMode;
  rememberPerSiteToggle.checked = !!data.rememberPerSite;
  showBadgeToggle.checked      = data.showBadge !== false; // default true
});

// Persist each toggle on change
nightModeToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ globalNightMode: nightModeToggle.checked });
});

rememberPerSiteToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ rememberPerSite: rememberPerSiteToggle.checked });
});

showBadgeToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ showBadge: showBadgeToggle.checked });
});
