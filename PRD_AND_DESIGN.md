# Product Requirements Document (PRD) & System Design
**Project:** Odisha Contacts Browser
**Version:** 1.1.0

## 1. Product Overview
The Odisha Contacts Browser is a high-performance internal tool designed to search, browse, and manage outreach for a 6.9+ million row contact database. It enables team members to quickly query contacts by name, phone, email, location, or source directory, and seamlessly launch targeted WhatsApp outreach campaigns. The platform includes an admin dashboard for tracking agent activity and managing message templates.

## 2. Core Objectives
- **Extreme Performance:** Provide sub-second search capabilities across ~7 million records using SQLite FTS5.
- **Workflow Efficiency:** Reduce friction for agents conducting WhatsApp outreach by providing persistent message templates and one-click deep links.
- **Agent Accountability:** Track and visualize how many messages each agent sends daily to measure campaign velocity.
- **Mobile Accessibility:** Ensure agents can perform outreach effectively on mobile devices and tablets.

## 3. Product Requirements (Features)

### 3.1. Authentication & Roles
- **Login System:** Users must authenticate using basic login credentials.
- **Roles:**
  - `admin`: Can access the admin dashboard, create/delete users, view analytics, and manage templates.
  - `user`: Can search contacts, send WhatsApp messages, and modify their personal view settings.

### 3.2. Search & Filtering
- **Global Search:** Full-text search across Name, Phone, Email, and Location fields.
- **Field-specific Search:** Target searches to a specific column to reduce noise.
- **Source Directory Filtering:** Filter the 6.9M records by the original CSV source file or folder using a searchable dropdown.
- **Status Filtering:** Filter rows by user-assigned statuses (Contacted, Follow Up, Not Interested, Saved).
- **Deduplication:** A toggle to hide rows that share duplicate phone numbers.

### 3.3. Data Visualization
- **Data Table:** A resizable, paginated HTML table displaying core contact fields.
- **Mobile Responsive:** On small screens, the table scrolls horizontally and toolbars stack vertically.
- **Compact Mode:** A toggle to reduce padding and increase information density.
- **Column Resizing:** Draggable handles on table headers to adjust column widths. Widths are persisted in local storage.

### 3.4. WhatsApp Outreach Workflow
- **Template Management:** Admins can create and save standardized WhatsApp templates into the database.
- **Radio Button Selection:** Agents can quickly switch between active templates using a row of radio buttons.
- **One-Click Sending:** Clicking a phone number instantly generates a WhatsApp API link populated with the selected template and opens WhatsApp.
- **Bulk WhatsApp:** A panel to open the first 10 numbers on the current page sequentially in WhatsApp.

### 3.5. Admin Analytics
- **Activity Tracking:** Every time an agent clicks a WhatsApp link, the action is logged with their username, the contact ID, and the timestamp.
- **Analytics Dashboard:** A Chart.js line graph displaying the daily message volume per agent over time.

---

## 4. System Architecture & Design

### 4.1. Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** SQLite3 (accessed via `node:sqlite` or `better-sqlite3` native sync API).
- **Frontend:** Vanilla HTML, CSS, JavaScript (Zero-build frontend for maximum maintainability).
- **Hosting:** Dockerized, exposed publicly via Cloudflare Tunnel.

### 4.2. Database Design (`contacts.db`)
The database utilizes SQLite's WAL (Write-Ahead Logging) mode to support concurrent read/write operations.

**Table: `contacts`**
| Column | Type | Description |
|---|---|---|
| id | INTEGER PRIMARY KEY | Unique identifier |
| phone | TEXT | Extracted phone number |
| name | TEXT | Extracted name |
| email | TEXT | Extracted email address |
| location | TEXT | Extracted physical location/address |
| source_file | TEXT | The path/name of the original CSV file |
| file_type | TEXT | Typically "CSV" or "XLSX" |
| row_number | INTEGER | Row index from the source file |
| sheet_name | TEXT | Excel sheet name if applicable |
| row_data | TEXT | The raw unparsed text of the original row |

**Virtual Table: `contacts_fts`**
- An FTS5 (Full Text Search) virtual table mirroring the `contacts` table to enable high-speed text querying across millions of rows.

**Table: `app_users`**
| Column | Type | Description |
|---|---|---|
| username | TEXT PRIMARY KEY | Login ID |
| password | TEXT | Plaintext or hashed password |
| role | TEXT | 'admin' or 'user' |

**Table: `user_activity_logs`**
| Column | Type | Description |
|---|---|---|
| id | INTEGER PRIMARY KEY | Autoincrement |
| username | TEXT | Agent who performed the action |
| contact_id | INTEGER | The ID of the contact messaged |
| action | TEXT | Default is 'whatsapp_click' |
| date_sent | TEXT | Formatted date (YYYY-MM-DD) |

**Table: `wa_templates`**
| Column | Type | Description |
|---|---|---|
| id | INTEGER PRIMARY KEY | Autoincrement |
| name | TEXT | Template title |
| message | TEXT | Template body |

### 4.3. Backend API Routes
- **`GET /api/contacts`**: The primary data fetching endpoint. Handles pagination, sorting, FTS5 searching, and dynamic `location` fallback extraction if the DB field is empty.
- **`POST /api/contacts/:id/mark-used`**: Records an interaction in `user_activity_logs`.
- **`GET /api/sources`**: Returns a cached list of unique `source_file` directories for the filter dropdown.
- **`GET /api/stats`**: Returns the total number of contacts, and coverage metrics (how many have phones, emails, etc.).
- **`GET /api/admin/activity`**: Aggregates `user_activity_logs` data for the Chart.js dashboard.
- **`GET/POST/DELETE /api/wa-templates`**: CRUD operations for WhatsApp templates.

### 4.4. Frontend Architecture
- **`app.js`**: A monolithic controller handling state management (`state` object), DOM updates, debounce logic for search inputs, LocalStorage persistence, and API calls.
- **`style.css`**: Utilizes CSS variables for quick theme toggling (Light/Dark mode) and media queries (`@media (max-width: 768px)`) to collapse flex containers and table layouts for mobile screens.

### 4.5. Deployment & Infrastructure
The application is built into a self-contained Docker image `odisha-contacts`. 
The massive `contacts.db` file (4.8GB) and `analytics_cache.json` are mounted as volumes from the host machine into the container at `/usr/src/app/` to ensure persistence across container rebuilds and to keep the Docker image size small.
The container exposes port `3006`, which is securely tunnelled to the public internet via a Cloudflare Tunnel daemon running on the host machine.
