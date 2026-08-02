# FCMS Pro

FCMS Pro is a browser-based Freelance Commission Management System built for freelancers who need to track clients, commissions, payments, and money in and out without setting up a full server stack. It runs as a Progressive Web App, works fully offline using IndexedDB for storage, and can optionally connect to a small PHP backend for server-rendered receipts, CSV exports, and email sending.

## Features

- **Client management** - store client details, contact information, and history in one place
- **Commissions and quotes** - create quotes, convert them into commissions, and track status from start to delivery
- **Payments and invoices** - log partial or full payments, generate invoices, and see outstanding balances at a glance
- **Receipts** - generate printable receipts as HTML or as downloadable canvas images, with a verification code on each one
- **Expenses and goals** - track business expenses and set monthly or yearly income goals
- **Dashboard and analytics** - a quick overview of income, pending payments, and recent activity
- **Backup and restore** - export all data to a single JSON file and re-import it later
- **Offline-first PWA** - installs to your desktop or phone and works without an internet connection
- **Local authentication** - single admin account with a hashed password, session expiry, and lockout after repeated failed logins

## Tech stack

- Vanilla JavaScript (no framework, no build step)
- IndexedDB for local data storage
- HTML and CSS for the interface
- A small PHP backend (optional) for receipt and invoice PDF-style printing, CSV export, and email delivery
- Service worker and web manifest for PWA support

## Getting started

FCMS Pro needs a local web server to run correctly, since browsers restrict some features (like IndexedDB and the service worker) when a page is opened directly from disk.

### Option 1: Use the launch script

Windows:
```
LAUNCH_FCMS.bat
```

Mac or Linux:
```
./launch_fcms.sh
```

The script looks for Python, Node, or PHP already installed on your machine, starts a local server on port 8080, and opens the app in your browser automatically.

### Option 2: Start a server manually

Using Python:
```
python -m http.server 8080
```

Using PHP:
```
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

On first run, you will be asked to create an admin account. This account is stored locally in your browser's IndexedDB and is not sent anywhere.

## Optional PHP backend

The `php/` folder adds a few server-side conveniences: printable HTML receipts, invoices, and quotes, CSV export streaming, and email sending through PHP's built-in `mail()` function. None of these are required for the app to work. Details and endpoint documentation are in `php/README.md`.

## Project structure

```
fcms-pro/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── main.css
├── icons/
│   └── icon.svg
├── js/
│   ├── app.js
│   ├── modules/        # one file per feature area (clients, commissions, payments, etc.)
│   └── utils/          # shared helpers, database access, auth, and modal logic
├── php/
│   ├── api.php
│   ├── ping.php
│   └── README.md
├── LAUNCH_FCMS.bat
└── launch_fcms.sh
```

## Data and privacy

All data is stored locally in your browser's IndexedDB. Nothing is sent to an external server unless you configure and use the optional PHP email feature. Regular backups are recommended since clearing your browser data will remove everything stored in the app.

## License

No license has been added yet. Add one here if you plan to share or open source this project.
