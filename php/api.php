<?php
/**
 * FCMS Pro v4 - PHP Backend API
 * Provides server-side PDF generation, email, and data export.
 * Run under PHP 8.0+ with XAMPP / WAMP / any local server.
 *
 * Endpoints:
 *   POST /php/api.php?action=receipt_pdf
 *   POST /php/api.php?action=invoice_pdf
 *   POST /php/api.php?action=export_csv
 *   GET  /php/api.php?action=ping
 */

declare(strict_types=1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';

function respond(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode(['ok' => $code < 400, 'data' => $data]);
    exit;
}

function error(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $_POST;
}

function peso(float $v): string {
    return '₱' . number_format($v, 2);
}

function fmtDate(string $date): string {
    try { return (new DateTime($date))->format('F j, Y'); } catch (Exception) { return $date; }
}

match ($action) {
    'ping'        => respond(['version' => '4.0', 'php' => PHP_VERSION, 'time' => date('c')]),
    'receipt_pdf' => handleReceiptPDF(),
    'invoice_pdf' => handleInvoicePDF(),
    'quote_pdf'   => handleQuotePDF(),
    'export_csv'  => handleExportCSV(),
    'send_email'  => handleSendEmail(),
    default       => error("Unknown action: $action"),
};

function handleReceiptPDF(): never {
    $data = input();
    if (empty($data['receiptNumber'])) error('Missing receipt data.');
    $r  = $data;
    $s  = $data['settings'] ?? [];
    ob_start();
    renderReceiptHTML($r, $s);
    $html = ob_get_clean();
    deliverHTML($html, 'Receipt-' . ($r['receiptNumber'] ?? 'FCMS'));
}

function handleInvoicePDF(): never {
    $data = input();
    if (empty($data['invoiceNumber'])) error('Missing invoice data.');
    ob_start();
    renderInvoiceHTML($data, $data['settings'] ?? [], $data['client'] ?? [], $data['commission'] ?? []);
    $html = ob_get_clean();
    deliverHTML($html, 'Invoice-' . ($data['invoiceNumber'] ?? 'FCMS'));
}

function handleQuotePDF(): never {
    $data = input();
    if (empty($data['quoteNumber'])) error('Missing quote data.');
    ob_start();
    renderQuoteHTML($data, $data['settings'] ?? [], $data['client'] ?? []);
    $html = ob_get_clean();
    deliverHTML($html, 'Quote-' . ($data['quoteNumber'] ?? 'FCMS'));
}

function deliverHTML(string $html, string $filename): never {
    header('Content-Type: text/html; charset=utf-8');
    header('Content-Disposition: inline; filename="' . $filename . '.html"');
    echo $html;
    exit;
}

function handleExportCSV(): never {
    $data  = input();
    $store = $data['store'] ?? 'export';
    $rows  = $data['rows']  ?? [];
    $heads = $data['headers'] ?? [];
    if (empty($rows)) error('No data to export.');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="FCMS_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $store) . '_' . date('Ymd') . '.csv"');
    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM for Excel UTF-8
    if ($heads) fputcsv($out, $heads);
    foreach ($rows as $row) fputcsv($out, (array)$row);
    fclose($out);
    exit;
}

function handleSendEmail(): never {
    $data = input();
    $to   = filter_var($data['to'] ?? '', FILTER_VALIDATE_EMAIL);
    if (!$to) error('Invalid email address.');
    $subject = $data['subject'] ?? 'FCMS Document';
    $body    = $data['body']    ?? '';
    $headers = implode("\r\n", [
        'From: ' . ($data['from'] ?? 'noreply@fcms.local'),
        'Content-Type: text/html; charset=UTF-8',
        'MIME-Version: 1.0',
    ]);
    $sent = mail($to, $subject, $body, $headers);
    if ($sent) respond(['message' => "Email sent to $to"]);
    else error('Email sending failed. Check your server mail configuration.');
}

/* ── HTML RENDERERS ───────────────────────────────────────────── */

function renderReceiptHTML(array $r, array $s): void {
    $biz     = htmlspecialchars($s['businessName']  ?? 'Business', ENT_QUOTES);
    $freel   = htmlspecialchars($s['freelancerName'] ?? '',         ENT_QUOTES);
    $phone   = htmlspecialchars($s['contactNumber']  ?? '',         ENT_QUOTES);
    $email   = htmlspecialchars($s['email']          ?? '',         ENT_QUOTES);
    $rctNo   = htmlspecialchars($r['receiptNumber']  ?? '-',        ENT_QUOTES);
    $client  = htmlspecialchars($r['clientName']     ?? '-',        ENT_QUOTES);
    $title   = htmlspecialchars($r['commissionTitle']?? '-',        ENT_QUOTES);
    $svc     = htmlspecialchars($r['serviceType']    ?? '-',        ENT_QUOTES);
    $price   = (float)($r['commissionPrice'] ?? 0);
    $paid    = (float)($r['amountPaid']      ?? 0);
    $remain  = (float)($r['remainingBalance']?? 0);
    $down    = (float)($r['downPayment']     ?? 0);
    $prev    = (float)($r['previousPayments']?? 0);
    $date    = fmtDate($r['date'] ?? date('Y-m-d'));
    $method  = htmlspecialchars($r['paymentMethod']    ?? '-', ENT_QUOTES);
    $ref     = htmlspecialchars($r['referenceNumber']  ?? '',  ENT_QUOTES);
    $vcode   = htmlspecialchars($r['verificationCode'] ?? '-', ENT_QUOTES);
    $status  = $r['commissionStatus'] ?? 'Pending';
    $footer  = htmlspecialchars($s['receiptFooter'] ?? 'Thank you for your business.', ENT_QUOTES);
    $fullyPaid = $remain <= 0;
    $totalPaidToDate = $down + $prev + $paid;
    echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Receipt {$rctNo}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,'Segoe UI',Arial,sans-serif;background:#e8ecf2;padding:20px;min-height:100vh;display:flex;align-items:flex-start;justify-content:center}
.wrap{width:100%;max-width:600px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18)}
.hd{background:linear-gradient(135deg,#1a202c 0%,#2d3748 100%);padding:26px 30px;position:relative}
.hd-accent{position:absolute;top:0;left:0;bottom:0;width:4px;background:linear-gradient(180deg,#4f8ef7,#a78bfa)}
.biz{font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:3px}
.biz-tag{font-size:.79rem;color:#90cdf4}
.biz-meta{font-size:.75rem;color:#718096;margin-top:1px}
.rct-badge{position:absolute;top:18px;right:24px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.4);border-radius:6px;padding:10px 16px;text-align:right}
.rct-lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:#90cdf4;font-weight:700}
.rct-no{font-size:1rem;font-weight:800;font-family:'Courier New',monospace;color:#e2e8f0;margin-top:2px}
.meta-strip{background:#f8fafc;padding:10px 30px;display:flex;gap:24px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap}
.meta-item{display:flex;flex-direction:column;gap:2px}
.meta-lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:#718096;font-weight:700}
.meta-val{font-size:.83rem;font-weight:600;color:#1a202c}
.sect{padding:16px 30px;border-bottom:1px solid #e2e8f0}
.sect-lbl{font-size:.63rem;text-transform:uppercase;letter-spacing:.09em;color:#718096;font-weight:700;margin-bottom:8px}
.client-row{display:flex;align-items:center;gap:10px}
.client-av{width:34px;height:34px;border-radius:50%;background:#edf2f7;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.88rem;color:#4a5568;flex-shrink:0}
.client-name{font-size:.92rem;font-weight:700;color:#1a202c}
.client-sub{font-size:.77rem;color:#718096}
.tbl{width:100%;border-collapse:collapse;font-size:.83rem}
.tbl thead th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0}
.tbl td{padding:12px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl td.right{text-align:right}
.summary{padding:14px 30px;border-bottom:1px solid #e2e8f0}
.sum-row{display:flex;justify-content:space-between;padding:5px 0;font-size:.84rem;color:#374151}
.sum-row.hl{background:#ebf8ff;padding:6px 10px;border-radius:5px;border:1px solid #bee3f8;font-weight:700}
.sum-row.bold{font-weight:800;font-size:.92rem;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:6px}
.mono{font-family:'Courier New',monospace}
.payment-sect{padding:14px 30px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:20px}
.pmethod-badge{background:#edf2f7;border-radius:6px;padding:7px 14px;font-size:.83rem;font-weight:700;color:#2d3748;flex-shrink:0}
.verf-strip{background:#f8fafc;padding:14px 30px;border-bottom:2px dashed #cbd5e0;display:flex;align-items:center;justify-content:space-between}
.vcode{font-family:'Courier New',monospace;font-size:1.05rem;font-weight:800;color:#1a202c;letter-spacing:.05em}
.stamp{padding:8px 16px;border-radius:8px;font-size:.79rem;font-weight:800;text-align:center;border:2px solid}
.stamp.paid{background:rgba(52,211,153,.1);border-color:#34d399;color:#065f46}
.stamp.partial{background:rgba(251,191,36,.1);border-color:#fbbf24;color:#78350f}
.footer-strip{background:linear-gradient(135deg,#1a202c,#2d3748);padding:16px 30px;text-align:center}
.footer-msg{font-size:.83rem;color:#a0aec0;margin-bottom:4px}
.footer-biz{font-size:.83rem;font-weight:700;color:#63b3ed}
.footer-sys{font-size:.72rem;color:#4a5568;margin-top:3px}
@media print{body{background:#fff;padding:0}@page{margin:8mm}.wrap{box-shadow:none;max-width:100%}}
</style></head><body><div class='wrap'>
<div class='hd'><div class='hd-accent'></div>
  <div class='biz'>{$biz}</div>
  " . ($freel ? "<div class='biz-tag'>{$freel}</div>" : "") . "
  " . ($phone || $email ? "<div class='biz-meta'>{$phone}" . ($phone && $email ? ' &nbsp;·&nbsp; ' : '') . "{$email}</div>" : "") . "
  <div class='rct-badge'><div class='rct-lbl'>Official Receipt</div><div class='rct-no'>{$rctNo}</div></div>
</div>
<div class='meta-strip'>
  <div class='meta-item'><span class='meta-lbl'>Date Issued</span><span class='meta-val'>{$date}</span></div>
  <div class='meta-item'><span class='meta-lbl'>Service</span><span class='meta-val'>{$svc}</span></div>
  <div class='meta-item'><span class='meta-lbl'>Status</span><span class='meta-val' style='color:#fbbf24'>{$status}</span></div>
</div>
<div class='sect'>
  <div class='sect-lbl'>Billed To</div>
  <div class='client-row'>
    <div class='client-av'>" . strtoupper(substr($r['clientName'] ?? '?', 0, 1)) . "</div>
    <div><div class='client-name'>{$client}</div>" .
    (!empty($r['clientPhone']) ? "<div class='client-sub'>" . htmlspecialchars($r['clientPhone']) . "</div>" : '') .
    "</div>
  </div>
</div>
<div class='sect'>
  <div class='sect-lbl'>Service Details</div>
  <table class='tbl'><thead><tr>
    <th>Description</th><th>Service</th><th style='text-align:right'>Qty</th>
    <th style='text-align:right'>Unit Price</th><th style='text-align:right'>Total</th>
  </tr></thead>
  <tbody><tr>
    <td><strong>{$title}</strong>" . (!empty($r['clientNote']) ? "<br><span style='font-size:.75rem;color:#718096'>" . htmlspecialchars($r['clientNote']) . "</span>" : '') . "</td>
    <td style='color:#718096'>{$svc}</td>
    <td class='right'>1</td>
    <td class='right mono'>" . peso($price) . "</td>
    <td class='right mono'><strong>" . peso($price) . "</strong></td>
  </tr></tbody></table>
</div>
<div class='summary'>
  " . ($down > 0 ? "<div class='sum-row'><span>Down Payment</span><span class='mono'>" . peso($down) . "</span></div>" : '') . "
  " . ($prev > 0 ? "<div class='sum-row'><span>Previous Payments</span><span class='mono'>" . peso($prev) . "</span></div>" : '') . "
  <div class='sum-row hl'><span>This Payment</span><span class='mono'>" . peso($paid) . "</span></div>
  <div class='sum-row bold'><span>Total Paid to Date</span><span class='mono'>" . peso($totalPaidToDate) . "</span></div>
  <div class='sum-row' style='margin-top:6px;color:" . ($fullyPaid ? '#065f46' : '#b45309') . ";font-weight:700'><span>Remaining Balance</span><span class='mono'>" . peso($remain) . "</span></div>
</div>
<div class='payment-sect'>
  <div class='pmethod-badge'>{$method}</div>
  <div>" . ($ref ? "<div style='font-size:.81rem;color:#718096'>Ref: {$ref}</div>" : '') . "
    <div style='font-size:.79rem;color:#718096'>Payment date: {$date}</div></div>
</div>
<div class='verf-strip'>
  <div>
    <div style='font-size:.63rem;text-transform:uppercase;letter-spacing:.09em;color:#718096;font-weight:700;margin-bottom:4px'>Verification Code</div>
    <div class='vcode'>{$vcode}</div>
  </div>
  <div class='stamp " . ($fullyPaid ? 'paid' : 'partial') . "'>
    " . ($fullyPaid ? '✔ PAID IN FULL' : '◑ PARTIAL PAYMENT') . "
  </div>
</div>
<div class='footer-strip'>
  <div class='footer-msg'>{$footer}</div>
  <div class='footer-biz'>{$biz}</div>
  <div class='footer-sys'>System-generated receipt - FCMS Pro v4</div>
</div>
</div><script>window.addEventListener('DOMContentLoaded',()=>{window.print();setTimeout(()=>window.close(),800)});</script>
</body></html>";
}

function renderInvoiceHTML(array $inv, array $s, array $cl, array $co): void {
    $biz    = htmlspecialchars($s['businessName']   ?? 'Business', ENT_QUOTES);
    $freel  = htmlspecialchars($s['freelancerName'] ?? '',         ENT_QUOTES);
    $invNo  = htmlspecialchars($inv['invoiceNumber']?? '-',        ENT_QUOTES);
    $clName = htmlspecialchars($cl['name']          ?? '-',        ENT_QUOTES);
    $clPh   = htmlspecialchars($cl['phone']         ?? '',         ENT_QUOTES);
    $clEm   = htmlspecialchars($cl['email']         ?? '',         ENT_QUOTES);
    $desc   = htmlspecialchars($inv['description']  ?? '-',        ENT_QUOTES);
    $sub    = (float)($inv['subtotal'] ?? 0);
    $disc   = (float)($inv['discount'] ?? 0);
    $tax    = (float)($inv['tax']      ?? 0);
    $total  = (float)($inv['total']    ?? $sub - $disc + $tax);
    $issue  = fmtDate($inv['issueDate'] ?? date('Y-m-d'));
    $due    = fmtDate($inv['dueDate']   ?? '');
    $terms  = htmlspecialchars($inv['terms'] ?? '', ENT_QUOTES);
    $notes  = htmlspecialchars($inv['notes'] ?? '', ENT_QUOTES);
    echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Invoice {$invNo}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,'Segoe UI',Arial,sans-serif;background:#e8ecf2;padding:20px;display:flex;justify-content:center}
.wrap{width:100%;max-width:640px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18)}
.hd{background:linear-gradient(135deg,#1a202c,#2d3748);padding:26px 32px;display:flex;justify-content:space-between;align-items:flex-start}
.biz-name{font-size:1rem;font-weight:800;color:#fff}.biz-sub{font-size:.78rem;color:#90cdf4;margin-top:2px}
.inv-lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:#718096;text-align:right;font-weight:700}
.inv-no{font-size:1rem;font-weight:800;font-family:'Courier New',monospace;color:#90cdf4;text-align:right}
.inv-date{font-size:.75rem;color:#718096;text-align:right;margin-top:3px}
.sect{padding:18px 32px;border-bottom:1px solid #e2e8f0}
.lbl{font-size:.63rem;text-transform:uppercase;letter-spacing:.09em;color:#718096;font-weight:700;margin-bottom:5px}
.tbl{width:100%;border-collapse:collapse;font-size:.84rem}
.tbl th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:.65rem;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0}
.tbl td{padding:12px 10px;vertical-align:middle}
.totals-wrap{padding:18px 32px;display:flex;justify-content:flex-end;border-bottom:1px solid #e2e8f0}
.tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem;min-width:240px}
.tot-final{display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a202c;margin-top:6px;font-size:.93rem;font-weight:800}
.mono{font-family:'Courier New',monospace}
.footer{background:#f8fafc;padding:14px 32px;font-size:.8rem;color:#4a5568;line-height:1.6}
.ft{background:#1a202c;padding:10px 32px;text-align:center;font-size:.74rem;color:#718096}
@media print{body{background:#fff;padding:0}@page{margin:8mm}.wrap{box-shadow:none;max-width:100%}}
</style></head><body><div class='wrap'>
<div class='hd'>
  <div><div class='biz-name'>{$biz}</div>" . ($freel ? "<div class='biz-sub'>{$freel}</div>" : '') . "</div>
  <div><div class='inv-lbl'>Invoice</div><div class='inv-no'>{$invNo}</div><div class='inv-date'>Issue: {$issue}<br>Due: {$due}</div></div>
</div>
<div class='sect'>
  <div class='lbl'>Billed To</div>
  <div style='font-size:.92rem;font-weight:700;margin-bottom:3px'>{$clName}</div>
  " . ($clPh ? "<div style='font-size:.8rem;color:#4a5568'>{$clPh}</div>" : '') . "
  " . ($clEm ? "<div style='font-size:.8rem;color:#4a5568'>{$clEm}</div>" : '') . "
</div>
<div class='sect'>
  <div class='lbl'>Description of Services</div>
  <div style='font-size:.87rem;line-height:1.65;color:#374151'>{$desc}</div>
</div>
<div class='totals-wrap'><div>
  <div class='tot-row'><span style='color:#718096'>Subtotal</span><span class='mono'>₱" . number_format($sub, 2) . "</span></div>
  " . ($disc > 0 ? "<div class='tot-row'><span style='color:#718096'>Discount</span><span class='mono' style='color:#dc2626'>−₱" . number_format($disc, 2) . "</span></div>" : '') . "
  " . ($tax  > 0 ? "<div class='tot-row'><span style='color:#718096'>Tax / VAT</span><span class='mono'>₱" . number_format($tax, 2) . "</span></div>" : '') . "
  <div class='tot-final'><span>Total Due</span><span class='mono'>₱" . number_format($total, 2) . "</span></div>
</div></div>
" . ($terms || $notes ? "<div class='footer'>" . ($terms ? "<div style='margin-bottom:4px'><strong>Terms:</strong> {$terms}</div>" : '') . ($notes ? "<div>{$notes}</div>" : '') . "</div>" : '') . "
<div class='ft'>Generated by FCMS Pro v4 &nbsp;·&nbsp; {$biz}</div>
</div><script>window.addEventListener('DOMContentLoaded',()=>{window.print();setTimeout(()=>window.close(),800)});</script>
</body></html>";
}

function renderQuoteHTML(array $q, array $s, array $cl): void {
    $biz   = htmlspecialchars($s['businessName']  ?? 'Business', ENT_QUOTES);
    $freel = htmlspecialchars($s['freelancerName']?? '',         ENT_QUOTES);
    $qNo   = htmlspecialchars($q['quoteNumber']   ?? '-',        ENT_QUOTES);
    $clN   = htmlspecialchars($cl['name']         ?? '-',        ENT_QUOTES);
    $svc   = htmlspecialchars($q['serviceType']   ?? '',         ENT_QUOTES);
    $scope = nl2br(htmlspecialchars($q['scope']   ?? '-',        ENT_QUOTES));
    $total = (float)($q['total']       ?? 0);
    $down  = (float)($q['downPayment'] ?? 0);
    $rev   = (int)($q['revisions']     ?? 0);
    $issue = fmtDate($q['issueDate']   ?? date('Y-m-d'));
    $valid = fmtDate($q['validUntil']  ?? '');
    $terms = htmlspecialchars($q['terms'] ?? '', ENT_QUOTES);
    echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Quote {$qNo}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,'Segoe UI',Arial,sans-serif;background:#e8ecf2;padding:20px;display:flex;justify-content:center}
.wrap{width:100%;max-width:640px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18)}
.hd{background:linear-gradient(135deg,#1a202c,#2d3748);padding:24px 30px;display:flex;justify-content:space-between;align-items:flex-start}
.biz-name{font-size:1rem;font-weight:800;color:#fff}.biz-sub{font-size:.78rem;color:#90cdf4}
.q-lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:#718096;text-align:right;font-weight:700}
.q-no{font-size:1rem;font-weight:800;font-family:'Courier New',monospace;color:#90cdf4;text-align:right}
.q-date{font-size:.74rem;color:#718096;text-align:right;margin-top:3px}
.sect{padding:16px 30px;border-bottom:1px solid #e2e8f0}
.lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.09em;color:#718096;font-weight:700;margin-bottom:5px}
.scope{font-size:.86rem;line-height:1.7;color:#374151}
.tot-wrap{padding:16px 30px;display:flex;justify-content:flex-end;border-bottom:1px solid #e2e8f0}
.tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem;min-width:220px}
.tot-final{font-size:.93rem;font-weight:800;border-top:2px solid #1a202c;padding-top:9px;margin-top:6px}
.mono{font-family:'Courier New',monospace}
.footer-terms{background:#f8fafc;padding:14px 30px;font-size:.8rem;color:#4a5568;line-height:1.6}
.ft{background:#1a202c;padding:9px 30px;text-align:center;font-size:.73rem;color:#718096}
@media print{body{background:#fff;padding:0}@page{margin:8mm}.wrap{box-shadow:none;max-width:100%}}
</style></head><body><div class='wrap'>
<div class='hd'>
  <div><div class='biz-name'>{$biz}</div>" . ($freel ? "<div class='biz-sub'>{$freel}</div>" : '') . "</div>
  <div><div class='q-lbl'>Proposal / Quote</div><div class='q-no'>{$qNo}</div><div class='q-date'>Issued: {$issue}<br>Valid until: {$valid}</div></div>
</div>
<div class='sect'>
  <div class='lbl'>Prepared For</div>
  <div style='font-size:.92rem;font-weight:700'>{$clN}</div>
  " . (!empty($cl['phone']) ? "<div style='font-size:.8rem;color:#4a5568'>" . htmlspecialchars($cl['phone']) . "</div>" : '') . "
  " . (!empty($cl['email']) ? "<div style='font-size:.8rem;color:#4a5568'>" . htmlspecialchars($cl['email']) . "</div>" : '') . "
</div>
<div class='sect'>
  <div class='lbl'>Scope of Work" . ($svc ? " - {$svc}" : '') . "</div>
  <div class='scope'>{$scope}</div>
  " . ($rev >= 0 ? "<div style='font-size:.76rem;color:#718096;margin-top:8px'>{$rev} revision round" . ($rev !== 1 ? 's' : '') . " included</div>" : '') . "
</div>
<div class='tot-wrap'><div>
  <div class='tot-row'><span style='color:#718096'>Service Total</span><span class='mono'>₱" . number_format($total, 2) . "</span></div>
  " . ($down > 0 ? "<div class='tot-row'><span style='color:#718096'>Down Payment Required</span><span class='mono'>₱" . number_format($down, 2) . "</span></div>" : '') . "
  <div class='tot-row tot-final'><span>Amount</span><span class='mono'>₱" . number_format($total, 2) . "</span></div>
</div></div>
" . ($terms ? "<div class='footer-terms'><strong>Terms:</strong> {$terms}</div>" : '') . "
<div class='ft'>Generated by FCMS Pro v4 &nbsp;·&nbsp; Quote valid until {$valid}</div>
</div><script>window.addEventListener('DOMContentLoaded',()=>{window.print();setTimeout(()=>window.close(),800)});</script>
</body></html>";
}
