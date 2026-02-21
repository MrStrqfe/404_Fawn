// ── Colour Blind Mode Settings ───────────────────────────────────────

const CB_PRESETS = {
  none: { r: 100, g: 100, b: 100 },
  deuteranopia: { r: 130, g: 70, b: 100 },
  protanopia: { r: 70, g: 130, b: 100 },
  tritanopia: { r: 100, g: 115, b: 75 },
  monochromacy: { r: 100, g: 100, b: 100 },
};

const colourBlindToggle = document.getElementById('colourBlindToggle');
const cbSliderR = document.getElementById('cbSliderR');
const cbSliderG = document.getElementById('cbSliderG');
const cbSliderB = document.getElementById('cbSliderB');
const cbValR = document.getElementById('cbValR');
const cbValG = document.getElementById('cbValG');
const cbValB = document.getElementById('cbValB');
const cbSlidersBlock = document.getElementById('cbSlidersBlock');
const presetBtns = document.querySelectorAll('.preset-btn[data-preset]');
const customPresetBtn = document.getElementById('customPresetBtn');

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
    const r = data.colourBlindR ?? 100;
    const g = data.colourBlindG ?? 100;
    const b = data.colourBlindB ?? 100;
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

// ── Key Term Highlighting ────────────────────────────────────────────

const keyTermsToggle = document.getElementById('keyTermsToggle');

chrome.storage.sync.get(['keyTermsEnabled'], (data) => {
  keyTermsToggle.checked = !!data.keyTermsEnabled;
});

keyTermsToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ keyTermsEnabled: keyTermsToggle.checked });
});

// ── Dyslexic Reading ────────────────────────────────────────────────

const dyslexicReadingToggle = document.getElementById('dyslexicReadingToggle');

chrome.storage.sync.get(['dyslexicReadingEnabled'], (data) => {
  dyslexicReadingToggle.checked = !!data.dyslexicReadingEnabled;
});

dyslexicReadingToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ dyslexicReadingEnabled: dyslexicReadingToggle.checked });
});

// ── Keyboard Navigation (Vimium-style) ───────────────────────────────

document.addEventListener('keydown', (e) => {
  // Only trigger if not typing inside a text input
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    if (e.target.type !== 'checkbox' && e.target.type !== 'range') {
      return;
    }
  }

  // Get all focusable elements
  const focusableSelector = '.nav-item, input[type="checkbox"], select, input[type="range"], .preset-btn, button';
  const focusableElements = Array.from(document.querySelectorAll(focusableSelector))
    .filter(el => {
      // Exclude hidden or disabled elements
      if (el.classList.contains('disabled') || el.closest('.disabled') || el.closest('.sliders-block.disabled')) return false;
      if (el.style.display === 'none' || getComputedStyle(el).display === 'none') return false;
      return true;
    });

  if (focusableElements.length === 0) return;

  const currentIndex = focusableElements.indexOf(document.activeElement);

  if (e.key === 'j') {
    e.preventDefault();
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    focusableElements[nextIndex].focus();
  } else if (e.key === 'k') {
    e.preventDefault();
    const prevIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
    focusableElements[prevIndex].focus();
  } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex !== -1) {
    const el = focusableElements[currentIndex];
    // .nav-item is a div, won't naturally respond to Space/Enter click
    if (el.classList.contains('nav-item')) {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
      // Usually there would be a page change here but this UI is currently static
    }
  }
});


