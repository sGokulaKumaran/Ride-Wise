# ============================================================
# RideWise - Windows setup entry point
#
# This file is a thin wrapper. All the real work lives in
# setup.py, the single setup file for every platform:
#     .\setup.ps1            ->  py setup.py
#     .\setup.ps1 --check    ->  py setup.py --check
# ============================================================

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$setup = Join-Path $root "setup.py"

$python = $null
foreach ($candidate in @("py", "python", "python3")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $python = $candidate
        break
    }
}

if (-not $python) {
    Write-Host "Python 3.8+ is required. Install it from https://python.org and try again." -ForegroundColor Red
    exit 1
}

if ($python -eq "py") {
    & py -3 $setup @args
} else {
    & $python $setup @args
}

exit $LASTEXITCODE
