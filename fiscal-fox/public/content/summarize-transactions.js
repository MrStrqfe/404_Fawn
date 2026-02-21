// ── Summarize Transactions ────────────────────────────────────────────

let categoriesCache = null;
let sidebarOpen = false;

// ── Load categories from extension resources ──────────────────────────
async function loadCategories() {
  if (categoriesCache) return categoriesCache;
  const url = chrome.runtime.getURL('categories.json');
  const resp = await fetch(url);
  categoriesCache = await resp.json();
  return categoriesCache;
}

// ── Categorize a single transaction description ───────────────────────
function categorize(description, categories) {
  const desc = description.toLowerCase();
  for (const [name, cat] of Object.entries(categories)) {
    if (name === 'Other') continue;
    for (const keyword of cat.keywords) {
      if (desc.includes(keyword.toLowerCase())) {
        return name;
      }
    }
  }
  return 'Other';
}

// ── Parse dollar amount from text ─────────────────────────────────────
// Returns the raw signed value as displayed:
//   positive  = money went out (debit / withdrawal)
//   negative  = money came in  (credit / deposit)
// Callers that already know the column type can override the sign.
function parseAmount(text, forceSign) {
  if (!text) return null;
  const t = text.trim();

  // Credit indicators → money in (negative in our convention)
  const isCreditText = /\bcr\b/i.test(t) || /\bcredit\b/i.test(t);
  const isDebitText  = /\bdr\b/i.test(t) || /\bdebit\b/i.test(t);

  // Strip everything except digits, dot, minus
  const numStr = t.replace(/[$,\s]/g, '').replace(/[()]/g, '').replace(/[CRDRcrdr]/g, '');
  const numeric = parseFloat(numStr);
  if (isNaN(numeric) || numeric === 0) return null;

  const abs = Math.abs(numeric);

  // Explicit override from column type
  if (forceSign === 'debit')  return  abs;   // spending
  if (forceSign === 'credit') return -abs;   // income

  // CR/DR suffixes
  if (isCreditText) return -abs;
  if (isDebitText)  return  abs;

  // Negative number on-screen → debit on most Canadian bank sites
  if (numeric < 0) return abs;

  // Positive with no indicator → treat as credit (money in, balance increases)
  // Canadian bank convention: positive = deposit, negative = withdrawal
  return -abs;
}

// ── Date extraction helper ────────────────────────────────────────────
const DATE_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/,                         // YYYY-MM-DD
  /\d{2}\/\d{2}\/\d{4}/,                       // DD/MM/YYYY or MM/DD/YYYY
  /\d{2}-\d{2}-\d{4}/,                         // DD-MM-YYYY
  /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(\s*,\s*\d{4})?/i,
  /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\s*\d{4})?/i,
];

function looksLikeDate(text) {
  return DATE_PATTERNS.some(p => p.test(text));
}

function extractDateMonth(text) {
  // Return "Month YYYY" string for grouping
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // YYYY-MM-DD
  const iso = text.match(/(\d{4})-(\d{2})-\d{2}/);
  if (iso) {
    const idx = parseInt(iso[2], 10) - 1;
    return months[idx] + ' ' + iso[1];
  }
  // DD/MM/YYYY or MM/DD/YYYY — assume MM/DD/YYYY for North American banks
  const slash = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) {
    const idx = parseInt(slash[1], 10) - 1;
    return months[idx] + ' ' + slash[3];
  }
  // "Jan 15, 2026" or "Jan 15"
  const named = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*,\s*(\d{4}))?/i);
  if (named) {
    const yr = named[2] || new Date().getFullYear();
    return named[1].charAt(0).toUpperCase() + named[1].slice(1).toLowerCase() + ' ' + yr;
  }
  return null;
}

// ── Detect column types from a header row ─────────────────────────────
function getColumnMap(headerRow) {
  const cells = Array.from(headerRow.querySelectorAll('th, td'));
  const headers = cells.map(c => c.textContent.trim().toLowerCase());
  return {
    dateIdx:   headers.findIndex(h => /\bdate\b/.test(h)),
    descIdx:   headers.findIndex(h => /description|details|memo|payee|merchant|transactions?/i.test(h)),
    debitIdx:  headers.findIndex(h => /\b(debit|withdrawal|withdrawals|out|charge)\b/i.test(h)),
    creditIdx: headers.findIndex(h => /\b(credit|deposit|deposits)\b/i.test(h)),
    amountIdx: headers.findIndex(h => /\bamount\b/i.test(h)),
  };
}

// ── Check if an element lives inside a DEBIT/Withdrawal table context ──
function hasDebitHeaderNearby(el) {
  // Case 0: the row has a td.debit WITH an actual dollar amount (CIBC pattern)
  // A td.debit containing "Not applicable" or no $ means this is a credit row
  const row = el.closest('tr');
  if (row) {
    const debitTd = row.querySelector('td[class*="debit"], td[class*="withdrawal"]');
    if (debitTd && /\$[\d]/.test(debitTd.textContent)) return true;
  }

  // Case 1: inside a real <table> — check its <th> / <thead> cells
  const table = el.closest('table');
  if (table) {
    return Array.from(table.querySelectorAll('th, thead td, [role="columnheader"]'))
      .some(h => /\bdebit\b|\bwithdrawal\b/i.test(h.textContent));
  }

  // Case 2: ARIA table (role="table" / role="grid")
  const ariaTable = el.closest('[role="table"], [role="grid"]');
  if (ariaTable) {
    return Array.from(ariaTable.querySelectorAll('[role="columnheader"]'))
      .some(h => /\bdebit\b|\bwithdrawal\b/i.test(h.textContent));
  }

  // Case 3: div-based layout — look for a sibling/parent whose short text is "DEBIT"
  let node = el.parentElement;
  for (let i = 0; i < 6; i++) {
    if (!node || node === document.body) break;
    const siblings = Array.from(node.parentElement?.children || []);
    const debitSibling = siblings.find(
      s => s !== node &&
           s.textContent.trim().length < 50 &&
           /\bdebit\b|\bwithdrawal\b/i.test(s.textContent)
    );
    if (debitSibling) return true;
    node = node.parentElement;
  }

  return false;
}

// ── Strategy 3: date-first text-node scan (works for any DOM layout) ──
function extractByDateScan() {
  const transactions = [];
  const seenRows = new Set();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;

  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    // Must look like a date and be short (skip large paragraphs that happen to contain a date)
    if (!looksLikeDate(text) || text.length > 35) continue;

    const el = node.parentElement;
    if (!el) continue;
    // Skip our own sidebar
    if (el.closest('#fiscal-fox-sidebar-host')) continue;

    // Find the "row" — prefer <tr> or role="row", fall back to direct parent
    const row = el.closest('tr') ||
                el.closest('[role="row"]') ||
                el.parentElement;
    if (!row || seenRows.has(row) || row === document.body) continue;
    seenRows.add(row);

    // Skip rows that have class-based debit/credit columns — already handled by Strategy 1
    if (row.querySelector && (row.querySelector('td[class*="debit"]') || row.querySelector('td[class*="credit"]'))) continue;

    const rowText = row.textContent.replace(/\s+/g, ' ').trim();

    // Find a dollar amount in this row
    const amountMatches = rowText.match(/\$[\d,]+\.\d{2}/g);
    if (!amountMatches) continue;
    const amountText = amountMatches[0];

    const dateText = text;

    // Determine sign: explicit negative on screen = definitely a debit;
    // DEBIT column header nearby = force debit; otherwise skip (ambiguous)
    const isExplicitNegative = /[-\u2212]\s*\$[\d,]+/.test(rowText) ||
                               /\(\$[\d,]/.test(rowText);
    const isDebitCtx = hasDebitHeaderNearby(el);

    let forceSign = null;
    if (isExplicitNegative || isDebitCtx) forceSign = 'debit';

    const amount = parseAmount(amountText, forceSign);
    // Only keep spending (positive in our convention)
    if (!amount || amount <= 0) continue;

    // Build description from what's left after removing date + amount
    let description = rowText
      .replace(dateText, '')
      .replace(amountText, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split('\n')[0]
      .trim();
    if (description.length > 100) description = description.slice(0, 100);
    if (!description) description = 'Unknown';

    transactions.push({
      date: dateText,
      month: extractDateMonth(dateText),
      description,
      amount,
    });
  }

  return transactions;
}

// ── Extract transactions from the page DOM ────────────────────────────
function extractTransactions() {
  const transactions = [];

  // Strategy 1: scan <table> elements (header-aware)
  document.querySelectorAll('table').forEach(table => {
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length < 2) return;

    const headerRow = allRows.find(r => r.querySelector('th')) || allRows[0];
    const colMap = getColumnMap(headerRow);
    const hasUsefulHeaders = colMap.dateIdx >= 0 || colMap.debitIdx >= 0 || colMap.amountIdx >= 0;

    allRows.forEach(row => {
      if (row === headerRow) return;
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) return;

      let dateText, description, amount;

      // ── Class-based detection (e.g. CIBC: td.date, td.debit, td.credit) ──
      const debitTd  = row.querySelector('td[class*="debit"], td[class*="withdrawal"]');
      const creditTd = row.querySelector('td[class*="credit"], td[class*="deposit"]');
      const dateTd   = row.querySelector('td[class*="date"]');
      const descTd   = row.querySelector('td[class*="transaction"], td[class*="description"], td[class*="detail"], td[class*="memo"]');

      if (dateTd && (debitTd || creditTd)) {
        // Only process debit rows; skip deposit rows
        if (!debitTd) return;
        const raw = debitTd.textContent.trim().replace(/\s+/g, ' ');
        // "Not applicable", blank, or no dollar sign → this row is a deposit, skip
        if (!raw || /not applicable|n\/a/i.test(raw) || !/\$[\d]/.test(raw)) return;

        dateText    = dateTd.textContent.trim();
        description = descTd ? descTd.textContent.trim().replace(/\s+/g, ' ') : null;
        amount      = parseAmount(raw, 'debit');

        if (!amount || amount <= 0) return;
        if (!looksLikeDate(dateText)) return;

        if (!description) {
          const usedTds = new Set([dateTd, debitTd, creditTd].filter(Boolean));
          const fallback = cells.find(td => !usedTds.has(td) && td.textContent.trim().length > 1 && !/\$[\d]/.test(td.textContent));
          description = fallback ? fallback.textContent.trim().replace(/\s+/g, ' ') : 'Unknown';
        }

        transactions.push({ date: dateText, month: extractDateMonth(dateText), description, amount });
        return; // row handled, skip header-guided path below
      }

      // ── Header-guided or heuristic detection ──────────────────────────
      const texts = cells.map(c => c.textContent.trim().replace(/\s+/g, ' '));

      if (hasUsefulHeaders) {
        dateText    = colMap.dateIdx >= 0 ? texts[colMap.dateIdx] : texts.find(t => looksLikeDate(t));
        description = colMap.descIdx >= 0 ? texts[colMap.descIdx] : null;

        if (colMap.debitIdx >= 0) {
          const raw = texts[colMap.debitIdx];
          if (!raw || raw === '-' || raw === '') return;
          amount = parseAmount(raw, 'debit');
        } else if (colMap.amountIdx >= 0) {
          amount = parseAmount(texts[colMap.amountIdx]);
        } else {
          const amountText = texts.find(t => /\$[\d,]+\.?\d*|^-?[\d,]+\.\d{2}$|\([\d,]+\.\d{2}\)/.test(t));
          amount = amountText ? parseAmount(amountText) : null;
        }
      } else {
        const dateCell   = texts.find(t => looksLikeDate(t));
        const amountCell = texts.find(t => /\$[\d,]+\.?\d*|^-?[\d,]+\.\d{2}$|\([\d,]+\.\d{2}\)/.test(t));
        if (!dateCell || !amountCell) return;
        dateText = dateCell;
        amount = parseAmount(amountCell);
      }

      if (!dateText || !looksLikeDate(dateText)) return;
      if (amount === null) return;

      if (!description) {
        const usedIndices = [colMap.dateIdx, colMap.debitIdx, colMap.creditIdx, colMap.amountIdx].filter(i => i >= 0);
        description = texts.find((t, i) => !usedIndices.includes(i) && t.length > 1 && !looksLikeDate(t) && !/\$[\d,]/.test(t)) || 'Unknown';
      }

      transactions.push({ date: dateText, month: extractDateMonth(dateText), description, amount });
    });
  });

  // Strategy 2: class-name-based div rows (modern SPA banking sites)
  const TRANSACTION_SELECTORS = [
    '[class*="transaction"]', '[class*="Transaction"]',
    '[class*="activity"]',   '[class*="Activity"]',
    '[class*="history"]',    '[class*="History"]',
    '[aria-label*="transaction"]', '[data-testid*="transaction"]',
  ];
  const seen = new Set();
  TRANSACTION_SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);

      // Skip elements inside rows with class-based debit/credit columns (handled by Strategy 1)
      const closestRow = el.closest('tr') || el;
      if (closestRow.querySelector('td[class*="debit"]') || closestRow.querySelector('td[class*="credit"]')) return;

      const text = el.textContent.trim().replace(/\s+/g, ' ');
      const dateMatch  = DATE_PATTERNS.map(p => text.match(p)).find(Boolean);
      const amountMatch = text.match(/[-\u2212]\s*\$[\d,]+\.?\d*|\(\$[\d,]+\.?\d*\)|\$[\d,]+\.\d{2}/);
      if (!dateMatch || !amountMatch) return;

      const dateText   = dateMatch[0];
      const amountText = amountMatch[0];
      const isDebitCtx = hasDebitHeaderNearby(el);
      const forceSign  = isDebitCtx || /[-\u2212(]/.test(amountText) ? 'debit' : null;
      const amount     = parseAmount(amountText, forceSign);
      if (!amount || amount <= 0) return;

      const description = text.replace(dateText, '').replace(amountText, '')
        .trim().split(/\n|\s{3,}/)[0].trim() || 'Unknown';

      transactions.push({ date: dateText, month: extractDateMonth(dateText), description, amount });
    });
  });

  // Strategy 3: date-first text-node scan — catches any DOM structure
  // (CIBC and other banks that use div/CSS grid layouts instead of <table>)
  const s3 = extractByDateScan();
  const existingKeys = new Set(
    transactions.map(t => t.description.slice(0, 20) + '|' + Math.round(t.amount * 100))
  );
  s3.forEach(tx => {
    const key = tx.description.slice(0, 20) + '|' + Math.round(tx.amount * 100);
    if (!existingKeys.has(key)) {
      transactions.push(tx);
      existingKeys.add(key);
    }
  });

  return transactions;
}

// ── Group and summarize transactions ─────────────────────────────────
async function buildSummary(transactions) {
  const categories = await loadCategories();

  // Summarize ALL transactions on the page (across all months)
  // Only count spending: positive amount = money left the account (debit/withdrawal)
  // Negative amounts are credits/deposits — excluded from the summary
  const debits = transactions.filter(tx => tx.amount > 0);

  // Build display label from the months present
  const monthSet = new Set(debits.map(tx => tx.month).filter(Boolean));
  const monthList = Array.from(monthSet);
  const targetMonth = monthList.length === 1 ? monthList[0]
    : monthList.length > 1 ? monthList.join(' & ')
    : 'All Transactions';

  const catMap = {};
  debits.forEach(tx => {
    const catName = categorize(tx.description, categories);
    if (!catMap[catName]) {
      catMap[catName] = {
        icon: categories[catName]?.icon || '📦',
        total: 0,
        items: [],
      };
    }
    catMap[catName].total += tx.amount;
    catMap[catName].items.push(tx);
  });

  return {
    month: targetMonth,
    totalSpent: debits.reduce((s, tx) => s + tx.amount, 0),
    categories: catMap,
    transactionCount: debits.length,
  };
}

// ── Format currency ───────────────────────────────────────────────────
function fmt(amount) {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Build sidebar HTML (injected into Shadow DOM) ─────────────────────
function buildSidebarHTML(summary) {
  const catEntries = Object.entries(summary.categories)
    .sort((a, b) => b[1].total - a[1].total);

  const categoryHTML = catEntries.map(([name, cat], idx) => {
    const itemsHTML = cat.items
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(tx => `
        <div class="ff-item">
          <span class="ff-item-desc">${escapeHTML(tx.description)}</span>
          <span class="ff-item-amount">${fmt(tx.amount)}</span>
        </div>
      `).join('');

    return `
      <div class="ff-category">
        <div class="ff-cat-header" data-idx="${idx}">
          <span class="ff-cat-icon">${cat.icon}</span>
          <span class="ff-cat-name">${escapeHTML(name)}</span>
          <span class="ff-cat-total">${fmt(cat.total)}</span>
          <span class="ff-chevron">▶</span>
        </div>
        <div class="ff-cat-items" id="ff-items-${idx}" style="display:none;">
          ${itemsHTML}
        </div>
      </div>
    `;
  }).join('');

  const noDataMsg = catEntries.length === 0
    ? '<div class="ff-no-data">No transactions found on this page. Navigate to your transaction history and try again.</div>'
    : '';

  return `
    <div class="ff-sidebar">
      <div class="ff-header">
        <span class="ff-title">🦊 Fiscal Fox</span>
        <button class="ff-close" id="ff-close-btn">✕</button>
      </div>
      <div class="ff-overview">
        <div class="ff-month">📅 ${escapeHTML(summary.month)}</div>
        <div class="ff-total-label">Total Spent</div>
        <div class="ff-total-amount">${fmt(summary.totalSpent)}</div>
        <div class="ff-tx-count">${summary.transactionCount} transaction${summary.transactionCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="ff-divider"></div>
      <div class="ff-categories">
        ${noDataMsg}
        ${categoryHTML}
      </div>
    </div>
  `;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Sidebar CSS ───────────────────────────────────────────────────────
const SIDEBAR_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .ff-sidebar {
    width: 340px;
    height: 100vh;
    background: #1a1d23;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
  }

  .ff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: #21242d;
    border-bottom: 1px solid #2d3140;
    flex-shrink: 0;
  }

  .ff-title {
    font-size: 15px;
    font-weight: 600;
    color: #61dafb;
    letter-spacing: 0.3px;
  }

  .ff-close {
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }

  .ff-close:hover {
    color: #fff;
    background: rgba(255,255,255,0.1);
  }

  .ff-overview {
    padding: 16px;
    background: #21242d;
    flex-shrink: 0;
  }

  .ff-month {
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .ff-total-label {
    font-size: 11px;
    color: #666;
    margin-bottom: 2px;
  }

  .ff-total-amount {
    font-size: 28px;
    font-weight: 700;
    color: #61dafb;
    letter-spacing: -0.5px;
  }

  .ff-tx-count {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .ff-divider {
    height: 1px;
    background: #2d3140;
    flex-shrink: 0;
  }

  .ff-categories {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .ff-categories::-webkit-scrollbar {
    width: 6px;
  }

  .ff-categories::-webkit-scrollbar-track {
    background: transparent;
  }

  .ff-categories::-webkit-scrollbar-thumb {
    background: #3a3f50;
    border-radius: 3px;
  }

  .ff-category {
    border-bottom: 1px solid #2d3140;
  }

  .ff-cat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .ff-cat-header:hover {
    background: rgba(255,255,255,0.04);
  }

  .ff-cat-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .ff-cat-name {
    flex: 1;
    font-weight: 500;
    color: #d0d0d0;
  }

  .ff-cat-total {
    font-weight: 600;
    color: #61dafb;
    font-size: 13px;
  }

  .ff-chevron {
    font-size: 10px;
    color: #555;
    transition: transform 0.2s;
    margin-left: 4px;
  }

  .ff-chevron.open {
    transform: rotate(90deg);
  }

  .ff-cat-items {
    background: rgba(0,0,0,0.15);
    padding: 0 16px 8px 16px;
  }

  .ff-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #2d3140;
    gap: 8px;
  }

  .ff-item:last-child {
    border-bottom: none;
  }

  .ff-item-desc {
    color: #aaa;
    font-size: 12px;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ff-item-amount {
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .ff-no-data {
    padding: 24px 16px;
    color: #666;
    font-size: 13px;
    line-height: 1.6;
    text-align: center;
  }
`;

// ── Inject sidebar into page ──────────────────────────────────────────
async function injectSidebar() {
  // Remove any existing sidebar
  removeSidebar();

  const transactions = extractTransactions();
  const summary = await buildSummary(transactions);

  // Create host element
  const host = document.createElement('div');
  host.id = 'fiscal-fox-sidebar-host';
  host.style.cssText =
    'position:fixed;top:0;right:0;width:340px;height:100vh;z-index:2147483647;' +
    'pointer-events:auto;';
  document.body.appendChild(host);

  // Attach shadow root
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = SIDEBAR_CSS;
  shadow.appendChild(styleEl);

  // Inject sidebar HTML
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildSidebarHTML(summary);
  shadow.appendChild(wrapper);

  // Wire up close button
  shadow.getElementById('ff-close-btn').addEventListener('click', () => {
    removeSidebar();
    sidebarOpen = false;
  });

  // Wire up category accordions
  shadow.querySelectorAll('.ff-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const idx = header.dataset.idx;
      const items = shadow.getElementById('ff-items-' + idx);
      const chevron = header.querySelector('.ff-chevron');
      const isOpen = items.style.display !== 'none';
      items.style.display = isOpen ? 'none' : 'block';
      chevron.classList.toggle('open', !isOpen);
    });
  });

  sidebarOpen = true;
}

// ── Remove sidebar from page ──────────────────────────────────────────
function removeSidebar() {
  const existing = document.getElementById('fiscal-fox-sidebar-host');
  if (existing) existing.remove();
}

// ── Message listener from popup ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggleSummarize') {
    if (sidebarOpen) {
      removeSidebar();
      sidebarOpen = false;
      sendResponse({ sidebarOpen: false });
    } else {
      injectSidebar().then(() => {
        sendResponse({ sidebarOpen: true });
      });
      return true; // keep channel open for async
    }
  }

  if (msg.action === 'getSummarizeState') {
    sendResponse({ sidebarOpen });
  }
});
