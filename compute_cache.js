const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const db = new DatabaseSync('contacts.db');
const fileCounts = db.prepare(`SELECT source_file, COUNT(*) as count FROM contacts WHERE source_file IS NOT NULL AND TRIM(source_file) != '' GROUP BY source_file`).all();
const dirCounts = new Map();
for (const row of fileCounts) {
    const p = row.source_file;
    const lastSep = Math.max(p.lastIndexOf('\\\\'), p.lastIndexOf('/'));
    const dir = lastSep > 0 ? p.substring(0, lastSep) : p;
    dirCounts.set(dir, (dirCounts.get(dir) || 0) + row.count);
}
const allDirs = [...dirCounts.entries()].map(([dir, count]) => ({ dir, count })).sort((a, b) => b.count - a.count);
const topDirs = allDirs.slice(0, 8);
const byType = db.prepare(`SELECT COALESCE(NULLIF(TRIM(file_type),''), 'Unknown') as type, COUNT(*) as count FROM contacts GROUP BY type ORDER BY count DESC LIMIT 10`).all();
const total = db.prepare("SELECT COUNT(*) as c FROM contacts").all()[0].c;
const hasPhone = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(phone,'')) != ''").all()[0].c;
const hasEmail = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(email,'')) != ''").all()[0].c;
const hasLocation = db.prepare("SELECT COUNT(*) as c FROM contacts WHERE TRIM(COALESCE(location,'')) != ''").all()[0].c;

const cache = {
    byFileType: byType,
    topDirectories: topDirs,
    allDirectories: allDirs,
    coverage: { total, hasPhone, hasEmail, hasLocation },
    computedMs: 0
};
fs.writeFileSync('analytics_cache.json', JSON.stringify(cache));
console.log("Cache created successfully");
