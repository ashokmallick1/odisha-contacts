# Odisha Contacts Browser - Project State

## Project Overview
This application is a highly optimized contacts viewer built to handle a 6.9+ million row SQLite database. It features WhatsApp template messaging, fast FTS5 searching, filtering by source directories, and an admin dashboard for user management and activity tracking.

## Technology Stack
- **Backend:** Node.js, Express.js
- **Database:** `node:sqlite` (native SQLite sync API), `contacts.db`
- **Frontend:** Vanilla HTML, CSS, JavaScript (no frontend frameworks)
- **Deployment:** Docker (served via Cloudflare Tunnel)

## File Structure
- `server.js` - Express backend with native SQLite integration. Handles `/api/*` routes.
- `contacts.db` - The SQLite database (built via `build_fts.js` if necessary, though pre-built).
- `public/` - Static frontend files:
  - `index.html` - Login page.
  - `app.html` - Main application interface.
  - `app.js` - Frontend logic for the main app (state management, rendering, bulk WA).
  - `sources.html` - Source directory browser.
  - `admin.html` - Admin dashboard.
  - `style.css` - Global stylesheet (Mobile responsive).
- `Dockerfile` & `.dockerignore` - Container configuration.

## Key Features & APIs
- **Fast Text Search:** Implemented using SQLite FTS5 on a virtual table `contacts_fts`.
- **WhatsApp Integration:** Built-in dynamic link generation for WhatsApp Web/App, with customizable persistent templates (`wa_templates`).
- **Activity Tracking:** Tracks how many contacts users message per day via the `user_activity_logs` table (`/api/contacts/:id/mark-used`).
- **Authentication:** Mocked basic login flow checking against the `app_users` table in the DB.

## Docker Deployment Workflow
Since this runs locally in a Docker container bound to port 80 and exposed via Cloudflare Tunnel, updates to the source code **must be applied to the container**:

1. Merge or pull updates to the production directory.
2. Build the image: `docker build -t odisha-contacts .`
3. Stop/Remove the old container: `docker stop contacts-app ; docker rm contacts-app`
4. Run the new container (ensure you mount the db files so data is not lost):
   ```bash
   docker run -d --name contacts-app --restart unless-stopped -p 80:3006 -v "F:\production\odisha-contacts\odisha-contacts\contacts.db:/usr/src/app/contacts.db" -v "F:\production\odisha-contacts\odisha-contacts\analytics_cache.json:/usr/src/app/analytics_cache.json" odisha-contacts
   ```
   *(Note: The exact source paths may vary based on the user's setup, check `docker inspect` for existing bindings).*
