<p align="center">
  <img src="https://img.shields.io/badge/RideWise-GPS%20Tracking%20Platform-0ea5e9?style=for-the-badge&logo=mapbox&logoColor=white" alt="RideWise Badge"/>
</p>

<h1 align="center">🛣️ RideWise</h1>

<p align="center">
  <b>A Universal GPS-Based Ride Tracking & Fleet Management Platform</b><br/>
  <i>Create. Track. Monitor. — For any organisation, any purpose.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot%203.4-6DB33F?logo=springboot" alt="Spring Boot"/>
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Maps-Leaflet%20%2B%20OpenStreetMap-199900?logo=leaflet" alt="Leaflet"/>
  <img src="https://img.shields.io/badge/Styling-Tailwind%20CSS-38BDF8?logo=tailwindcss" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Build-Vite%208-646CFF?logo=vite" alt="Vite"/>
</p>

---

## 👨‍💻 Creator

| | |
|---|---|
| **Name** | **Gokula Kumaran S** |
| **Department** | CSBS (Computer Science & Business Systems) |
| **Institution** | Ramco Institute of Technology |
| **Hackathon** | BharathCode |

---

## 📖 Table of Contents

- [About RideWise](#-about-ridewise)
- [What It Does Today](#-what-it-does-today)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Key Design Decisions](#-key-design-decisions)
- [Future Vision](#-future-vision--the-big-idea)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 About RideWise

**RideWise** is a full-stack web application that lets **anyone** create, manage, and track rides in real time using GPS — all from a single platform.

Think of it as a **universal ride management system**: instead of building separate tracking apps for every organisation, RideWise provides a single mechanism where **any entity** — a college, a car-travel company, an IT firm, a delivery fleet — can spin up their own ride workspace, add members, assign roles, and monitor everything on a live map.

> **One app. Every purpose. Every organisation.**

---

## ✅ What It Does Today

### 🔐 Authentication & Onboarding
- Email + password signup/login with **BCrypt** password hashing
- Session-based authentication stored in **PostgreSQL** (survives backend restarts)
- "Remember me" with persistent cookies (`Max-Age: 30 days`)
- Post-signup onboarding flow — a username (required), then mobile, city and location (all optional)
- Protected routes with auth guards; an expired session returns you to the login page with a notice
- Repeated wrong passwords lock that login for a few minutes (brute-force protection)
- A suspended account loses access immediately, even with an open session

### 🗺️ Ride Planning & Turn-by-Turn Navigation
- **Plan a ride in three steps** — start (your location or a searched place), destination, review
- **Forgiving place search** — typos and extra words still find the place, nearby places are listed first
- **Route options** — up to three alternative routes to choose from, each with distance and time
- **Live navigation** — the next turn with a distance that counts down as you ride ("300 m → 80 m → Now"),
  the turn after it, the road you are on, time left, distance left and arrival time
- **Off-route help** — leave the route and a purple line shows the way back to a point *ahead* on it,
  with its own turn instructions; it shrinks as you follow it and disappears when you are back
- **Spoken directions** — each turn is read aloud (can be muted on the map or in Settings)
- **Arrival** — the map tells you when you have arrived and offers to end the ride
- **Map styles** — Automatic (matches the theme), Standard, Dark, Satellite, Terrain, Cycling
- **Whole-route view / re-center / zoom** controls, and a list of all directions
- **Screen stays awake** while you navigate; the ride can be minimised to a small pill
- **Ride history** — every ride with the distance really ridden, the time it took, and its route on the map
- **Picks up where you left off** — reopening an active ride restores your progress and ridden distance

### 👥 Rider Community & Connections
- **Search riders** by username or email
- **Riders near me** — riders within 50 km of the location you chose to save, with the distance to each
- **Add / Remove connections** — build your rider network
- **Privacy by default** — other riders never receive your coordinates or phone number, and see your
  email only as a hint (`r•••@example.com`) until you are connected
- **"Public profile" switch** — turn it off and riders you are not connected with cannot find you

### 🛡️ Admin Panel
- **Dashboard** with platform-wide stats (total users, rides, active rides)
- **User management** — search, paginate, view details, enable/disable accounts
- **Ride management** — filter by status/type, paginate, view full ride details with participants
- Role-based access control (`USER` / `ADMIN`) enforced on every admin endpoint

### 🔔 Notifications
- In-app notification system with unread counts
- Mark individual or all notifications as read

### 🎨 Theming & UX Polish
- **4 themes** — Light, Dark, Warm, Midnight — with full token-based styling
- One monochrome icon family and one set of buttons/chips across every screen
- Responsive layout — desktop sidebar + mobile bottom navigation (fits 320 px phones)
- **Installable** — a web-app manifest lets phones add RideWise to the home screen
- Accessibility settings — text size, reduced motion, high contrast
- Password strength meter on signup

### 🎙️ Voice Commands
- Browser-native voice control from the mic button — say "start", "history", "riders", "dark" or "light"
- (Separate from the **spoken directions** on the ride map, which read each turn aloud)

### 🌐 Offline Resilience
- When the backend **cannot be reached**, rides are read from and written to a local cache; a ride ended
  offline is sent to the server the next time it answers
- A refusal from the server (not allowed, not found) is never mistaken for "offline"
- An expired session sends you to the login page with an explanation instead of failing silently
- GPS tracking and navigation run fully in the browser

### 👥 Group Rides
- **Ride participants** with roles (`admin`, `member`) and statuses (`active`, `left`, `completed`)
- Invite your connections when creating the ride, or add them from the map while riding
- **Live rider locations** — the admin is always visible to the group, members opt in; real GPS only,
  shared over an authenticated WebSocket
- Riders who leave the route are marked **Off route** and get their own way-back line on everyone's map
- Everyone is told at once when a rider joins or leaves, and when the admin ends the ride

### 🏢 Organizations & Live Fleet Tracking
One account does everything: ride for yourself, **follow** an organization's vehicles, **drive** for one,
**run** one. What you may do is decided per organization, never by an "account type".

**For people waiting for a vehicle**
- **Find** public organizations by name; **open a private one** with its code *and* access password
  (a wrong code and a wrong password give the same answer, and guessing is slowed down)
- Every vehicle with what it is doing right now — live, signal lost, not on a trip — on a list and a map
- **Track one vehicle**: its position gliding along the route, **time and distance left, arrival time**,
  each stop with when the vehicle reaches it, how full it is, the driver's name
- **"Tell me when it's near"** — pick a stop (or where you stand) and a distance; the server notifies you
  once per trip, even with the app closed
- The screen keeps following the *vehicle*: when its next trip starts, it goes live again by itself
- **Announcements** from the organization (delays, route changes) as notifications

**For drivers**
- Start a trip in three taps: vehicle → saved route (or any destination) → start
- **One vehicle, one driver, one trip** — a vehicle that is out shows who has it; the database itself
  refuses a second trip even when two drivers tap *Start* in the same instant
- The full navigation screen (turn-by-turn, voice, the purple way back) plus **seats** (free / filling up /
  full), an **SOS** button that alerts the admins, and a warning when over the organization's speed limit
- The trip is tracked **app-wide**: the position keeps flowing whatever page is open, with a floating
  "you are driving BUS-01" pill; only *End trip* stops it

**For the organization's admins** (`/org-admin/:orgId`)
- **Overview** — on a trip now, trips and distance today, emergencies first, an activity log
- **Live map** — the whole fleet, the selected vehicle's route, call the driver, end a forgotten trip
- **Vehicles** — add, edit, Active / Servicing / Repair, retire (history is kept)
- **Routes** — saved routes **with stops**, planned as a road *through* the stops in order
- **People** — invite by username or email (they must accept), roles Owner / Admin / Driver / Viewer,
  suspend, remove, hand the ownership over; for private organizations, who holds access
- **Trips** — history with filters, **replay** of the path really driven, CSV export
- **Announce**, **Statistics** (per day / driver / vehicle, speeding counted by the server), **Settings**
  (public ⇄ private, access password, speed limit, show drivers' numbers, delete)

**For RideWise's own admins** — every organization: **verify** it (green tick, listed first) or
**suspend** it (trips end, tracking stops at once).

**What keeps it honest**
- Distance, top speed and speeding are **measured by the server** from the positions — never taken from
  what a phone claims
- No position for 45 seconds → the vehicle is shown as *signal lost* where it was last seen, and no
  arrival time is invented
- A trip nobody ended is ended automatically once its driver's phone has been silent for 30 minutes
  (`ridewise.fleet.session-timeout-minutes`), and the vehicle is free again
- A driver's phone number is visible to the organization's admins only, unless the organization
  switches "show driver phone" on

---

## 🛠️ Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | SPA with HMR, dev proxy to backend |
| **Styling** | Tailwind CSS 3 | Utility-first, fully themed |
| **Routing** | React Router DOM 7 | Client-side routing with protected routes |
| **Maps** | Leaflet + react-leaflet | OpenStreetMap, Esri imagery, CyclOSM tiles — **no API key needed** |
| **Backend** | Spring Boot 3.4 (Java 21) | REST API, session auth, BCrypt |
| **Database** | PostgreSQL | Persistent data with JDBC sessions |
| **ORM** | Spring Data JPA + Hibernate | Auto-generated tables from entities |
| **Place search** | Photon + Nominatim (OpenStreetMap data) | Typo-tolerant suggestions with a strict fallback; free, no API key |
| **Routing Engine** | OSRM (two public servers) | Road routing with automatic fail-over, no API key |
| **Tests** | JUnit + MockMvc on in-memory H2 · `node --test` | Backend tests never touch PostgreSQL; the navigation engine is unit-tested |
| **Build** | Maven Wrapper | Zero-install build (`./mvnw`) |

> **Zero third-party API keys are required.** All external services used are free and open.

---

## 🏗️ Architecture

```
Browser (React SPA)
    │
    │  fetch('/api/...')
    ▼
Vite Dev Server ──proxy /api/*──▶  Spring Boot (port 8080)
                                        │
                                  ┌─────┴─────┐
                                  │ Controllers│
                                  └─────┬─────┘
                                        │
                                  ┌─────┴─────┐
                                  │  Services  │
                                  └─────┬─────┘
                                        │
                                  ┌─────┴──────┐
                                  │Repositories │
                                  └─────┬──────┘
                                        │
                                  ┌─────┴─────┐
                                  │ PostgreSQL │
                                  └───────────┘
```

**Key points:**
- Frontend uses **relative paths** (`/api/auth/login`), Vite proxies to `:8080` — zero CORS issues in dev
- Sessions are stored in **PostgreSQL** via `spring-session-jdbc`, so logins survive backend restarts
- Passwords are **BCrypt-hashed** — plain text never reaches the database
- GPS location updates are sent every ~1.5 seconds during an active ride

---

## 📁 Project Structure

```
RideWise/
│
├── backend/ridewise/                    # Spring Boot (Maven)
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd                 # Maven wrapper
│   └── src/main/
│       ├── java/vehicle/ridewise/
│       │   ├── RideWiseApplication.java # Entry point
│       │   ├── config/
│       │   │   ├── SecurityConfig.java  # BCrypt + Spring Security
│       │   │   ├── WebConfig.java       # CORS + session check for /api/**
│       │   │   ├── WebSocketConfig.java # /ws/rides + /ws/fleet
│       │   │   ├── AllowedOrigins.java  # The one list of allowed websites (REST + socket)
│       │   │   ├── JacksonConfig.java   # Timestamps as UTC ("…Z")
│       │   │   ├── UserStatusCache.java # Suspended accounts lose access at once
│       │   │   ├── DataInitializer.java # Default admin seeder
│       │   │   ├── SessionAuthInterceptor.java
│       │   │   └── GlobalExceptionHandler.java
│       │   ├── controller/
│       │   │   ├── AuthController.java         # /api/auth/*
│       │   │   ├── RideController.java         # /api/rides/*
│       │   │   ├── RidersController.java       # /api/riders/*
│       │   │   ├── AdminController.java        # /api/admin/*
│       │   │   ├── NotificationController.java # /api/notifications/*
│       │   │   ├── OrganizationController.java # /api/organizations/* (orgs, people, fleet, insight)
│       │   │   └── VehicleSessionController.java # /api/vehicle-sessions/* + /api/vehicle-alerts
│       │   ├── entity/                  # JPA entities → DB tables
│       │   │   ├── User.java
│       │   │   ├── Ride.java
│       │   │   ├── Connection.java
│       │   │   ├── LocationUpdate.java
│       │   │   ├── RideParticipant.java
│       │   │   ├── Notification.java
│       │   │   ├── Organization.java · OrgMember.java · OrgAccess.java
│       │   │   ├── Vehicle.java · OrgRoute.java
│       │   │   ├── VehicleSession.java · VehicleSessionRoute.java · VehicleSessionPoint.java
│       │   │   └── VehicleAlert.java · OrgAnnouncement.java · OrgAuditLog.java
│       │   ├── dto/                     # Request/Response objects (OrgDtos.java = the fleet API contract)
│       │   ├── repository/              # Spring Data JPA repos
│       │   ├── service/                 # Business logic (+ login throttling, stale-ride sweeper)
│       │   │                            #   OrgGuard = every "may this person do that here?" rule, once
│       │   │                            #   VehicleSessionService = trips: the lock, positions, SOS, ending
│       │   ├── websocket/               # Live sockets: group rides, and the fleet (FleetBroadcaster)
│       │   └── exception/               # Custom exceptions
│       └── resources/
│           └── application.properties   # DB, port, session config
│   └── src/test/                        # Tests + an application.properties for in-memory H2
│
├── frontend/                            # React + Vite
│   ├── package.json
│   ├── vite.config.js                   # Proxy /api/* → :8080
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx                     # React entry
│       ├── App.jsx                      # Router + routes
│       ├── index.css                    # Global + theme styles
│       ├── context/
│       │   ├── AuthContext.jsx          # Global auth state
│       │   ├── OrgContext.jsx           # Which organizations am I part of? (drives the navigation)
│       │   └── DriverTripContext.jsx    # The vehicle trip I am driving — tracked app-wide
│       ├── services/
│       │   ├── http.js                  # One fetch wrapper: errors, offline, expired session
│       │   ├── navigation.js            # Navigation engine (pure, unit-tested)
│       │   ├── routingApi.js            # Place search, routing, formatting
│       │   ├── locationService.js       # GPS wrapper (throttled, status reporting)
│       │   ├── rideApi.js               # Ride CRUD + offline fallback
│       │   ├── rideSocket.js            # Live group-ride socket client
│       │   ├── ridersApi.js             # Connections API
│       │   ├── adminApi.js              # Admin endpoints
│       │   ├── notificationApi.js       # Notifications
│       │   ├── orgApi.js                # Organizations, fleets, vehicle trips
│       │   └── fleetSocket.js           # Live fleet socket client (watch + drive)
│       └── pages/
│           ├── Home.jsx                 # Main dashboard
│           ├── Riders.jsx               # Community & connections
│           ├── Account.jsx              # Profile management
│           ├── Settings.jsx             # Theme, voice, preferences
│           ├── Onboarding.jsx           # Post-signup setup
│           ├── landing-page/Login.jsx   # Login + Signup
│           ├── admin/                   # Admin dashboard, users, rides, organizations
│           ├── org/                     # Organizations hub, organization page, TrackVehicle,
│           │   │                        #   Driver, DriverSession, CreateOrganization, OrgAdmin
│           │   └── admin/               # The nine tabs of /org-admin/:orgId
│           ├── hooks/                   # useTheme, useNavigation, useRideAssist (voice, wake lock)…
│           └── components/
│               ├── layout/              # Sidebar, TopBar, MobileNav
│               ├── ride/               # RideMap, ActiveRideOverlay, ManeuverBanner, RideStatsSheet…
│               ├── org/                 # FleetMapView, TripReplay, TripPill, kit (forms, dialogs), rows
│               ├── shared/              # Modals, protected routes, voice
│               └── ui/                  # Button, Icon, styles
│   └── tests/                           # node --test (navigation engine, place search, fleet logic)
│
└── README.md                            # ← You are here
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| **Java** | 21 LTS or later |
| **Node.js** | 18+ |
| **PostgreSQL** | 14+ (running on `localhost:5432`) |

### 1. Set up the Database

```sql
CREATE DATABASE ridewise;
```

### 2. Configure Environment Variables (Recommended)

```bash
# Database
export DB_USERNAME=postgres
export DB_PASSWORD=your_secure_password
export DATABASE_URL=jdbc:postgresql://localhost:5432/ridewise

# Admin account (optional — defaults are created if not set)
export RIDEWISE_ADMIN_EMAIL=admin@ridewise.com
export RIDEWISE_ADMIN_PASSWORD=YourSecureAdminPassword
```

### 3. Start the Backend

```bash
cd backend/ridewise
./mvnw spring-boot:run       # Linux / macOS
mvnw.cmd spring-boot:run     # Windows
```

Backend runs at: `http://localhost:8080`

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at: `http://localhost:5173`

> **Both processes must be running.** The Vite dev server proxies `/api/*` **and**
> `/ws/*` to `localhost:8080` (`/ws` with `ws: true`, so the ride socket's
> WebSocket upgrade reaches Spring Boot).

### 5. Run the tests

```bash
cd backend/ridewise
mvnw.cmd test                 # Windows   (./mvnw test on Linux / macOS)

cd frontend
npm test                      # navigation engine + place search + fleet logic
npm run lint
```

The backend tests run on a throw-away **in-memory H2 database**
(`src/test/resources/application.properties`) — they never connect to your
PostgreSQL database, so they cannot change or delete real data.

`OrgFleetTests` covers the organization platform end to end over the real REST API and the
`/ws/fleet` socket: who may see a private organization, roles and invitations, the
one-trip-per-vehicle-and-driver lock, server-measured distance and speeding, every way a trip
ends, alerts, announcements, suspension, and that live events reach only people allowed to see them.

The same file gives you a zero-setup backend when you just want to try the app
without PostgreSQL (empty database, gone when it stops):

```bash
mvnw.cmd spring-boot:test-run
```

### 6. Environment variables

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | `jdbc:postgresql://localhost:5432/ridewise` | **Not set locally** → the local database is used. Set on Render → the cloud database is used. |
| `DB_USERNAME` / `DB_PASSWORD` | backend | `postgres` / local password | Only needed if the credentials are not part of `DATABASE_URL` |
| `VITE_API_URL` | frontend | `http://localhost:8080` | Dev proxy target. Leave unset locally; point it at the backend host to test against a deployed backend |
| `VITE_WS_URL` | frontend | *(page's own origin)* | Only set this to talk to a backend on a different domain (e.g. `wss://ride-wise-kif0.onrender.com`) |
| `ridewise.allowed-origins` | backend | Cloudflare Pages + Netlify + tunnels + `http://localhost:[*]` | Websites allowed to call the API **and** open `/ws/rides` (origin patterns, comma-separated). Local development works on any port |
| `ridewise.websocket.allowed-origins` | backend | *(same as above)* | Optional: a different list for the socket only |
| `ridewise.rides.auto-end-hours` | backend | `48` | A ride still active this long after it was created is ended automatically. `0` switches this off |

### 7. Test the live group-ride location with two devices

1. Start PostgreSQL, then the backend (`mvnw.cmd spring-boot:run`) and the
   frontend (`npm run dev`).
2. **Device A** — `http://localhost:5173` → sign up/log in → *Riders* → connect to
   Rider B → start a **Group** ride (pick origin/destination) → *Start Ride*.
3. **Device B** — sign in as Rider B (a second browser, or a normal + private
   window so the two sessions do not share a cookie) → open the same group ride
   → the riders panel shows A.
4. The ride admin (A) is always visible to the group. On **device B** press
   **Share my location** and allow the browser's location permission. Each
   marker must now appear on the other device's map and move on every GPS fix
   (throttled to 1.5 s).
5. Press the button again on device B → B's marker disappears on A
   immediately, and B shows *No GPS* in the riders panel.
6. Deny the location permission (or turn it off in the browser) → the map says
   that location access is blocked and **no marker is ever faked**; other
   riders show that rider as *No GPS*.
7. Close the map, end the ride, or leave the ride → `watchPosition` is
   cancelled, the socket closes, and the stored position is deleted. Nothing
   is tracked after the tab is closed.

### 8. Production notes (Render + Cloudflare Pages)

- The frontend is static and served by Cloudflare Pages; `functions/api/[[path]].js`
  proxies REST calls and `functions/ws/[[path]].js` proxies the live socket to
  the Render backend, so the browser always stays on its own origin and the
  first-party session cookie keeps working.
- **A `502 Bad Gateway` is a backend-availability problem, not a bug in the
  frontend.** Check in this order:
  1. Open `https://<your-backend>/api/auth/me` in a browser. A JSON
     `401 {"message":"Authentication required"}` means the app is **up** (a
     502 there means Render is asleep/restarting — the free tier sleeps after
     ~15 idle minutes, so add a cron/monitor that pings this URL).
  2. Render → **Events**: the newest deploy must be *Live*. A failed build
     keeps the previous image, so features added in the last commit will be
     missing even though the site still works.
  3. `GET /ws/rides` on the backend must **not** return `404` — a 404 means the
     deployed build predates this feature. (`200`/`403` are fine: Spring just
     refuses the upgrade for a request that is not a signed-in browser.)

---

## 📡 API Reference

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Log in with email + password |
| `GET` | `/api/auth/me` | Get current session user |
| `POST` | `/api/auth/logout` | Invalidate session |
| `PATCH` | `/api/auth/profile/{id}` | Update profile fields |

### Rides — `/api/rides`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rides/` | Create a new ride |
| `GET` | `/api/rides/user/{userId}` | All rides of the user, own and joined. `?summary=true` leaves out the heavy route data (used for lists) |
| `GET` | `/api/rides/user/{userId}/active` | Get active rides |
| `GET` | `/api/rides/{rideId}` | One ride with its route (`?summary=true` for status only) |
| `PATCH` | `/api/rides/{rideId}/status` | End a ride (`completed` / `cancelled`), with the distance really ridden. Owner / group admin only |
| `DELETE` | `/api/rides/{rideId}` | Delete a ride |
| `POST` | `/api/rides/{rideId}/location` | Submit GPS location update |
| `GET` | `/api/rides/{rideId}/location` | Get GPS track for ride |
| `GET` | `/api/rides/{rideId}/live-locations` | Current position of every member sharing a live location |
| `DELETE` | `/api/rides/{rideId}/live-location` | Stop sharing my live position (removes my marker) |
| `GET` | `/api/rides/{rideId}/participants` | Active participants of a group ride |
| `POST` | `/api/rides/{rideId}/participants` | Admin adds one of their connections to the ride |
| `PATCH` | `/api/rides/{rideId}/participants/{userId}/status` | A member leaves the ride (`left`) |

### Live location socket — `/ws/rides`

Authenticated with the same session cookie as the REST API. One socket
per ride; the server re-verifies group membership on **every** message and
broadcasts only to the members of that ride.

| Direction | Message |
|---|---|
| client → server | `{ "type": "subscribe", "rideId": 12 }` |
| client → server | `{ "type": "location", "rideId": 12, "lat": 13.08, "lng": 80.27, "accuracy": 8 }` |
| client → server | `{ "type": "stop", "rideId": 12 }` — rider stopped sharing |
| client → server | `{ "type": "unsubscribe" }` |
| server → client | `{ "type": "connected", "userId": .. }` / `{ "type": "subscribed", "rideId": .. }` |
| server → client | `{ "type": "snapshot", "rideId": .., "locations": [ ... ] }` — sent on subscribe (map open) |
| server → client | `{ "type": "location", "location": { userId, lat, lng, accuracy, updatedAt } }` |
| server → client | `{ "type": "location-cleared", "rideId": .., "userId": .. }` |
| server → client | `{ "type": "participants-changed", "rideId": .. }` — a rider joined or left |
| server → client | `{ "type": "ride-ended", "rideId": .., "status": .., "endedBy": .. }` — the ride is over |
| server → client | `{ "type": "error", "message": ".." }` |

### Riders — `/api/riders`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/riders/search?query=` | Search riders (top 20) |
| `GET` | `/api/riders/nearby` | Riders within 50 km of my saved location, nearest first (409 until a location is saved) |
| `GET` | `/api/riders/connections` | My connections |
| `POST` | `/api/riders/add` | Add a connection |
| `POST` | `/api/riders/remove` | Remove a connection |

Every riders endpoint acts for the logged-in session — no user id is sent. Other riders come back
without coordinates or phone number, and with a masked email unless you are connected.

### Admin — `/api/admin` *(requires ADMIN role)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Platform stats |
| `GET` | `/api/admin/users` | Paginated user list |
| `GET` | `/api/admin/users/{id}` | User detail |
| `PATCH` | `/api/admin/users/{id}/status` | Enable/disable user |
| `GET` | `/api/admin/rides` | Paginated ride list |
| `GET` | `/api/admin/rides/{id}` | Ride detail with participants |
| `GET` | `/api/admin/organizations` | Every organization (search, pages) |
| `PATCH` | `/api/admin/organizations/{id}` | Verify · suspend · restore |

### Organizations — `/api/organizations`

Who may do what is decided per organization (`OrgGuard`): **view** (anyone for a public one; members and
people who entered code + password for a private one) · **drive** (active members except viewers) ·
**manage** (owner, admins) · **own** (the owner).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/me` | My organizations at a glance: managed, driving, invitations, active trip |
| `GET` | `/search?q=` | Public organizations by name |
| `POST` | `/access` | Open a private organization `{ orgCode, password }` |
| `GET` | `/saved` · `PUT`/`DELETE` `/{id}/saved` | My list |
| `POST` | `/` · `GET`/`PATCH`/`DELETE` `/{id}` | Create · read · edit · delete (owner) |
| `PUT` | `/{id}/access-password` | New access password (optionally revoking everyone's access) |
| `GET` | `/{id}/access` · `DELETE` `/{id}/access/{userId}` | Who holds access · revoke |
| `GET`/`POST` | `/{id}/members` | List · invite `{ identifier, role }` |
| `PATCH`/`DELETE` | `/{id}/members/{memberId}` | Role, suspend/reactivate · remove |
| `POST` | `/invitations/{memberId}/accept` · `/reject` | Answer an invitation |
| `POST` | `/{id}/leave` · `/{id}/transfer` | Leave · hand the ownership over |
| `GET`/`POST` | `/{id}/vehicles` | The fleet with running trips · add a vehicle |
| `GET`/`PATCH`/`DELETE` | `/{id}/vehicles/{vehicleId}` | Tracking detail · edit · remove (retires when it has history) |
| `PUT` | `/{id}/vehicles/{vehicleId}/status` | `ACTIVE` · `IN_SERVICE` · `REPAIR` · `RETIRED` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/{id}/routes[/{routeId}]` | Saved routes with stops |
| `GET` | `/{id}/trips` | Trip history (filters, pages) |
| `GET`/`POST`/`DELETE` | `/{id}/announcements[/{id}]` | Announcements |
| `GET` | `/{id}/dashboard` · `/analytics?days=` · `/activity` | The admins' overview (`tz` = browser offset in minutes) |

### Vehicle trips — `/api/vehicle-sessions`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Start a trip `{ orgId, vehicleId, routeId }` or with a custom destination |
| `GET` | `/active` · `/mine` | The trip I am driving (204 when none) · my history |
| `POST` | `/{id}/position` | One GPS fix (HTTP twin of the socket message) |
| `PUT` | `/{id}/sos` · `/{id}/crowd` | Emergency on/off · seats |
| `POST` | `/{id}/stop` · `/{id}/end` | Driver ends · admin ends |
| `GET` | `/{id}/track` | The trip with the path it really took |
| `PUT`/`DELETE` | `/api/vehicle-alerts[/{vehicleId}]` | "Tell me when it's near" |

### Live fleet socket — `/ws/fleet`

```
client → { "type": "watch-vehicle", "vehicleId": 12 }      follow one vehicle
client → { "type": "watch-org", "orgId": 3 }               follow a whole fleet
client → { "type": "position", "sessionId": 40, "lat": …, "lng": …, "accuracy": …, "speed": …, "heading": … }
client → { "type": "alive", "sessionId": 40 }              driver's screen open, no GPS signal
server → position · session-started · session-ended · sos · crowd · vehicle-changed · announcement
server → access-changed                                    you may no longer watch this
```

People watch a **vehicle** or an **organization**, never a trip — so a watcher is still there when the
vehicle's next trip starts. Every watch is checked like the REST API.

### Notifications — `/api/notifications`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | Get user's notifications |
| `GET` | `/api/notifications/unread-count` | Unread count |
| `PATCH` | `/api/notifications/{id}/read` | Mark one as read |
| `PATCH` | `/api/notifications/read-all` | Mark all as read |

---

## 🗄️ Database Schema

```
┌──────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│      users       │     │        rides          │     │   connections      │
├──────────────────┤     ├──────────────────────┤     ├────────────────────┤
│ id          (PK) │◄──┐ │ id             (PK)  │     │ id            (PK) │
│ email            │   │ │ user_id        (FK)  │──┐  │ user_id       (FK) │
│ password (hash)  │   │ │ from_name / lat / lng│  │  │ connected_user_id  │
│ username         │   │ │ dest_name / lat / lng│  │  │ created_at         │
│ mobile           │   │ │ route_coordinates    │  │  └────────────────────┘
│ address          │   │ │ route_steps          │  │
│ lat / lng        │   │ │ distance_meters      │  │  ┌────────────────────┐
│ role             │   │ │ duration_seconds     │  │  │ ride_participants  │
│ enabled          │   │ │ ride_type            │  │  ├────────────────────┤
│ created_at       │   │ │ status               │  │  │ id            (PK) │
└──────────────────┘   │ │ created_at / ended_at│  ├─▶│ ride_id       (FK) │
                       │ └──────────────────────┘  │  │ user_id       (FK) │
                       │                           │  │ role (admin/member)│
┌──────────────────┐   │ ┌──────────────────────┐  │  │ status             │
│  notifications   │   │ │  location_updates    │  │  │ joined_at          │
├──────────────────┤   │ ├──────────────────────┤  │  └────────────────────┘
│ id          (PK) │   │ │ id             (PK)  │  │
│ user_id     (FK) │───┘ │ ride_id        (FK)  │──┘
│ message          │     │ lat / lng            │
│ type             │     │ captured_at          │
│ read             │     │ received_at          │
│ created_at       │     └──────────────────────┘
└──────────────────┘
```

> **Live group-ride positions — `user_locations`**
> `id · user_id (UNIQUE) · ride_id · lat · lng · accuracy · updated_at`
> One row per user, **updated in place** on every accepted GPS fix (never a row
> per tick), which is what makes live tracking cheap. The per-tick ride history
> is a different table (`location_updates`).

> **Organizations and fleets** (created automatically on the next backend start)
>
> | Table | What it holds |
> |---|---|
> | `organizations` | name, kind, `org_code` (unique, `RW-XXXXXX`), visibility, access-password **hash**, speed limit, verified, status |
> | `org_members` | one row per person per organization: role `OWNER` / `ADMIN` / `DRIVER` / `VIEWER`, status `PENDING` / `ACTIVE` / `SUSPENDED` / `REMOVED` |
> | `org_access` | "on my list": a saved public organization, or a private one opened with its password |
> | `vehicles` | code (unique per organization), kind, registration, seats, status, last known position |
> | `org_routes` | saved routes: geometry, turn-by-turn steps, stops |
> | `vehicle_sessions` | trips: vehicle, driver, route, latest position, measured distance / top speed / speeding, SOS, seats. `active_vehicle_key` and `active_driver_key` are **unique** and set only while the trip runs — that is the lock |
> | `vehicle_session_routes` | the planned road of a trip (its own copy; kept 7 days after it ends) |
> | `vehicle_session_points` | the path really driven, thinned out (replay; kept 90 days) |
> | `vehicle_alerts` | "tell me when it's near": one place and distance per person per vehicle |
> | `org_announcements` · `org_audit_logs` | announcements · the activity log |

---

## 🧠 Key Design Decisions

| Decision | Why |
|---|---|
| **No third-party API keys** | Leaflet, OpenStreetMap tiles, Photon, Nominatim and OSRM are all free & open — zero vendor lock-in |
| **PostgreSQL-backed sessions** | Login sessions survive backend restarts (critical for free-tier deploys) |
| **BCrypt password hashing** | Industry-standard; plain-text passwords never stored |
| **Vite proxy** | Frontend calls `/api/*` with relative paths — no CORS issues in development |
| **Offline fallback** | Rides are cached to `localStorage` only when the backend is truly unreachable; a server refusal is shown as what it is |
| **Navigation as a pure engine** | `services/navigation.js` has no React and no network in it: a GPS fix goes in, the state of the ride comes out. That makes it testable (`npm test`) and predictable |
| **Segment projection, not nearest point** | The rider is placed on the nearest *stretch* of the route, with an accuracy-scaled threshold and hysteresis, so GPS noise neither triggers nor hides "off route" |
| **UTC everywhere** | Timestamps are stored and sent as UTC (`…Z`); the browser shows them in the rider's local time |
| **Tests on in-memory H2** | `mvnw test` can never touch (or wipe) the real PostgreSQL database |
| **Throttled GPS** | Browser GPS can fire every 100ms; the app throttles to once per 1.5s to save battery |
| **Latest-position table** | `user_locations` holds one row per user and is updated in place, so live tracking never floods the database |
| **Raw WebSocket (no STOMP)** | One `/ws/rides` endpoint, no extra client dependency; the handshake reuses the existing session cookie, so there is a single auth mechanism |
| **Same-origin socket** | The browser connects to its own origin and a Cloudflare Pages function forwards the upgrade to the backend — a first-party cookie is always sent, unlike a cross-site socket |
| **No Lombok** | Removed for Java 21+ compatibility — all getters/setters are hand-written |
| **Roles per organization, not per account** | The same person can own one organization, drive for another and simply ride. There is no "organization account" to get stuck in |
| **The vehicle lock lives in the database** | Two unique columns make a second running trip for a vehicle (or a driver) impossible, even when two requests arrive in the same instant. The check in code only produces the friendly message |
| **Watch the vehicle, not the trip** | A trip ends and the next begins; somebody following "Bus 01" must simply see it go live again |
| **Positions: broadcast from memory, store every 5 s** | Ten people or ten thousand following a bus cost the database the same. Statistics are added up inside the database, never row by row |
| **The server measures** | Distance, top speed and speeding come from the accepted fixes — a modified app cannot report a nicer trip |
| **ETA is computed where it is shown** | The browser runs the vehicle's fixes through the same navigation engine as a rider's own position, so following a bus needs no routing request per watcher |
| **Private means private** | No lookup by code, one generic error, attempts rate-limited, access revocable, and a live map that loses access is cut off at once |

---

## 🔮 Future Vision — The Big Idea

RideWise is not just a personal ride tracker. The vision is to make it a **universal, multi-tenant GPS tracking platform** that any organisation can adopt — without needing to build a separate system.

> **Where this stands:** the organization platform described below is **built** — organizations,
> roles, vehicles, routes with stops, driver trips, live tracking with arrival times, alerts,
> announcements, statistics (see [Organizations & Live Fleet Tracking](#-organizations--live-fleet-tracking)).
> The table at the end lists what is still ahead.

### 🎓 College Transport

> A college admin creates a ride for each bus route, adds students as members with the bus number. Students open the app and see their bus's live route on the map. The college admin monitors **all buses and drivers in real time** from a single dashboard.

### 🚗 Car Travel Companies

> A car-travel company creates rides under their company name, adds drivers with car details, and monitors all driver locations live. Drivers see their assigned destination on the map and can update waypoints with their assigned privileges. Passengers can track their ride in real time.

### 🏢 IT Companies & Corporates

> An IT company uses RideWise to monitor employee commute vehicles, track field-staff GPS activity, and optimise transport routing — all through the same app with role-based access.

### 🔑 How It Will Work

```
┌────────────────────────────────────────────────────────┐
│                    RideWise Platform                    │
├──────────┬──────────┬──────────────┬──────────────────┤
│ College  │ Car      │ IT Company   │ Your             │
│ Transport│ Travels  │ Fleet        │ Organisation     │
├──────────┼──────────┼──────────────┼──────────────────┤
│ Admin    │ Admin    │ Admin        │ Admin            │
│ Drivers  │ Drivers  │ Employees    │ Members          │
│ Students │ Passengers│ Managers    │ Custom Roles     │
└──────────┴──────────┴──────────────┴──────────────────┘
```

Each organisation gets:
- **Their own workspace** with custom branding
- **Role-based access** — Admin, Driver, Member, Viewer
- **Live GPS dashboard** — monitor all members on a single map
- **Ride creation & assignment** — admins create rides, assign drivers & members
- **Member self-service** — members view their assigned routes, track rides, edit locations (within their privilege)
- **Activity logs** — GPS-based tracking of device activity and ride history

### 📋 Planned Features

| Feature | Status |
|---|---|
| **Multi-tenant workspaces** | ✅ Built — organizations, public or private |
| **Roles & permissions** | ✅ Built — Owner, Admin, Driver, Viewer, per organization |
| **Live fleet map** | ✅ Built — every vehicle on one map, live |
| **Driver trips with vehicle locking** | ✅ Built |
| **"Near me" alerts** | ✅ Built — a place and a distance per vehicle. Free-form zones (enter / leave a drawn area) are next |
| **Analytics dashboard** | ✅ Built — per day, driver and vehicle; speeding counted by the server |
| **Export** | ✅ CSV of trips. PDF reports are next |
| **Driver schedules** | Planned — timetables per route, "expected at 7:40" |
| **Push notifications** | Planned — today notifications appear in the app; web push would reach a closed browser |
| **Organization logo** | Planned — needs file storage; an initials tile is used today |
| **Route optimisation** | Planned — suggest the best order of stops |
| **Several backend servers** | Planned — live state is held in one server's memory; more than one instance needs a shared message bus |
| **Mobile app (PWA → Native)** | Installable today (web-app manifest); a native app is the way to keep GPS running with the screen off |

---

## 🤝 Contributing

This project is under active development. Contributions, suggestions, and feedback are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project was built for the **BharathCode Hackathon**.

---

<p align="center">
  Built with ❤️ by <b>Gokula Kumaran S</b><br/>
  CSBS · Ramco Institute of Technology
</p>
