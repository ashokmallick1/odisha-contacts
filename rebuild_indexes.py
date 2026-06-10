import sqlite3
import time

DB_FILE = 'contacts.db'

def rebuild():
    start_time = time.time()
    print(f"Connecting to database {DB_FILE}...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Apply SQLite optimization PRAGMAs
    cursor.execute("PRAGMA busy_timeout = 30000;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -1000000;") # 1GB Cache
    cursor.execute("PRAGMA temp_store = MEMORY;")
    
    print("Dropping existing indexes...")
    cursor.execute("DROP INDEX IF EXISTS idx_contacts_name;")
    cursor.execute("DROP INDEX IF EXISTS idx_contacts_phone;")
    cursor.execute("DROP INDEX IF EXISTS idx_contacts_email;")
    cursor.execute("DROP INDEX IF EXISTS idx_contacts_location;")
    conn.commit()
    print("Dropped indexes successfully.")
    
    # Recreate indexes with COLLATE NOCASE
    indexes = [
        ("idx_contacts_name", "contacts(name COLLATE NOCASE)"),
        ("idx_contacts_phone", "contacts(phone COLLATE NOCASE)"),
        ("idx_contacts_email", "contacts(email COLLATE NOCASE)"),
        ("idx_contacts_location", "contacts(location COLLATE NOCASE)")
    ]
    
    for index_name, target in indexes:
        t0 = time.time()
        print(f"Creating index {index_name} on {target}...")
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {target};")
        conn.commit()
        print(f"Created index {index_name} in {time.time() - t0:.2f}s")
        
    print("Optimizing database structure (ANALYZE)...")
    cursor.execute("ANALYZE;")
    conn.commit()
    
    conn.close()
    print(f"Rebuild process completed in {time.time() - start_time:.2f}s")

if __name__ == '__main__':
    rebuild()
