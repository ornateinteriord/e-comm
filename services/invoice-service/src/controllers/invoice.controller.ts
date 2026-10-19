import { Request, Response, NextFunction } from 'express';
import { Invoice, IInvoiceDoc } from '../models/invoice.model.js';
import axios from 'axios';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4006';

const DEFAULT_SELLER = {
  name: process.env.SELLER_NAME ?? 'Ornate Store Pvt Ltd',
  address: process.env.SELLER_ADDRESS ?? '42 Tech Hub, Outer Ring Road, Bengaluru, Karnataka, 560103',
  gstin: process.env.SELLER_GSTIN ?? '29ABCDE1234F1Z5',
  email: process.env.SELLER_EMAIL ?? 'store@Ornate.dev',
  phone: process.env.SELLER_PHONE ?? '+91-9876543210',
};

export async function generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let orderData = req.body.order;
    const orderId = req.body.orderId;

    if (!orderData && orderId) {
      try {
        const orderRes = await axios.get(`${ORDER_SERVICE_URL}/api/v1/orders/${orderId}`, {
          headers: {
            ...(req.headers.authorization && { Authorization: req.headers.authorization }),
          },
        });
        orderData = orderRes.data.data;
      } catch {
        // fallback
      }
    }

    if (!orderData) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Order data or valid orderId required.' } });
      return;
    }

    // Check if invoice already exists for this order
    const existing = await Invoice.findOne({ orderId: orderData._id || orderData.id || orderId });
    if (existing) {
      res.json({ success: true, data: existing, message: 'Existing invoice retrieved.' });
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-2026-${randomNum}`;

    const lineItems = (orderData.items || []).map((it: any) => ({
      name: it.name,
      sku: it.sku,
      quantity: it.quantity,
      unitPrice: it.unitApplicablePrice || it.unitPrice || 0,
      discount: it.discount || 0,
      taxRate: 18,
      taxAmount: Math.round(((it.lineTotal || 0) * 0.18) / 1.18),
      lineTotal: it.lineTotal || 0,
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
      orderId: String(orderData._id || orderData.id || orderId),
      orderNumber: orderData.orderNumber || `ORD-${orderId}`,
      invoiceDate: new Date().toISOString(),
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
      paymentReference: orderData.paymentReference,
    });

    res.status(201).json({ success: true, data: invoice, message: 'Tax Invoice generated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceByOrderId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId } = req.params;
    const invoice = await Invoice.findOne({ $or: [{ orderId }, { orderNumber: orderId }] });
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
    const { id } = req.params;
    const isObjectId = Boolean(String(id).match(/^[0-9a-fA-F]{24}$/));
    const invoice = await Invoice.findOne(isObjectId ? { $or: [{ _id: id }, { invoiceNumber: id }] } : { invoiceNumber: id });

    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found.' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function renderInvoiceHtml(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const isObjectId = Boolean(String(id).match(/^[0-9a-fA-F]{24}$/));
    const inv = await Invoice.findOne(isObjectId ? { $or: [{ _id: id }, { invoiceNumber: id }, { orderId: id }] } : { $or: [{ invoiceNumber: id }, { orderNumber: id }] });

    if (!inv) {
      res.status(404).send('<h2>Invoice Not Found</h2>');
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice - ${inv.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 800; color: #2563eb; }
    .badge { background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
    .meta-box { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 14px; }
    th { background: #f8fafc; padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .totals { margin-top: 24px; width: 320px; margin-left: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 10px; color: #0f172a; }
    .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="logo">Ornate</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Original Tax Invoice</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 700;">${inv.invoiceNumber}</div>
      <div style="font-size: 13px; color: #64748b;">Order: ${inv.orderNumber}</div>
      <div style="font-size: 13px; color: #64748b;">Date: ${new Date(inv.invoiceDate).toLocaleDateString()}</div>
      <span class="badge" style="margin-top: 6px; display: inline-block;">PAID</span>
    </div>
  </div>

  <div class="meta-box">
    <div>
      <div class="section-title">Sold By (Seller)</div>
      <div style="font-weight: 700;">${inv.sellerDetails.name}</div>
      <div>${inv.sellerDetails.address}</div>
      <div>GSTIN: <strong>${inv.sellerDetails.gstin}</strong></div>
      <div>Email: ${inv.sellerDetails.email} | Phone: ${inv.sellerDetails.phone}</div>
    </div>
    <div>
      <div class="section-title">Billed & Shipped To</div>
      <div style="font-weight: 700;">${inv.customerDetails.name}</div>
      <div>${inv.customerDetails.billingAddress?.line1 || ''} ${inv.customerDetails.billingAddress?.line2 || ''}</div>
      <div>${inv.customerDetails.billingAddress?.city || ''}, ${inv.customerDetails.billingAddress?.state || ''} - ${inv.customerDetails.billingAddress?.pincode || ''}</div>
      <div>Phone: ${inv.customerDetails.phone || inv.customerDetails.billingAddress?.phone || 'N/A'}</div>
      <div>Email: ${inv.customerDetails.email}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item Description</th>
        <th>SKU</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Tax (18%)</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${inv.lineItems
        .map(
          (item) => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="color: #64748b;">${item.sku}</td>
          <td class="text-right">₹${(item.unitPrice / 100).toFixed(2)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">₹${(item.taxAmount / 100).toFixed(2)}</td>
          <td class="text-right"><strong>₹${(item.lineTotal / 100).toFixed(2)}</strong></td>
        </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal:</span><span>₹${(inv.subtotal / 100).toFixed(2)}</span></div>
    ${inv.couponDiscount > 0 ? `<div class="totals-row" style="color: #16a34a;"><span>Discount:</span><span>-₹${(inv.couponDiscount / 100).toFixed(2)}</span></div>` : ''}
    <div class="totals-row"><span>Shipping:</span><span>${inv.shippingCharge === 0 ? 'FREE' : `₹${(inv.shippingCharge / 100).toFixed(2)}`}</span></div>
    ${inv.taxBreakdown.map((t) => `<div class="totals-row" style="color: #64748b;"><span>${t.description}:</span><span>₹${(t.taxAmount / 100).toFixed(2)}</span></div>`).join('')}
    <div class="totals-row grand-total"><span>Grand Total:</span><span>₹${(inv.grandTotal / 100).toFixed(2)}</span></div>
  </div>

  <div class="footer">
    This is a computer-generated tax invoice. No physical signature is required.<br/>
    Thank you for shopping with ${inv.sellerDetails.name}!
  </div>
</body>
</html>
`;
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
