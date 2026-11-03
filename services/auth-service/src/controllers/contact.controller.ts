import { Request, Response, NextFunction } from 'express';
import { ContactMessage } from '../models/contact.model.js';
import { createLogger } from '@ornate/logger';

const log = createLogger('contact-controller');

// POST /api/v1/contact
export async function submitContactMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, phone, subject, message } = req.body;

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanSubject = String(subject || 'General Inquiry').trim();
    const cleanMessage = String(message || '').trim();

    if (!cleanName || !cleanEmail || !cleanMessage) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name, email, and message are required.' },
      });
      return;
    }

    // Basic email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' },
      });
      return;
    }

    const inquiry = await ContactMessage.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone || undefined,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'new',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    log.info({ inquiryId: inquiry.id, email: cleanEmail }, 'New contact message submitted');

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Your message has been received and our team will get back to you shortly.',
      data: {
        id: inquiry.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/contact
export async function listContactMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;

    const filter: Record<string, any> = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { subject: regex },
        { message: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ContactMessage.countDocuments(filter),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      id: item._id.toString(),
      _id: item._id.toString(),
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/contact/:id
export async function updateContactMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const updateData: Record<string, any> = {};
    if (status) updateData.status = status;
    if (typeof adminNotes === 'string') updateData.adminNotes = adminNotes;

    const updated = await ContactMessage.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Contact inquiry not found.' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...updated,
        id: updated._id.toString(),
        _id: updated._id.toString(),
      },
      message: 'Inquiry updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/admin/contact/:id
export async function deleteContactMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await ContactMessage.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Contact inquiry not found.' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Contact inquiry deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

