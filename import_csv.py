import csv
import sqlite3
import time
import os

CSV_FILE = 'search_results.csv'
DB_FILE = 'contacts.db'
BATCH_SIZE = 50000

def import_csv():
    start_time = time.time()
    
    if os.path.exists(DB_FILE):
        print(f"Removing existing database {DB_FILE}...")
        os.remove(DB_FILE)
        
    print(f"Connecting to database {DB_FILE}...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Apply SQLite optimization PRAGMAs for fast bulk loading
    cursor.execute("PRAGMA busy_timeout = 30000;")
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA cache_size = -1000000;") # 1GB Cache
    cursor.execute("PRAGMA temp_store = MEMORY;")
    
    # Create Table
    print("Creating contacts table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT,
            file_type TEXT,
            row_number INTEGER,
            sheet_name TEXT,
            name TEXT,
            phone TEXT,
            email TEXT,
            location TEXT,
            row_data TEXT
        );
    """)
    conn.commit()
    
    print(f"Parsing CSV '{CSV_FILE}'...")
    
    insert_sql = """
        INSERT INTO contacts (
            source_file, file_type, row_number, sheet_name, 
            name, phone, email, location, row_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    batch = []
    total_inserted = 0
    t0 = time.time()
    
    with open(CSV_FILE, 'r', encoding='utf-8', errors='ignore') as f:
        # Use python csv reader which handles quotes and newlines within columns
        reader = csv.reader(f)
        
        # Skip header
        try:
            header = next(reader)
            print(f"CSV Columns: {header}")
        except StopIteration:
            print("CSV file is empty.")
            return

        for r in reader:
            # Pad row if it has fewer than 9 columns due to parsing edge cases
            if len(r) < 9:
                r = r + [''] * (9 - len(r))
            
            # Extract columns matching the table structure
            # Source File, File Type, Row Number, Sheet Name (Excel), Name, Phone Number, Email, Location, Row Data
            row_tuple = (
                r[0], # source_file
                r[1], # file_type
                int(r[2]) if r[2].isdigit() else None, # row_number
                r[3], # sheet_name
                r[4].strip() if r[4] else '', # name
                r[5].strip() if r[5] else '', # phone
                r[6].strip() if r[6] else '', # email
                r[7].strip() if r[7] else '', # location
                r[8] if len(r) > 8 else '' # row_data
            )
            batch.append(row_tuple)
            
            if len(batch) >= BATCH_SIZE:
                cursor.executemany(insert_sql, batch)
                conn.commit()
                total_inserted += len(batch)
                batch = []
                elapsed = time.time() - t0
                print(f"Inserted {total_inserted:,} records... ({total_inserted / elapsed:.0f} recs/sec)")
                
        # Insert remaining
        if batch:
            cursor.executemany(insert_sql, batch)
            conn.commit()
            total_inserted += len(batch)
            
    print(f"Total records inserted: {total_inserted:,}. Time taken for load: {time.time() - start_time:.2f}s")
    
    # Create indexes for fast search
    print("Creating indexes on name, phone, email, location (this may take a minute)...")
    t0 = time.time()
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contacts_location ON contacts(location);")
    conn.commit()
    print(f"Indexes created successfully in {time.time() - t0:.2f}s")
    
    # Perform VACUUM and ANALYZE to optimize the database layout
    print("Optimizing database structure (ANALYZE)...")
    cursor.execute("ANALYZE;")
    conn.commit()
    
    conn.close()
    print(f"Import process completed in {time.time() - start_time:.2f}s")

if __name__ == '__main__':
    import_csv()
