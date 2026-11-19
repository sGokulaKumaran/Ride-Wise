# ============================================================
# RideWise — One-Step Windows Dependency Setup (setup.ps1)
# Usage:
#   .\setup.ps1
# Or (if PowerShell script execution is restricted on Windows):
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
# ============================================================

$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RideWise - One-Step Dependency Setup  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-CommandExists($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# 1. Check Java 21+
Write-Host "[1/4] Checking Java JDK 21+..." -ForegroundColor Yellow
if (-not (Test-CommandExists "java")) {
    Write-Host "  Java not found." -ForegroundColor Red
    if (Test-CommandExists "winget") {
        $ans = Read-Host "  Install Eclipse Temurin JDK 21 via winget? (y/N)"
        if ($ans -match "^[yY]") {
            winget install --id EclipseAdoptium.Temurin.21.JDK -e --accept-source-agreements --accept-package-agreements
            Write-Host "  Java installed! Please restart your terminal and run .\setup.ps1 again." -ForegroundColor Green
            exit 0
        }
    }
    Write-Host "  Please install Java JDK 21+ from https://adoptium.net and re-run .\setup.ps1" -ForegroundColor Red
    exit 1
}
$javaVer = (java -version 2>&1 | Select-Object -First 1)
Write-Host "  Found: $javaVer" -ForegroundColor Green

# 2. Check Node.js & npm
Write-Host "[2/4] Checking Node.js & npm..." -ForegroundColor Yellow
if (-not (Test-CommandExists "node") -or -not (Test-CommandExists "npm")) {
    Write-Host "  Node.js / npm not found." -ForegroundColor Red
    if (Test-CommandExists "winget") {
        $ans = Read-Host "  Install Node.js LTS via winget? (y/N)"
        if ($ans -match "^[yY]") {
            winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
            Write-Host "  Node.js installed! Please restart your terminal and run .\setup.ps1 again." -ForegroundColor Green
            exit 0
        }
    }
    Write-Host "  Please install Node.js 18+ from https://nodejs.org and re-run .\setup.ps1" -ForegroundColor Red
    exit 1
}
$nodeVer = node -v
$npmVer = npm -v
Write-Host "  Found: Node $nodeVer, npm $npmVer" -ForegroundColor Green

# 3. Install Backend Maven Dependencies
Write-Host "[3/4] Resolving Backend (Spring Boot / Maven) dependencies..." -ForegroundColor Yellow
Push-Location (Join-Path $RootDir "backend\ridewise")
try {
    cmd.exe /c "mvnw.cmd dependency:resolve"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: dependency:resolve returned non-zero, but dependencies will auto-download on first run." -ForegroundColor Yellow
    } else {
        Write-Host "  Backend dependencies installed successfully." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# 4. Install Frontend npm Dependencies
Write-Host "[4/4] Installing Frontend (React / Vite) dependencies..." -ForegroundColor Yellow
Push-Location (Join-Path $RootDir "frontend")
try {
    cmd.exe /c "npm install"
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed. Please check the error above."
    }
    Write-Host "  Frontend dependencies installed successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete! Ready to run RideWise " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Start Backend (Instant H2 Preview, no PostgreSQL needed):" -ForegroundColor Cyan
Write-Host "  cd backend\ridewise ; .\mvnw.cmd spring-boot:test-run"
Write-Host ""
Write-Host "Start Backend (Full PostgreSQL mode):" -ForegroundColor Cyan
Write-Host "  cd backend\ridewise ; .\mvnw.cmd spring-boot:run"
Write-Host ""
Write-Host "Start Frontend (in a second terminal):" -ForegroundColor Cyan
Write-Host "  cd frontend ; npm run dev"
Write-Host ""
