const hostname = window.location.hostname;

// ── State ────────────────────────────────────────────────────────────
let nightModeEnabled   = false;
let colourBlindEnabled = false;
let colourBlindPreset  = 'none';
let colourBlindR = 100, colourBlindG = 100, colourBlindB = 100;
let keyTermsEnabled    = false;

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

// ── Page load: read all settings and apply ───────────────────────────
chrome.storage.sync.get(
  ['globalNightMode', 'rememberPerSite', 'nightModeSites',
   'colourBlindEnabled', 'colourBlindPreset', 'colourBlindR', 'colourBlindG', 'colourBlindB',
   'keyTermsEnabled'],
  (data) => {
    const perSite = data.rememberPerSite && data.nightModeSites && data.nightModeSites[hostname];
    nightModeEnabled   = !!(data.globalNightMode || perSite);
    colourBlindEnabled = !!data.colourBlindEnabled;
    colourBlindPreset  = data.colourBlindPreset || 'none';
    colourBlindR       = data.colourBlindR ?? 100;
    colourBlindG       = data.colourBlindG ?? 100;
    colourBlindB       = data.colourBlindB ?? 100;
    keyTermsEnabled    = !!data.keyTermsEnabled;
    applyFilters();
    if (keyTermsEnabled) applyKeyTermHighlighting();
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
    // Don't apply yet — slider values arrive in the same storage batch
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

  if ('keyTermsEnabled' in changes) {
    keyTermsEnabled = !!changes.keyTermsEnabled.newValue;
    if (keyTermsEnabled) {
      applyKeyTermHighlighting();
    } else {
      removeKeyTermHighlighting();
    }
  }
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

// ── Key Term Highlighting ────────────────────────────────────────────

let dictionaryCache = null;
let tooltipEl = null;

async function loadDictionary() {
  if (dictionaryCache) return dictionaryCache;
  const url = chrome.runtime.getURL('dictionary.json');
  const resp = await fetch(url);
  dictionaryCache = await resp.json();
  return dictionaryCache;
}

function buildTermRegex(dict) {
  // Sort longest first so multi-word terms match before their sub-terms
  const terms = Object.keys(dict).sort((a, b) => b.length - a.length);
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('(' + escaped.join('|') + ')', 'gi');
}

function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'fiscal-fox-tooltip';
    tooltipEl.style.cssText =
      'position:fixed;z-index:2147483647;background:#21242d;color:#e0e0e0;' +
      'border:1px solid #61dafb;border-radius:8px;padding:10px 14px;' +
      'max-width:300px;font-size:13px;line-height:1.5;pointer-events:none;' +
      'display:none;box-shadow:0 4px 16px rgba(0,0,0,0.6);font-family:sans-serif;';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'HEAD']);

function highlightInNode(node, dict, regex) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (SKIP_TAGS.has(node.tagName)) return;
    if (node.id === 'fiscal-fox-tooltip') return;
    if (node.classList && node.classList.contains('fiscal-fox-term')) return;
    Array.from(node.childNodes).forEach(child => highlightInNode(child, dict, regex));
  } else if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const matchedText = match[0];
      const termKey = Object.keys(dict).find(k => k.toLowerCase() === matchedText.toLowerCase());
      const span = document.createElement('span');
      span.className = 'fiscal-fox-term';
      span.textContent = matchedText;
      span.style.cssText =
        'background:rgba(97,218,251,0.15);border-bottom:1px dotted #61dafb;' +
        'cursor:help;border-radius:2px;';
      if (termKey) {
        const definition = dict[termKey];
        span.addEventListener('mouseenter', () => {
          const tt = getTooltip();
          tt.innerHTML = '<strong style="color:#61dafb">' + termKey + '</strong><br>' + definition;
          tt.style.display = 'block';
          const r = span.getBoundingClientRect();
          tt.style.left = Math.min(r.left, window.innerWidth - 320) + 'px';
          tt.style.top = (r.bottom + 8) + 'px';
        });
        span.addEventListener('mouseleave', () => {
          getTooltip().style.display = 'none';
        });
      }
      fragment.appendChild(span);
      lastIndex = match.index + matchedText.length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(fragment, node);
  }
}

async function applyKeyTermHighlighting() {
  if (!keyTermsEnabled) return;
  const dict = await loadDictionary();
  const regex = buildTermRegex(dict);
  highlightInNode(document.body, dict, regex);
}

function removeKeyTermHighlighting() {
  document.querySelectorAll('span.fiscal-fox-term').forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  if (tooltipEl) tooltipEl.style.display = 'none';
}
