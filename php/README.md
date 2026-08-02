# FCMS Pro v4 - PHP Backend

## Requirements
- PHP 8.0+
- Any local server: XAMPP, WAMP, MAMP, Laragon, or `php -S localhost:8080`

## Launch with PHP built-in server
```bash
cd /path/to/fcms-v4
php -S localhost:8080
```
Then open: http://localhost:8080

## Endpoints

| Action          | Method | Description                          |
|-----------------|--------|--------------------------------------|
| `ping`          | GET    | Health check, returns PHP version    |
| `receipt_pdf`   | POST   | Server-side receipt HTML (printable) |
| `invoice_pdf`   | POST   | Server-side invoice HTML (printable) |
| `quote_pdf`     | POST   | Server-side quote HTML (printable)   |
| `export_csv`    | POST   | Stream CSV download                  |
| `send_email`    | POST   | Send email via PHP mail()            |

## Request format
All POST endpoints accept JSON body:
```json
POST /php/api.php?action=receipt_pdf
Content-Type: application/json

{
  "receiptNumber": "RCT-00001",
  "clientName": "John Doe",
  "amountPaid": 5000,
  ...
  "settings": { "businessName": "My Business", ... }
}
```

## Notes
- The system works fully offline without PHP (IndexedDB + canvas receipts)
- PHP adds: server-side HTML print templates, CSV streaming, email support
- `send_email` requires your server to support PHP `mail()` or configure SMTP
