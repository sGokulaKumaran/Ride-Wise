# Frontend ↔ Backend Connection — Change Summary

## Files Changed

### 1. [`vite.config.js`](file:///E:/My%20projects/RideWise/frontend/vite.config.js)
**What changed:** Added a `server.proxy` block.

```diff
+ server: {
+   proxy: {
+     '/api': {
+       target: 'http://localhost:8080',
+       changeOrigin: true,
+       secure: false,
+     }
+   }
+ }
```

**Why:** Every `/api/*` fetch in the React app is now transparently forwarded to the Spring Boot backend on port 8080 by the Vite dev server. This means the frontend never needs to hardcode `http://localhost:8080` in fetch URLs — a simple `/api/auth/login` call works everywhere.

---

### 2. [`src/context/AuthContext.jsx`](file:///E:/My%20projects/RideWise/frontend/src/context/AuthContext.jsx)
**What changed:** Completely rewrote `signup`, `login`, and `updateProfile` to call the real backend instead of reading/writing localStorage.

| Function | Before | After |
|---|---|---|
| `signup` | Wrote account to `localStorage` | `POST /api/auth/signup` |
| `login` | Read from `localStorage`, compared plain-text passwords | `POST /api/auth/login` |
| `updateProfile` | Updated `localStorage` records | `PATCH /api/auth/profile/{userId}` |

**What stayed the same:**
- Session persistence still uses `localStorage` (`ridewise-user`, `ridewise-authenticated`, `ridewise-onboarded`) so the user stays logged in on page refresh.
- `logout()` still just clears localStorage + React state.
- All pages that use `useAuth()` are **unchanged** — the API is identical.

**Key additions:**
- `handleResponse(res)` helper parses error messages from non-2xx backend responses and throws them as readable `Error` objects.
- `user.id` is now a `Long` (number) from the database instead of a `"u_<timestamp>_<random>"` string — this is the real DB primary key used for all subsequent API calls.

---

### 3. [`src/services/ridersApi.js`](file:///E:/My%20projects/RideWise/frontend/src/services/ridersApi.js)
**What changed:** Completely rewrote all functions to call the real backend instead of reading/writing localStorage.

| Function | Before | After |
|---|---|---|
| `searchRiders` | Filtered `localStorage` accounts | `GET /api/riders/search?query=&userId=` |
| `addRider` | Pushed to a localStorage connections array | `POST /api/riders/add { userId, riderId }` |
| `removeRider` | Filtered localStorage connections array | `POST /api/riders/remove { userId, riderId }` |
| `getConnectionsFull` | Cross-referenced two localStorage keys | `GET /api/riders/connections?userId=` |
| `getNearRiders` | Ran Haversine on all localStorage accounts | `GET /api/riders/nearby?userId=` |
| `isConnected` | Read from localStorage | **Removed** — replaced with a local Set in `Riders.jsx` |
| `getAllRidersCount` | Counted localStorage accounts | **No-op** — no matching backend endpoint yet |

---

### 4. [`src/pages/Riders.jsx`](file:///E:/My%20projects/RideWise/frontend/src/pages/Riders.jsx)
**What changed:** Removed the `isConnected` import (API signature changed) and replaced all calls with a locally-derived `connectedIds` Set.

```diff
- import { ..., isConnected } from "../services/ridersApi";
+ import { ... } from "../services/ridersApi";

+ const connectedIds = new Set(connections.map((c) => c.id));

- isConnected(currentUserId, rider.id)
+ connectedIds.has(rider.id)
```

Also wrapped `handleAdd` and `handleRemove` in `try/catch` so backend errors are shown as toast messages instead of crashing the page.

---

### Backend fix (bonus): [`WebConfig.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/config/WebConfig.java)
**What changed:** Added `PATCH` to the CORS `allowedMethods` list.

```diff
- .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
+ .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
```

**Why:** The `PATCH /api/auth/profile/{userId}` call (used by Onboarding + Account edit) was missing from CORS, which would have caused it to be blocked by the browser preflight check.

---

## How to Run

1. **Start the backend** (Spring Boot on port 8080):
   ```powershell
   cd "E:\My projects\RideWise\backend\ridewise"
   ./mvnw spring-boot:run
   ```

2. **Start the frontend** (Vite on port 5173):
   ```powershell
   cd "E:\My projects\RideWise\frontend"
   npm run dev
   ```

3. Open `http://localhost:5173` — all API calls will proxy to `localhost:8080` automatically.

> [!NOTE]
> The backend uses an **in-memory H2 database** by default. All data resets when the backend restarts. To switch to PostgreSQL, see `application.properties`.
