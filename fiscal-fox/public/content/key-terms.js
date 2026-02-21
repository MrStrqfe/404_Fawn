// ── Key Term Highlighting ────────────────────────────────────────────

let keyTermsEnabled = false;
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
  return new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi');
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

// ── Page load: read active profile key terms setting and apply ────────
chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
  const activeProfile = data.activeProfile || 'Mom';
  const profiles = data.profiles || {};
  const pData = profiles[activeProfile] || {};

  keyTermsEnabled = !!pData.keyTermsEnabled;
  if (keyTermsEnabled) applyKeyTermHighlighting();
});

// ── Real-time updates from settings page ─────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  if (changes.profiles || changes.activeProfile) {
    chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
      const activeProfile = data.activeProfile || 'Mom';
      const profiles = data.profiles || {};
      const pData = profiles[activeProfile] || {};

      const oldKeyTerms = keyTermsEnabled;
      keyTermsEnabled = !!pData.keyTermsEnabled;

      if (keyTermsEnabled !== oldKeyTerms) {
        if (keyTermsEnabled) {
          applyKeyTermHighlighting();
        } else {
          removeKeyTermHighlighting();
        }
      }
    });
  }
});
