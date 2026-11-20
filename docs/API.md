# RideWise API, Database & Environment Reference

---

## REST & WebSocket Endpoints

RideWise exposes **8 REST controllers** under `/api/*` and **2 raw JSON WebSocket handlers** under `/ws/*` (authenticated via the `SESSION` HttpOnly cookie).

| Domain | Base Path | Highlights |
|---|---|---|
| **Auth & account** | `/api/auth` | Sign up, sign in, sign out other sessions, email/password change, JSON account export & deletion (`AuthController`). |
| **Rides** | `/api/rides` | Create, list, and delete rides; bulk-clear finished rides; live location snapshots; group participants (`RideController`). |
| **Live group socket** | `/ws/rides` | `subscribe`, `unsubscribe`, `location`, `stop`, `ping`/`pong`, `snapshot`, `location-cleared`, `participants-changed`, `ride-ended` (`RideLocationSocketHandler`). |
| **Organizations & fleet** | `/api/organizations` | Public discovery, private access-code unlock, members & roles, vehicles, multi-stop routes, trips, analytics, announcements (`OrganizationController`). |
| **Vehicle trips & alerts** | `/api/vehicle-sessions`, `/api/vehicle-alerts` | DB-locked trip start/stop, GPS ingestion, crowd level, SOS, trip replay, proximity alerts (`VehicleSessionController`). |
| **Live fleet socket** | `/ws/fleet` | `watch-vehicle`, `watch-org`, `unwatch`, `position`, `alive`, `ping`/`pong`, `session-started/ended`, `sos`, `crowd`, `announcement` (`FleetSocketHandler`). |
| **Rider community** | `/api/riders` | Search, nearby riders (50 km radius, privacy-masked), connections (`RidersController`). |
| **Platform admin** | `/api/admin` | Platform stats, user editing/deletion, ride force-end & bulk cleanup, org verification/suspension (`AdminController`). |
| **Feedback & notifications** | `/api/feedback`, `/api/notifications` | Bug reports & feedback with optional Gmail alerts (`FeedbackController`); real-time unread notifications (`NotificationController`). |

---

## Database Tables (22 Total)

On startup against PostgreSQL, Hibernate (`ddl-auto=update`) and Spring Session JDBC (`session-schema.sql` + `initialize-schema=always`) auto-create **22 tables** in the `public` schema:

- **20 JPA entities:**
  `users`, `rides`, `ride_participants`, `user_locations`, `location_updates`, `connections`, `notifications`, `feedback`, `platform_settings`, `organizations`, `org_members`, `org_access`, `vehicles`, `org_routes`, `vehicle_sessions`, `vehicle_session_routes`, `vehicle_session_points`, `vehicle_alerts`, `org_announcements`, `org_audit_logs`
- **2 Spring Session JDBC tables:**
  `spring_session`, `spring_session_attributes`

---

## Environment & Configuration Variables

See [`.env.example`](../.env.example) at the repository root for a ready-to-copy template.

| Variable / Property | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL JDBC URL (default: `jdbc:postgresql://localhost:5432/ridewise`) |
| `DB_USERNAME` | Backend | Database username (default: `postgres`) |
| `DB_PASSWORD` | Backend | Database password (**required — no default**) |
| `RIDEWISE_ADMIN_EMAIL` / `RIDEWISE_ADMIN_PASSWORD` | Backend | Initial platform admin bootstrap read by `DataInitializer` (defaults: `admin@ridewise.com` / `Admin@123` — **change before exposing publicly!**) |
| `RIDEWISE_ALLOWED_ORIGINS` | Backend | Comma-separated allowed origin patterns for REST & WebSockets (override `ridewise.allowed-origins`) |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` / `RIDEWISE_ADMIN_ALERT_EMAIL` | Backend | Optional SMTP / Gmail forwarding for user feedback alerts |
| `ridewise.fleet.session-timeout-minutes` | Backend | Auto-end silent fleet trips (default: `30`; env var: `RIDEWISE_FLEET_SESSION_TIMEOUT_MINUTES`) |
| `ridewise.rides.auto-end-hours` | Backend | Auto-end idle active rides (default: `48`; env var: `RIDEWISE_RIDES_AUTO_END_HOURS`) |
| `VITE_API_URL` | Frontend *(Vite dev server only)* | Optional proxy target for `/api/*` and `/ws/*` inside `frontend/vite.config.js` (default: `http://localhost:8080`). Not used in production builds. |
| `VITE_WS_URL` | Frontend *(build-time override)* | Optional WebSocket origin (`wss://...`) baked into `rideSocket.js` and `fleetSocket.js` during `npm run build` (defaults to the page's own origin). |
