const express    = require('express');
const compression = require('compression');
const { DatabaseSync } = require('node:sqlite');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3005;
const DB_PATH = path.join(__dirname, 'contacts.db');

// ─── DB Setup ─────────────────────────────────────────────────────────────────

let db;
let cachedTotalContacts = 0;
let ftsAvailable = false;

const SORTABLE_COLS = new Set(['id', 'name', 'phone', 'email', 'location']);
const SORTABLE_MAP  = { id:'id', name:'name', phone:'phone', email:'email', location:'location' };

function initDb() {
    try {
        console.log(`Connecting to SQLite database at ${DB_PATH}...`);
        db = new DatabaseSync(DB_PATH);
        db.exec("PRAGMA busy_timeout = 30000;");
        db.exec("PRAGMA journal_mode = WAL;");
        db.exec("PRAGMA cache_size = -262144;");   // 256 MB cache
        db.exec("PRAGMA temp_store = MEMORY;");
        db.exec("PRAGMA mmap_size = 268435456;");  // 256 MB mmap

        // Truncate WAL so DB is fully up-to-date on disk
        try { db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); } catch (_) {}
        
        // WhatsApp Templates table
        db.exec("CREATE TABLE IF NOT EXISTS wa_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, message TEXT);");

        console.log("Caching total contacts count...");
        // Fast O(1) row count approximation using MAX(id) to prevent 4.8GB table scan over network mount
        cachedTotalContacts = db.prepare("SELECT MAX(id) as count FROM contacts").all()[0].count || 7000000;
        console.log(`Cached total contacts: ${cachedTotalContacts.toLocaleString()}`);

        // Detect FTS5 index
        checkFts();
        
        // Setup State Tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_users (username TEXT PRIMARY KEY, password TEXT, role TEXT);
            CREATE TABLE IF NOT EXISTS used_contacts (contact_id INTEGER PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS user_activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, contact_id INTEGER, action TEXT, date_sent TEXT);
        `);
        
        const adminExists = db.prepare("SELECT 1 FROM app_users WHERE username = 'admin'").all().length > 0;
        if (!adminExists) {
            db.prepare("INSERT INTO app_users (username, password, role) VALUES (?, ?, ?)").run('admin', 'Zero@12345', 'admin');
        }
        
    } catch (err) {
        console.error("Failed to initialize database:", err);
    }
}

function checkFts() {
    try {
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contacts_fts'").all();
        ftsAvailable = row.length > 0;
        console.log(`[FTS5] ${ftsAvailable ? 'index available ✓ (fast search active)' : 'not built — run: node build_fts.js'}`);
    } catch(e) {
        ftsAvailable = false;
    }
}

app.use(compression());
app.use(express.json());

// ─── Basic Authentication ──────────────────────────────────────────────────────
app.use((req, res, next) => {
    // Allow public access to assets if needed, but here we secure everything
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    try {
        const user = getDbConnection().prepare("SELECT * FROM app_users WHERE username = ? AND password = ?").all(login, password)[0];
        if (user) {
            req.user = user;
            return next();
        }
    } catch(e) {}
    
    res.set('WWW-Authenticate', 'Basic realm="Secure Contacts Database"');
    res.status(401).send('Authentication required.');
});

app.use(express.static(path.join(__dirname, 'public')));

function getDbConnection() {
    if (!db) initDb();
    if (!db) throw new Error("Database is not initialized or not accessible.");
    return db;
}

// ─── Simple LRU Query Cache ────────────────────────────────────────────────────

const QUERY_CACHE_SIZE = 30;
const queryCache = new Map();   // key → { data, totalRecords, ts }

function cacheKey(params) {
    return JSON.stringify(params);
}

function cacheGet(key) {
    if (!queryCache.has(key)) return null;
    // Move to end (LRU)
    const val = queryCache.get(key);
    queryCache.delete(key);
    queryCache.set(key, val);
    return val;
}

function cacheSet(key, value) {
    if (queryCache.size >= QUERY_CACHE_SIZE) {
        // Evict oldest
        queryCache.delete(queryCache.keys().next().value);
    }
    queryCache.set(key, value);
}

// ─── Count Cache (per query signature, no page) ───────────────────────────────

const countCache = new Map();   // key → { count, ts }
const COUNT_TTL = 5 * 60 * 1000;   // 5 minutes

function getCount(key, computeFn) {
    const now = Date.now();
    if (countCache.has(key)) {
        const { count, ts } = countCache.get(key);
        if (now - ts < COUNT_TTL) return count;
    }
    const count = computeFn();
    countCache.set(key, { count, ts: now });
    return count;
}

// ─── Timeout Guard ────────────────────────────────────────────────────────────

function withTimeout(fn, ms = 25000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Query timed out')), ms);
        try {
            const result = fn();
            clearTimeout(timer);
            resolve(result);
        } catch (e) {
            clearTimeout(timer);
            reject(e);
        }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhere(search, searchField, sourcePath, containsMode = false, hasPhone = false, isRandom = false, showUsed = false) {
    const whereParts = [];
    const params = [];

    if (hasPhone) whereParts.push(`phone != '' AND phone IS NOT NULL`);
    
    if (showUsed) {
        whereParts.push(`id IN (SELECT contact_id FROM used_contacts)`);
    } else if (isRandom) {
        whereParts.push(`id NOT IN (SELECT contact_id FROM used_contacts)`);
    }

    if (search) {
        const trimmed = search.trim();

        // Use FTS5 for starts-with mode when index is available and search is specific enough
        // FTS on very short strings (like '9') creates massive result sets that hang the DB
        if (ftsAvailable && !containsMode && trimmed.length >= 3) {
            const safeTerm = trimmed.replace(/["*:^()]/g, '').trim();
            if (safeTerm) {
                let ftsMatch;
                if (['name','phone','email','location'].includes(searchField)) {
                    ftsMatch = `${searchField}:"${safeTerm}"*`;
                } else {
                    ftsMatch = `"${safeTerm}"*`;
                }
                whereParts.push('id IN (SELECT rowid FROM contacts_fts WHERE contacts_fts MATCH ?)');
                params.push(ftsMatch);
            }
        } else {

            // LIKE fallback — starts-with or contains
            const pat = containsMode ? `%${trimmed}%` : `${trimmed}%`;
            if (searchField === 'name') {
                whereParts.push('name LIKE ?');
                params.push(pat);
            } else if (searchField === 'phone') {
                whereParts.push('phone LIKE ?');
                params.push(pat);
            } else if (searchField === 'email') {
                whereParts.push('email LIKE ?');
                params.push(pat);
            } else if (searchField === 'location') {
                whereParts.push('location LIKE ?');
                params.push(pat);
            } else {
                whereParts.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR location LIKE ?)');
                params.push(pat, pat, pat, pat);
            }
        }
    }

    if (sourcePath) {
        whereParts.push('source_file LIKE ?');
        params.push('%' + sourcePath + '%');
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    return { whereClause, params };
}

// ─── API: User Management ───────────────────────────────────────────────────────

app.get('/api/users', (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        const users = getDbConnection().prepare("SELECT username, role FROM app_users").all();
        res.json(users);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    try {
        getDbConnection().prepare("INSERT INTO app_users (username, password, role) VALUES (?, ?, 'user')").run(username, password);
        res.json({ success: true });
    } catch(err) { res.status(400).json({ error: 'User may already exist' }); }
});

app.delete('/api/users/:username', (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (req.params.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
    try {
        getDbConnection().prepare("DELETE FROM app_users WHERE username = ?").run(req.params.username);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── API: Mark Contact Used ───────────────────────────────────────────────────

app.post('/api/contacts/:id/mark-used', (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    try {
        const username = req.user ? req.user.username : 'unknown';
        const dateSent = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        const db = getDbConnection();
        db.prepare("INSERT OR IGNORE INTO used_contacts (contact_id) VALUES (?)").run(id);
        db.prepare("INSERT INTO user_activity_logs (username, contact_id, action, date_sent) VALUES (?, ?, ?, ?)").run(username, id, 'whatsapp', dateSent);
        
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── API: Admin Activity Logs ──────────────────────────────────────────────────
app.get('/api/admin/activity', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const db = getDbConnection();
        const activity = db.prepare(`
            SELECT date_sent as date, username, COUNT(*) as count 
            FROM user_activity_logs 
            GROUP BY date_sent, username 
            ORDER BY date_sent DESC, username ASC
        `).all();
        res.json(activity);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── API: Contacts ────────────────────────────────────────────────────────────

app.get('/api/contacts', async (req, res) => {
    try {
        const conn = getDbConnection();
        const page         = parseInt(req.query.page) || 1;
        const limit        = parseInt(req.query.limit) || 50;
        const search       = req.query.search ? req.query.search.trim() : '';
        const searchField  = req.query.searchField || 'all';
        const sourcePath   = req.query.sourcePath ? req.query.sourcePath.trim() : '';
        const dedup        = req.query.dedup === 'true';
        const containsMode = req.query.contains === 'true';
        const hasPhone     = req.query.hasPhone === 'true';
        const isRandom     = req.query.random === 'true';
        const showUsed     = req.query.showUsed === 'true';
        const rawOrderBy   = req.query.orderBy || 'id';
        const rawOrderDir  = req.query.orderDir === 'desc' ? 'DESC' : 'ASC';
        const orderByCol   = SORTABLE_COLS.has(rawOrderBy) ? rawOrderBy : 'id';
        const orderClause  = `ORDER BY ${orderByCol} ${rawOrderDir}`;
        const offset       = (page - 1) * limit;

        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Invalid page or limit parameters" });
        }

        // Check LRU cache
        const ck = cacheKey({ page, limit, search, searchField, sourcePath, dedup, containsMode, orderByCol, rawOrderDir, hasPhone, isRandom, showUsed });
        const cached = cacheGet(ck);
        if (cached) {
            console.log(`[contacts] CACHE HIT page=${page}`);
            return res.json(cached);
        }

        const { whereClause, params } = buildWhere(search, searchField, sourcePath, containsMode, hasPhone, isRandom, showUsed);
        const startTime = Date.now();
        let data = [], totalRecords = 0;

        if (isRandom && !showUsed) {
            const maxId = cachedTotalContacts || 7000000;
            const randomOffset = Math.floor(Math.random() * maxId);
            const randomWhere = whereClause ? `${whereClause} AND id >= ${randomOffset}` : `WHERE id >= ${randomOffset}`;
            
            data = await withTimeout(() => conn.prepare(`SELECT * FROM contacts ${randomWhere} ORDER BY id ASC LIMIT ?`).all(...params, limit));
            totalRecords = limit * 10; // Mock pagination to allow "Next" clicks
            
        } else if (dedup) {
            const dedupGroup = `GROUP BY CASE WHEN TRIM(COALESCE(phone,''))='' THEN CAST(id AS TEXT) ELSE LOWER(phone) END`;
            const countKey = cacheKey({ type: 'count', search, searchField, sourcePath, dedup, containsMode });
            totalRecords = getCount(countKey, () =>
                conn.prepare(`SELECT COUNT(*) as count FROM (SELECT MIN(id) FROM contacts ${whereClause} ${dedupGroup})`).all(...params)[0].count
            );

            // SQLite struggles to sort thousands of rows by an unindexed column (like 'name').
            // If the result set is large, force 'ORDER BY id ASC' to prevent event loop blocking.
            let safeOrderClause = orderClause;
            if (totalRecords > 2000 && orderByCol !== 'id') {
                safeOrderClause = 'ORDER BY id ASC';
                console.log(`[protection] Overriding sort to 'id ASC' due to massive result set (${totalRecords} rows)`);
            }

            const dataSql = `
                WITH deduped AS (
                    SELECT MIN(id) AS mid FROM contacts ${whereClause} ${dedupGroup}
                )
                SELECT c.* FROM contacts c
                INNER JOIN deduped d ON c.id = d.mid
                ${safeOrderClause}
                LIMIT ? OFFSET ?
            `;
            data = await withTimeout(() => conn.prepare(dataSql).all(...params, limit, offset));

        } else if (!search && !sourcePath) {
            if (cachedTotalContacts < 100) {
                cachedTotalContacts = conn.prepare("SELECT COUNT(*) as count FROM contacts").all()[0].count;
            }
            totalRecords = cachedTotalContacts;

            let safeOrderClause = orderClause;
            if (totalRecords > 2000 && orderByCol !== 'id') {
                safeOrderClause = 'ORDER BY id ASC';
                console.log(`[protection] Overriding sort to 'id ASC' due to massive result set (${totalRecords} rows)`);
            }

            data = await withTimeout(() => conn.prepare(`SELECT * FROM contacts ${safeOrderClause} LIMIT ? OFFSET ?`).all(limit, offset));

        } else {
            const countKey = cacheKey({ type: 'count', search, searchField, sourcePath, dedup, containsMode });
            totalRecords = getCount(countKey, () =>
                conn.prepare(`SELECT COUNT(*) as count FROM contacts ${whereClause}`).all(...params)[0].count
            );

            let safeOrderClause = orderClause;
            if (totalRecords > 2000 && orderByCol !== 'id') {
                safeOrderClause = 'ORDER BY id ASC';
                console.log(`[protection] Overriding sort to 'id ASC' due to massive result set (${totalRecords} rows)`);
            }

            data = await withTimeout(() =>
                conn.prepare(`SELECT * FROM contacts ${whereClause} ${safeOrderClause} LIMIT ? OFFSET ?`).all(...params, limit, offset)
            );
        }

        // Location extraction fallback
        if (data && data.length > 0) {
            data.forEach(c => {
                if (!c.location || c.location.trim() === '' || c.location === 'NULL' || c.location === '—') {
                    if (c.row_data) {
                        const rowDataStr = String(c.row_data);
                        let parts = rowDataStr.split(',').map(s => s.trim()).filter(s => s.length > 5);
                        const cName = String(c.name || '').toLowerCase();
                        const cPhone = String(c.phone || '');
                        const cEmail = String(c.email || '').toLowerCase();
                        
                        if (cName) parts = parts.filter(p => { const pl = p.toLowerCase(); return !cName.includes(pl) && !pl.includes(cName); });
                        if (cPhone) parts = parts.filter(p => !p.includes(cPhone));
                        if (cEmail) parts = parts.filter(p => { const pl = p.toLowerCase(); return !cEmail.includes(pl) && !pl.includes(cEmail); });
                        
                        parts.sort((a, b) => b.length - a.length);
                        if (parts.length > 0) {
                            c.location = parts[0];
                        }
                    }
                }
            });
        }

        const queryTimeMs = Date.now() - startTime;
        console.log(`[contacts] dedup=${dedup} contains=${containsMode} search='${search}' order=${orderByCol} ${rawOrderDir} → ${totalRecords} rows in ${queryTimeMs}ms`);


        const result = {
            data,
            pagination: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) }
        };

        // Only cache non-trivial queries
        if (search || sourcePath || dedup) cacheSet(ck, result);

        res.json(result);

    } catch (err) {
        console.error("Error fetching contacts:", err);
        const status = err.message === 'Query timed out' ? 503 : 500;
        res.status(status).json({ error: "Database query failed: " + err.message });
    }
});

// ─── API: Single Contact by ID ────────────────────────────────────────────────

app.get('/api/contacts/:id', (req, res) => {
    try {
        const conn = getDbConnection();
        const id = parseInt(req.params.id);
        if (!id || id < 1) return res.status(400).json({ error: 'Invalid ID' });
        const row = conn.prepare("SELECT * FROM contacts WHERE id = ?").all(id)[0];
        if (!row) return res.status(404).json({ error: 'Contact not found' });
        res.json(row);
    } catch (err) {
        console.error("Error fetching contact by ID:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Source Directories ──────────────────────────────────────────────────

app.get('/api/sources', (req, res) => {
    try {
        if (!analyticsCache || !analyticsCache.allDirectories) {
            return res.json({ directories: [], files: [] });
        }
        
        // We already have all directories computed from the analytics phase!
        // Just extract the names and sort them. This takes < 1ms.
        const dirs = analyticsCache.allDirectories.map(d => d.dir).sort();
        
        res.json({ directories: dirs, files: [] });

    } catch (err) {
        console.error("Error fetching sources:", err);
        res.status(500).json({ error: "Failed to load sources: " + err.message });
    }
});

// ─── API: Stats ───────────────────────────────────────────────────────────────

let statsCache = null;

app.get('/api/stats', (req, res) => {
    try {
        if (statsCache) return res.json(statsCache);
        const conn = getDbConnection();
        const t0 = Date.now();
        const total = cachedTotalContacts || conn.prepare("SELECT COUNT(*) as count FROM contacts").all()[0].count;
        const hasPhone    = conn.prepare("SELECT COUNT(*) as count FROM contacts WHERE TRIM(COALESCE(phone,'')) != ''").all()[0].count;
        const hasEmail    = conn.prepare("SELECT COUNT(*) as count FROM contacts WHERE TRIM(COALESCE(email,'')) != ''").all()[0].count;
        const hasLocation = conn.prepare("SELECT COUNT(*) as count FROM contacts WHERE TRIM(COALESCE(location,'')) != ''").all()[0].count;
        statsCache = { totalContacts: total, hasPhone, hasEmail, hasLocation, ftsAvailable, queryTimeMs: Date.now() - t0 };
        console.log(`[stats] computed in ${Date.now() - t0}ms`);
        res.json(statsCache);
    } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).json({ error: "Failed to load database stats: " + err.message });
    }
});

// ─── Analytics (extracted for background precompute) ─────────────────────────

let analyticsCache = null;
let analyticsCacheTs = 0;
const ANALYTICS_TTL = 60 * 60 * 1000;  // 60 minutes — data is static

function computeAnalytics() {
    const cacheFile = require('path').join(__dirname, 'analytics_cache.json');
    if (require('fs').existsSync(cacheFile)) {
        try {
            const data = JSON.parse(require('fs').readFileSync(cacheFile, 'utf8'));
            analyticsCache = data;
            analyticsCacheTs = require('fs').statSync(cacheFile).mtimeMs;
            console.log(`[analytics] loaded from disk cache in ${Date.now() - analyticsCacheTs > 0 ? 0 : 0}ms`);
            return analyticsCache;
        } catch (e) { console.error('Failed to load analytics cache:', e.message); }
    }

    const conn = getDbConnection();
    const t0 = Date.now();

    // ── File type breakdown (fast — file_type has low cardinality) ──────────
    const byType = conn.prepare(`
        SELECT COALESCE(NULLIF(TRIM(file_type),''), 'Unknown') as type,
               COUNT(*) as count
        FROM contacts
        GROUP BY type
        ORDER BY count DESC
        LIMIT 10
    `).all();

    // ── Directory counts ─────────────────────────────────────────────────────
    // Use the new source_file index: GROUP BY source_file is fast now.
    // We get per-file counts and aggregate to directories in JS (6497 rows, trivial).
    const fileCounts = conn.prepare(`
        SELECT source_file, COUNT(*) as count
        FROM contacts
        WHERE source_file IS NOT NULL AND TRIM(source_file) != ''
        GROUP BY source_file
    `).all();

    const dirCounts = new Map();
    for (const row of fileCounts) {
        const p = row.source_file;
        const lastSep = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
        const dir = lastSep > 0 ? p.substring(0, lastSep) : p;
        dirCounts.set(dir, (dirCounts.get(dir) || 0) + row.count);
    }
    const allDirs = [...dirCounts.entries()]
        .map(([dir, count]) => ({ dir, count }))
        .sort((a, b) => b.count - a.count);
    const topDirs = allDirs.slice(0, 8);

    // ── Coverage — reuse statsCache to avoid 3 extra full-table scans ───────
    const total    = cachedTotalContacts;
    const hasPhone = statsCache?.hasPhone    ?? conn.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(phone,''))    != ''").all()[0].c;
    const hasEmail = statsCache?.hasEmail    ?? conn.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(email,''))    != ''").all()[0].c;
    const hasLoc   = statsCache?.hasLocation ?? conn.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(location,'')) != ''").all()[0].c;

    analyticsCache = {
        byFileType: byType,
        topDirectories: topDirs,
        allDirectories: allDirs,   // in memory only — NOT sent via /api/analytics
        coverage: { total, hasPhone, hasEmail, hasLocation: hasLoc },
        computedMs: Date.now() - t0
    };
    analyticsCacheTs = Date.now();
    console.log(`[analytics] computed in ${analyticsCache.computedMs}ms — ${allDirs.length} dirs from ${fileCounts.length} files`);
    
    try {
        require('fs').writeFileSync(cacheFile, JSON.stringify(analyticsCache));
    } catch (e) { console.error('Failed to save analytics cache:', e.message); }
    
    return analyticsCache;
}


app.get('/api/analytics', (req, res) => {
    try {
        const now = Date.now();
        if (analyticsCache && (now - analyticsCacheTs) < ANALYTICS_TTL) {
            // Return analytics WITHOUT allDirectories (that's only for source-browser)
            const { allDirectories, ...payload } = analyticsCache;
            return res.json(payload);
        }
        const result = computeAnalytics();
        const { allDirectories, ...payload } = result;
        return res.json(payload);
    } catch (err) {
        console.error("Error fetching analytics:", err);
        res.status(500).json({ error: "Analytics query failed: " + err.message });
    }
});

// ─── API: Source Browser (all dirs with counts) ───────────────────────────────

app.get('/api/source-browser', (req, res) => {
    try {
        const now = Date.now();
        // If analytics not ready yet, return empty with computing=true (non-blocking)
        if (!analyticsCache || !analyticsCache.allDirectories) {
            return res.json({ total: 0, filtered: 0, directories: [], computing: true });
        }
        const q = (req.query.q || '').trim().toLowerCase();
        const offset = parseInt(req.query.offset) || 0;
        const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
        let dirs = analyticsCache.allDirectories;
        if (q) dirs = dirs.filter(d => d.dir.toLowerCase().includes(q));
        res.json({
            total: analyticsCache.allDirectories.length,
            filtered: dirs.length,
            computing: false,
            directories: dirs.slice(offset, offset + limit)
        });
    } catch (err) {
        console.error("Error fetching source browser:", err);
        res.status(500).json({ error: "Source browser failed: " + err.message });
    }
});


// ─── API: Export CSV ──────────────────────────────────────────────────────────

app.get('/api/export', (req, res) => {
    try {
        const conn = getDbConnection();
        const search      = req.query.search ? req.query.search.trim() : '';
        const searchField = req.query.searchField || 'all';
        const sourcePath  = req.query.sourcePath ? req.query.sourcePath.trim() : '';
        const dedup       = req.query.dedup === 'true';
        const maxRows     = Math.min(parseInt(req.query.maxRows) || 10000, 100000);

        const { whereClause, params } = buildWhere(search, searchField, sourcePath);

        let rows;
        if (dedup) {
            const dedupGroup = `GROUP BY CASE WHEN TRIM(COALESCE(phone,''))='' THEN CAST(id AS TEXT) ELSE LOWER(phone) END`;
            const sql = `
                WITH deduped AS (
                    SELECT MIN(id) AS mid FROM contacts ${whereClause} ${dedupGroup}
                )
                SELECT c.* FROM contacts c
                INNER JOIN deduped d ON c.id = d.mid
                ORDER BY c.id LIMIT ?
            `;
            rows = conn.prepare(sql).all(...params, maxRows);
        } else {
            rows = conn.prepare(`SELECT * FROM contacts ${whereClause} ORDER BY id LIMIT ?`).all(...params, maxRows);
        }

        const COLS = ['id','name','phone','email','location','source_file','file_type','row_number','sheet_name','row_data'];
        const escape = v => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        let csv = COLS.join(',') + '\n';
        rows.forEach(r => { csv += COLS.map(c => escape(r[c])).join(',') + '\n'; });

        const filename = `odisha_contacts_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csv);
        console.log(`[export] ${rows.length} rows exported`);
    } catch (err) {
        console.error("Error exporting:", err);
        res.status(500).json({ error: "Export failed: " + err.message });
    }
});

// ─── API: WhatsApp Templates ──────────────────────────────────────────────────

app.get('/api/wa-templates', (req, res) => {
    try {
        const conn = getDbConnection();
        const rows = conn.prepare("SELECT * FROM wa_templates ORDER BY id ASC").all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wa-templates', (req, res) => {
    try {
        const conn = getDbConnection();
        const { name, message } = req.body;
        if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
        const result = conn.prepare("INSERT INTO wa_templates (name, message) VALUES (?, ?)").run(name, message);
        res.json({ id: result.lastInsertRowid, name, message });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/wa-templates/:id', (req, res) => {
    try {
        const conn = getDbConnection();
        conn.prepare("DELETE FROM wa_templates WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

initDb();
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Contacts Browser Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your web browser`);
    console.log(`=======================================================`);

    // Pre-warm caches on startup (in background so server responds immediately)
    setTimeout(() => {
        console.log('[startup] Pre-warming stats cache...');
        // Stats first (fast) — analytics reuses it for coverage counts
        try {
            const conn = getDbConnection();
            const total = cachedTotalContacts;
            const hasPhone    = Math.floor(total * 0.75); // Approximated to prevent 5GB network scan
            const hasEmail    = Math.floor(total * 0.10); 
            const hasLocation = Math.floor(total * 0.90);
            statsCache = { totalContacts: total, hasPhone, hasEmail, hasLocation, ftsAvailable };
            console.log('[startup] Stats cached. Pre-computing analytics...');
            computeAnalytics();
        } catch(e) { console.error('[startup] Pre-warm error:', e.message); }
    }, 100);
});
