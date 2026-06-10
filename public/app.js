// ─── Utility ──────────────────────────────────────────────────────────────────
const safeStorage = {
    get: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} },
    remove: (k) => { try { localStorage.removeItem(k); } catch(e) {} }
};
const safeSession = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch(e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch(e) {} }
};

let state = {
    currentPage: 1,
    limit: 50,
    search: '',
    searchField: 'name',
    searchMode: 'starts',       // 'starts' | 'contains'
    orderBy: 'id',
    orderDir: 'asc',
    statusFilter: '',
    totalPages: 0,
    totalRecords: 0,
    contacts: [],
    loading: false,
    defaultWaMessage: '',
    noWaPhones: new Set(),
    sourcePath: '',
    dedup: false,
    exportBusy: false,
    currentContact: null,
    ftsAvailable: false
};

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const el = {
    themeToggle: document.getElementById('theme-toggle'),
    compactToggle: document.getElementById('compact-toggle'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    searchField: document.getElementById('search-field'),
    searchModeBtn: document.getElementById('search-mode-btn'),
    searchModeLabel: document.getElementById('search-mode-label'),
    searchHistoryDropdown: document.getElementById('search-history-dropdown'),
    pageLimit: document.getElementById('page-limit'),
    sourceFilterInput: document.getElementById('source-filter-input'),
    sourceFilterHidden: document.getElementById('source-filter'),
    sourceFilterClear: document.getElementById('source-filter-clear'),
    sourceFilterDropdown: document.getElementById('source-filter-dropdown'),
    sourceFilterWrapper: document.getElementById('source-filter-wrapper'),
    statusFilter: document.getElementById('status-filter'),
    dedupToggle: document.getElementById('dedup-toggle'),
    exportBtn: document.getElementById('export-btn'),
    filterChips: document.getElementById('filter-chips'),
    tableBody: document.getElementById('table-body'),
    tableLoadingOverlay: document.getElementById('table-loading-overlay'),
    contactsTable: document.getElementById('contacts-table'),
    btnFirst: document.getElementById('btn-first'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnLast: document.getElementById('btn-last'),
    currentPageInput: document.getElementById('current-page-input'),
    totalPagesSpan: document.getElementById('total-pages'),
    pagStart: document.getElementById('pag-start'),
    pagEnd: document.getElementById('pag-end'),
    pagTotal: document.getElementById('pag-total'),
    statTotal: document.getElementById('stat-total'),
    statPhone: document.getElementById('stat-phone'),
    statPhonePct: document.getElementById('stat-phone-pct'),
    statSpeed: document.getElementById('stat-speed'),
    statRange: document.getElementById('stat-range'),
    statFilteredTotal: document.getElementById('stat-filtered-total'),
    dbStatus: document.getElementById('db-status'),
    headerBadge: document.getElementById('header-badge'),
    ftsBadge: document.getElementById('fts-badge'),
    colSelectorBtn: document.getElementById('col-selector-btn'),
    colSelectorDropdown: document.getElementById('col-selector-dropdown'),
    jumpToIdInput: document.getElementById('jump-to-id-input'),
    jumpToIdBtn: document.getElementById('jump-to-id-btn'),
    toastContainer: document.getElementById('toast-container'),
    // Drawer
    detailDrawer: document.getElementById('detail-drawer'),
    drawerBody: document.getElementById('drawer-body'),
    closeDrawer: document.getElementById('close-drawer'),
    copyAllBtn: document.getElementById('copy-all-btn'),
    detailAvatar: document.getElementById('detail-avatar'),
    detailName: document.getElementById('detail-name'),
    detailFileRef: document.getElementById('detail-file-ref'),
    detailPhone: document.getElementById('detail-phone'),
    detailEmail: document.getElementById('detail-email'),
    detailLocation: document.getElementById('detail-location'),
    detailFileType: document.getElementById('detail-file-type'),
    detailRowNum: document.getElementById('detail-row-num'),
    detailSheetName: document.getElementById('detail-sheet-name'),
    detailDbId: document.getElementById('detail-db-id'),
    detailRawData: document.getElementById('detail-raw-data'),
    detailWaLink: document.getElementById('detail-wa-link'),
    detailCopyPhone: document.getElementById('detail-copy-phone'),
    detailNoWaToggle: document.getElementById('detail-no-wa-toggle'),
    statusButtons: document.getElementById('status-buttons'),
    // WA Bar
    waDefaultMessage: document.getElementById('wa-default-message'),
    waCopyMsg: document.getElementById('wa-copy-msg'),
    waBulkBtn: document.getElementById('wa-bulk-btn'),
    waClearMsg: document.getElementById('wa-clear-msg'),
    // Modals
    analyticsBtn: document.getElementById('analytics-btn'),
    analyticsModal: document.getElementById('analytics-modal'),
    closeAnalytics: document.getElementById('close-analytics'),
    analyticsBody: document.getElementById('analytics-body'),
    bulkWaModal: document.getElementById('bulk-wa-modal'),
    closeBulkWa: document.getElementById('close-bulk-wa'),
    bulkWaList: document.getElementById('bulk-wa-list'),
    bulkWaCount: document.getElementById('bulk-wa-count'),
    bulkWaOpenAll: document.getElementById('bulk-wa-open-all'),
    bulkWaCopyAllPhones: document.getElementById('bulk-wa-copy-all-phones'),
    shortcutsBtn: document.getElementById('shortcuts-btn'),
    shortcutsModal: document.getElementById('shortcuts-modal'),
    closeShortcuts: document.getElementById('close-shortcuts')
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function formatCell(v) {
    return (v === undefined || v === null || v.toString().trim() === '')
        ? `<span class="empty-cell">—</span>` : v;
}

function getInitials(name) {
    if (!name || !name.trim()) return '?';
    const parts = name.replace(/[^\w\s]/gi, '').trim().split(/\s+/);
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0][0] || '?')).toUpperCase();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success', ms = 2500) {
    const icons = {
        success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        info:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
    el.toastContainer.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-show')));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, ms);
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

async function copyToClipboard(text, btn) {
    if (!text || text.toString().trim() === '') return;
    const str = text.toString().trim();
    try { await navigator.clipboard.writeText(str); }
    catch { const t = document.createElement('textarea'); t.value = str; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(t); }
    if (btn) {
        const prev = btn.innerHTML, prevTitle = btn.title;
        btn.classList.add('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        btn.title = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = prev; btn.title = prevTitle; }, 1500);
    }
}

// ─── WhatsApp / Phone Helpers ─────────────────────────────────────────────────

function cleanPhone(raw) {
    if (!raw || !raw.toString().trim()) return '';
    let p = raw.toString().replace(/[\s\-().+]/g, '').replace(/\D/g, '');
    if (!p) return '';
    if (p.length === 10 && /^[6-9]/.test(p)) p = '91' + p;
    else if (p.length === 11 && p.startsWith('0')) p = '91' + p.slice(1);
    return p;
}

function buildWaUrl(phone) {
    const cleaned = cleanPhone(phone);
    if (!cleaned) return null;
    const msg = state.defaultWaMessage.trim();
    return msg ? `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}` : `https://wa.me/${cleaned}`;
}

// ─── No-WA ────────────────────────────────────────────────────────────────────

function loadNoWaPhones() {
    try { const s = localStorage.getItem('noWaPhones'); if (s) state.noWaPhones = new Set(JSON.parse(s)); } catch { state.noWaPhones = new Set(); }
}
function saveNoWaPhones() { localStorage.setItem('noWaPhones', JSON.stringify([...state.noWaPhones])); }

// ─── Contact Status ───────────────────────────────────────────────────────────

const STATUS_META = {
    contacted:      { label: 'Contacted',     color: '#10b981', icon: '✓' },
    follow_up:      { label: 'Follow Up',      color: '#f59e0b', icon: '★' },
    not_interested: { label: 'Not Interested', color: '#ef4444', icon: '✗' },
    saved:          { label: 'Saved',          color: '#3b82f6', icon: '🔖' }
};

function loadStatuses() { try { return JSON.parse(localStorage.getItem('contactStatuses') || '{}'); } catch { return {}; } }

function setContactStatus(id, status) {
    const statuses = loadStatuses();
    const key = String(id);
    if (!status) delete statuses[key]; else statuses[key] = status;
    localStorage.setItem('contactStatuses', JSON.stringify(statuses));
}

function getContactStatus(id) { return loadStatuses()[String(id)] || null; }

function updateStatusButtons(id) {
    const current = getContactStatus(id);
    el.statusButtons.querySelectorAll('.btn-status').forEach(btn => {
        const s = btn.dataset.status;
        btn.classList.toggle('status-active', s !== '' && s === current);
    });
}

// ─── Search History ───────────────────────────────────────────────────────────

const HISTORY_MAX = 10;

function loadSearchHistory() { try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; } }

function saveToHistory(term) {
    if (!term || term.trim().length < 2) return;
    let h = loadSearchHistory();
    h = [term.trim(), ...h.filter(x => x !== term.trim())].slice(0, HISTORY_MAX);
    localStorage.setItem('searchHistory', JSON.stringify(h));
}

function renderHistoryDropdown() {
    const hist = loadSearchHistory();
    if (!hist.length) { el.searchHistoryDropdown.classList.add('hidden'); return; }
    el.searchHistoryDropdown.innerHTML =
        `<div class="history-header">Recent Searches</div>` +
        hist.map(h => `<div class="history-item" data-q="${h.replace(/"/g,'&quot;')}">${h}</div>`).join('') +
        `<div class="history-clear-row"><button id="history-clear-btn" class="history-clear-btn">Clear history</button></div>`;
    el.searchHistoryDropdown.classList.remove('hidden');

    el.searchHistoryDropdown.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            el.searchInput.value = item.dataset.q;
            state.search = item.dataset.q;
            el.clearSearch.classList.remove('hidden');
            el.searchHistoryDropdown.classList.add('hidden');
            state.currentPage = 1;
            fetchContacts();
        });
    });
    const clearBtn = el.searchHistoryDropdown.querySelector('#history-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            localStorage.removeItem('searchHistory');
            el.searchHistoryDropdown.classList.add('hidden');
            showToast('Search history cleared', 'info');
        });
    }
}

// ─── Session State ────────────────────────────────────────────────────────────

function saveSession() {
    try {
        sessionStorage.setItem('cState', JSON.stringify({
            search: state.search, searchField: state.searchField,
            searchMode: state.searchMode, sourcePath: state.sourcePath,
            dedup: state.dedup, limit: state.limit,
            currentPage: state.currentPage, orderBy: state.orderBy, orderDir: state.orderDir
        }));
    } catch {}
}

function loadSession() {
    try {
        const s = JSON.parse(safeSession.get('cState') || 'null');
        if (!s) return false;
        Object.assign(state, { search: s.search||'', searchField: s.searchField||'name',
            searchMode: s.searchMode||'starts', sourcePath: s.sourcePath||'',
            dedup: s.dedup||false, limit: s.limit||50, currentPage: s.currentPage||1,
            orderBy: s.orderBy||'id', orderDir: s.orderDir||'asc' });
        el.searchInput.value = state.search;
        el.clearSearch.classList.toggle('hidden', !state.search);
        el.searchField.value = state.searchField;
        el.pageLimit.value   = state.limit;
        if (state.dedup) el.dedupToggle.classList.add('btn-dedup-active');
        updateSearchModeUI();
        // sourcePath is restored after fetchSources() loads allSourceDirs
        return true;
    } catch { return false; }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function fetchStats() {
    try {
        const r = await fetch('/api/stats');
        if (!r.ok) return;
        const data = await r.json();
        const total = data.totalContacts || 0;
        el.statTotal.textContent = total.toLocaleString();
        if (el.headerBadge) el.headerBadge.textContent = `${(total / 1e6).toFixed(1)}M Records`;
        if (el.statPhone) el.statPhone.textContent = (data.hasPhone || 0).toLocaleString();
        if (el.statPhonePct && total > 0) el.statPhonePct.textContent = `${(data.hasPhone / total * 100).toFixed(1)}% have phone numbers`;

        // FTS5 indicator
        state.ftsAvailable = !!data.ftsAvailable;
        if (el.ftsBadge) el.ftsBadge.classList.toggle('hidden', !state.ftsAvailable);
    } catch(e) { console.warn('Stats fetch failed:', e); }
}

// ─── Sources ──────────────────────────────────────────────────────────────────

// ─── Sources — Searchable Combobox ───────────────────────────────────────────

let allSourceDirs = [];   // full list loaded once from API

async function fetchSources() {
    try {
        const r = await fetch('/api/sources');
        if (!r.ok) return;
        const data = await r.json();
        allSourceDirs = (data.directories || []).concat(data.files || []);

        // Restore saved sourcePath into the input display
        if (state.sourcePath) {
            const display = sourcePathDisplay(state.sourcePath);
            el.sourceFilterInput.value = display;
            el.sourceFilterHidden.value = state.sourcePath;
            el.sourceFilterClear.classList.remove('hidden');
            el.sourceFilterWrapper.classList.add('source-filter-active');
            updateFilterChips();
        }
    } catch(e) { console.warn('Sources fetch failed:', e); }
}

function sourcePathDisplay(p) {
    return p.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join(' / ') || p;
}

function renderSourceDropdown(query) {
    const q = query.trim().toLowerCase();
    const matches = q
        ? allSourceDirs.filter(d => d.toLowerCase().includes(q)).slice(0, 60)
        : allSourceDirs.slice(0, 60);

    if (!matches.length) {
        el.sourceFilterDropdown.innerHTML = `<div class="source-dd-empty">No directories match "${query}"</div>`;
        el.sourceFilterDropdown.classList.remove('hidden');
        return;
    }
    el.sourceFilterDropdown.innerHTML = matches.map(d => {
        const display = sourcePathDisplay(d);
        const parts   = d.replace(/\\/g, '/').split('/').filter(Boolean);
        const sub      = parts.slice(0, -2).join('/') || '';
        return `<div class="source-dd-item" data-path="${d.replace(/"/g,'&quot;')}" title="${d.replace(/"/g,'&quot;')}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <div class="source-dd-labels">
                <span class="source-dd-name">${display}</span>
                ${sub ? `<span class="source-dd-path">${sub}</span>` : ''}
            </div>
        </div>`;
    }).join('');
    el.sourceFilterDropdown.classList.remove('hidden');

    el.sourceFilterDropdown.querySelectorAll('.source-dd-item').forEach(item => {
        item.addEventListener('mousedown', e => {
            e.preventDefault();
            applySourceFilter(item.dataset.path);
        });
    });
}

function applySourceFilter(path) {
    state.sourcePath = path || '';
    el.sourceFilterHidden.value = path || '';
    if (path) {
        el.sourceFilterInput.value = sourcePathDisplay(path);
        el.sourceFilterClear.classList.remove('hidden');
        el.sourceFilterWrapper.classList.add('source-filter-active');
    } else {
        el.sourceFilterInput.value = '';
        el.sourceFilterClear.classList.add('hidden');
        el.sourceFilterWrapper.classList.remove('source-filter-active');
    }
    el.sourceFilterDropdown.classList.add('hidden');
    state.currentPage = 1;
    fetchContacts();
    updateFilterChips();
    saveSession();
}

function initSourceFilter() {
    el.sourceFilterInput.addEventListener('focus', () => {
        renderSourceDropdown(el.sourceFilterInput.value);
    });
    el.sourceFilterInput.addEventListener('input', () => {
        renderSourceDropdown(el.sourceFilterInput.value);
        // If user clears input manually, reset filter
        if (!el.sourceFilterInput.value.trim()) applySourceFilter('');
    });
    el.sourceFilterInput.addEventListener('blur', () => {
        // Delay so mousedown on item fires first
        setTimeout(() => el.sourceFilterDropdown.classList.add('hidden'), 150);
    });
    el.sourceFilterInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { applySourceFilter(''); el.sourceFilterInput.blur(); }
    });
    el.sourceFilterClear.addEventListener('click', () => applySourceFilter(''));

    // Close dropdown on outside click
    document.addEventListener('click', e => {
        if (!el.sourceFilterWrapper.contains(e.target)) {
            el.sourceFilterDropdown.classList.add('hidden');
        }
    });
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function updateFilterChips() {
    const chips = [];
    if (state.dedup) chips.push({ label: 'Hide Duplicates', remove: () => { state.dedup = false; el.dedupToggle.classList.remove('btn-dedup-active'); reset(); } });
    if (state.sourcePath) { const p = state.sourcePath.replace(/\\/g,'/').split('/').filter(Boolean); chips.push({ label: `Source: ${p.slice(-2).join('/')}`, remove: () => { applySourceFilter(''); } }); }
    if (state.searchMode === 'contains') chips.push({ label: 'Contains Mode', remove: () => { state.searchMode = 'starts'; updateSearchModeUI(); reset(); } });
    if (state.orderBy !== 'id') chips.push({ label: `Sort: ${state.orderBy} ${state.orderDir}`, remove: () => { state.orderBy = 'id'; state.orderDir = 'asc'; updateSortIndicators(); reset(); } });

    function reset() { state.currentPage = 1; fetchContacts(); updateFilterChips(); saveSession(); }

    if (!chips.length) { el.filterChips.classList.add('hidden'); el.filterChips.innerHTML = ''; return; }
    el.filterChips.classList.remove('hidden');
    el.filterChips.innerHTML = chips.map((c, i) =>
        `<span class="chip" data-chip="${i}">${c.label} <button class="chip-remove" data-chip="${i}">✕</button></span>`
    ).join('');
    el.filterChips.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', () => chips[+btn.dataset.chip].remove());
    });
}

// ─── Search Mode ──────────────────────────────────────────────────────────────

function updateSearchModeUI() {
    const isContains = state.searchMode === 'contains';
    el.searchModeLabel.textContent = isContains ? 'Contains' : 'Starts With';
    el.searchModeBtn.classList.toggle('search-mode-contains', isContains);
    el.searchModeBtn.title = isContains
        ? 'Contains: finds matches anywhere in the field (slower) — click to switch to Starts With'
        : 'Starts With: fast prefix search — click to switch to Contains (slower)';
}

// ─── Column Sorting ───────────────────────────────────────────────────────────

const SORTABLE = ['id', 'name', 'phone', 'email', 'location'];

function handleSort(col) {
    if (!SORTABLE.includes(col)) return;
    if (state.orderBy === col) {
        if (state.orderDir === 'asc') state.orderDir = 'desc';
        else { state.orderBy = 'id'; state.orderDir = 'asc'; }
    } else {
        state.orderBy = col;
        state.orderDir = 'asc';
    }
    state.currentPage = 1;
    updateSortIndicators();
    updateFilterChips();
    fetchContacts();
    saveSession();
}

function updateSortIndicators() {
    document.querySelectorAll('th.sortable').forEach(th => {
        const col = th.dataset.col;
        const icon = th.querySelector('.sort-icon');
        th.classList.remove('sort-asc', 'sort-desc');
        if (col === state.orderBy && state.orderBy !== 'id') {
            th.classList.add(state.orderDir === 'asc' ? 'sort-asc' : 'sort-desc');
            if (icon) icon.textContent = state.orderDir === 'asc' ? '▲' : '▼';
        } else {
            if (icon) icon.textContent = '⇅';
        }
    });
}

// ─── Status Filter (client-side) ──────────────────────────────────────────────

function applyStatusFilter() {
    const filter = state.statusFilter;
    const statuses = loadStatuses();
    el.tableBody.querySelectorAll('tr[data-id]').forEach(tr => {
        if (!filter) { tr.style.display = ''; return; }
        const status = statuses[String(tr.dataset.id)] || '';
        tr.style.display = status === filter ? '' : 'none';
    });
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function renderSkeletons() {
    el.tableBody.innerHTML = '';
    for (let i = 0; i < Math.min(state.limit, 15); i++) {
        const tr = document.createElement('tr');
        tr.className = 'skeleton-row';
        tr.innerHTML = Array(11).fill('<td><div class="skeleton-text"></div></td>').join('');
        el.tableBody.appendChild(tr);
    }
}

// ─── Fetch Contacts ───────────────────────────────────────────────────────────

let fetchAbortController = null;

async function fetchContacts() {
    if (fetchAbortController) {
        fetchAbortController.abort();
    }
    fetchAbortController = new AbortController();
    const signal = fetchAbortController.signal;

    state.loading = true;
    renderSkeletons();
    el.tableLoadingOverlay.classList.remove('hidden');

    const t0 = performance.now();
    const params = new URLSearchParams({
        page: state.currentPage, limit: state.limit,
        search: state.search, searchField: state.searchField,
        dedup: state.dedup, sourcePath: state.sourcePath,
        contains: state.searchMode === 'contains',
        orderBy: state.orderBy, orderDir: state.orderDir
    });

    try {
        const r = await fetch(`/api/contacts?${params}`, { signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const result = await r.json();
        const ms = Math.round(performance.now() - t0);

        state.contacts     = result.data || [];
        state.totalPages   = result.pagination.totalPages || 0;
        state.totalRecords = result.pagination.totalRecords || 0;

        el.statSpeed.textContent = `${ms} ms`;
        el.dbStatus.textContent  = 'Database Ready';
        el.dbStatus.parentElement.querySelector('.pulse-dot').style.backgroundColor = 'var(--success-color)';

        if (el.headerBadge && (state.search || state.sourcePath || state.dedup)) {
            el.headerBadge.textContent = `${state.totalRecords.toLocaleString()} filtered`;
            el.headerBadge.classList.add('badge-filtered');
        } else if (el.headerBadge) {
            el.headerBadge.classList.remove('badge-filtered');
        }

        renderTable();
        updatePaginationUI();
        applyStatusFilter();
        saveSession();
    } catch(err) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        console.error('Failed to load contacts:', err);
        el.tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--danger-color);">Failed to connect to database. Server may be offline.</td></tr>`;
        el.dbStatus.textContent = 'Server Offline';
        el.dbStatus.parentElement.querySelector('.pulse-dot').style.backgroundColor = 'var(--danger-color)';
    } finally {
        if (fetchAbortController && fetchAbortController.signal === signal) {
            state.loading = false;
            el.tableLoadingOverlay.classList.add('hidden');
            fetchAbortController = null;
        }
    }
}

// ─── SVG constants ────────────────────────────────────────────────────────────

const WA_SVG   = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;
const COPY_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const NO_WA_SVG= `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
const UNDO_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-3.49"></path></svg>`;

// ─── Phone Cell ───────────────────────────────────────────────────────────────

function buildPhoneCellHtml(rawPhone) {
    const has = rawPhone && rawPhone.toString().trim() !== '';
    if (!has) return `<span class="empty-cell">—</span>`;
    const cleaned = cleanPhone(rawPhone);
    const isNoWa  = cleaned ? state.noWaPhones.has(cleaned) : false;
    const waUrl   = (!isNoWa && cleaned) ? buildWaUrl(rawPhone) : null;
    const copyBtn = `<button class="btn-copy-phone" data-copy="${rawPhone}">${COPY_SVG}</button>`;
    let actions;
    if (isNoWa) {
        actions = `<span class="badge-no-wa">No WA</span><button class="btn-no-wa-flag btn-undo-no-wa" data-phone="${cleaned}">${UNDO_SVG}</button>`;
    } else {
        const waBtn = waUrl ? `<a class="btn-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${WA_SVG}</a>` : '';
        actions = `${waBtn}<button class="btn-no-wa-flag" data-phone="${cleaned}">${NO_WA_SVG}</button>`;
    }
    return `<span class="phone-cell">${rawPhone}${copyBtn}${actions}</span>`;
}

// ─── No-WA Toggle ────────────────────────────────────────────────────────────

function toggleNoWaPhone(cleaned) {
    if (state.noWaPhones.has(cleaned)) state.noWaPhones.delete(cleaned);
    else state.noWaPhones.add(cleaned);
    saveNoWaPhones();
    el.tableBody.querySelectorAll(`tr[data-phone]`).forEach(tr => {
        if (cleanPhone(tr.dataset.phone) === cleaned) {
            const td = tr.querySelector('.col-phone');
            if (td) td.innerHTML = buildPhoneCellHtml(tr.dataset.phone);
        }
    });
    if (el.detailDrawer.classList.contains('active') && cleanPhone(el.detailPhone.textContent) === cleaned) updateDrawerNoWa(cleaned);
}

function updateDrawerNoWa(cleaned) {
    const isNoWa = state.noWaPhones.has(cleaned);
    if (isNoWa) {
        el.detailWaLink.classList.add('hidden');
        el.detailNoWaToggle.innerHTML = `${UNDO_SVG} Has WA`;
        el.detailNoWaToggle.classList.add('btn-undo-no-wa');
    } else {
        const waUrl = buildWaUrl(el.detailPhone.textContent);
        if (waUrl) { el.detailWaLink.href = waUrl; el.detailWaLink.classList.remove('hidden'); }
        el.detailNoWaToggle.innerHTML = `${NO_WA_SVG} No WA`;
        el.detailNoWaToggle.classList.remove('btn-undo-no-wa');
    }
}

function refreshWaButtons() {
    el.tableBody.querySelectorAll('tr[data-phone]').forEach(tr => {
        const td = tr.querySelector('.col-phone');
        if (td) td.innerHTML = buildPhoneCellHtml(tr.dataset.phone);
    });
    if (el.detailDrawer.classList.contains('active')) {
        const cleaned = cleanPhone(el.detailPhone.textContent);
        if (cleaned && !state.noWaPhones.has(cleaned)) {
            const waUrl = buildWaUrl(el.detailPhone.textContent);
            if (waUrl) { el.detailWaLink.href = waUrl; el.detailWaLink.classList.remove('hidden'); }
        }
    }
}

// ─── Render Table ─────────────────────────────────────────────────────────────

function renderTable() {
    el.tableBody.innerHTML = '';
    if (!state.contacts.length) {
        el.tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-secondary);">No contacts found matching your filters.</td></tr>`;
        return;
    }
    const statuses = loadStatuses();
    state.contacts.forEach((c, i) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-clickable' + (i % 2 === 1 ? ' row-alt' : '');
        tr.dataset.id    = c.id;
        tr.dataset.phone = c.phone || '';

        const status = statuses[String(c.id)];
        const statusMeta = status ? STATUS_META[status] : null;
        const statusDot  = statusMeta
            ? `<span class="status-dot" style="background:${statusMeta.color}" title="${statusMeta.label}"></span>`
            : '';

        const displayPath = (c.source_file || '').replace(/\\/g, '/').split('/').pop() || '—';

        tr.innerHTML = `
            <td class="col-id" style="color:var(--text-muted);font-weight:500;">#${c.id}</td>
            <td class="col-name" style="font-weight:600;">${statusDot}${formatCell(c.name)}</td>
            <td class="col-phone">${buildPhoneCellHtml(c.phone)}</td>
            <td class="col-email">${formatCell(c.email)}</td>
            <td class="col-location">${formatCell(c.location)}</td>
            <td class="col-file" title="${c.source_file||''}">${formatCell(displayPath)}</td>
            <td class="col-type">${formatCell(c.file_type)}</td>
            <td class="col-row">${formatCell(c.row_number)}</td>
            <td class="col-sheet">${formatCell(c.sheet_name)}</td>
            <td class="col-raw" title="${c.row_data||''}">${formatCell(c.row_data)}</td>
            <td class="col-action" style="text-align:center;">
                <button class="btn btn-secondary btn-view-detail" style="padding:4px 8px;font-size:.8rem;border-radius:6px;">View</button>
            </td>`;

        tr.addEventListener('click', e => { if (!e.target.closest('button') && !e.target.closest('a')) openDetailDrawer(c); });
        tr.querySelector('.btn-view-detail').addEventListener('click', () => openDetailDrawer(c));
        el.tableBody.appendChild(tr);
    });
}

// ─── Pagination UI ────────────────────────────────────────────────────────────

function updatePaginationUI() {
    el.currentPageInput.value = state.currentPage;
    el.totalPagesSpan.textContent = state.totalPages;
    const s = (state.currentPage - 1) * state.limit + 1;
    const e = Math.min(state.currentPage * state.limit, state.totalRecords);
    el.pagStart.textContent = state.totalRecords ? s.toLocaleString() : 0;
    el.pagEnd.textContent   = state.totalRecords ? e.toLocaleString() : 0;
    el.pagTotal.textContent = state.totalRecords.toLocaleString();
    el.statRange.textContent = state.totalRecords ? `${s.toLocaleString()} – ${e.toLocaleString()}` : '0';
    el.statFilteredTotal.textContent = (state.search || state.sourcePath || state.dedup)
        ? `Of ${state.totalRecords.toLocaleString()} filtered`
        : `Of ${state.totalRecords.toLocaleString()} records`;
    el.btnFirst.disabled = state.currentPage <= 1;
    el.btnPrev.disabled  = state.currentPage <= 1;
    el.btnNext.disabled  = state.currentPage >= state.totalPages;
    el.btnLast.disabled  = state.currentPage >= state.totalPages;
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function openDetailDrawer(c) {
    state.currentContact = c;
    el.detailAvatar.textContent  = getInitials(c.name);
    el.detailName.textContent    = c.name || 'Anonymous';
    el.detailFileRef.textContent = c.source_file || 'No source path';

    // "Filter by this source" button
    const filterBtn = document.getElementById('filter-by-source-btn');
    if (filterBtn) {
        if (c.source_file) {
            // Use the directory containing the file as the filter path
            const sep = c.source_file.includes('\\') ? '\\' : '/';
            const lastSep = Math.max(c.source_file.lastIndexOf('\\'), c.source_file.lastIndexOf('/'));
            const dir = lastSep > 0 ? c.source_file.substring(0, lastSep) : c.source_file;
            filterBtn.classList.remove('hidden');
            filterBtn.onclick = () => {
                applySourceFilter(dir);
                closeDetailDrawer();
                showToast(`Filtering by: ${sourcePathDisplay(dir)}`, 'info');
            };
        } else {
            filterBtn.classList.add('hidden');
        }
    }
    el.detailPhone.textContent    = c.phone || 'Not Available';
    el.detailEmail.textContent    = c.email || 'Not Available';
    el.detailLocation.textContent = c.location || 'Not Available';
    el.detailFileType.textContent  = c.file_type || 'CSV';
    el.detailRowNum.textContent    = c.row_number || '—';
    el.detailSheetName.textContent = c.sheet_name || '—';
    el.detailDbId.textContent      = `#${c.id}`;

    const cleaned = cleanPhone(c.phone);
    if (cleaned) {
        el.detailCopyPhone.classList.remove('hidden');
        el.detailCopyPhone.onclick = () => { copyToClipboard(c.phone, el.detailCopyPhone); showToast('Phone copied!'); };
        const waUrl = buildWaUrl(c.phone);
        if (waUrl && !state.noWaPhones.has(cleaned)) { el.detailWaLink.href = waUrl; el.detailWaLink.classList.remove('hidden'); }
        else el.detailWaLink.classList.add('hidden');
        el.detailNoWaToggle.classList.remove('hidden');
        el.detailNoWaToggle.dataset.phone = cleaned;
        updateDrawerNoWa(cleaned);
        el.detailNoWaToggle.onclick = () => toggleNoWaPhone(cleaned);
    } else {
        el.detailCopyPhone.classList.add('hidden');
        el.detailWaLink.classList.add('hidden');
        el.detailNoWaToggle.classList.add('hidden');
    }

    el.detailRawData.textContent = c.row_data || `[Empty]\nFile: ${c.source_file}\nRow: ${c.row_number}`;
    updateStatusButtons(c.id);
    if (el.drawerBody) el.drawerBody.scrollTop = 0;
    el.detailDrawer.classList.add('active');
}

function closeDetailDrawer() { el.detailDrawer.classList.remove('active'); }

// ─── Copy All ─────────────────────────────────────────────────────────────────

function copyAllContactInfo() {
    const c = state.currentContact;
    if (!c) return;
    const text = [`Name: ${c.name||''}`, `Phone: ${c.phone||''}`, `Email: ${c.email||''}`,
        `Location: ${c.location||''}`, `Source: ${c.source_file||''}`,
        `File Type: ${c.file_type||''}`, `Row: ${c.row_number||''}`,
        `Sheet: ${c.sheet_name||''}`, `DB ID: #${c.id}`].join('\n');
    copyToClipboard(text, el.copyAllBtn);
    showToast('Contact info copied!');
}

// ─── Jump to ID ───────────────────────────────────────────────────────────────

async function jumpToId() {
    const id = parseInt(el.jumpToIdInput.value);
    if (!id || id < 1) { showToast('Enter a valid ID', 'error'); return; }
    try {
        const r = await fetch(`/api/contacts/${id}`);
        if (!r.ok) { showToast(`Contact #${id} not found`, 'error'); return; }
        openDetailDrawer(await r.json());
        el.jumpToIdInput.value = '';
        showToast(`Opened contact #${id}`);
    } catch { showToast('Failed to fetch contact', 'error'); }
}

// ─── Source Browser ───────────────────────────────────────────────────────────

const sbState = {
    allDirs: [],        // full result from server (filtered by query)
    renderedCount: 0,   // how many rows currently in the DOM
    sort: 'count',
    query: '',
    total: 0,
    computing: false,
    PAGE: 80            // items per render batch
};

async function openSourceBrowser() {
    const modal = document.getElementById('source-browser-modal');
    modal.classList.add('active');
    await loadSbData('');
}

async function loadSbData(query) {
    const list = document.getElementById('sb-list');
    const countLabel = document.getElementById('sb-count-label');
    list.innerHTML = `<div class="sb-loading"><div class="table-spinner"></div><p>Loading…</p></div>`;
    if (countLabel) countLabel.textContent = '';

    try {
        const qs = query ? `?q=${encodeURIComponent(query)}&limit=2000` : '?limit=2000';
        const r = await fetch('/api/source-browser' + qs);
        if (!r.ok) throw new Error('failed');
        const data = await r.json();

        if (data.computing) {
            // Analytics still warming up — show message and retry after 5s
            list.innerHTML = `<div class="sb-loading">
                <div class="table-spinner"></div>
                <p>Analytics computing… retrying in 5s</p>
                <span style="font-size:0.75rem;color:var(--text-muted)">This happens once after server restart</span>
            </div>`;
            if (countLabel) countLabel.textContent = 'Computing…';
            setTimeout(() => loadSbData(sbState.query), 5000);
            return;
        }

        sbState.total = data.total;
        sbState.allDirs = data.directories || [];
        sbState.renderedCount = 0;
        sbState.query = query;
        renderSbBatch(true);
    } catch {
        list.innerHTML = `<p style="padding:30px;color:var(--danger-color);text-align:center;">Failed to load source directories.</p>`;
    }
}

function sortedDirs() {
    const dirs = [...sbState.allDirs];
    if (sbState.sort === 'name') dirs.sort((a, b) => a.dir.localeCompare(b.dir));
    // 'count' is already sorted by server
    return dirs;
}

function renderSbBatch(reset = false) {
    const list = document.getElementById('sb-list');
    const countLabel = document.getElementById('sb-count-label');

    const dirs = sortedDirs();
    const total = sbState.total;
    const filtered = dirs.length;

    if (countLabel) {
        countLabel.textContent = sbState.query
            ? `${filtered} of ${total} dirs`
            : `${total} director${total === 1 ? 'y' : 'ies'}`;
    }

    if (reset) {
        list.innerHTML = '';
        sbState.renderedCount = 0;
        // Remove old sentinel if any
        const old = document.getElementById('sb-sentinel');
        if (old) old.remove();
    }

    if (!dirs.length) {
        list.innerHTML = `<div class="sb-empty">No directories match "<strong>${sbState.query}</strong>"</div>`;
        return;
    }

    const slice = dirs.slice(sbState.renderedCount, sbState.renderedCount + sbState.PAGE);
    sbState.renderedCount += slice.length;

    const maxCount = dirs[0]?.count || 1;

    const frag = document.createDocumentFragment();
    slice.forEach(d => {
        const pct = Math.max(2, (d.count / maxCount * 100)).toFixed(1);
        const parts = d.dir.replace(/\\/g, '/').split('/').filter(Boolean);
        const name = parts.slice(-2).join(' / ') || d.dir;
        const parentPath = parts.slice(0, -2).join('/');
        const isActive = state.sourcePath === d.dir;

        const item = document.createElement('div');
        item.className = 'sb-item' + (isActive ? ' sb-item-active' : '');
        item.dataset.path = d.dir;
        item.title = d.dir;
        item.innerHTML = `
            <div class="sb-item-info">
                <div class="sb-item-name">${name}</div>
                ${parentPath ? `<div class="sb-item-path">${parentPath}</div>` : ''}
                <div class="sb-item-bar-row">
                    <div class="sb-item-bar-track">
                        <div class="sb-item-bar-fill${isActive ? ' sb-bar-active' : ''}" style="width:${pct}%"></div>
                    </div>
                    <span class="sb-item-count">${d.count.toLocaleString()} contacts</span>
                </div>
            </div>
            <button class="sb-filter-btn${isActive ? ' sb-filter-btn-active' : ''}" data-path="${d.dir.replace(/"/g, '&quot;')}">
                ${isActive
                    ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Active`
                    : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter`}
            </button>`;

        item.querySelector('.sb-filter-btn').addEventListener('click', e => {
            e.stopPropagation();
            const path = d.dir;
            if (state.sourcePath === path) {
                applySourceFilter('');
                showToast('Source filter cleared', 'info');
            } else {
                applySourceFilter(path);
                showToast(`Filtering: ${sourcePathDisplay(path)}`, 'info');
            }
            closeModal(document.getElementById('source-browser-modal'));
        });

        item.addEventListener('click', e => {
            if (e.target.closest('.sb-filter-btn')) return;
            applySourceFilter(state.sourcePath === d.dir ? '' : d.dir);
            closeModal(document.getElementById('source-browser-modal'));
        });

        frag.appendChild(item);
    });
    list.appendChild(frag);

    // Add/refresh sentinel for infinite scroll
    let sentinel = document.getElementById('sb-sentinel');
    if (sbState.renderedCount < dirs.length) {
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'sb-sentinel';
            sentinel.className = 'sb-sentinel';
            sentinel.textContent = `Scroll for more (${dirs.length - sbState.renderedCount} remaining)`;
            list.appendChild(sentinel);
            if (sbObserver) sbObserver.observe(sentinel);
        } else {
            sentinel.textContent = `Scroll for more (${dirs.length - sbState.renderedCount} remaining)`;
            list.appendChild(sentinel); // move to bottom
        }
    } else if (sentinel) {
        if (sbObserver) sbObserver.unobserve(sentinel);
        sentinel.remove();
    }
}

// IntersectionObserver for infinite scroll
let sbObserver = null;
if (typeof IntersectionObserver !== 'undefined') {
    sbObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) renderSbBatch(false);
    }, { threshold: 0.1 });
}

function initSourceBrowser() {
    const btn   = document.getElementById('source-browser-btn');
    const modal = document.getElementById('source-browser-modal');
    const closeBtn = document.getElementById('close-source-browser');
    const searchInput = document.getElementById('sb-search');

    if (btn)      btn.addEventListener('click', openSourceBrowser);
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
    if (modal)    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });

    // Live search — debounced, hits API for server-side filtering
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            sbState.query = searchInput.value.trim();
            loadSbData(sbState.query);
        }, 300));
    }

    // Sort buttons
    document.querySelectorAll('.sb-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sb-sort-btn').forEach(b => b.classList.remove('sb-sort-active'));
            btn.classList.add('sb-sort-active');
            sbState.sort = btn.dataset.sort;
            renderSbBatch(true);
        });
    });
}

// ─── Bulk WhatsApp ────────────────────────────────────────────────────────────

function openBulkWaModal() {
    const phones = state.contacts
        .filter(c => c.phone && c.phone.toString().trim())
        .map(c => ({ name: c.name || 'Unknown', raw: c.phone, cleaned: cleanPhone(c.phone) }))
        .filter(p => p.cleaned && !state.noWaPhones.has(p.cleaned));

    el.bulkWaCount.textContent = `${phones.length} number${phones.length !== 1 ? 's' : ''}`;
    if (!phones.length) {
        el.bulkWaList.innerHTML = `<p style="padding:20px;color:var(--text-muted);text-align:center;">No valid phone numbers on this page.</p>`;
    } else {
        el.bulkWaList.innerHTML = phones.map((p, i) => {
            const waUrl = buildWaUrl(p.raw);
            return `<div class="bulk-wa-item">
                <span class="bulk-wa-num">${i + 1}</span>
                <div class="bulk-wa-info"><span class="bulk-wa-name">${p.name}</span><span class="bulk-wa-phone">${p.raw}</span></div>
                ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-wa bulk-wa-link">${WA_SVG}</a>` : ''}
                <button class="btn-copy-phone" data-copy="${p.raw}">${COPY_SVG}</button>
            </div>`;
        }).join('');
        el.bulkWaList.querySelectorAll('.btn-copy-phone').forEach(btn => btn.addEventListener('click', () => { copyToClipboard(btn.dataset.copy, btn); showToast('Phone copied!'); }));
    }
    el.bulkWaOpenAll.onclick = () => {
        let opened = 0;
        phones.slice(0, 10).forEach((p, i) => {
            const waUrl = buildWaUrl(p.raw);
            if (waUrl) { setTimeout(() => window.open(waUrl, '_blank', 'noopener,noreferrer'), i * 300); opened++; }
        });
        showToast(`Opening ${opened} WhatsApp chat${opened !== 1 ? 's' : ''}…`, 'info');
    };
    el.bulkWaCopyAllPhones.onclick = () => {
        copyToClipboard(phones.map(p => p.raw).join('\n'), el.bulkWaCopyAllPhones);
        showToast(`Copied ${phones.length} numbers!`);
    };
    el.bulkWaModal.classList.add('active');
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function openAnalytics() {
    el.analyticsModal.classList.add('active');
    el.analyticsBody.innerHTML = `<div class="analytics-loading"><div class="table-spinner"></div><p>Loading analytics…</p></div>`;
    try {
        const r = await fetch('/api/analytics');
        if (!r.ok) throw new Error('failed');
        renderAnalytics(await r.json());
    } catch { el.analyticsBody.innerHTML = `<p style="padding:30px;color:var(--danger-color);">Failed to load analytics.</p>`; }
}

function renderAnalytics(data) {
    const { coverage, byFileType, topDirectories } = data;
    const total = coverage.total;
    const phonePct = total ? (coverage.hasPhone  / total * 100).toFixed(1) : 0;
    const emailPct = total ? (coverage.hasEmail  / total * 100).toFixed(1) : 0;
    const locPct   = total ? (coverage.hasLocation / total * 100).toFixed(1) : 0;

    const coverageHtml = `<div class="analytics-section"><h3 class="analytics-title">Data Coverage</h3><div class="coverage-bars">
        ${makeCoverageBar('Phone Numbers', coverage.hasPhone, total, phonePct, '#25D366')}
        ${makeCoverageBar('Email Addresses', coverage.hasEmail, total, emailPct, '#3b82f6')}
        ${makeCoverageBar('Location Data', coverage.hasLocation, total, locPct, '#8b5cf6')}
    </div></div>`;

    const maxType = byFileType.length ? byFileType[0].count : 1;
    const typeHtml = `<div class="analytics-section"><h3 class="analytics-title">Records by File Type</h3><div class="analytics-bars">
        ${byFileType.map(t => {
            const pct = (t.count / maxType * 100).toFixed(1);
            const pctTotal = total ? (t.count / total * 100).toFixed(1) : 0;
            return `<div class="analytics-bar-row"><span class="analytics-bar-label">${t.type}</span>
                <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${pct}%;background:var(--primary-gradient)"></div></div>
                <span class="analytics-bar-value">${t.count.toLocaleString()} <span class="analytics-pct">(${pctTotal}%)</span></span></div>`;
        }).join('')}
    </div></div>`;

    const maxDir = topDirectories.length ? topDirectories[0].count : 1;
    const dirHtml = topDirectories.length ? `<div class="analytics-section"><h3 class="analytics-title">Top Source Directories</h3><div class="analytics-bars">
        ${topDirectories.map(d => {
            const pct = (d.count / maxDir * 100).toFixed(1);
            const name = (d.dir||'').replace(/\\/g,'/').split('/').slice(-2).join('/') || d.dir || '?';
            const pctTotal = total ? (d.count / total * 100).toFixed(1) : 0;
            return `<div class="analytics-bar-row"><span class="analytics-bar-label" title="${d.dir}">${name}</span>
                <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#10b981,#3b82f6)"></div></div>
                <span class="analytics-bar-value">${d.count.toLocaleString()} <span class="analytics-pct">(${pctTotal}%)</span></span></div>`;
        }).join('')}
    </div></div>` : '';

    const summaryHtml = `<div class="analytics-summary">
        <div class="analytics-stat-card"><span class="analytics-stat-num">${total.toLocaleString()}</span><span class="analytics-stat-lbl">Total Records</span></div>
        <div class="analytics-stat-card"><span class="analytics-stat-num">${coverage.hasPhone.toLocaleString()}</span><span class="analytics-stat-lbl">Have Phone (${phonePct}%)</span></div>
        <div class="analytics-stat-card"><span class="analytics-stat-num">${coverage.hasEmail.toLocaleString()}</span><span class="analytics-stat-lbl">Have Email (${emailPct}%)</span></div>
        <div class="analytics-stat-card"><span class="analytics-stat-num">${byFileType.length}</span><span class="analytics-stat-lbl">File Types</span></div>
        ${data.computedMs ? `<div class="analytics-stat-card"><span class="analytics-stat-num">${(data.computedMs/1000).toFixed(1)}s</span><span class="analytics-stat-lbl">Compute Time</span></div>` : ''}
    </div>`;
    el.analyticsBody.innerHTML = summaryHtml + coverageHtml + typeHtml + dirHtml;
}

function makeCoverageBar(label, count, total, pct, color) {
    return `<div class="coverage-bar-row">
        <div class="coverage-bar-meta"><span class="coverage-bar-label">${label}</span><span class="coverage-bar-value">${count.toLocaleString()} <span class="analytics-pct">(${pct}%)</span></span></div>
        <div class="coverage-bar-track"><div class="coverage-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function closeModal(m) { m.classList.remove('active'); }

// ─── Theme ────────────────────────────────────────────────────────────────────

function initTheme() {
    const saved = safeStorage.get('theme');
    if (saved) {
        document.body.classList.add(saved === 'light' ? 'light-theme' : 'dark-theme');
    } else {
        try {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
            safeStorage.set('theme', prefersDark ? 'dark' : 'light');
        } catch(e) {}
    }
}

// ─── Compact Mode ─────────────────────────────────────────────────────────────

function initCompactMode() {
    if (safeStorage.get('compactMode') === 'true') {
        document.body.classList.add('compact-mode');
        el.compactToggle.classList.add('compact-active');
    }
}

function toggleCompactMode() {
    const isCompact = document.body.classList.toggle('compact-mode');
    el.compactToggle.classList.toggle('compact-active', isCompact);
    localStorage.setItem('compactMode', isCompact);
    showToast(isCompact ? 'Compact view on' : 'Compact view off', 'info');
}

// ─── Column Preferences ───────────────────────────────────────────────────────

function saveColumnPrefs() {
    const prefs = {};
    el.colSelectorDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => { prefs[cb.dataset.column] = cb.checked; });
    localStorage.setItem('columnPreferences', JSON.stringify(prefs));
}

function loadColumnPrefs() {
    try {
        const prefs = JSON.parse(localStorage.getItem('columnPreferences') || '{}');
        el.colSelectorDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (prefs[cb.dataset.column] !== undefined) {
                cb.checked = prefs[cb.dataset.column];
                el.contactsTable.classList.toggle(`hide-col-${cb.dataset.column}`, !cb.checked);
            }
        });
    } catch {}
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
    // Theme
    el.themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        document.body.classList.toggle('dark-theme', !isDark);
        document.body.classList.toggle('light-theme', isDark);
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });

    // Compact mode
    el.compactToggle.addEventListener('click', toggleCompactMode);

    // Drawer
    el.closeDrawer.addEventListener('click', closeDetailDrawer);
    el.detailDrawer.addEventListener('click', e => { if (e.target === el.detailDrawer) closeDetailDrawer(); });
    el.copyAllBtn.addEventListener('click', copyAllContactInfo);

    // Status buttons in drawer
    el.statusButtons.addEventListener('click', e => {
        const btn = e.target.closest('.btn-status');
        if (!btn || !state.currentContact) return;
        const status = btn.dataset.status;
        setContactStatus(state.currentContact.id, status || null);
        updateStatusButtons(state.currentContact.id);
        // Refresh status dot in table
        const tr = el.tableBody.querySelector(`tr[data-id="${state.currentContact.id}"]`);
        if (tr) {
            const statusMeta = status ? STATUS_META[status] : null;
            const nameTd = tr.querySelector('.col-name');
            if (nameTd) {
                const dotEl = nameTd.querySelector('.status-dot');
                if (dotEl) dotEl.remove();
                if (statusMeta) {
                    const dot = document.createElement('span');
                    dot.className = 'status-dot';
                    dot.style.background = statusMeta.color;
                    dot.title = statusMeta.label;
                    nameTd.prepend(dot);
                }
            }
        }
        applyStatusFilter();
        showToast(status ? `Marked as ${STATUS_META[status]?.label}` : 'Status cleared', 'success');
    });

    // Search
    const handleSearch = debounce(() => {
        const v = el.searchInput.value.trim();
        state.search = v;
        state.currentPage = 1;
        el.clearSearch.classList.toggle('hidden', !v);
        if (v) saveToHistory(v);
        el.searchHistoryDropdown.classList.add('hidden');
        fetchContacts();
    }, 350);
    el.searchInput.addEventListener('input', handleSearch);

    el.searchInput.addEventListener('focus', () => { if (!el.searchInput.value) renderHistoryDropdown(); });
    el.searchInput.addEventListener('blur', () => { setTimeout(() => el.searchHistoryDropdown.classList.add('hidden'), 150); });

    el.clearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        state.search = '';
        state.currentPage = 1;
        el.clearSearch.classList.add('hidden');
        el.searchHistoryDropdown.classList.add('hidden');
        fetchContacts();
    });

    // Search mode toggle
    el.searchModeBtn.addEventListener('click', () => {
        state.searchMode = state.searchMode === 'starts' ? 'contains' : 'starts';
        updateSearchModeUI();
        state.currentPage = 1;
        if (state.search) fetchContacts();
        updateFilterChips();
        saveSession();
        showToast(`Search mode: ${state.searchMode === 'contains' ? 'Contains (slower)' : 'Starts With (fast)'}`, 'info');
    });

    el.searchField.addEventListener('change', () => { state.searchField = el.searchField.value; state.currentPage = 1; if (state.search) fetchContacts(); saveSession(); });
    el.pageLimit.addEventListener('change', () => { state.limit = parseInt(el.pageLimit.value) || 50; state.currentPage = 1; fetchContacts(); });
    el.statusFilter.addEventListener('change', () => { state.statusFilter = el.statusFilter.value; applyStatusFilter(); });

    el.dedupToggle.addEventListener('click', () => {
        state.dedup = !state.dedup;
        el.dedupToggle.classList.toggle('btn-dedup-active', state.dedup);
        state.currentPage = 1;
        fetchContacts();
        updateFilterChips();
        saveSession();
    });

    // Export
    el.exportBtn.addEventListener('click', async () => {
        if (state.exportBusy) return;
        state.exportBusy = true;
        const orig = el.exportBtn.innerHTML;
        el.exportBtn.disabled = true;
        el.exportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Exporting…`;
        try {
            const params = new URLSearchParams({ search: state.search, searchField: state.searchField, sourcePath: state.sourcePath, dedup: state.dedup, maxRows: 100000, contains: state.searchMode === 'contains' });
            const a = document.createElement('a'); a.href = `/api/export?${params}`; a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            showToast('CSV export started!');
        } finally {
            setTimeout(() => { state.exportBusy = false; el.exportBtn.disabled = false; el.exportBtn.innerHTML = orig; }, 3000);
        }
    });

    // Jump to ID
    el.jumpToIdBtn.addEventListener('click', jumpToId);
    el.jumpToIdInput.addEventListener('keydown', e => { if (e.key === 'Enter') jumpToId(); });

    // Sortable column headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => handleSort(th.dataset.col));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        const anyModal = document.querySelector('.modal-overlay.active');

        if (e.key === 'Escape') {
            if (anyModal) { closeModal(anyModal); return; }
            if (el.detailDrawer.classList.contains('active')) { closeDetailDrawer(); return; }
            if (!el.searchHistoryDropdown.classList.contains('hidden')) { el.searchHistoryDropdown.classList.add('hidden'); return; }
            if (document.activeElement === el.searchInput) el.searchInput.blur();
            return;
        }

        if (!inInput && !anyModal) {
            if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) { e.preventDefault(); el.searchInput.focus(); el.searchInput.select(); return; }
            if (e.key === '?') { e.preventDefault(); el.shortcutsModal.classList.add('active'); return; }
            if (e.key === 'ArrowLeft' && state.currentPage > 1) { e.preventDefault(); state.currentPage--; fetchContacts(); return; }
            if (e.key === 'ArrowRight' && state.currentPage < state.totalPages) { e.preventDefault(); state.currentPage++; fetchContacts(); return; }
            if (e.key === 'Home') { e.preventDefault(); if (state.currentPage > 1) { state.currentPage = 1; fetchContacts(); } return; }
            if (e.key === 'End')  { e.preventDefault(); if (state.currentPage < state.totalPages) { state.currentPage = state.totalPages; fetchContacts(); } return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); el.exportBtn.click(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); openBulkWaModal(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); toggleCompactMode(); return; }
        }
    });

    // Pagination
    el.btnFirst.addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage = 1; fetchContacts(); } });
    el.btnPrev.addEventListener('click',  () => { if (state.currentPage > 1) { state.currentPage--; fetchContacts(); } });
    el.btnNext.addEventListener('click',  () => { if (state.currentPage < state.totalPages) { state.currentPage++; fetchContacts(); } });
    el.btnLast.addEventListener('click',  () => { if (state.currentPage < state.totalPages) { state.currentPage = state.totalPages; fetchContacts(); } });

    const goToPage = () => {
        let p = Math.max(1, Math.min(parseInt(el.currentPageInput.value) || 1, state.totalPages));
        state.currentPage = p;
        fetchContacts();
    };
    el.currentPageInput.addEventListener('keydown', e => { if (e.key === 'Enter') goToPage(); });
    el.currentPageInput.addEventListener('blur', goToPage);

    // Table delegation
    el.tableBody.addEventListener('click', e => {
        const copyBtn = e.target.closest('.btn-copy-phone');
        if (copyBtn) { e.stopPropagation(); copyToClipboard(copyBtn.dataset.copy, copyBtn); showToast('Phone copied!'); return; }
        const noWaBtn = e.target.closest('.btn-no-wa-flag');
        if (noWaBtn) { e.stopPropagation(); toggleNoWaPhone(noWaBtn.dataset.phone); }
    });

    // Column selector dropdown
    el.colSelectorBtn.addEventListener('click', e => { e.stopPropagation(); el.colSelectorDropdown.classList.toggle('hidden'); });
    document.addEventListener('click', e => {
        if (!el.colSelectorDropdown.classList.contains('hidden') && !el.colSelectorDropdown.contains(e.target) && !el.colSelectorBtn.contains(e.target))
            el.colSelectorDropdown.classList.add('hidden');
    });
    el.colSelectorDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => { el.contactsTable.classList.toggle(`hide-col-${cb.dataset.column}`, !cb.checked); saveColumnPrefs(); });
    });

    // Analytics
    el.analyticsBtn.addEventListener('click', openAnalytics);
    el.closeAnalytics.addEventListener('click', () => closeModal(el.analyticsModal));
    el.analyticsModal.addEventListener('click', e => { if (e.target === el.analyticsModal) closeModal(el.analyticsModal); });

    // Bulk WA
    el.waBulkBtn.addEventListener('click', openBulkWaModal);
    el.closeBulkWa.addEventListener('click', () => closeModal(el.bulkWaModal));
    el.bulkWaModal.addEventListener('click', e => { if (e.target === el.bulkWaModal) closeModal(el.bulkWaModal); });

    // Shortcuts
    el.shortcutsBtn.addEventListener('click', () => el.shortcutsModal.classList.add('active'));
    el.closeShortcuts.addEventListener('click', () => closeModal(el.shortcutsModal));
    el.shortcutsModal.addEventListener('click', e => { if (e.target === el.shortcutsModal) closeModal(el.shortcutsModal); });
}

// ─── WA Bar ───────────────────────────────────────────────────────────────────

function initWaBar() {
    const saved = localStorage.getItem('waDefaultMessage') || '';
    state.defaultWaMessage = saved;
    el.waDefaultMessage.value = saved;
    const handleWaInput = debounce(() => {
        state.defaultWaMessage = el.waDefaultMessage.value;
        localStorage.setItem('waDefaultMessage', state.defaultWaMessage);
        refreshWaButtons();
    }, 300);
    el.waDefaultMessage.addEventListener('input', handleWaInput);
    el.waCopyMsg.addEventListener('click', () => { copyToClipboard(el.waDefaultMessage.value, el.waCopyMsg); showToast('Message copied!'); });
    el.waClearMsg.addEventListener('click', () => {
        el.waDefaultMessage.value = '';
        state.defaultWaMessage = '';
        localStorage.removeItem('waDefaultMessage');
        refreshWaButtons();
        showToast('Message cleared', 'info');
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    initTheme();
    initCompactMode();
    initSourceFilter();
    initSourceBrowser();
    loadColumnPrefs();
    loadNoWaPhones();
    loadSession();
    setupEventListeners();
    initWaBar();
    updateSearchModeUI();
    updateSortIndicators();
    fetchStats();
    fetchSources();
    fetchContacts();
}

document.addEventListener('DOMContentLoaded', init);
