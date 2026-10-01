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
  <img src="https://img.shields.io/badge/Maps-MapLibre%20GL-396CB2?logo=maplibre" alt="MapLibre"/>
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
- Post-signup onboarding flow — collects username, mobile, address, and GPS location
- Protected routes with auth guards

### 🗺️ Ride Management & Live GPS Tracking
- **Create rides** — pick origin & destination with location search (Nominatim geocoding)
- **Route planning** — road-network routing via OSRM with turn-by-turn directions
- **Live GPS tracking** — real-time device GPS plotted on an interactive map
- **Multiple map styles** — Default, Cycle, Dark, Satellite, Terrain tile layers
- **Active ride overlay** — full-screen live map with speed, distance, and direction indicators
- **Ride history** — view all past rides with distance, duration, and route replay on the map

### 👥 Rider Community & Connections
- **Search riders** by username or email
- **Nearby riders** — find users within ~50 km using the Haversine formula
- **Add / Remove connections** — build your rider network
- Toast notifications for all connection actions

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
- Responsive layout — desktop sidebar + mobile bottom navigation
- Mouse-glow cursor trail effect
- Password strength meter on signup

### 🎙️ Voice Commands
- Browser-native voice control — say "start", "history", "dark", "light", "warm", "midnight"
- Toggle on/off from settings

### 🌐 Offline Resilience
- `withFallback()` helper in the ride API — if the backend is unreachable, rides are cached in `localStorage`
- GPS tracking works fully client-side even when the backend is down

### 👥 Group Rides
- **Ride participants** with roles (`admin`, `member`) and statuses (`active`, `pending`, `declined`, `left`)
- Group riders panel to invite friends and manage participants
- **Live rider locations** — opt-in per rider, real GPS only, shared with the group over an authenticated WebSocket

---

## 🛠️ Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | SPA with HMR, dev proxy to backend |
| **Styling** | Tailwind CSS 3 | Utility-first, fully themed |
| **Routing** | React Router DOM 7 | Client-side routing with protected routes |
| **Maps** | MapLibre GL + Leaflet | Open-source, **no API key needed** |
| **Backend** | Spring Boot 3.4 (Java 21) | REST API, session auth, BCrypt |
| **Database** | PostgreSQL | Persistent data with JDBC sessions |
| **ORM** | Spring Data JPA + Hibernate | Auto-generated tables from entities |
| **Geocoding** | Nominatim (OpenStreetMap) | Free, no API key |
| **Routing Engine** | OSRM | Open-source road routing, no API key |
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
│       │   │   ├── WebConfig.java       # CORS
│       │   │   ├── DataInitializer.java # Default admin seeder
│       │   │   ├── SessionAuthInterceptor.java
│       │   │   └── GlobalExceptionHandler.java
│       │   ├── controller/
│       │   │   ├── AuthController.java         # /api/auth/*
│       │   │   ├── RideController.java         # /api/rides/*
│       │   │   ├── RidersController.java       # /api/riders/*
│       │   │   ├── AdminController.java        # /api/admin/*
│       │   │   └── NotificationController.java # /api/notifications/*
│       │   ├── entity/                  # JPA entities → DB tables
│       │   │   ├── User.java
│       │   │   ├── Ride.java
│       │   │   ├── Connection.java
│       │   │   ├── LocationUpdate.java
│       │   │   ├── RideParticipant.java
│       │   │   └── Notification.java
│       │   ├── dto/                     # Request/Response objects
│       │   ├── repository/              # Spring Data JPA repos
│       │   ├── service/                 # Business logic
│       │   └── exception/               # Custom exceptions
│       └── resources/
│           └── application.properties   # DB, port, session config
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
│       │   └── AuthContext.jsx          # Global auth state
│       ├── services/
│       │   ├── rideApi.js               # Ride CRUD + offline fallback
│       │   ├── ridersApi.js             # Connections API
│       │   ├── routingApi.js            # Geocoding + routing
│       │   ├── locationService.js       # GPS wrapper (throttled)
│       │   ├── rideTracking.js          # Live tracking logic
│       │   ├── adminApi.js              # Admin endpoints
│       │   └── notificationApi.js       # Notifications
│       └── pages/
│           ├── Home.jsx                 # Main dashboard
│           ├── Riders.jsx               # Community & connections
│           ├── Account.jsx              # Profile management
│           ├── Settings.jsx             # Theme, voice, preferences
│           ├── Onboarding.jsx           # Post-signup setup
│           ├── landing-page/Login.jsx   # Login + Signup
│           ├── admin/                   # Admin dashboard, users, rides
│           ├── hooks/                   # useTheme, useRideDistance
│           └── components/
│               ├── layout/              # Sidebar, TopBar, MobileNav
│               ├── ride/               # RideMap, ActiveRideOverlay, etc.
│               ├── shared/              # Modals, protected routes, voice
│               └── ui/                  # Button, Icon, styles
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

### 5. Environment variables

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | `jdbc:postgresql://localhost:5432/ridewise` | **Not set locally** → the local database is used. Set on Render → the cloud database is used. |
| `DB_USERNAME` / `DB_PASSWORD` | backend | `postgres` / local password | Only needed if the credentials are not part of `DATABASE_URL` |
| `VITE_API_URL` | frontend | `http://localhost:8080` | Dev proxy target. Leave unset locally; point it at the backend host to test against a deployed backend |
| `VITE_WS_URL` | frontend | *(page's own origin)* | Only set this to talk to a backend on a different domain (e.g. `wss://ride-wise-kif0.onrender.com`) |
| `ridewise.websocket.allowed-origins` | backend | Cloudflare Pages + localhost + Netlify | Comma-separated browser origins allowed to open `/ws/rides` |

### 6. Test the live group-ride location with two devices

1. Start PostgreSQL, then the backend (`mvnw.cmd spring-boot:run`) and the
   frontend (`npm run dev`).
2. **Device A** — `http://localhost:5173` → sign up/log in → *Riders* → connect to
   Rider B → start a **Group** ride (pick origin/destination) → *Start Ride*.
3. **Device B** — sign in as Rider B (a second browser, or a normal + private
   window so the two sessions do not share a cookie) → open the same group ride
   → the riders panel shows A.
4. On **both** devices press **Share location** and allow the browser's
   location permission. Each marker must now appear on the other device's map
   and move on every GPS fix (throttled to 1.5 s).
5. Press **Share location** again on device A → A's marker disappears on B
   immediately, and A shows *No GPS* in the riders panel.
6. Deny the location permission (or turn it off in the browser) → the red GPS
   banner appears and **no marker is ever faked**; other riders show that rider
   as *No GPS*.
7. Close the map, end the ride, or leave the ride → `watchPosition` is
   cancelled, the socket closes, and the stored position is deleted. Nothing
   is tracked after the tab is closed.

### 7. Production notes (Render + Cloudflare Pages)

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
| `GET` | `/api/rides/user/{userId}` | Get all rides for user |
| `GET` | `/api/rides/user/{userId}/active` | Get active rides |
| `GET` | `/api/rides/{rideId}` | Get single ride |
| `PATCH` | `/api/rides/{rideId}/status` | Update ride status |
| `DELETE` | `/api/rides/{rideId}` | Delete a ride |
| `POST` | `/api/rides/{rideId}/location` | Submit GPS location update |
| `GET` | `/api/rides/{rideId}/location` | Get GPS track for ride |
| `GET` | `/api/rides/{rideId}/live-locations` | Current position of every member sharing a live location |
| `DELETE` | `/api/rides/{rideId}/live-location` | Stop sharing my live position (removes my marker) |
| `GET` | `/api/rides/{rideId}/participants` | Active participants of a group ride |

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
| server → client | `{ "type": "error", "message": ".." }` |

### Riders — `/api/riders`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/riders/search?query=&userId=` | Search riders |
| `GET` | `/api/riders/nearby?userId=` | Find nearby riders (~50 km) |
| `GET` | `/api/riders/connections?userId=` | Get connections list |
| `POST` | `/api/riders/add` | Add a connection |
| `POST` | `/api/riders/remove` | Remove a connection |

### Admin — `/api/admin` *(requires ADMIN role)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Platform stats |
| `GET` | `/api/admin/users` | Paginated user list |
| `GET` | `/api/admin/users/{id}` | User detail |
| `PATCH` | `/api/admin/users/{id}/status` | Enable/disable user |
| `GET` | `/api/admin/rides` | Paginated ride list |
| `GET` | `/api/admin/rides/{id}` | Ride detail with participants |

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

---

## 🧠 Key Design Decisions

| Decision | Why |
|---|---|
| **No third-party API keys** | MapLibre, Nominatim, and OSRM are all free & open — zero vendor lock-in |
| **PostgreSQL-backed sessions** | Login sessions survive backend restarts (critical for free-tier deploys) |
| **BCrypt password hashing** | Industry-standard; plain-text passwords never stored |
| **Vite proxy** | Frontend calls `/api/*` with relative paths — no CORS issues in development |
| **Offline fallback** | Rides are cached to `localStorage` when backend is unreachable |
| **Throttled GPS** | Browser GPS can fire every 100ms; the app throttles to once per 1.5s to save battery |
| **Latest-position table** | `user_locations` holds one row per user and is updated in place, so live tracking never floods the database |
| **Raw WebSocket (no STOMP)** | One `/ws/rides` endpoint, no extra client dependency; the handshake reuses the existing session cookie, so there is a single auth mechanism |
| **Same-origin socket** | The browser connects to its own origin and a Cloudflare Pages function forwards the upgrade to the backend — a first-party cookie is always sent, unlike a cross-site socket |
| **No Lombok** | Removed for Java 21+ compatibility — all getters/setters are hand-written |

---

## 🔮 Future Vision — The Big Idea

RideWise is not just a personal ride tracker. The vision is to make it a **universal, multi-tenant GPS tracking platform** that any organisation can adopt — without needing to build a separate system.

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

| Feature | Description |
|---|---|
| **Multi-tenant workspaces** | Each organisation gets an isolated workspace |
| **Custom roles & permissions** | Admin, Driver, Member, Viewer — configurable per workspace |
| **Live multi-user map** | See all active members on one map in real time |
| **Driver assignment** | Assign drivers to rides with vehicle details |
| **Geofencing & alerts** | Notifications when a vehicle enters/leaves a zone |
| **Route optimisation** | Suggest optimal routes for multi-stop rides |
| **Mobile app (PWA → Native)** | Progressive Web App first, then React Native |
| **Real-time WebSockets** | Replace polling with instant live updates |
| **Analytics dashboard** | Distance covered, active hours, ride patterns per org |
| **Export & reports** | CSV / PDF reports for ride history and GPS logs |

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
