#!/usr/bin/env bash
# ============================================================
# RideWise - Linux/macOS setup entry point
#
# This file is a thin wrapper. All the real work lives in
# setup.py, the single setup file for every platform:
#     ./setup.sh            ->  python3 setup.py
#     ./setup.sh --check    ->  python3 setup.py --check
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Python 3.8+ is required. Install it from https://python.org and try again." >&2
  exit 1
fi

exec "$PYTHON" "$ROOT_DIR/setup.py" "$@"
