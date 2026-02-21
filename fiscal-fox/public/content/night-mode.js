const hostname = window.location.hostname;

// ── State ────────────────────────────────────────────────────────────
let nightModeEnabled   = false;
let colourBlindEnabled = false;
let colourBlindPreset  = 'none';
let colourBlindR = 100, colourBlindG = 100, colourBlindB = 100;

// ── Matrix builder ───────────────────────────────────────────────────
function buildMatrixValues(r, g, b, preset) {
  // Monochromacy: fixed ITU-R BT.709 luminance-weighted greyscale
  if (preset === 'monochromacy') {
    return '0.2126 0.7152 0.0722 0 0  ' +
           '0.2126 0.7152 0.0722 0 0  ' +
           '0.2126 0.7152 0.0722 0 0  ' +
           '0 0 0 1 0';
  }
  const rS = r / 100;
  const gS = g / 100;
  const bS = b / 100;
  // Off-diagonal = redistribute clipped remainder equally to other channels
  const rOff = Math.max(0, (1 - rS) / 2);
  const gOff = Math.max(0, (1 - gS) / 2);
  const bOff = Math.max(0, (1 - bS) / 2);
  return `${rS} ${rOff} ${rOff} 0 0  ` +
         `${gOff} ${gS} ${gOff} 0 0  ` +
         `${bOff} ${bOff} ${bS} 0 0  ` +
         `0 0 0 1 0`;
}

// ── Unified filter application ───────────────────────────────────────
function applyFilters() {
  const svgId   = 'fiscal-fox-cb-svg';
  const styleId = 'fiscal-fox-active-filter';

  // Manage the SVG colour matrix element
  let svg = document.getElementById(svgId);
  if (colourBlindEnabled) {
    const matrixValues = buildMatrixValues(colourBlindR, colourBlindG, colourBlindB, colourBlindPreset);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = svgId;
      svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML =
        '<defs><filter id="fiscal-fox-cb-filter">' +
        '<feColorMatrix type="matrix" values="' + matrixValues + '" />' +
        '</filter></defs>';
      document.body.appendChild(svg);
    } else {
      svg.querySelector('feColorMatrix').setAttribute('values', matrixValues);
    }
  } else {
    if (svg) svg.remove();
  }

  // Build combined filter string (CB first so it operates on natural colours)
  const parts = [];
  if (colourBlindEnabled) parts.push('url(#fiscal-fox-cb-filter)');
  if (nightModeEnabled)   parts.push('invert(1) hue-rotate(180deg)');

  // Manage the unified style element
  let style = document.getElementById(styleId);
  if (parts.length === 0) {
    if (style) style.remove();
    return;
  }
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }

  // Re-invert media only when night mode is active (colourblind filter should apply to images too)
  const mediaRule = nightModeEnabled
    ? 'filter: invert(1) hue-rotate(180deg);'
    : 'filter: none;';

  style.textContent =
    'html { filter: ' + parts.join(' ') + '; }\n' +
    'img, video, iframe, canvas, picture { ' + mediaRule + ' }';
}

// ── Page load: read night mode + colourblind settings and apply ──────
chrome.storage.sync.get(
  ['globalNightMode', 'rememberPerSite', 'nightModeSites',
   'colourBlindEnabled', 'colourBlindPreset', 'colourBlindR', 'colourBlindG', 'colourBlindB'],
  (data) => {
    const perSite = data.rememberPerSite && data.nightModeSites && data.nightModeSites[hostname];
    nightModeEnabled   = !!(data.globalNightMode || perSite);
    colourBlindEnabled = !!data.colourBlindEnabled;
    colourBlindPreset  = data.colourBlindPreset || 'none';
    colourBlindR       = data.colourBlindR ?? 100;
    colourBlindG       = data.colourBlindG ?? 100;
    colourBlindB       = data.colourBlindB ?? 100;
    applyFilters();
  }
);

// ── Real-time updates from settings page ─────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  let needsApply = false;

  if ('globalNightMode' in changes) {
    nightModeEnabled = !!changes.globalNightMode.newValue;
    needsApply = true;
  }
  if ('colourBlindEnabled' in changes) {
    colourBlindEnabled = !!changes.colourBlindEnabled.newValue;
    needsApply = true;
  }
  if ('colourBlindPreset' in changes) {
    colourBlindPreset = changes.colourBlindPreset.newValue || 'none';
    needsApply = true;
    // If RGB values also changed, the block below will re-fetch and call applyFilters() itself
  }
  if ('colourBlindR' in changes || 'colourBlindG' in changes || 'colourBlindB' in changes) {
    // Re-fetch all slider values atomically to avoid stale reads
    chrome.storage.sync.get(
      ['colourBlindR', 'colourBlindG', 'colourBlindB', 'colourBlindPreset'],
      (d) => {
        colourBlindR      = d.colourBlindR ?? 100;
        colourBlindG      = d.colourBlindG ?? 100;
        colourBlindB      = d.colourBlindB ?? 100;
        colourBlindPreset = d.colourBlindPreset || 'none';
        applyFilters();
      }
    );
    return; // applyFilters called inside async callback above
  }

  if (needsApply) applyFilters();
});

// ── Messages from popup ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getState') {
    sendResponse({ nightMode: nightModeEnabled });
    return;
  }

  if (msg.action === 'toggleNightMode') {
    nightModeEnabled = !nightModeEnabled;
    applyFilters();

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
