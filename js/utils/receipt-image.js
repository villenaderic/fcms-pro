'use strict';
/* ── receipt-image.js - Premium Receipt Renderer v3 ── */
const ReceiptImg = (() => {

  const W = 620;

  function fmtMoney(v) {
    return (parseFloat(v) || 0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-PH', {year:'numeric', month:'long', day:'numeric'});
  }
  function cut(s, n) { return !s ? '' : s.length > n ? s.slice(0, n) + '…' : s; }

  function line(ctx, x1, y1, x2, y2, color = '#e2e8f0', lw = 1) {
    ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = color;
    ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function dashed(ctx, x1, y1, x2, y2, color = '#e2e8f0') {
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = color;
    ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  async function generate(receipt) {
    const s  = Settings.getAll();
    const r  = receipt;

    const PAD        = 32;
    const headerH    = 120;
    const metaH      = 52;
    const sectionGap = 20;
    const billH      = r.clientPhone || r.clientEmail ? 80 : 60;
    const tableH     = 90;
    const summaryRows = buildSummaryRows(r);
    const summaryH   = 16 + summaryRows.length * 30 + 20;
    const methodH    = 70 + (r.referenceNumber ? 20 : 0);
    const noteH      = r.notes ? 52 : 0;
    const verifyH    = 68;
    const footerH    = 72;
    const separatorH = 24;

    const totalH = headerH + metaH + sectionGap
      + billH + sectionGap
      + tableH + sectionGap
      + summaryH + sectionGap
      + methodH + (noteH ? sectionGap + noteH : 0) + sectionGap
      + verifyH + separatorH
      + footerH + 8;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, totalH);

    // Outer subtle border
    ctx.save(); ctx.setLineDash([]);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W-1, totalH-1); ctx.restore();

    let y = 0;
    y = drawHeader(ctx, y, r, s, PAD, headerH);
    y = drawMeta(ctx, y, r, PAD, metaH);
    y += sectionGap;
    line(ctx, PAD, y, W-PAD, y, '#e2e8f0');
    y += sectionGap * 0.6;
    y = drawBillTo(ctx, y, r, PAD, billH);
    y += sectionGap * 0.6;
    line(ctx, PAD, y, W-PAD, y, '#e2e8f0');
    y += sectionGap;
    y = drawTable(ctx, y, r, PAD);
    y += sectionGap;
    line(ctx, PAD, y, W-PAD, y, '#e2e8f0');
    y += sectionGap;
    y = drawSummary(ctx, y, r, summaryRows, PAD);
    y += sectionGap;
    line(ctx, PAD, y, W-PAD, y, '#e2e8f0');
    y += sectionGap;
    y = drawMethod(ctx, y, r, PAD, s);
    if (r.notes) {
      y += sectionGap;
      line(ctx, PAD, y, W-PAD, y, '#e2e8f0');
      y += sectionGap;
      y = drawNote(ctx, y, r, PAD);
    }
    y += sectionGap;
    // Perforated dashed separator
    dashed(ctx, 0, y, W, y, '#cbd5e0');
    y += separatorH;
    y = drawVerify(ctx, y, r, PAD, verifyH);
    y = drawFooter(ctx, y, s, footerH);

    return canvas;
  }

  function drawHeader(ctx, y, r, s, PAD, H) {
    // Gradient header strip
    const grad = ctx.createLinearGradient(0, y, W, y + H);
    grad.addColorStop(0, '#1a202c');
    grad.addColorStop(0.6, '#2d3748');
    grad.addColorStop(1, '#1a202c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, H);

    // Decorative side accent strip
    ctx.fillStyle = '#63b3ed';
    ctx.fillRect(0, y, 4, H);

    // Business name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cut(s.businessName || 'FCMS Business', 34), PAD + 8, y + 32);

    // Freelancer / tagline
    if (s.freelancerName) {
      ctx.fillStyle = '#90cdf4';
      ctx.font = '600 11px Inter, Arial, sans-serif';
      ctx.fillText(cut(s.freelancerName, 40), PAD + 8, y + 52);
    }

    // Contact info
    const contactLine = [s.contactNumber, s.email].filter(Boolean).join('   ·   ');
    if (contactLine) {
      ctx.fillStyle = '#718096';
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillText(contactLine, PAD + 8, y + (s.freelancerName ? 68 : 52));
    }

    // Address
    if (s.address) {
      ctx.fillStyle = '#718096';
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillText(cut(s.address, 55), PAD + 8, y + (s.freelancerName ? 84 : 66));
    }

    // Right side - OFFICIAL RECEIPT label in accent box
    const boxW = 150, boxH = 38;
    const boxX = W - PAD - 8 - boxW;
    const boxY = y + 20;
    roundRect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fillStyle = 'rgba(99,179,237,0.15)'; ctx.fill();
    ctx.strokeStyle = 'rgba(99,179,237,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();

    ctx.fillStyle = '#90cdf4';
    ctx.font = 'bold 11px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL RECEIPT', boxX + boxW / 2, boxY + 15);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px "JetBrains Mono", "Courier New", monospace';
    ctx.fillText(r.receiptNumber || '-', boxX + boxW / 2, boxY + 30);

    return y + H;
  }

  function drawMeta(ctx, y, r, PAD, H) {
    const bg = '#f8fafc';
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, W, H);
    line(ctx, 0, y + H, W, y + H, '#e2e8f0');

    // Date column
    ctx.fillStyle = '#718096';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DATE ISSUED', PAD, y + 16);
    ctx.fillStyle = '#1a202c';
    ctx.font = '600 11px Inter, Arial, sans-serif';
    ctx.fillText(fmtDate(r.date), PAD, y + 32);

    // Service type
    const mid = W / 2 - 40;
    ctx.fillStyle = '#718096';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SERVICE TYPE', mid, y + 16);
    ctx.fillStyle = '#1a202c';
    ctx.font = '600 11px Inter, Arial, sans-serif';
    ctx.fillText(cut(r.serviceType || '-', 24), mid, y + 32);

    // Status
    ctx.fillStyle = '#718096';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('COMMISSION STATUS', W - PAD, y + 16);

    const statusColors = {
      'Completed': '#48bb78', 'Delivered': '#76e4f7',
      'Pending': '#f6ad55', 'In Progress': '#63b3ed',
      'Cancelled': '#fc8181', 'Revision': '#b794f4'
    };
    const sc = statusColors[r.commissionStatus] || '#63b3ed';
    ctx.fillStyle = sc;
    ctx.font = 'bold 11px Inter, Arial, sans-serif';
    ctx.fillText(r.commissionStatus || '-', W - PAD, y + 32);

    return y + H;
  }

  function drawBillTo(ctx, y, r, PAD, H) {
    const sY = y + 8;
    ctx.fillStyle = '#718096';
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BILLED TO', PAD, sY + 12);

    // Avatar circle
    const av = (r.clientName || '?')[0].toUpperCase();
    roundRect(ctx, PAD, sY + 18, 32, 32, 16);
    ctx.fillStyle = '#edf2f7'; ctx.fill();
    ctx.fillStyle = '#4a5568';
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(av, PAD + 16, sY + 40);

    ctx.fillStyle = '#1a202c';
    ctx.font = 'bold 15px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cut(r.clientName || '-', 36), PAD + 42, sY + 34);

    const info = [r.clientPhone, r.clientEmail].filter(Boolean).join('   ·   ');
    if (info) {
      ctx.fillStyle = '#718096';
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillText(cut(info, 60), PAD + 42, sY + 50);
    }

    return y + H;
  }

  function drawTable(ctx, y, r, PAD) {
    const tW = W - PAD * 2;
    const colW = [tW * 0.38, tW * 0.20, tW * 0.12, tW * 0.15, tW * 0.15];
    const headers = ['Description', 'Service', 'Qty', 'Unit Price', 'Total'];
    const hH = 28, rH = 46;

    // Header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(PAD, y, tW, hH);
    roundRect(ctx, PAD, y, tW, hH, 0);

    let cx = PAD;
    headers.forEach((h, i) => {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 9px Inter, Arial, sans-serif';
      ctx.textAlign = i >= 2 ? 'right' : 'left';
      ctx.fillText(h.toUpperCase(), i >= 2 ? cx + colW[i] - 8 : cx + 10, y + 17);
      if (i < headers.length - 1) line(ctx, cx + colW[i], y, cx + colW[i], y + hH + rH, '#e2e8f0');
      cx += colW[i];
    });

    // Row
    line(ctx, PAD, y + hH, PAD + tW, y + hH, '#e2e8f0');
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.strokeRect(PAD, y, tW, hH + rH);

    const vals = [
      cut(r.commissionTitle || '-', 28),
      cut(r.serviceType || '-', 16),
      '1',
      '₱' + fmtMoney(r.commissionPrice),
      '₱' + fmtMoney(r.commissionPrice)
    ];

    cx = PAD;
    vals.forEach((val, i) => {
      const isNum = i >= 2;
      ctx.fillStyle = i === 4 ? '#1a202c' : '#374151';
      ctx.font = isNum
        ? (i === 4 ? 'bold ' : '') + '11px "JetBrains Mono","Courier New",monospace'
        : '11px Inter, Arial, sans-serif';
      ctx.textAlign = isNum ? 'right' : 'left';
      ctx.fillText(val, isNum ? cx + colW[i] - 8 : cx + 10, y + hH + rH/2 + 4);
      cx += colW[i];
    });

    if (r.clientNote) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Inter, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Note: ' + cut(r.clientNote, 45), PAD + 10, y + hH + rH - 8);
    }

    return y + hH + rH;
  }

  function buildSummaryRows(r) {
    const totalPaidToDate = H.num(r.downPayment) + H.num(r.previousPayments) + H.num(r.amountPaid);
    const rows = [];
    rows.push({label:'Commission Total', val:'₱'+fmtMoney(r.commissionPrice), style:'normal'});
    if (H.num(r.downPayment) > 0)
      rows.push({label:'Down Payment', val:'₱'+fmtMoney(r.downPayment), style:'normal'});
    if (H.num(r.previousPayments) > 0)
      rows.push({label:'Previous Payments', val:'₱'+fmtMoney(r.previousPayments), style:'normal'});
    rows.push({label:'This Payment', val:'₱'+fmtMoney(r.amountPaid), style:'highlight'});
    rows.push({label:'Total Paid to Date', val:'₱'+fmtMoney(totalPaidToDate), style:'bold', separator:true});
    rows.push({
      label:'Remaining Balance',
      val:'₱'+fmtMoney(r.remainingBalance),
      style: H.num(r.remainingBalance) > 0 ? 'warning' : 'success'
    });
    return rows;
  }

  function drawSummary(ctx, y, r, rows, PAD) {
    const halfX = W / 2 + 8;
    const colW  = W - PAD - halfX;

    rows.forEach((row, i) => {
      const ry = y + 8 + i * 30;
      if (row.separator) {
        line(ctx, halfX, ry - 6, halfX + colW, ry - 6, '#e2e8f0');
      }

      if (row.style === 'highlight') {
        roundRect(ctx, halfX - 4, ry - 4, colW + 4, 26, 4);
        ctx.fillStyle = '#ebf8ff'; ctx.fill();
        ctx.strokeStyle = '#bee3f8'; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
      }

      const colors = {normal:'#64748b', bold:'#1a202c', highlight:'#1d4ed8', warning:'#b7791f', success:'#2f855a'};
      ctx.fillStyle = colors[row.style] || '#374151';
      ctx.font = (row.style !== 'normal' ? 'bold ' : '') + '11px Inter, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, halfX + 4, ry + 14);

      ctx.font = (row.style !== 'normal' ? 'bold ' : '') + '11px "JetBrains Mono","Courier New",monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = row.style === 'highlight' ? '#1d4ed8' : colors[row.style];
      ctx.fillText(row.val, halfX + colW - 2, ry + 14);
    });

    return y + 8 + rows.length * 30 + 12;
  }

  function drawMethod(ctx, y, r, PAD, s) {
    ctx.fillStyle = '#718096'; ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PAYMENT METHOD', PAD, y + 14);

    // Method badge
    const mW = 120, mH = 30;
    roundRect(ctx, PAD, y + 20, mW, mH, 6);
    ctx.fillStyle = '#edf2f7'; ctx.fill();
    ctx.fillStyle = '#2d3748';
    ctx.font = 'bold 12px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.paymentMethod || '-', PAD + mW/2, y + 40);

    ctx.textAlign = 'left';
    if (r.referenceNumber) {
      ctx.fillStyle = '#718096'; ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillText('Reference: ' + r.referenceNumber, PAD, y + 64);
    }
    ctx.fillStyle = '#718096'; ctx.font = '10px Inter, Arial, sans-serif';
    ctx.fillText('Payment date: ' + fmtDate(r.date), PAD, y + (r.referenceNumber ? 82 : 64));

    return y + (r.referenceNumber ? 90 : 70);
  }

  function drawNote(ctx, y, r, PAD) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(PAD, y, W - PAD*2, 40);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.strokeRect(PAD, y, W - PAD*2, 40);
    ctx.fillStyle = '#718096'; ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NOTE', PAD + 10, y + 14);
    ctx.fillStyle = '#374151'; ctx.font = '10px Inter, Arial, sans-serif';
    ctx.fillText(cut(r.notes, 80), PAD + 10, y + 30);
    return y + 52;
  }

  function drawVerify(ctx, y, r, PAD, H) {
    // Verify strip with light background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, y, W, H);
    line(ctx, 0, y, W, y, '#e2e8f0');
    line(ctx, 0, y + H, W, y + H, '#e2e8f0');

    // Verification code section
    ctx.fillStyle = '#718096'; ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VERIFICATION CODE', PAD, y + 18);
    ctx.fillStyle = '#1a202c';
    ctx.font = 'bold 16px "JetBrains Mono","Courier New",monospace';
    ctx.fillText(r.verificationCode || '-', PAD, y + 46);

    // PAID / VERIFIED stamp on right
    const stampX = W - PAD - 90, stampY = y + 8, stampW = 88, stampH = H - 16;
    roundRect(ctx, stampX, stampY, stampW, stampH, 8);
    const isFullyPaid = H.num(r.remainingBalance) <= 0;
    ctx.fillStyle = isFullyPaid ? 'rgba(72,187,120,0.1)' : 'rgba(246,173,85,0.1)';
    ctx.fill();
    ctx.strokeStyle = isFullyPaid ? '#48bb78' : '#f6ad55';
    ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();

    ctx.fillStyle = isFullyPaid ? '#22543d' : '#7b341e';
    ctx.font = 'bold 20px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isFullyPaid ? '✔' : '◑', stampX + stampW/2, stampY + stampH/2 + 3);
    ctx.font = 'bold 9px Inter, Arial, sans-serif';
    ctx.fillText(isFullyPaid ? 'PAID IN FULL' : 'PARTIAL', stampX + stampW/2, stampY + stampH - 8);

    return y + H;
  }

  function drawFooter(ctx, y, s, H) {
    // Dark footer
    const grad = ctx.createLinearGradient(0, y, W, y + H);
    grad.addColorStop(0, '#1a202c');
    grad.addColorStop(1, '#2d3748');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, H);

    ctx.fillStyle = '#4, 0, 0, 0'; // reset
    ctx.fillStyle = '#a0aec0';
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    const msg = (s && s.receiptFooter) ? s.receiptFooter : 'Thank you for your business. We appreciate your trust.';
    ctx.fillText(cut(msg, 70), W/2, y + 20);

    ctx.fillStyle = '#63b3ed';
    ctx.font = 'bold 10px Inter, Arial, sans-serif';
    ctx.fillText(s && s.businessName ? s.businessName : 'FCMS Pro', W/2, y + 38);

    ctx.fillStyle = '#4a5568';
    ctx.font = '9px Inter, Arial, sans-serif';
    ctx.fillText('System-generated receipt - no signature required', W/2, y + 53);

    ctx.fillStyle = '#2d3748';
    ctx.font = '8px "JetBrains Mono","Courier New",monospace';
    ctx.fillText('Printed: ' + fmtDate(new Date().toISOString()), W/2, y + 66);

    return y + H;
  }

  async function downloadPNG(receipt) {
    const canvas = await generate(receipt);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `Receipt-${receipt.receiptNumber}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function printCanvas(canvas) {
    const url = canvas.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=680,height=960');
    if (!win) { Notify.err('Popup blocked. Allow popups to print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Official Receipt</title>
<style>*{margin:0;padding:0}body{background:#fff}img{max-width:100%;display:block;margin:0 auto}
.prev-bar{position:sticky;top:0;z-index:10;background:#1a202c;padding:10px 16px;display:flex;justify-content:center;gap:10px}
.prev-btn{padding:8px 18px;border-radius:6px;border:none;font-size:.83rem;font-weight:700;cursor:pointer;font-family:Inter,Arial,sans-serif}
.prev-btn.pr{background:#4f8ef7;color:#fff} .prev-btn.cl{background:#2d3748;color:#e2e8f0}
@media print{.prev-bar{display:none}}
@media print{@page{margin:10mm}}</style></head><body>
<div class="prev-bar">
  <button class="prev-btn pr" onclick="window.print()">🖨 Print</button>
  <button class="prev-btn cl" onclick="window.close()">✕ Close Preview</button>
</div>
<img src="${url}"/></body></html>`);
    win.document.close();
  }

  async function showPreviewModal(receipt) {
    const canvas = await generate(receipt);
    const url = canvas.toDataURL('image/png');
    Modal.open({
      title: `Receipt - ${receipt.receiptNumber}`, size: 'lg',
      body: `<div class="receipt-preview-wrap">
        <img src="${url}" alt="Receipt ${receipt.receiptNumber}" style="max-width:100%;border-radius:4px"/>
        <div style="text-align:center;font-size:0.73rem;color:#888;margin-top:8px;font-family:monospace">
          Verification: ${receipt.verificationCode || '-'}
        </div>
      </div>`,
      foot: `
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn btn-ghost" id="rct-print-btn">Print</button>
        <button class="btn btn-ghost" id="rct-pdf-btn">Save PDF</button>
        <button class="btn btn-primary" id="rct-save-btn">Save Image</button>
      `
    });
    setTimeout(() => {
      const saveBtn = H.el('rct-save-btn');
      const printBtn = H.el('rct-print-btn');
      const pdfBtn = H.el('rct-pdf-btn');
      if (saveBtn) saveBtn.onclick = () => downloadPNG(receipt);
      if (printBtn) printBtn.onclick = () => printCanvas(canvas);
      if (pdfBtn) pdfBtn.onclick = () => savePDFFromCanvas(canvas, receipt);
    }, 30);
  }

  async function savePDFFromCanvas(canvas, receipt) {
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) { Notify.err('PDF library not loaded.'); return; }
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ unit: 'mm', format: 'a5' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgW = pw - 20;
      const imgH = Math.min(imgW * ratio, ph - 20);
      doc.addImage(imgData, 'PNG', 10, 10, imgW, imgH);
      doc.save(`Receipt-${receipt.receiptNumber}.pdf`);
      Notify.ok('Receipt saved as PDF.');
    } catch(e) { Notify.err('PDF failed: ' + e.message); }
  }

  return { generate, downloadPNG, printCanvas, showPreviewModal, savePDFFromCanvas };
})();
