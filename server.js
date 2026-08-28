const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// load .env
dotenv.config({ path: path.join(__dirname, '.env') });

const email = process.env.EMAIL;
const email_password = process.env.EMAIL_PASSWORD;
const jwt_secret = process.env.JWT_SECRET;
const client_url = process.env.CLIENT_URL || process.env.URL;

if (!jwt_secret) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env');
    process.exit(1);
}

const app = express();

app.use(express.json());
app.use(cors({ origin: client_url }));

/**
 * Nodemailer transporter configured for Gmail
 * 
 * @var {nodemailer.Transporter}
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: email_password },
});


/**
 * Writes a log entry to logs.txt with timestamp
 * 
 * @param {string} message The log message
 * @returns {void}
 */
function write_log(message) {
    const log_entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(path.join(__dirname, 'logs.txt'), log_entry, (err) => {
        if (err) console.error('Error writing log:', err);
    });
    console.log(log_entry.trim());
}

/**
 * GET /request/config
 * 
 * Returns public configuration of the service.
 * 
 * @route GET /request/config
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} JSON with configuration
 */
app.get('/request/config', (req, res) => {
    res.json({
        port: process.env.PORT || 3000,
        sending_email: process.env.EMAIL || 'not set',
        cors_url: process.env.CLIENT_URL || 'not set',
        server: 'emailing microservice'
    });
});

/**
 * POST /request
 * 
 * Sends an email after validating a JWT token.
 * 
 * Expected headers:
 *   - Authorization: Bearer <jwt_token>
 * 
 * Expected JSON body:
 *   - full_name (string) : Sender's full name
 *   - email (string)     : Sender's email address (used as reply-to, but not as sender)
 *   - subject (string)   : Email subject
 *   - message (string)   : Email body content
 * 
 * The JWT must contain:
 *   - verified: true
 *   - type: 'email_verification' (optional, but recommended)
 * 
 * @route POST /request
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {void} JSON response with success or error
 */
app.post('/request', async (req, res) => {
    console.log('📩 New email request received');

    const { full_name, email: client_email, subject, message } = req.body;
    const client_ip = req.ip || req.connection.remoteAddress;

    // 1. fields validation
    if (!full_name || !client_email || !subject || !message) {
        write_log(`Bad request - IP: ${client_ip} - Missing required fields`);
        return res.status(400).json({ error: 'Missing required fields: full_name, email, subject, message' });
    }

    // 2. Authorization header validation
    const auth_header = req.headers.authorization;
    if (!auth_header || !auth_header.startsWith('Bearer ')) {
        write_log(`Unauthorized attempt - IP: ${client_ip} - Missing or invalid Authorization header`);
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = auth_header.split(' ')[1];

    // 3. JWT verification (sync with try/catch)
    let decoded;
    try {
        decoded = jwt.verify(token, jwt_secret);
    } catch (err) {
        write_log(`JWT verification failed - IP: ${client_ip} - Error: ${err.message}`);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 4. payload validation
    if (!decoded.verified || decoded.verified !== true) {
        write_log(`Invalid JWT payload - IP: ${client_ip} - verified claim is not true`);
        return res.status(403).json({ error: 'Token does not have verified: true' });
    }

    if (decoded.type && decoded.type !== 'email_verification') {
        write_log(`Invalid JWT payload - IP: ${client_ip} - invalid type: ${decoded.type}`);
        return res.status(403).json({ error: 'Invalid token type' });
    }

    // 5. send email
    const body_text = `Client: ${full_name}\nEmail: ${client_email}\nMessage: ${message}`;
    const mail_options = {
        from: email,
        to: email,
        subject: `Email from cesarobedfl.pro: ${subject}`,
        text: body_text,
    };

    try {
        const info = await transporter.sendMail(mail_options);
        console.log('✅ Email sent successfully:', info.messageId);
        res.json({ success: 'Email sent successfully' });
    } catch (error) {
        write_log(`Email send error - IP: ${client_ip} - Error: ${error.message}`);
        res.status(500).json({ error: 'Error sending email' });
    }
});

module.exports = app;

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`🚀 Email microservice running on port ${port}`);
        console.log(`🔗 CORS allowed: ${process.env.CLIENT_URL || 'undefined'}`);
    });
}