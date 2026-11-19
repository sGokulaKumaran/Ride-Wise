#!/usr/bin/env bash
# ============================================================
# RideWise — One-Step Linux/macOS Dependency Setup (setup.sh)
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "  RideWise - One-Step Dependency Setup  "
echo "========================================"
echo ""

# 1. Check Java 21+
echo "[1/4] Checking Java JDK 21+..."
if ! command -v java >/dev/null 2>&1; then
  echo "  Error: Java is not installed. Please install Java JDK 21+ (https://adoptium.net)."
  exit 1
fi
echo "  Found: $(java -version 2>&1 | head -n 1)"

# 2. Check Node.js & npm
echo "[2/4] Checking Node.js & npm..."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "  Error: Node.js / npm not found. Please install Node.js 18+ (https://nodejs.org)."
  exit 1
fi
echo "  Found: Node $(node -v), npm $(npm -v)"

# 3. Install Backend Maven Dependencies
echo "[3/4] Resolving Backend (Spring Boot / Maven) dependencies..."
cd "$ROOT_DIR/backend/ridewise"
chmod +x ./mvnw
./mvnw dependency:resolve
echo "  Backend dependencies installed successfully."

# 4. Install Frontend npm Dependencies
echo "[4/4] Installing Frontend (React / Vite) dependencies..."
cd "$ROOT_DIR/frontend"
npm install
echo "  Frontend dependencies installed successfully."

echo ""
echo "========================================"
echo "  Setup Complete! Ready to run RideWise "
echo "========================================"
echo ""
echo "Start Backend (Instant H2 Preview, no PostgreSQL needed):"
echo "  cd backend/ridewise && ./mvnw spring-boot:test-run"
echo ""
echo "Start Backend (Full PostgreSQL mode):"
echo "  cd backend/ridewise && ./mvnw spring-boot:run"
echo ""
echo "Start Frontend (in a second terminal):"
echo "  cd frontend && npm run dev"
echo ""
