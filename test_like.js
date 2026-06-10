const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('contacts.db');

let t0 = Date.now();
const countLike = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE phone LIKE '9%'").all()[0].c;
console.log('LIKE COUNT took', Date.now() - t0, 'ms. Result:', countLike);

t0 = Date.now();
const dataLike = db.prepare("SELECT * FROM contacts WHERE phone LIKE '9%' ORDER BY id ASC LIMIT 50").all();
console.log('LIKE SELECT ORDER BY id took', Date.now() - t0, 'ms');

t0 = Date.now();
const dataLikeName = db.prepare("SELECT * FROM contacts WHERE phone LIKE '9%' ORDER BY name ASC LIMIT 50").all();
console.log('LIKE SELECT ORDER BY name took', Date.now() - t0, 'ms');
