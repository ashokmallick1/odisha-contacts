# Odisha Contacts Browser

A blazing-fast SQLite-powered web application for searching and viewing a massive 7.1M+ row contacts database.

## Features
- **Instant FTS5 Search**: Query millions of rows instantly.
- **Dockerized**: Pre-configured to run flawlessly in Docker over a network mount without freezing.
- **Basic Auth Protected**: Hardened endpoint protection.
- **Cloudflare Ready**: Optimized for edge-network exposure.

---

## 🚀 Deployment Instructions

### 1. Prerequisites
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Ensure you have your `contacts.db` (and optionally `analytics_cache.json`) in the same directory as the Dockerfile.

### 2. Build and Run the App
To build the optimized Debian Node image and start the container with the database mounted:

```bash
# Build the Docker Image
docker build -t odisha-contacts .

# Start the Container
docker run -d -p 80:3006 -v "${PWD}/contacts.db:/usr/src/app/contacts.db" -v "${PWD}/analytics_cache.json:/usr/src/app/analytics_cache.json" --name contacts-app --restart unless-stopped odisha-contacts
```

*(Note: The database is mounted via `-v` so that the 4.8GB file doesn't need to be baked into the image layers. The `server.js` startup queries are optimized to prevent full-table network scans).*

### 3. Exposing to the Internet (Zero Trust)
To safely expose this local server to the public internet using a custom domain (e.g. `contacts.yourdomain.com`) without opening router ports:

1. Log into your **Cloudflare Dashboard**.
2. Navigate to **Zero Trust -> Networks -> Tunnels**.
3. Create a **Cloudflared** tunnel.
4. Copy the Docker connector command they provide, and add `-d --restart unless-stopped` to ensure it auto-starts:
   ```bash
   docker run -d --restart unless-stopped cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <YOUR_TOKEN>
   ```
5. On the Cloudflare Routing page, route your chosen subdomain to `HTTP` at `host.docker.internal:80`.

### 4. Accessing the App
Go to your chosen domain. You will be prompted for Basic Auth credentials.
- **Username:** `subha`
- **Password:** `Zero@1234`

Enjoy your production-ready contacts browser!
