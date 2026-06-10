const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('contacts.db');
let t0 = Date.now();
const count = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE id IN (SELECT rowid FROM contacts_fts WHERE contacts_fts MATCH 'phone:\"9\"*')").all()[0].c;
console.log('COUNT took', Date.now() - t0, 'ms. Result:', count);

t0 = Date.now();
const data = db.prepare("SELECT * FROM contacts WHERE id IN (SELECT rowid FROM contacts_fts WHERE contacts_fts MATCH 'phone:\"9\"*') ORDER BY name ASC LIMIT 50 OFFSET 0").all();
console.log('SELECT ORDER BY name took', Date.now() - t0, 'ms');

t0 = Date.now();
const data2 = db.prepare("SELECT * FROM contacts WHERE id IN (SELECT rowid FROM contacts_fts WHERE contacts_fts MATCH 'phone:\"9\"*') ORDER BY id ASC LIMIT 50 OFFSET 0").all();
console.log('SELECT ORDER BY id took', Date.now() - t0, 'ms');
