# RideWise - Complete Project Overview
Last updated: September 2026
Location: E:\My projects\RideWise

================================================================================
TABLE OF CONTENTS
================================================================================

  1.  What Is RideWise?
  2.  Project Status
  3.  Folder Structure
  4.  Tech Stack at a Glance
  5.  How to Run the App
  6.  Architecture - The Big Picture
  7.  Backend Deep Dive (Spring Boot)
        7a. Entities (Database Tables)
        7b. DTOs (Data Transfer Objects)
        7c. Repositories
        7d. Services (Business Logic)
        7e. Controllers (REST API Endpoints)
        7f. Config
  8.  Frontend Deep Dive (React + Vite)
        8a. Routing and Pages
        8b. Context (Global State)
        8c. Services (API Calls)
        8d. Components
        8e. Hooks
  9.  Full API Reference
  10. Database Schema
  11. How Frontend and Backend Talk
  12. Key Feature: Ride Flow (End-to-End)
  13. Key Feature: Authentication Flow
  14. Key Feature: Riders and Connections
  15. Maps and Routing (External APIs)
  16. What is Done vs. What is Next

================================================================================
1. WHAT IS RIDEWISE?
================================================================================

RideWise is a full-stack web application for a rider community.
Think of it as a social GPS app for motorcyclists or cyclists.

It lets users:
  - Sign up / log in with email + password
  - Set up a profile (username, mobile, address, GPS location)
  - Plan and start rides (choose origin + destination, get a route on the map)
  - Track a live ride in real time (GPS dot moves on map, turn-by-turn directions)
  - Save ride history (distance, duration, route)
  - Find and connect with other nearby riders
  - See a visual map of any past ride

================================================================================
2. PROJECT STATUS
================================================================================

From: Project Details/Project completion id.txt

  DONE: Login, Signup
  DONE: Home page with rider section
  DONE: Connections -- add, remove, find other riders
  DONE: Start Ride CTA button is built
  IN PROGRESS: Full ride tracking implementation

NOTE: The codebase is further along than that note suggests.
Ride creation, GPS tracking, history, and the active ride overlay with live map
are all implemented in both frontend and backend. The note was an earlier checkpoint.

================================================================================
3. FOLDER STRUCTURE
================================================================================

RideWise/
|
|-- Project Details/
|   |-- RIDEWISE_PROJECT_OVERVIEW.md          <- This file
|   |-- Project completion id.txt             <- Checkpoint notes
|   +-- Gemini artifate about the project completion 1/
|       |-- frontend_backend_connection.md    <- How the Vite proxy was set up
|       +-- project_workflow_guide.md         <- Beginner-friendly flow guide
|
|-- backend/
|   +-- ridewise/                             <- Spring Boot Maven project
|       |-- pom.xml                           <- Dependencies and build config
|       |-- mvnw  /  mvnw.cmd                 <- Maven wrapper scripts (no install needed)
|       +-- src/main/
|           |-- java/vehicle/ridewise/
|           |   |-- RideWiseApplication.java  <- Entry point (@SpringBootApplication)
|           |   |-- config/
|           |   |   |-- SecurityConfig.java   <- BCrypt + security setup
|           |   |   +-- WebConfig.java        <- CORS configuration
|           |   |-- controller/
|           |   |   |-- AuthController.java   <- /api/auth/*
|           |   |   |-- RideController.java   <- /api/rides/*
|           |   |   +-- RidersController.java <- /api/riders/*
|           |   |-- dto/
|           |   |   |-- AuthRequest.java
|           |   |   |-- LocationUpdateRequest.java
|           |   |   |-- LocationUpdateResponse.java
|           |   |   |-- RideRequest.java
|           |   |   |-- RideResponse.java
|           |   |   +-- UserResponse.java
|           |   |-- entity/
|           |   |   |-- User.java             <- users table
|           |   |   |-- Ride.java             <- rides table
|           |   |   |-- Connection.java       <- connections table
|           |   |   +-- LocationUpdate.java   <- location_updates table
|           |   |-- repository/
|           |   |   |-- UserRepository.java
|           |   |   |-- RideRepository.java
|           |   |   |-- ConnectionRepository.java
|           |   |   +-- LocationUpdateRepository.java
|           |   +-- service/
|           |       |-- AuthService.java
|           |       |-- RideService.java
|           |       |-- RidersService.java
|           |       +-- LocationUpdateService.java
|           +-- resources/
|               +-- application.properties    <- DB, port, JPA settings
|
+-- frontend/                                 <- React + Vite project
    |-- index.html
    |-- vite.config.js                        <- Proxy /api/* to localhost:8080
    |-- tailwind.config.js
    |-- package.json
    +-- src/
        |-- main.jsx                          <- React entry point
        |-- App.jsx                           <- Router + route definitions
        |-- index.css                         <- Global styles
        |-- context/
        |   +-- AuthContext.jsx               <- Global auth state (login, signup, etc.)
        |-- services/
        |   |-- rideApi.js                    <- Ride CRUD + GPS update calls
        |   |-- ridersApi.js                  <- Riders/connections API calls
        |   |-- routingApi.js                 <- Geocoding, routing, geo math
        |   +-- locationService.js            <- GPS browser wrapper
        +-- pages/
            |-- Home.jsx                      <- Main dashboard
            |-- Riders.jsx                    <- Riders community page
            |-- Account.jsx                   <- Profile management
            |-- Settings.jsx                  <- App preferences
            |-- Onboarding.jsx                <- Post-signup profile setup
            |-- landing-page/
            |   +-- Login.jsx                 <- Login + Signup screen
            |-- hooks/
            |   |-- useTheme.js               <- Light/dark/warm/midnight theme hook
            |   +-- useRideLocation.js        <- GPS location hook for active ride
            +-- components/
                |-- layout/
                |   |-- Sidebar.jsx           <- Desktop left navigation
                |   |-- TopBar.jsx            <- Mobile top bar
                |   +-- MobileNav.jsx         <- Mobile bottom navigation
                |-- shared/
                |   |-- ProtectedRoute.jsx    <- Auth guard for protected routes
                |   |-- StartRideModal.jsx    <- Bottom sheet to create a ride
                |   |-- ThemeDropdown.jsx     <- Theme picker dropdown
                |   +-- useVoice.js           <- Voice command hook
                |-- ride/
                |   |-- ActiveRideOverlay.jsx <- Full-screen live ride map overlay
                |   |-- RideMap.jsx           <- MapLibre GL map component
                |   |-- RideSetup.jsx         <- Origin/destination entry form
                |   |-- RideSetupFlow.jsx     <- Multi-step ride setup wizard
                |   |-- RideControls.jsx      <- Start/end ride buttons
                |   |-- DirectionsPanel.jsx   <- Turn-by-turn directions panel
                |   |-- RideHistoryPanel.jsx  <- Ride history side panel
                |   +-- RideHistoryCard.jsx   <- Single ride history card
                +-- account/
                    +-- AccountMenu.jsx       <- Account dropdown menu

================================================================================
4. TECH STACK AT A GLANCE
================================================================================

FRONTEND
  Framework    : React 19.x
  Build Tool   : Vite 8.x  (HMR + dev proxy to backend)
  CSS          : Tailwind CSS 3.x
  Routing      : React Router DOM 7.x
  Map Library  : MapLibre GL 6.x  (open-source, no API key needed)

BACKEND
  Framework    : Spring Boot 3.4.4
  Language     : Java 21 LTS
  Database DEV : H2 in-memory  (resets on restart, zero setup needed)
  Database PROD: PostgreSQL  (commented out in config, ready to switch)
  ORM          : Spring Data JPA + Hibernate
  Security     : Spring Security  (BCrypt password hashing only)
  Build        : Maven Wrapper (mvnw -- no Maven install required)

EXTERNAL APIs  (free, no API key required)
  Geocoding    : Nominatim  (OpenStreetMap)
  Routing      : OSRM  (Open Source Routing Machine)

================================================================================
5. HOW TO RUN THE APP
================================================================================

STEP 1 -- Start the Backend (Spring Boot on port 8080)

    cd "E:\My projects\RideWise\backend\ridewise"
    ./mvnw spring-boot:run

  Backend API available at : http://localhost:8080
  H2 Console available at  : http://localhost:8080/h2-console
    JDBC URL  : jdbc:h2:mem:ridewise
    Username  : sa
    Password  : (leave empty)

STEP 2 -- Start the Frontend (Vite on port 5173)

    cd "E:\My projects\RideWise\frontend"
    npm run dev

  App available at : http://localhost:5173
  All /api/* calls are automatically proxied to localhost:8080

IMPORTANT:
  Both processes must be running at the same time.
  The app partially works offline thanks to localStorage fallbacks in rideApi.js.

================================================================================
6. ARCHITECTURE - THE BIG PICTURE
================================================================================

  Browser (React)
      |
      |  fetch('/api/auth/...')
      v
  Vite Dev Server  ----proxy /api/* to :8080---->  Spring Boot (port 8080)
                                                         |
                                              [AuthController]
                                              [RideController]
                                              [RidersController]
                                                         |
                                              [AuthService]
                                              [RideService]
                                              [RidersService]
                                              [LocationUpdateService]
                                                         |
                                              [UserRepository]
                                              [RideRepository]
                                              [ConnectionRepository]
                                              [LocationUpdateRepository]
                                                         |
                                                   H2 Database
                                              (in-memory, resets on restart)


KEY DESIGN DECISIONS
--------------------

1. Vite Proxy
   The frontend uses relative paths like /api/auth/login (NOT http://localhost:8080/...).
   Vite forwards /api/* to the backend, avoiding all browser CORS blocks.

2. Session via localStorage
   No JWT tokens are used. After login, the UserResponse JSON is stored in
   localStorage under the key "ridewise-user".
   AuthContext restores it on every page load without a re-login.

3. BCrypt Passwords
   Spring Security's BCryptPasswordEncoder hashes passwords before saving.
   Plain-text passwords NEVER reach the database.

4. H2 In-Memory Database
   All data resets when Spring Boot restarts. This is intentional for development.
   Switching to PostgreSQL only requires uncommenting lines in pom.xml
   and application.properties -- no code changes needed.

5. Offline Fallback
   rideApi.js has a withFallback() helper. If the backend is down, rides are
   saved to localStorage so the UI still works. Backend calls always take priority.

================================================================================
7. BACKEND DEEP DIVE (Spring Boot)
================================================================================

NOTE: Lombok was intentionally removed from pom.xml.
It is incompatible with Java 25 (TypeTag::UNKNOWN error).
All getters and setters are written manually in every entity and DTO class.


--------------------------------------------------------------------------------
7a. ENTITIES (Database Tables)
--------------------------------------------------------------------------------

Entities are Java classes marked with @Entity. Hibernate reads them and
auto-creates the matching SQL tables on startup (ddl-auto=update).
No SQL scripts or migrations are needed.

--- User.java  (table: users) ---

  Column      Java Type       Constraint       Description
  ----------  -----------     ------------     -----------------------------------
  id          Long            PK AUTO_INCR     Primary key
  email       String          UNIQUE NOT NULL  Login identifier
  password    String          NOT NULL         BCrypt hashed -- NEVER stored plain
  username    String          UNIQUE           Display name, set during onboarding
  mobile      String                           Optional phone number
  address     String                           Optional address text
  lat         Double                           GPS latitude (set during onboarding)
  lng         Double                           GPS longitude
  created_at  LocalDateTime                    Auto-set by @PrePersist

--- Ride.java  (table: rides) ---

  Column             Java Type       Description
  -----------------  -----------     -------------------------------------------
  id                 Long            PK AUTO_INCR
  user_id            Long            Which user started this ride
  from_name          String          Origin place name (e.g. "Chennai")
  from_lat           Double          Origin latitude
  from_lng           Double          Origin longitude
  destination_name   String          Destination place name
  destination_lat    Double          Destination latitude
  destination_lng    Double          Destination longitude
  route_coordinates  TEXT            JSON string: [[lng,lat],...] full planned route
  route_steps        TEXT            JSON string of turn-by-turn step objects
  distance_meters    Double          Total route distance in metres
  duration_seconds   Double          Estimated total ride time in seconds
  ride_type          String          e.g. "solo", "group"
  status             String          "active" or "completed"
  created_at         LocalDateTime   Auto-set on creation (@PrePersist)
  ended_at           LocalDateTime   Set when ride status changes to "completed"

--- Connection.java  (table: connections) ---

  Column              Java Type       Description
  ------------------  -----------     -------------------------------------------
  id                  Long            PK AUTO_INCR
  user_id             Long NOT NULL   The user who made the connection
  connected_user_id   Long NOT NULL   The user being connected to
  created_at          LocalDateTime   Auto-set on creation

  Each "Add Rider" action creates ONE row.
  Connections are directional: if A adds B, one row is created.
  If B adds A back, a second row is created.

--- LocationUpdate.java  (table: location_updates) ---

  Column       Java Type       Description
  -----------  -----------     -------------------------------------------
  id           Long            PK AUTO_INCR
  ride_id      Long NOT NULL   Which ride this GPS fix belongs to
  lat          Double NOT NULL GPS latitude at this moment
  lng          Double NOT NULL GPS longitude at this moment
  captured_at  String          ISO 8601 timestamp from the client device
  received_at  LocalDateTime   Server-side timestamp (auto-set by @PrePersist)

  Every GPS tick (every ~1.5s) while a ride is active creates ONE row here.
  This builds the ACTUAL path the rider traveled (not just the planned route).
  Used for: ride history map replay, traveled distance, future group tracking.


--------------------------------------------------------------------------------
7b. DTOs (Data Transfer Objects)
--------------------------------------------------------------------------------

DTOs are simple Java classes that carry data between the frontend and backend.
They decouple the API contract from the internal entity structure.
The key benefit: we can return UserResponse WITHOUT the password field,
even though the User entity has a password column.

  DTO                    Direction              Fields
  --------------------   --------------------   --------------------------------
  AuthRequest            Frontend -> Backend    email, password, username?,
                                                mobile?, address?, lat?, lng?
  UserResponse           Backend -> Frontend    id, email, username, mobile,
                                                address, lat, lng, createdAt
                                                (NO password field!)
  RideRequest            Frontend -> Backend    userId, fromName, fromLat,
                                                fromLng, destinationName,
                                                destinationLat, destinationLng,
                                                routeCoordinates, routeSteps,
                                                distanceMeters, durationSeconds,
                                                rideType
  RideResponse           Backend -> Frontend    All of the above + id, status,
                                                createdAt, endedAt
  LocationUpdateRequest  Frontend -> Backend    lat, lng, timestamp
  LocationUpdateResponse Backend -> Frontend    id, rideId, lat, lng,
                                                capturedAt, receivedAt


--------------------------------------------------------------------------------
7c. REPOSITORIES
--------------------------------------------------------------------------------

Repositories extend Spring Data's JpaRepository<Entity, IdType>.
Spring generates the SQL queries automatically from method names.
No SQL is written by hand.

  Repository                  Key Methods
  --------------------------  -------------------------------------------------
  UserRepository              findByEmail(String email)
                              existsByEmail(String email)
                              findAllByIdNot(Long id)  -- all users except self
                              findNearby(...)           -- Haversine-based query
  RideRepository              findByUserIdOrderByCreatedAtDesc(Long userId)
                              findByUserIdAndStatus(Long userId, String status)
  ConnectionRepository        existsByUserIdAndConnectedUserId(Long u, Long c)
                              findByUserId(Long userId)
                              deleteByUserIdAndConnectedUserId(Long u, Long c)
  LocationUpdateRepository    findByRideIdOrderByReceivedAtDesc(Long rideId)


--------------------------------------------------------------------------------
7d. SERVICES (Business Logic)
--------------------------------------------------------------------------------

Services contain all the business rules. Controllers are "thin" -- they just
receive the HTTP request and delegate to the service.

--- AuthService.java ---

  signup(AuthRequest request)
    1. Check if email is already registered  (throws if duplicate)
    2. BCrypt-hash the password
    3. Create and save new User entity
    4. Return UserResponse (password is NOT included)

  login(AuthRequest request)
    1. Find user by email  (throws "No account found" if missing)
    2. BCrypt.matches(inputPassword, storedHash)
    3. If match: return UserResponse
    4. If not match: throw "Incorrect password"

  updateProfile(Long userId, AuthRequest request)
    1. Load user by ID  (throws "User not found" if missing)
    2. Only update fields that are non-null: username, mobile, address
    3. Save and return UserResponse

--- RideService.java ---

  createRide(RideRequest)
    Save new ride with status="active", createdAt=now()

  getUserRides(Long userId)
    Return all rides for user, sorted newest first

  getActiveRides(Long userId)
    Return only rides where status="active"

  updateStatus(Long rideId, String status)
    Update ride status; if status="completed", also set endedAt=now()

  deleteRide(Long rideId)
    Permanently remove ride from database

  getRide(Long rideId)
    Fetch and return single ride by its ID

--- RidersService.java ---

  searchRiders(String query, Long userId)
    Search users whose username or email contains the query string.
    Excludes the requesting user from results.

  getNearRiders(Long userId)
    Find all users with stored lat/lng within approximately 50km.
    Uses the Haversine formula for distance calculation.
    Returns sorted by distance (closest first).

  getConnections(Long userId)
    Return full UserResponse objects for all of this user's connections.

  addRider(Long userId, Long riderId)
    Check if connection already exists (idempotent -- no duplicates).
    If not: create a Connection entity and save.
    Return true on success.

  removeRider(Long userId, Long riderId)
    Delete the Connection row where userId+connectedUserId matches.
    Return true on success.

--- LocationUpdateService.java ---

  saveLocation(Long rideId, LocationUpdateRequest req)
    Save one GPS position fix to the location_updates table.
    receivedAt is set automatically by @PrePersist on the entity.

  getTrack(Long rideId)
    Return all GPS fixes for a ride, newest first.
    This is the actual path the rider traveled.


--------------------------------------------------------------------------------
7e. CONTROLLERS (REST API Endpoints)
--------------------------------------------------------------------------------

--- AuthController.java  (base path: /api/auth) ---

  CORS allowed from: http://localhost:5173, http://localhost:3000

  POST  /api/auth/signup
    Receives: AuthRequest { email, password }
    Returns:  UserResponse
    Errors:   "Email already registered"

  POST  /api/auth/login
    Receives: AuthRequest { email, password }
    Returns:  UserResponse
    Errors:   "No account found with this email", "Incorrect password"

  PATCH /api/auth/profile/{userId}
    Receives: AuthRequest { username?, mobile?, address? }
    Returns:  UserResponse with updated fields
    Notes:    Only non-null fields are updated. userId is the database Long id.


--- RideController.java  (base path: /api/rides) ---

  CORS: * (open for dev convenience -- restrict in production)

  POST   /api/rides/
    Receives: RideRequest JSON
    Returns:  RideResponse with generated id + createdAt

  GET    /api/rides/user/{userId}
    Returns: RideResponse[] (newest first)

  GET    /api/rides/user/{userId}/active
    Returns: RideResponse[] (status="active" only)

  GET    /api/rides/{rideId}
    Returns: RideResponse

  PATCH  /api/rides/{rideId}/status
    Body:    { "status": "completed" }
    Returns: RideResponse (endedAt is set when completing)

  DELETE /api/rides/{rideId}
    Returns: 204 No Content

  POST   /api/rides/{rideId}/location
    Receives: LocationUpdateRequest { lat, lng, timestamp }
    Returns:  LocationUpdateResponse { id, rideId, lat, lng, capturedAt, receivedAt }

  GET    /api/rides/{rideId}/location
    Returns: LocationUpdateResponse[] (the actual GPS path traveled, newest first)


--- RidersController.java  (base path: /api/riders) ---

  CORS allowed from: http://localhost:5173, http://localhost:3000

  GET  /api/riders/search?query=alice&userId=1
    Returns: UserResponse[] whose username or email contains "alice", excluding userId=1

  GET  /api/riders/nearby?userId=1
    Returns: UserResponse[] within ~50km of user 1's stored lat/lng, sorted by distance
    Requires: User 1 must have lat and lng set in the database

  GET  /api/riders/connections?userId=1
    Returns: UserResponse[] -- full user objects for all of user 1's connections

  POST /api/riders/add
    Body:    { "userId": 1, "riderId": 2 }
    Returns: { "success": true }
    Notes:   Idempotent -- checks for existing connection first

  POST /api/riders/remove
    Body:    { "userId": 1, "riderId": 2 }
    Returns: { "success": true }


--------------------------------------------------------------------------------
7f. CONFIG
--------------------------------------------------------------------------------

SecurityConfig.java
  - Provides the BCryptPasswordEncoder bean used by AuthService
  - Disables Spring Security's default form login (not needed for REST API)
  - Disables CSRF protection (stateless REST API -- no session cookies)

WebConfig.java
  - Configures CORS globally for all /api/** endpoints
  - Allowed origins:  http://localhost:5173, http://localhost:3000
  - Allowed methods:  GET, POST, PUT, PATCH, DELETE, OPTIONS
  - allowedHeaders:   * (all headers allowed)
  - allowCredentials: true

application.properties (key settings)
  server.port=8080
  spring.datasource.url=jdbc:h2:mem:ridewise
  spring.h2.console.enabled=true
  spring.h2.console.path=/h2-console
  spring.jpa.hibernate.ddl-auto=update   <- auto-creates tables from entities
  spring.jpa.show-sql=true               <- prints SQL to console (dev only)

================================================================================
8. FRONTEND DEEP DIVE (React + Vite)
================================================================================


--------------------------------------------------------------------------------
8a. ROUTING AND PAGES
--------------------------------------------------------------------------------

All routes are defined in App.jsx using React Router DOM v7.

  URL            Component          Type       Notes
  -------------  -----------------  ---------  ---------------------------------
  /              Login.jsx          Public     Login + Signup screen
  /onboarding    Onboarding.jsx     Public     Shown once after signup
  /home          Home.jsx           Protected  Main dashboard
  /riders        Riders.jsx         Protected  Rider community page
  /account       Account.jsx        Protected  Profile management
  /settings      Settings.jsx       Protected  App preferences
  /saved         (redirect)         --         Redirects to /home
  /profile       (redirect)         --         Redirects to /account
  /login         (redirect)         --         Redirects to /
  *              (redirect)         --         Redirects to / (404 catch-all)

Protected routes are wrapped in <ProtectedRoute>.
It checks isAuthenticated and isFullyOnboarded from AuthContext.
  - Not authenticated   -> redirect to /
  - Authenticated but not onboarded -> redirect to /onboarding
  - Authenticated + onboarded -> render the child component


LOGIN PAGE (landing-page/Login.jsx)
  Both Sign Up and Log In in a single toggle UI.
  Calls AuthContext.signup() or AuthContext.login().
  On success:
    - New users   -> redirect to /onboarding
    - Returning   -> redirect to /home


ONBOARDING PAGE (Onboarding.jsx)
  Shown once after signup to complete the profile.
  Collects: username, mobile number, home address, GPS location.
  Uses: navigator.geolocation.getCurrentPosition() for lat/lng.
  Calls: AuthContext.updateProfile({ username, mobile, address, lat, lng })
  On save: isFullyOnboarded=true, redirect to /home.


HOME PAGE (Home.jsx) -- Most Complex Page
  Manages the main dashboard. State:
    showStart   - StartRideModal open/closed
    showHistory - RideHistoryPanel open/closed
    mapRide     - which ride is shown on the full-screen map
    rides       - all rides for this user (fetched from backend on mount)
    mousePos    - for the mouse-glow cursor effect

  Features:
    - Greeting section with the user's username
    - "Start a Ride" button -> opens StartRideModal
    - Live rides section (active rides with "Open Map" button)
    - Ride history cards (completed rides)
    - Mouse glow: a radial gradient that follows the cursor (visual polish)
    - Voice commands: say "start", "history", "dark", "light", "warm", "midnight"
    - Theme switching via useTheme hook


RIDERS PAGE (Riders.jsx)
  Tabs: "Search" | "Near Me" | "My Connections"
    Search   - Search riders by username or email (real-time as you type)
    Near Me  - Riders within 50km using stored GPS coordinates
    Connections - All your connected riders
  Actions: Add / Remove with green/red toast notifications
  State: connectedIds Set (derived locally) for instant UI toggle


ACCOUNT PAGE (Account.jsx)
  View and edit your profile:
    - Email (read-only)
    - Username, mobile, address (editable)
    - Member since date
    - Logout button
  Calls: AuthContext.updateProfile() on save


SETTINGS PAGE (Settings.jsx)
  App preferences:
    - Theme selection (light / dark / warm / midnight)
    - Voice commands toggle
    - Other UI settings


--------------------------------------------------------------------------------
8b. CONTEXT (Global State)
--------------------------------------------------------------------------------

AuthContext.jsx is the single source of truth for auth across the entire app.
Any component can call useAuth() to access it.

State it exposes:
  user              object|null   Full UserResponse from the backend
  isAuthenticated   boolean       True if user has logged in
  isFullyOnboarded  boolean       True if user has set a username
  loading           boolean       True while restoring session on app load
  avatarLetter      string        First letter of username (or email, or "R")

Functions it exposes:
  signup(email, password)     POST /api/auth/signup
  login(email, password)      POST /api/auth/login
  updateProfile(patch)        PATCH /api/auth/profile/{userId}
  logout()                    Clears React state + localStorage

Session Persistence:
  On every app load, AuthContext reads from localStorage:
    "ridewise-user"          -> stored UserResponse JSON
    "ridewise-authenticated" -> "true" or "false"
    "ridewise-onboarded"     -> "true" or "false"
  If found and valid: session is restored without a re-login.
  If corrupted: all keys are wiped and user is logged out safely.

localStorage keys used by the app:
  ridewise-user            Full UserResponse JSON object
  ridewise-authenticated   Session flag
  ridewise-onboarded       Onboarding completion flag
  ridewise-rides-local     Offline ride cache (used by rideApi fallback)


--------------------------------------------------------------------------------
8c. SERVICES (API Calls)
--------------------------------------------------------------------------------

All API communication lives in src/services/. Components stay clean.
No fetch() calls inside JSX components -- only service function calls.


RIDEABLE API (rideApi.js)
  Talks to: /api/rides/*
  Has withFallback() -- tries backend first, falls back to localStorage.

  Function                     API Call                          Fallback?
  ---------------------------  --------------------------------  ---------
  createRide(rideData)         POST   /api/rides/                Yes
  getUserRides(userId)         GET    /api/rides/user/{id}       Yes
  getActiveRides(userId)       GET    /api/rides/user/{id}/active Yes
  endRide(rideId)              PATCH  /api/rides/{id}/status     Yes
  deleteRide(rideId)           DELETE /api/rides/{id}            Yes
  getRide(rideId)              GET    /api/rides/{id}            Yes
  updateUserLocation(id,lt,ln) POST   /api/rides/{id}/location   No (silent)

  updateUserLocation is "fire-and-forget":
    - Errors are silently logged to the console
    - GPS tracking on the map still works fully client-side if this fails
    - The backend call is non-critical for the user experience


RIDERS API (ridersApi.js)
  Talks to: /api/riders/*
  Throws on non-2xx responses so callers can show error toasts.

  Function                     API Call
  ---------------------------  ----------------------------------------
  searchRiders(query, userId)  GET  /api/riders/search?query=&userId=
  addRider(userId, riderId)    POST /api/riders/add
  removeRider(userId, riderId) POST /api/riders/remove
  getConnectionsFull(userId)   GET  /api/riders/connections?userId=
  getNearRiders(userId)        GET  /api/riders/nearby?userId=
  distanceKm(lat1,lng1,la2,l2) (Client-side Haversine -- for "Near" badge label)


ROUTING API (routingApi.js)
  Geocoding, routing, and geographic math.
  Uses free public APIs -- no API keys needed.

  Function                         External API   Description
  -------------------------------  -------------  ----------------------------
  geocode(query)                   Nominatim      Place name -> { lat, lng, name }
  getRoute(from, to)               OSRM           Road route -> coords+steps
  parseRouteSteps(rawSteps)        --             OSRM steps -> UI-ready objects
  haversineDistance(la1,ln1,la2,ln2) --           Straight-line distance (metres)
  bearingBetween(la1,ln1,la2,ln2)  --             Compass bearing A->B (degrees)
  findActiveStep(steps, lat, lng)  --             Nearest upcoming turn step
  formatDistance(meters)           --             850 -> "850 m" | 3500 -> "3.5 km"
  formatDuration(seconds)          --             5400 -> "1 h 30 min"
  formatSpeed(mps)                 --             m/s -> km/h string

  IMPORTANT -- Coordinate Order:
    navigator.geolocation returns  { latitude, longitude }
    Stored internally as           { lat, lng }
    OSRM URL format:               {lng},{lat}  (LONGITUDE first in URL)
    OSRM JSON response (GeoJSON):  [lng, lat]  (LONGITUDE first in array)
    MapLibre also expects:         [lng, lat]
    -> OSRM output does NOT need to be flipped before passing to MapLibre.


LOCATION SERVICE (locationService.js)
  A wrapper around the browser's native navigator.geolocation API.

  Problem it solves:
    The native API can fire every 100ms on mobile -- very wasteful.
    This wrapper throttles updates to once every 1500ms (configurable).

  Key GPS configuration:
    enableHighAccuracy: true   Use GPS chip (not IP/WiFi fallback)
    maximumAge:         0      NEVER use a cached position
                               (Critical bug fix: old cached IP-based positions
                                could be 100s of km away from real location)
    timeout:            15000  Wait up to 15 seconds for a real GPS hardware fix

  Functions:
    getCurrentLocation()               -> Promise<LocationObj>  One-shot GPS fix
    watchLocation(onUpdate, onError)   -> stop() function       Continuous tracking

  LocationObj structure:
    { lat, lng, accuracy, speed, heading, timestamp }

  Accuracy interpretation:
    < 20m   = GPS hardware fix (excellent -- use for navigation)
    < 100m  = WiFi-based (good)
    > 500m  = IP-based (unreliable -- do NOT use for turn-by-turn navigation)


--------------------------------------------------------------------------------
8d. COMPONENTS
--------------------------------------------------------------------------------

LAYOUT COMPONENTS
  Sidebar.jsx      Desktop left nav (256px wide). Shows on screens >= 768px.
                   Links: Home, Riders, Account, Settings with active state.

  TopBar.jsx       Mobile top bar across the top of the screen.
                   Shows: app logo/name, theme switcher, user avatar.

  MobileNav.jsx    Mobile bottom navigation bar.
                   Shows: Home, Riders, Account, Settings icons.


SHARED COMPONENTS
  ProtectedRoute.jsx
    Auth guard component wrapping protected pages.
    - Shows loading spinner while AuthContext restores session from localStorage
    - If not authenticated: redirect to /
    - If authenticated but not onboarded: redirect to /onboarding
    - If fully authenticated + onboarded: render children

  StartRideModal.jsx
    Bottom sheet modal for creating a new ride.
    Step-by-step flow:
      1. Enter origin text  -> geocode() -> Nominatim API -> { lat, lng }
      2. Enter destination  -> geocode() -> { lat, lng }
      3. getRoute(from, to) -> OSRM API -> route coordinates + turn steps
      4. Mini map preview showing the route using MapLibre
      5. User clicks "Start Ride"
         -> createRide(rideData) -> POST /api/rides/ -> ride saved in DB
         -> Returns created ride to Home.jsx -> live ride map overlay opens

  ThemeDropdown.jsx
    Dropdown with 4 theme options: light, dark, warm, midnight.
    Calls useTheme().setTheme() on selection.

  useVoice.js  (hook)
    Uses the Web Speech API (browser built-in, no library needed).
    Listens for spoken commands and maps them to callback functions.
    Supported commands: "start", "history", "dark", "light", "warm", "midnight"
    Returns: { voiceMode, startVoice }


RIDE COMPONENTS
  ActiveRideOverlay.jsx
    Full-screen overlay shown during a LIVE ride.
    Contains RideMap + DirectionsPanel.
    On mount: calls locationService.watchLocation() for GPS every 1.5s.
    Each GPS tick:
      - Moves GPS dot on map
      - Updates speed display
      - Updates remaining distance
      - Highlights the next turn step
      - Calls updateUserLocation() (fire-and-forget to backend)
    Has "End Ride" button.

  RideMap.jsx
    The actual MapLibre GL map component.
    Renders:
      - OpenStreetMap base tiles
      - Route line (GeoJSON LineString)
      - Origin marker (green dot)
      - Destination marker (red dot with flag)
      - Live GPS dot (blue, rotates to face direction of travel)
    The GPS dot uses bearingBetween() to calculate heading and
    CSS transform:rotate() to point in the direction of movement.
    The route line gets trimmed as the user progresses along it.

  RideSetup.jsx
    Form for entering origin and destination as text.
    Uses geocode() to convert each text input to lat/lng coordinates.

  RideSetupFlow.jsx
    Multi-step wizard that orchestrates the full ride setup:
      Step 1: Enter origin and destination
      Step 2: View route preview on mini map
      Step 3: Select ride type (solo / group)
      Step 4: Confirm and start

  RideControls.jsx
    Start and End ride buttons with confirmation prompts.

  DirectionsPanel.jsx
    Shows the current active turn-by-turn instruction.
    Uses findActiveStep() to determine which step is upcoming.
    Updates automatically as the user's GPS position changes.

  RideHistoryPanel.jsx
    Side panel showing the full list of past rides.
    Per ride: route name, distance, duration, date, "View Map" and delete buttons.

  RideHistoryCard.jsx
    Single card component for one past ride.
    Shows: ride type icon, from/to names, distance, duration, date, actions.


ACCOUNT COMPONENTS
  AccountMenu.jsx
    Dropdown menu accessible from the avatar button.
    Shows: user's name, email, link to Account page, logout button.


--------------------------------------------------------------------------------
8e. HOOKS
--------------------------------------------------------------------------------

useTheme  (pages/hooks/useTheme.js)
  Manages the app's visual theme.
  Available themes: light, dark, warm, midnight
  Persists selected theme to localStorage so it survives page refresh.
  Returns: { theme, setTheme, tc }
    tc is a theme-aware CSS class helper function.
    Usage: tc('bg-white', 'bg-gray-900', 'bg-amber-50', 'bg-slate-900')
    Returns the class string matching the current theme.

useRideLocation  (pages/hooks/useRideLocation.js)
  Wraps locationService.watchLocation() in a React hook.
  Starts GPS tracking when enabled=true, stops on cleanup.
  Returns: { location, error }

useVoice  (pages/components/shared/useVoice.js)
  Web Speech API listener for voice commands.
  Accepts a commandsMap object: { "start": fn, "dark": fn, ... }
  Returns: { voiceMode, startVoice }

================================================================================
9. FULL API REFERENCE
================================================================================

BASE URL (development): http://localhost:8080
Frontend uses relative /api/* paths (Vite proxies them automatically).


AUTHENTICATION ENDPOINTS
---------------------------------------------------------------------------

POST /api/auth/signup
  Request body:
    { "email": "user@test.com", "password": "mypassword" }
  Response (200 OK):
    {
      "id": 1,
      "email": "user@test.com",
      "username": null,
      "mobile": null,
      "address": null,
      "lat": null,
      "lng": null,
      "createdAt": "2026-09-08T09:00:00"
    }
  Error: "Email already registered"

POST /api/auth/login
  Request body:
    { "email": "user@test.com", "password": "mypassword" }
  Response (200 OK): UserResponse (same shape as above)
  Errors: "No account found with this email" | "Incorrect password"

PATCH /api/auth/profile/{userId}
  Request body (only include fields you want to update):
    { "username": "GokulaRider", "mobile": "9876543210", "address": "Chennai" }
  Response (200 OK): UserResponse with updated fields
  Notes: userId is the database Long id (from the login/signup response).


RIDE ENDPOINTS
---------------------------------------------------------------------------

POST /api/rides/
  Request body:
    {
      "userId": 1,
      "fromName": "Chennai",
      "fromLat": 13.0827,
      "fromLng": 80.2707,
      "destinationName": "Mahabalipuram",
      "destinationLat": 12.6269,
      "destinationLng": 80.1927,
      "routeCoordinates": "[[80.27, 13.08], [80.25, 13.00], ...]",
      "routeSteps": "[{...step objects...}]",
      "distanceMeters": 55000,
      "durationSeconds": 3600,
      "rideType": "solo"
    }
  Response (200 OK): RideResponse with id, status="active", createdAt

GET /api/rides/user/{userId}
  Response: RideResponse[] sorted newest first

GET /api/rides/user/{userId}/active
  Response: RideResponse[] where status="active"

GET /api/rides/{rideId}
  Response: RideResponse

PATCH /api/rides/{rideId}/status
  Request body: { "status": "completed" }
  Response: RideResponse (endedAt is set when completing)

DELETE /api/rides/{rideId}
  Response: 204 No Content

POST /api/rides/{rideId}/location
  Request body:
    { "lat": 13.0827, "lng": 80.2707, "timestamp": "2026-09-08T09:30:00.000Z" }
  Response:
    { "id": 42, "rideId": 7, "lat": 13.08, "lng": 80.27,
      "capturedAt": "2026-09-08T09:30:00.000Z", "receivedAt": "2026-09-08T09:30:00.1" }

GET /api/rides/{rideId}/location
  Response: LocationUpdateResponse[] (newest first -- the actual GPS path traveled)


RIDER ENDPOINTS
---------------------------------------------------------------------------

GET /api/riders/search?query=alice&userId=1
  Response: UserResponse[] whose username or email contains "alice",
            excluding the user with id=1

GET /api/riders/nearby?userId=1
  Response: UserResponse[] within ~50km of user 1's stored lat/lng, sorted by distance
  Requires: user 1 must have lat and lng stored in the database

GET /api/riders/connections?userId=1
  Response: UserResponse[] -- full user objects for all of user 1's connections

POST /api/riders/add
  Request body: { "userId": 1, "riderId": 2 }
  Response: { "success": true }
  Notes: Idempotent -- checks for duplicate before creating

POST /api/riders/remove
  Request body: { "userId": 1, "riderId": 2 }
  Response: { "success": true }

================================================================================
10. DATABASE SCHEMA
================================================================================

H2 auto-creates these tables on startup from Java entity classes.
No SQL files or migration scripts are needed.

TABLE: users
  id          BIGINT        PRIMARY KEY  AUTO_INCREMENT
  email       VARCHAR(255)  UNIQUE       NOT NULL
  password    VARCHAR(255)               NOT NULL  (BCrypt hash)
  username    VARCHAR(255)  UNIQUE
  mobile      VARCHAR(255)
  address     VARCHAR(255)
  lat         DOUBLE
  lng         DOUBLE
  created_at  TIMESTAMP                  NOT NULL  (auto-set on insert)

TABLE: rides
  id                BIGINT        PRIMARY KEY  AUTO_INCREMENT
  user_id           BIGINT
  from_name         VARCHAR(255)
  from_lat          DOUBLE
  from_lng          DOUBLE
  destination_name  VARCHAR(255)
  destination_lat   DOUBLE
  destination_lng   DOUBLE
  route_coordinates TEXT                       (JSON: [[lng,lat], ...])
  route_steps       TEXT                       (JSON: [...step objects...])
  distance_meters   DOUBLE
  duration_seconds  DOUBLE
  ride_type         VARCHAR(255)               (e.g. "solo")
  status            VARCHAR(255)               ("active" or "completed")
  created_at        TIMESTAMP                  (auto-set on insert, not updatable)
  ended_at          TIMESTAMP                  (set when status -> "completed")

TABLE: connections
  id                 BIGINT        PRIMARY KEY  AUTO_INCREMENT
  user_id            BIGINT                     NOT NULL
  connected_user_id  BIGINT                     NOT NULL
  created_at         TIMESTAMP                  (auto-set on insert)

TABLE: location_updates
  id           BIGINT        PRIMARY KEY  AUTO_INCREMENT
  ride_id      BIGINT                     NOT NULL
  lat          DOUBLE                     NOT NULL
  lng          DOUBLE                     NOT NULL
  captured_at  VARCHAR(255)               (ISO 8601 from client device)
  received_at  TIMESTAMP                  (auto-set on insert by server)

To switch to PostgreSQL (for production):
  1. In pom.xml: uncomment the postgresql dependency, comment out h2
  2. In application.properties: comment out the H2 block, uncomment PostgreSQL block
  3. In application.properties: change platform to PostgreSQLDialect
  No code changes are required -- just config changes.

================================================================================
11. HOW FRONTEND AND BACKEND TALK
================================================================================

THE VITE PROXY
  Configured in: frontend/vite.config.js

    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false
        }
      }
    }

  What this does:
  The browser never directly contacts port 8080. Every fetch to /api/* from
  the React app is intercepted by Vite and forwarded to localhost:8080.
  This avoids all CORS browser blocks during development.

CORS ON THE BACKEND
  Configured in: WebConfig.java
  Acts as a backup (for Postman, other frontends, production deployment).
  Allows origins: http://localhost:5173, http://localhost:3000
  Allows methods: GET, POST, PUT, PATCH, DELETE, OPTIONS

DATA FORMAT
  All data is JSON. Content-Type: application/json.
  Spring Boot uses Jackson to automatically:
    - Serialize Java objects -> JSON (responses)
    - Deserialize JSON -> Java DTOs (requests)

SESSION MANAGEMENT
  No JWT tokens, no cookies, no server-side sessions.

  Login/Signup flow:
    1. Backend returns UserResponse as JSON
    2. Frontend stores it in localStorage: "ridewise-user"
    3. AuthContext reads it back on every app load
    4. user.id (a Long/number from DB) is sent in all subsequent API calls

  Logout:
    Just clears the three localStorage keys and React state.
    No backend call needed.

================================================================================
12. KEY FEATURE: RIDE FLOW (END-TO-END)
================================================================================

STARTING A RIDE
  1. User clicks "Start a Ride" on Home page
     -> StartRideModal bottom sheet opens

  2. User types origin (e.g. "Chennai")
     -> geocode("Chennai") -> GET Nominatim API
     -> Returns: { lat: 13.0827, lng: 80.2707, name: "Chennai, Tamil Nadu, India" }

  3. User types destination (e.g. "Mahabalipuram")
     -> geocode("Mahabalipuram") -> GET Nominatim API
     -> Returns: { lat: 12.6269, lng: 80.1927, name: "..." }

  4. getRoute(from, to)
     -> GET https://router.project-osrm.org/route/v1/driving/{lng1,lat1};{lng2,lat2}
     -> Returns: { coordinates: [[lng,lat],...], distance: 55000, duration: 3600, steps: [...] }

  5. Mini map previews the planned route using MapLibre GL

  6. User clicks "Start Ride"
     -> createRide(rideData) -> POST /api/rides/
     -> RideService saves Ride entity with status="active"
     -> Returns RideResponse with id=7 (example)

  7. Home.jsx receives the created ride
     -> Sets mapRide = created ride
     -> Sets activeRide = created ride
     -> ActiveRideOverlay renders full screen

DURING A RIDE
  1. ActiveRideOverlay mounts
     -> Calls locationService.watchLocation(onGpsTick, onError)
     -> Browser requests GPS permission if not already granted
     -> GPS fires every ~1500ms (throttled by locationService)

  2. On each GPS tick (onGpsTick called with LocationObj):
     a. RideMap: move the blue GPS dot to new position
     b. RideMap: rotate dot to face direction of travel
        -> bearingBetween(prevLat, prevLng, newLat, newLng) -> heading degrees
        -> CSS transform: rotate({heading}deg)
     c. RideMap: trim the route line
        -> Find the route point nearest to current position
        -> Remove route line points behind the user
     d. Overlay: calculate remaining distance
        -> haversineDistance(currentLat, currentLng, destLat, destLng)
     e. Overlay: update speed display from location.speed (m/s -> km/h)
     f. Directions: find active step
        -> findActiveStep(steps, currentLat, currentLng)
        -> Highlight that step in DirectionsPanel
     g. Backend: updateUserLocation(rideId, lat, lng)
        -> POST /api/rides/7/location { lat, lng, timestamp }
        -> Fire-and-forget -- does not affect map if it fails

  3. DirectionsPanel always shows:
     - Current instruction (e.g. "Turn left onto Beach Road")
     - Distance to that turn (e.g. "350 m")
     - Next instruction preview

ENDING A RIDE
  1. User clicks "End Ride" button
  2. Confirmation prompt shown
  3. User confirms
     -> endRide(rideId) -> PATCH /api/rides/7/status { "status": "completed" }
     -> RideService: sets status="completed", endedAt=now()
     -> Returns updated RideResponse
  4. locationService.watchLocation cleanup: GPS tracking stops
  5. ActiveRideOverlay closes
  6. Home.jsx refreshes rides: getUserRides(userId)
     -> Completed ride now appears in history section

================================================================================
13. KEY FEATURE: AUTHENTICATION FLOW
================================================================================

SIGNUP JOURNEY
  1. User opens the app -> Login.jsx loads
  2. User clicks "Sign Up", fills email + password
  3. AuthContext.signup(email, password) is called
  4. Validates: email not empty, password >= 6 chars
  5. POST /api/auth/signup with { email: "user@test.com", password: "mypass" }
  6. AuthService:
     a. userRepository.existsByEmail(email) -> false? proceed
     b. passwordEncoder.encode("mypass") -> "$2a$10$hashvalue..."
     c. Creates new User entity, saves to H2 database
     d. Returns UserResponse { id: 1, email: "user@test.com", username: null, ... }
  7. AuthContext receives UserResponse
     a. Saves to localStorage: ridewise-user, ridewise-authenticated="true"
     b. Sets ridewise-onboarded="false" (no username yet)
     c. Sets React state: user, isAuthenticated=true, isFullyOnboarded=false
  8. ProtectedRoute detects isFullyOnboarded=false
     -> Redirects to /onboarding

ONBOARDING JOURNEY
  1. User fills in username, mobile, address on Onboarding.jsx
  2. Clicks "Use My Location"
     -> navigator.geolocation.getCurrentPosition() (one-shot GPS fix)
     -> Gets { latitude: 13.08, longitude: 80.27 }
  3. AuthContext.updateProfile({ username, mobile, address, lat: 13.08, lng: 80.27 })
  4. PATCH /api/auth/profile/1 with the update data
  5. AuthService: updates only non-null fields, saves, returns UserResponse
  6. AuthContext:
     a. Merges updated fields into existing user object
     b. Saves merged user to localStorage
     c. Sets ridewise-onboarded="true"
     d. isFullyOnboarded=true
  7. Navigate to /home

LOGIN JOURNEY
  1. User opens the app -> Login.jsx
  2. Fills email + password, clicks "Log In"
  3. AuthContext.login(email, password)
  4. POST /api/auth/login with credentials
  5. AuthService:
     a. userRepository.findByEmail(email) -> found User
     b. passwordEncoder.matches("mypass", "$2a$10$hashvalue...") -> true
     c. Returns UserResponse
  6. AuthContext saves to localStorage, sets React state
  7. If user has username: isFullyOnboarded=true -> navigate to /home
  8. If user has no username: isFullyOnboarded=false -> navigate to /onboarding

PASSWORD SECURITY
  BCrypt is a one-way hash function.
  Saving:    encode("mypassword")          -> "$2a$10$salt+hash..."
  Checking:  matches("mypassword", hash)   -> true or false
  The original password can NEVER be recovered from the hash.
  Even if someone steals the database, passwords remain safe.

================================================================================
14. KEY FEATURE: RIDERS AND CONNECTIONS
================================================================================

FINDING NEARBY RIDERS
  For "Near Me" to work, a user MUST have lat and lng stored in the database.
  These are set during onboarding when the user allows location access.

  The backend RidersService.getNearRiders(userId) uses a Haversine-based query:
    - Loads the requesting user's lat/lng from DB
    - Loads all other users with lat/lng stored
    - Calculates Haversine distance for each
    - Returns users within ~50km, sorted by distance (closest first)

ADDING A CONNECTION
  1. User is on the Riders page (Search, Near Me, or Connections tab)
  2. Clicks "Add" button next to a rider
  3. addRider(myUserId, theirUserId)
     -> POST /api/riders/add { "userId": 1, "riderId": 2 }
  4. RidersController passes to RidersService.addRider(1, 2)
  5. RidersService:
     a. connectionRepository.existsByUserIdAndConnectedUserId(1, 2)
     b. If already exists: return false (idempotent -- no error)
     c. If not: create Connection entity { userId:1, connectedUserId:2 }
                save to DB
                return true
  6. Controller returns { "success": true }
  7. Frontend:
     a. Shows green toast: "GokulaRider added!"
     b. Refreshes connections list: getConnectionsFull(myUserId)
     c. Rebuilds connectedIds Set from new connections
     d. "Add" button changes to "Remove" instantly

REMOVING A CONNECTION
  Same flow but calls removeRider() -> POST /api/riders/remove
  Backend deletes the Connection row from DB.
  Frontend shows red toast and refreshes list.

UI STATE FOR CONNECTIONS (how the button knows Add vs Remove)
  Riders.jsx builds a Set from the connections list:
    const connectedIds = new Set(connections.map(c => c.id))
  Then for each rider card:
    connectedIds.has(rider.id)  -> true = show "Remove", false = show "Add"
  This is instant (no API call needed) and always in sync with the latest
  connections list fetched from the backend.

================================================================================
15. MAPS AND ROUTING (EXTERNAL APIs)
================================================================================

NOMINATIM (Geocoding)
  What it does:  Converts a place name string into GPS coordinates
  URL:           https://nominatim.openstreetmap.org/search
  Cost:          Free, no API key required
  Rate limit:    Max 1 request per second (must be respected)
  Required:      User-Agent header must be set to identify your app
                 We use: "RideWise/1.0 (ridewise.app)"
  Example call:
    GET https://nominatim.openstreetmap.org/search?q=Chennai&format=json&limit=1
  Example response:
    [{ "display_name": "Chennai, Tamil Nadu, India",
       "lat": "13.0826802", "lon": "80.2707184", ... }]
  Our wrapper: geocode("Chennai") -> { name: "Chennai, Tamil Nadu, India",
                                       lat: 13.0827, lng: 80.2707 }

OSRM (Road Routing)
  What it does:  Calculates the fastest driving route between two GPS points
  URL:           https://router.project-osrm.org/route/v1/driving
  Cost:          Free, no API key required
  Data source:   OpenStreetMap road network
  Example call:
    GET .../route/v1/driving/80.2707,13.0827;80.1927,12.6269
        ?overview=full&geometries=geojson&steps=true
  Parameters used:
    overview=full     -> return complete route geometry (not simplified)
    geometries=geojson -> coordinates as [[lng,lat],...] GeoJSON format
    steps=true        -> include turn-by-turn maneuver steps
  Example response structure:
    {
      "code": "Ok",
      "routes": [{
        "distance": 55000,           <- metres
        "duration": 3600,            <- seconds
        "geometry": {
          "coordinates": [[80.27,13.08],[80.25,13.01],...] <- [lng,lat] pairs
        },
        "legs": [{
          "steps": [
            { "maneuver": { "type": "depart", "location": [80.27,13.08] },
              "name": "Anna Salai", "distance": 500, "duration": 60 },
            { "maneuver": { "type": "turn", "modifier": "left" },
              "name": "Beach Road", "distance": 350, "duration": 42 },
            ...
          ]
        }]
      }]
    }
  Our wrapper: getRoute(from, to) -> { coordinates, distance, duration, steps }

MAPLIBRE GL
  What it does:  Renders interactive maps in the browser
  Package:       maplibre-gl@^6.7.0
  License:       Open-source (BSD 3-Clause) -- fork of Mapbox GL JS
  Cost:          Free, no API key required
  Tile source:   OpenStreetMap (or any compatible tile server)
  Used in:       RideMap.jsx

  Features we use:
    addSource / addLayer    -> Draw the route line (GeoJSON LineString)
    addSource / addLayer    -> Draw markers (GeoJSON Point features)
    map.flyTo()             -> Animate camera to fit the route
    map.fitBounds()         -> Zoom to show origin + destination
    CSS transform: rotate() -> Rotate GPS dot to face direction of travel
    setData()               -> Update route line as user progresses

  Coordinate note:
    MapLibre, OSRM, and GeoJSON all use [longitude, latitude] order.
    Our internal { lat, lng } objects use latitude first.
    The conversion only happens at the boundary (when building GeoJSON).

================================================================================
16. WHAT IS DONE VS. WHAT IS NEXT
================================================================================

COMPLETED FEATURES
------------------

Authentication
  [x] User signup with email + password (BCrypt hashed on backend)
  [x] User login with email + password (BCrypt verification)
  [x] Persistent session via localStorage (survives page refresh)
  [x] Logout (clears state + localStorage)
  [x] Profile onboarding (username, mobile, address, GPS location)
  [x] Profile editing on Account page

App Experience
  [x] Theme system: light / dark / warm / midnight themes
  [x] Voice command system (Web Speech API)
  [x] Responsive layout: desktop sidebar + mobile top/bottom nav
  [x] Protected routes with auth guard (ProtectedRoute component)
  [x] Mouse glow cursor effect on Home page

Riders Community
  [x] Search riders by username or email
  [x] Find nearby riders (within ~50km using stored GPS)
  [x] Add a rider connection
  [x] Remove a rider connection
  [x] View all connections
  [x] Instant UI toggle (Add/Remove button) without extra API calls

Rides
  [x] Create a ride with origin + destination (geocoded to coordinates)
  [x] Route calculation via OSRM (real road-accurate path)
  [x] Route preview on mini map before starting
  [x] Full-screen live ride map (MapLibre GL)
  [x] Real-time GPS dot tracking during a ride (throttled to 1.5s)
  [x] GPS dot rotates to face direction of travel
  [x] Route line trims progressively as user moves forward
  [x] Turn-by-turn navigation panel (DirectionsPanel)
  [x] Current speed display (m/s converted to km/h)
  [x] Remaining distance to destination (Haversine formula)
  [x] Estimated time to arrival display
  [x] End a ride (marks "completed" in DB, sets ended_at timestamp)
  [x] Ride history list on Home page
  [x] View any past ride's route on the map
  [x] Delete a ride from history (removes from DB)
  [x] GPS track stored on backend (location_updates table)
  [x] Offline fallback via localStorage (works without backend running)


IN PROGRESS / PLANNED FEATURES
-------------------------------

Database
  [ ] Switch from H2 to PostgreSQL for data persistence across restarts

Ride Features
  [ ] Route deviation detection (alert when rider goes significantly off-route)
  [ ] Ride replay (animate the actual GPS track from location_updates table)
  [ ] Ride statistics (average speed, max speed, elevation, personal bests)
  [ ] Pause and resume a ride

Social Features
  [ ] Group rides (real-time location sharing between connected riders on same ride)
  [ ] Push notifications (alert connected riders when you start a ride)

Authentication
  [ ] JWT token authentication (replace localStorage-only session with proper tokens)
  [ ] Password reset / forgot password flow
  [ ] Email verification on signup

Profile
  [ ] Motorcycle/vehicle profile (make, model, year, engine size)
  [ ] Profile photo upload
  [ ] Bio / about me section

================================================================================
END OF DOCUMENT
Generated by reading all source files in the RideWise project.
September 2026
================================================================================
