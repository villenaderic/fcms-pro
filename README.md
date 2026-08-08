# FCMS Pro

FCMS Pro is a browser-based client and commission management system built for freelancers, agencies, and small businesses who work with a wide range of clients, from individuals and startups to schools, nonprofits, government offices, and companies. It runs as a Progressive Web App, works fully offline using IndexedDB for storage, and can optionally connect to a small PHP backend for server-rendered receipts, CSV exports, and email sending.

## Features

- **Client management** - store client details, contact information, and history in one place
- **Client type tracking** - classify each client as an individual, business, government office, school, nonprofit, or startup, with filtering and a colored tag shown throughout the app
- **Client profile view** - a full activity timeline per client combining commissions, payments, and invoices, alongside lifetime totals and outstanding balance
- **Commissions and quotes** - create quotes, convert them into commissions, and track status from start to delivery, in either a table or a board (kanban) view
- **Recurring commissions** - mark a commission to repeat weekly, every two weeks, or monthly; the next occurrence is created automatically once the current one is marked Delivered
- **Payments and invoices** - log partial or full payments, generate invoices, and see outstanding balances at a glance
- **Overdue alerts** - overdue invoices and approaching commission deadlines both surface in the notification bell, with an at-a-glance day count on overdue invoice rows
- **Receipts** - generate printable receipts as HTML or as downloadable canvas images, with a verification code on each one
- **Expenses and goals** - track business expenses and set monthly or yearly income goals
- **Dashboard and analytics** - a quick overview of income, pending payments, and recent activity
- **Backup and restore** - export all data to a single JSON file and re-import it later
- **Offline-first PWA** - installs to your desktop or phone and works without an internet connection
- **Local authentication** - single admin account with a hashed password, session expiry, and lockout after repeated failed logins
- **Keyboard shortcuts** - press `/` to search, `?` to see all shortcuts, and two-key sequences (like `gc` for Clients or `nw` for a new commission) to jump around quickly
- **Breadcrumb navigation** - always shows where you are in the app, including the active tab within Settings

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

## Troubleshooting

**Windows blocks the downloaded file with "Smart App Control blocked a file that may be unsafe"**

This is a Windows 11 security feature that flags any downloaded `.zip` or `.bat` file it does not recognize, not something specific to FCMS Pro. To get past it:

1. Right-click the downloaded file and choose **Properties**
2. At the bottom of the General tab, check the **Unblock** box, then **Apply**
3. Extract or run the file normally

If there is no Unblock checkbox, Smart App Control is set to a strict mode. Open **Windows Security → App & browser control → Smart App Control settings** and switch it to **Evaluation** or **Off**, then unblock the file as above.

## Changelog

**Latest**
- Added a custom accent color picker to Settings → Appearance, with six presets
  plus a full custom color option, applied instantly across the whole app
- Grouped the notification bell into Overdue, Today, This Week, and Later
  sections instead of one flat list
- Fixed two real inconsistencies found while standardizing status colors: quote
  statuses "Accepted", "Declined", and "Expired" had no color mapping and all
  rendered as the same blue chip, and the commission status pills used
  hardcoded colors that did not adapt to light mode. Both now follow one
  consistent, theme-aware color system
- Added a visual status timeline (Pending → In Progress → Revision → Completed
  → Delivered) to the commission edit form, updating live as the status changes
- Added a theme toggle inside the profile dropdown menu, skeleton loading
  placeholders while a page's data loads, and finished a full tooltip pass on
  every remaining icon-only button in the app
- Started implementing the roadmap: sticky table headers, a compact/comfortable
  density mode (Settings → Appearance), clickable breadcrumb segments, animated
  count-up numbers on the dashboard KPI cards, redesigned toast notifications as
  compact Material-style snackbars, and a collapsible icon-only sidebar mode
- Restyled the whole app toward a cleaner, Google Workspace Admin Console look: light mode is now the default, the color palette was refined to match that clean gray-and-blue aesthetic, the active sidebar item is now a simple highlighted pill instead of a bar-and-tint combination, and breadcrumbs now use normal-case text with a chevron separator (for example "Clients › Profile") instead of uppercase text with a slash
- Redesigned the login and setup screens as a split layout with a background image and a short feature highlight, replacing the plain centered card
- Renamed every "CSV" export button to "Export to Excel" with a plain-language tooltip, and removed the arrow-only icon buttons on Backup, Analytics, and Receipts in favor of readable labels like "Download Full Backup" and "Save as Image"
- Broadened the app's focus beyond freelance/creative work: added client type classification (individual, business, government, school, nonprofit, startup), and expanded the default service type list to include consulting, software development, admin work, training, and support
- Added breadcrumb navigation showing the current page and, within Settings, the active tab
- Replaced the placeholder text logo with a proper mark, applied consistently across the sidebar, login and setup screens, the app icon, and printed invoices
- Improved the printed invoice letterhead with business address, contact details, and tax ID, and added an optional PO / reference number field for clients that require one
- Fixed the sort direction arrow on Clients, Commissions, and Payments column headers, which changed the sort order correctly but never visually updated to show which column or direction was active
- Added clickable sortable columns to the Invoices table (Invoice #, Amount, Due Date, Status), matching the other three list views
- Added consistent client avatars (colored initials, unique per client) across the Clients, Commissions, Payments, and Invoices tables, and the client profile view, so the same client is recognizable at a glance everywhere in the app
- Added recurring commissions with weekly, biweekly, and monthly repeat options
- Added a unified activity timeline to the client profile view, combining commissions, payments, and invoices
- Added overdue invoice alerts to the notification bell and an on-row day count for overdue invoices
- Fixed the Commissions board (kanban) view, which was rendering without any styling due to a class name mismatch between the markup and the stylesheet
- Improved empty states across Clients, Commissions, Invoices, and Payments to distinguish "no data yet" from "no results for your search or filter"
- Added protection against accidental double submissions when saving a client, commission, invoice, or payment

## License

No license has been added yet. Add one here if you plan to share or open source this project.
