/**
 * build_fts.js — One-time script to build the FTS5 full-text search index.
 *
 * Run once:  node build_fts.js
 *
 * This creates a virtual FTS5 table on top of the contacts table.
 * After completion, restart the server — it will auto-detect the index
 * and use it for much faster, smarter search.
 *
 * Expected time: 5–20 minutes for 7M rows.
 * DB will remain fully usable while this runs (WAL mode).
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'contacts.db');

console.log('='.repeat(60));
console.log('  Odisha Contacts — FTS5 Index Builder');
console.log('='.repeat(60));
console.log(`\nDatabase: ${DB_PATH}`);
console.log('This is a one-time operation. Do not interrupt.\n');

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA busy_timeout = 120000;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA cache_size = -524288;");   // 512 MB cache for build
db.exec("PRAGMA temp_store = MEMORY;");
db.exec("PRAGMA synchronous = NORMAL;");

// Check existing
const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contacts_fts'").all();
if (existing.length > 0) {
    console.log('⚠  Existing FTS5 table found — dropping and rebuilding...\n');
    db.exec("DROP TABLE contacts_fts");
}

// Count rows first
const total = db.prepare("SELECT COUNT(*) as c FROM contacts").all()[0].c;
console.log(`Total contacts to index: ${total.toLocaleString()}\n`);

// Create FTS5 virtual table
// content=contacts means FTS5 reads directly from contacts table
// content_rowid=id means the FTS rowid maps to contacts.id
console.log('Step 1/2 — Creating FTS5 virtual table...');
db.exec(`
    CREATE VIRTUAL TABLE contacts_fts USING fts5(
        name,
        phone,
        email,
        location,
        content=contacts,
        content_rowid=id,
        tokenize='unicode61 remove_diacritics 2'
    )
`);
console.log('           Done.\n');

// Populate from contacts table
console.log('Step 2/2 — Populating index (this is the slow step)...');
console.log('           Progress is not shown — please wait...\n');

const t0 = Date.now();
db.exec("INSERT INTO contacts_fts(contacts_fts) VALUES('rebuild')");
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n${'='.repeat(60)}`);
console.log(`✓  FTS5 index built successfully in ${elapsed}s`);
console.log(`   Indexed ${total.toLocaleString()} contacts`);
console.log('');
console.log('   Next step: Restart the server (node server.js)');
console.log('   The server will auto-detect and use FTS5 for search.');
console.log('='.repeat(60));

db.close();
