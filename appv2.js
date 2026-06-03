/* ─────────────────────────────────────────────
   LedgerDay — app.js
   Full auth + P&L calendar logic
───────────────────────────────────────────── */

/* ══════════════════════════════════════════
   CURRENCY DATA
══════════════════════════════════════════ */
const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', name: 'US Dollar',       symbol: '$',  rate: 1 },
  { code: 'EUR', flag: '🇪🇺', name: 'Euro',             symbol: '€',  rate: 0.92 },
  { code: 'GBP', flag: '🇬🇧', name: 'British Pound',    symbol: '£',  rate: 0.79 },
  { code: 'JPY', flag: '🇯🇵', name: 'Japanese Yen',     symbol: '¥',  rate: 149.5 },
  { code: 'CAD', flag: '🇨🇦', name: 'Canadian Dollar',  symbol: 'C$', rate: 1.36 },
  { code: 'AUD', flag: '🇦🇺', name: 'Australian Dollar',symbol: 'A$', rate: 1.53 },
  { code: 'CHF', flag: '🇨🇭', name: 'Swiss Franc',      symbol: 'Fr', rate: 0.90 },
  { code: 'CNY', flag: '🇨🇳', name: 'Chinese Yuan',     symbol: '¥',  rate: 7.24 },
  { code: 'INR', flag: '🇮🇳', name: 'Indian Rupee',     symbol: '₹',  rate: 83.1 },
  { code: 'KRW', flag: '🇰🇷', name: 'Korean Won',       symbol: '₩',  rate: 1325 },
  { code: 'MXN', flag: '🇲🇽', name: 'Mexican Peso',     symbol: '$',  rate: 17.2 },
  { code: 'BRL', flag: '🇧🇷', name: 'Brazilian Real',   symbol: 'R$', rate: 4.97 },
  { code: 'SGD', flag: '🇸🇬', name: 'Singapore Dollar', symbol: 'S$', rate: 1.34 },
  { code: 'HKD', flag: '🇭🇰', name: 'Hong Kong Dollar', symbol: 'HK$',rate: 7.82 },
  { code: 'NOK', flag: '🇳🇴', name: 'Norwegian Krone',  symbol: 'kr', rate: 10.6 },
];

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let state = {
  currentUser: null,       // { name, email }
  users: {},               // keyed by email → { name, password, entries }
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),  // 0-indexed
  primaryCurrency: 'USD',
  secondaryCurrencies: [],
  modalDate: null,         // 'YYYY-MM-DD'
  modalSign: 1,            // 1 = profit, -1 = loss
  theme: 'dark',
};

/* ══════════════════════════════════════════
   PERSISTENCE  (localStorage)
══════════════════════════════════════════ */
function persist() {
  try {
    localStorage.setItem('ledgerday_users', JSON.stringify(state.users));
    localStorage.setItem('ledgerday_session', JSON.stringify({
      email: state.currentUser ? state.currentUser.email : null,
      primaryCurrency: state.primaryCurrency,
      secondaryCurrencies: state.secondaryCurrencies,
      theme: state.theme,
    }));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

function loadPersisted() {
  try {
    const users = localStorage.getItem('ledgerday_users');
    if (users) state.users = JSON.parse(users);

    const session = localStorage.getItem('ledgerday_session');
    if (session) {
      const s = JSON.parse(session);
      state.primaryCurrency = s.primaryCurrency || 'USD';
      state.secondaryCurrencies = s.secondaryCurrencies || [];
      state.theme = s.theme || 'dark';
      // Auto-login if session exists and user still in DB
      if (s.email && state.users[s.email]) {
        state.currentUser = {
          email: s.email,
          name: state.users[s.email].name,
        };
      }
    }
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
  }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getEntries() {
  if (!state.currentUser) return {};
  return state.users[state.currentUser.email]?.entries || {};
}

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

function convertFromUSD(usdAmount, toCurrencyCode) {
  const cur = getCurrency(toCurrencyCode);
  return usdAmount * cur.rate;
}

function formatAmount(usdAmount, currencyCode, opts = {}) {
  const cur = getCurrency(currencyCode);
  const converted = convertFromUSD(Math.abs(usdAmount), currencyCode);
  const sign = usdAmount >= 0 ? '+' : '-';
  const noSign = opts.noSign || false;

  if (currencyCode === 'JPY' || currencyCode === 'KRW') {
    const val = Math.round(converted).toLocaleString();
    return noSign ? `${cur.symbol}${val}` : `${sign}${cur.symbol}${val}`;
  }
  const val = converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return noSign ? `${cur.symbol}${val}` : `${sign}${cur.symbol}${val}`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ══════════════════════════════════════════
   THEME
══════════════════════════════════════════ */
function applyTheme() {
  if (state.theme === 'light') {
    document.documentElement.classList.add('light');
    document.getElementById('theme-toggle').textContent = '☀️';
  } else {
    document.documentElement.classList.remove('light');
    document.getElementById('theme-toggle').textContent = '🌙';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  persist();
}

/* ══════════════════════════════════════════
   AUTH — SHOW/HIDE PANELS
══════════════════════════════════════════ */
function showLogin() {
  document.getElementById('auth-login').style.display = '';
  document.getElementById('auth-register').style.display = 'none';
  hideError('login-error');
  hideError('register-error');
}

function showRegister() {
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-register').style.display = '';
  hideError('login-error');
  hideError('register-error');
}

/* ══════════════════════════════════════════
   AUTH — REGISTER
══════════════════════════════════════════ */
function doRegister() {
  hideError('register-error');

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;

  // Validate
  if (!name) {
    showError('register-error', 'Please enter your name.');
    return;
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    showError('register-error', 'Please enter a valid email address.');
    return;
  }
  if (password.length < 6) {
    showError('register-error', 'Password must be at least 6 characters.');
    return;
  }
  if (state.users[email]) {
    showError('register-error', 'An account with this email already exists. Try signing in.');
    return;
  }

  // Create user
  state.users[email] = { name, password, entries: {} };
  state.currentUser = { email, name };
  persist();
  enterApp();
}

/* ══════════════════════════════════════════
   AUTH — LOGIN
══════════════════════════════════════════ */
function doLogin() {
  hideError('login-error');

  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  if (!email) {
    showError('login-error', 'Please enter your email.');
    return;
  }
  if (!password) {
    showError('login-error', 'Please enter your password.');
    return;
  }

  const user = state.users[email];
  if (!user) {
    showError('login-error', 'No account found with that email. Create one below.');
    return;
  }
  if (user.password !== password) {
    showError('login-error', 'Incorrect password. Please try again.');
    return;
  }

  state.currentUser = { email, name: user.name };
  persist();
  enterApp();
}

/* ══════════════════════════════════════════
   AUTH — LOGOUT
══════════════════════════════════════════ */
function doLogout() {
  state.currentUser = null;
  persist();

  // Clear input fields
  ['login-email', 'login-password', 'reg-name', 'reg-email', 'reg-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = '';
  showLogin();
}

/* ══════════════════════════════════════════
   ENTER APP
══════════════════════════════════════════ */
function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = '';

  // Update user display
  document.getElementById('user-name-display').textContent = state.currentUser.name;
  document.getElementById('user-avatar').textContent = initials(state.currentUser.name);

  applyTheme();
  buildCurrencyUI();
  renderCalendar();
}

/* ══════════════════════════════════════════
   CALENDAR NAV
══════════════════════════════════════════ */
function changeMonth(delta) {
  state.viewMonth += delta;
  if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
  if (state.viewMonth < 0)  { state.viewMonth = 11; state.viewYear--; }
  renderCalendar();
}

/* ══════════════════════════════════════════
   RENDER CALENDAR
══════════════════════════════════════════ */
function renderCalendar() {
  const { viewYear: y, viewMonth: m } = state;
  const entries = getEntries();

  // Month label
  const label = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = label;

  const today = new Date();
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(y, m, d);
    const entry = entries[key];
    const isToday = (today.getFullYear() === y && today.getMonth() === m && today.getDate() === d);

    let cls = 'day';
    if (isToday) cls += ' today';
    if (entry) {
      cls += entry.amount >= 0 ? ' has-profit' : ' has-loss';
    }

    let innerHtml = `<div class="day-num">${d}</div>`;

    if (entry) {
      const amtClass = entry.amount >= 0 ? 'pos' : 'neg';
      const primary = formatAmount(entry.amount, state.primaryCurrency);
      innerHtml += `<div class="day-primary ${amtClass}">${primary}</div>`;

      // Secondary currencies
      if (state.secondaryCurrencies.length > 0) {
        const secLines = state.secondaryCurrencies.map(code => {
          return `<div>${formatAmount(entry.amount, code)}</div>`;
        }).join('');
        innerHtml += `<div class="day-secondary">${secLines}</div>`;
      }

      if (entry.note) {
        innerHtml += `<div class="day-note">${escHtml(entry.note)}</div>`;
      }
    }

    html += `<div class="${cls}" onclick="openModal('${key}')">${innerHtml}</div>`;
  }

  document.getElementById('day-grid').innerHTML = html;
  updateSummary();
}

/* ══════════════════════════════════════════
   SUMMARY STATS
══════════════════════════════════════════ */
function updateSummary() {
  const entries = getEntries();
  const { viewYear: y, viewMonth: m } = state;
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;

  const monthEntries = Object.entries(entries)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v.amount);

  const total = monthEntries.reduce((a, b) => a + b, 0);
  const best  = monthEntries.length ? Math.max(...monthEntries) : null;
  const worst = monthEntries.length ? Math.min(...monthEntries) : null;
  const wins  = monthEntries.filter(a => a > 0).length;
  const total_days = monthEntries.length;

  const totalEl = document.getElementById('s-total');
  totalEl.textContent = monthEntries.length ? formatAmount(total, state.primaryCurrency) : '$0';
  totalEl.className = 'stat-val ' + (total > 0 ? 'pos' : total < 0 ? 'neg' : 'neu');

  document.getElementById('s-best').textContent  = best !== null  ? formatAmount(best,  state.primaryCurrency) : '—';
  document.getElementById('s-worst').textContent = worst !== null ? formatAmount(worst, state.primaryCurrency) : '—';
  document.getElementById('s-wins').textContent  = total_days ? `${wins} / ${total_days}` : '—';

  // Secondary for total
  if (state.secondaryCurrencies.length && monthEntries.length) {
    document.getElementById('s-total-sec').textContent =
      state.secondaryCurrencies.map(c => formatAmount(total, c)).join(' · ');
  } else {
    document.getElementById('s-total-sec').textContent = '';
  }

  // Secondary for best/worst
  if (best !== null && state.secondaryCurrencies.length) {
    document.getElementById('s-best-sec').textContent =
      state.secondaryCurrencies.map(c => formatAmount(best, c)).join(' · ');
    document.getElementById('s-worst-sec').textContent =
      state.secondaryCurrencies.map(c => formatAmount(worst, c)).join(' · ');
  } else {
    document.getElementById('s-best-sec').textContent = '';
    document.getElementById('s-worst-sec').textContent = '';
  }

  if (total_days) {
    const pct = Math.round((wins / total_days) * 100);
    document.getElementById('s-wins-sec').textContent = `${pct}% win rate`;
  } else {
    document.getElementById('s-wins-sec').textContent = '';
  }
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
function openModal(dateStr) {
  state.modalDate = dateStr;
  const entries = getEntries();
  const entry = entries[dateStr];

  // Format date nicely
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dateLabel = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
  });
  document.getElementById('modal-date-badge').textContent = dateLabel;

  if (entry) {
    state.modalSign = entry.amount >= 0 ? 1 : -1;
    document.getElementById('modal-amount').value = Math.abs(entry.amount);
    document.getElementById('modal-note').value = entry.note || '';
    document.getElementById('btn-delete').style.display = '';
  } else {
    state.modalSign = 1;
    document.getElementById('modal-amount').value = '';
    document.getElementById('modal-note').value = '';
    document.getElementById('btn-delete').style.display = 'none';
  }

  setSign(state.modalSign, false);
  updateModalSecondary();

  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-amount').focus(), 150);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  state.modalDate = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function setSign(sign, updateInput = true) {
  state.modalSign = sign;
  document.getElementById('btn-pos').className = 'sign-btn' + (sign === 1 ? ' active-pos' : '');
  document.getElementById('btn-neg').className = 'sign-btn' + (sign === -1 ? ' active-neg' : '');
}

function updateModalSecondary() {
  const raw = parseFloat(document.getElementById('modal-amount').value) || 0;
  const usd = raw * state.modalSign;
  const preview = document.getElementById('modal-secondary-preview');
  const list = document.getElementById('modal-secondary-list');

  if (state.secondaryCurrencies.length === 0 || raw === 0) {
    preview.style.display = 'none';
    return;
  }

  preview.style.display = '';
  list.innerHTML = state.secondaryCurrencies.map(code => {
    const cur = getCurrency(code);
    return `<div class="modal-secondary-item">
      <span>${cur.flag} ${code}</span>
      <span>${formatAmount(usd, code)}</span>
    </div>`;
  }).join('');
}

function saveEntry() {
  const raw = parseFloat(document.getElementById('modal-amount').value);
  if (isNaN(raw) || raw < 0) {
    document.getElementById('modal-amount').style.borderColor = 'var(--red)';
    setTimeout(() => document.getElementById('modal-amount').style.borderColor = '', 1200);
    return;
  }

  const amount = raw * state.modalSign;
  const note   = document.getElementById('modal-note').value.trim();
  const email  = state.currentUser.email;

  if (!state.users[email].entries) state.users[email].entries = {};
  state.users[email].entries[state.modalDate] = { amount, note };

  persist();
  closeModal();
  renderCalendar();
}

function deleteEntry() {
  if (!state.modalDate || !state.currentUser) return;
  const email = state.currentUser.email;
  delete state.users[email].entries[state.modalDate];
  persist();
  closeModal();
  renderCalendar();
}

/* ══════════════════════════════════════════
   CURRENCY UI
══════════════════════════════════════════ */
function buildCurrencyUI() {
  buildPrimaryList();
  buildSecondaryPanel();
  buildSecondaryPills();
  updatePrimaryButton();
}

function updatePrimaryButton() {
  const cur = getCurrency(state.primaryCurrency);
  document.getElementById('main-currency-flag').textContent = cur.flag;
  document.getElementById('main-currency-code').textContent = cur.code;
}

function buildPrimaryList() {
  const container = document.getElementById('primary-currency-list');
  container.innerHTML = CURRENCIES.map(cur => `
    <div class="currency-option ${cur.code === state.primaryCurrency ? 'active' : ''}"
         onclick="selectPrimary('${cur.code}')">
      <div class="currency-option-left">
        <span class="currency-flag">${cur.flag}</span>
        <div>
          <div class="currency-code">${cur.code}</div>
          <div class="currency-name">${cur.name}</div>
        </div>
      </div>
      <span class="currency-check">✓</span>
    </div>
  `).join('');
}

function selectPrimary(code) {
  // Remove from secondaries if it was there
  state.secondaryCurrencies = state.secondaryCurrencies.filter(c => c !== code);
  state.primaryCurrency = code;
  persist();
  toggleCurrencyDropdown(false);
  buildCurrencyUI();
  renderCalendar();
}

function toggleCurrencyDropdown(forceClose) {
  const dd = document.getElementById('currency-dropdown');
  if (forceClose === false || dd.classList.contains('open')) {
    dd.classList.remove('open');
  } else {
    buildPrimaryList(); // refresh active states
    dd.classList.add('open');
  }
}

function buildSecondaryPanel() {
  const grid = document.getElementById('secondary-panel-grid');
  const available = CURRENCIES.filter(c => c.code !== state.primaryCurrency);
  grid.innerHTML = available.map(cur => {
    const active = state.secondaryCurrencies.includes(cur.code);
    return `<div class="secondary-toggle-item ${active ? 'active' : ''}"
                 onclick="toggleSecondary('${cur.code}')">
      <span>${cur.flag}</span>
      <span class="currency-code">${cur.code}</span>
      <span style="font-size:11px;color:var(--text3)">${cur.name}</span>
      <span class="sti-check">✓</span>
    </div>`;
  }).join('');

  document.getElementById('secondary-panel-title') &&
    (document.getElementById('secondary-panel-title').textContent =
      `Select currencies to display alongside ${state.primaryCurrency}`);
}

function toggleSecondary(code) {
  const idx = state.secondaryCurrencies.indexOf(code);
  if (idx >= 0) {
    state.secondaryCurrencies.splice(idx, 1);
  } else {
    if (state.secondaryCurrencies.length >= 4) {
      state.secondaryCurrencies.shift(); // max 4 secondaries
    }
    state.secondaryCurrencies.push(code);
  }
  persist();
  buildSecondaryPanel();
  buildSecondaryPills();
  renderCalendar();
}

function buildSecondaryPills() {
  const container = document.getElementById('secondary-pills');
  const addBtn = '<button class="add-currency-btn" onclick="toggleSecondaryPanel()">+ Add currency</button>';

  const pills = state.secondaryCurrencies.map(code => {
    const cur = getCurrency(code);
    return `<span class="sec-pill active" onclick="toggleSecondary('${code}')">
      <span class="sec-pill-flag">${cur.flag}</span>
      ${cur.code} <span style="opacity:0.5;margin-left:2px">×</span>
    </span>`;
  }).join('');

  container.innerHTML = pills + addBtn;
}

function toggleSecondaryPanel() {
  const panel = document.getElementById('secondary-panel');
  panel.classList.toggle('visible');
}

/* ══════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();

  // Enter to submit auth forms
  if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('open')) {
    const loginVisible = document.getElementById('auth-login').style.display !== 'none';
    const registerVisible = document.getElementById('auth-register').style.display !== 'none';
    if (!state.currentUser && loginVisible) doLogin();
    if (!state.currentUser && registerVisible) doRegister();
  }

  // Enter to save modal
  if (e.key === 'Enter' && e.ctrlKey && document.getElementById('modal-overlay').classList.contains('open')) {
    saveEntry();
  }
});

/* ══════════════════════════════════════════
   CLOSE DROPDOWN ON OUTSIDE CLICK
══════════════════════════════════════════ */
document.addEventListener('click', e => {
  const dd = document.getElementById('currency-dropdown');
  const wrap = document.querySelector('.currency-wrap');
  if (dd && wrap && !wrap.contains(e.target)) {
    dd.classList.remove('open');
  }
});

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
(function init() {
  loadPersisted();
  applyTheme();

  if (state.currentUser) {
    enterApp();
  } else {
    document.getElementById('auth-screen').style.display = '';
    document.getElementById('main-screen').style.display = 'none';
    showLogin();
  }
})();
