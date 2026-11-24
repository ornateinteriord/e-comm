import { Request, Response, NextFunction } from 'express';
import { Invoice, IInvoiceDoc } from '../models/invoice.model.js';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';

const DEFAULT_SELLER = {
  legalName: 'BLUSKY MICRO SERVICES FOUNDATION',
  brandName: 'E-Shopy Retail',
  name: 'BLUSKY MICRO SERVICES FOUNDATION',
  cin: 'U65100DL2022NPL407403',
  registrationNo: '407403 (ROC Delhi II)',
  address: 'L-29 Ground Floor, Block L Mohan Garden, Uttam Nagar, West Delhi, New Delhi - 110059',
  gstin: '07ABCDE1234F1Z5',
  stateCode: '07',
  stateName: 'Delhi',
  email: 'eshopy650@gmail.com',
  phone: '+91 7676518566',
  website: 'www.eshopy.biz',
};

export async function createOrGetInvoiceForOrder(orderData: any, customInvoiceNumber?: string): Promise<IInvoiceDoc> {
  const oId = String(orderData._id || orderData.id || '');
  const oNum = orderData.orderNumber || (oId ? `ORD-${oId}` : '');

  // 1. Check if invoice already exists
  const orConditions: any[] = [];
  if (oId) orConditions.push({ orderId: oId });
  if (oNum) {
    orConditions.push({ orderNumber: oNum });
    const cleanNum = oNum.replace(/^ORD-/i, '');
    orConditions.push({ orderNumber: cleanNum });
    orConditions.push({ orderNumber: `ORD-${cleanNum}` });
    orConditions.push({ orderId: oNum });
  }

  const existing = orConditions.length > 0 ? await Invoice.findOne({ $or: orConditions }) : null;
  if (existing) {
    return existing;
  }

  // 2. Generate random unique invoice number if not provided
  let invoiceNumber = customInvoiceNumber;
  if (!invoiceNumber) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    invoiceNumber = `INV-2026-${randomNum}`;
  }

  // 3. Line items
  const lineItems = (orderData.items || []).map((it: any) => ({
    name: it.name || it.productName || 'Catalog Product',
    sku: it.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    quantity: it.quantity || 1,
    unitPrice: it.unitApplicablePrice || it.unitPrice || 0,
    discount: it.discount || 0,
    taxRate: 18,
    taxAmount: Math.round(((it.lineTotal || (it.unitPrice || 0) * (it.quantity || 1)) * 0.18) / 1.18),
    lineTotal: it.lineTotal || (it.unitPrice || 0) * (it.quantity || 1),
  }));

  const subtotal = orderData.pricing?.subtotal || lineItems.reduce((acc: number, l: any) => acc + l.lineTotal, 0);
  const couponDiscount = orderData.pricing?.couponDiscount || 0;
  const taxable = Math.max(0, subtotal - couponDiscount);
  const cgst = Math.round(taxable * 0.09);
  const sgst = Math.round(taxable * 0.09);

  const taxBreakdown = [
    { description: 'CGST (9%)', rate: 9, taxableAmount: taxable, taxAmount: cgst },
    { description: 'SGST (9%)', rate: 9, taxableAmount: taxable, taxAmount: sgst },
  ];

  const invoice = await Invoice.create({
    invoiceNumber,
    orderId: oId || oNum,
    orderNumber: oNum || `ORD-${oId}`,
    invoiceDate: orderData.createdAt ? new Date(orderData.createdAt).toISOString() : new Date().toISOString(),
    sellerDetails: DEFAULT_SELLER,
    customerDetails: {
      name: orderData.customerName || orderData.shippingAddress?.name || 'Customer',
      email: orderData.customerEmail || 'customer@example.com',
      phone: orderData.shippingAddress?.phone || '',
      billingAddress: orderData.billingAddress || orderData.shippingAddress,
    },
    lineItems,
    taxBreakdown,
    subtotal,
    couponDiscount,
    shippingCharge: orderData.pricing?.shippingCharge || 0,
    totalTax: cgst + sgst,
    grandTotal: orderData.pricing?.grandTotal || (taxable + (orderData.pricing?.shippingCharge || 0) + cgst + sgst),
    currency: 'INR',
    paymentReference: orderData.paymentReference || orderData.gatewayOrderId || orderData.cashfreeOrderId,
  });

  return invoice;
}

export async function generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let orderData = req.body.order;
    const orderId = req.body.orderId;

    if (!orderData && orderId) {
      try {
        const orderRes = await axios.get(`${ORDER_SERVICE_URL}/api/v1/orders/${encodeURIComponent(orderId)}`, {
          headers: {
            ...(req.headers.authorization && { Authorization: req.headers.authorization }),
          },
          timeout: 5000,
        });
        orderData = orderRes.data?.data;
      } catch {
        // fallback
      }
    }

    if (!orderData) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Order data or valid orderId required.' } });
      return;
    }

    const invoice = await createOrGetInvoiceForOrder(orderData);
    res.status(201).json({ success: true, data: invoice, message: 'Tax Invoice generated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceByOrderId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = String(req.params.orderId || '');
    const cleanId = orderId ? orderId.replace(/^ORD-/i, '') : '';
    const invoice = await Invoice.findOne({
      $or: [
        { orderId },
        { orderId: cleanId },
        { orderNumber: orderId },
        { orderNumber: `ORD-${cleanId}` },
        { orderNumber: cleanId },
      ],
    });
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found for this order.' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    const isObjectId = Boolean(String(id).match(/^[0-9a-fA-F]{24}$/));
    const cleanId = id ? id.replace(/^ORD-/i, '') : '';
    const invoice = await Invoice.findOne({
      $or: [
        { invoiceNumber: id },
        { invoiceNumber: { $regex: `^${id}$`, $options: 'i' } },
        { orderNumber: id },
        { orderNumber: `ORD-${cleanId}` },
        { orderId: id },
        ...(isObjectId ? [{ _id: id }] : []),
      ],
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

function numberToIndianWords(amountPaise: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const totalPaise = Math.round(amountPaise);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

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

  const rupeeWords = rupees > 0 ? inWords(rupees).trim() + ' Rupees' : '';
  const paiseWords = paise > 0 ? inWords(paise).trim() + ' Paise' : '';

  if (rupeeWords && paiseWords) return `Indian ${rupeeWords} and ${paiseWords} Only`;
  if (rupeeWords) return `Indian ${rupeeWords} Only`;
  if (paiseWords) return `Indian ${paiseWords} Only`;
  return 'Indian Zero Rupees Only';
}

function formatCurrency(paise: number): string {
  const rs = (paise || 0) / 100;
  return '₹' + rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let cachedLogoSvg = '';
function getLogoSvg(): string {
  if (cachedLogoSvg) return cachedLogoSvg;
  cachedLogoSvg = `
    <svg width="140" height="36" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="17" fill="#FF7900"/>
      <path d="M8 12H11.5L14 23H25.5L27.5 15H13" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="14.5" y1="15" x2="26.5" y2="15" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="15.5" y1="19" x2="25.5" y2="19" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="16" cy="26" r="2" fill="white"/>
      <circle cx="24" cy="26" r="2" fill="white"/>
      <text x="42" y="26" font-family="'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="900" fill="#0f172a" letter-spacing="-0.03em">shopy</text>
      <text x="108" y="26" font-family="'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="800" fill="#FF7900" letter-spacing="-0.02em">.biz</text>
    </svg>
  `;
  return cachedLogoSvg;
}

export async function renderInvoiceHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id ? String(req.params.id).trim() : '';
    if (!rawId) {
      res.status(404).send('<!DOCTYPE html><html><body><h2>Invalid Invoice Identifier</h2></body></html>');
      return;
    }

    const isObjectId = Boolean(rawId.match(/^[0-9a-fA-F]{24}$/));
    const cleanId = rawId.replace(/^ORD-/i, '');

    let inv: IInvoiceDoc | null = await Invoice.findOne({
      $or: [
        { invoiceNumber: rawId },
        { invoiceNumber: { $regex: `^${rawId}$`, $options: 'i' } },
        { orderNumber: rawId },
        { orderNumber: `ORD-${cleanId}` },
        { orderNumber: cleanId },
        { orderId: rawId },
        { orderId: cleanId },
        ...(isObjectId ? [{ _id: rawId }] : []),
      ],
    });

    // If still not found, fallback to on-the-fly generation from order-service!
    if (!inv) {
      try {
        let orderData: any = null;
        try {
          const resp = await axios.get(`${ORDER_SERVICE_URL}/api/v1/orders/${encodeURIComponent(rawId)}`, { timeout: 4000 });
          if (resp.data?.success && resp.data?.data) {
            orderData = resp.data.data;
          }
        } catch {
          try {
            const searchResp = await axios.get(`${ORDER_SERVICE_URL}/api/v1/admin/orders?search=${encodeURIComponent(rawId)}&limit=1`, { timeout: 4000 });
            if (searchResp.data?.success && searchResp.data?.data?.items?.length > 0) {
              orderData = searchResp.data.data.items[0];
            }
          } catch {
            // ignore
          }
        }

        if (orderData) {
          inv = await createOrGetInvoiceForOrder(orderData);
        }
      } catch {
        // ignore
      }
    }

    if (!inv) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invoice Not Found</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:80px 20px;color:#334155;">
          <h2 style="font-size:24px;color:#dc2626;">Invoice Not Found</h2>
          <p>The requested invoice document does not exist or has been archived.</p>
        </body>
        </html>
      `);
      return;
    }

    // Official company seller details
    const sellerLegalName = DEFAULT_SELLER.legalName;
    const sellerAddress = DEFAULT_SELLER.address;
    const sellerGstin = DEFAULT_SELLER.gstin;
    const sellerEmail = DEFAULT_SELLER.email;
    const sellerPhone = DEFAULT_SELLER.phone;
    const sellerCin = DEFAULT_SELLER.cin;

    const formattedDate = new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const wordsText = numberToIndianWords(inv.grandTotal);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tax Invoice - ${inv.invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.45;
      padding: 30px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .action-bar {
      max-width: 860px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: flex-end;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #FF7900;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(255,121,0,0.25);
      transition: background 0.15s ease;
    }
    .btn-print:hover { background: #e66d00; }
    .invoice-card {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #0f172a;
    }
    .doc-type {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
      text-transform: uppercase;
      text-align: right;
    }
    .doc-sub {
      font-size: 11px;
      font-weight: 800;
      color: #FF7900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
      text-align: right;
    }
    .doc-statute {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 4px;
      text-align: right;
      max-width: 320px;
    }
    .company-desc {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      margin-top: 6px;
    }
    .company-cin-tag {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 10px;
      color: #475569;
      font-family: 'JetBrains Mono', monospace;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-top: 24px;
    }
    .meta-item .meta-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .meta-item .meta-val {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-paid {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 24px;
    }
    .party-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }
    .party-title {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .party-name {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .party-sub {
      font-size: 11px;
      font-weight: 700;
      color: #FF7900;
      margin-bottom: 6px;
    }
    .party-info {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.5;
    }
    .party-meta {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
      font-size: 11px;
      color: #334155;
    }
    .table-container {
      margin-top: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .invoice-table thead th {
      background: #f8fafc;
      padding: 10px 12px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .invoice-table tbody td {
      padding: 12px;
      font-size: 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
      word-wrap: break-word;
    }
    .invoice-table tbody tr:last-child td { border-bottom: none; }
    .item-name { font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .item-sku { font-size: 10.5px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
    .col-item { width: 44%; text-align: left; }
    .col-sku { width: 14%; text-align: left; }
    .col-price { width: 13%; text-align: right; }
    .col-qty { width: 8%; text-align: center; }
    .col-tax { width: 9%; text-align: right; }
    .col-total { width: 12%; text-align: right; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .bottom-section {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      margin-top: 24px;
    }
    .words-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      height: fit-content;
    }
    .words-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .words-value {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.4;
    }
    .tax-summary-mini {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
      color: #475569;
      line-height: 1.6;
    }
    .totals-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 18px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 12px;
      color: #475569;
    }
    .totals-row.discount { color: #16a34a; font-weight: 700; }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      margin-top: 6px;
      border-top: 2px solid #0f172a;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .grand-total-row span:last-child {
      font-size: 18px;
      font-weight: 900;
      font-family: 'JetBrains Mono', monospace;
      color: #FF7900;
    }
    .invoice-footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }
    @media print {
      @page { size: A4 portrait; margin: 10mm 12mm; }
      body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; }
      .no-print { display: none !important; }
      .invoice-card { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; border-radius: 0 !important; }
    }
    @media (max-width: 680px) {
      .invoice-card { padding: 20px 14px; }
      .header-row { flex-direction: column; gap: 14px; }
      .doc-type, .doc-sub, .doc-statute { text-align: left; }
      .meta-grid { grid-template-columns: 1fr 1fr; }
      .parties-grid { grid-template-columns: 1fr; }
      .bottom-section { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <button onclick="window.print()" class="btn-print">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="invoice-card">
    <div class="header-row">
      <div>
        ${getLogoSvg()}
        <div class="company-desc">Commercial Multi-Vendor Retail Platform</div>
        <div class="company-cin-tag">Operated by ${sellerLegalName} · CIN: ${sellerCin}</div>
      </div>
      <div>
        <div class="doc-type">Tax Invoice</div>
        <div class="doc-sub">Original for Recipient</div>
        <div class="doc-statute">(Issued under Section 31 of CGST Act, 2017 & Rule 46 of CGST Rules, 2017)</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Invoice Number</div>
        <div class="meta-val">${inv.invoiceNumber}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Invoice Date</div>
        <div class="meta-val">${formattedDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Order Number</div>
        <div class="meta-val">${inv.orderNumber}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Payment Status</div>
        <div class="meta-val"><span class="badge-paid">✓ PAID (PREPAID)</span></div>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-card">
        <div class="party-title">
          <span>Sold By (Supplier / Seller)</span>
          <span style="color:#059669; font-weight:800; font-size:10px;">VERIFIED GST SELLER</span>
        </div>
        <div class="party-name">${sellerLegalName}</div>
        <div class="party-sub">E-Shopy Retail</div>
        <div class="party-info">
          ${sellerAddress}
        </div>
        <div class="party-meta">
          <div>GSTIN: <strong>${sellerGstin}</strong> (State: Delhi - 07)</div>
          <div>Email: ${sellerEmail} | Phone: ${sellerPhone}</div>
        </div>
      </div>

      <div class="party-card">
        <div class="party-title">
          <span>Billed & Shipped To (Customer)</span>
          <span style="color:#475569; font-weight:800; font-size:10px;">CONSIGNEE</span>
        </div>
        <div class="party-name">${inv.customerDetails?.name || 'Customer'}</div>
        <div class="party-info">
          ${inv.customerDetails?.billingAddress?.line1 || (inv.customerDetails?.billingAddress as any)?.address || ''}<br/>
          ${inv.customerDetails?.billingAddress?.city || ''}${inv.customerDetails?.billingAddress?.state ? ', ' + inv.customerDetails?.billingAddress?.state : ''} ${inv.customerDetails?.billingAddress?.pincode ? '- ' + inv.customerDetails?.billingAddress?.pincode : ''}
        </div>
        <div class="party-meta">
          <div>Phone: ${inv.customerDetails?.phone || inv.customerDetails?.billingAddress?.phone || 'N/A'}</div>
          <div>Email: ${inv.customerDetails?.email || 'N/A'}</div>
          <div>Place of Supply: ${inv.customerDetails?.billingAddress?.state || 'Delhi'}</div>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="col-item">Item Description</th>
            <th class="col-sku">SKU</th>
            <th class="col-price">Unit Price</th>
            <th class="col-qty">Qty</th>
            <th class="col-tax">Tax (18%)</th>
            <th class="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${inv.lineItems.map((item) => `
            <tr>
              <td class="col-item">
                <div class="item-name">${item.name}</div>
              </td>
              <td class="col-sku"><span class="item-sku">${item.sku}</span></td>
              <td class="col-price mono">${formatCurrency(item.unitPrice)}</td>
              <td class="col-qty mono">${item.quantity}</td>
              <td class="col-tax mono">${formatCurrency(item.taxAmount)}</td>
              <td class="col-total mono" style="font-weight:700;">${formatCurrency(item.lineTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="bottom-section">
      <div class="words-box">
        <div class="words-label">Invoice Amount in Words</div>
        <div class="words-value">${wordsText}</div>
        <div class="tax-summary-mini">
          <div>CGST @ 9%: <strong>${formatCurrency(Math.round(inv.totalTax / 2))}</strong></div>
          <div>SGST @ 9%: <strong>${formatCurrency(Math.round(inv.totalTax / 2))}</strong></div>
          <div style="margin-top:4px; color:#64748b; font-size:10px;">Whether tax is payable on reverse charge basis: <strong>No</strong></div>
        </div>
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="mono">${formatCurrency(inv.subtotal)}</span>
        </div>
        ${inv.couponDiscount > 0 ? `
          <div class="totals-row discount">
            <span>Coupon Discount:</span>
            <span class="mono">-${formatCurrency(inv.couponDiscount)}</span>
          </div>
        ` : ''}
        <div class="totals-row">
          <span>Shipping Charge:</span>
          <span class="mono">${inv.shippingCharge === 0 ? 'FREE' : formatCurrency(inv.shippingCharge)}</span>
        </div>
        ${inv.taxBreakdown.map((t) => `
          <div class="totals-row">
            <span>${t.description}:</span>
            <span class="mono">${formatCurrency(t.taxAmount)}</span>
          </div>
        `).join('')}
        <div class="grand-total-row">
          <span>Grand Total:</span>
          <span>${formatCurrency(inv.grandTotal)}</span>
        </div>
      </div>
    </div>

    <div class="invoice-footer">
      <div>This is an official system-generated electronic tax invoice in compliance with the GST Act. No physical signature is required.</div>
      <div style="margin-top: 4px; font-weight:600; color:#64748b;">Registered Office: ${sellerAddress} | Support: ${sellerEmail}</div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
}

export async function adminListInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { search } = req.query;

    // Auto-sync: Ensure all paid orders from order-service have invoices generated
    try {
      const paidOrdersRes = await axios.get(`${ORDER_SERVICE_URL}/api/v1/admin/orders?paymentStatus=paid&limit=50`, {
        timeout: 4000,
        headers: {
          ...(req.headers.authorization && { Authorization: req.headers.authorization }),
        },
      });
      const paidOrders = paidOrdersRes.data?.data?.items || [];
      if (Array.isArray(paidOrders) && paidOrders.length > 0) {
        for (const po of paidOrders) {
          const poId = String(po._id || po.id || '');
          const poNum = po.orderNumber || '';
          const hasInv = await Invoice.exists({
            $or: [
              ...(poId ? [{ orderId: poId }] : []),
              ...(poNum ? [{ orderNumber: poNum }] : []),
            ],
          });
          if (!hasInv) {
            await createOrGetInvoiceForOrder(po).catch(() => {});
          }
        }
      }
    } catch {
      // Non-blocking sync error
    }

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: String(search), $options: 'i' } },
        { orderNumber: { $regex: String(search), $options: 'i' } },
        { 'customerDetails.name': { $regex: String(search), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
