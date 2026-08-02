#!/usr/bin/env bash
# FCMS Pro v4 - Launch Script (Mac / Linux)

PORT=8080
URL="http://localhost:$PORT"
DIR="$(cd "$(dirname "$0")" && pwd)"
FOUND=0

echo ""
echo "  ================================================"
echo "   FCMS Pro v4 - Freelance Commission Manager"
echo "  ================================================"
echo ""

cd "$DIR"

open_browser() {
  sleep 2
  if command -v xdg-open &>/dev/null; then xdg-open "$URL"
  elif command -v open &>/dev/null; then open "$URL"
  elif command -v sensible-browser &>/dev/null; then sensible-browser "$URL"
  else echo "  Open your browser to: $URL"
  fi
}

# Try Python 3
if command -v python3 &>/dev/null; then
  FOUND=1
  echo "  [OK] Python 3 found"
  echo "  Starting server at $URL"
  echo ""
  echo "  ------------------------------------------------"
  echo "   Browser will open automatically in 2 seconds"
  echo "   Press Ctrl+C to stop the server"
  echo "  ------------------------------------------------"
  echo ""
  open_browser &
  python3 -m http.server $PORT
  exit 0
fi

# Try python (could be 3)
if command -v python &>/dev/null; then
  PY_VER=$(python -c "import sys; print(sys.version_info.major)" 2>/dev/null)
  if [ "$PY_VER" = "3" ]; then
    FOUND=1
    echo "  [OK] Python 3 found"
    open_browser &
    python -m http.server $PORT
    exit 0
  elif [ "$PY_VER" = "2" ]; then
    FOUND=1
    echo "  [OK] Python 2 found"
    open_browser &
    python -m SimpleHTTPServer $PORT
    exit 0
  fi
fi

# Try PHP
if command -v php &>/dev/null; then
  FOUND=1
  echo "  [OK] PHP found"
  echo "  Starting server at $URL"
  open_browser &
  php -S "localhost:$PORT"
  exit 0
fi

# Try npx
if command -v npx &>/dev/null; then
  FOUND=1
  echo "  [OK] Node.js / npx found"
  echo "  Starting server at $URL"
  open_browser &
  npx --yes serve -l $PORT .
  exit 0
fi

# Nothing found
if [ $FOUND -eq 0 ]; then
  echo "  [!] No server runtime found."
  echo ""
  echo "  Install one of the following:"
  echo "    Python 3 : https://www.python.org/downloads/"
  echo "    Node.js  : https://nodejs.org/"
  echo "    PHP      : https://www.php.net/downloads/"
  echo ""
  echo "  Then run:  python3 -m http.server 8080"
  echo "  And open:  http://localhost:8080"
fi
