#!/usr/bin/env python3
"""
RideWise - single-file setup for Windows, macOS and Linux.

Checks the required tools, optionally installs them, then installs every
backend (Maven) and frontend (npm) dependency.

Usage
-----
    python3 setup.py               # check tools, install dependencies
    python3 setup.py --check       # check tools only, change nothing
    python3 setup.py --yes         # never ask, auto-confirm installs
    python3 setup.py --no-tools    # never try to install Java/Node
    python3 setup.py --backend     # backend dependencies only
    python3 setup.py --frontend    # frontend dependencies only

Works from any directory. Exit code 0 means "ready to run".
"""

from __future__ import annotations

import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend" / "ridewise"
FRONTEND = ROOT / "frontend"

IS_WINDOWS = os.name == "nt"
MIN_JAVA = 21
MIN_NODE = 18

BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
BLUE = "\033[36m"
RESET = "\033[0m"


# --------------------------------------------------------------------------
# Output helpers (colours are disabled when the terminal does not support them)
# --------------------------------------------------------------------------
def _colour(text: str, code: str) -> str:
    if not sys.stdout.isatty():
        return text
    if IS_WINDOWS and not os.environ.get("WT_SESSION") and not os.environ.get("ANSICON"):
        return text
    return f"{code}{text}{RESET}"


def banner() -> None:
    line = "=" * 58
    print()
    print(_colour(line, BOLD))
    print(_colour("   RideWise - One-Step Dependency Setup", BOLD))
    print(_colour(line, BOLD))
    print()


def step(number: str, text: str) -> None:
    print(f"{_colour('[' + number + ']', BLUE)} {text}")


def ok(text: str) -> None:
    print(f"    {_colour('OK', GREEN)}  {text}")


def warn(text: str) -> None:
    print(f"    {_colour('!!', YELLOW)}  {text}")


def fail(text: str) -> None:
    print(f"    {_colour('XX', RED)}  {text}")


def note(text: str) -> None:
    print(f"        {_colour(text, DIM)}")


# --------------------------------------------------------------------------
# Process helpers
# --------------------------------------------------------------------------
def run(cmd: list[str], cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=capture,
        text=True,
        shell=False,
    )


def tool(name: str) -> str | None:
    """Return the resolved path of a command, or None."""
    candidates = [name]
    if IS_WINDOWS and not name.lower().endswith((".cmd", ".exe", ".bat")):
        candidates = [name + ".cmd", name + ".exe", name]
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    return None


def version_of(command: str, args: list[str]) -> str:
    try:
        result = run([command, *args], capture=True)
        return (result.stdout or "") + (result.stderr or "")
    except OSError:
        return ""


# --------------------------------------------------------------------------
# Version detection
# --------------------------------------------------------------------------
def java_major_version() -> int | None:
    java = tool("java")
    if not java:
        return None
    output = version_of(java, ["-version"])
    match = re.search(r'version "(\d+)(?:\.(\d+))?', output)
    if not match:
        return None
    major = int(match.group(1))
    # Java 8 and earlier report "1.8.0"
    if major == 1 and match.group(2):
        major = int(match.group(2))
    return major


def node_major_version() -> int | None:
    node = tool("node")
    if not node:
        return None
    output = version_of(node, ["-v"])
    match = re.search(r"v(\d+)", output)
    return int(match.group(1)) if match else None


# --------------------------------------------------------------------------
# Tool installation
# --------------------------------------------------------------------------
def detect_package_manager() -> str | None:
    if IS_WINDOWS:
        return "winget" if tool("winget") else None
    if platform.system() == "Darwin":
        return "brew" if tool("brew") else None
    for manager in ("apt-get", "dnf", "pacman", "zypper"):
        if tool(manager):
            return manager
    return None


def install_java() -> bool:
    manager = detect_package_manager()
    if not manager:
        return False
    if manager == "winget":
        cmd = ["winget", "install", "-e", "--id", "EclipseAdoptium.Temurin.21.JDK",
               "--accept-package-agreements", "--accept-source-agreements"]
    elif manager == "brew":
        cmd = ["brew", "install", "openjdk@21"]
    elif manager == "apt-get":
        cmd = ["sudo", "apt-get", "install", "-y", "openjdk-21-jdk"]
    elif manager == "dnf":
        cmd = ["sudo", "dnf", "install", "-y", "java-21-openjdk-devel"]
    elif manager == "pacman":
        cmd = ["sudo", "pacman", "-S", "--needed", "--noconfirm", "jdk21-openjdk"]
    else:  # zypper
        cmd = ["sudo", "zypper", "install", "-y", "java-21-openjdk-devel"]
    note(" ".join(cmd))
    return run(cmd).returncode == 0


def install_node() -> bool:
    manager = detect_package_manager()
    if not manager:
        return False
    if manager == "winget":
        cmd = ["winget", "install", "-e", "--id", "OpenJS.NodeJS.LTS",
               "--accept-package-agreements", "--accept-source-agreements"]
    elif manager == "brew":
        cmd = ["brew", "install", "node"]
    elif manager == "apt-get":
        cmd = ["sudo", "apt-get", "install", "-y", "nodejs", "npm"]
    elif manager == "dnf":
        cmd = ["sudo", "dnf", "install", "-y", "nodejs", "npm"]
    elif manager == "pacman":
        cmd = ["sudo", "pacman", "-S", "--needed", "--noconfirm", "nodejs", "npm"]
    else:  # zypper
        cmd = ["sudo", "zypper", "install", "-y", "nodejs20", "npm20"]
    note(" ".join(cmd))
    return run(cmd).returncode == 0


def ask(question: str, assume_yes: bool) -> bool:
    if assume_yes:
        return True
    if not sys.stdin.isatty():
        return False
    try:
        answer = input(f"    {question} [y/N] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return answer in {"y", "yes"}


# --------------------------------------------------------------------------
# Dependency installation
# --------------------------------------------------------------------------
def maven_wrapper() -> Path:
    wrapper = BACKEND / ("mvnw.cmd" if IS_WINDOWS else "mvnw")
    if not wrapper.exists():
        raise FileNotFoundError(f"Maven wrapper not found at {wrapper}")
    if not IS_WINDOWS:
        try:
            wrapper.chmod(wrapper.stat().st_mode | 0o111)
        except OSError:
            pass
    return wrapper


def install_backend() -> bool:
    print(f"    {_colour('->', BLUE)} Resolving backend dependencies (Spring Boot / Maven)...")
    if not BACKEND.is_dir():
        fail(f"Backend folder not found: {BACKEND}")
        return False
    try:
        wrapper = maven_wrapper()
    except FileNotFoundError as error:
        fail(str(error))
        return False
    result = run([str(wrapper), "-B", "dependency:resolve"], cwd=BACKEND)
    if result.returncode != 0:
        fail("Maven dependency resolution failed (see output above).")
        return False
    ok("Backend dependencies installed.")
    return True


def install_frontend() -> bool:
    print(f"    {_colour('->', BLUE)} Installing frontend dependencies (npm)...")
    npm = tool("npm")
    if not npm:
        fail("npm was not found.")
        return False
    if not FRONTEND.is_dir():
        fail(f"Frontend folder not found: {FRONTEND}")
        return False
    result = run([npm, "install"], cwd=FRONTEND)
    if result.returncode != 0:
        fail("npm install failed (see output above).")
        return False
    ok("Frontend dependencies installed.")
    return True


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Install every RideWise dependency with one command.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--check", action="store_true", help="check tools only, install nothing")
    parser.add_argument("--yes", action="store_true", help="auto-confirm tool installation")
    parser.add_argument("--no-tools", action="store_true", help="never install Java or Node automatically")
    parser.add_argument("--backend", action="store_true", help="backend dependencies only")
    parser.add_argument("--frontend", action="store_true", help="frontend dependencies only")
    args = parser.parse_args()

    banner()

    do_backend = not args.frontend or args.backend
    do_frontend = not args.backend or args.frontend

    # ---- 1. Python (only needed for this script) -------------------------
    step("1/4", "Checking Python...")
    if sys.version_info < (3, 8):
        fail(f"Python 3.8+ is required (found {platform.python_version()}).")
        return 1
    ok(f"Python {platform.python_version()}")

    # ---- 2. Java 21+ -----------------------------------------------------
    step("2/4", f"Checking Java {MIN_JAVA}+...")
    java_version = java_major_version()
    if java_version is None:
        warn("Java is not installed.")
        if args.check:
            fail("Install Java 21 LTS from https://adoptium.net and run this again.")
            return 1
        if args.no_tools or not ask("Install Java 21 LTS now?", args.yes):
            fail("Install Java 21 LTS from https://adoptium.net and run this again.")
            note("Windows/macOS: winget/brew can install it. Linux: your distribution package.")
            return 1
        if not install_java():
            fail("Automatic Java installation failed.")
            note("Install Java 21 manually from https://adoptium.net, then re-run setup.py.")
            return 1
        java_version = java_major_version()
        if java_version is None:
            warn("Java is installed but this terminal cannot see it yet.")
            note("Close this terminal, open a new one, and run setup.py again.")
            return 1
    if java_version < MIN_JAVA:
        fail(f"Java {java_version} found, but {MIN_JAVA}+ is required.")
        note("Install a newer JDK: https://adoptium.net")
        return 1
    ok(f"Java {java_version}")

    # ---- 3. Node 18+ / npm ----------------------------------------------
    step("3/4", f"Checking Node.js {MIN_NODE}+ and npm...")
    node_version = node_major_version()
    npm_path = tool("npm")
    if node_version is None or npm_path is None:
        warn("Node.js / npm is not installed.")
        if args.check:
            fail("Install Node.js 18+ from https://nodejs.org and run this again.")
            return 1
        if args.no_tools or not ask("Install Node.js LTS now?", args.yes):
            fail("Install Node.js 18+ from https://nodejs.org and run this again.")
            return 1
        if not install_node():
            fail("Automatic Node.js installation failed.")
            note("Install Node.js 18+ from https://nodejs.org, then re-run setup.py.")
            return 1
        node_version = node_major_version()
        npm_path = tool("npm")
        if node_version is None or npm_path is None:
            warn("Node.js is installed but this terminal cannot see it yet.")
            note("Close this terminal, open a new one, and run setup.py again.")
            return 1
    if node_version < MIN_NODE:
        fail(f"Node.js {node_version} found, but {MIN_NODE}+ is required.")
        note("Install a newer Node.js: https://nodejs.org")
        return 1
    ok(f"Node {node_version}, npm {version_of(npm_path, ['-v']).strip()}")

    if args.check:
        print()
        ok("All required tools are installed.")
        return 0

    # ---- 4. Project dependencies ----------------------------------------
    step("4/4", "Installing project dependencies...")
    if do_backend and not install_backend():
        return 1
    if do_frontend and not install_frontend():
        return 1

    # ---- Done ------------------------------------------------------------
    print()
    print(_colour("=" * 58, BOLD))
    print(_colour("  Setup complete - RideWise is ready to run", GREEN + BOLD))
    print(_colour("=" * 58, BOLD))
    print()
    print("Terminal 1 - backend (in-memory H2, no PostgreSQL needed):")
    if IS_WINDOWS:
        print("  cd backend\\ridewise")
        print("  mvnw.cmd spring-boot:test-run")
    else:
        print("  cd backend/ridewise")
        print("  ./mvnw spring-boot:test-run")
    print()
    print("Terminal 2 - frontend:")
    print("  cd frontend")
    print("  npm run dev")
    print()
    print("Then open http://localhost:5173")
    print()
    print(_colour("PostgreSQL mode:", BOLD))
    print("  export DATABASE_URL=jdbc:postgresql://localhost:5432/ridewise")
    print("  export DB_USERNAME=postgres")
    print("  export DB_PASSWORD=your_password")
    print("  cd backend/ridewise && ./mvnw spring-boot:run")
    print()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        warn("Setup cancelled.")
        sys.exit(130)
