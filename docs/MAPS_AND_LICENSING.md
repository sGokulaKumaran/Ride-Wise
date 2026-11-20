# Maps, Geocoding, Routing & Hosting Economics

RideWise is engineered to run on open geospatial infrastructure with **zero paid API keys for personal, educational, and non-commercial use**. Every map tile, place search, and route calculation goes **directly from the user's browser to the geospatial provider**—**0 bytes** of map or routing traffic pass through the RideWise backend.

---

## Map, Search & Routing Providers

All tile layers and routing endpoints are configured in [`frontend/src/pages/components/ride/mapStyles.js`](../frontend/src/pages/components/ride/mapStyles.js) and [`frontend/src/services/routingApi.js`](../frontend/src/services/routingApi.js).

| Provider / Layer | Role in RideWise | Automatic Fallback | Official Policy & Free-Tier Limits *(at the time of writing)* |
|---|---|---|---|
| **OpenStreetMap Standard** (`tile.openstreetmap.org`, z19) | Default **Standard** map style | — | Community-funded fair use (OSMF Tile Usage Policy); requires `© OpenStreetMap contributors` (ODbL); heavy/commercial traffic or bulk scraping is blocked. |
| **Stadia Maps** (`alidade_smooth_dark` z20 & `stamen_terrain` z18) | Primary **Dark** & **Terrain** styles | Dark → CSS-inverted OSM<br/>Terrain → OpenTopoMap | **200,000 credits/month free**, strictly **non-commercial** (dev/personal/academic). Works keyless on `localhost`; production domains use free domain auth in the Stadia dashboard. Hard cap (HTTP 429, no surprise overage bills). |
| **Esri / ArcGIS World Imagery** (`server.arcgisonline.com`, z19) | **Satellite** style | — | Free for personal, educational, and non-commercial interactive viewing; commercial apps require a paid ArcGIS plan. Attribution (`© Esri, Maxar, Earthstar Geographics`) required; no bulk caching. |
| **OpenTopoMap** (`tile.opentopomap.org`, z17) | Automatic fallback for **Terrain** | — | Community best-effort (CC-BY-SA 3.0), no SLA, no bulk scraping. |
| **CyclOSM** (`tile-cyclosm.openstreetmap.fr`, z18) | **Cycling** style | — | OSM Tile Usage Policy fair use; valid attribution required; heavy/commercial traffic blocked. |
| **Photon by Komoot** (`photon.komoot.io/api/`) | Primary place search / autocomplete | Races with Nominatim after 1.2 s | Public community instance (Apache 2.0 software, OSM data); low-traffic fair use only; heavy automated bursts get throttled or banned. |
| **Nominatim (OSMF)** (`nominatim.openstreetmap.org`) | Search fallback + reverse geocoding | — | **Strict max 1 request/second** across the entire application; no un-throttled autocomplete or bulk geocoding; OSM attribution required. |
| **OSRM Demo + FOSSGIS Germany** (`router.project-osrm.org` → `routing.openstreetmap.de`) | Turn-by-turn road routing & alternatives | Sticky failover between the two servers | Donated public demo servers (no SLA, not for high-volume commercial apps); ~1 req/sec fair use per client; OSM attribution required. |

### Built-In Politeness & Resilience

Because these are shared community servers, RideWise enforces client-side politeness:

- **1,100 ms client request queues** — `geocodeQueue` and `routeQueue` enforce a `1100 ms` minimum gap between calls so fast typing or re-routing never hammers Nominatim or OSRM.
- **Privacy-aware search biasing** — when biasing Photon search near your current position, coordinates are rounded to ~1 km before leaving the browser.
- **Automatic tile fallback** — if Stadia Dark or Stadia Terrain hits 3 failed tile loads (e.g., HTTP 429 or domain restriction) with 0 tiles loaded, RideWise switches that session to its fallback (CSS-inverted OSM Standard for Dark, OpenTopoMap for Terrain) so the map never goes blank.
- **Sticky OSRM failover** — if the primary OSRM demo server times out or errors, RideWise fails over to FOSSGIS Germany and remembers the healthy server for subsequent routes.

---

## Live Hosting Limits & Economics

The live demo at **[ride-wise.pages.dev](https://ride-wise.pages.dev)** runs on a **$0/month** three-tier cloud stack *(provider quotas below are accurate at the time of writing; providers may adjust free tiers over time)*.

### What Powers the Live App ($0/month)

| Layer | Host & Plan | Free-Tier Limits *(at time of writing)* | How RideWise Works Within Them |
|---|---|---|---|
| **Frontend + Edge Proxy** | **Cloudflare Pages** (Free) | Unlimited static bandwidth · 500 builds/mo · **100,000 Pages Functions req/day** (10 ms CPU/invocation) | React/Vite assets load straight from Cloudflare's edge. Pages Functions proxy `/api/*` and `/ws/*` so session cookies stay first-party. A WebSocket `Upgrade` handshake counts as **1 request**; ongoing WS frames don't consume daily quota. Both `/ws/fleet` and `/ws/rides` send a **25 s ping** to beat Cloudflare's 100 s idle WS timeout. |
| **Backend API & WebSockets** | **Render** (Free Web Service) | **512 MB RAM** · **0.1 vCPU** · 750 hrs/mo · **5 GB/mo** outbound bandwidth · sleeps after **15 min idle** (~30–60 s cold start) | Live fleet updates broadcast directly from memory (`ConcurrentHashMap`), persisting to PostgreSQL only every **5 s**. `spring-session-jdbc` keeps users logged in across sleep/wake cycles. |
| **Database** | **Aiven for PostgreSQL** (Free) | **1 GB storage** · **1 GB RAM** · **1 vCPU** · max **20 connections** · automated backups | HikariCP is capped at **10 connections** (`open-in-view=false`), leaving plenty of headroom. A scheduled 6-hour cleanup job (`DataCleanupService`) prunes old route JSON (>7 d), replay tracks (>90 d), old notifications, and audit logs (>180 d). |

### Practical Free-Tier Capacity

Because telemetry fan-out happens in memory and replay points are thinned (`>= 40 m` moved or `>= 30 s` with `>= 5 m` movement, capped at 4,000 points/trip), the free stack goes surprisingly far:

| Workload | Realistic Free-Tier Capacity | Primary Bottleneck |
|---|---|---|
| **Simultaneous live fleet vehicles** (sending GPS) | **~15–30 active vehicles** smoothly | Render 0.1 vCPU (0.2 DB writes/s + 0.67 WS frames/s per vehicle) |
| **Simultaneous group-ride sharers** | **~10–25 active sharers** | Render 0.1 vCPU + HikariCP 10-connection pool |
| **Concurrent live WebSocket viewers** | **~50–150 viewers** comfortably *(ceiling ~200–300)* | Render 512 MB JVM heap & 5 GB/mo egress (**0 extra DB load** per viewer) |
| **Daily active usage** | **~400–600 active user-hours/day** (~50–100 DAU) | Cloudflare 100,000 Functions req/day (WS frames exempt) |
| **Historical GPS trips in PostgreSQL** | **~7,000–10,000+ hours** of fleet trips (~5–6M thinned points) | Aiven 1 GB storage (auto-maintained by 6-hour cleanup job) |

### Legal & Commercial Boundaries vs. Self-Hosted Scaling

RideWise is engineered to operate **within the free-tier terms for personal, educational, and non-commercial use**: open-source code, open data with proper attributions, polite client-side queues, and zero scraped tiles.

If you plan to deploy RideWise for a **commercial fleet or high-traffic campus**:

- **Small Production / Campus / SMB Fleet (~$20–$40/month):** Move Spring Boot + PostgreSQL onto a **2 vCPU / 4 GB RAM VPS** (Hetzner, DigitalOcean, AWS Lightsail, or GCP) and run self-hosted regional **OSRM + Photon** containers alongside a commercial tile plan (or self-hosted PMTiles on Cloudflare R2). Cold starts drop to **zero**, routing drops under **50 ms**, public rate limits disappear, licensing is clean for commercial use, and a single node comfortably handles **200–500+ live vehicles and 1,000–3,000+ concurrent viewers**.
- **City / Enterprise Scale ($100–$300+/month):** Add **Redis Pub/Sub** behind the existing `FleetBroadcaster` / `RideLocationBroadcaster` seam, run multiple Spring Boot instances behind a load balancer with managed PostgreSQL, and host a dedicated routing/tile cluster.
