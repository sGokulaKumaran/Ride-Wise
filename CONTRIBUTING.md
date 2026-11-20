# Contributing to RideWise

Thanks for taking the time to contribute. RideWise is a full-stack platform —
navigation engine, real-time group rides, and multi-tenant fleet tracking — and
there is useful work at every level, from a typo in the docs to a new WebSocket
handler.

By submitting a pull request you agree that your contribution is licensed under
the [GNU AGPL-3.0](LICENSE), the same licence as the rest of the project
(inbound = outbound, no CLA required).

---

## Before you start

| | |
|---|---|
| **Bug report / feature idea** | Open an issue first. Describe what you expected, what happened, and how to reproduce it. |
| **Security problem** | **Do not open a public issue.** Email the maintainer directly (see the GitHub profile) and give us time to fix it. |
| **Large change** | Open an issue or draft PR *before* writing the code, so we can agree on the approach. |
| **Small fix** | Just send the PR. |

---

## 1. Set up the project

You need **Java 21+** and **Node.js 20.19+ / 22.12+** (Node 22 LTS recommended, required by Vite 8). PostgreSQL 15+ is optional — the backend
can run on its in-memory H2 test configuration.

```bash
git clone https://github.com/sGokulaKumaran/Ride-Wise.git
cd Ride-Wise
python3 setup.py          # Windows: py setup.py
```

`setup.py` checks your tools and installs both backend and frontend
dependencies. It is the only setup file you need.

Then run the two servers:

```bash
# Terminal 1 — backend (H2 test configuration on :8080)
cd backend/ridewise
./mvnw spring-boot:test-run      # Windows: mvnw.cmd spring-boot:test-run

# Terminal 2 — frontend (Vite on :5173, proxies /api and /ws to :8080)
cd frontend
npm run dev
```

Open <http://localhost:5173>.

For the full PostgreSQL setup, production builds, and troubleshooting, see [docs/SETUP.md](docs/SETUP.md).

---

## 2. Run the tests

Always run the relevant suite before opening a PR.

```bash
# Backend — Spring integration + WebSocket tests, isolated H2 database
cd backend/ridewise
./mvnw test

# Frontend — pure logic tests (navigation, places, fleet) via node --test
cd frontend
npm test
# Lint check (ESLint — separate from npm test)
npm run lint
```

Both suites must stay green. If you add behaviour, add a test for it:

- Backend: `backend/ridewise/src/test/java/...` (`AccountTests`, `RideFlowTests`,
  `RideLocationSocketTests`, `OrgFleetTests` are good models).
- Frontend: `frontend/tests/` — plain `node --test`, no framework needed.

---

## 3. Branch and commit

```
main              stable, deployable
feat/<short-name> new feature
fix/<short-name>  bug fix
docs/<short-name> documentation only
```

Commits should be small and say **what changed and why**:

```
fix: keep the session cookie alive after a Render restart
feat: add crowd level to fleet announcements
docs: correct the H2 preview port
```

Keep unrelated changes out of the same PR.

---

## 4. Pull request checklist

- [ ] The change is focused on one thing.
- [ ] `./mvnw test` passes (if backend changed).
- [ ] `npm test` and `npm run lint` pass (if frontend changed).
- [ ] New behaviour has a test.
- [ ] No secrets, tokens, passwords, or `.env` files are committed.
- [ ] No build output (`target/`, `dist/`, `node_modules/`) is committed.
- [ ] Screenshots or a short clip are attached for UI changes.
- [ ] The description explains the **why**, not only the **what**.

---

## 5. Code style

**Backend (Java)**
- Java 21, Spring Boot 3.4 conventions.
- Keep controllers thin; business rules belong in `service/`.
- Always enforce organization permissions through `OrgGuard`, never inline.
- Javadoc only where the *why* is not obvious from the code.

**Frontend (React)**
- Function components + hooks, no class components.
- Keep the navigation engine (`src/services/navigation.js`) pure and
  framework-free — it is shared by tests, solo rides, and fleet ETA maths.
- Styling uses the existing Tailwind tokens and theme classes (`tc.*`); do not
  hard-code colours.
- Accessibility matters: every interactive control needs a label, and the UI
  must work down to 320 px width.

**General**
- Match the style of the file you are editing.
- Prefer clear names over comments.
- Delete dead code rather than commenting it out.

---

## 6. Project layout

See the **Repository Blueprint** section of the [README](README.md#repository-blueprint).
In short:

```
backend/ridewise/   Spring Boot API, WebSockets, JPA entities, services
frontend/           React SPA, navigation engine, fleet dashboards
docs/               screenshots and the demo video used by the README
promo/              promo-video pipeline (git-ignored, not required to run the app)
```

---

## 7. Licence and credits

RideWise is released under the **GNU AGPL-3.0**. Contributions are accepted
under the same licence.

If you add a dependency, check that its licence is compatible and add it to
[`NOTICE`](NOTICE). Map data must always keep the
`© OpenStreetMap contributors` credit visible.
