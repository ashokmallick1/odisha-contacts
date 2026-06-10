const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('contacts.db');
db.exec("PRAGMA cache_size=-65536;");
console.log('=== Indexes ===');
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name").all();
indexes.forEach(i => console.log(i.tbl_name, '|', i.name));

console.log('\n=== source_file stats ===');
const t0 = Date.now();
const srcCount = db.prepare("SELECT COUNT(DISTINCT source_file) as cnt FROM contacts").all()[0].cnt;
console.log(`Distinct source_files: ${srcCount}  (${Date.now()-t0}ms)`);
db.close();
