# FCMS Pro - Roadmap

A planning document for upcoming development sessions. Nothing here is built yet.
Each item is tagged with a rough size so we can pick a realistic slice to tackle
per session: **S** (small, an hour or two of work), **M** (medium, a solid session),
**L** (large, spans multiple sessions).

---

## 1. Google Admin Console visual polish (continuing the redesign)

Progress: sticky table headers, compact/comfortable density mode, clickable
breadcrumb segments, animated KPI counters, snackbar-style toast notifications,
a collapsible icon-only sidebar, a theme toggle inside the profile dropdown,
skeleton loading placeholders on page navigation, a full tooltip pass on
icon-only buttons, consistent status pill colors across the whole app, a
visual status timeline stepper on the commission edit form, notifications
grouped by urgency (Overdue, Today, This Week, Later), and a custom accent
color picker in Settings are done. Everything else below is still open.

- **[S] Collapsible section cards** - the Client Profile and Settings pages would
  feel more like the Google reference if sections (Storage, Security, Groups style
  blocks) could expand and collapse with a chevron, instead of always showing
  everything at once.
- **[S] Row hover actions** - replace always-visible action buttons in tables with
  a single kebab menu (⋮) that appears on row hover, matching how Google Admin
  keeps table rows clean until you interact with them.
- **[M] Top bar app grid** - a waffle-style icon (▦) in the top bar that opens a
  quick-jump grid to any page, similar to Google's app switcher.
- **[M] Split settings into a two-pane layout** - a narrower left-hand list of
  setting categories with the active one's content on the right, closer to how
  Google Admin structures its own settings pages.
- **[M] Inline cell editing** - click directly into a table cell (like a status
  or a due date) to edit it without opening the full record, for quick one-field
  changes.
- **[S] Right-click context menu on table rows** - a quick menu (Edit, Delete,
  Duplicate) on right-click, in addition to the existing action buttons.
- **[M] Dashboard widget customization** - let the user choose which KPI cards
  or panels show on their dashboard and in what order.
- **[S] Print preview before printing** - a lightweight preview modal for
  invoices and receipts before sending them to the browser's print dialog.

## 2. New features

### Client and work management
- **[M] Recurring invoices** - similar to recurring commissions, but for invoices
  tied to retainer clients (auto-generate the next invoice on a schedule).
- **[M] Time tracking** - log hours against a commission for clients billed
  hourly rather than fixed price, with a running total shown on the commission.
- **[S] Tags/labels** - free-form tags on clients and commissions beyond the
  client type field, for finer filtering (e.g. "urgent", "referral", "repeat").
- **[M] Custom fields for clients** - let the user define extra fields per client
  type (e.g. a government contract number, a business tax ID) instead of a fixed
  form.
- **[S] CSV import** - bulk-add clients from a spreadsheet instead of one at a
  time.
- **[M] Undo after delete** - a short-lived "Client deleted. Undo?" toast instead
  of permanent, immediate deletion.
- **[M] Batch invoice generation** - select several completed commissions and
  generate one invoice per client in one action, instead of one at a time.
- **[S] Bulk status update** - change the status of several commissions or
  quotes at once from a multi-select, rather than opening each individually.
- **[M] Client communication log** - a running timeline of calls, emails, and
  meeting notes per client, separate from the general notes field.
- **[M] Quote-to-commission win rate** - track how many sent quotes actually
  convert into paid work, shown as a simple rate on the dashboard.
- **[S] Inactive client flagging** - quietly flag clients with no activity in a
  configurable number of months, useful for a "who should I follow up with"
  view.
- **[M] Calendar view** - a month view of commission deadlines and invoice due
  dates, as an alternative to the list-based views that already exist.
- **[S] Export deadlines to calendar (.ics)** - one click to add all upcoming
  deadlines to Google Calendar, Outlook, or a phone calendar app.
- **[S] Soft delete / archive** - move deleted clients or commissions to an
  "Archive" instead of erasing them immediately, with a way to restore later.
- **[S] Client referral tracking** - note which existing client referred a new
  one, to see who's sending you the most business over time.
- **[M] Attachments on commissions** - attach reference files or images
  (briefs, mockups, contracts) directly to a commission record.
- **[S] Client-specific rate cards** - save a preferred rate or discount per
  client so new quotes for them start pre-filled correctly.
- **[M] Quote and contract revision history** - keep prior versions when a
  quote is revised, so you can see what changed between "v1" and "v2" sent to a
  client.
- **[S] Late fee auto-calculation** - optionally add a configurable late fee to
  an invoice automatically once it passes its due date.
- **[S] Business-day-aware deadlines** - optionally calculate "due in X days"
  skipping weekends, for clients (especially government offices) that only
  count business days.
- **[S] Favorite/pin clients** - pin frequently used clients to the top of the
  list for faster access.
- **[S] Recently viewed list** - a small "recently viewed" shortcut list of the
  last few clients or commissions opened, for quick jumping back.
- **[S] Client birthday or anniversary reminders** - an optional personal-touch
  reminder for client birthdays or the anniversary of when they first signed on.

### Money and reporting
- **[S] Multi-currency support** - store a currency per client or invoice instead
  of one global currency symbol.
- **[M] Scheduled payment reminders** - beyond the notification bell, an optional
  email reminder sent automatically as a due date approaches (uses the existing
  PHP mail backend).
- **[M] Exportable PDF reports** - a proper PDF version of the Analytics page for
  sharing with an accountant or stakeholder, not just CSV.
- **[S] Custom date range comparisons** - compare any two periods on the
  dashboard, not just "this month vs last month."
- **[S] Payment link on invoices** - add a GCash, PayPal, or bank transfer
  reference directly on the printed invoice so clients know exactly how to pay.
- **[S] Client lifetime value ranking** - a simple leaderboard of clients by
  total revenue, to spot your most valuable relationships at a glance.
- **[M] Recurring expense tracking** - similar to recurring commissions, for
  expenses that repeat on a schedule (software subscriptions, rent, etc.).
- **[S] QR code on receipts and invoices** - a scannable code linking to the
  verification page, in addition to the existing verification code text.
- **[S] Split payments on one invoice** - record part-cash, part-GCash (or any
  mixed combination) against a single invoice instead of one method per
  payment.
- **[S] Accounting-software-friendly export** - a CSV export formatted to import
  cleanly into common tools like QuickBooks or Wave, in addition to the
  general CSV export.
- **[S] Custom invoice numbering formats** - configurable numbering, such as a
  per-year prefix or a per-client sequence, instead of one fixed format.
- **[M] Automatic overdue follow-up emails** - an optional sequence of polite
  reminder emails sent automatically as an invoice becomes more overdue.
- **[M] Tax season report** - a single report totaling income and expenses by
  quarter, formatted for handing to an accountant or for filing.
- **[S] Discount codes for repeat clients** - a simple reusable discount that
  can be applied to a quote or invoice by code instead of typing a fresh amount
  each time.

### Security and accounts
- **[M] Optional two-factor login** - an added PIN or TOTP code step at login,
  still fully client-side but a meaningful step up from password-only.
- **[S] Backup reminders** - a gentle nudge if no backup has been taken in a
  while, since all data lives in the browser.
- **[S] Active session view** - show when and where the account was last signed
  in, and let the user force a logout from Settings.
- **[M] Encrypted local backups** - optionally password-protect the exported
  JSON backup file, so a lost or shared backup file alone isn't readable.

## 3. UX and "feel" enhancements

- **[S] Onboarding checklist** - a small progress checklist for new setups
  ("Add your first client", "Create your first commission", "Send your first
  invoice") that fades away once complete.
- **[S] Personalized dashboard greeting** - "Good morning, Roderic" style
  greeting based on time of day, instead of a static heading.
- **[M] Milestone toasts** - a small celebratory notification for meaningful
  moments, like crossing a revenue milestone for the month.
- **[S] Better empty-state illustrations** - simple custom SVG illustrations
  instead of the current line-icon empty states, for a friendlier first-run feel.
- **[M] Command palette (Ctrl+K)** - a quick-action search overlay for power
  users to jump anywhere or run a command without touching the mouse, on top of
  the existing keyboard shortcuts.
- **[S] "What's new" panel** - a small popup summarizing recent changes the next
  time the app is opened after an update, pulled from the README changelog.
- **[S] Auto light/dark based on system preference** - an optional "match my
  device" theme setting, in addition to manually choosing light or dark.
- **[S] Guided tour re-trigger** - a way to replay the first-run onboarding
  checklist or a feature tour later, for anyone who skipped it initially.
- **[M] Client satisfaction check-in** - an optional short prompt after marking a
  commission Delivered, logging a quick rating or note for your own records.
- **[S] Reduced motion setting** - respect the system's "reduce motion"
  preference, and offer an in-app toggle too, for anyone sensitive to
  animation.
- **[S] Adjustable text size** - a simple small/medium/large text size setting
  for anyone who prefers larger type.
- **[S] Signature capture** - a simple draw-to-sign pad for quotes or contracts
  that need a client's signature, stored as an image on the record.

## 4. Data, integrations, and portability

- **[S] Client-facing shareable link** - a read-only link to a specific invoice
  or quote status page, so a client can check it without needing an account.
- **[M] Templates marketplace within the app** - a way to save and reuse a full
  commission or invoice template beyond the current basic templates page.
- **[L] Public API or webhooks** - let the app notify (or be controlled by)
  other tools when something changes, for anyone wanting to connect it to a
  wider workflow.
- **[S] Multi-business/workspace switcher** - support running more than one
  business profile in the same install, for anyone managing separate ventures.
- **[M] Cloud backup export** - send a backup file straight to the user's own
  Google Drive or Dropbox account instead of only downloading it to disk.
- **[S] Import from another tool** - a mapping wizard to bring in clients or
  invoices exported from a spreadsheet or another invoicing tool.
- **[M] Basic client portal login** - a lightweight separate login for clients
  themselves to view only their own invoices and quotes, without seeing any
  other client's data.
- **[S] Duplicate client detection** - a gentle warning when adding a client
  whose name or phone number closely matches an existing one, to avoid
  accidental duplicates.
- **[M] Appointment or consultation scheduling** - a simple booking calendar for
  client meetings or consultations, separate from commission deadlines.
- **[S] Amount in words on invoices** - print totals spelled out ("Three
  Thousand Pesos Only") alongside the numeral, a common requirement on formal
  Philippine business documents.
- **[M] Terms and conditions library** - save reusable terms blocks and attach
  the right one to a quote or invoice instead of retyping them each time.
- **[S] PAID / DRAFT / VOID watermark stamps** - a visible diagonal stamp on
  printed invoices reflecting their status, common on formal paperwork.
- **[M] Expense receipt photo capture** - attach a photo of a physical receipt
  directly to an expense entry from a phone camera.

## 5. Team and collaboration

Useful once this grows beyond a single person working alone, but lighter-weight
than the full production-readiness track below.

- **[M] Subcontractor assignment** - assign a commission to a team member or
  subcontractor and track what portion of the payment is owed to them.
- **[M] Invoice approval workflow** - an optional draft → pending approval →
  sent flow, for anyone who wants a second set of eyes before an invoice goes
  out.
- **[S] Internal notes vs client-visible notes** - a clearer split between notes
  meant only for you and notes meant to appear on client-facing documents.
- **[S] Assigned-to filter** - filter commissions and quotes by who they're
  assigned to, once more than one person can be assigned work.

## 6. Accessibility and reach

- **[M] Keyboard navigation audit** - make sure every action reachable by mouse
  is also reachable by keyboard alone, beyond the shortcuts that already exist.
- **[S] Screen reader pass** - add proper ARIA labels to icon-only buttons and
  status chips so the app is usable with assistive technology.
- **[M] Localization support** - structure the interface text so it could be
  translated into Filipino or other languages later, even if we only ship
  English to start.
- **[S] Print stylesheets for more pages** - extend the clean print layout that
  invoices and receipts already have to the Analytics and Client Profile pages.
- **[S] High-contrast mode** - an accessibility-focused theme with stronger
  contrast than the current light and dark themes, for low-vision users.
- **[M] Full focus-order review** - check that tabbing through every form and
  modal follows a sensible, predictable order top to bottom.
- **[S] Dyslexia-friendly font option** - an optional alternate typeface
  designed for easier reading, alongside the current default.

## 7. Performance, mobile, and technical health

- **[M] Virtual scrolling for large tables** - keep tables fast even with
  thousands of clients or commissions, instead of rendering every row at once.
- **[S] Lazy-load page modules** - only load the JavaScript for a page when you
  first visit it, so the initial app load stays quick as more features are
  added.
- **[S] Swipe actions on mobile** - swipe a row left or right to reveal quick
  actions (edit, delete) on phones, instead of relying only on tap targets.
- **[S] Pull-to-refresh on mobile** - a native-feeling refresh gesture at the
  top of list pages on phones.
- **[S] Push notifications for deadlines** - use the browser's notification
  permission so a deadline reminder can appear even if the app tab isn't open.
- **[S] Activity heatmap calendar** - a small calendar showing which days had
  activity (payments, deliveries), similar to a GitHub-style contribution
  graph, for a quick visual sense of your work rhythm.
- **[S] Rolling local backup history** - automatically keep the last several
  backups instead of just the most recent one, in case a bad backup overwrites
  a good one.
- **[S] Demo data seeding** - an option to fill the app with sample clients and
  commissions to explore the features safely before entering real data.

## 8. Production-readiness track (bigger undertaking, separate from styling)

This is the honest, longer-term work if this system is ever meant to run for a
team, a company, or a government office rather than one person on one device.
It is its own project, not a quick add-on:

- **[L] Real backend and database** - move from browser-only IndexedDB to an
  actual server and database, so data isn't stranded on one device.
- **[L] Server-side authentication** - move the login check off the client so it
  can't be bypassed with browser dev tools.
- **[L] Multi-user roles and permissions** - admin vs staff accounts with
  different access levels, useful once more than one person needs to log in.
- **[M] HTTPS deployment guide** - a written path for hosting this somewhere
  real with a proper certificate, instead of only `localhost`.
- **[M] Automated testing setup** - a basic test suite covering the core flows
  (add client, create commission, log payment, generate invoice) so future
  changes can be checked automatically instead of only by hand.

---

## Suggested approach for next week

Pick a mix from one or two categories rather than everything at once. Good
starter combinations:
- Visual polish (section 1) + a couple of quick UX wins (section 3), for a
  focused "look and feel" session.
- One or two money/reporting features (section 2) if you want new functionality
  more than more polish.
- Section 8 only makes sense once you know this needs to support more than one
  person or one device.
