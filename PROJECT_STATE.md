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

## Docker Deployment & Restart Proofing
Since this runs locally in a Docker container exposed via Cloudflare Tunnel, updates or system reboots require specific steps to ensure the application comes back online correctly.

### 1. Recovering after a Server Reboot
If the host machine restarts, the Docker container is configured with `--restart unless-stopped`, so the local app should automatically come back online at `localhost:3006`.
However, you must ensure the Cloudflare Tunnel daemon is running.
- **Check Tunnel:** Ensure your Cloudflare Tunnel (`contact.bhashaai.in` -> `localhost:3006`) is active in your Cloudflare Zero Trust dashboard.

### 2. Pushing & Deploying Code Changes
If an AI agent or developer makes code changes in this directory (`f:\odisha results\`), those changes **will not** appear live until the production Docker image is rebuilt. 

Run the following commands exactly in the **production directory** (`F:\production\odisha-contacts\odisha-contacts`):
```bash
# 1. Pull the latest code from GitHub
git pull

# 2. Rebuild the Docker image
docker build -t odisha-contacts .

# 3. Stop and remove the old running container
docker stop contacts-app
docker rm contacts-app

# 4. Start the new container (CRITICAL: You must mount the DB files so data isn't overwritten)
docker run -d --name contacts-app --restart unless-stopped -p 80:3006 -v "F:\production\odisha-contacts\odisha-contacts\contacts.db:/usr/src/app/contacts.db" -v "F:\production\odisha-contacts\odisha-contacts\analytics_cache.json:/usr/src/app/analytics_cache.json" odisha-contacts
```

### 3. State Preservation
- **Database:** `contacts.db` contains not only the 6.9M rows but also user accounts, templates, and activity logs. Never overwrite this file in production. It is mounted externally via the `-v` flag to survive container restarts.
- **Analytics Cache:** `analytics_cache.json` caches expensive directory tree calculations. It is also mounted externally.

## AI Agent Context
**ATTENTION FUTURE AI AGENTS:** 
- If you are tasked with resuming this project, ALWAYS read `PRD_AND_DESIGN.md` in the root folder to understand the full architectural design.
- You must always commit your changes, push to GitHub, pull in the production folder, and rebuild the Docker container (as shown above) to deploy changes to the live site.
