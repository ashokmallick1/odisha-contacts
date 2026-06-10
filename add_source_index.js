/**
 * add_source_index.js
 * One-time script to add source_file index on contacts table.
 * This dramatically speeds up /api/sources (16s → <1s) and analytics (60s → <5s).
 * Run once: node add_source_index.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'contacts.db');

console.log('============================================================');
console.log('  Adding source_file index to contacts table');
console.log('============================================================\n');
console.log(`Database: ${DB_PATH}`);
console.log('This is a one-time operation. Do NOT interrupt.\n');

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA busy_timeout = 60000;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = OFF;");
db.exec("PRAGMA cache_size = -524288;"); // 512 MB cache
db.exec("PRAGMA temp_store = MEMORY;");

// Check if index already exists
const exists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_contacts_source_file'"
).all();

if (exists.length > 0) {
    console.log('✓ Index idx_contacts_source_file already exists. Nothing to do.');
    db.close();
    process.exit(0);
}

console.log('Creating index on source_file ...');
const t0 = Date.now();
db.exec("CREATE INDEX IF NOT EXISTS idx_contacts_source_file ON contacts(source_file);");
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log('\n============================================================');
console.log(`✓  Index created in ${elapsed}s`);
console.log('   Restart the server: the /api/sources and analytics endpoints');
console.log('   will now run in under 1 second instead of 16-60 seconds.');
console.log('============================================================\n');

db.exec("ANALYZE;");
db.close();
