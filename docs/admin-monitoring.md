## Admin Live Monitoring

The **Live Monitoring** tab is available in the admin panel (`/admin2admin10` and `/am/admin2admin10`).

### What is shown

- **Online visitors (last 30s)**  
  Unique visitors (guests + logged-in) who sent a heartbeat to the site in the last 30 seconds. Every page loads a small script that pings `POST /api/metrics/visitor-heartbeat` every ~18 seconds, so this is a near real-time count of people on the site.

- **Active logged-in users (last 5 / 15 min)**  
  Number of users who sent requests to protected API endpoints (with a valid JWT) in the last 5 and 15 minutes. If “Online visitors” is much higher than this, many guests are on landing pages.

- **Requests / min and Total requests**  
  - `Requests/min` — number of HTTP requests to the API in the last minute.  
  - `Total since restart` — number of requests handled since the Node/PM2 process was last restarted.

- **Server load**  
  - `CPU load` — system load average over 1 minute (similar to `loadavg`).  
  - `Uptime` — how long the Node process has been running without restart.

- **DB connections**  
  - `Active` — number of active connections to PostgreSQL (from `pg_stat_activity`).  
  - `Total` — total number of connections (including idle).

- **Memory**  
  - `Total system RAM` — total RAM on the server.  
  - `Free system RAM` — free RAM at the OS level.  
  - `Node RSS` — memory used by the Node process (total, including heap/stack/modules).  
  - `Node heap used` — JavaScript heap in use (managed by GC).

### Update frequency

- The **Live Monitoring** tab polls the `GET /api/admin/metrics` endpoint **every 2 seconds** while the tab is open.
- The endpoint is protected by `requireAdminAuth`; only admin JWT tokens are allowed.
- DB metrics are cached for 5 seconds so frequent admin refreshes do not add extra load on Postgres.

### How to interpret

- If `Active users (5 min)` grows steadily and approaches **400–800** on the current server — consider upgrading or scaling.  
- If `CPU load` is **above 4–5** most of the time on a 6 vCPU machine and responses slow down — the server is near its limit.  
- If `DB activeConnections` often approaches **80–90** with `max_connections = 100`, consider:
  - query optimization,
  - increasing resources,
  - tuning the connection pool and Postgres.

For long-term history you can add external monitoring (e.g. Prometheus/Grafana) on top of this endpoint; for quick real-time checks the Live Monitoring tab is sufficient.

### Visitor heartbeat (online count)

- The frontend sends a **visitor heartbeat** (`POST /api/metrics/visitor-heartbeat`) every ~18 seconds while a page is open. No auth required; a cookie `se_vid` stores an anonymous visitor ID.
- **Rate limit:** 10 requests per minute per IP for the heartbeat endpoint.
- **Validation:** `visitorId` must be 1–64 characters, only `[a-z0-9-]`. Invalid requests get 400.
- **Cleanup:** Visitor IDs older than 24 hours are removed from memory every 5 minutes so the map does not grow unbounded.

### Glossary

Short explanations for each metric (same as in the UI):

- **Online visitors (30s):** Unique visitors who pinged the site in the last 30 seconds (guests + logged-in).
- **Active logged-in users (5m / 15m):** Users who sent a request to the API in the last 5 or 15 minutes (logged-in activity).
- **Requests/min:** Number of HTTP requests to the API in the last minute.
- **Total requests:** Total requests since the API process was last restarted.
- **Server load (CPU):** System load average over 1 minute (higher = busier CPU).
- **Uptime:** How long the API process has been running without restart.
- **DB connections (active / total):** Active = queries in progress; Total = all connections to PostgreSQL (including idle).
- **Total system RAM:** Total RAM on the server.
- **Free system RAM:** RAM not in use by any process.
- **Node RSS:** Total memory used by the API process (RSS).
- **Node heap used:** JavaScript heap memory used by the API process.
