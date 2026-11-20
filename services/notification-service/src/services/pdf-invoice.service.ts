import PDFDocument from 'pdfkit';
import path from 'node:path';
import fs from 'node:fs';
import { createLogger } from '@ornate/logger';

const log = createLogger('pdf-invoice-service');

export interface InvoiceItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number; // in paise
  discount?: number; // in paise
  taxRate?: number; // e.g. 18
  lineTotal: number; // in paise
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string | Date;
  orderDate?: string | Date;
  paymentMethod?: string;
  paymentReference?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: {
    name?: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  billingAddress?: {
    name?: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
  };
  items: InvoiceItem[];
  pricing: {
    subtotal: number; // in paise
    couponDiscount?: number; // in paise
    shippingCharge?: number; // in paise
    tax?: number; // in paise
    grandTotal: number; // in paise
  };
}

/**
 * Searches for the official E-Shopy logo file on disk.
 */
function findLogoFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public/logo.png'),
    path.resolve(process.cwd(), 'public/logo-cropped-light.png'),
    path.resolve(process.cwd(), '../../public/logo.png'),
    path.resolve(process.cwd(), '../../public/logo-cropped-light.png'),
    path.resolve(process.cwd(), 'apps/web/public/logo.png'),
    path.resolve(process.cwd(), '../../apps/web/public/logo.png'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      return f;
    }
  }
  return null;
}

/**
 * Converts integer rupees into Indian numbering words (e.g. 1299 -> "One Thousand Two Hundred Ninety-Nine").
 */
function numberToIndianWords(amount: number): string {
  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const num = Math.floor(amount);
  if (num === 0) return 'Zero';

  function inWords(n: number): string {
    let str = '';
    if (n > 9999999) {
      str += inWords(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n > 99999) {
      str += inWords(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n > 999) {
      str += inWords(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n > 99) {
      str += inWords(Math.floor(n / 100)) + 'Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      }
    }
    return str;
  }

  return inWords(num).trim();
}

function formatInr(paise: number): string {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(rupees)
    .replace('INR', 'Rs.');
}

/**
 * Generates a commercial-grade, GST-compliant Tax Invoice PDF buffer.
 */
export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Tax Invoice - ${data.invoiceNumber}`,
          Author: 'E-Shopy Retail Pvt Ltd',
          Subject: `Tax Invoice for Order ${data.orderNumber}`,
          Keywords: 'Tax Invoice, GST, E-Shopy',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => {
        log.error({ err }, 'Error during PDF generation');
        reject(err);
      });

      const pageWidth = doc.page.width - 72; // 523pt printable width
      const leftMargin = 36;
      let y = 36;

      // ---- 1. BRAND & HEADER BAR ----
      const logoPath = findLogoFile();
      if (logoPath) {
        try {
          doc.image(logoPath, leftMargin, y, { height: 38 });
        } catch {
          // Fallback text logo
          doc.fontSize(22).font('Helvetica-Bold').fillColor('#0F172A').text('E-Shopy', leftMargin, y);
        }
      } else {
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#0F172A').text('E-Shopy', leftMargin, y);
      }

      // Header on Right: TAX INVOICE
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text('TAX INVOICE', leftMargin, y, {
        align: 'right',
        width: pageWidth,
      });
      doc.fontSize(8).font('Helvetica').fillColor('#64748B').text('ORIGINAL FOR RECIPIENT', leftMargin, y + 20, {
        align: 'right',
        width: pageWidth,
      });
      doc.fontSize(8).font('Helvetica').fillColor('#64748B').text('(Issued under Section 31 of CGST Act, 2017)', leftMargin, y + 30, {
        align: 'right',
        width: pageWidth,
      });

      y += 50;

      // Accent orange divider
      doc.rect(leftMargin, y, pageWidth, 2.5).fill('#FF7900');
      y += 8;

      // ---- 2. INVOICE META BANNER ----
      doc.rect(leftMargin, y, pageWidth, 44).fill('#F8FAFC');
      doc.rect(leftMargin, y, pageWidth, 44).lineWidth(0.5).stroke('#CBD5E1');

      const colWidth = pageWidth / 4;
      const metaY = y + 7;

      // Invoice Number
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text('INVOICE NUMBER', leftMargin + 8, metaY);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(data.invoiceNumber, leftMargin + 8, metaY + 11);

      // Invoice Date
      const invDate = new Date(data.invoiceDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text('INVOICE DATE', leftMargin + colWidth + 8, metaY);
      doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(invDate, leftMargin + colWidth + 8, metaY + 11);

      // Order Reference
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text('ORDER ID', leftMargin + colWidth * 2 + 8, metaY);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(data.orderNumber, leftMargin + colWidth * 2 + 8, metaY + 11);

      // Payment Status
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text('PAYMENT STATUS', leftMargin + colWidth * 3 + 8, metaY);
      const payMethod = data.paymentMethod ? data.paymentMethod.toUpperCase() : 'PREPAID';
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#16A34A').text(`PAID (${payMethod})`, leftMargin + colWidth * 3 + 8, metaY + 11);
      if (data.paymentReference) {
        doc.fontSize(7).font('Helvetica').fillColor('#64748B').text(`Ref: ${data.paymentReference.substring(0, 16)}`, leftMargin + colWidth * 3 + 8, metaY + 23);
      }

      y += 52;

      // ---- 3. SELLER & CUSTOMER ADDRESS BOXES ----
      const boxWidth = (pageWidth - 10) / 2;
      const boxHeight = 104;

      // Box 1: Seller
      doc.rect(leftMargin, y, boxWidth, boxHeight).fill('#FFFFFF');
      doc.rect(leftMargin, y, boxWidth, boxHeight).lineWidth(0.5).stroke('#E2E8F0');
      doc.rect(leftMargin, y, boxWidth, 18).fill('#0F172A');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF').text('SOLD BY (SELLER DETAILS)', leftMargin + 8, y + 5);

      const sY = y + 24;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text('E-Shopy Retail (Pvt Ltd)', leftMargin + 8, sY);
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
      doc.text('Registered Office: L-29 Ground Floor, Block L Mohan Garden,', leftMargin + 8, sY + 12);
      doc.text('Uttam Nagar, West Delhi, New Delhi, Delhi, India - 110059', leftMargin + 8, sY + 22);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text('GSTIN: 07ABCDE1234F1Z5  |  State: Delhi (07)', leftMargin + 8, sY + 36);
      doc.font('Helvetica').fillColor('#475569').text('Helpline: +91 7676518566 | +91 7411011100', leftMargin + 8, sY + 48);
      doc.font('Helvetica').fillColor('#475569').text('Care: eshopy650@gmail.com | 77411011100sandeep@gmail.com', leftMargin + 8, sY + 58);

      // Box 2: Customer (Billed & Shipped To)
      const cLeft = leftMargin + boxWidth + 10;
      doc.rect(cLeft, y, boxWidth, boxHeight).fill('#FFFFFF');
      doc.rect(cLeft, y, boxWidth, boxHeight).lineWidth(0.5).stroke('#E2E8F0');
      doc.rect(cLeft, y, boxWidth, 18).fill('#0F172A');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF').text('BILLED & SHIPPED TO (CUSTOMER)', cLeft + 8, y + 5);

      const cY = y + 24;
      const custName = data.customerName || data.shippingAddress.name || 'Customer';
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(custName, cLeft + 8, cY);
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
      doc.text(`${data.shippingAddress.line1 || ''} ${data.shippingAddress.line2 || ''}`.trim(), cLeft + 8, cY + 11);
      doc.text(`${data.shippingAddress.city || ''}, ${data.shippingAddress.state || ''} - ${data.shippingAddress.pincode || ''}`, cLeft + 8, cY + 20);
      doc.text(`Country: ${data.shippingAddress.country || 'India'}`, cLeft + 8, cY + 29);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(`Mobile: ${data.customerPhone || data.shippingAddress.phone || 'N/A'}`, cLeft + 8, cY + 40);
      if (data.customerEmail) {
        doc.font('Helvetica').fillColor('#475569').text(`Email: ${data.customerEmail}`, cLeft + 8, cY + 50);
      }
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(`Place of Supply: ${data.shippingAddress.state || 'Karnataka'}`, cLeft + 8, cY + 60);

      y += boxHeight + 14;

      // ---- 4. ITEMS TABLE ----
      const tableHeaders = [
        { label: '#', width: 22, align: 'center' as const },
        { label: 'Description of Goods', width: 200, align: 'left' as const },
        { label: 'Qty', width: 30, align: 'center' as const },
        { label: 'Gross (Rs.)', width: 65, align: 'right' as const },
        { label: 'Discount', width: 50, align: 'right' as const },
        { label: 'Taxable Val', width: 68, align: 'right' as const },
        { label: 'Tax (18%)', width: 50, align: 'right' as const },
        { label: 'Total (Rs.)', width: pageWidth - (22 + 200 + 30 + 65 + 50 + 68 + 50), align: 'right' as const },
      ];

      // Table Header Row
      doc.rect(leftMargin, y, pageWidth, 20).fill('#0F172A');
      let currX = leftMargin;
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
      tableHeaders.forEach((col) => {
        doc.text(col.label, currX + 3, y + 6, { width: col.width - 6, align: col.align });
        currX += col.width;
      });

      y += 20;

      // Table Data Rows
      const items = data.items || [];
      items.forEach((it, idx) => {
        const rowHeight = 24;
        const isEven = idx % 2 === 0;

        // Background
        doc.rect(leftMargin, y, pageWidth, rowHeight).fill(isEven ? '#FFFFFF' : '#F8FAFC');
        doc.rect(leftMargin, y, pageWidth, rowHeight).lineWidth(0.5).stroke('#E2E8F0');

        let rowX = leftMargin;
        const grossPaise = it.unitPrice * it.quantity;
        const discPaise = (it.discount || 0) * it.quantity;
        const taxablePaise = Math.max(0, grossPaise - discPaise);
        const taxPaise = Math.round((taxablePaise * 0.18) / 1.18);
        const netPaise = it.lineTotal || taxablePaise;

        // 1. Sl No
        doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
        doc.text(String(idx + 1), rowX + 3, y + 7, { width: tableHeaders[0].width - 6, align: 'center' });
        rowX += tableHeaders[0].width;

        // 2. Name & SKU
        doc.font('Helvetica-Bold').fillColor('#0F172A');
        doc.text(it.name.substring(0, 38), rowX + 4, y + 4, { width: tableHeaders[1].width - 8, align: 'left' });
        if (it.sku) {
          doc.fontSize(6.5).font('Helvetica').fillColor('#64748B');
          doc.text(`SKU: ${it.sku}`, rowX + 4, y + 14, { width: tableHeaders[1].width - 8, align: 'left' });
        }
        rowX += tableHeaders[1].width;

        // 3. Qty
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0F172A');
        doc.text(String(it.quantity), rowX + 3, y + 7, { width: tableHeaders[2].width - 6, align: 'center' });
        rowX += tableHeaders[2].width;

        // 4. Gross Price
        doc.font('Helvetica').fillColor('#475569');
        doc.text(((grossPaise || 0) / 100).toFixed(2), rowX + 3, y + 7, { width: tableHeaders[3].width - 6, align: 'right' });
        rowX += tableHeaders[3].width;

        // 5. Discount
        doc.text(discPaise > 0 ? `-${(discPaise / 100).toFixed(2)}` : '0.00', rowX + 3, y + 7, { width: tableHeaders[4].width - 6, align: 'right' });
        rowX += tableHeaders[4].width;

        // 6. Taxable Val
        doc.text(((taxablePaise || 0) / 100).toFixed(2), rowX + 3, y + 7, { width: tableHeaders[5].width - 6, align: 'right' });
        rowX += tableHeaders[5].width;

        // 7. Tax
        doc.text(((taxPaise || 0) / 100).toFixed(2), rowX + 3, y + 7, { width: tableHeaders[6].width - 6, align: 'right' });
        rowX += tableHeaders[6].width;

        // 8. Line Total
        doc.font('Helvetica-Bold').fillColor('#0F172A');
        doc.text(((netPaise || 0) / 100).toFixed(2), rowX + 3, y + 7, { width: tableHeaders[7].width - 6, align: 'right' });

        y += rowHeight;
      });

      y += 8;

      // ---- 5. TOTALS & SUMMARY SECTION ----
      const totalsWidth = 230;
      const totalsLeft = leftMargin + pageWidth - totalsWidth;
      const wordsWidth = pageWidth - totalsWidth - 14;

      // Left: Amount in words & Tax breakup note
      doc.rect(leftMargin, y, wordsWidth, 80).fill('#F8FAFC');
      doc.rect(leftMargin, y, wordsWidth, 80).lineWidth(0.5).stroke('#CBD5E1');

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text('TOTAL AMOUNT IN WORDS', leftMargin + 8, y + 7);
      const grandTotalRupees = Math.round((data.pricing.grandTotal || 0) / 100);
      const words = `Indian Rupees ${numberToIndianWords(grandTotalRupees)} Only`;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(words, leftMargin + 8, y + 19, { width: wordsWidth - 16 });

      doc.fontSize(7).font('Helvetica').fillColor('#64748B');
      doc.text('Tax Split: Includes CGST @ 9% & SGST @ 9% for intra-state supply, or IGST @ 18% for inter-state supply.', leftMargin + 8, y + 46, { width: wordsWidth - 16 });
      doc.text('Reverse Charge Applicable: NO. Tax payable on forward charge basis.', leftMargin + 8, y + 60, { width: wordsWidth - 16 });

      // Right: Calculation Summary Box
      doc.rect(totalsLeft, y, totalsWidth, 108).fill('#FFFFFF');
      doc.rect(totalsLeft, y, totalsWidth, 108).lineWidth(0.5).stroke('#CBD5E1');

      let tY = y + 6;
      const renderTotalLine = (label: string, val: string, isBold = false, color = '#0F172A') => {
        doc.fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, totalsLeft + 10, tY);
        doc.text(val, totalsLeft + 10, tY, { width: totalsWidth - 20, align: 'right' });
        tY += 13;
      };

      renderTotalLine('Subtotal (Gross Items):', formatInr(data.pricing.subtotal));
      if ((data.pricing.couponDiscount || 0) > 0) {
        renderTotalLine('Coupon Savings / Discount:', `-${formatInr(data.pricing.couponDiscount || 0)}`, false, '#16A34A');
      }
      const shipPaise = data.pricing.shippingCharge || 0;
      renderTotalLine('Shipping & Handling:', shipPaise === 0 ? 'FREE' : formatInr(shipPaise));

      const taxPaise = data.pricing.tax || Math.round(((data.pricing.subtotal || 0) * 0.18) / 1.18);
      renderTotalLine('Total GST Included (18%):', formatInr(taxPaise), false, '#64748B');

      // Grand Total Highlight
      doc.rect(totalsLeft, tY + 2, totalsWidth, 24).fill('#0F172A');
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#FFFFFF').text('GRAND TOTAL (INR):', totalsLeft + 10, tY + 8);
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#FF7900').text(formatInr(data.pricing.grandTotal), totalsLeft + 10, tY + 7, {
        width: totalsWidth - 20,
        align: 'right',
      });

      y += 118;

      // ---- 6. TERMS & CONDITIONS + SIGNATURE FOOTER ----
      const footerY = y;
      const termWidth = pageWidth - 160;

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0F172A').text('TERMS & CONDITIONS:', leftMargin, footerY);
      doc.fontSize(6.5).font('Helvetica').fillColor('#64748B');
      doc.text('1. All disputes are subject to Karnataka jurisdiction only.', leftMargin, footerY + 10);
      doc.text('2. Please retain this invoice for warranty and returns. Eligible returns are accepted as per E-Shopy Return Policy.', leftMargin, footerY + 18);
      doc.text('3. This is a computer-generated tax invoice and does not require physical signature.', leftMargin, footerY + 26);
      doc.text('4. Customer Care: 77411011100sandeep@gmail.com | +91 7676518566 (Mon-Sat 9AM-7PM IST)', leftMargin, footerY + 34);

      // Signature Block
      const sigLeft = leftMargin + termWidth + 10;
      doc.rect(sigLeft, footerY, 150, 48).lineWidth(0.5).stroke('#E2E8F0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#0F172A').text('For E-Shopy Retail (Pvt Ltd)', sigLeft + 6, footerY + 6, {
        width: 138,
        align: 'center',
      });
      doc.fontSize(6).font('Helvetica').fillColor('#16A34A').text('Digitally Verified & Authorized', sigLeft + 6, footerY + 24, {
        width: 138,
        align: 'center',
      });
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748B').text('AUTHORIZED SIGNATORY', sigLeft + 6, footerY + 36, {
        width: 138,
        align: 'center',
      });

      // Bottom Bar
      doc.rect(leftMargin, doc.page.height - 24, pageWidth, 12).fill('#F8FAFC');
      doc.fontSize(6.5).font('Helvetica').fillColor('#94A3B8').text(
        'E-Shopy Retail | L-29 Ground Floor, Block L Mohan Garden, Uttam Nagar, West Delhi, New Delhi - 110059 | www.eshopy.biz',
        leftMargin,
        doc.page.height - 21,
        { width: pageWidth, align: 'center' },
      );

      doc.end();
    } catch (err) {
      log.error({ err }, 'Failed to construct PDF document');
      reject(err);
    }
  });
}

