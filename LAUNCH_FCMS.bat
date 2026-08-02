@echo off
setlocal EnableDelayedExpansion
title FCMS Pro v4
color 0B
cls

echo.
echo  ================================================
echo    FCMS Pro v4 - Freelance Commission Manager
echo  ================================================
echo.

:: Change to the directory of this .bat file (critical for extracted zips)
cd /d "%~dp0"

set PORT=8080
set URL=http://localhost:%PORT%
set FOUND=0

:: ── CHECK PYTHON 3 ─────────────────────────────────────────────
where python >nul 2>&1
if %errorlevel%==0 (
  python -c "import sys; exit(0 if sys.version_info.major==3 else 1)" >nul 2>&1
  if !errorlevel!==0 (
    set FOUND=1
    echo  [OK] Python 3 found
    echo  Starting server on %URL%
    echo.
    echo  ------------------------------------------------
    echo   Open your browser to: %URL%
    echo   Press Ctrl+C here to stop the server
    echo  ------------------------------------------------
    echo.
    :: Wait 2 seconds then open browser in background
    start "" cmd /c "timeout /t 2 /nobreak >nul && start \"\" \"%URL%\""
    python -m http.server %PORT%
    goto end
  )
)

:: ── CHECK PYTHON3 COMMAND ──────────────────────────────────────
where python3 >nul 2>&1
if %errorlevel%==0 (
  set FOUND=1
  echo  [OK] Python3 found
  echo  Starting server on %URL%
  echo.
  echo  ------------------------------------------------
  echo   Open your browser to: %URL%
  echo   Press Ctrl+C here to stop the server
  echo  ------------------------------------------------
  echo.
  start "" cmd /c "timeout /t 2 /nobreak >nul && start \"\" \"%URL%\""
  python3 -m http.server %PORT%
  goto end
)

:: ── CHECK NODE / NPX ───────────────────────────────────────────
where npx >nul 2>&1
if %errorlevel%==0 (
  set FOUND=1
  echo  [OK] Node.js / npx found
  echo  Starting server on %URL%
  echo.
  echo  ------------------------------------------------
  echo   Open your browser to: %URL%
  echo   Press Ctrl+C here to stop the server
  echo  ------------------------------------------------
  echo.
  start "" cmd /c "timeout /t 3 /nobreak >nul && start \"\" \"%URL%\""
  npx --yes serve -l %PORT% .
  goto end
)

:: ── CHECK PHP ──────────────────────────────────────────────────
where php >nul 2>&1
if %errorlevel%==0 (
  set FOUND=1
  echo  [OK] PHP found
  echo  Starting server on %URL%
  echo.
  echo  ------------------------------------------------
  echo   Open your browser to: %URL%
  echo   Press Ctrl+C here to stop the server
  echo  ------------------------------------------------
  echo.
  start "" cmd /c "timeout /t 2 /nobreak >nul && start \"\" \"%URL%\""
  php -S localhost:%PORT%
  goto end
)

:: ── NOTHING FOUND ─────────────────────────────────────────────
if %FOUND%==0 (
  echo.
  echo  [!] No server runtime found on this computer.
  echo.
  echo  To run FCMS Pro you need one of:
  echo.
  echo    Python 3   - https://www.python.org/downloads/
  echo    Node.js    - https://nodejs.org/
  echo    PHP        - https://www.php.net/downloads/
  echo    XAMPP      - https://www.apachefriends.org/
  echo.
  echo  OR: Open VS Code, install "Live Server" extension,
  echo      right-click index.html and click "Open with Live Server"
  echo.
  echo  ------------------------------------------------
  echo   Trying to open index.html directly...
  echo   (Some features need a server to work)
  echo  ------------------------------------------------
  echo.
  start "" "%~dp0index.html"
)

:end
echo.
echo  Server stopped.
pause
