import express from 'express';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

let memoryDrafts = [];

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Delay helper to create a pause between each batch execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Send emails to users securely with a delay constraint 
router.post('/send', requireAuth, upload.array('attachments'), async (req, res) => {
    let { clients, subject, body, delay: requestDelay } = req.body;

    // Default to 2 seconds if not provided, else convert to integer
    const delayMs = requestDelay ? parseInt(requestDelay, 10) * 1000 : 2000;

    // In multipart/form-data, clients is sent as a JSON string
    if (typeof clients === 'string') {
        try {
            clients = JSON.parse(clients);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid clients data format' });
        }
    }

    if (!clients || clients.length === 0) {
        return res.status(400).json({ error: 'No clients selected' });
    }

    if (clients.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 emails per batch limit exceeded' });
    }

    // Use the admin's credential mappings
    const transporter = nodemailer.createTransport({
        service: 'gmail', // you can change service based on requirement
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let sentCount = 0;
    let failedCount = 0;
    let failureLogs = [];

    // Map Express Multer files to Nodemailer Attachment format
    const attachments = (req.files || []).map(file => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype
    }));

    for (let client of clients) {
        // Basic templating placeholder swaps
        let personalizedBody = body
            .replace(/{{name}}/g, client.name || '')
            .replace(/{{email}}/g, client.email || '')
            .replace(/{{company}}/g, client.company || '');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: client.email,
            subject: subject,
            text: personalizedBody,
            attachments: attachments
        };

        try {
            await transporter.sendMail(mailOptions);
            sentCount++;
            // Wait for specified delay
            await delay(delayMs);
        } catch (error) {
            failedCount++;
            failureLogs.push({ client: client.email, error: error.message });
        }
    }

    res.json({
        message: 'Campaign completed',
        sent: sentCount,
        failed: failedCount,
        errors: failureLogs,
    });
});

// Drafts endpoints
router.post('/drafts', requireAuth, async (req, res) => {
    try {
        const draft = {
            _id: Date.now().toString(),
            subject: req.body.subject,
            body: req.body.body,
            createdAt: new Date().toISOString()
        };
        memoryDrafts.unshift(draft);
        res.json(draft);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/drafts', requireAuth, async (req, res) => {
    try {
        res.json(memoryDrafts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/drafts/:id', requireAuth, async (req, res) => {
    try {
        memoryDrafts = memoryDrafts.filter(d => d._id !== req.params.id);
        res.json({ message: 'Deleted draft' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
