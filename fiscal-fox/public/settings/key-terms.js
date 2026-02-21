// ── Key Term Highlighting Settings ───────────────────────────────────

const keyTermsToggle = document.getElementById('keyTermsToggle');

chrome.storage.sync.get(['keyTermsEnabled'], (data) => {
  keyTermsToggle.checked = !!data.keyTermsEnabled;
});

keyTermsToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ keyTermsEnabled: keyTermsToggle.checked });
});
