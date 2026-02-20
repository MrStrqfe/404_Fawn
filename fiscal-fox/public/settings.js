const nightModeToggle = document.getElementById('nightModeToggle');
const rememberPerSiteToggle = document.getElementById('rememberPerSite');
const showBadgeToggle = document.getElementById('showBadge');

// Load all saved settings at once
chrome.storage.sync.get(['globalNightMode', 'rememberPerSite', 'showBadge'], (data) => {
  nightModeToggle.checked = !!data.globalNightMode;
  rememberPerSiteToggle.checked = !!data.rememberPerSite;
  showBadgeToggle.checked = data.showBadge !== false; // default true
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

// ── Colour Blind Mode ───────────────────────────────────────────────

const CB_PRESETS = {
  none:         { r: 100, g: 100, b: 100 },
  deuteranopia: { r: 130, g:  70, b: 100 },
  protanopia:   { r:  70, g: 130, b: 100 },
  tritanopia:   { r: 100, g: 115, b:  75 },
  monochromacy: { r: 100, g: 100, b: 100 },
};

const colourBlindToggle = document.getElementById('colourBlindToggle');
const cbSliderR         = document.getElementById('cbSliderR');
const cbSliderG         = document.getElementById('cbSliderG');
const cbSliderB         = document.getElementById('cbSliderB');
const cbValR            = document.getElementById('cbValR');
const cbValG            = document.getElementById('cbValG');
const cbValB            = document.getElementById('cbValB');
const cbSlidersBlock    = document.getElementById('cbSlidersBlock');
const presetBtns        = document.querySelectorAll('.preset-btn[data-preset]');
const customPresetBtn   = document.getElementById('customPresetBtn');

function setActivePreset(preset) {
  presetBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
  customPresetBtn.style.display = preset === 'custom' ? 'inline-block' : 'none';
}

function detectPreset(r, g, b) {
  for (const [name, vals] of Object.entries(CB_PRESETS)) {
    if (vals.r === r && vals.g === g && vals.b === b) return name;
  }
  return 'custom';
}

function applyPresetToSliders(preset) {
  const vals = CB_PRESETS[preset];
  if (!vals) return;
  cbSliderR.value = vals.r; cbValR.textContent = vals.r;
  cbSliderG.value = vals.g; cbValG.textContent = vals.g;
  cbSliderB.value = vals.b; cbValB.textContent = vals.b;
  cbSlidersBlock.classList.toggle('disabled', preset === 'monochromacy');
}

// Load saved colour blind settings
chrome.storage.sync.get(
  ['colourBlindEnabled', 'colourBlindPreset', 'colourBlindR', 'colourBlindG', 'colourBlindB'],
  (data) => {
    colourBlindToggle.checked = !!data.colourBlindEnabled;
    const r      = data.colourBlindR ?? 100;
    const g      = data.colourBlindG ?? 100;
    const b      = data.colourBlindB ?? 100;
    const preset = data.colourBlindPreset ?? 'none';
    cbSliderR.value = r; cbValR.textContent = r;
    cbSliderG.value = g; cbValG.textContent = g;
    cbSliderB.value = b; cbValB.textContent = b;
    setActivePreset(preset);
    if (preset === 'monochromacy') cbSlidersBlock.classList.add('disabled');
  }
);

// Master toggle
colourBlindToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ colourBlindEnabled: colourBlindToggle.checked });
});

// Preset buttons
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'custom') return;
    setActivePreset(preset);
    applyPresetToSliders(preset);
    const vals = CB_PRESETS[preset];
    chrome.storage.sync.set({
      colourBlindPreset: preset,
      colourBlindR: vals.r,
      colourBlindG: vals.g,
      colourBlindB: vals.b,
    });
  });
});

// RGB sliders
function onSliderChange() {
  const r = parseInt(cbSliderR.value, 10);
  const g = parseInt(cbSliderG.value, 10);
  const b = parseInt(cbSliderB.value, 10);
  cbValR.textContent = r;
  cbValG.textContent = g;
  cbValB.textContent = b;
  const detected = detectPreset(r, g, b);
  setActivePreset(detected);
  cbSlidersBlock.classList.toggle('disabled', detected === 'monochromacy');
  chrome.storage.sync.set({
    colourBlindPreset: detected,
    colourBlindR: r,
    colourBlindG: g,
    colourBlindB: b,
  });
}

cbSliderR.addEventListener('input', onSliderChange);
cbSliderG.addEventListener('input', onSliderChange);
cbSliderB.addEventListener('input', onSliderChange);
