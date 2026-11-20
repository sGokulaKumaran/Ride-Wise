# RideWise Deployment Guide

This guide covers deploying RideWise to production using Docker, standalone JAR + static hosting, or the $0/month Cloudflare Pages + Render + Aiven stack.

---

## 1. Docker (Backend)

The repository includes a multi-stage Dockerfile at [`backend/ridewise/Dockerfile`](../backend/ridewise/Dockerfile) that builds the Spring Boot JAR with Maven (`maven:3.9-eclipse-temurin-21`) and runs it on `eclipse-temurin:21-jre`.

```bash
# Build the backend image
docker build -t ridewise-backend ./backend/ridewise

# Run against an external PostgreSQL 15+ database
docker run -d --name ridewise-backend -p 8080:8080 \
  -e DATABASE_URL="jdbc:postgresql://your-db-host:5432/ridewise" \
  -e DB_USERNAME="postgres" \
  -e DB_PASSWORD="your-strong-db-password" \
  -e RIDEWISE_ADMIN_EMAIL="admin@yourdomain.com" \
  -e RIDEWISE_ADMIN_PASSWORD="YourStrongAdminPassword!" \
  -e RIDEWISE_ALLOWED_ORIGINS="https://your-frontend-domain.com" \
  ridewise-backend
```

---

## 2. Production Builds (Without Docker)

### Backend JAR

```bash
cd backend/ridewise
./mvnw package         # Windows: .\mvnw.cmd package
```

Run the generated artifact with your environment variables exported:

```bash
java -jar target/ridewise-0.0.1-SNAPSHOT.jar
```

### Frontend Static Bundle

```bash
cd frontend
npm install
npm run build          # outputs static assets to frontend/dist/
npm run preview        # optional local preview of the built bundle
```

---

## 3. Cloudflare Pages + Render + Aiven (Live Stack Architecture)

The live deployment at `ride-wise.pages.dev` uses:

1. **PostgreSQL:** Aiven Free PostgreSQL 15+ (or any managed PostgreSQL 15+ instance).
2. **Backend:** Render Web Service pointing to `backend/ridewise/Dockerfile`, with `DATABASE_URL`, `DB_USERNAME`, `DB_PASSWORD`, `RIDEWISE_ADMIN_EMAIL`, `RIDEWISE_ADMIN_PASSWORD`, and `RIDEWISE_ALLOWED_ORIGINS` set in Render's environment settings.
3. **Frontend + Edge Proxy:** Cloudflare Pages serving `frontend/dist` alongside two Cloudflare Pages Functions:
   - [`frontend/functions/api/[[path]].js`](../frontend/functions/api/%5B%5Bpath%5D%5D.js) — proxies `/api/*` to the Render backend.
   - [`frontend/functions/ws/[[path]].js`](../frontend/functions/ws/%5B%5Bpath%5D%5D.js) — proxies WebSocket upgrades on `/ws/*` to the Render backend.

> [!IMPORTANT]
> If you fork and deploy your own Cloudflare Pages instance, update the `BACKEND` constant in **both** `frontend/functions/api/[[path]].js` and `frontend/functions/ws/[[path]].js` to point to your own backend URL!
> Keeping `/api/*` and `/ws/*` on the same origin ensures the `SESSION` cookie stays first-party (`SameSite=Lax`).

---

## 4. Pre-Launch Security Checklist

- [ ] **Change default admin credentials:** Set `RIDEWISE_ADMIN_EMAIL` and `RIDEWISE_ADMIN_PASSWORD` before first boot on a public server so `DataInitializer` never seeds the default `Admin@123` password.
- [ ] **Lock down origins:** Set `RIDEWISE_ALLOWED_ORIGINS` to your exact production frontend domain(s).
- [ ] **Serve over HTTPS:** Both browser Geolocation (`navigator.geolocation`) and Screen Wake Lock require HTTPS in production.
- [ ] **Review map provider terms:** If launching a commercial service rather than a personal/educational deployment, switch off non-commercial free tiers (Stadia Free, Esri public World Imagery, public OSRM/Nominatim demos) to commercial plans or self-hosted instances. See [MAPS_AND_LICENSING.md](MAPS_AND_LICENSING.md).
