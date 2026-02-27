require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const os = require('os');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const speakeasy = require('speakeasy');
const TronWeb = require('tronweb');

// Generate confirmation token
const generateToken = () => crypto.randomBytes(32).toString('hex');

// Small helper for structured login logging (no passwords!)
function logLoginEvent(type, payload) {
    try {
        const base = typeof payload === 'object' && payload !== null ? payload : {};
        const safe = {
            ...base,
            email: base.email ? String(base.email).toLowerCase() : undefined,
        };
        console.log(`[auth/login] ${type}`, safe);
    } catch {
        // ignore logging errors
    }
}

// ==================== DISPOSABLE / BLOCKED EMAIL DOMAINS ====================
// External blocklist file (updated by cron): server/data/disposable_email_blocklist.conf
const DISPOSABLE_BLOCKLIST_PATH = path.join(__dirname, 'data', 'disposable_email_blocklist.conf');
let disposableBlocklistCache = { mtimeMs: 0, set: new Set() };

function loadDisposableBlocklist() {
    try {
        const st = fs.statSync(DISPOSABLE_BLOCKLIST_PATH);
        if (st.mtimeMs === disposableBlocklistCache.mtimeMs && disposableBlocklistCache.set.size > 0) {
            return disposableBlocklistCache.set;
        }
        const raw = fs.readFileSync(DISPOSABLE_BLOCKLIST_PATH, 'utf8');
        const next = new Set();
        for (const line of raw.split(/\r?\n/)) {
            const t = line.trim().toLowerCase();
            if (!t || t.startsWith('#')) continue;
            // no '@' expected, but tolerate it
            next.add(t.replace(/^@/, ''));
        }
        disposableBlocklistCache = { mtimeMs: st.mtimeMs, set: next };
        console.log(`[blocklist] loaded ${next.size} disposable domains from ${DISPOSABLE_BLOCKLIST_PATH}`);
        return next;
    } catch (_) {
        // Missing file or unreadable: treat as empty list (cron may not be set up yet)
        if (disposableBlocklistCache.set.size === 0) {
            console.warn(`[blocklist] file not found or unreadable: ${DISPOSABLE_BLOCKLIST_PATH} (run scripts/update_disposable_email_domains.sh on server)`);
        }
        return disposableBlocklistCache.set || new Set();
    }
}

function normalizeEmailDomain(email) {
    try {
        const s = String(email || '').trim().toLowerCase();
        const at = s.lastIndexOf('@');
        if (at < 0) return '';
        return s.slice(at + 1).trim().replace(/^\.+|\.+$/g, '');
    } catch {
        return '';
    }
}

function domainCandidates(domain) {
    const parts = String(domain || '')
        .trim()
        .toLowerCase()
        .split('.')
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return [];
    const out = [];
    for (let i = 0; i < parts.length - 1; i++) {
        out.push(parts.slice(i).join('.'));
    }
    return out;
}

async function isBlockedEmail(email) {
    const domain = normalizeEmailDomain(email);
    if (!domain) return false;
    const candidates = domainCandidates(domain);
    if (candidates.length === 0) return false;

    const external = loadDisposableBlocklist();
    for (const d of candidates) {
        if (external.has(d)) return true;
    }

    // Internal admin-managed blocklist in DB (best-effort: don't break if table missing)
    try {
        const r = await pool.query('SELECT 1 FROM blocked_email_domains WHERE domain = ANY($1::text[]) LIMIT 1', [candidates]);
        return r.rows.length > 0;
    } catch (e) {
        if (e && e.message && /blocked_email_domains/i.test(e.message)) {
            // likely migration not applied yet
            return false;
        }
        throw e;
    }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (Nginx etc. sets X-Forwarded-For); required for express-rate-limit behind reverse proxy
app.set('trust proxy', 1);

// ========== Lightweight in-memory request & user activity metrics ==========
const requestMetrics = {
    totalRequests: 0,
    perMinuteTimestamps: []
};

const lastSeenByUserId = new Map();
const lastSeenByVisitorId = new Map();
const VISITOR_ID_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h cleanup
let lastVisitorCountsAt = 0;
let cachedVisitorCounts = { online30s: 0, active5mAll: 0, active15mAll: 0 };

function recordRequestForMetrics() {
    const now = Date.now();
    requestMetrics.totalRequests += 1;
    requestMetrics.perMinuteTimestamps.push(now);
    const cutoff = now - 60 * 1000;
    while (requestMetrics.perMinuteTimestamps.length && requestMetrics.perMinuteTimestamps[0] < cutoff) {
        requestMetrics.perMinuteTimestamps.shift();
    }
}

function getTrafficMetrics() {
    const now = Date.now();
    const cutoff = now - 60 * 1000;
    requestMetrics.perMinuteTimestamps = requestMetrics.perMinuteTimestamps.filter((ts) => ts >= cutoff);
    return {
        totalRequests: requestMetrics.totalRequests,
        requestsLastMinute: requestMetrics.perMinuteTimestamps.length
    };
}

function markUserActive(userId) {
    if (!userId) return;
    try {
        lastSeenByUserId.set(String(userId), Date.now());
    } catch {
        // ignore
    }
}

function getActiveUsersCounts() {
    const now = Date.now();
    const windows = [5 * 60 * 1000, 15 * 60 * 1000];
    const counts = [0, 0];
    for (const ts of lastSeenByUserId.values()) {
        const diff = now - ts;
        if (diff <= windows[0]) counts[0] += 1;
        if (diff <= windows[1]) counts[1] += 1;
    }
    return {
        active5m: counts[0],
        active15m: counts[1]
    };
}

function markVisitorActive(visitorId) {
    if (!visitorId || typeof visitorId !== 'string') return;
    try {
        lastSeenByVisitorId.set(String(visitorId).slice(0, 64), Date.now());
    } catch {
        // ignore
    }
}

function getOnlineVisitorsCounts() {
    const now = Date.now();
    if (now - lastVisitorCountsAt < 1500) return cachedVisitorCounts;
    lastVisitorCountsAt = now;
    const w30s = 30 * 1000;
    const w5m = 5 * 60 * 1000;
    const w15m = 15 * 60 * 1000;
    let online30s = 0, active5mAll = 0, active15mAll = 0;
    for (const ts of lastSeenByVisitorId.values()) {
        const diff = now - ts;
        if (diff <= w30s) online30s += 1;
        if (diff <= w5m) active5mAll += 1;
        if (diff <= w15m) active15mAll += 1;
    }
    cachedVisitorCounts = { online30s, active5mAll, active15mAll };
    return cachedVisitorCounts;
}

// Periodically prune old visitor entries so map does not grow unbounded
setInterval(() => {
    try {
        const cutoff = Date.now() - VISITOR_ID_MAX_AGE_MS;
        for (const [id, ts] of lastSeenByVisitorId.entries()) {
            if (ts < cutoff) lastSeenByVisitorId.delete(id);
        }
    } catch {
        // ignore
    }
}, 5 * 60 * 1000); // every 5 minutes

// Global middleware to count requests (cheap, no DB)
app.use((req, res, next) => {
    recordRequestForMetrics();
    next();
});

// Middleware (20MB limit so certificate PNG base64 fits)
const isProduction = process.env.NODE_ENV === 'production';
app.use(cors(isProduction ? { origin: process.env.CORS_ORIGIN || 'https://your-domain.com' } : undefined));
app.use(helmet());
app.use(express.json({ limit: 20 * 1024 * 1024 }));

// Serve static files (PDFs, etc.) from /public folder
app.use('/download', express.static(path.join(__dirname, 'public')));

// Uploads dir for email attachments (images, documents)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// GET /api/uploads/:filename — serve uploaded file (so nginx proxy to /api reaches this; payment-issue screenshots use this URL)
app.get('/api/uploads/:filename', (req, res) => {
    const raw = req.params.filename || '';
    const filename = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return res.status(400).end();
    const filePath = path.join(uploadsDir, filename);
    const resolved = path.resolve(filePath);
    const resolvedDir = path.resolve(uploadsDir);
    if (!resolved.startsWith(resolvedDir) || resolved === resolvedDir || !fs.existsSync(filePath)) return res.status(404).end();
    res.sendFile(filePath, { maxAge: '1d' });
});

// Test: GET /api/ping returns 200 if this server is running (use to verify port 3001 is this app)
app.get('/api/ping', (req, res) => res.json({ ok: true, message: 'Dashboard API' }));

// POST /api/metrics/visitor-heartbeat - Anonymous visitor ping for online count (no auth)
const visitorHeartbeatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
app.post('/api/metrics/visitor-heartbeat', visitorHeartbeatLimiter, (req, res) => {
    const visitorId = req.body && typeof req.body.visitorId === 'string' ? req.body.visitorId.trim() : '';
    if (!visitorId || visitorId.length > 64 || !/^[a-z0-9-]+$/i.test(visitorId)) {
        return res.status(400).json({ ok: false });
    }
    markVisitorActive(visitorId);
    res.json({ ok: true });
});

// GET /api/site-media - Public: PDF and welcome video URLs per locale (for thank-you page)
// Two different Wistia videos: EN and AM (aligned with src/contentMedia.ts)
const DEFAULT_WELCOME_VIDEO_EN = 'https://fast.wistia.net/embed/iframe/itbz1tz9q3?videoFoam=true';
const DEFAULT_WELCOME_VIDEO_AM = 'https://fast.wistia.net/embed/iframe/xerm5log0a?videoFoam=true';
const DEFAULT_PDF_LINK_EN = 'https://drive.google.com/file/d/1DEP8ABq-vjZfK1TWTYQkhJEAcSasqZn5/view?usp=sharing'; // English: original Liquidity Sweep Cheatsheet
const DEFAULT_PDF_LINK_AM = 'https://drive.google.com/file/d/1Y4yz845u2n7y8la2t9oaaieCUfnnq0A0/view?usp=sharing';   // Armenian PDF
app.get('/api/site-media', (req, res) => {
    const locale = (req.query.locale === 'am' ? 'am' : 'en');
    const pdfEnv = locale === 'am' ? (process.env.PDF_LINK_AM || process.env.PDF_LINK) : (process.env.PDF_LINK_EN || process.env.PDF_LINK);
    const videoEnv = locale === 'am' ? process.env.WELCOME_VIDEO_AM : process.env.WELCOME_VIDEO_EN;
    const defaultVideo = locale === 'am' ? DEFAULT_WELCOME_VIDEO_AM : DEFAULT_WELCOME_VIDEO_EN;
    res.json({
        welcomePdfUrl: pdfEnv || (locale === 'am' ? DEFAULT_PDF_LINK_AM : DEFAULT_PDF_LINK_EN),
        welcomeVideoUrl: videoEnv || defaultVideo
    });
});

// ==================== PROFILE & AUTH (register first so /api/me is always available) ====================
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
}
const jwtSecret = process.env.JWT_SECRET || 'superengulfing-dashboard-secret';

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = { id: decoded.sub, email: decoded.email };
        // track activity for realtime metrics
        markUserActive(decoded.sub);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Admin two-step auth: allowed emails (union of ADMIN_EMAILS_EN + ADMIN_EMAILS_AM, fallback: ADMIN_EMAILS or legacy ADMIN_EMAIL)
const adminEmailsEn = (process.env.ADMIN_EMAILS_EN || process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
const adminEmailsAm = (process.env.ADMIN_EMAILS_AM || process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
const ADMIN_EMAILS = [...new Set([...adminEmailsEn, ...adminEmailsAm])];
const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'superengulfing-admin-secret';
const requireAdminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Admin authorization required' });
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, adminJwtSecret);
        if (decoded.type !== 'admin' || !ADMIN_EMAILS.includes((decoded.email || '').toLowerCase())) {
            return res.status(401).json({ error: 'Invalid admin token' });
        }
        req.admin = { email: decoded.email };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired admin token' });
    }
};

// ==================== BLOCKED EMAIL DOMAINS (ADMIN) ====================
// Internal blocklist managed from the Admin UI. Supplements the external disposable blocklist file.
function normalizeDomainInput(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return '';
    const withoutAt = s.includes('@') ? s.split('@').pop() : s;
    return String(withoutAt || '').trim().replace(/^\.+|\.+$/g, '');
}

function isValidDomain(domain) {
    if (!domain) return false;
    if (domain.length > 255) return false;
    if (!domain.includes('.')) return false;
    if (/[\/\s]/.test(domain)) return false;
    if (!/^[a-z0-9.-]+$/.test(domain)) return false;
    return true;
}

app.get('/api/blocked-email-domains', requireAdminAuth, async (req, res) => {
    try {
        const r = await pool.query('SELECT domain, created_at FROM blocked_email_domains ORDER BY domain ASC');
        return res.json({ domains: r.rows });
    } catch (e) {
        if (e && e.message && /blocked_email_domains/i.test(e.message)) {
            return res.json({ domains: [], warning: 'Run DB migration for blocked_email_domains' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.post('/api/blocked-email-domains', requireAdminAuth, async (req, res) => {
    const domain = normalizeDomainInput(req.body && req.body.domain);
    if (!isValidDomain(domain)) {
        return res.status(400).json({ error: 'Invalid domain' });
    }
    try {
        await pool.query(
            'INSERT INTO blocked_email_domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING',
            [domain]
        );
        return res.json({ success: true, domain });
    } catch (e) {
        if (e && e.message && /blocked_email_domains/i.test(e.message)) {
            return res.status(500).json({ error: 'Run DB migration for blocked_email_domains' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.delete('/api/blocked-email-domains/:domain', requireAdminAuth, async (req, res) => {
    const domain = normalizeDomainInput(req.params.domain);
    if (!isValidDomain(domain)) {
        return res.status(400).json({ error: 'Invalid domain' });
    }
    try {
        await pool.query('DELETE FROM blocked_email_domains WHERE domain = $1', [domain]);
        return res.json({ success: true, domain });
    } catch (e) {
        if (e && e.message && /blocked_email_domains/i.test(e.message)) {
            return res.status(500).json({ error: 'Run DB migration for blocked_email_domains' });
        }
        return res.status(500).json({ error: e.message });
    }
});

// Admin diagnostic: lookup dashboard user by email (no passwords returned)
app.get('/api/admin/users/by-email', requireAdminAuth, async (req, res) => {
    const rawEmail = req.query && req.query.email;
    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
        return res.status(400).json({ error: 'Email is required' });
    }
    const email = rawEmail.trim().toLowerCase();
    try {
        const result = await pool.query(
            `
            SELECT
              id,
              email,
              COALESCE(locale, 'en') AS locale,
              password_hash IS NOT NULL AS has_password,
              created_at,
              updated_at
            FROM dashboard_users
            WHERE email = $1
            `,
            [email]
        );
        if (result.rows.length === 0) {
            return res.json({ found: false });
        }
        const user = result.rows[0];
        return res.json({
            found: true,
            id: user.id,
            email: user.email,
            locale: user.locale === 'am' ? 'am' : 'en',
            has_password: user.has_password === true,
            created_at: user.created_at || null,
            updated_at: user.updated_at || null,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/usdt/sweep-all', requireAdminAuth, async (req, res) => {
    try {
        const ordersRes = await pool.query(
            `SELECT id, order_id, amount_usdt, deposit_address_id, swept_to_main
             FROM usdt_orders
             WHERE status = 'completed'
               AND deposit_address_id IS NOT NULL
               AND swept_to_main IS NOT TRUE`
        );
        const orders = ordersRes.rows;
        const results = [];
        for (const o of orders) {
            try {
                await sweepOrderToMainWallet(o, o.tx_hash || null);
                results.push({ order_id: o.order_id, status: 'ok' });
            } catch (e) {
                results.push({ order_id: o.order_id, status: 'error', message: e.message || String(e) });
            }
        }
        return res.json({ count: orders.length, results });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// Email attachments upload (admin): images and documents for broadcasts/sequences
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const base = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '-' + base);
    }
});
const uploadMulter = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });
app.post('/api/upload', requireAdminAuth, uploadMulter.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const filename = path.basename(req.file.path);
    const relativePath = 'uploads/' + filename;
    res.json({ url: apiUrl + '/api/uploads/' + encodeURIComponent(filename), path: relativePath, filename: req.file.originalname || filename });
});

// POST /api/payment-issue - User reports "payment didn't go through" (optional auth, multipart: message, order_id, product_type, email?, tx_id?)
const optionalAuthForPaymentIssue = (req, res, next) => {
    req.user = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = { id: decoded.sub, email: decoded.email };
        next();
    } catch {
        next();
    }
};
app.post('/api/payment-issue', optionalAuthForPaymentIssue, uploadMulter.single('screenshot'), async (req, res) => {
    try {
        const message = (req.body && req.body.message) ? String(req.body.message).trim() : '';
        const orderId = (req.body && req.body.order_id) ? String(req.body.order_id).trim() || null : null;
        const productType = (req.body && req.body.product_type) ? String(req.body.product_type).trim() : '';
        const emailBody = (req.body && req.body.email) ? String(req.body.email).trim() || null : null;
        const email = (req.user && req.user.email) || emailBody || null;
        let txId = (req.body && req.body.tx_id) ? String(req.body.tx_id).trim() : null;
        if (txId && txId.length > 128) txId = txId.slice(0, 128);
        if (!txId) txId = null;
        if (!productType || !['course', 'liquidityscan_pro'].includes(productType)) {
            return res.status(400).json({ error: 'product_type must be course or liquidityscan_pro' });
        }
        if (!message || message.length < 10) {
            return res.status(400).json({ error: 'message required (min 10 characters)' });
        }
        const r = await pool.query(
            `INSERT INTO payment_issue_reports (order_id, product_type, email, message, screenshot_url, tx_id)
             VALUES ($1, $2, $3, $4, NULL, $5) RETURNING id, created_at`,
            [orderId, productType, email, message, txId]
        );
        const reportId = r.rows[0].id;
        const createdAt = r.rows[0].created_at;
        const fromAddr = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER;
        const notifyTo = process.env.NOWPAY_NOTIFY_EMAIL || (ADMIN_EMAILS[0] || process.env.SMTP_USER);
        if (transporter && notifyTo) {
            transporter.sendMail({
                from: fromAddr,
                to: notifyTo,
                subject: `Payment issue from user — ${productType}`,
                text: [
                    'A user reported a payment issue.',
                    `Product: ${productType}`,
                    `Order ID: ${orderId || '—'}`,
                    `Email: ${email || '—'}`,
                    txId ? `Transaction ID: ${txId}` : '',
                    '',
                    'Message:',
                    message,
                ].filter(Boolean).join('\n'),
            }).catch((err) => console.warn('[payment-issue] admin email failed:', err.message));
        }
        if (transporter && email && email.includes('@')) {
            transporter.sendMail({
                from: fromAddr,
                to: email,
                subject: 'We received your payment issue report',
                text: [
                    'Hi,',
                    '',
                    "We've received your request regarding a payment that didn't go through. We'll look into it and get back to you shortly.",
                    '',
                    '– SuperEngulfing',
                ].join('\n'),
            }).catch((err) => console.warn('[payment-issue] user email failed:', err.message));
        }
        return res.json({ id: reportId, created_at: createdAt });
    } catch (e) {
        if (e.message && /relation "payment_issue_reports" does not exist/i.test(e.message)) {
            return res.status(503).json({ error: 'Payment issue reports not available. Run migration 031_payment_issue_reports.sql' });
        }
        if (e.message && /column "tx_id" does not exist/i.test(e.message)) {
            return res.status(503).json({ error: 'Run migration 032_payment_issue_tx_id.sql' });
        }
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/liquidityscan-early-users - List LS3MONTHOFF paid users (admin)
app.get('/api/admin/liquidityscan-early-users', requireAdminAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, order_id, email, amount_usdt, tx_hash, created_at, user_id
             FROM usdt_orders
             WHERE product_type = 'liquidityscan_pro' AND status = 'completed'
             ORDER BY created_at DESC`
        );
        return res.json(r.rows.map(row => ({
            id: row.id,
            order_id: row.order_id,
            email: row.email || null,
            amount_usdt: row.amount_usdt != null ? Number(row.amount_usdt) : null,
            tx_hash: row.tx_hash || null,
            created_at: row.created_at ? row.created_at.toISOString() : null,
            user_id: row.user_id,
        })));
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/liquidityscan-early-users - Manually add LS early user (admin)
app.post('/api/admin/liquidityscan-early-users', requireAdminAuth, async (req, res) => {
    try {
        const { email, amount_usdt, note } = req.body || {};
        const emailStr = email ? String(email).trim() : '';
        if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        const amount = amount_usdt != null ? parseFloat(amount_usdt) : 49;
        const orderId = 'manual-' + Date.now();
        const r = await pool.query(
            `INSERT INTO usdt_orders (order_id, product_type, product_id, user_id, email, amount_usdt, status)
             VALUES ($1, 'liquidityscan_pro', NULL, NULL, $2, $3, 'completed')
             RETURNING id, order_id, email, amount_usdt, tx_hash, created_at`,
            [orderId, emailStr, isNaN(amount) ? 49 : amount]
        );
        const row = r.rows[0];
        return res.json({
            id: row.id,
            order_id: row.order_id,
            email: row.email,
            amount_usdt: row.amount_usdt != null ? Number(row.amount_usdt) : null,
            tx_hash: row.tx_hash || null,
            created_at: row.created_at ? row.created_at.toISOString() : null,
        });
    } catch (e) {
        if (e.message && /usdt_orders/i.test(e.message)) return res.status(500).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/course-payments - List paid course enrollments (admin)
app.get('/api/admin/course-payments', requireAdminAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT
                 cp.id,
                 cp.user_id,
                 du.email,
                 cp.course_id,
                 c.title AS course_title,
                 cp.amount_cents,
                 cp.status,
                 cp.payment_id,
                 cp.created_at
             FROM course_payments cp
             LEFT JOIN dashboard_users du ON du.id = cp.user_id
             LEFT JOIN courses c ON c.id = cp.course_id
             ORDER BY cp.created_at DESC
             LIMIT 200`
        );
        return res.json(r.rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            email: row.email || null,
            course_id: row.course_id,
            course_title: row.course_title || 'Course',
            amount_usd: row.amount_cents != null ? Number(row.amount_cents) / 100 : null,
            status: row.status || 'completed',
            payment_id: row.payment_id || null,
            created_at: row.created_at ? row.created_at.toISOString() : null,
        })));
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/payment-issues - List payment issue reports (admin)
app.get('/api/admin/payment-issues', requireAdminAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, order_id, product_type, email, message, screenshot_url, tx_id, status, resolved_at, resolved_by, created_at
             FROM payment_issue_reports ORDER BY created_at DESC LIMIT 200`
        );
        return res.json(r.rows.map(row => ({
            id: row.id,
            order_id: row.order_id,
            product_type: row.product_type,
            email: row.email,
            message: row.message,
            screenshot_url: row.screenshot_url,
            tx_id: row.tx_id || null,
            status: row.status,
            resolved_at: row.resolved_at ? row.resolved_at.toISOString() : null,
            resolved_by: row.resolved_by,
            created_at: row.created_at ? row.created_at.toISOString() : null
        })));
    } catch (e) {
        if (e.message && /relation "payment_issue_reports" does not exist/i.test(e.message)) {
            return res.status(503).json({ error: 'Run migration 031_payment_issue_reports.sql' });
        }
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/payment-issues/:id/resolve - Resolve and optionally grant access (admin)
app.post('/api/admin/payment-issues/:id/resolve', requireAdminAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const { grant_access, course_id } = req.body || {};
    const adminEmail = req.admin && req.admin.email ? req.admin.email : 'admin';
    try {
        const reportRes = await pool.query(
            'SELECT id, order_id, product_type, email, status FROM payment_issue_reports WHERE id = $1',
            [id]
        );
        if (reportRes.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
        const report = reportRes.rows[0];
        if (report.status === 'resolved') return res.json({ ok: true, message: 'Already resolved' });

        if (grant_access === true) {
            let userId = null;
            if (report.order_id) {
                const orderRow = await pool.query(
                    'SELECT user_id, product_id FROM usdt_orders WHERE order_id = $1',
                    [report.order_id]
                );
                if (orderRow.rows.length > 0) {
                    userId = orderRow.rows[0].user_id;
                    const orderProductId = orderRow.rows[0].product_id;
                    if (report.product_type === 'course' && (orderProductId || course_id)) {
                        const cid = course_id || orderProductId;
                        await pool.query(
                            `INSERT INTO course_payments (user_id, course_id, payment_id, status)
                             VALUES ($1, $2, $3, 'completed')
                             ON CONFLICT (user_id, course_id) DO UPDATE SET payment_id = EXCLUDED.payment_id, status = 'completed'`,
                            [userId, cid, 'manual-' + id]
                        );
                        await pool.query(
                            'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
                            [userId, cid]
                        );
                    }
                }
            }
            if (!userId && report.email) {
                const userRow = await pool.query('SELECT id FROM dashboard_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [report.email]);
                if (userRow.rows.length > 0 && report.product_type === 'course' && course_id) {
                    userId = userRow.rows[0].id;
                    await pool.query(
                        `INSERT INTO course_payments (user_id, course_id, payment_id, status)
                         VALUES ($1, $2, $3, 'completed')
                         ON CONFLICT (user_id, course_id) DO UPDATE SET payment_id = EXCLUDED.payment_id, status = 'completed'`,
                        [userId, course_id, 'manual-' + id]
                    );
                    await pool.query(
                        'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
                        [userId, course_id]
                    );
                }
            }
        }

        await pool.query(
            `UPDATE payment_issue_reports SET status = 'resolved', resolved_at = NOW(), resolved_by = $2 WHERE id = $1`,
            [id, adminEmail]
        );

        const { admin_note } = req.body || {};
        const noteEscaped = (admin_note && String(admin_note).trim()) ? String(admin_note).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        if (report.email && report.email.includes('@')) {
            const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
            const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
            let htmlContent = `
                <h1>Your payment issue has been resolved</h1>
                <p>Hello,</p>
                <p>Thank you for contacting us. We've looked into your payment issue and marked it as resolved.</p>
                ${grant_access === true ? '<p><strong>Access has been granted to your account.</strong> You can log in to your dashboard and use your course or product.</p>' : ''}
                ${noteEscaped ? `<p style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 12px 0;">${noteEscaped}</p>` : ''}
                <p>If you have any further questions, reply to this email.</p>
                <p>— The SuperEngulfing Team</p>
            `;
            try {
                await transporter.sendMail({
                    from: fromAddr,
                    to: report.email,
                    replyTo,
                    subject: 'Your payment issue has been resolved – SuperEngulfing',
                    html: wrapEmailTemplate(htmlContent)
                });
                console.log(`📧 Payment issue resolved email sent to ${report.email}`);
            } catch (err) {
                console.error(`❌ Failed to send payment-issue-resolved email to ${report.email}:`, err.message);
            }
        }

        return res.json({ ok: true });
    } catch (e) {
        if (e.message && /relation "payment_issue_reports" does not exist/i.test(e.message)) {
            return res.status(503).json({ error: 'Run migration 031_payment_issue_reports.sql' });
        }
        return res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/payment-issues/:id/reject - Reject payment issue and notify user (admin)
app.post('/api/admin/payment-issues/:id/reject', requireAdminAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const { admin_note } = req.body || {};
    const adminEmail = req.admin && req.admin.email ? req.admin.email : 'admin';
    try {
        const reportRes = await pool.query(
            'SELECT id, order_id, product_type, email, status FROM payment_issue_reports WHERE id = $1',
            [id]
        );
        if (reportRes.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
        const report = reportRes.rows[0];
        if (report.status !== 'pending') return res.status(400).json({ error: 'Report is not pending' });

        await pool.query(
            `UPDATE payment_issue_reports SET status = 'rejected', resolved_at = NOW(), resolved_by = $2 WHERE id = $1`,
            [id, adminEmail]
        );

        if (report.email && report.email.includes('@')) {
            const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
            const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
            const noteEscaped = (admin_note && String(admin_note).trim()) ? String(admin_note).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
            const htmlContent = `
                <h1>Regarding your payment issue</h1>
                <p>Hello,</p>
                <p>Thank you for reaching out. We were unable to verify your payment with the information provided.</p>
                <p>If you have a transaction ID or additional details, please reply to this email or contact us at <a href="mailto:info@superengulfing.com">info@superengulfing.com</a> and we'll look into it.</p>
                ${noteEscaped ? `<p style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 12px 0;">${noteEscaped}</p>` : ''}
                <p>— The SuperEngulfing Team</p>
            `;
            try {
                await transporter.sendMail({
                    from: fromAddr,
                    to: report.email,
                    replyTo,
                    subject: 'Regarding your payment issue – SuperEngulfing',
                    html: wrapEmailTemplate(htmlContent)
                });
                console.log(`📧 Payment issue rejected email sent to ${report.email}`);
            } catch (err) {
                console.error(`❌ Failed to send payment-issue-rejected email to ${report.email}:`, err.message);
            }
        }

        return res.json({ ok: true });
    } catch (e) {
        if (e.message && /relation "payment_issue_reports" does not exist/i.test(e.message)) {
            return res.status(503).json({ error: 'Run migration 031_payment_issue_reports.sql' });
        }
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed, COALESCE(tradingview_username, \'\') AS tradingview_username, COALESCE(indicator_access_status, \'none\') AS indicator_access_status, indicator_requested_at, indicator_rejected_reason, indicator_rejected_at, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const row = result.rows[0];
        return res.json({
            id: row.id,
            email: row.email,
            first_name: row.first_name || '',
            onboarding_completed: row.onboarding_completed === true,
            certificate_section_collapsed: row.certificate_section_collapsed === true,
            tradingview_username: row.tradingview_username || '',
            indicator_access_status: row.indicator_access_status || 'none',
            indicator_requested_at: row.indicator_requested_at ? row.indicator_requested_at.toISOString() : null,
            indicator_rejected_reason: row.indicator_rejected_reason || null,
            indicator_rejected_at: row.indicator_rejected_at ? row.indicator_rejected_at.toISOString() : null,
            locale: row.locale === 'am' ? 'am' : 'en'
        });
    } catch (error) {
        if (error.message && /column "first_name" does not exist/i.test(error.message)) {
            try {
                const result = await pool.query('SELECT id, email, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1', [req.user.id]);
                if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                const row = result.rows[0];
                const localeVal = row.locale === 'am' ? 'am' : 'en';
                return res.json({ id: row.id, email: row.email, first_name: '', onboarding_completed: false, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: localeVal });
            } catch (e2) {
                if (e2.message && /column.*locale.*does not exist/i.test(e2.message)) {
                    const result = await pool.query('SELECT id, email FROM dashboard_users WHERE id = $1', [req.user.id]);
                    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                    const row = result.rows[0];
                    return res.json({ id: row.id, email: row.email, first_name: '', onboarding_completed: false, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: 'en' });
                }
                console.error('[/api/me]', e2);
                return res.status(500).json({ error: e2.message });
            }
        }
        if (error.message && /column "certificate_section_collapsed" does not exist/i.test(error.message)) {
            try {
                const result = await pool.query(
                    'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
                    [req.user.id]
                );
                if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                const row = result.rows[0];
                return res.json({ id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: row.onboarding_completed === true, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: row.locale === 'am' ? 'am' : 'en' });
            } catch (e2) {
                if (e2.message && /column.*locale.*does not exist/i.test(e2.message)) {
                    const result = await pool.query('SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed FROM dashboard_users WHERE id = $1', [req.user.id]);
                    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                    const row = result.rows[0];
                    return res.json({ id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: row.onboarding_completed === true, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: 'en' });
                }
                console.error('[/api/me]', e2);
                return res.status(500).json({ error: e2.message });
            }
        }
        if (error.message && /column "onboarding_completed" does not exist/i.test(error.message)) {
            try {
                const result = await pool.query(
                    'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
                    [req.user.id]
                );
                if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                const row = result.rows[0];
                return res.json({ id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: false, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: row.locale === 'am' ? 'am' : 'en' });
            } catch (e2) {
                if (e2.message && /column.*locale.*does not exist/i.test(e2.message)) {
                    const result = await pool.query('SELECT id, email, COALESCE(first_name, \'\') AS first_name FROM dashboard_users WHERE id = $1', [req.user.id]);
                    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                    const row = result.rows[0];
                    return res.json({ id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: false, certificate_section_collapsed: false, tradingview_username: '', indicator_access_status: 'none', indicator_requested_at: null, locale: 'en' });
                }
                console.error('[/api/me]', e2);
                return res.status(500).json({ error: e2.message });
            }
        }
        if (error.message && (/column "indicator_rejected_reason" does not exist/i.test(error.message) || /column "indicator_rejected_at" does not exist/i.test(error.message))) {
            try {
                const result = await pool.query(
                    'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed, COALESCE(tradingview_username, \'\') AS tradingview_username, COALESCE(indicator_access_status, \'none\') AS indicator_access_status, indicator_requested_at, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
                    [req.user.id]
                );
                if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                const row = result.rows[0];
                return res.json({
                    id: row.id,
                    email: row.email,
                    first_name: row.first_name || '',
                    onboarding_completed: row.onboarding_completed === true,
                    certificate_section_collapsed: row.certificate_section_collapsed === true,
                    tradingview_username: row.tradingview_username || '',
                    indicator_access_status: row.indicator_access_status || 'none',
                    indicator_requested_at: row.indicator_requested_at ? row.indicator_requested_at.toISOString() : null,
                    indicator_rejected_reason: null,
                    indicator_rejected_at: null,
                    locale: row.locale === 'am' ? 'am' : 'en'
                });
            } catch (e2) {
                if (e2.message && /column.*locale.*does not exist/i.test(e2.message)) {
                    const result = await pool.query(
                        'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed, COALESCE(tradingview_username, \'\') AS tradingview_username, COALESCE(indicator_access_status, \'none\') AS indicator_access_status, indicator_requested_at FROM dashboard_users WHERE id = $1',
                        [req.user.id]
                    );
                    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                    const row = result.rows[0];
                    return res.json({
                        id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: row.onboarding_completed === true,
                        certificate_section_collapsed: row.certificate_section_collapsed === true, tradingview_username: row.tradingview_username || '',
                        indicator_access_status: row.indicator_access_status || 'none',
                        indicator_requested_at: row.indicator_requested_at ? row.indicator_requested_at.toISOString() : null,
                        indicator_rejected_reason: null, indicator_rejected_at: null, locale: 'en'
                    });
                }
                console.error('[/api/me]', e2);
                return res.status(500).json({ error: e2.message });
            }
        }
        if (error.message && (/column "indicator_access_status" does not exist/i.test(error.message) || /column "tradingview_username" does not exist/i.test(error.message))) {
            try {
                const result = await pool.query(
                    'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
                    [req.user.id]
                );
                if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                const row = result.rows[0];
                return res.json({
                    id: row.id,
                    email: row.email,
                    first_name: row.first_name || '',
                    onboarding_completed: row.onboarding_completed === true,
                    certificate_section_collapsed: row.certificate_section_collapsed === true,
                    tradingview_username: '',
                    indicator_access_status: 'none',
                    indicator_requested_at: null,
                    indicator_rejected_reason: null,
                    indicator_rejected_at: null,
                    locale: row.locale === 'am' ? 'am' : 'en'
                });
            } catch (e2) {
                if (e2.message && /column.*locale.*does not exist/i.test(e2.message)) {
                    const result = await pool.query(
                        'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed FROM dashboard_users WHERE id = $1',
                        [req.user.id]
                    );
                    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                    const row = result.rows[0];
                    return res.json({
                        id: row.id, email: row.email, first_name: row.first_name || '', onboarding_completed: row.onboarding_completed === true,
                        certificate_section_collapsed: row.certificate_section_collapsed === true, tradingview_username: '', indicator_access_status: 'none',
                        indicator_requested_at: null, indicator_rejected_reason: null, indicator_rejected_at: null, locale: 'en'
                    });
                }
                console.error('[/api/me]', e2);
                return res.status(500).json({ error: e2.message });
            }
        }
        console.error('[/api/me]', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/me', requireAuth, async (req, res) => {
    const { first_name } = req.body;
    try {
        await pool.query(
            'UPDATE dashboard_users SET first_name = $1 WHERE id = $2',
            [first_name != null ? String(first_name).trim() || null : null, req.user.id]
        );
        const result = await pool.query(
            'SELECT id, email, COALESCE(first_name, \'\') AS first_name FROM dashboard_users WHERE id = $1',
            [req.user.id]
        );
        const row = result.rows[0];
        res.json({ id: row.id, email: row.email, first_name: row.first_name || '' });
    } catch (error) {
        if (error.message && /column "first_name" does not exist/i.test(error.message)) {
            return res.status(500).json({ error: 'Run: npm run migrate:profile' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/me/password', requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'current_password and new_password required' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    try {
        const result = await pool.query('SELECT password_hash FROM dashboard_users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        const passwordHash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE dashboard_users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/me/onboarding-complete', requireAuth, async (req, res) => {
    try {
        await pool.query('UPDATE dashboard_users SET onboarding_completed = true WHERE id = $1', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        if (error.message && /column "onboarding_completed" does not exist/i.test(error.message)) {
            return res.status(500).json({ error: 'Run: npm run migrate:onboarding' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/me/certificate-section-collapsed', requireAuth, async (req, res) => {
    const collapsed = req.body && req.body.collapsed === true;
    try {
        await pool.query(
            'UPDATE dashboard_users SET certificate_section_collapsed = $1 WHERE id = $2',
            [collapsed, req.user.id]
        );
        res.json({ success: true, certificate_section_collapsed: collapsed });
    } catch (error) {
        if (error.message && /column "certificate_section_collapsed" does not exist/i.test(error.message)) {
            return res.status(400).json({ error: 'Run migration 013 (certificate_section_collapsed)' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/me/indicator-access-request - Submit TradingView username for indicator access (2h cooldown after reject)
const INDICATOR_REJECT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
app.post('/api/me/indicator-access-request', requireAuth, async (req, res) => {
    const raw = req.body && req.body.tradingview_username;
    const tradingview_username = typeof raw === 'string' ? raw.trim() : '';
    if (!tradingview_username) {
        return res.status(400).json({ error: 'tradingview_username is required' });
    }
    try {
        let allowSubmit = true;
        try {
            const currentRow = await pool.query(
                'SELECT indicator_access_status, indicator_rejected_at FROM dashboard_users WHERE id = $1',
                [req.user.id]
            );
            if (currentRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            const { indicator_access_status: status, indicator_rejected_at: rejectedAt } = currentRow.rows[0];
            if (status === 'rejected' && rejectedAt) {
                const rejectedTime = new Date(rejectedAt).getTime();
                const now = Date.now();
                if (now - rejectedTime < INDICATOR_REJECT_COOLDOWN_MS) {
                    const retryAfterSeconds = Math.ceil((INDICATOR_REJECT_COOLDOWN_MS - (now - rejectedTime)) / 1000);
                    return res.status(429).json({
                        error: 'You can submit again only 2 hours after the last rejection.',
                        retry_after_seconds: retryAfterSeconds
                    });
                }
            }
        } catch (colErr) {
            if (!/column "indicator_rejected_at" does not exist/i.test(colErr.message)) throw colErr;
        }
        await pool.query(
            'UPDATE dashboard_users SET tradingview_username = $1, indicator_access_status = $2, indicator_requested_at = NOW(), indicator_rejected_reason = NULL, indicator_rejected_at = NULL WHERE id = $3',
            [tradingview_username, 'pending', req.user.id]
        );
        const userRow = await pool.query(
            'SELECT email, COALESCE(first_name, \'\') AS first_name, indicator_requested_at, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE id = $1',
            [req.user.id]
        );
        if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const { email, first_name: firstName, indicator_requested_at: requestedAt, locale: userLocale } = userRow.rows[0];
        const locale = userLocale === 'am' ? 'am' : 'en';
        await sendAdminIndicatorAccessRequestNotification(firstName || 'User', email, tradingview_username, requestedAt, locale);

        const profileRow = await pool.query(
            'SELECT id, email, COALESCE(first_name, \'\') AS first_name, COALESCE(onboarding_completed, false) AS onboarding_completed, COALESCE(certificate_section_collapsed, false) AS certificate_section_collapsed, COALESCE(tradingview_username, \'\') AS tradingview_username, COALESCE(indicator_access_status, \'none\') AS indicator_access_status, indicator_requested_at, indicator_rejected_reason, indicator_rejected_at FROM dashboard_users WHERE id = $1',
            [req.user.id]
        );
        const row = profileRow.rows[0];
        res.json({
            success: true,
            id: row.id,
            email: row.email,
            first_name: row.first_name || '',
            onboarding_completed: row.onboarding_completed === true,
            certificate_section_collapsed: row.certificate_section_collapsed === true,
            tradingview_username: row.tradingview_username || '',
            indicator_access_status: row.indicator_access_status || 'none',
            indicator_requested_at: row.indicator_requested_at ? row.indicator_requested_at.toISOString() : null,
            indicator_rejected_reason: row.indicator_rejected_reason || null,
            indicator_rejected_at: row.indicator_rejected_at ? row.indicator_rejected_at.toISOString() : null
        });
    } catch (error) {
        if (error.message && /column "indicator_access_status" does not exist/i.test(error.message)) {
            return res.status(400).json({ error: 'Run migration 014 (indicator access)' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/me/onboarding-reset', requireAuth, async (req, res) => {
    try {
        await pool.query('UPDATE dashboard_users SET onboarding_completed = false WHERE id = $1', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        if (error.message && /column "onboarding_completed" does not exist/i.test(error.message)) {
            return res.status(500).json({ error: 'Run: npm run migrate:onboarding' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Certificate: ultra-premium design (SVG + dark HTML email)
// Server-side certificate strings for PNG/SVG and email (locale from dashboard_users)
const CERT_TRANSLATIONS = {
    en: {
        certTitle: 'O F F I C I A L   D E C L A R A T I O N',
        certIntroPrefix: 'I, ',
        certIntroSuffix: ', hereby declare the following:',
        decl1: 'I am done getting stopped out.',
        decl2: 'I am done watching price move without me.',
        decl3: 'I am done being the exit liquidity.',
        decl4: 'Today, I choose a different path.',
        decl5: 'I will learn to see what Smart Money sees.',
        decl6: 'I will wait for the trap to complete before I strike.',
        decl7: 'I will trade with patience, discipline, and precision.',
        decl8: 'I will follow my rules, not emotions.',
        decl9: 'I will not quit when it gets hard.',
        decl10: 'I will become consistently profitable.',
        decl11: 'This is not a hope. This is a decision.',
        certCommitment: 'THIS IS MY COMMITMENT',
        shareTitle: 'My Official Declaration \u2014 SuperEngulfing',
        shareDescription: 'This is my commitment.',
        shareAlt: 'Certificate of Commitment',
        emailSubject: 'Confidential: Your Official Declaration',
        emailTitle: 'Your Official Declaration',
        emailLedger: 'This declaration is permanently etched and verified on the SuperEngulfing secure ledger.',
        emailFooter: 'SuperEngulfing Elite Protocol. All rights reserved.'
    },
    am: {
        certTitle: 'Պ Ա Շ Տ Ո Ն Ա Կ Ա Ն   Հ Ա Յ Տ Ա Ր Ա Ր ՈՒ Թ Յ ՈՒ Ն',
        certIntroPrefix: 'Ես՝ ',
        certIntroSuffix: '-ս, պաշտոնապես հայտարարում եմ.',
        decl1: 'Բավական է դուրս մնալ խաղից:',
        decl2: 'Բավական է հետևել գնին առանց իմ մասնակցության:',
        decl3: 'Բավական է լինել «սնունդ» (exit liquidity) խոշորների համար:',
        decl4: 'Այսօր ես ընտրում եմ այլ ճանապարհ:',
        decl5: 'Կսովորեմ տեսնել այն, ինչ տեսնում է «Խելացի փողը»:',
        decl6: 'Կսպասեմ թակարդի ավարտին, նախքան գործարք բացելը:',
        decl7: 'Կվարեմ առևտուր համբերությամբ, կարգապահությամբ և ճշգրտությամբ:',
        decl8: 'Կհետևեմ իմ կանոններին, ոչ թե էմոցիաներին:',
        decl9: 'Չեմ հանձնվի, երբ դժվար լինի:',
        decl10: 'Կդառնամ կայուն շահույթով աշխատող թրեյդեր:',
        decl11: 'Սա հույս չէ: Սա որոշում է:',
        certCommitment: 'ՍԱ ԻՄ ՀԱՆՁՆԱՌՈՒԹՅՈՒՆՆ Է',
        shareTitle: 'Սա իմ որոշումն է — SuperEngulfing',
        shareDescription: 'Սա իմ հանձնառությունն է:',
        shareAlt: 'Հանձնառության վկայական',
        emailSubject: 'Գաղտնի. Ձեր Պաշտոնական Հայտարարությունը',
        emailTitle: 'Ձեր Պաշտոնական Հայտարարությունը',
        emailLedger: 'Այս հայտարարությունը հավերժ վավերացված և պահպանված է SuperEngulfing-ի գրանցամատյանում:',
        emailFooter: 'SuperEngulfing Elite Protocol. Բոլոր իրավունքները պաշտպանված են:'
    }
};
function escapeForSvg(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function getCertTr(locale) {
    return CERT_TRANSLATIONS[locale === 'am' ? 'am' : 'en'] || CERT_TRANSLATIONS.en;
}
// Get first_name and locale for certificate; falls back to first_name only + 'en' if locale column missing
async function getCertificateUser(userId) {
    try {
        const r = await pool.query(
            "SELECT COALESCE(first_name, '') AS first_name, COALESCE(locale, 'en') AS locale FROM dashboard_users WHERE id = $1",
            [userId]
        );
        if (r.rows.length === 0) return null;
        const row = r.rows[0];
        return {
            firstName: (row.first_name || '').trim() || 'Trader',
            locale: (row.locale === 'am') ? 'am' : 'en'
        };
    } catch (err) {
        if (err.message && /column.*locale.*does not exist/i.test(err.message)) {
            const r = await pool.query("SELECT COALESCE(first_name, '') AS first_name FROM dashboard_users WHERE id = $1", [userId]);
            if (r.rows.length === 0) return null;
            const row = r.rows[0];
            return { firstName: (row.first_name || '').trim() || 'Trader', locale: 'en' };
        }
        throw err;
    }
}
function buildCertificateSvg(firstName, locale) {
    const tr = getCertTr(locale);
    const name = escapeForSvg(firstName);
    const date = new Date().toLocaleDateString(locale === 'am' ? 'hy-AM' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const e = (s) => escapeForSvg(tr[s] || s);
    const fakeHash = '0x' + crypto.randomBytes(16).toString('hex');
    const certId = 'SE-' + (10000 + Math.floor(Math.random() * 90000));
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="920" viewBox="0 0 680 920">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="35%" r="75%" fx="50%" fy="25%">
      <stop offset="0%" style="stop-color:#141720"/>
      <stop offset="50%" style="stop-color:#06080C"/>
      <stop offset="100%" style="stop-color:#000000"/>
    </radialGradient>
    <linearGradient id="goldMetal" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#996515"/>
      <stop offset="25%" style="stop-color:#D4AF37"/>
      <stop offset="50%" style="stop-color:#FFF8DC"/>
      <stop offset="75%" style="stop-color:#D4AF37"/>
      <stop offset="100%" style="stop-color:#8B6508"/>
    </linearGradient>
    <linearGradient id="goldDark" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgba(212,175,55,0.0)"/>
      <stop offset="50%" style="stop-color:rgba(212,175,55,0.6)"/>
      <stop offset="100%" style="stop-color:rgba(212,175,55,0.0)"/>
    </linearGradient>
    <pattern id="guilloche" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
      <path d="M 0 50 Q 25 25 50 50 T 100 50" fill="none" stroke="rgba(212,175,55,0.02)" stroke-width="0.5"/>
    </pattern>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="680" height="920" fill="url(#bgGlow)"/>
  <rect width="680" height="920" fill="url(#guilloche)"/>
  <g opacity="0.02" transform="translate(340, 520) scale(4)">
    <circle cx="0" cy="0" r="40" fill="none" stroke="#fff" stroke-width="2"/>
    <text x="0" y="8" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#fff">SE</text>
  </g>
  <rect x="24" y="24" width="632" height="872" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
  <rect x="28" y="28" width="624" height="864" fill="none" stroke="url(#goldMetal)" stroke-width="2"/>
  <rect x="36" y="36" width="608" height="848" fill="none" stroke="rgba(212,175,55,0.4)" stroke-width="1"/>
  <path d="M 28 50 L 50 50 L 50 28 M 36 50 L 36 36 L 50 36" fill="none" stroke="url(#goldMetal)" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="2" fill="url(#goldMetal)"/>
  <path d="M 652 50 L 630 50 L 630 28 M 644 50 L 644 36 L 630 36" fill="none" stroke="url(#goldMetal)" stroke-width="1.5"/>
  <circle cx="630" cy="50" r="2" fill="url(#goldMetal)"/>
  <path d="M 28 870 L 50 870 L 50 892 M 36 870 L 36 884 L 50 884" fill="none" stroke="url(#goldMetal)" stroke-width="1.5"/>
  <circle cx="50" cy="870" r="2" fill="url(#goldMetal)"/>
  <path d="M 652 870 L 630 870 L 630 892 M 644 870 L 644 884 L 630 884" fill="none" stroke="url(#goldMetal)" stroke-width="1.5"/>
  <circle cx="630" cy="870" r="2" fill="url(#goldMetal)"/>
  <text x="340" y="115" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Palatino, serif" font-size="16" fill="url(#goldMetal)" font-weight="bold" letter-spacing="0.3em">${e('certTitle')}</text>
  <path d="M 240 145 L 340 150 L 440 145" fill="none" stroke="url(#goldDark)" stroke-width="1.5"/>
  <circle cx="340" cy="150" r="3" fill="url(#goldMetal)"/>
  <text x="340" y="210" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#A0AEC0" font-style="italic">${e('certIntroPrefix')}</text>
  <text x="340" y="250" text-anchor="middle" font-family="Palatino Linotype, Palatino, serif" font-size="28" fill="#FFF8DC" font-weight="bold" letter-spacing="0.05em">${name}</text>
  <line x1="200" y1="265" x2="480" y2="265" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
  <text x="340" y="295" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#A0AEC0" font-style="italic">${e('certIntroSuffix')}</text>
  <g font-family="Georgia, serif" font-size="14.5" text-anchor="middle" fill="#CBD5E1">
    <text x="340" y="350">${e('decl1')}</text>
    <text x="340" y="380">${e('decl2')}</text>
    <text x="340" y="410">${e('decl3')}</text>
    <rect x="180" y="435" width="320" height="34" fill="rgba(212,175,55,0.05)" rx="4"/>
    <text x="340" y="458" fill="url(#goldMetal)" font-size="16" font-weight="bold" font-style="italic" filter="url(#goldGlow)">${e('decl4')}</text>
    <text x="340" y="505">${e('decl5')}</text>
    <text x="340" y="535">${e('decl6')}</text>
    <text x="340" y="565">${e('decl7')}</text>
    <text x="340" y="595">${e('decl8')}</text>
    <text x="340" y="625">${e('decl9')}</text>
    <text x="340" y="655">${e('decl10')}</text>
    <text x="340" y="710" fill="#FFFFFF" font-size="17" font-weight="bold" letter-spacing="0.05em">${e('decl11')}</text>
  </g>
  <line x1="240" y1="750" x2="440" y2="750" stroke="url(#goldDark)" stroke-width="1"/>
  <text x="340" y="775" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="12" fill="url(#goldMetal)" letter-spacing="0.4em" font-weight="bold">${e('certCommitment')}</text>
  <g transform="translate(340, 835)">
    <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldMetal)" stroke-width="3" stroke-dasharray="4 3"/>
    <circle cx="0" cy="0" r="37" fill="#050505" stroke="url(#goldMetal)" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="31" fill="none" stroke="rgba(212,175,55,0.5)" stroke-width="1"/>
    <circle cx="0" cy="0" r="26" fill="none" stroke="url(#goldMetal)" stroke-width="0.5" stroke-dasharray="2 2"/>
    <text x="0" y="-12" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="url(#goldMetal)" letter-spacing="0.2em">VERIFIED</text>
    <text x="0" y="8" text-anchor="middle" font-family="Times New Roman, serif" font-size="22" fill="url(#goldMetal)" font-weight="bold">SE</text>
    <text x="0" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="5" fill="url(#goldMetal)" letter-spacing="0.2em">LEDGER</text>
  </g>
  <text x="140" y="820" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#E2E8F0">${escapeForSvg(date)}</text>
  <line x1="80" y1="830" x2="200" y2="830" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="140" y="865" text-anchor="middle" font-family="Courier New, monospace" font-size="9" fill="rgba(212,175,55,0.8)">${escapeForSvg(certId)}</text>
  <path d="M 480 820 Q 500 800 510 815 T 530 810 Q 545 805 550 825 T 580 815" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="480" y1="830" x2="600" y2="830" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="540" y="865" text-anchor="middle" font-family="Courier New, monospace" font-size="7" fill="#4A5568" letter-spacing="0.05em">${escapeForSvg(fakeHash.substring(0, 20))}...</text>
</svg>`;
}

app.get('/api/me/certificate', requireAuth, async (req, res) => {
    try {
        const user = await getCertificateUser(req.user.id);
        if (!user) return res.status(404).end();
        const svg = buildCertificateSvg(user.firstName, user.locale);
        const png = await sharp(Buffer.from(svg, 'utf8')).png({ compressionLevel: 6 }).toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(png);
    } catch (err) {
        console.warn('[/api/me/certificate]', err.message);
        res.status(500).json({ error: err.message });
    }
});

function getBaseUrl(req) {
    const envUrl = process.env.PUBLIC_URL || process.env.BASE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    return host ? `${proto}://${host}` : 'http://localhost:3001';
}

app.get('/api/me/certificate-share-url', requireAuth, (req, res) => {
    try {
        const token = jwt.sign(
            { sub: req.user.id, purpose: 'cert-share' },
            jwtSecret,
            { expiresIn: '7d' }
        );
        const baseUrl = getBaseUrl(req);
        const shareUrl = `${baseUrl}/share/c/${token}`;
        res.json({ shareUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/certificate-image/:token', async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, jwtSecret);
        if (decoded.purpose !== 'cert-share' || !decoded.sub) return res.status(404).end();
        const user = await getCertificateUser(decoded.sub);
        if (!user) return res.status(404).end();
        const svg = buildCertificateSvg(user.firstName, user.locale);
        const png = await sharp(Buffer.from(svg, 'utf8')).png({ compressionLevel: 6 }).toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(png);
    } catch (err) {
        res.status(404).end();
    }
});

app.get('/share/c/:token', async (req, res) => {
    const token = req.params.token;
    let locale = 'en';
    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.purpose === 'cert-share' && decoded.sub) {
            try {
                const userResult = await pool.query(
                    "SELECT COALESCE(locale, 'en') AS locale FROM dashboard_users WHERE id = $1",
                    [decoded.sub]
                );
                if (userResult.rows.length > 0 && userResult.rows[0].locale === 'am') locale = 'am';
            } catch (_) { /* locale column may not exist */ }
        }
    } catch (_) { /* invalid token, use en */ }
    const tr = getCertTr(locale);
    const baseUrl = getBaseUrl(req);
    const imageUrl = `${baseUrl}/api/certificate-image/${token}`;
    const title = tr.shareTitle || CERT_TRANSLATIONS.en.shareTitle;
    const description = tr.shareDescription || CERT_TRANSLATIONS.en.shareDescription;
    const certTitle = tr.certTitle || CERT_TRANSLATIONS.en.certTitle;
    const shareAlt = tr.shareAlt || CERT_TRANSLATIONS.en.shareAlt;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html>
<html lang="${locale === 'am' ? 'hy' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="640">
  <meta property="og:image:height" content="880">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:image" content="${imageUrl}">
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #f8fafc; color: #0f172a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 420px; width: 100%; text-align: center; }
    h1 { font-size: 1.1rem; letter-spacing: 0.12em; color: #b45309; margin-bottom: 6px; font-weight: 400; }
    .brand { color: #059669; font-size: 0.95rem; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    p { color: #64748b; font-size: 0.8rem; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${esc(certTitle)}</h1>
    <p class="brand">SuperEngulfing</p>
    <img src="${imageUrl}" alt="${esc(shareAlt)}" width="600" height="400" />
    <p>${esc(description)}</p>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

app.post('/api/me/send-certificate', requireAuth, async (req, res) => {
    try {
        // Idempotency: if onboarding already completed, do not send certificate again (e.g. after F5 + clicking Done again)
        let alreadyCompleted = false;
        try {
            const completedResult = await pool.query(
                'SELECT onboarding_completed FROM dashboard_users WHERE id = $1',
                [req.user.id]
            );
            if (completedResult.rows.length > 0 && completedResult.rows[0].onboarding_completed === true) {
                alreadyCompleted = true;
            }
        } catch (e) {
            if (e.message && /column "onboarding_completed" does not exist/i.test(e.message)) {
                // migration not run yet, proceed as before
            } else throw e;
        }
        if (alreadyCompleted) {
            return res.json({ success: true });
        }

        let email, firstName, locale;
        try {
            const userResult = await pool.query(
                "SELECT email, COALESCE(first_name, '') AS first_name, COALESCE(locale, 'en') AS locale FROM dashboard_users WHERE id = $1",
                [req.user.id]
            );
            if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            email = userResult.rows[0].email;
            firstName = (userResult.rows[0].first_name || '').trim() || 'Trader';
            locale = (userResult.rows[0].locale === 'am') ? 'am' : 'en';
        } catch (qerr) {
            if (qerr.message && /column.*locale.*does not exist/i.test(qerr.message)) {
                const userResult = await pool.query(
                    "SELECT email, COALESCE(first_name, '') AS first_name FROM dashboard_users WHERE id = $1",
                    [req.user.id]
                );
                if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
                email = userResult.rows[0].email;
                firstName = (userResult.rows[0].first_name || '').trim() || 'Trader';
                locale = 'en';
            } else throw qerr;
        }
        const tr = getCertTr(locale);

        // PNG for email: backend-generated design (same content, layout for mail)
        let certificatePngBuffer = null;
        try {
            const svg = buildCertificateSvg(firstName, locale);
            certificatePngBuffer = await sharp(Buffer.from(svg, 'utf8'))
                .png({ compressionLevel: 6 })
                .toBuffer();
        } catch (err) {
            console.warn('[Email] Certificate PNG generation failed:', err.message);
        }

        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const certId = 'SE-' + (10000 + Math.floor(Math.random() * 90000));
        const emailDate = new Date().toLocaleDateString(locale === 'am' ? 'hy-AM' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        // Certificate email — ultra-premium dark theme
        const certificateHtml = `<!DOCTYPE html>
<html lang="${locale === 'am' ? 'hy' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(tr.emailTitle)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #030303; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #030303; padding: 50px 0; }
    .main { max-width: 600px; margin: 0 auto; background: #0A0A0A; background-image: linear-gradient(180deg, #111 0%, #050505 100%); border-radius: 4px; border: 1px solid #222; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.05); }
    .top-accent { height: 3px; background: linear-gradient(90deg, #996515, #FFF8DC, #996515); width: 100%; }
    .header { text-align: center; padding: 45px 30px 25px; border-bottom: 1px solid #1a1a1a; }
    .confidential { color: #666; font-family: -apple-system, sans-serif; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 20px; }
    .logo { color: #D4AF37; font-family: Palatino Linotype, Book Antiqua, Palatino, serif; font-size: 26px; font-weight: bold; letter-spacing: 0.15em; margin: 0; }
    .content { padding: 40px 45px; text-align: center; }
    h1 { font-family: Palatino Linotype, serif; color: #E2E8F0; font-size: 16px; font-weight: 400; letter-spacing: 0.25em; margin: 0 0 30px 0; text-transform: uppercase; }
    .intro { font-family: Georgia, serif; font-size: 17px; color: #A0AEC0; margin: 0 0 35px 0; font-style: italic; }
    .name { color: #FFF8DC; font-weight: bold; font-size: 22px; font-style: normal; display: block; margin-top: 10px; letter-spacing: 0.05em; font-family: Palatino Linotype, serif; }
    .decl-list { margin: 0; padding: 0; font-family: Georgia, serif; }
    .decl-item { color: #8892B0; font-size: 15px; line-height: 2.4; margin: 0; }
    .decl-highlight-box { background: rgba(212,175,55,0.03); border-top: 1px solid rgba(212,175,55,0.2); border-bottom: 1px solid rgba(212,175,55,0.2); padding: 20px 10px; margin: 25px 0; }
    .decl-highlight { color: #D4AF37; font-size: 18px; font-weight: bold; font-style: italic; margin: 0; }
    .decl-final { color: #FFFFFF; font-size: 19px; font-weight: bold; margin-top: 40px; letter-spacing: 0.05em; }
    .commitment-line { font-family: Palatino Linotype, serif; color: #D4AF37; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; margin: 40px 0 0 0; font-weight: bold; }
    .footer { background: #050505; padding: 40px; text-align: center; border-top: 1px solid #1a1a1a; }
    .seal-container { position: relative; width: 60px; height: 60px; margin: 0 auto 20px; }
    .seal-outer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 2px dashed #D4AF37; border-radius: 50%; opacity: 0.5; }
    .seal-inner { position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border: 1px solid #D4AF37; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #D4AF37; font-family: Palatino Linotype, serif; font-size: 20px; font-weight: bold; background: #000; }
    .ledger-box { border: 1px solid #222; background: #0A0A0A; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
    .ledger-text { color: #A0AEC0; font-family: -apple-system, sans-serif; font-size: 11px; line-height: 1.6; margin: 0; }
    .meta-data { color: #666; font-family: Courier New, monospace; font-size: 10px; margin-top: 8px; }
    .copyright { color: #444; font-family: -apple-system, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="top-accent"></div>
      <div class="header">
        <div class="confidential">Strictly Confidential</div>
        <p class="logo">SUPERENGULFING</p>
      </div>
      <div class="content">
        <h1>${esc(tr.certTitle)}</h1>
        <p class="intro">${esc(tr.certIntroPrefix)}<span class="name">${esc(firstName)}</span>${esc(tr.certIntroSuffix)}</p>
        <div class="decl-list">
          <p class="decl-item">${esc(tr.decl1)}</p>
          <p class="decl-item">${esc(tr.decl2)}</p>
          <p class="decl-item">${esc(tr.decl3)}</p>
          <div class="decl-highlight-box"><p class="decl-highlight">${esc(tr.decl4)}</p></div>
          <p class="decl-item">${esc(tr.decl5)}</p>
          <p class="decl-item">${esc(tr.decl6)}</p>
          <p class="decl-item">${esc(tr.decl7)}</p>
          <p class="decl-item">${esc(tr.decl8)}</p>
          <p class="decl-item">${esc(tr.decl9)}</p>
          <p class="decl-item">${esc(tr.decl10)}</p>
          <p class="decl-final">${esc(tr.decl11)}</p>
        </div>
        <p class="commitment-line">${esc(tr.certCommitment)}</p>
      </div>
      <div class="footer">
        <div class="seal-container">
          <div class="seal-outer"></div>
          <div class="seal-inner">SE</div>
        </div>
        <div class="ledger-box">
          <p class="ledger-text">${esc(tr.emailLedger)}</p>
          <div class="meta-data">ID: ${esc(certId)} &nbsp;|&nbsp; DATE: ${esc(emailDate)}</div>
        </div>
        <p class="copyright">&copy; ${new Date().getFullYear()} ${esc(tr.emailFooter)}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';

        console.log(`[Email] Sending certificate to ${email} (locale: ${locale})${certificatePngBuffer ? ' (with PNG attachment)' : ''}`);

        const mailOptions = {
            from: fromAddr,
            to: email,
            subject: tr.emailSubject,
            html: certificateHtml
        };
        if (certificatePngBuffer) {
            mailOptions.attachments = [
                { filename: 'certificate.png', content: certificatePngBuffer }
            ];
        }
        await transporter.sendMail(mailOptions);

        await pool.query('UPDATE dashboard_users SET onboarding_completed = true WHERE id = $1', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        if (error.message && /column "onboarding_completed" does not exist/i.test(error.message)) {
            return res.status(500).json({ error: 'Run: npm run migrate:onboarding' });
        }
        console.error('[/api/me/send-certificate] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'superengulfing_email',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Hrant1996...'
});

// ==================== INTERNAL METRICS HELPERS (SERVER / DB / USERS) ====================
function getSystemMetrics() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg ? os.loadavg()[0] || 0 : 0;
    return {
        uptimeSeconds: Math.floor(process.uptime()),
        cpuLoad1m: Number(load.toFixed(2)),
        totalMemBytes: totalMem,
        freeMemBytes: freeMem,
        processRssBytes: mem.rss,
        processHeapUsedBytes: mem.heapUsed
    };
}

let lastDbMetrics = null;
let lastDbMetricsFetchedAt = 0;
const DB_METRICS_TTL_MS = 5 * 1000;

async function getDbMetrics() {
    const now = Date.now();
    if (lastDbMetrics && now - lastDbMetricsFetchedAt < DB_METRICS_TTL_MS) {
        return lastDbMetrics;
    }
    try {
        const q = await pool.query(
            "SELECT count(*) FILTER (WHERE state = 'active') AS active, count(*) AS total FROM pg_stat_activity"
        );
        const row = q.rows[0] || {};
        lastDbMetrics = {
            activeConnections: parseInt(row.active, 10) || 0,
            totalConnections: parseInt(row.total, 10) || 0
        };
        lastDbMetricsFetchedAt = now;
        return lastDbMetrics;
    } catch (e) {
        console.error('[/api/admin/metrics] DB metrics error:', e.message || e);
        lastDbMetrics = {
            activeConnections: null,
            totalConnections: null
        };
        lastDbMetricsFetchedAt = now;
        return lastDbMetrics;
    }
}

const metricsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

app.get('/api/admin/metrics', requireAdminAuth, metricsLimiter, async (req, res) => {
    try {
        const [db, users, traffic, visitors] = await Promise.all([
            getDbMetrics(),
            Promise.resolve(getActiveUsersCounts()),
            Promise.resolve(getTrafficMetrics()),
            Promise.resolve(getOnlineVisitorsCounts())
        ]);
        const serverMetrics = getSystemMetrics();
        return res.json({
            server: serverMetrics,
            db,
            users,
            traffic,
            visitors
        });
    } catch (e) {
        console.error('[/api/admin/metrics] error:', e);
        return res.status(500).json({ error: 'Failed to load metrics' });
    }
});

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ==================== NOWPAYMENTS IPN WEBHOOK (LS3MONTHOFF) ====================
// Verify HMAC signature from NOWPayments using IPN secret key
function verifyNowPaymentsSignature(req) {
    const secret = (process.env.NOWPAY_IPN_SECRET || '').trim();
    if (!secret) return false;
    const headerSig = (req.headers['x-nowpayments-sig'] || req.headers['x-nowpayments-signature'] || '').toString().trim();
    if (!headerSig) return false;
    const payload = JSON.stringify(req.body || {});
    const computed = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    if (computed.length !== headerSig.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(headerSig, 'hex'));
    } catch {
        return false;
    }
}

// IPN endpoint: NOWPayments will POST here on payment status changes
app.post('/api/nowpayments-ipn', async (req, res) => {
    // Basic logging for diagnostics (no secrets)
    const safeLog = {
        payment_id: req.body && req.body.payment_id,
        order_id: req.body && req.body.order_id,
        payment_status: req.body && req.body.payment_status,
        pay_currency: req.body && req.body.pay_currency,
        pay_amount: req.body && req.body.pay_amount,
    };
    console.log('[nowpayments-ipn] incoming', safeLog);

    if (!verifyNowPaymentsSignature(req)) {
        console.warn('[nowpayments-ipn] invalid signature, ignoring');
        return res.status(401).json({ ok: false });
    }

    const status = (req.body && req.body.payment_status) || '';
    const orderId = (req.body && req.body.order_id) || '';
    const paymentId = (req.body && req.body.payment_id) || '';
    const priceAmount = req.body && req.body.price_amount;
    const priceCurrency = req.body && req.body.price_currency;
    const payAmount = req.body && req.body.pay_amount;
    const payCurrency = req.body && req.body.pay_currency;
    const customerEmail = (req.body && (req.body.customer_email || req.body.order_description)) || '';

    const notifyTo = process.env.NOWPAY_NOTIFY_EMAIL || (ADMIN_EMAILS[0] || process.env.SMTP_USER);
    const fromAddr = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER;

    // ——— Paid course: order_id format COURSE_<courseId>_USER_<userId> ———
    const courseOrderMatch = orderId.match(/^COURSE_(\d+)_USER_(\d+)$/);
    if (status === 'finished' && courseOrderMatch) {
        const courseId = parseInt(courseOrderMatch[1], 10);
        const userId = parseInt(courseOrderMatch[2], 10);
        try {
            const courseResult = await pool.query(
                'SELECT id, title, is_paid FROM courses WHERE id = $1',
                [courseId]
            );
            if (courseResult.rows.length > 0 && courseResult.rows[0].is_paid) {
                const course = courseResult.rows[0];
                const amountCents = payAmount != null ? Math.round(Number(payAmount) * 100) : null;
                await pool.query(
                    `INSERT INTO course_payments (user_id, course_id, amount_cents, payment_id, status)
                     VALUES ($1, $2, $3, $4, 'completed')
                     ON CONFLICT (user_id, course_id) DO UPDATE SET amount_cents = COALESCE(EXCLUDED.amount_cents, course_payments.amount_cents), payment_id = EXCLUDED.payment_id, status = 'completed'`,
                    [userId, courseId, amountCents, (paymentId && String(paymentId).trim()) || null]
                );
                await pool.query(
                    'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
                    [userId, courseId]
                );
                const userRow = await pool.query('SELECT email, locale FROM dashboard_users WHERE id = $1', [userId]);
                const userEmail = userRow.rows[0] && userRow.rows[0].email;
                const userLocale = userRow.rows[0] && (userRow.rows[0].locale === 'am' ? 'am' : 'en');
                const courseTitle = course.title || 'Course';
                if (userEmail) {
                    await transporter.sendMail({
                        from: fromAddr,
                        to: userEmail,
                        subject: `Your course access is ready: ${courseTitle}`,
                        text: [
                            'Hey,',
                            '',
                            `Thank you for your payment — your access to "${courseTitle}" is now unlocked.`,
                            '',
                            'You can start right away:',
                            '- Log in to your SuperEngulfing dashboard',
                            '- Open the Academy and select your course',
                            '',
                            'If you do not see the course within a few minutes, reply to this email and we will fix it manually.',
                            '',
                            'See you inside,',
                            'Hayk',
                            'SuperEngulfing',
                        ].join('\n'),
                    }).catch((err) => console.warn('[nowpayments-ipn] course user email failed:', err.message));

                    // Auto-transition: ACCESS -> COURSES sequences
                    try {
                        const sub = await ensureSubscriberForEmail(userEmail, userLocale || 'en');
                        await stopSequencesByKind(sub.id, 'access');
                        await addToSequenceByKind(sub.id, sub.locale, 'course');
                    } catch (seqErr) {
                        console.error('[nowpayments-ipn] course sequence update failed:', seqErr && seqErr.message);
                    }
                }
                if (notifyTo) {
                    await transporter.sendMail({
                        from: fromAddr,
                        to: notifyTo,
                        subject: `Course payment (IPN): ${userEmail || userId} enrolled in "${courseTitle}"`,
                        text: `NOWPayments IPN: User ${userEmail || userId} (id ${userId}) paid and was auto-enrolled in course "${courseTitle}" (id ${courseId}). Payment ID: ${paymentId}`,
                    }).catch((err) => console.warn('[nowpayments-ipn] course admin email failed:', err.message));
                }
                console.log('[nowpayments-ipn] course auto-enrolled', { courseId, userId, orderId });
            }
        } catch (courseErr) {
            console.error('[nowpayments-ipn] course enrollment error:', courseErr && courseErr.message);
            if (notifyTo) {
                await transporter.sendMail({
                    from: fromAddr,
                    to: notifyTo,
                    subject: 'NOWPayments IPN: course enrollment failed',
                    text: `order_id=${orderId} courseId=${courseOrderMatch[1]} userId=${courseOrderMatch[2]}\n\n${courseErr && courseErr.message}`,
                }).catch(() => {});
            }
        }
        return res.json({ ok: true });
    }

    // ——— LS3MONTHOFF (and other non-course orders): admin + optional user email ———
    if (!notifyTo) {
        console.warn('[nowpayments-ipn] NOWPAY_NOTIFY_EMAIL / ADMIN_EMAILS / SMTP_USER not set, skipping email notification');
    }

    try {
        if (notifyTo) {
            const subjectBase = status === 'finished'
                ? '✅ NOWPayments: payment finished'
                : `ℹ️ NOWPayments: status = ${status || 'unknown'}`;

            const textLines = [
                `NOWPayments IPN received for LS3MONTHOFF.`,
                ``,
                `Status: ${status}`,
                `Order ID: ${orderId}`,
                `Payment ID: ${paymentId}`,
                ``,
                `Price: ${priceAmount} ${priceCurrency}`,
                `Paid: ${payAmount} ${payCurrency}`,
                customerEmail ? `Customer email / note: ${customerEmail}` : '',
                ``,
                `Raw payload:`,
                JSON.stringify(safeLog, null, 2),
            ].filter(Boolean);

            await transporter.sendMail({
                from: fromAddr,
                to: notifyTo,
                subject: subjectBase,
                text: textLines.join('\n'),
            });

            const cleanedCustomerEmail = (customerEmail || '').toString().trim();
            if (status === 'finished' && cleanedCustomerEmail && cleanedCustomerEmail.includes('@')) {
                await transporter.sendMail({
                    from: fromAddr,
                    to: cleanedCustomerEmail,
                    subject: 'Your LiquidityScan early access is locked in',
                    text: [
                        'Hey,',
                        '',
                        'You just locked in early access to LiquidityScan Premium.',
                        '',
                        'Deal: 3 months for $49.',
                        '',
                        "Here's what happens next:",
                        '',
                        '1. YOUR SPOT IS RESERVED',
                        '   You are on the early access list. No extra steps required.',
                        '',
                        '2. PLATFORM LAUNCH',
                        '   We are in final development. You will get a launch email with your login details.',
                        '',
                        '3. YOUR 3 MONTHS START',
                        '   Your 3‑month Premium period starts the day you receive access, not today.',
                        '',
                        'While you wait:',
                        '→ Keep practicing SuperEngulfing manually',
                        '→ Use the indicator and refine your entries',
                        '',
                        "When LiquidityScan goes live, you'll have both the skill and the tool.",
                        '',
                        'Payment details:',
                        `Payment ID: ${paymentId}`,
                        `Order ID: ${orderId}`,
                        `Amount: ${payAmount} ${payCurrency}`,
                        '',
                        'Talk soon,',
                        'Hayk',
                        'SuperEngulfing',
                        '',
                        'P.S. Questions? Just reply to this email — I read everything.',
                    ].join('\n'),
                });

                // Auto-add to LiquidityScan sequence (does not stop other sequences)
                try {
                    const sub = await ensureSubscriberForEmail(cleanedCustomerEmail, 'en');
                    await addToSequenceByKind(sub.id, sub.locale, 'liqscan');
                } catch (seqErr) {
                    console.error('[nowpayments-ipn] liqscan sequence update failed:', seqErr && seqErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[nowpayments-ipn] email notify error:', err && err.message);
    }

    return res.json({ ok: true });
});

// ==================== ADMIN TWO-STEP AUTH (TOTP / Google Authenticator) ====================
// POST /api/admin-auth/request-code — password is one of the admin emails; return setupRequired + otpauthUrl if first time
app.post('/api/admin-auth/request-code', async (req, res) => {
    const password = (req.body && req.body.password) ? String(req.body.password).trim().toLowerCase() : '';
    if (!password || !ADMIN_EMAILS.includes(password)) {
        return res.status(401).json({ success: false, error: 'Invalid secret password' });
    }
    const email = password;
    const mask = email.replace(/(.).*(@.*)/, '$1***$2');
    try {
        const existing = await pool.query('SELECT secret, confirmed FROM admin_2fa_secrets WHERE email = $1', [email]);
        if (existing.rows.length > 0 && existing.rows[0].confirmed) {
            const base32 = existing.rows[0].secret;
            const otpauthUrl = `otpauth://totp/SuperEngulfing%20Admin:${encodeURIComponent(email)}?secret=${base32}&issuer=SuperEngulfing`;
            return res.json({ success: true, emailMasked: mask, setupRequired: false, otpauthUrl });
        }
        const secret = speakeasy.generateSecret({ name: `SuperEngulfing Admin (${email})`, issuer: 'SuperEngulfing', length: 20 });
        await pool.query(
            'INSERT INTO admin_2fa_secrets (email, secret, confirmed) VALUES ($1, $2, FALSE) ON CONFLICT (email) DO UPDATE SET secret = $2, confirmed = FALSE, created_at = NOW()',
            [email, secret.base32]
        );
        const otpauthUrl = secret.otpauth_url || `otpauth://totp/SuperEngulfing%20Admin:${encodeURIComponent(email)}?secret=${secret.base32}&issuer=SuperEngulfing`;
        return res.json({ success: true, emailMasked: mask, setupRequired: true, otpauthUrl });
    } catch (err) {
        console.error('Admin request-code error:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to prepare 2FA' });
    }
});

// POST /api/admin-auth/verify — verify TOTP code and optionally issue "remember me" JWT
const REMEMBER_DURATIONS = { '1h': 3600, '3h': 10800, '12h': 43200, '1d': 86400, '2d': 172800, '1w': 604800 };
app.post('/api/admin-auth/verify', async (req, res) => {
    const email = (req.body && req.body.email) ? String(req.body.email).trim().toLowerCase() : '';
    const code = (req.body && req.body.code) ? String(req.body.code).trim().replace(/\s/g, '') : '';
    const rememberMe = !!(req.body && req.body.rememberMe);
    const rememberDuration = (req.body && req.body.rememberDuration) ? String(req.body.rememberDuration) : '1h';
    if (!email || !code || !ADMIN_EMAILS.includes(email)) {
        return res.status(401).json({ success: false, error: 'Invalid email or code' });
    }
    try {
        const row = await pool.query('SELECT secret FROM admin_2fa_secrets WHERE email = $1', [email]);
        if (row.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Set up 2FA first' });
        }
        const valid = speakeasy.totp.verify({
            secret: row.rows[0].secret,
            encoding: 'base32',
            token: code,
            window: 2
        });
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid or expired code' });
        }
        await pool.query('UPDATE admin_2fa_secrets SET confirmed = TRUE WHERE email = $1', [email]);
        const seconds = REMEMBER_DURATIONS[rememberDuration] || REMEMBER_DURATIONS['1h'];
        const expSeconds = Math.floor(Date.now() / 1000) + (rememberMe ? seconds : 3600);
        const token = jwt.sign(
            { type: 'admin', email },
            adminJwtSecret,
            { expiresIn: expSeconds - Math.floor(Date.now() / 1000) }
        );
        const expiresAt = new Date(expSeconds * 1000).toISOString();
        return res.json({ success: true, token, expiresAt });
    } catch (err) {
        console.error('Admin verify error:', err.message);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

// ==================== SUBSCRIBERS ====================

// GET /api/subscribers - List all subscribers, optional ?locale=am|en
app.get('/api/subscribers', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE s.locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    const runQuery = async () => {
        return pool.query(`
      SELECT s.*, 
        COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) 
        FILTER (WHERE t.id IS NOT NULL), '[]') as tags
      FROM subscribers s
      LEFT JOIN subscriber_tags st ON s.id = st.subscriber_id
      LEFT JOIN tags t ON st.tag_id = t.id
      ${localeFilter}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, params);
    };
    try {
        let result = await runQuery();
        res.json({ total: result.rows.length, subscribers: result.rows });
    } catch (error) {
        if (error.message && /column.*locale.*does not exist/i.test(error.message)) {
            try {
                await pool.query("ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en'");
                await pool.query('CREATE INDEX IF NOT EXISTS idx_subscribers_locale ON subscribers(locale)');
                const retry = await runQuery();
                return res.json({ total: retry.rows.length, subscribers: retry.rows });
            } catch (e2) {
                return res.status(500).json({ error: e2.message });
            }
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribe - Add new subscriber with double opt-in
app.post('/api/subscribe', async (req, res) => {
    const { email, source, first_name, locale: reqLocale } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    const locale = (reqLocale === 'am' ? 'am' : 'en');
    const emailNorm = String(email).toLowerCase().trim();

    try {
        // Block disposable / temp mail domains
        if (await isBlockedEmail(emailNorm)) {
            const domain = normalizeEmailDomain(emailNorm);
            console.log(`[blocked-email] subscribe domain=${domain || emailNorm}`);
            return res.status(400).json({
                success: false,
                message: locale === 'am'
                    ? 'Խնդրում ենք օգտագործել մշտական email (ժամանակավոր email-ները արգելված են):'
                    : 'Please use a permanent email address (temporary emails are not allowed).',
            });
        }

        // Check if exists. First successful signup \"locks\" locale; we never change it afterwards.
        const existing = await pool.query('SELECT id, confirmed_at, locale, status FROM subscribers WHERE email = $1', [emailNorm]);

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const existingLocale = row.locale === 'am' ? 'am' : 'en';

            // If subscriber is already confirmed OR already active (e.g. came from Access flow),
            // treat this as a request to (re)send the PDF welcome email WITHOUT changing sequences.
            if (row.confirmed_at || row.status === 'active') {
                try {
                    await sendWelcomeEmail(emailNorm, existingLocale);
                    await pool.query(
                        'INSERT INTO email_log (subscriber_id, email_type, subject, status) VALUES ($1, $2, $3, $4)',
                        [row.id, 'welcome', 'Welcome Email with PDF (resent)', 'sent']
                    );
                } catch (e) {
                    console.error('[subscribe] Failed to resend welcome PDF for existing subscriber', emailNorm, e.message);
                }
                return res.json({
                    success: true,
                    subscriptionStatus: 'welcome_resent',
                    message: 'Your PDF has been sent to your email address.',
                });
            }

            // Not confirmed yet: keep old behaviour (ask to check confirmation email)
            return res.json({
                success: true,
                subscriptionStatus: 'pending_confirmation',
                message: 'Please check your email and confirm your subscription.',
            });
        }

        // Generate confirmation token
        const token = generateToken();

        // Insert new subscriber with pending status
        const result = await pool.query(
            'INSERT INTO subscribers (email, first_name, source, status, confirmation_token, locale) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [emailNorm, first_name || null, source || 'website', 'pending', token, locale]
        );

        // Send confirmation email
        await sendConfirmationEmail(email, token, locale);

        // Log email
        await pool.query(
            'INSERT INTO email_log (subscriber_id, email_type, subject, status) VALUES ($1, $2, $3, $4)',
            [result.rows[0].id, 'confirmation', 'Confirm your subscription', 'sent']
        );

        res.status(201).json({ success: true, subscriptionStatus: 'confirmation_sent', message: 'Please check your email and click the confirmation link!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/confirm/:token - Confirm subscription (double opt-in)
app.get('/api/confirm/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM subscribers WHERE confirmation_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            console.log('[confirm] Invalid or expired token (no subscriber found)');
            return res.status(400).send('<html><body style="background:#f8fafc;color:#0f172a;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;"><div style="text-align:center;"><h1>❌ Invalid Link</h1><p style="color:#64748b;">This confirmation link is invalid or expired.</p></div></body></html>');
        }

        const subscriber = result.rows[0];
        console.log('[confirm] Token valid, subscriber id=', subscriber.id, 'email=', subscriber.email, 'already confirmed_at=', !!subscriber.confirmed_at);

        // Determine subscriber locale once
        const subLocale = subscriber.locale === 'am' ? 'am' : 'en';
        // Use THANK_YOU_URL if available, otherwise fall back to API_URL (without /api suffix)
        const thankYouBaseRaw = process.env.THANK_YOU_URL || (process.env.API_URL || 'http://localhost:3001').replace(/\/api$/, '');
        const thankYouBase = thankYouBaseRaw.replace(/\/thank-you\/?$/i, '') || thankYouBaseRaw;

        // One-time token for thank-you page (24h expiry)
        const thankYouToken = crypto.randomBytes(24).toString('hex');
        const thankYouExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (subscriber.confirmed_at) {
            // Already confirmed - issue new thank-you token and redirect
            await pool.query(
                "UPDATE subscribers SET thank_you_token = $1, thank_you_token_expires_at = $2 WHERE id = $3",
                [thankYouToken, thankYouExpires, subscriber.id]
            );
            const thankYouUrl = subLocale === 'am' ? `${thankYouBase}/am/thank-you?token=${thankYouToken}` : `${thankYouBase}/thank-you?token=${thankYouToken}`;
            return res.redirect(thankYouUrl);
        }

        // Update subscriber to confirmed and set thank-you token (this is what makes them active)
        await pool.query(
            "UPDATE subscribers SET status = 'active', confirmed_at = NOW(), confirmation_token = NULL, thank_you_token = $1, thank_you_token_expires_at = $2 WHERE id = $3",
            [thankYouToken, thankYouExpires, subscriber.id]
        );
        console.log('[confirm] Subscriber marked active: id=', subscriber.id, 'email=', subscriber.email);

        // Send welcome email with PDF link
        await sendWelcomeEmail(subscriber.email, (subscriber.locale === 'am' ? 'am' : 'en'));

        // Log
        await pool.query(
            'INSERT INTO email_log (subscriber_id, email_type, subject, status) VALUES ($1, $2, $3, $4)',
            [subscriber.id, 'welcome', 'Welcome Email with PDF', 'sent']
        );

        // Third email: course access — link to Access page + how to get access
        await sendCourseAccessEmail(subscriber.email, subLocale);

        // Auto-add to PDF sequence for this locale (kind='pdf')
        try {
            await addToSequenceByKind(subscriber.id, subLocale, 'pdf');
        } catch (e) { console.error('Auto-add to pdf sequence error:', e.message); }

        const thankYouUrl = subLocale === 'am' ? `${thankYouBase}/am/thank-you?token=${thankYouToken}` : `${thankYouBase}/thank-you?token=${thankYouToken}`;
        res.redirect(thankYouUrl);
    } catch (error) {
        console.error('[confirm] Error confirming subscription:', error);
        res.status(500).send('Error confirming subscription');
    }
});

// GET /api/thank-you-access?token=... - Validate one-time thank-you token (used by thank-you page loader)
app.get('/api/thank-you-access', async (req, res) => {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
        return res.status(403).json({ ok: false });
    }
    try {
        const result = await pool.query(
            "SELECT id, locale FROM subscribers WHERE thank_you_token = $1 AND thank_you_token_expires_at > NOW()",
            [token]
        );
        if (result.rows.length === 0) {
            return res.status(403).json({ ok: false });
        }
        const sub = result.rows[0];
        const locale = sub.locale === 'am' ? 'am' : 'en';
        await pool.query(
            "UPDATE subscribers SET thank_you_token = NULL, thank_you_token_expires_at = NULL WHERE id = $1",
            [sub.id]
        );
        res.json({ ok: true, locale });
    } catch (err) {
        res.status(500).json({ ok: false });
    }
});

// POST /api/subscribers/:id/tags - Add tag to subscriber (and run sequence triggers for this tag)
app.post('/api/subscribers/:id/tags', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { tag_id } = req.body;

    try {
        await pool.query(
            'INSERT INTO subscriber_tags (subscriber_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, tag_id]
        );
        // Auto-enroll in sequences linked to this tag (sequence_triggers)
        try {
            const triggers = await pool.query('SELECT sequence_id FROM sequence_triggers WHERE tag_id = $1', [tag_id]);
            for (const row of triggers.rows) {
                const seqId = row.sequence_id;
                const existing = await pool.query('SELECT id FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2', [id, seqId]);
                if (existing.rows.length > 0) continue;
                const firstEmail = await pool.query('SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 ORDER BY position LIMIT 1', [seqId]);
                const delay_days = firstEmail.rows[0] ? (firstEmail.rows[0].delay_days || 0) : 0;
                const delay_hours = firstEmail.rows[0] ? (firstEmail.rows[0].delay_hours || 0) : 0;
                await pool.query(
                    `INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at)
                     VALUES (
                        $1,
                        $2,
                        0,
                        CASE
                            WHEN $3 = 0 AND $4 = 0
                                THEN NOW() - INTERVAL '1 minute'
                            ELSE NOW() + ($3 * INTERVAL '1 day') + ($4 * INTERVAL '1 hour')
                        END
                     )`,
                    [id, seqId, delay_days, delay_hours]
                );
            }
        } catch (e) {
            // sequence_triggers table may not exist yet
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/subscribers/:id/tags/:tagId - Remove tag
app.delete('/api/subscribers/:id/tags/:tagId', requireAdminAuth, async (req, res) => {
    const { id, tagId } = req.params;

    try {
        await pool.query('DELETE FROM subscriber_tags WHERE subscriber_id = $1 AND tag_id = $2', [id, tagId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/subscribers/:id - Delete subscriber (and dependent rows: email_clicks, email_log)
app.delete('/api/subscribers/:id', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    try {
        await pool.query('BEGIN');
        // email_clicks may not exist if migration 003 not run; delete if table exists
        try {
            await pool.query(
                'DELETE FROM email_clicks WHERE email_log_id IN (SELECT id FROM email_log WHERE subscriber_id = $1)',
                [id]
            );
        } catch (e) {
            // ignore if email_clicks table missing
        }
        await pool.query('DELETE FROM email_log WHERE subscriber_id = $1', [id]);
        await pool.query('DELETE FROM subscribers WHERE id = $1', [id]);
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK').catch(() => { });
        res.status(500).json({ error: error.message });
    }
});

// ==================== ACCESS REQUESTS & DASHBOARD AUTH ====================

// POST /api/access-requests - Submit access request (email + UID + optional locale)
app.post('/api/access-requests', async (req, res) => {
    const { email, uid, locale: reqLocale } = req.body;
    if (!email || !email.includes('@') || !uid || !String(uid).trim()) {
        return res.status(400).json({ success: false, message: 'Email and UID are required' });
    }
    const emailNorm = email.toLowerCase().trim();
    const locale = (reqLocale === 'am' ? 'am' : 'en');
    try {
        // Block disposable / temp mail domains
        if (await isBlockedEmail(emailNorm)) {
            const domain = normalizeEmailDomain(emailNorm);
            console.log(`[blocked-email] access-request domain=${domain || emailNorm}`);
            return res.status(400).json({
                success: false,
                message: locale === 'am'
                    ? 'Խնդրում ենք օգտագործել մշտական email (ժամանակավոր email-ները արգելված են):'
                    : 'Please use a permanent email address (temporary emails are not allowed).',
            });
        }

        // Block only if this email has a request still pending (rejected/accepted can re-apply)
        const existingRequest = await pool.query(
            'SELECT id, status FROM access_requests WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1',
            [emailNorm]
        );
        if (existingRequest.rows.length > 0 && existingRequest.rows[0].status === 'pending') {
            return res.status(409).json({ success: false, code: 'already_exists', message: 'You already have a pending request.' });
        }
        const existingUser = await pool.query(
            'SELECT id FROM dashboard_users WHERE LOWER(email) = $1 LIMIT 1',
            [emailNorm]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, code: 'already_exists', message: 'An account with this email already exists.' });
        }
        const result = await pool.query(
            'INSERT INTO access_requests (email, uid, status, locale) VALUES ($1, $2, $3, $4) RETURNING *',
            [emailNorm, String(uid).trim(), 'pending', locale]
        );
        await sendRequestReceivedEmail(email, locale);
        await sendAdminNewAccessRequestNotification(emailNorm, String(uid).trim(), locale);
        res.status(201).json({ success: true, message: 'Request received. We will process it within 24 hours.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/access-requests - List access requests (admin), optional ?locale=am|en
app.get('/api/access-requests', requireAdminAuth, async (req, res) => {
    const { status, locale } = req.query;
    try {
        let query = 'SELECT * FROM access_requests';
        const params = [];
        const conditions = [];
        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (locale === 'am' || locale === 'en') {
            params.push(locale);
            conditions.push(`locale = $${params.length}`);
        }
        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/access-requests/:id/accept - Accept request, create user, send set-password email
app.post('/api/access-requests/:id/accept', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    try {
        const reqRow = await pool.query('SELECT * FROM access_requests WHERE id = $1', [id]);
        if (reqRow.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        const { email, status: reqStatus, locale: reqLocale } = reqRow.rows[0];
        const locale = (reqLocale === 'am' ? 'am' : 'en');
        if (reqStatus !== 'pending') return res.status(400).json({ error: 'Request already processed' });

        await pool.query('BEGIN');
        await pool.query("UPDATE access_requests SET status = 'accepted' WHERE id = $1", [id]);
        await pool.query(
            'INSERT INTO dashboard_users (email, locale) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET locale = $2',
            [email, locale]
        );
        const setPasswordToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query(
            'INSERT INTO set_password_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
            [email, setPasswordToken, expiresAt]
        );
        await pool.query('COMMIT');
        await sendSetPasswordEmail(email, setPasswordToken, locale);

        // Auto-transition: PDF -> ACCESS sequence for this email
        try {
            const sub = await ensureSubscriberForEmail(email, locale);
            await stopSequencesByKind(sub.id, 'pdf');
            await addToSequenceByKind(sub.id, sub.locale, 'access');
        } catch (e) {
            console.error('[access-accept] Failed to update sequences for', email, e.message);
        }

        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK').catch(() => { });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/access-requests/:id/resend-set-password - Resend set-password email (for accepted requests)
app.post('/api/access-requests/:id/resend-set-password', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    try {
        const reqRow = await pool.query('SELECT * FROM access_requests WHERE id = $1', [id]);
        if (reqRow.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        const { email, status: reqStatus, locale: reqLocale } = reqRow.rows[0];
        const locale = (reqLocale === 'am' ? 'am' : 'en');
        if (reqStatus !== 'accepted') {
            return res.status(400).json({ error: 'Only accepted requests can receive set-password email' });
        }
        const setPasswordToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        // Cleanup old tokens for this email to avoid clutter
        await pool.query('DELETE FROM set_password_tokens WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO set_password_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
            [email, setPasswordToken, expiresAt]
        );
        await sendSetPasswordEmail(email, setPasswordToken, locale);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/access-requests/:id/reject - Reject request (reason required, email sent to user)
app.post('/api/access-requests/:id/reject', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    const raw = req.body && req.body.reason;
    const reason = typeof raw === 'string' ? raw.trim() : '';
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    try {
        const reqRow = await pool.query('SELECT * FROM access_requests WHERE id = $1', [id]);
        if (reqRow.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
        const { email, status: reqStatus, locale: reqLocale } = reqRow.rows[0];
        const locale = (reqLocale === 'am' ? 'am' : 'en');
        if (reqStatus !== 'pending') return res.status(400).json({ error: 'Request already processed' });
        await pool.query("UPDATE access_requests SET status = 'rejected' WHERE id = $1", [id]);
        await sendAccessRequestRejectedEmail(email, reason, locale);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/indicator-access-requests - List indicator access requests (admin)
app.get('/api/indicator-access-requests', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, COALESCE(first_name, '') AS first_name, COALESCE(tradingview_username, '') AS tradingview_username,
             COALESCE(indicator_access_status, 'none') AS indicator_access_status, indicator_requested_at
             FROM dashboard_users
             WHERE (indicator_access_status IN ('pending', 'approved', 'rejected')) OR (tradingview_username IS NOT NULL AND tradingview_username != '')
             ORDER BY indicator_requested_at DESC NULLS LAST`
        );
        const rows = result.rows.map(row => ({
            id: row.id,
            email: row.email,
            first_name: row.first_name,
            tradingview_username: row.tradingview_username,
            indicator_access_status: row.indicator_access_status,
            indicator_requested_at: row.indicator_requested_at ? row.indicator_requested_at.toISOString() : null
        }));
        res.json(rows);
    } catch (error) {
        if (error.message && /column "indicator_access_status" does not exist/i.test(error.message)) {
            return res.status(400).json({ error: 'Run migration 014 (indicator access)' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/indicator-access-requests/:userId/approve - Approve indicator access
app.post('/api/indicator-access-requests/:userId/approve', requireAdminAuth, async (req, res) => {
    const userId = req.params.userId;
    try {
        const updateResult = await pool.query(
            "UPDATE dashboard_users SET indicator_access_status = 'approved' WHERE id = $1 RETURNING id, email, COALESCE(first_name, '') AS first_name",
            [userId]
        );
        if (updateResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const { email, first_name: firstName } = updateResult.rows[0];
        await sendUserIndicatorAccessApprovedEmail(email, firstName);
        res.json({ success: true });
    } catch (error) {
        if (error.message && /column "indicator_access_status" does not exist/i.test(error.message)) {
            return res.status(400).json({ error: 'Run migration 014 (indicator access)' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/indicator-access-requests/:userId/reject - Reject indicator access (reason required, email sent to user)
app.post('/api/indicator-access-requests/:userId/reject', requireAdminAuth, async (req, res) => {
    const userId = req.params.userId;
    const raw = req.body && req.body.reason;
    const reason = typeof raw === 'string' ? raw.trim() : '';
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    try {
        const updateResult = await pool.query(
            "UPDATE dashboard_users SET indicator_access_status = 'rejected', indicator_rejected_reason = $1, indicator_rejected_at = NOW() WHERE id = $2 RETURNING id, email, COALESCE(first_name, '') AS first_name",
            [reason, userId]
        );
        if (updateResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const { email, first_name: firstName } = updateResult.rows[0];
        await sendUserIndicatorAccessRejectedEmail(email, firstName, reason);
        res.json({ success: true });
    } catch (error) {
        if (error.message && /column "indicator_access_status" does not exist/i.test(error.message)) {
            return res.status(400).json({ error: 'Run migration 014 (indicator access)' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/set-password - Set password with one-time token (token is single-use, 24h validity)
app.post('/api/set-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Valid token and password (min 6 characters) required' });
    }
    try {
        // Only accept token if it exists AND not expired (24h)
        const row = await pool.query(
            'SELECT * FROM set_password_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        if (row.rows.length === 0) {
            // Token missing: already used (deleted after set) or expired or invalid
            const expired = await pool.query(
                'SELECT 1 FROM set_password_tokens WHERE token = $1 AND expires_at <= NOW()',
                [token]
            );
            const message = expired.rows.length > 0
                ? 'This link has expired (valid 24 hours). Request a new one from admin.'
                : 'This link has already been used or is invalid. If you set your password, go to Login.';
            return res.status(400).json({ success: false, message });
        }
        const { email } = row.rows[0];
        const passwordHash = await bcrypt.hash(password, 10);
        await pool.query('BEGIN');
        await pool.query('UPDATE dashboard_users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
        await pool.query('DELETE FROM set_password_tokens WHERE token = $1', [token]); // one-time: link stops working
        await pool.query('COMMIT');
        res.json({ success: true, message: 'Password set. You can now log in.' });
    } catch (error) {
        await pool.query('ROLLBACK').catch(() => { });
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/dev-login - Dev-only: create/find dev@test.com with password "password", return JWT (only when NODE_ENV !== 'production')
app.post('/api/dev-login', authLimiter, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, message: 'Not available' });
    }
    const devEmail = (process.env.DEV_LOGIN_EMAIL || 'dev@test.com').toLowerCase();
    const devPassword = process.env.DEV_LOGIN_PASSWORD || 'password';
    try {
        let result = await pool.query('SELECT id, email, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE email = $1', [devEmail]);
        if (result.rows.length === 0) {
            const passwordHash = await bcrypt.hash(devPassword, 10);
            await pool.query(
                'INSERT INTO dashboard_users (email, password_hash) VALUES ($1, $2)',
                [devEmail, passwordHash]
            );
            result = await pool.query('SELECT id, email, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE email = $1', [devEmail]);
            if (result.rows.length === 0) return res.status(500).json({ success: false, message: 'Failed to create dev user' });
        } else {
            const user = await pool.query('SELECT id, email, password_hash, COALESCE(locale, \'en\') AS locale FROM dashboard_users WHERE email = $1', [devEmail]);
            if (user.rows[0].password_hash) {
                const valid = await bcrypt.compare(devPassword, user.rows[0].password_hash);
                if (!valid) {
                    return res.status(401).json({ success: false, message: 'Dev user exists with different password. Set DEV_LOGIN_PASSWORD or reset password.' });
                }
            } else {
                const passwordHash = await bcrypt.hash(devPassword, 10);
                await pool.query('UPDATE dashboard_users SET password_hash = $1 WHERE email = $2', [passwordHash, devEmail]);
            }
        }
        const row = result.rows[0];
        const secret = process.env.JWT_SECRET || 'superengulfing-dashboard-secret';
        const token = jwt.sign(
            { email: row.email, sub: row.id },
            secret,
            { expiresIn: '7d' }
        );
        const locale = row.locale === 'am' ? 'am' : 'en';
        res.json({ success: true, token, locale });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/login - Login with email/password, return JWT
app.post('/api/login', authLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        logLoginEvent('failure', { reason: 'missing_credentials', email });
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
        const result = await pool.query('SELECT * FROM dashboard_users WHERE email = $1', [normalizedEmail]);
        if (result.rows.length === 0) {
            logLoginEvent('failure', { reason: 'user_not_found', email: normalizedEmail });
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const user = result.rows[0];
        if (!user.password_hash) {
            logLoginEvent('failure', { reason: 'missing_password_hash', email: normalizedEmail, user_id: user.id });
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            logLoginEvent('failure', { reason: 'wrong_password', email: normalizedEmail, user_id: user.id });
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const secret = process.env.JWT_SECRET || 'superengulfing-dashboard-secret';
        const token = jwt.sign(
            { email: user.email, sub: user.id },
            secret,
            { expiresIn: '7d' }
        );
        const locale = (user.locale === 'am') ? 'am' : 'en';
        logLoginEvent('success', { email: normalizedEmail, user_id: user.id, locale });
        res.json({ success: true, token, locale });
    } catch (error) {
        logLoginEvent('error', { email: normalizedEmail, message: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== COURSES LMS ====================
// (requireAuth and jwtSecret are defined at top of file)

// Allowed video URL hosts for YouTube and Wistia
function isValidVideoUrl(url, videoType) {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url.trim());
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        const allowed = videoType === 'youtube'
            ? ['youtube.com', 'youtu.be']
            : ['wistia.com', 'fast.wistia.net', 'home.wistia.com'];
        return allowed.some(h => host === h || host.endsWith('.' + h));
    } catch (_) {
        return false;
    }
}

// GET /api/courses - List all courses (public, for catalog). Optional ?locale=am|en to filter by audience.
app.get('/api/courses', async (req, res) => {
    const { locale } = req.query;
    const hasLocale = (locale === 'am' || locale === 'en');
    const params = hasLocale ? [locale] : [];
    const whereClause = hasLocale ? "WHERE COALESCE(c.locale, 'en') = $1" : "";
    try {
        const result = await pool.query(`
            SELECT c.id, c.title, c.description, c.image_url, c.created_at,
                   COALESCE(c.is_paid, false) AS is_paid,
                   c.price_display,
                   (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
            FROM courses c
            ${whereClause}
            ORDER BY c.created_at DESC
        `, params);
        const rows = result.rows.map(r => ({
            ...r,
            is_paid: r.is_paid === true,
            price_display: r.price_display || null
        }));
        res.json({ courses: rows });
    } catch (error) {
        if (error.message && /column "is_paid" does not exist/i.test(error.message)) {
            const result = await pool.query(`
                SELECT c.id, c.title, c.description, c.image_url, c.created_at,
                       (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
                FROM courses c ${whereClause} ORDER BY c.created_at DESC
            `, params);
            res.json({ courses: result.rows.map(r => ({ ...r, is_paid: false, price_display: null })) });
            return;
        }
        res.status(500).json({ error: error.message });
    }
});

// GET /api/courses/my-courses - Enrolled courses with progress (JWT) - must be before /:id
app.get('/api/courses/my-courses', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT c.id, c.title, c.description, c.image_url, e.enrolled_at,
                   (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM video_progress vp
                    JOIN lessons l ON l.id = vp.lesson_id AND l.course_id = c.id
                    WHERE vp.user_id = $1 AND vp.completed = true) AS completed_lessons
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            WHERE e.user_id = $1
              AND COALESCE(c.locale, 'en') = (SELECT COALESCE(locale, 'en') FROM dashboard_users WHERE id = $1)
            ORDER BY e.enrolled_at DESC
        `, [userId]);
        const courses = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            image_url: row.image_url,
            enrolled_at: row.enrolled_at,
            total_lessons: parseInt(row.total_lessons, 10) || 0,
            completed_lessons: parseInt(row.completed_lessons, 10) || 0,
            progress_percent: row.total_lessons > 0
                ? Math.round((row.completed_lessons / row.total_lessons) * 100)
                : 0
        }));
        res.json({ courses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/courses/resume - Next lesson to continue (JWT) - for dashboard "Continue Learning" card
app.get('/api/courses/resume', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const enrolled = await pool.query(`
            SELECT c.id, c.title,
                   (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total_lessons,
                   (SELECT COUNT(*) FROM video_progress vp
                    JOIN lessons l ON l.id = vp.lesson_id AND l.course_id = c.id
                    WHERE vp.user_id = $1 AND vp.completed = true) AS completed_lessons
            FROM enrollments e
            JOIN courses c ON c.id = e.course_id
            WHERE e.user_id = $1
              AND COALESCE(c.locale, 'en') = (SELECT COALESCE(locale, 'en') FROM dashboard_users WHERE id = $1)
            ORDER BY e.enrolled_at DESC
        `, [userId]);
        if (enrolled.rows.length === 0) return res.json({ resume: null });
        const total = parseInt(enrolled.rows[0].total_lessons, 10) || 0;
        const completed = parseInt(enrolled.rows[0].completed_lessons, 10) || 0;
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const courseId = enrolled.rows[0].id;
        const courseTitle = enrolled.rows[0].title;
        const lessons = await pool.query(
            'SELECT id, title, position, video_url, video_type FROM lessons WHERE course_id = $1 ORDER BY position ASC, id ASC',
            [courseId]
        );
        const lessonIds = (lessons.rows || []).map(l => l.id);
        const progressRows = lessonIds.length > 0
            ? await pool.query(
                'SELECT lesson_id, completed FROM video_progress WHERE user_id = $1 AND lesson_id = ANY($2)',
                [userId, lessonIds]
            )
            : { rows: [] };
        const completedIds = new Set((progressRows.rows || []).filter(r => r.completed).map(r => r.lesson_id));
        const nextLesson = (lessons.rows || []).find(l => !completedIds.has(l.id));
        const firstLesson = lessons.rows && lessons.rows[0] ? lessons.rows[0] : null;
        const lesson = nextLesson || firstLesson;
        res.json({
            resume: {
                course_id: courseId,
                course_title: courseTitle,
                progress_percent: progressPercent,
                completed_lessons: completed,
                total_lessons: total,
                next_lesson_id: lesson ? lesson.id : null,
                next_lesson_title: lesson ? lesson.title : null,
                next_lesson_position: lesson ? lesson.position : 0,
                next_lesson_video_url: lesson && lesson.video_url ? lesson.video_url : null,
                next_lesson_video_type: lesson && lesson.video_type ? lesson.video_type : null
            }
        });
    } catch (error) {
        console.error('[/api/courses/resume]', error.message || error);
        if (error.message && /relation "(courses|enrollments|lessons|video_progress)" does not exist/i.test(error.message)) {
            console.error('  -> Run: node server/run_courses_migration.cjs');
        }
        return res.json({ resume: null });
    }
});

// GET /api/courses/:id - Single course (for course page)
app.get('/api/courses/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, title, description, image_url, created_at, COALESCE(is_paid, false) AS is_paid, price_display FROM courses WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        const row = result.rows[0];
        res.json({ ...row, is_paid: row.is_paid === true, price_display: row.price_display || null });
    } catch (error) {
        if (error.message && /column "is_paid" does not exist/i.test(error.message)) {
            const result = await pool.query('SELECT id, title, description, image_url, created_at FROM courses WHERE id = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
            res.json({ ...result.rows[0], is_paid: false, price_display: null });
            return;
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/enrollments - Enroll in course (JWT). Paid courses require payment first (use POST /api/course-payment-complete after payment).
app.post('/api/enrollments', requireAuth, async (req, res) => {
    const { course_id } = req.body;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });
    try {
        const userId = req.user.id;
        let coursePaid = false;
        try {
            const courseRow = await pool.query('SELECT is_paid FROM courses WHERE id = $1', [course_id]);
            if (courseRow.rows.length > 0 && courseRow.rows[0].is_paid === true) coursePaid = true;
        } catch (e) {
            if (!e.message || !/column "is_paid" does not exist/i.test(e.message)) throw e;
        }
        if (coursePaid) {
            const paid = await pool.query('SELECT 1 FROM course_payments WHERE user_id = $1 AND course_id = $2 LIMIT 1', [userId, course_id]);
            if (paid.rows.length === 0) {
                return res.status(403).json({ error: 'Pay first', code: 'paid_course' });
            }
        }
        await pool.query(
            'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
            [userId, course_id]
        );
        res.json({ success: true });
    } catch (error) {
        if (error.message && /relation "course_payments" does not exist/i.test(error.message)) {
            await pool.query(
                'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
                [req.user.id, course_id]
            );
            return res.json({ success: true });
        }
        res.status(500).json({ error: error.message });
    }
});

// GET /api/course-payment-widget-url - Returns NOWPayments embed URL with order_id for webhook auto-enrollment (JWT).
const NOWPAYMENTS_COURSE_WIDGET_IID = process.env.NOWPAYMENTS_COURSE_WIDGET_IID || '6065193944';
app.get('/api/course-payment-widget-url', requireAuth, async (req, res) => {
    const courseId = req.query.course_id;
    if (!courseId) return res.status(400).json({ error: 'course_id required' });
    const userId = req.user.id;
    try {
        const courseResult = await pool.query(
            'SELECT id, title, is_paid FROM courses WHERE id = $1',
            [courseId]
        );
        if (courseResult.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        if (!courseResult.rows[0].is_paid) return res.status(400).json({ error: 'Course is not paid' });
        const orderId = `COURSE_${courseId}_USER_${userId}`;
        const params = new URLSearchParams({ iid: NOWPAYMENTS_COURSE_WIDGET_IID, order_id: orderId });
        const userRow = await pool.query('SELECT email FROM dashboard_users WHERE id = $1', [userId]);
        const email = userRow.rows[0] && userRow.rows[0].email;
        if (email) params.set('customer_email', email);
        const url = `https://nowpayments.io/embeds/payment-widget?${params.toString()}`;
        return res.json({ url });
    } catch (e) {
        console.error('[/api/course-payment-widget-url]', e);
        return res.status(500).json({ error: e.message });
    }
});

// ==================== USDT TRC20 PAYMENT (self-hosted) ====================
const USDT_TRC20_WALLET = process.env.USDT_TRC20_WALLET_ADDRESS || 'TRXj2ShUse4vpYxQhqaJz8dM7WscUzhARB';
const USDT_MAIN_WALLET = USDT_TRC20_WALLET;
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_DECIMALS = 6;
const LIQUIDITYSCAN_BASE_USD = 49.01;
const COURSE_BASE_USD = 59.01;
const TRON_FULLNODE_URL = process.env.TRON_FULLNODE_URL || 'https://api.trongrid.io';
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || '';

function createTronWebForPrivateKey(privateKey) {
    if (!privateKey) {
        throw new Error('Missing private key for TronWeb client');
    }
    const opts = {
        fullHost: TRON_FULLNODE_URL,
        privateKey,
    };
    if (TRONGRID_API_KEY) {
        opts.headers = { 'TRON-PRO-API-KEY': TRONGRID_API_KEY };
    }
    return new TronWeb(opts);
}

async function createDepositAddressRecord(client) {
    const account = await TronWeb.createAccount();
    const address = (account.address && (account.address.base58 || account.address)) || account.addressBase58 || account.addressHex || '';
    const privateKey = account.privateKey;
    if (!address || !privateKey) {
        throw new Error('Failed to generate USDT deposit address');
    }
    const insert = await client.query(
        `INSERT INTO usdt_deposit_addresses (address, private_key, status)
         VALUES ($1, pgp_sym_encrypt($2, current_setting('app.usdt_key', true)), 'free')
         ON CONFLICT (address) DO UPDATE SET address = EXCLUDED.address
         RETURNING id, address`,
        [address, privateKey]
    );
    return insert.rows[0];
}

async function allocateDepositAddressForOrder(orderDbId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let addr = await client.query(
            `SELECT id, address FROM usdt_deposit_addresses
             WHERE status = 'free'
             ORDER BY id
             LIMIT 1
             FOR UPDATE SKIP LOCKED`
        );
        let row = addr.rows[0];
        if (!row) {
            row = await createDepositAddressRecord(client);
        }
        await client.query(
            `UPDATE usdt_deposit_addresses
             SET status = 'assigned', assigned_at = NOW(), last_used_at = NOW()
             WHERE id = $1`,
            [row.id]
        );
        await client.query(
            `UPDATE usdt_orders
             SET deposit_address_id = $1
             WHERE id = $2`,
            [row.id, orderDbId]
        );
        await client.query('COMMIT');
        return row.address;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Optional auth: set req.user if valid token, otherwise req.user = null
const optionalAuth = (req, res, next) => {
    req.user = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = { id: decoded.sub, email: decoded.email };
        next();
    } catch {
        next();
    }
};

function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
    }
    return Math.abs(h);
}

// POST /api/usdt/create-order - Create USDT TRC20 order (optional JWT for course)
app.post('/api/usdt/create-order', optionalAuth, async (req, res) => {
    const { product_type, product_id, email, test } = req.body || {};
    if (!product_type || !['liquidityscan_pro', 'course'].includes(product_type)) {
        return res.status(400).json({ error: 'product_type must be liquidityscan_pro or course' });
    }
    const userId = req.user ? req.user.id : null;
    const userEmail = (req.user && req.user.email) || (email && String(email).trim()) || null;
    const isTest = test === true;

    if (product_type === 'course') {
        if (!req.user) return res.status(401).json({ error: 'Login required to pay for course' });
        if (!product_id) return res.status(400).json({ error: 'product_id (course_id) required for course' });
        const courseRes = await pool.query('SELECT id, title, is_paid FROM courses WHERE id = $1', [product_id]);
        if (courseRes.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        if (!courseRes.rows[0].is_paid) return res.status(400).json({ error: 'Course is not paid' });
        const existing = await pool.query('SELECT 1 FROM course_payments WHERE user_id = $1 AND course_id = $2', [userId, product_id]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Already purchased' });
    }

    const orderId = `USDT_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const baseAmount = isTest ? 10.0 : (product_type === 'liquidityscan_pro' ? LIQUIDITYSCAN_BASE_USD : COURSE_BASE_USD);
    const centsOffset = (simpleHash(orderId) % 99) * 0.01;
    const amountUsdt = Math.round((baseAmount + centsOffset) * 100) / 100;

    let orderDbId = null;
    try {
        const insert = await pool.query(
            `INSERT INTO usdt_orders (order_id, product_type, product_id, user_id, email, amount_usdt, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING id`,
            [orderId, product_type, product_id || null, userId, userEmail || null, amountUsdt]
        );
        orderDbId = insert.rows[0] && insert.rows[0].id;
    } catch (e) {
        if (e.message && /usdt_orders/i.test(e.message)) {
            return res.status(500).json({ error: 'USDT orders table not ready. Run: npm run migrate:usdt' });
        }
        throw e;
    }

    let depositAddress = null;
    try {
        if (orderDbId != null) {
            depositAddress = await allocateDepositAddressForOrder(orderDbId);
        }
    } catch (e) {
        console.warn('[usdt] failed to allocate deposit address, falling back to main wallet:', e.message);
    }

    const addressForPayment = depositAddress || USDT_TRC20_WALLET;
    const qrAddress = addressForPayment;
    const qrPayment = `tron:${addressForPayment}?amount=${amountUsdt}&token=USDT`;

    return res.json({
        order_id: orderId,
        address: addressForPayment,
        amount: amountUsdt,
        amount_display: amountUsdt.toFixed(2),
        qr_address: qrAddress,
        qr_payment: qrPayment,
    });
});

// GET /api/usdt/orders/:orderId/status - Poll order status (no auth). Triggers lazy payment check.
app.get('/api/usdt/orders/:orderId/status', async (req, res) => {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'order_id required' });
    try {
        const r = await pool.query(
            'SELECT status FROM usdt_orders WHERE order_id = $1',
            [orderId]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        if (r.rows[0].status === 'pending') {
            processUsdtPayments().catch((e) => console.warn('[usdt] lazy check error:', e.message));
        }
        return res.json({ status: r.rows[0].status });
    } catch (e) {
        if (e.message && /usdt_orders/i.test(e.message)) {
            return res.status(500).json({ error: 'USDT orders table not ready. Run: npm run migrate:usdt' });
        }
        return res.status(500).json({ error: e.message });
    }
});

async function sweepOrderToMainWallet(match, txHash) {
    if (!match || !match.deposit_address_id) return;
    try {
        const dep = await pool.query(
            `SELECT id, address, pgp_sym_decrypt(private_key::bytea, current_setting('app.usdt_key', true)) AS private_key
             FROM usdt_deposit_addresses
             WHERE id = $1`,
            [match.deposit_address_id]
        );
        if (dep.rows.length === 0) return;
        const row = dep.rows[0];
        const tron = createTronWebForPrivateKey(row.private_key);
        const contract = await tron.contract().at(USDT_TRC20_CONTRACT);
        const amountRaw = BigInt(Math.round(Number(match.amount_usdt) * Math.pow(10, USDT_DECIMALS)));
        await contract.transfer(USDT_MAIN_WALLET, amountRaw.toString()).send();
        await pool.query(
            'UPDATE usdt_orders SET swept_to_main = true, sweep_tx_hash = COALESCE(sweep_tx_hash, $2) WHERE id = $1',
            [match.id, txHash || null]
        );
    } catch (e) {
        console.warn('[usdt] sweep to main wallet failed:', e.message || e);
    }
}

// TronGrid polling: fetch USDT TRC20 incoming txs per deposit address, match to pending orders, grant access and sweep
async function processUsdtPayments() {
    try {
        const pendingRes = await pool.query(
            `SELECT
                o.id,
                o.order_id,
                o.product_type,
                o.product_id,
                o.user_id,
                o.email,
                o.amount_usdt,
                o.deposit_address_id,
                o.swept_to_main,
                o.created_at,
                a.address AS deposit_address
             FROM usdt_orders o
             LEFT JOIN usdt_deposit_addresses a ON a.id = o.deposit_address_id
             WHERE o.status = $1`,
            ['pending']
        );
        const pending = pendingRes.rows;
        if (pending.length === 0) return;

        const fromAddr = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER;
        const notifyTo = process.env.NOWPAY_NOTIFY_EMAIL || (ADMIN_EMAILS[0] || process.env.SMTP_USER);

        const ordersByAddress = new Map();
        for (const row of pending) {
            const key = row.deposit_address || 'LEGACY';
            if (!ordersByAddress.has(key)) ordersByAddress.set(key, []);
            ordersByAddress.get(key).push(row);
        }

        const processedOrderIds = new Set();

        for (const [addressKey, orders] of ordersByAddress.entries()) {
            const scanAddress = addressKey === 'LEGACY' ? USDT_TRC20_WALLET : addressKey;
            if (!scanAddress) continue;

            const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(scanAddress)}/transactions/trc20?only_confirmed=true&limit=50&contract_address=${USDT_TRC20_CONTRACT}&only_to=true&order_by=block_timestamp,desc`;
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const data = await resp.json();
            const txs = (data.data || []).filter(
                (t) => (t.token_info || {}).address === USDT_TRC20_CONTRACT && (t.type || '') === 'Transfer'
            );

            for (const tx of txs) {
                const rawVal = parseInt(tx.value || '0', 10);
                const amountUsdt = rawVal / Math.pow(10, USDT_DECIMALS);
                const txTimestamp = tx.block_timestamp ? Number(tx.block_timestamp) : 0;
                const match = orders.find(
                    (o) => {
                        if (processedOrderIds.has(o.order_id)) return false;
                        if (Math.abs(Number(o.amount_usdt) - amountUsdt) >= 0.02) return false;
                        const orderCreatedMs = o.created_at ? new Date(o.created_at).getTime() : 0;
                        if (txTimestamp > 0 && orderCreatedMs > 0 && txTimestamp < orderCreatedMs - 60000) return false;
                        return true;
                    }
                );
                if (!match) continue;
                processedOrderIds.add(match.order_id);
                const txHash = tx.transaction_id || tx.txID || '';

                await pool.query(
                    'UPDATE usdt_orders SET status = $1, tx_hash = $2 WHERE id = $3',
                    ['completed', txHash || null, match.id]
                );

                if (match.product_type === 'course' && match.user_id && match.product_id) {
                    const amountUsdtNum = match.amount_usdt != null ? Number(match.amount_usdt) : null;
                    const amountCents = amountUsdtNum != null ? Math.round(amountUsdtNum * 100) : null;
                    await pool.query(
                        `INSERT INTO course_payments (user_id, course_id, amount_cents, payment_id, status)
                         VALUES ($1, $2, $3, $4, 'completed')
                         ON CONFLICT (user_id, course_id) DO UPDATE SET amount_cents = COALESCE(EXCLUDED.amount_cents, course_payments.amount_cents), payment_id = EXCLUDED.payment_id, status = 'completed'`,
                        [match.user_id, match.product_id, amountCents, `USDT_${txHash}`]
                    );
                    await pool.query(
                        'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
                        [match.user_id, match.product_id]
                    );
                    const courseRes = await pool.query('SELECT title FROM courses WHERE id = $1', [match.product_id]);
                    const courseTitle = (courseRes.rows[0] && courseRes.rows[0].title) || 'Course';
                    const userRes = await pool.query('SELECT email FROM dashboard_users WHERE id = $1', [match.user_id]);
                    const userEmail = userRes.rows[0] && userRes.rows[0].email;
                    if (userEmail && transporter) {
                        await transporter.sendMail({
                            from: fromAddr,
                            to: userEmail,
                            subject: `You have access to: ${courseTitle}`,
                            text: `Your USDT payment was successful. You now have access to the course "${courseTitle}". Log in to your dashboard to start learning.\n\nSuperEngulfing`,
                        }).catch((err) => console.warn('[usdt] course email failed:', err.message));
                    }
                    if (notifyTo) {
                        await transporter.sendMail({
                            from: fromAddr,
                            to: notifyTo,
                            subject: `USDT payment: ${userEmail || match.user_id} enrolled in "${courseTitle}"`,
                            text: `USDT TRC20 payment detected. User ${userEmail || match.user_id} enrolled in course "${courseTitle}". TX: ${txHash}`,
                        }).catch((err) => console.warn('[usdt] admin email failed:', err.message));
                    }
                }

                if (match.product_type === 'liquidityscan_pro') {
                    let recipientEmail = match.email;
                    if (!recipientEmail && match.user_id) {
                        const u = await pool.query('SELECT email FROM dashboard_users WHERE id = $1', [match.user_id]);
                        recipientEmail = u.rows[0] && u.rows[0].email;
                    }
                    if (recipientEmail && recipientEmail.includes('@')) {
                        await transporter.sendMail({
                            from: fromAddr,
                            to: recipientEmail,
                            subject: 'Your LiquidityScan PRO payment was received',
                            text: [
                                'Hi,',
                                '',
                                'Your USDT payment for LiquidityScan PRO was received successfully.',
                                '',
                                `Transaction: ${txHash}`,
                                '',
                                'Access LiquidityScan PRO at: https://liquidityscan.io',
                                '',
                                '– SuperEngulfing',
                            ].join('\n'),
                        }).catch((err) => console.warn('[usdt] LS PRO email failed:', err.message));
                    }
                    if (notifyTo) {
                        await transporter.sendMail({
                            from: fromAddr,
                            to: notifyTo,
                            subject: 'USDT LiquidityScan PRO payment received',
                            text: `USDT TRC20 payment for LiquidityScan PRO. Email: ${match.email || 'N/A'}. TX: ${txHash}`,
                        }).catch((err) => console.warn('[usdt] admin LS email failed:', err.message));
                    }
                }

                if (match.deposit_address_id) {
                    await sweepOrderToMainWallet(match, txHash);
                }
            }
        }
    } catch (e) {
        if (!e.message || !/usdt_orders/i.test(e.message)) {
            console.warn('[usdt] processUsdtPayments error:', e.message);
        }
    }
}

// Start USDT payment polling (every 45 seconds)
let usdtPollInterval = null;
function startUsdtPolling() {
    if (usdtPollInterval) return;
    usdtPollInterval = setInterval(processUsdtPayments, 45000);
    console.log('   USDT TRC20 payment polling started (every 45s)');
}

// POST /api/course-payment-complete - For PAID courses: access is granted ONLY by NOWPayments webhook (IPN).
// This endpoint no longer enrolls on button click — prevents abuse (user claiming "I paid" without paying).
app.post('/api/course-payment-complete', requireAuth, async (req, res) => {
    const { course_id } = req.body;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });
    try {
        const courseResult = await pool.query(
            'SELECT id, title, is_paid FROM courses WHERE id = $1',
            [course_id]
        );
        if (courseResult.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        const course = courseResult.rows[0];
        if (course.is_paid !== true) return res.status(400).json({ error: 'Course is not paid' });

        return res.status(403).json({
            error: 'Access is granted only after payment confirmation. If you have already paid, access will open automatically within a few minutes. If the problem persists, contact support.',
            code: 'payment_webhook_only',
        });
    } catch (error) {
        console.error('[/api/course-payment-complete]', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/progress - Update video progress (JWT)
app.put('/api/progress', requireAuth, async (req, res) => {
    const { lesson_id, completed, watch_time_seconds } = req.body;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id required' });
    try {
        const userId = req.user.id;
        await pool.query(`
            INSERT INTO video_progress (user_id, lesson_id, completed, watch_time_seconds, updated_at)
            VALUES ($1, $2, COALESCE($3, false), COALESCE($4, 0), NOW())
            ON CONFLICT (user_id, lesson_id) DO UPDATE SET
                completed = COALESCE(EXCLUDED.completed, video_progress.completed),
                watch_time_seconds = GREATEST(COALESCE(EXCLUDED.watch_time_seconds, 0), video_progress.watch_time_seconds),
                updated_at = NOW()
        `, [userId, lesson_id, completed === true, watch_time_seconds != null ? parseInt(watch_time_seconds, 10) : 0]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/courses - Create course (admin)
app.post('/api/courses', requireAdminAuth, async (req, res) => {
    const { title, description, image_url, locale: reqLocale, is_paid, price_display } = req.body;
    const locale = (reqLocale === 'am' || reqLocale === 'en') ? reqLocale : 'en';
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    try {
        const result = await pool.query(
            `INSERT INTO courses (title, description, image_url, updated_at, locale, is_paid, price_display)
             VALUES ($1, $2, $3, NOW(), $4, COALESCE($5, false), $6) RETURNING *`,
            [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null, locale, is_paid === true, (price_display != null && String(price_display).trim()) || null]
        );
        const row = result.rows[0];
        if (row && (typeof row.is_paid === 'undefined')) row.is_paid = false;
        if (row && (typeof row.price_display === 'undefined')) row.price_display = null;
        res.status(201).json(row);
    } catch (error) {
        if (error.message && /column "is_paid" does not exist/i.test(error.message)) {
            const result = await pool.query(
                'INSERT INTO courses (title, description, image_url, updated_at, locale) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
                [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null, locale]
            );
            res.status(201).json({ ...result.rows[0], is_paid: false, price_display: null });
            return;
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/courses/:id - Update course (admin). Placeholders $1..$N built sequentially.
app.put('/api/courses/:id', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    const { title, description, image_url, locale: reqLocale, is_paid, price_display } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    try {
        const updates = ['title = $1', 'description = $2', 'image_url = $3', 'updated_at = NOW()'];
        const params = [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null];
        let idx = 4;
        if (reqLocale === 'am' || reqLocale === 'en') {
            updates.push(`locale = $${idx}`);
            params.push(reqLocale);
            idx++;
        }
        updates.push(`is_paid = $${idx}`, `price_display = $${idx + 1}`);
        params.push(is_paid === true, (price_display != null && String(price_display).trim()) || null);
        idx += 2;
        params.push(id);
        const result = await pool.query(
            `UPDATE courses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        const row = result.rows[0];
        res.json({ ...row, is_paid: row.is_paid === true, price_display: row.price_display || null });
    } catch (error) {
        if (error.message && /column "is_paid" does not exist/i.test(error.message)) {
            const updates = ['title = $1', 'description = $2', 'image_url = $3', 'updated_at = NOW()'];
            const params = [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null];
            let idx = 4;
            if (reqLocale === 'am' || reqLocale === 'en') { updates.push(`locale = $${idx}`); params.push(reqLocale); idx++; }
            params.push(id);
            const result = await pool.query(`UPDATE courses SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
            res.json({ ...result.rows[0], is_paid: false, price_display: null });
            return;
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/courses/:id - Delete course (admin, locale-scoped, with lessons/resources/enrollments cleanup)
app.delete('/api/courses/:id', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const loc = (locale === 'am' || locale === 'en') ? locale : null;
    if (!loc) return res.status(400).json({ error: 'locale query param (am|en) is required' });

    const courseId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Ensure course exists for this locale
        const courseResult = await client.query(
            "SELECT id FROM courses WHERE id = $1 AND COALESCE(locale, 'en') = $2",
            [courseId, loc]
        );
        if (courseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Course not found for this locale' });
        }

        // Delete lesson resources tied to this course
        await client.query(`
            DELETE FROM lesson_resources
            WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)
        `, [courseId]);

        // Delete video progress tied to this course
        await client.query(`
            DELETE FROM video_progress
            WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)
        `, [courseId]);

        // Delete enrollments for this course
        await client.query('DELETE FROM enrollments WHERE course_id = $1', [courseId]);

        // Delete lessons themselves
        await client.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);

        // Finally delete course row
        await client.query("DELETE FROM courses WHERE id = $1 AND COALESCE(locale, 'en') = $2", [courseId, loc]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET /api/courses/:id/lessons - List lessons of a course (admin or for course page), with resources
app.get('/api/courses/:id/lessons', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM lessons WHERE course_id = $1 ORDER BY position ASC, id ASC',
            [req.params.id]
        );
        const lessons = result.rows || [];
        const lessonIds = lessons.map((l) => l.id);
        let resourcesByLesson = {};
        if (lessonIds.length > 0) {
            try {
                const resRows = await pool.query(
                    'SELECT id, lesson_id, title, url, position FROM lesson_resources WHERE lesson_id = ANY($1) ORDER BY lesson_id, position ASC, id ASC',
                    [lessonIds]
                );
                (resRows.rows || []).forEach((r) => {
                    if (!resourcesByLesson[r.lesson_id]) resourcesByLesson[r.lesson_id] = [];
                    resourcesByLesson[r.lesson_id].push({ id: r.id, title: r.title, url: r.url });
                });
            } catch (_) { /* table may not exist yet */ }
        }
        const lessonsWithResources = lessons.map((l) => ({
            ...l,
            resources: resourcesByLesson[l.id] || []
        }));
        res.json({ lessons: lessonsWithResources });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/courses/:id/lessons - Create lesson (admin)
app.post('/api/courses/:id/lessons', requireAdminAuth, async (req, res) => {
    const courseId = req.params.id;
    const { title, description, position, video_type, video_url } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    if (!video_type || !['youtube', 'wistia'].includes(video_type)) return res.status(400).json({ error: 'video_type must be youtube or wistia' });
    if (!video_url || !video_url.trim()) return res.status(400).json({ error: 'video_url required' });
    if (!isValidVideoUrl(video_url.trim(), video_type)) return res.status(400).json({ error: 'video_url must be a valid YouTube or Wistia URL' });
    try {
        const pos = position != null ? parseInt(position, 10) : 0;
        const result = await pool.query(
            'INSERT INTO lessons (course_id, title, description, position, video_type, video_url, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [courseId, title.trim(), description && description.trim() || null, pos, video_type, video_url.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/lessons/:id - Update lesson (admin)
app.put('/api/lessons/:id', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    const { title, description, position, video_type, video_url } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    if (!video_type || !['youtube', 'wistia'].includes(video_type)) return res.status(400).json({ error: 'video_type must be youtube or wistia' });
    if (!video_url || !video_url.trim()) return res.status(400).json({ error: 'video_url required' });
    if (!isValidVideoUrl(video_url.trim(), video_type)) return res.status(400).json({ error: 'video_url must be a valid YouTube or Wistia URL' });
    try {
        const pos = position != null ? parseInt(position, 10) : 0;
        const result = await pool.query(
            'UPDATE lessons SET title = $1, description = $2, position = $3, video_type = $4, video_url = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
            [title.trim(), description && description.trim() || null, pos, video_type, video_url.trim(), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/lessons/:id - Delete lesson (admin)
app.delete('/api/lessons/:id', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM lessons WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lessons/:id/resources - List resources for a lesson (admin)
app.get('/api/lessons/:id/resources', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, lesson_id, title, url, position FROM lesson_resources WHERE lesson_id = $1 ORDER BY position ASC, id ASC',
            [req.params.id]
        );
        res.json({ resources: result.rows || [] });
    } catch (error) {
        if (error.message && /relation "lesson_resources" does not exist/i.test(error.message)) return res.json({ resources: [] });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/lessons/:id/resources - Add resource (title + url) to lesson (admin)
app.post('/api/lessons/:id/resources', requireAdminAuth, async (req, res) => {
    const lessonId = req.params.id;
    const rawTitle = req.body && req.body.title;
    const rawUrl = req.body && req.body.url;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
        const check = await pool.query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });
        const result = await pool.query(
            'INSERT INTO lesson_resources (lesson_id, title, url, position) VALUES ($1, $2, $3, 0) RETURNING id, lesson_id, title, url',
            [lessonId, title, url]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.message && /relation "lesson_resources" does not exist/i.test(error.message)) return res.status(400).json({ error: 'Run migration 015 (lesson_resources)' });
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/lesson-resources/:id - Delete a lesson resource (admin)
app.delete('/api/lesson-resources/:id', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM lesson_resources WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/courses/:courseId/progress - Get user progress for a course (JWT) - for course page
app.get('/api/courses/:courseId/progress', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;
        const result = await pool.query(
            'SELECT lesson_id, completed, watch_time_seconds FROM video_progress WHERE user_id = $1 AND lesson_id IN (SELECT id FROM lessons WHERE course_id = $2)',
            [userId, courseId]
        );
        const progress = {};
        result.rows.forEach(r => { progress[r.lesson_id] = { completed: r.completed, watch_time_seconds: r.watch_time_seconds }; });
        res.json({ progress });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/subscribers/filter - Filter by tags (Segments)
app.get('/api/subscribers/filter', requireAdminAuth, async (req, res) => {
    const { tags, status } = req.query;

    try {
        let query = `
            SELECT DISTINCT s.*, 
                COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) 
                FILTER (WHERE t.id IS NOT NULL), '[]') as tags
            FROM subscribers s
            LEFT JOIN subscriber_tags st ON s.id = st.subscriber_id
            LEFT JOIN tags t ON st.tag_id = t.id
        `;

        const conditions = [];
        const params = [];

        if (tags) {
            const tagIds = tags.split(',').map(Number);
            params.push(tagIds);
            conditions.push(`st.tag_id = ANY($${params.length})`);
        }

        if (status) {
            params.push(status);
            conditions.push(`s.status = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY s.id ORDER BY s.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ total: result.rows.length, subscribers: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/import - Import subscribers from CSV
app.post('/api/import', requireAdminAuth, async (req, res) => {
    const { subscribers } = req.body; // Array of { email, first_name, source }

    if (!subscribers || !Array.isArray(subscribers)) {
        return res.status(400).json({ error: 'subscribers array required' });
    }

    try {
        let imported = 0;
        let skipped = 0;

        for (const sub of subscribers) {
            if (!sub.email || !sub.email.includes('@')) {
                skipped++;
                continue;
            }

            const existing = await pool.query('SELECT id FROM subscribers WHERE email = $1', [sub.email.toLowerCase()]);

            if (existing.rows.length > 0) {
                skipped++;
                continue;
            }

            await pool.query(
                'INSERT INTO subscribers (email, first_name, source, status) VALUES ($1, $2, $3, $4)',
                [sub.email.toLowerCase(), sub.first_name || null, sub.source || 'import', 'active']
            );
            imported++;
        }

        res.json({ success: true, imported, skipped });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/bulk-tag - Add tag to multiple subscribers
app.post('/api/subscribers/bulk-tag', requireAdminAuth, async (req, res) => {
    const { subscriber_ids, tag_id } = req.body;
    if (!Array.isArray(subscriber_ids) || subscriber_ids.length === 0 || !tag_id) {
        return res.status(400).json({ error: 'subscriber_ids (array) and tag_id required' });
    }
    try {
        let count = 0;
        for (const id of subscriber_ids) {
            await pool.query('INSERT INTO subscriber_tags (subscriber_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tag_id]);
            count++;
        }
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/bulk-remove-tag - Remove tag from multiple subscribers
app.post('/api/subscribers/bulk-remove-tag', requireAdminAuth, async (req, res) => {
    const { subscriber_ids, tag_id } = req.body;
    if (!Array.isArray(subscriber_ids) || subscriber_ids.length === 0 || !tag_id) {
        return res.status(400).json({ error: 'subscriber_ids (array) and tag_id required' });
    }
    try {
        await pool.query('DELETE FROM subscriber_tags WHERE subscriber_id = ANY($1::int[]) AND tag_id = $2', [subscriber_ids, tag_id]);
        res.json({ success: true, count: subscriber_ids.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/bulk-sequence - Add multiple subscribers to a sequence
app.post('/api/subscribers/bulk-sequence', requireAdminAuth, async (req, res) => {
    const { subscriber_ids, sequence_id } = req.body;
    if (!Array.isArray(subscriber_ids) || subscriber_ids.length === 0 || !sequence_id) {
        return res.status(400).json({ error: 'subscriber_ids (array) and sequence_id required' });
    }
    try {
        const firstEmail = await pool.query('SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 ORDER BY position LIMIT 1', [sequence_id]);
        const delay_days = firstEmail.rows[0] ? (firstEmail.rows[0].delay_days || 0) : 0;
        const delay_hours = firstEmail.rows[0] ? (firstEmail.rows[0].delay_hours || 0) : 0;
        let count = 0;
        for (const id of subscriber_ids) {
            const existing = await pool.query('SELECT id FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2', [id, sequence_id]);
            if (existing.rows.length === 0) {
                await pool.query(
                    `INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at)
                     VALUES (
                        $1,
                        $2,
                        0,
                        CASE
                            WHEN $3 = 0 AND $4 = 0
                                THEN NOW() - INTERVAL '1 minute'
                            ELSE NOW() + ($3 * INTERVAL '1 day') + ($4 * INTERVAL '1 hour')
                        END
                     )`,
                    [id, sequence_id, delay_days, delay_hours]
                );
                count++;
            }
        }
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/bulk-unsubscribe - Unsubscribe multiple subscribers
app.post('/api/subscribers/bulk-unsubscribe', requireAdminAuth, async (req, res) => {
    const { subscriber_ids } = req.body;
    if (!Array.isArray(subscriber_ids) || subscriber_ids.length === 0) {
        return res.status(400).json({ error: 'subscriber_ids (array) required' });
    }
    try {
        await pool.query("UPDATE subscribers SET status = 'unsubscribed' WHERE id = ANY($1::int[])", [subscriber_ids]);
        res.json({ success: true, count: subscriber_ids.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/subscriber-sequences - List sequences for a subscriber (admin)
app.get('/api/subscriber-sequences', requireAdminAuth, async (req, res) => {
    const subscriberId = parseInt(req.query.subscriber_id, 10);
    if (!subscriberId) {
        return res.status(400).json({ error: 'subscriber_id required' });
    }
    try {
        const result = await pool.query(
            `SELECT ss.id,
                    ss.sequence_id,
                    ss.status,
                    ss.current_step,
                    ss.next_email_at,
                    ss.started_at,
                    seq.name,
                    COALESCE(seq.locale, 'en') as locale,
                    COALESCE(seq.kind, '') as kind
             FROM subscriber_sequences ss
             JOIN sequences seq ON seq.id = ss.sequence_id
             WHERE ss.subscriber_id = $1
             ORDER BY ss.started_at DESC, ss.id DESC`,
            [subscriberId]
        );
        res.json({ sequences: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/:id/sequences/:seqId/unsubscribe - Stop one sequence for a subscriber (admin)
app.post('/api/subscribers/:id/sequences/:seqId/unsubscribe', requireAdminAuth, async (req, res) => {
    const subscriberId = parseInt(req.params.id, 10);
    const sequenceId = parseInt(req.params.seqId, 10);
    if (!subscriberId || !sequenceId) {
        return res.status(400).json({ error: 'Invalid subscriber or sequence id' });
    }
    try {
        const result = await pool.query(
            "UPDATE subscriber_sequences SET status = 'unsubscribed' WHERE subscriber_id = $1 AND sequence_id = $2 AND status = 'active' RETURNING id",
            [subscriberId, sequenceId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Active subscription for this sequence not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/subscribers/:id - Update subscriber
app.put('/api/subscribers/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { first_name, status, custom_fields } = req.body;

    try {
        const updates = [];
        const params = [];

        if (first_name !== undefined) {
            params.push(first_name);
            updates.push(`first_name = $${params.length}`);
        }
        if (status !== undefined) {
            params.push(status);
            updates.push(`status = $${params.length}`);
        }
        if (custom_fields !== undefined) {
            params.push(JSON.stringify(custom_fields));
            updates.push(`custom_fields = $${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);
        const query = `UPDATE subscribers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`;

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TAGS ====================

// GET /api/tags - List all tags; optional ?locale=am|en
app.get('/api/tags', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    try {
        const result = await pool.query(
            'SELECT * FROM tags ' + localeFilter + ' ORDER BY name',
            params
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/tags - Create tag (body: name, color, locale?)
app.post('/api/tags', requireAdminAuth, async (req, res) => {
    const { name, color, locale: reqLocale } = req.body;
    const locale = (reqLocale === 'am' || reqLocale === 'en') ? reqLocale : 'en';

    try {
        const result = await pool.query(
            'INSERT INTO tags (name, color, locale) VALUES ($1, $2, $3) RETURNING *',
            [name, color || '#39FF14', locale]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tags/:id - Update tag (name, color)
app.put('/api/tags/:id', requireAdminAuth, async (req, res) => {
    const { name, color } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name) { params.push(name); updates.push('name = $' + params.length); }
        if (color) { params.push(color); updates.push('color = $' + params.length); }
        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
        params.push(req.params.id);
        const result = await pool.query(
            'UPDATE tags SET ' + updates.join(', ') + ' WHERE id = $' + params.length + ' RETURNING *',
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tags/:id - Update tag (name, color)
app.put('/api/tags/:id', requireAdminAuth, async (req, res) => {
    const { name, color } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name) { params.push(name); updates.push('name = $' + params.length); }
        if (color) { params.push(color); updates.push('color = $' + params.length); }
        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
        params.push(req.params.id);
        const result = await pool.query(
            'UPDATE tags SET ' + updates.join(', ') + ' WHERE id = $' + params.length + ' RETURNING *',
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/tags/:id - Delete tag (locale-scoped)
app.delete('/api/tags/:id', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const loc = (locale === 'am' || locale === 'en') ? locale : null;
    if (!loc) return res.status(400).json({ error: 'locale query param (am|en) is required' });

    try {
        // Remove any subscriber/tag links first (defensive; tables may or may not exist)
        try {
            await pool.query('DELETE FROM subscriber_tags WHERE tag_id = $1', [req.params.id]);
        } catch (_) { /* table may not exist yet */ }

        const result = await pool.query(
            "DELETE FROM tags WHERE id = $1 AND COALESCE(locale, 'en') = $2 RETURNING id",
            [req.params.id, loc]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found for this locale' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATES ====================

// GET /api/templates - List templates; optional ?locale=am|en
app.get('/api/templates', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    try {
        const result = await pool.query(
            'SELECT * FROM templates ' + localeFilter + ' ORDER BY created_at DESC',
            params
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/templates - Create template (body: name, subject, body, locale?)
app.post('/api/templates', requireAdminAuth, async (req, res) => {
    const { name, subject, body, locale: reqLocale } = req.body;
    const locale = (reqLocale === 'am' || reqLocale === 'en') ? reqLocale : 'en';

    try {
        const result = await pool.query(
            'INSERT INTO templates (name, subject, body, locale) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, subject, body, locale]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/templates/:id - Update template (name, subject, body, locale?)
app.put('/api/templates/:id', requireAdminAuth, async (req, res) => {
    const { name, subject, body, locale: reqLocale } = req.body;

    try {
        const updates = ['name = $1', 'subject = $2', 'body = $3', 'updated_at = NOW()'];
        const params = [name, subject, body];
        if (reqLocale === 'am' || reqLocale === 'en') {
            params.push(reqLocale);
            updates.push('locale = $' + params.length);
        }
        params.push(req.params.id);
        const result = await pool.query(
            'UPDATE templates SET ' + updates.join(', ') + ' WHERE id = $' + params.length + ' RETURNING *',
            params
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/templates/:id - Delete template (locale-scoped)
app.delete('/api/templates/:id', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const loc = (locale === 'am' || locale === 'en') ? locale : null;
    if (!loc) return res.status(400).json({ error: 'locale query param (am|en) is required' });

    try {
        const result = await pool.query(
            "DELETE FROM templates WHERE id = $1 AND COALESCE(locale, 'en') = $2 RETURNING id",
            [req.params.id, loc]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found for this locale' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BROADCASTS ====================

// GET /api/broadcasts - List all broadcasts; optional ?locale=am|en
app.get('/api/broadcasts', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    try {
        const result = await pool.query(
            'SELECT * FROM broadcasts ' + localeFilter + ' ORDER BY created_at DESC',
            params
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/broadcasts - Create broadcast (body includes locale?)
app.post('/api/broadcasts', requireAdminAuth, async (req, res) => {
    const { name, subject, body, subject_am, body_am, subject_en, body_en, segment_locale, attachments, locale: reqLocale } = req.body;
    const locale = (reqLocale === 'am' || reqLocale === 'en') ? reqLocale : 'en';

    try {
        const attachmentsJson = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';
        let result;
        try {
            result = await pool.query(
                `INSERT INTO broadcasts (name, subject, body, subject_am, body_am, subject_en, body_en, segment_locale, attachments, locale)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING *`,
                [name || null, subject || '', body || '', subject_am || null, body_am || null, subject_en || null, body_en || null, segment_locale || null, attachmentsJson, locale]
            );
        } catch (colErr) {
            if (/column "attachments" does not exist/i.test(colErr.message)) {
                result = await pool.query(
                    `INSERT INTO broadcasts (name, subject, body, subject_am, body_am, subject_en, body_en, segment_locale, locale)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                    [name || null, subject || '', body || '', subject_am || null, body_am || null, subject_en || null, body_en || null, segment_locale || null, locale]
                );
            } else if (/column "locale" does not exist/i.test(colErr.message)) {
                result = await pool.query(
                    `INSERT INTO broadcasts (name, subject, body, subject_am, body_am, subject_en, body_en, segment_locale, attachments)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING *`,
                    [name || null, subject || '', body || '', subject_am || null, body_am || null, subject_en || null, body_en || null, segment_locale || null, attachmentsJson]
                );
            } else throw colErr;
        }
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get subscribers for a broadcast (all active or by segment tags; optional segment_locale filter)
async function getBroadcastSubscribers(broadcast) {
    const segmentType = broadcast.segment_type || 'all';
    const tagIds = broadcast.segment_tag_ids && Array.isArray(broadcast.segment_tag_ids) ? broadcast.segment_tag_ids : [];
    const segmentLocale = broadcast.segment_locale === 'am' || broadcast.segment_locale === 'en' ? broadcast.segment_locale : null;
    const localeCondition = segmentLocale ? " AND COALESCE(s.locale, 'en') = $" + (tagIds.length > 0 ? "2" : "1") : "";
    const localeParam = segmentLocale ? [segmentLocale] : [];
    if (segmentType === 'tags' && tagIds.length > 0) {
        const result = await pool.query(`
            SELECT DISTINCT s.* FROM subscribers s
            INNER JOIN subscriber_tags st ON s.id = st.subscriber_id
            WHERE s.status = 'active' AND st.tag_id = ANY($1::int[]) ${localeCondition}
        `, segmentLocale ? [tagIds, segmentLocale] : [tagIds]);
        return result.rows;
    }
    const result = await pool.query(
        "SELECT * FROM subscribers WHERE status = 'active'" + (segmentLocale ? " AND COALESCE(locale, 'en') = $1" : ""),
        segmentLocale ? [segmentLocale] : []
    );
    return result.rows;
}

// Run broadcast send (used by POST handler and by job worker). Returns { sentCount, failedCount, useAbTest } or throws.
// Only broadcasts with status 'draft' or 'scheduled' can be sent; after send, status becomes 'sent'.
async function runBroadcastSend(broadcastId, options = {}) {
    const { ab_test, subject_b } = options;
    const id = broadcastId;
    const broadcast = await pool.query('SELECT * FROM broadcasts WHERE id = $1', [id]);
    if (broadcast.rows.length === 0) throw new Error('Broadcast not found');
    const b = broadcast.rows[0];
    if (b.status === 'sent') {
        throw new Error('Broadcast already sent. Only draft or scheduled broadcasts can be sent.');
    }
    if (b.status !== 'draft' && b.status !== 'scheduled') {
        throw new Error('Broadcast can only be sent when status is draft or scheduled.');
    }
    if (ab_test && subject_b) {
        await pool.query(
            'UPDATE broadcasts SET subject_b = $1, ab_test_ends_at = NOW() + INTERVAL \'24 hours\', ab_test_winner = NULL WHERE id = $2',
            [subject_b, id]
        );
    }
    const subscribers = await getBroadcastSubscribers(b);
    let toSend = subscribers;
    const useAbTest = ab_test && subject_b && toSend.length > 0;
    if (useAbTest) {
        const shuffled = [...toSend].sort(() => Math.random() - 0.5);
        const twentyPct = Math.max(2, Math.ceil(shuffled.length * 0.2));
        toSend = shuffled.slice(0, twentyPct);
    }
    let sentCount = 0;
    let failedCount = 0;
    for (let i = 0; i < toSend.length; i++) {
        const sub = toSend[i];
        const subLocale = sub.locale === 'am' ? 'am' : 'en';
        const content = pickContentByLocale(b, subLocale);
        const useSubjectB = useAbTest && i >= Math.floor(toSend.length / 2);
        const subjectToUse = useSubjectB && b.subject_b ? b.subject_b : content.subject;
        try {
            const subj = replaceMergeTags(subjectToUse, sub);
            const bodyPersonal = replaceMergeTags(content.body, sub);
            const logResult = await pool.query(
                'INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [sub.id, 'broadcast', id, subj, 'sending']
            );
            const logId = logResult.rows[0].id;
            const mailOpts = {
                from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                to: sub.email,
                subject: subj,
                html: wrapEmailTemplate(bodyPersonal, logId)
            };
            const attachList = Array.isArray(b.attachments) ? b.attachments : (typeof b.attachments === 'string' ? (() => { try { return JSON.parse(b.attachments); } catch (_) { return []; } })() : []);
            if (attachList.length > 0) {
                mailOpts.attachments = attachList.map((a) => {
                    const fullPath = path.isAbsolute(a.path) ? a.path : path.join(__dirname, a.path);
                    return fs.existsSync(fullPath) ? { filename: a.filename || path.basename(a.path), path: fullPath } : null;
                }).filter(Boolean);
            }
            await transporter.sendMail(mailOpts);
            await pool.query("UPDATE email_log SET status = 'sent' WHERE id = $1", [logId]);
            sentCount++;
            await throttleAfterSend();
        } catch (e) {
            failedCount++;
        }
    }
    await pool.query(
        "UPDATE broadcasts SET status = 'sent', sent_at = NOW(), sent_count = $1, failed_count = $2 WHERE id = $3",
        [sentCount, failedCount, id]
    );
    return { sentCount, failedCount, useAbTest };
}

// POST /api/broadcasts/:id/send - Send broadcast now. Body: optional { ab_test, subject_b, use_queue: true } to enqueue instead of send inline
app.post('/api/broadcasts/:id/send', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { ab_test, subject_b, use_queue } = req.body || {};

    try {
        if (use_queue) {
            try {
                const job = await pool.query(
                    'INSERT INTO email_send_jobs (job_type, reference_id, status, payload) VALUES ($1, $2, $3, $4) RETURNING id',
                    ['broadcast', id, 'pending', JSON.stringify({ ab_test: !!ab_test, subject_b: subject_b || null })]
                );
                return res.json({ success: true, jobId: job.rows[0].id, message: 'Broadcast queued for sending' });
            } catch (e) {
                if (/relation "email_send_jobs" does not exist/i.test(e.message)) {
                    return res.status(501).json({ error: 'Job queue not available. Run migration 022_email_send_jobs.sql' });
                }
                throw e;
            }
        }
        const result = await runBroadcastSend(id, { ab_test, subject_b });
        res.json({ success: true, sentCount: result.sentCount, failedCount: result.failedCount, abTest: result.useAbTest ? '20% sent; remainder in 24h' : null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Convert "YYYY-MM-DDTHH:mm" in given timezone to UTC ISO string
function scheduledAtInTzToUtc(scheduledAt, timezone) {
    const s = String(scheduledAt).trim().replace(' ', 'T');
    const [datePart, timePart] = s.split('T');
    const [y, m, d] = (datePart || '').split('-').map(Number);
    const [h, min] = (timePart || '00:00').split(':').map(Number);
    const refUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0));
    const inTz = refUtc.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const inUtc = refUtc.toLocaleString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
    const [tzh, tzm] = inTz.split(':').map(Number);
    const [uzh, uzm] = inUtc.split(':').map(Number);
    const offsetMins = (tzh * 60 + tzm) - (uzh * 60 + uzm);
    const utcDate = new Date(refUtc.getTime() - offsetMins * 60 * 1000);
    return utcDate.toISOString();
}

// POST /api/broadcasts/:id/schedule - Schedule broadcast. Body: scheduled_at (YYYY-MM-DDTHH:mm), timezone (e.g. Europe/Yerevan)
app.post('/api/broadcasts/:id/schedule', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    let { scheduled_at, timezone } = req.body;
    timezone = timezone || 'UTC';

    try {
        let scheduledAtUtc = scheduled_at;
        if (scheduled_at && timezone !== 'UTC') {
            try {
                scheduledAtUtc = scheduledAtInTzToUtc(scheduled_at, timezone);
            } catch (e) {
                const parsed = new Date(scheduled_at);
                scheduledAtUtc = isNaN(parsed.getTime()) ? scheduled_at : parsed.toISOString();
            }
        } else if (scheduled_at) {
            const parsed = new Date(scheduled_at);
            scheduledAtUtc = isNaN(parsed.getTime()) ? scheduled_at : parsed.toISOString();
        }
        await pool.query(
            "UPDATE broadcasts SET status = 'scheduled', scheduled_at = $1 WHERE id = $2",
            [scheduledAtUtc, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/broadcasts/:id - Update broadcast (name, subject, body, segment_type, segment_tag_ids, locale fields, attachments, locale)
app.put('/api/broadcasts/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { name, subject, body, segment_type, segment_tag_ids, subject_am, body_am, subject_en, body_en, segment_locale, attachments } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name !== undefined) { params.push(name); updates.push('name = $' + params.length); }
        if (subject !== undefined) { params.push(subject); updates.push('subject = $' + params.length); }
        if (body !== undefined) { params.push(body); updates.push('body = $' + params.length); }
        if (segment_type !== undefined) { params.push(segment_type); updates.push('segment_type = $' + params.length); }
        if (segment_tag_ids !== undefined) { params.push(JSON.stringify(segment_tag_ids)); updates.push('segment_tag_ids = $' + params.length); }
        if (subject_am !== undefined) { params.push(subject_am); updates.push('subject_am = $' + params.length); }
        if (body_am !== undefined) { params.push(body_am); updates.push('body_am = $' + params.length); }
        if (subject_en !== undefined) { params.push(subject_en); updates.push('subject_en = $' + params.length); }
        if (body_en !== undefined) { params.push(body_en); updates.push('body_en = $' + params.length); }
        if (segment_locale !== undefined) { params.push(segment_locale); updates.push('segment_locale = $' + params.length); }
        if (attachments !== undefined) { params.push(Array.isArray(attachments) ? JSON.stringify(attachments) : '[]'); updates.push('attachments = $' + params.length + '::jsonb'); }
        if (req.body.locale === 'am' || req.body.locale === 'en') { params.push(req.body.locale); updates.push('locale = $' + params.length); }
        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
        params.push(id);
        const result = await pool.query(
            `UPDATE broadcasts SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Broadcast not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/broadcasts/:id/test-send - Send test email (body: { email? }). Uses ADMIN_EMAIL if email not provided.
app.post('/api/broadcasts/:id/test-send', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    const to = email && email.includes('@') ? email : (process.env.ADMIN_EMAIL || '').split(',')[0].trim();
    if (!to) return res.status(400).json({ error: 'No email provided and ADMIN_EMAIL not set' });
    try {
        const broadcast = await pool.query('SELECT * FROM broadcasts WHERE id = $1', [id]);
        if (broadcast.rows.length === 0) return res.status(404).json({ error: 'Broadcast not found' });
        const b = broadcast.rows[0];
        const testSub = { email: to, first_name: 'Test' };
        const subj = replaceMergeTags(b.subject, testSub);
        const bodyPersonal = replaceMergeTags(b.body, testSub);
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
            to,
            subject: `[Test] ${subj}`,
            html: wrapEmailTemplate(bodyPersonal)
        });
        res.json({ success: true, message: `Test sent to ${to}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/broadcasts/:id/analytics - Per-broadcast stats (sent, opened, clicked)
app.get('/api/broadcasts/:id/analytics', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    try {
        const r = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'clicked')) as sent,
                COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) as opened,
                COUNT(*) FILTER (WHERE status = 'clicked') as clicked
            FROM email_log WHERE email_type = 'broadcast' AND reference_id = $1
        `, [id]);
        const row = r.rows[0];
        const sent = parseInt(row.sent, 10) || 0;
        const opened = parseInt(row.opened, 10) || 0;
        const clicked = parseInt(row.clicked, 10) || 0;
        res.json({
            sent,
            opened,
            clicked,
            openRate: sent > 0 ? (opened / sent * 100).toFixed(1) : 0,
            clickRate: opened > 0 ? (clicked / opened * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/broadcasts/:id - Delete broadcast (locale-scoped)
app.delete('/api/broadcasts/:id', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const loc = (locale === 'am' || locale === 'en') ? locale : null;
    if (!loc) return res.status(400).json({ error: 'locale query param (am|en) is required' });

    try {
        // Clean up any outstanding send jobs that reference this broadcast
        try {
            await pool.query('DELETE FROM email_send_jobs WHERE broadcast_id = $1', [req.params.id]);
        } catch (_) { /* table may not exist yet */ }

        const result = await pool.query(
            "DELETE FROM broadcasts WHERE id = $1 AND COALESCE(locale, 'en') = $2 RETURNING id",
            [req.params.id, loc]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Broadcast not found for this locale' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SEQUENCES ====================

// GET /api/sequence-triggers - List triggers (when tag added -> add to sequence)
app.get('/api/sequence-triggers', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT st.*, t.name as tag_name, t.color as tag_color, s.name as sequence_name
            FROM sequence_triggers st
            JOIN tags t ON st.tag_id = t.id
            JOIN sequences s ON st.sequence_id = s.id
            ORDER BY st.id
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequence-triggers - Create trigger (when tag_id added, add subscriber to sequence_id)
app.post('/api/sequence-triggers', requireAdminAuth, async (req, res) => {
    const { tag_id, sequence_id } = req.body;
    if (!tag_id || !sequence_id) return res.status(400).json({ error: 'tag_id and sequence_id required' });
    try {
        const result = await pool.query(
            'INSERT INTO sequence_triggers (tag_id, sequence_id) VALUES ($1, $2) ON CONFLICT (tag_id, sequence_id) DO NOTHING RETURNING *',
            [tag_id, sequence_id]
        );
        if (result.rows.length === 0) return res.json({ success: true, message: 'Already exists' });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/sequence-triggers/:id - Remove trigger
app.delete('/api/sequence-triggers/:id', requireAdminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM sequence_triggers WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sequences - List sequences; optional ?locale=am|en
app.get('/api/sequences', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE s.locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    try {
        const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM sequence_emails WHERE sequence_id = s.id) as email_count,
        (SELECT COUNT(*) FROM subscriber_sequences WHERE sequence_id = s.id) as subscriber_count
      FROM sequences s ${localeFilter} ORDER BY s.created_at DESC
    `, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences - Create sequence (body: name, locale?)
app.post('/api/sequences', requireAdminAuth, async (req, res) => {
    const { name, locale: reqLocale } = req.body;
    const locale = (reqLocale === 'am' || reqLocale === 'en') ? reqLocale : 'en';

    try {
        const result = await pool.query('INSERT INTO sequences (name, locale) VALUES ($1, $2) RETURNING *', [name, locale]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sequences/:id/emails - Get emails in sequence (with per-step stats)
app.get('/api/sequences/:id/emails', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM sequence_emails WHERE sequence_id = $1 ORDER BY position',
            [req.params.id]
        );
        const emails = result.rows;
        // Attach per-step analytics
        if (emails.length > 0) {
            try {
                const ids = emails.map(e => e.id);
                const statsResult = await pool.query(`
                    SELECT reference_id,
                        COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked')) as sent,
                        COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opened,
                        COUNT(*) FILTER (WHERE status = 'clicked') as clicked
                    FROM email_log WHERE email_type = 'sequence' AND reference_id = ANY($1::int[])
                    GROUP BY reference_id
                `, [ids]);
                const statsMap = {};
                for (const r of statsResult.rows) {
                    statsMap[r.reference_id] = { sent: parseInt(r.sent) || 0, opened: parseInt(r.opened) || 0, clicked: parseInt(r.clicked) || 0 };
                }
                for (const e of emails) {
                    e.stats = statsMap[e.id] || { sent: 0, opened: 0, clicked: 0 };
                }
            } catch (_) { /* stats columns may not exist yet */ }
        }
        res.json(emails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences/:id/emails - Add email to sequence
app.post('/api/sequences/:id/emails', requireAdminAuth, async (req, res) => {
    const { subject, body, delay_days, delay_hours, subject_am, body_am, subject_en, body_en, conditions, attachments } = req.body;

    try {
        const posResult = await pool.query(
            'SELECT COALESCE(MAX(position), 0) + 1 as next FROM sequence_emails WHERE sequence_id = $1',
            [req.params.id]
        );
        const conditionsJson = conditions != null ? JSON.stringify(conditions) : null;
        const attachmentsJson = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';
        const result = await pool.query(
            `INSERT INTO sequence_emails (sequence_id, position, subject, body, delay_days, delay_hours, subject_am, body_am, subject_en, body_en, conditions, attachments)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb) RETURNING *`,
            [req.params.id, posResult.rows[0].next, subject || '', body || '', delay_days || 0, delay_hours || 0, subject_am || null, body_am || null, subject_en || null, body_en || null, conditionsJson, attachmentsJson]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/sequences/:seqId/emails/:emailId - Update one sequence email
app.put('/api/sequences/:seqId/emails/:emailId', requireAdminAuth, async (req, res) => {
    const seqId = req.params.seqId;
    const emailId = req.params.emailId;
    const { subject, body, delay_days, delay_hours, subject_am, body_am, subject_en, body_en, conditions, attachments } = req.body;

    try {
        const updates = [
            'subject = COALESCE($1, subject)',
            'body = COALESCE($2, body)',
            'delay_days = COALESCE($3, delay_days)',
            'delay_hours = COALESCE($4, delay_hours)'
        ];
        const params = [subject, body, delay_days != null ? delay_days : null, delay_hours != null ? delay_hours : null];
        let idx = 5;
        if (subject_am !== undefined) { updates.push(`subject_am = $${idx}`); params.push(subject_am); idx++; }
        if (body_am !== undefined) { updates.push(`body_am = $${idx}`); params.push(body_am); idx++; }
        if (subject_en !== undefined) { updates.push(`subject_en = $${idx}`); params.push(subject_en); idx++; }
        if (body_en !== undefined) { updates.push(`body_en = $${idx}`); params.push(body_en); idx++; }
        if (conditions !== undefined) { updates.push(`conditions = $${idx}`); params.push(conditions && typeof conditions === 'object' ? JSON.stringify(conditions) : conditions); idx++; }
        if (attachments !== undefined) { updates.push(`attachments = $${idx}::jsonb`); params.push(Array.isArray(attachments) ? JSON.stringify(attachments) : '[]'); idx++; }
        params.push(emailId, seqId);
        const n = params.length;
        const result = await pool.query(
            `UPDATE sequence_emails SET ${updates.join(', ')} WHERE id = $${n - 1} AND sequence_id = $${n} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Sequence email not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/sequences/:seqId/emails/:emailId - Delete one sequence email
app.delete('/api/sequences/:seqId/emails/:emailId', requireAdminAuth, async (req, res) => {
    const seqId = req.params.seqId;
    const emailId = req.params.emailId;

    try {
        const result = await pool.query('DELETE FROM sequence_emails WHERE id = $1 AND sequence_id = $2 RETURNING id', [emailId, seqId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Sequence email not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/sequences/:id/emails/reorder - Reorder steps. Body: { orderedIds: number[] }
app.put('/api/sequences/:id/emails/reorder', requireAdminAuth, async (req, res) => {
    const seqId = req.params.id;
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: 'orderedIds array required' });
    }
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await pool.query('UPDATE sequence_emails SET position = $1 WHERE id = $2 AND sequence_id = $3', [i + 1, orderedIds[i], seqId]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/sequences/:id - Update sequence (name, status, locale?)
app.put('/api/sequences/:id', requireAdminAuth, async (req, res) => {
    const { name, status, locale: reqLocale } = req.body;

    try {
        const updates = [];
        const params = [];

        if (name) {
            params.push(name);
            updates.push(`name = $${params.length}`);
        }
        if (status) {
            params.push(status);
            updates.push(`status = $${params.length}`);
        }
        if (reqLocale === 'am' || reqLocale === 'en') {
            params.push(reqLocale);
            updates.push(`locale = $${params.length}`);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE sequences SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sequences/:id/analytics - Per-sequence stats (aggregate over all steps)
app.get('/api/sequences/:id/analytics', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    try {
        const refs = await pool.query('SELECT id FROM sequence_emails WHERE sequence_id = $1', [id]);
        const refIds = refs.rows.map(r => r.id);
        if (refIds.length === 0) {
            return res.json({ sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 });
        }
        const r = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'clicked')) as sent,
                COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) as opened,
                COUNT(*) FILTER (WHERE status = 'clicked') as clicked
            FROM email_log WHERE email_type = 'sequence' AND reference_id = ANY($1::int[])
        `, [refIds]);
        const row = r.rows[0];
        const sent = parseInt(row.sent, 10) || 0;
        const opened = parseInt(row.opened, 10) || 0;
        const clicked = parseInt(row.clicked, 10) || 0;
        res.json({
            sent,
            opened,
            clicked,
            openRate: sent > 0 ? (opened / sent * 100).toFixed(1) : 0,
            clickRate: opened > 0 ? (clicked / opened * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sequences/:id/emails/:emailId/analytics - Per-step analytics
app.get('/api/sequences/:id/emails/:emailId/analytics', requireAdminAuth, async (req, res) => {
    const emailId = req.params.emailId;
    try {
        const r = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'clicked')) as sent,
                COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) as opened,
                COUNT(*) FILTER (WHERE status = 'clicked') as clicked
            FROM email_log WHERE email_type = 'sequence' AND reference_id = $1
        `, [emailId]);
        const row = r.rows[0];
        const sent = parseInt(row.sent, 10) || 0;
        const opened = parseInt(row.opened, 10) || 0;
        const clicked = parseInt(row.clicked, 10) || 0;
        res.json({
            sent, opened, clicked,
            openRate: sent > 0 ? (opened / sent * 100).toFixed(1) : '0',
            clickRate: opened > 0 ? (clicked / opened * 100).toFixed(1) : '0'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences/:id/activate - Activate sequence
app.post('/api/sequences/:id/activate', requireAdminAuth, async (req, res) => {
    try {
        await pool.query("UPDATE sequences SET status = 'active' WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences/:id/pause - Pause sequence
app.post('/api/sequences/:id/pause', requireAdminAuth, async (req, res) => {
    try {
        await pool.query("UPDATE sequences SET status = 'paused' WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/sequences/:id - Delete sequence (locale-scoped, with steps and subscriber progress)
app.delete('/api/sequences/:id', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const loc = (locale === 'am' || locale === 'en') ? locale : null;
    if (!loc) return res.status(400).json({ error: 'locale query param (am|en) is required' });

    const seqId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Ensure sequence exists for this locale
        const seqResult = await client.query(
            "SELECT id FROM sequences WHERE id = $1 AND COALESCE(locale, 'en') = $2",
            [seqId, loc]
        );
        if (seqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sequence not found for this locale' });
        }

        // Delete dependent data first
        await client.query('DELETE FROM subscriber_sequences WHERE sequence_id = $1', [seqId]);
        await client.query('DELETE FROM sequence_emails WHERE sequence_id = $1', [seqId]);
        
        // Delete sequence triggers (table may not exist in older databases)
        try {
            await client.query('DELETE FROM sequence_triggers WHERE sequence_id = $1', [seqId]);
        } catch (err) {
            if (err.code !== '42P01') { // 42P01 = undefined_table
                throw err; // Re-throw if it's not a missing table error
            }
            // Table doesn't exist, that's fine - continue
            console.log('sequence_triggers table not found, skipping...');
        }

        // Finally delete sequence
        const deleteResult = await client.query("DELETE FROM sequences WHERE id = $1 AND COALESCE(locale, 'en') = $2 RETURNING id", [seqId, loc]);
        
        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sequence not found or already deleted' });
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DELETE sequence error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// GET /api/sequences/:id/subscribers - List subscribers in a sequence with their progress
app.get('/api/sequences/:id/subscribers', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ss.id as ss_id, ss.current_step, ss.status as seq_status, ss.next_email_at, ss.started_at,
                   s.id, s.email, COALESCE(s.first_name, '') as first_name
            FROM subscriber_sequences ss
            INNER JOIN subscribers s ON s.id = ss.subscriber_id
            WHERE ss.sequence_id = $1
            ORDER BY ss.started_at DESC
        `, [req.params.id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/subscribers/:id/sequences/:seqId - Add subscriber to sequence
app.post('/api/subscribers/:id/sequences/:seqId', requireAdminAuth, async (req, res) => {
    const { id, seqId } = req.params;

    try {
        // Check if already in sequence
        const existing = await pool.query(
            'SELECT id FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2',
            [id, seqId]
        );

        if (existing.rows.length > 0) {
            return res.json({ success: true, message: 'Already in sequence' });
        }

        // Get first email's delay (0,0 = send as soon as scheduler runs)
        const firstEmail = await pool.query(
            'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 ORDER BY position LIMIT 1',
            [seqId]
        );

        const delay_days = firstEmail.rows[0] ? (firstEmail.rows[0].delay_days || 0) : 0;
        const delay_hours = firstEmail.rows[0] ? (firstEmail.rows[0].delay_hours || 0) : 0;

        await pool.query(
            `INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at)
             VALUES (
                $1,
                $2,
                0,
                CASE
                    WHEN $3 = 0 AND $4 = 0
                        THEN NOW() - INTERVAL '1 minute'
                    ELSE NOW() + ($3 * INTERVAL '1 day') + ($4 * INTERVAL '1 hour')
                END
             )`,
            [id, seqId, delay_days, delay_hours]
        );

        // Trigger sequence processor soon so 0-delay first email goes out within seconds
        setTimeout(() => { processSequenceEmails().catch(() => {}); }, 3000);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/subscribers/:id/sequences/:seqId - Remove subscriber from sequence
app.delete('/api/subscribers/:id/sequences/:seqId', requireAdminAuth, async (req, res) => {
    const { id, seqId } = req.params;

    try {
        await pool.query(
            'DELETE FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2',
            [id, seqId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/subscriber-sequences - Get all active subscriber sequences (for debugging)
app.get('/api/subscriber-sequences', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ss.*, s.email, seq.name as sequence_name
            FROM subscriber_sequences ss
            JOIN subscribers s ON ss.subscriber_id = s.id
            JOIN sequences seq ON ss.sequence_id = seq.id
            ORDER BY ss.next_email_at
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATS ====================

// GET /api/stats - Get dashboard stats; optional ?locale=am|en to filter by audience
app.get('/api/stats', requireAdminAuth, async (req, res) => {
    const { locale } = req.query;
    const localeFilter = (locale === 'am' || locale === 'en') ? 'WHERE locale = $1' : '';
    const params = (locale === 'am' || locale === 'en') ? [locale] : [];
    const runStats = async () => {
        const total = await pool.query('SELECT COUNT(*) FROM subscribers ' + localeFilter, params);
        const today = await pool.query("SELECT COUNT(*) FROM subscribers WHERE created_at >= CURRENT_DATE" + (localeFilter ? ' AND locale = $1' : ''), params);
        const thisWeek = await pool.query("SELECT COUNT(*) FROM subscribers WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'" + (localeFilter ? ' AND locale = $1' : ''), params);
        const emailsSent = await pool.query('SELECT COUNT(*) FROM email_log');
        // Open / click rates
        let openRate = 0, clickRate = 0;
        try {
            const rateRow = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked')) as sent,
                    COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opened,
                    COUNT(*) FILTER (WHERE status = 'clicked') as clicked
                FROM email_log
            `);
            const s = parseInt(rateRow.rows[0].sent) || 0;
            const o = parseInt(rateRow.rows[0].opened) || 0;
            const c = parseInt(rateRow.rows[0].clicked) || 0;
            openRate = s > 0 ? Math.round(o / s * 1000) / 10 : 0;
            clickRate = s > 0 ? Math.round(c / s * 1000) / 10 : 0;
        } catch (_) {}
        return { total, today, thisWeek, emailsSent, openRate, clickRate };
    };
    try {
        const { total, today, thisWeek, emailsSent, openRate, clickRate } = await runStats();
        res.json({
            total: parseInt(total.rows[0].count),
            today: parseInt(today.rows[0].count),
            thisWeek: parseInt(thisWeek.rows[0].count),
            emailsSent: parseInt(emailsSent.rows[0].count),
            openRate,
            clickRate
        });
    } catch (error) {
        if (error.message && /column.*locale.*does not exist/i.test(error.message)) {
            try {
                await pool.query("ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en'");
                await pool.query('CREATE INDEX IF NOT EXISTS idx_subscribers_locale ON subscribers(locale)');
                const { total, today, thisWeek, emailsSent, openRate, clickRate } = await runStats();
                return res.json({
                    total: parseInt(total.rows[0].count),
                    today: parseInt(today.rows[0].count),
                    thisWeek: parseInt(thisWeek.rows[0].count),
                    emailsSent: parseInt(emailsSent.rows[0].count),
                    openRate: openRate || 0,
                    clickRate: clickRate || 0
                });
            } catch (e2) {
                return res.status(500).json({ error: e2.message });
            }
        }
        res.status(500).json({ error: error.message });
    }
});

// ==================== EXPORT ====================

// GET /api/export - Export subscribers as CSV
app.get('/api/export', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT email, first_name, source, status, created_at FROM subscribers');

        let csv = 'email,first_name,source,status,created_at\n';
        result.rows.forEach(sub => {
            csv += `${sub.email},${sub.first_name || ''},${sub.source},${sub.status},${sub.created_at}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== HELPERS ====================

const THROTTLE_EMAILS_PER_MINUTE = parseInt(process.env.THROTTLE_EMAILS_PER_MINUTE || '0', 10) || 0;
const delayBetweenEmailsMs = THROTTLE_EMAILS_PER_MINUTE > 0 ? Math.ceil(60000 / THROTTLE_EMAILS_PER_MINUTE) : 0;
function throttleAfterSend() {
    if (delayBetweenEmailsMs <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, delayBetweenEmailsMs));
}

// Replace merge tags in subject/body for broadcasts and sequences. subscriber: { email, first_name, custom_fields (optional), locale (optional) }
function replaceMergeTags(text, subscriber) {
    if (!text || typeof text !== 'string') return text;
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const first = (subscriber && subscriber.first_name) ? String(subscriber.first_name).trim() : '';
    const email = (subscriber && subscriber.email) ? subscriber.email : '';
    const unsubscribeUrl = `${apiUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
    const locale = (subscriber && subscriber.locale) ? subscriber.locale : 'en';
    let out = text
        .replace(/\{\{first_name\}\}/g, first)
        .replace(/\{\{email\}\}/g, email)
        .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
        .replace(/\{\{locale\}\}/g, locale);
    if (subscriber && subscriber.custom_fields && typeof subscriber.custom_fields === 'object') {
        for (const [key, value] of Object.entries(subscriber.custom_fields)) {
            if (key && value != null) out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        }
    }
    return out;
}

// Compute next_email_at for first sequence step using absolute UTC time.
// If delay is 0d 0h, put it 1 minute in the past so scheduler picks it up on the next run.
function getNextEmailAtForFirstStep(delay_days, delay_hours) {
    const d = delay_days || 0;
    const h = delay_hours || 0;
    const nowMs = Date.now();
    if (d === 0 && h === 0) {
        return new Date(nowMs - 60 * 1000);
    }
    const deltaMs = ((d * 24) + h) * 60 * 60 * 1000;
    return new Date(nowMs + deltaMs);
}

// Ensure there is a subscriber row for a given email; return { id, locale }.
async function ensureSubscriberForEmail(email, localeHint = 'en') {
    const locale = (localeHint === 'am' ? 'am' : 'en');
    const norm = String(email || '').toLowerCase().trim();
    if (!norm) throw new Error('Email is required');

    const existing = await pool.query('SELECT id, locale FROM subscribers WHERE email = $1', [norm]);
    if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return { id: row.id, locale: row.locale === 'am' ? 'am' : 'en' };
    }

    const inserted = await pool.query(
        "INSERT INTO subscribers (email, status, locale, source) VALUES ($1, 'active', $2, $3) RETURNING id, locale",
        [norm, locale, 'access-flow']
    );
    return { id: inserted.rows[0].id, locale: inserted.rows[0].locale === 'am' ? 'am' : 'en' };
}

// Find active sequence by kind and locale (one per pair is expected).
async function findSequenceIdByKindAndLocale(kind, locale) {
    const loc = (locale === 'am' ? 'am' : 'en');
    const result = await pool.query(
        "SELECT id FROM sequences WHERE status = 'active' AND kind = $1 AND COALESCE(locale, 'en') = $2 ORDER BY id ASC LIMIT 1",
        [kind, loc]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
}

// Add subscriber to a sequence of given kind+locale if not already there.
async function addToSequenceByKind(subscriberId, locale, kind) {
    const seqId = await findSequenceIdByKindAndLocale(kind, locale);
    if (!seqId) {
        return false;
    }
    const existing = await pool.query(
        'SELECT id FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2',
        [subscriberId, seqId]
    );
    if (existing.rows.length > 0) {
        return false;
    }

    const firstEmail = await pool.query(
        'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 ORDER BY position LIMIT 1',
        [seqId]
    );
    const delay_days = firstEmail.rows[0] ? (firstEmail.rows[0].delay_days || 0) : 0;
    const delay_hours = firstEmail.rows[0] ? (firstEmail.rows[0].delay_hours || 0) : 0;
    await pool.query(
        `INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at)
         VALUES (
            $1,
            $2,
            0,
            CASE
                WHEN $3 = 0 AND $4 = 0
                    THEN NOW() - INTERVAL '1 minute'
                ELSE NOW() + ($3 * INTERVAL '1 day') + ($4 * INTERVAL '1 hour')
            END
         )`,
        [subscriberId, seqId, delay_days, delay_hours]
    );
    return true;
}

// Stop all active sequences of a given kind for subscriber (used when переход в новую воронку).
async function stopSequencesByKind(subscriberId, kind) {
    await pool.query(
        `UPDATE subscriber_sequences ss
         SET status = 'completed'
         FROM sequences s
         WHERE ss.sequence_id = s.id
           AND ss.subscriber_id = $1
           AND ss.status = 'active'
           AND s.kind = $2`,
        [subscriberId, kind]
    );
}

// Pick subject/body by subscriber locale from a broadcast or sequence_emails row (with subject_am, body_am, subject_en, body_en).
function pickContentByLocale(row, locale) {
    const loc = locale === 'am' ? 'am' : 'en';
    const subject = (loc === 'am' && row.subject_am) ? row.subject_am : ((loc === 'en' && row.subject_en) ? row.subject_en : row.subject);
    const body = (loc === 'am' && row.body_am) ? row.body_am : ((loc === 'en' && row.body_en) ? row.body_en : row.body);
    return { subject: subject || row.subject, body: body || row.body };
}

function computeDisplayName(firstName, email) {
    const name = (firstName || '').trim();
    if (name) return name;
    if (!email) return '';
    const local = email.split('@')[0] || '';
    if (!local) return '';
    const token = local.split(/[\.\-_]+/)[0] || local;
    if (!token) return '';
    return token.charAt(0).toUpperCase() + token.slice(1);
}

function renderSequenceBodyWithNameAndMarkdown(rawBody, subscriber) {
    let body = rawBody || '';
    const displayName = computeDisplayName(subscriber.first_name, subscriber.email);
    if (displayName) {
        body = body.replace(/\{NAME\}/g, displayName);
    } else {
        body = body.replace(/\{NAME\}/g, '');
    }
    // Markdown + inline HTML → HTML
    try {
        return marked.parse(body);
    } catch {
        return body;
    }
}

function wrapEmailTemplate(body, logId = null) {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    let content = body;

    // Add tracking if logId is provided
    if (logId) {
        content = content.replace(/href=["'](http[^"']+)["']/g, (match, url) => {
            if (url.includes('/api/confirm') || url.includes('/api/unsubscribe')) return match;
            const trackingUrl = `${apiUrl}/api/track/click/${logId}?url=${encodeURIComponent(url)}`;
            return `href="${trackingUrl}"`;
        });
    }

    const pixelHtml = logId ? `<img src="${apiUrl}/api/track/open/${logId}" width="1" height="1" alt="" style="display:none" />` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SuperEngulfing</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff; color: #000000; padding: 32px 16px; line-height: 1.6; }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .card { background: #ffffff; border-radius: 16px; padding: 40px 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
    .logo { color: #059669; font-size: 22px; font-weight: 700; letter-spacing: 0.02em; }
    .tagline { color: #4b5563; font-size: 12px; margin-top: 4px; }
    .content { color: #1a1a1a; font-size: 15px; }
    .content, .content * { color: #1a1a1a; }
    .content a { color: #059669 !important; text-decoration: none; }
    .content .btn, .content a.btn { color: #ffffff !important; }
    .content h1 { color: #1a1a1a; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
    .content p { margin: 0 0 14px 0; }
    .content ul { margin: 12px 0; padding-left: 20px; }
    .content li { margin-bottom: 6px; }
    .content a:hover { text-decoration: underline; }
    .btn { display: inline-block; background: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { margin-top: 32px; text-align: center; color: #4b5563; font-size: 12px; }
    .footer a { color: #4b5563; }
    .muted { color: #4b5563; font-size: 13px; }
    .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">SuperEngulfing</div>
        <div class="tagline">Trading clarity. One setup at a time.</div>
      </div>
      <div class="content">
        ${content}
      </div>
      ${pixelHtml}
      <div class="footer">
        <p style="margin:0;">&copy; ${new Date().getFullYear()} SuperEngulfing. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Send confirmation email (double opt-in) - NO PDF link
// Deliverability: use API_URL = your public HTTPS URL in .env (not localhost) so links are valid and not flagged as spam
async function sendConfirmationEmail(email, token, locale = 'en') {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const confirmUrl = `${apiUrl}/api/confirm/${token}`;
    console.log('[sendConfirmationEmail] API_URL=', apiUrl, '→ confirmUrl=', confirmUrl);
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Հաստատեք բաժանորդագրությունը – SuperEngulfing' : 'Confirm your subscription - SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Մեկ քայլ ևս</h1>
                <p>Ողջույն,</p>
                <p>Շնորհակալություն <strong>SuperEngulfing</strong>-ին միանալու համար: Ձեր <strong>Liquidity Sweep Cheatsheet</strong> PDF-ը ստանալու համար խնդրում ենք հաստատել բաժանորդագրությունը՝ սեղմելով ներքևի կոճակը:</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${confirmUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Հաստատել բաժանորդագրությունը</a>
                </p>
                <div class="divider"></div>
                <p class="muted">Եթե դուք չեք բաժանորդագրվել, կարող եք պարզապես անտեսել այս նամակը:</p>
            ` : `
                <h1>One more step!</h1>
                <p>Hello,</p>
                <p>Thank you for signing up to <strong>SuperEngulfing</strong>. To receive your <strong>Liquidity Sweep Cheatsheet</strong> PDF, please confirm your subscription by clicking the button below.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${confirmUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Confirm my subscription</a>
                </p>
                <div class="divider"></div>
                <p class="muted">If you didn't sign up for this, you can safely ignore this email.</p>
            `;
    const textContent = isAm ? `Մեկ քայլ ևս – SuperEngulfing\n\nՀաստատեք բաժանորդագրությունը:\n${confirmUrl}\n\nԵթե չեք բաժանորդագրվել, անտեսեք այս նամակը:` : `One more step!\n\nThank you for signing up to SuperEngulfing!\n\nConfirm your subscription and get your Liquidity Sweep Cheatsheet:\n${confirmUrl}\n\nIf you didn't sign up for this, you can safely ignore this email.`;

    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent),
            headers: {
                'List-Unsubscribe': `<${apiUrl}/api/unsubscribe?email=${encodeURIComponent(email)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        });
        console.log(`📧 Confirmation email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send confirmation email to ${email}:`, error.message);
        return false;
    }
}

// Send admin PIN code email (two-step admin auth)
async function sendAdminPinEmail(email, code) {
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const subject = 'Admin panel login code - SuperEngulfing';
    const htmlContent = `
        <h1>Your admin login code</h1>
        <p>Use this code to sign in to the admin panel:</p>
        <p style="font-size: 24px; font-family: monospace; letter-spacing: 4px; margin: 20px 0;"><strong>${code}</strong></p>
        <p class="muted">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
    `;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            subject,
            html: wrapEmailTemplate(htmlContent),
            text: `Your admin login code: ${code}\n\nThis code expires in 10 minutes.`
        });
        console.log(`📧 Admin PIN email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send admin PIN to ${email}:`, error.message);
        return false;
    }
}

// Send welcome email WITH PDF link (sent after confirmation) — EN: English PDF, AM: Armenian PDF
async function sendWelcomeEmail(email, locale = 'en') {
    const pdfLinkEnv = locale === 'am' ? (process.env.PDF_LINK_AM || process.env.PDF_LINK) : (process.env.PDF_LINK_EN || process.env.PDF_LINK);
    const pdfLink = pdfLinkEnv || (locale === 'am' ? DEFAULT_PDF_LINK_AM : DEFAULT_PDF_LINK_EN);
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const unsubscribeUrl = `${apiUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Ահա քո PDF–ը 📄' : 'Your PDF is ready';
    const htmlContent = isAm ? `
                <h1>Ահա քո PDF–ը 📄</h1>
                <p>Ողջույն,</p>
                <p>Ահա քո <strong>SuperEngulfing PDF-ը</strong>։</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${pdfLink}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Ներբեռնել PDF-ը</a>
                </p>
                <p>Այստեղ դու կգտնես.</p>
                <ul>
                    <li>Ինչո՞ւ են քո ստոպ լոսսերն անընդհատ ակտիվանում</li>
                    <li>Ի՞նչ է իրենից ներկայացնում SuperEngulfing-ը</li>
                    <li>2 պայման, որոնց դեպքում ստրատեգիան աշխատում է</li>
                    <li>Իրական գրաֆիկաների օրինակներ</li>
                    <li>Ո՞րն է հաջորդ քայլը</li>
                </ul>
                <p>Կարդա՛, ուսումնասիրի՛ր, հետո կշարունակենք:</p>
                <p>Հաջորդ մեյլում ես կխոսեմ #1 սխալի մասին, որն անում են թրեյդերները այս պատերնի (pattern) հետ աշխատելիս:</p>
                <p>Մինչ հանդիպում,<br/>Հայկ</p>
                <p class="muted">Այս PDF-ը դեռ սկիզբն է. քեզ է սպասում նաև ամբողջական անվճար դասընթաց։ Մանրամասները՝ ֆայլի ներսում։</p>
                <div class="divider"></div>
                <p class="muted"><a href="${unsubscribeUrl}">Չեղարկել բաժանորդագրությունը</a></p>
            ` : `
                <h1>Your PDF is ready</h1>
                <p>Hey,</p>
                <p>Here's your <strong>SuperEngulfing PDF</strong>:</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${pdfLink}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Download your PDF</a>
                </p>
                <p><strong>Inside:</strong></p>
                <ul>
                    <li>Why you keep getting stopped out</li>
                    <li>What SuperEngulfing actually is</li>
                    <li>The 2 conditions that make it work</li>
                    <li>REV, RUN, and PLUS setups</li>
                    <li>What to do next</li>
                </ul>
                <p>Takes about 10 minutes to read.</p>
                <p>Tomorrow I'll share the #1 mistake traders make with this pattern — and how to avoid it.</p>
                <p>Talk soon,<br/>Hayk</p>
                <div class="divider"></div>
                <p class="muted"><a href="${unsubscribeUrl}">Unsubscribe</a> from these emails.</p>
            `;
    const textContent = isAm
        ? `Ահա քո PDF–ը 📄\n\nՈղջույն,\n\nԱհա քո SuperEngulfing PDF-ը.\n\nՆերբեռնել PDF-ը:\n${pdfLink}\n\nԱյստեղ դու կգտնես.\n- Ինչո՞ւ են քո ստոպ լոսսերն անընդհատ ակտիվանում\n- Ի՞նչ է իրենից ներկայացնում SuperEngulfing-ը\n- 2 պայման, որոնց դեպքում ստրատեգիան աշխատում է\n- Իրական գրաֆիկաների օրինակներ\n- Ո՞րն է հաջորդ քայլը\n\nԿարդա՛, ուսումնասիրի՛ր, հետո կշարունակենք:\nՀաջորդ մեյլում ես կխոսեմ #1 սխալի մասին, որն անում են թրեյդերները այս պատերնի (pattern) հետ աշխատելիս:\n\nՄինչ հանդիպում,\nՀայկ\n\nԱյս PDF-ը դեռ սկիզբն է. քեզ է սպասում նաև ամբողջական անվճար դասընթաց (մանրամասները՝ ֆայլի ներսում).\n\nՉեղարկել բաժանորդագրությունը: ${unsubscribeUrl}`
        : `Your PDF is ready\n\nHey,\n\nHere's your SuperEngulfing PDF:\n${pdfLink}\n\nInside:\n- Why you keep getting stopped out\n- What SuperEngulfing actually is\n- The 2 conditions that make it work\n- REV, RUN, and PLUS setups\n- What to do next\n\nTakes about 10 minutes to read.\n\nTomorrow I'll share the #1 mistake traders make with this pattern — and how to avoid it.\n\nTalk soon,\nHayk\n\nUnsubscribe: ${unsubscribeUrl}`;

    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent),
            headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        });
        console.log(`📧 Welcome email with PDF sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
        return false;
    }
}

// Third email after welcome: course access — link to Access page + how to get access (video, steps)
async function sendCourseAccessEmail(email, locale = 'en') {
    const thankYouBaseRaw = process.env.THANK_YOU_URL || (process.env.API_URL || 'http://localhost:3001').replace(/\/api$/, '');
    const baseUrl = thankYouBaseRaw.replace(/\/thank-you\/?$/i, '') || thankYouBaseRaw;
    const courseAccessUrl = locale === 'am' ? `${baseUrl}/am/course-access` : `${baseUrl}/course-access`;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Ցանկանու՞մ եք մուտքի մասին նամակ – SuperEngulfing' : 'Do you want the course access email? - SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Մուտք դասընթացին</h1>
                <p>Ողջույն,</p>
                <p>Տեսանյութում մանրամասն բացատրվում է, <strong>ինչպես ստանալ մուտք</strong> դասընթացին և ինդիկատորին։</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${courseAccessUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Բացել մուտքի էջը</a>
                </p>
                <p><strong>Ինչպես ստանալ մուտք.</strong></p>
                <ul>
                    <li>Գրանցվեք գործընկերոջ հղումով (անվճար)</li>
                    <li>Ավելացրեք հաշվին $100 և կատարեք գործարք</li>
                    <li>Ներկայացրեք ձեր UID-ն մուտքի էջում — մենք կհաստատենք 24 ժամի ընթացքում</li>
                </ul>
                <p class="muted">Հղումը դեպի մուտքի էջ. <a href="${courseAccessUrl}">${courseAccessUrl}</a></p>
            ` : `
                <h1>Course access</h1>
                <p>Hello,</p>
                <p>In the video you'll see <strong>exactly how to get access</strong> to the course and indicator.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${courseAccessUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Go to Access page</a>
                </p>
                <p><strong>How it works:</strong></p>
                <ul>
                    <li>Register using our partner link (free)</li>
                    <li>Deposit $100 and make a trade</li>
                    <li>Submit your UID on the Access page — we'll verify within 24 hours</li>
                </ul>
                <p class="muted">Access page link: <a href="${courseAccessUrl}">${courseAccessUrl}</a></p>
            `;
    const textContent = isAm
        ? `Մուտք դասընթացին – SuperEngulfing\n\nՏեսանյութում մանրամասն բացատրվում է, ինչպես ստանալ մուտք:\n\nԲացել մուտքի էջը: ${courseAccessUrl}\n\nԻնչպես ստանալ մուտք: Գրանցվել, ավելացնել $100 և գործարք կատարել, ներկայացնել UID մուտքի էջում։`
        : `Do you want the course access email? – SuperEngulfing\n\nIn the video you'll see exactly how to get access.\n\nGo to Access page: ${courseAccessUrl}\n\nHow it works: Register, deposit $100 and trade, submit your UID on the Access page. We'll verify within 24 hours.`;

    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Course access email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send course access email to ${email}:`, error.message);
        return false;
    }
}

// Send admin notification when a new access request is submitted (email + UID)
// ADMIN_EMAIL_EN, ADMIN_EMAIL_AM per locale (fallback: ADMIN_EMAIL)
async function sendAdminNewAccessRequestNotification(applicantEmail, uid, locale = 'en') {
    const adminEmailsRaw = locale === 'am' ? (process.env.ADMIN_EMAIL_AM || process.env.ADMIN_EMAIL) : (process.env.ADMIN_EMAIL_EN || process.env.ADMIN_EMAIL);
    const adminEmails = (adminEmailsRaw || '').split(',').map(s => s.trim()).filter(s => s && s.includes('@'));
    if (adminEmails.length === 0) return false;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const adminUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/admin` : '';
    const htmlContent = `
                <h1>New access request</h1>
                <p>A new access request has been submitted.</p>
                <table style="width:100%; border-collapse: collapse; margin: 20px 0; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden;">
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">Applicant email</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500;">${applicantEmail}</td></tr>
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px;">WEEX UID</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500; font-family: monospace;">${uid}</td></tr>
                </table>
                ${adminUrl ? `<p style="margin-top: 20px;"><a href="${adminUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Review in Admin</a></p>` : ''}
            `;
    const textContent = `New access request – SuperEngulfing\n\nSomeone has submitted an access request.\nApplicant email: ${applicantEmail}\nUID: ${uid}${adminUrl ? `\nReview in Admin: ${adminUrl}` : ''}`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: adminEmails,
            replyTo: replyTo,
            subject: 'New access request – SuperEngulfing',
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Admin notification sent to ${adminEmails.join(', ')} (applicant: ${applicantEmail})`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send admin notification to ${adminEmails.join(', ')}:`, error.message);
        return false;
    }
}

const TRADINGVIEW_INDICATOR_URL = 'https://www.tradingview.com/v/B2iqoM5q/';

// Send admin email when a logged-in user requests TradingView indicator access
// ADMIN_EMAIL_EN, ADMIN_EMAIL_AM per locale (fallback: ADMIN_EMAIL)
async function sendAdminIndicatorAccessRequestNotification(firstName, email, tradingview_username, requestedAt, locale = 'en') {
    const adminEmailsRaw = locale === 'am' ? (process.env.ADMIN_EMAIL_AM || process.env.ADMIN_EMAIL) : (process.env.ADMIN_EMAIL_EN || process.env.ADMIN_EMAIL);
    const adminEmails = (adminEmailsRaw || '').split(',').map(s => s.trim()).filter(s => s && s.includes('@'));
    if (adminEmails.length === 0) return false;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const adminUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/admin` : '';
    const dateStr = requestedAt ? (requestedAt instanceof Date ? requestedAt.toISOString() : String(requestedAt)) : 'Just now';
    const htmlContent = `
                <h1>New indicator access request</h1>
                <p>A dashboard user has requested access to the SuperEngulfing TradingView indicator.</p>
                <table style="width:100%; border-collapse: collapse; margin: 20px 0; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden;">
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">Name</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500;">${firstName || '—'}</td></tr>
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">Email</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500;">${email}</td></tr>
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">TradingView username</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500; font-family: monospace;">${tradingview_username}</td></tr>
                    <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 12px;">Requested at</td><td style="padding: 12px 16px; color: #f8fafc; font-weight: 500;">${dateStr}</td></tr>
                </table>
                <p style="margin-top: 24px;"><strong>Grant access:</strong></p>
                <p style="margin: 12px 0 20px 0;"><a href="${TRADINGVIEW_INDICATOR_URL}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Open TradingView – SuperEngulfing REV + RUN</a></p>
                ${adminUrl ? `<p class="muted"><a href="${adminUrl}">Open Admin panel</a></p>` : ''}
            `;
    const textContent = `New indicator access request – SuperEngulfing\n\nName: ${firstName || '—'}\nEmail: ${email}\nTradingView username: ${tradingview_username}\nRequested at: ${dateStr}\n\nGrant access: ${TRADINGVIEW_INDICATOR_URL}${adminUrl ? `\nAdmin: ${adminUrl}` : ''}`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: adminEmails,
            replyTo: replyTo,
            subject: `Indicator access request – ${tradingview_username}`,
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Admin indicator request notification sent (${email}, TV: ${tradingview_username})`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send admin indicator request notification:', error.message);
        return false;
    }
}

// Send user email when their access request (WEEX) is rejected
async function sendAccessRequestRejectedEmail(email, reason, locale = 'en') {
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const reasonEscaped = String(reason).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isAm = locale === 'am';
    const subject = isAm ? 'Ձեր մուտքի հարցումը չի հաստատվել – SuperEngulfing' : 'Your access request was not approved – SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Ձեր մուտքի հարցումը չի հաստատվել</h1>
                <p>Ողջույն,</p>
                <p>Շնորհակալություն SuperEngulfing-ի նկատմամբ հետաքրքրության համար: Ցավոք, այս պահին մենք չենք կարող հաստատել ձեր մուտքի հարցումը:</p>
                <p><strong>Պատճառը՝</strong></p>
                <p style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 12px 0;">${reasonEscaped}</p>
                <p>Եթե ունեք հարցեր կամ կարծում եք, որ սխալմունք է տեղի ունեցել, խնդրում ենք պատասխանել այս նամակին:</p>
                <p>— SuperEngulfing թիմ</p>
            ` : `
                <h1>Your access request was not approved</h1>
                <p>Hello,</p>
                <p>Thank you for your interest in SuperEngulfing. Unfortunately we are unable to approve your access request at this time.</p>
                <p><strong>Reason:</strong></p>
                <p style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 12px 0;">${reasonEscaped}</p>
                <p>If you have questions or believe this was in error, please reply to this email.</p>
                <p>— The SuperEngulfing Team</p>
            `;
    const textContent = isAm ? `Ձեր մուտքի հարցումը չի հաստատվել – SuperEngulfing\n\nՈղջույն,\n\nՄենք չենք կարող հաստատել ձեր հարցումը:\n\nՊատճառ: ${reason}\n\nՀարցերի դեպքում պատասխանեք այս նամակին:\n\n— SuperEngulfing թիմ` : `Your access request was not approved – SuperEngulfing\n\nHello,\n\nThank you for your interest. We are unable to approve your access request at this time.\n\nReason: ${reason}\n\nIf you have questions, reply to this email.\n\n— The SuperEngulfing Team`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Access request rejected email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send access-rejected email to ${email}:`, error.message);
        return false;
    }
}

// Send user email when their indicator access is approved
async function sendUserIndicatorAccessApprovedEmail(email, firstName) {
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const name = firstName || 'there';
    const htmlContent = `
                <h1>Your indicator access has been approved</h1>
                <p>Hi ${name},</p>
                <p>Your SuperEngulfing indicator access has been approved. You can now open TradingView and add the invite-only script.</p>
                <p><strong>How to get the indicator:</strong></p>
                <ol>
                    <li>Open the link below (or go to TradingView and open Invite-Only Scripts).</li>
                    <li>Find <strong>SuperEngulfing: REV + RUN</strong> in Indicators → Invite-Only Scripts.</li>
                </ol>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${TRADINGVIEW_INDICATOR_URL}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Open TradingView – SuperEngulfing</a>
                </p>
                <p class="muted">If you have any questions, reply to this email.</p>
            `;
    const textContent = `Your SuperEngulfing indicator access has been approved\n\nHi ${name},\n\nYour indicator access has been approved. You can open TradingView and add the invite-only script:\n\n${TRADINGVIEW_INDICATOR_URL}\n\nIn TradingView: Indicators → Invite-Only Scripts → SuperEngulfing: REV + RUN.\n\nIf you have any questions, reply to this email.`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject: 'Your SuperEngulfing indicator access has been approved',
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Indicator access approved email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send indicator-approved email to ${email}:`, error.message);
        return false;
    }
}

// Send user email when their indicator access request is rejected
async function sendUserIndicatorAccessRejectedEmail(email, firstName, reason) {
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const name = firstName || 'there';
    const htmlContent = `
                <h1>Your indicator access request was not approved</h1>
                <p>Hi ${name},</p>
                <p>We were unable to approve your SuperEngulfing indicator access request at this time.</p>
                <p><strong>Reason:</strong></p>
                <p style="background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 12px 0;">${String(reason).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                <p>If you have questions or believe this was in error, please reply to this email.</p>
                <p>— The SuperEngulfing Team</p>
            `;
    const textContent = `Your indicator access request was not approved – SuperEngulfing\n\nHi ${name},\n\nWe were unable to approve your indicator access request at this time.\n\nReason: ${reason}\n\nIf you have questions, reply to this email.\n\n— The SuperEngulfing Team`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject: 'Your indicator access request was not approved – SuperEngulfing',
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Indicator access rejected email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send indicator-rejected email to ${email}:`, error.message);
        return false;
    }
}

// Send "request received" email (after POST /api/access-requests)
async function sendRequestReceivedEmail(email, locale = 'en') {
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Ձեր հարցումը ստացվել է – SuperEngulfing' : 'Request received – SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Հարցումը ստացվել է</h1>
                <p>Ողջույն,</p>
                <p>Մենք ստացել ենք ձեր մուտքի հարցումը: Մեր թիմը կուսումնասիրի այն և կպատասխանի <strong>24–48 ժամվա</strong> ընթացքում:</p>
                <p><strong>Ինչ է լինելու հիմա.</strong></p>
                <ul>
                    <li>Մենք ստուգում ենք ձեր WEEX UID-ը և հաշվի կարգավիճակը:</li>
                    <li>Հաստատվելու դեպքում դուք կստանաք նամակ՝ գաղտնաբառ սահմանելու հղումով:</li>
                    <li>Դրանից հետո կարող եք մուտք գործել կառավարման վահանակ (dashboard) և օգտվել ինդիկատորից ու դասընթացներից:</li>
                </ul>
                <p>Հարցեր ունենալիս կարող եք պատասխանել այս նամակին:</p>
                <p>— SuperEngulfing թիմ</p>
            ` : `
                <h1>Request received</h1>
                <p>Hello,</p>
                <p>We have received your access request. Our team will review it and get back to you within <strong>24–48 hours</strong>.</p>
                <p><strong>What happens next:</strong></p>
                <ul>
                    <li>We verify your WEEX UID and account.</li>
                    <li>If approved, you will receive an email with a link to set your password.</li>
                    <li>You can then log in to the dashboard and access the indicator and courses.</li>
                </ul>
                <p>If you have any questions, reply to this email.</p>
                <p>— The SuperEngulfing Team</p>
            `;
    const textContent = isAm ? `Հարցումը ստացվել է – SuperEngulfing\n\nՈղջույն,\n\nՄենք ստացել ենք ձեր հարցումը: Մեր թիմը կպատասխանի 24–48 ժամվա ընթացքում:\n\nԻնչ է լինելու հիմա.\n• Մենք ստուգում ենք ձեր WEEX UID-ը:\n• Հաստատվելու դեպքում կստանաք գաղտնաբառ սահմանելու հղում:\n\n— SuperEngulfing թիմ` : `Request received – SuperEngulfing\n\nHello,\n\nWe have received your access request. Our team will review it and get back to you within 24–48 hours.\n\nWhat happens next:\n• We verify your WEEX UID and account.\n• If approved, you will receive an email with a link to set your password.\n• You can then log in to the dashboard and access the indicator and courses.\n\nIf you have any questions, reply to this email.\n\n— The SuperEngulfing Team`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Request received email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send request-received email to ${email}:`, error.message);
        return false;
    }
}

// Send "set your password" email (after admin accept)
async function sendSetPasswordEmail(email, token, locale = 'en') {
    // Use FRONTEND_URL if available, otherwise fall back to API_URL (without /api suffix)
    const baseUrl = process.env.FRONTEND_URL || (process.env.API_URL || 'http://localhost:3001').replace(/\/api$/, '');
    const pathPrefix = locale === 'am' ? '/am' : '';
    const setPasswordUrl = `${baseUrl}${pathPrefix}/set-password?token=${encodeURIComponent(token)}`;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Սահմանեք Ձեր գաղտնաբառը – SuperEngulfing' : 'Set your password – SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Ձեր մուտքը հաստատվել է</h1>
                <p>Ողջույն,</p>
                <p>Ձեր մուտքի հարցումը հաստատվել է: Այժմ կարող եք սահմանել գաղտնաբառ և մուտք գործել համակարգ:</p>
                <p><strong>Ձեր մուտքանունը (Login):</strong> <span style="font-family: monospace; color: #39FF14;">${email}</span></p>
                <p>Սեղմեք ներքևի կոճակը՝ գաղտնաբառը սահմանելու համար: Հղումը վավեր է <strong>24 ժամ</strong>:</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${setPasswordUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Սահմանել գաղտնաբառը</a>
                </p>
                <div class="divider"></div>
                <p class="muted">Եթե դուք մուտքի հարցում չեք ուղարկել, կարող եք անտեսել այս նամակը:</p>
            ` : `
                <h1>Your access has been approved</h1>
                <p>Hello,</p>
                <p>Your access request has been approved. You can now set your password and log in to the dashboard.</p>
                <p><strong>Your login:</strong> <span style="font-family: monospace; color: #39FF14;">${email}</span></p>
                <p>Click the button below to set your password. This link is valid for <strong>24 hours</strong>.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${setPasswordUrl}" class="btn" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:8px 0;">Set your password</a>
                </p>
                <div class="divider"></div>
                <p class="muted">If you didn't request access, you can ignore this email.</p>
            `;
    const textContent = isAm ? `Սահմանեք գաղտնաբառը – SuperEngulfing\n\nՈղջույն,\n\nՁեր մուտքը հաստատվել է: Մուտք: ${email}\n\nՀղում (24 ժամ):\n${setPasswordUrl}\n\nԵթե մուտք չեք խնդրել, անտեսեք այս նամակը:` : `Set your password – SuperEngulfing\n\nHello,\n\nYour access request has been approved. You can now set your password and log in.\n\nYour login: ${email}\n\nSet your password (link valid 24 hours):\n${setPasswordUrl}\n\nIf you didn't request access, you can ignore this email.`;
    try {
        await transporter.sendMail({
            from: fromAddr,
            to: email,
            replyTo: replyTo,
            subject,
            text: textContent,
            html: wrapEmailTemplate(htmlContent)
        });
        console.log(`📧 Set-password email sent to ${email}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send set-password email to ${email}:`, error.message);
        return false;
    }
}

// GET /api/test-email - Test confirmation email
app.get('/api/test-email', requireAdminAuth, async (req, res) => {
    const token = generateToken();
    const result = await sendConfirmationEmail(process.env.SMTP_USER, token);
    res.json({ success: result, message: 'Test confirmation email sent' });
});

// GET /api/unsubscribe - Unsubscribe from emails
app.get('/api/unsubscribe', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).send('Email required');
    }

    try {
        await pool.query(
            "UPDATE subscribers SET status = 'unsubscribed' WHERE email = $1",
            [email.toLowerCase()]
        );

        res.send(`
            <html>
            <body style="background:#f8fafc;color:#0f172a;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                <div style="text-align:center;">
                    <h1>Unsubscribed</h1>
                    <p>You have been unsubscribed from SuperEngulfing emails.</p>
                    <p style="color:#64748b;">We're sorry to see you go.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error processing unsubscribe');
    }
});

// GET /api/unsubscribe-sequence?token=... - Unsubscribe from a specific sequence only
app.get('/api/unsubscribe-sequence', async (req, res) => {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
        return res.status(400).send('Invalid unsubscribe link');
    }

    const decoded = decodeSequenceUnsubToken(token);
    if (!decoded) {
        return res.status(400).send('Invalid or expired unsubscribe link');
    }

    const { subscriberId, sequenceId } = decoded;

    try {
        const row = await pool.query(
            `SELECT ss.id, s.email, seq.name, COALESCE(seq.kind, '') as kind
             FROM subscriber_sequences ss
             JOIN subscribers s ON s.id = ss.subscriber_id
             JOIN sequences seq ON seq.id = ss.sequence_id
             WHERE ss.subscriber_id = $1 AND ss.sequence_id = $2
             LIMIT 1`,
            [subscriberId, sequenceId]
        );

        if (row.rows.length === 0) {
            return res.status(404).send('Subscription not found');
        }

        await pool.query(
            "UPDATE subscriber_sequences SET status = 'unsubscribed' WHERE subscriber_id = $1 AND sequence_id = $2",
            [subscriberId, sequenceId]
        );

        const seqName = row.rows[0].name || 'this sequence';

        res.send(`
            <html>
            <body style="background:#0f172a;color:#e5e7eb;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
                <div style="text-align:center;max-width:480px;padding:24px;border-radius:16px;background:#020617;box-shadow:0 20px 40px rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.3);">
                    <h1 style="font-size:24px;margin-bottom:16px;">You unsubscribed from this sequence</h1>
                    <p style="color:#e5e7eb;margin-bottom:8px;">Sequence: <strong>${seqName}</strong></p>
                    <p style="color:#9ca3af;margin-bottom:16px;">Other emails (например, Access / Courses / LiquidityScan) вы будете продолжать получать, если от них не отписались отдельно.</p>
                    <p style="color:#6b7280;font-size:13px;margin-top:16px;">Если вы сделали это случайно, просто подпишитесь на эту серию писем ещё раз на сайте.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('[unsubscribe-sequence] error:', error && error.message);
        res.status(500).send('Error processing sequence unsubscribe');
    }
});

// ==================== EMAIL ANALYTICS ====================

// 1x1 transparent pixel for tracking email opens
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

// GET /api/track/open/:logId - Track email open
app.get('/api/track/open/:logId', async (req, res) => {
    const { logId } = req.params;
    const ip = req.ip || req.connection?.remoteAddress || null;
    const ua = req.get('user-agent') || null;

    try {
        await pool.query(
            "UPDATE email_log SET status = 'opened', opened_at = NOW() WHERE id = $1 AND status = 'sent'",
            [logId]
        );
        const logRow = await pool.query('SELECT subscriber_id FROM email_log WHERE id = $1', [logId]);
        if (logRow.rows.length > 0) {
            try {
                await pool.query(
                    'INSERT INTO email_opens (email_log_id, subscriber_id, opened_at, ip_address, user_agent) VALUES ($1, $2, NOW(), $3, $4)',
                    [logId, logRow.rows[0].subscriber_id || null, ip, ua]
                );
            } catch (e) {
                if (!/relation "email_opens" does not exist/i.test(e.message)) console.error('email_opens insert error:', e.message);
            }
        }
        console.log(`👁️ Email opened: log ID ${logId}`);
    } catch (error) {
        console.error('Track open error:', error.message);
    }

    // Return 1x1 transparent GIF
    res.set({
        'Content-Type': 'image/gif',
        'Content-Length': TRACKING_PIXEL.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.send(TRACKING_PIXEL);
});

// GET /api/track/click/:logId - Track link click and redirect
app.get('/api/track/click/:logId', async (req, res) => {
    const { logId } = req.params;
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('URL required');
    }

    try {
        // Record click in email_log
        await pool.query(
            "UPDATE email_log SET status = 'clicked', clicked_at = NOW() WHERE id = $1",
            [logId]
        );

        // Also insert a click event record
        await pool.query(
            "INSERT INTO email_clicks (email_log_id, url, clicked_at) VALUES ($1, $2, NOW())",
            [logId, url]
        );

        console.log(`🖱️ Link clicked: log ID ${logId}, URL: ${url}`);
    } catch (error) {
        console.error('Track click error:', error.message);
    }

    // Redirect to actual URL
    res.redirect(decodeURIComponent(url));
});

// GET /api/analytics - Get email analytics summary (works with or without opened_at/clicked_at columns)
app.get('/api/analytics', requireAdminAuth, async (req, res) => {
    try {
        const totalSent = await pool.query("SELECT COUNT(*) FROM email_log WHERE status IN ('sent', 'opened', 'clicked')");
        const totalOpened = await pool.query("SELECT COUNT(*) FROM email_log WHERE status IN ('opened', 'clicked')");
        const totalClicked = await pool.query("SELECT COUNT(*) FROM email_log WHERE status = 'clicked'");

        const totalSentNum = parseInt(totalSent.rows[0].count, 10) || 0;
        const totalOpenedNum = parseInt(totalOpened.rows[0].count, 10) || 0;
        const totalClickedNum = parseInt(totalClicked.rows[0].count, 10) || 0;

        const openRate = totalSentNum > 0 ? (totalOpenedNum / totalSentNum * 100).toFixed(1) : 0;
        const clickRate = totalOpenedNum > 0 ? (totalClickedNum / totalOpenedNum * 100).toFixed(1) : 0;

        // Recent activity: order by sent_at so it works without opened_at/clicked_at migration
        let recentActivity = [];
        try {
            const ra = await pool.query(`
                SELECT el.id, el.subscriber_id, el.email_type, el.status, el.sent_at, s.email 
                FROM email_log el
                LEFT JOIN subscribers s ON el.subscriber_id = s.id
                WHERE el.status IN ('opened', 'clicked', 'sent')
                ORDER BY el.sent_at DESC
                LIMIT 20
            `);
            recentActivity = ra.rows;
        } catch (e) {
            // fallback if JOIN fails
            const ra = await pool.query('SELECT id, subscriber_id, email_type, status, sent_at FROM email_log ORDER BY sent_at DESC LIMIT 20');
            recentActivity = ra.rows.map(r => ({ ...r, email: '' }));
        }

        // By email type
        let byType = [];
        try {
            const bt = await pool.query(`
                SELECT 
                    email_type,
                    COUNT(*)::text as total,
                    SUM(CASE WHEN status IN ('opened', 'clicked') THEN 1 ELSE 0 END)::text as opened,
                    SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END)::text as clicked
                FROM email_log
                GROUP BY email_type
            `);
            byType = bt.rows;
        } catch (e) {
            byType = [];
        }

        res.json({
            summary: {
                totalSent: totalSentNum,
                totalOpened: totalOpenedNum,
                totalClicked: totalClickedNum,
                openRate: parseFloat(openRate),
                clickRate: parseFloat(clickRate)
            },
            byType,
            recentActivity
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/settings - Public: get site settings (affiliate link for Access page), ?locale=en|am
app.get('/api/settings', async (req, res) => {
    const locale = (req.query.locale === 'am' ? 'am' : 'en');
    const suffix = locale === 'am' ? '_am' : '_en';
    const keys = [`affiliate_label${suffix}`, `affiliate_url${suffix}`, 'affiliate_label', 'affiliate_url'];
    try {
        const result = await pool.query(
            "SELECT key, value FROM site_settings WHERE key = ANY($1)",
            [keys]
        );
        const map = {};
        result.rows.forEach(r => { map[r.key] = r.value || ''; });
        const labelKey = `affiliate_label${suffix}`;
        const urlKey = `affiliate_url${suffix}`;
        res.json({
            affiliate_label: map[labelKey] || map.affiliate_label || 'Affiliate Link',
            affiliate_url: map[urlKey] || map.affiliate_url || '#'
        });
    } catch (error) {
        res.json({ affiliate_label: 'Affiliate Link', affiliate_url: '#' });
    }
});

// PUT and POST /api/settings - Admin: update site settings (affiliate label & url), body: { locale?, affiliate_label, affiliate_url }
async function updateSettingsHandler(req, res) {
    const { locale: bodyLocale, affiliate_label, affiliate_url } = req.body || {};
    const locale = (bodyLocale === 'am' ? 'am' : 'en');
    const suffix = locale === 'am' ? '_am' : '_en';
    const labelKey = `affiliate_label${suffix}`;
    const urlKey = `affiliate_url${suffix}`;
    try {
        if (affiliate_label !== undefined) {
            await pool.query(
                'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                [labelKey, String(affiliate_label)]
            );
        }
        if (affiliate_url !== undefined) {
            let url = String(affiliate_url).trim();
            if (url && url !== '#' && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            await pool.query(
                'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                [urlKey, url]
            );
        }
        const result = await pool.query(
            "SELECT key, value FROM site_settings WHERE key IN ($1, $2)",
            [labelKey, urlKey]
        );
        const map = {};
        result.rows.forEach(r => { map[r.key] = r.value || ''; });
        res.json({
            success: true,
            affiliate_label: map[labelKey] || '',
            affiliate_url: map[urlKey] || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
app.put('/api/settings', requireAdminAuth, updateSettingsHandler);
app.post('/api/settings', requireAdminAuth, updateSettingsHandler);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== SCHEDULER ====================

// Process scheduled broadcasts
async function processScheduledBroadcasts() {
    try {
        const scheduled = await pool.query(
            "SELECT * FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= NOW()"
        );

        for (const broadcast of scheduled.rows) {
            console.log(`📤 Processing scheduled broadcast: ${broadcast.subject}`);

            await pool.query("UPDATE broadcasts SET status = 'sending' WHERE id = $1", [broadcast.id]);

            const subscribers = { rows: await getBroadcastSubscribers(broadcast) };
            let sentCount = 0;
            let failedCount = 0;

            for (const sub of subscribers.rows) {
                try {
                    const subLocale = sub.locale === 'am' ? 'am' : 'en';
                    const content = pickContentByLocale(broadcast, subLocale);
                    const subj = replaceMergeTags(content.subject, sub);
                    const bodyPersonal = replaceMergeTags(content.body, sub);
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                        to: sub.email,
                        subject: subj,
                        html: wrapEmailTemplate(bodyPersonal)
                    });
                    sentCount++;

                    await pool.query(
                        'INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5)',
                        [sub.id, 'broadcast', broadcast.id, subj, 'sent']
                    );
                    await throttleAfterSend();
                } catch (e) {
                    failedCount++;
                }
            }

            await pool.query(
                "UPDATE broadcasts SET status = 'sent', sent_at = NOW(), sent_count = $1, failed_count = $2 WHERE id = $3",
                [sentCount, failedCount, broadcast.id]
            );

            console.log(`✅ Broadcast sent: ${sentCount} sent, ${failedCount} failed`);
        }
    } catch (error) {
        console.error('❌ Scheduler error (broadcasts):', error.message);
    }
}

// Process A/B test remainder: when ab_test_ends_at passed, pick winner and send to remaining 80%
async function processAbTestRemainder() {
    try {
        const due = await pool.query(`
            SELECT * FROM broadcasts WHERE ab_test_ends_at IS NOT NULL AND ab_test_ends_at <= NOW() AND ab_test_winner IS NULL AND subject_b IS NOT NULL
        `);
        for (const broadcast of due.rows) {
            const opens = await pool.query(`
                SELECT subject, COUNT(*) FILTER (WHERE status IN ('opened', 'clicked')) as opened, COUNT(*) as sent
                FROM email_log WHERE email_type = 'broadcast' AND reference_id = $1 GROUP BY subject
            `, [broadcast.id]);
            const subjectA = broadcast.subject;
            const subjectB = broadcast.subject_b;
            const rowA = opens.rows.find(r => r.subject === subjectA);
            const rowB = opens.rows.find(r => r.subject === subjectB);
            const openRateA = rowA && parseInt(rowA.sent, 10) > 0 ? parseInt(rowA.opened, 10) / parseInt(rowA.sent, 10) : 0;
            const openRateB = rowB && parseInt(rowB.sent, 10) > 0 ? parseInt(rowB.opened, 10) / parseInt(rowB.sent, 10) : 0;
            const winner = openRateB > openRateA ? 'B' : 'A';
            const winningSubject = winner === 'B' ? subjectB : subjectA;
            await pool.query('UPDATE broadcasts SET ab_test_winner = $1 WHERE id = $2', [winner, broadcast.id]);
            const sentIds = await pool.query('SELECT subscriber_id FROM email_log WHERE email_type = $1 AND reference_id = $2', ['broadcast', broadcast.id]);
            const sentSet = new Set(sentIds.rows.map(r => r.subscriber_id));
            const subscribers = await getBroadcastSubscribers(broadcast);
            const remaining = subscribers.filter(s => !sentSet.has(s.id));
            let sentCount = 0;
            for (const sub of remaining) {
                try {
                    const subLocale = sub.locale === 'am' ? 'am' : 'en';
                    const content = pickContentByLocale(broadcast, subLocale);
                    const subj = replaceMergeTags(winningSubject, sub);
                    const bodyPersonal = replaceMergeTags(content.body, sub);
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                        to: sub.email,
                        subject: subj,
                        html: wrapEmailTemplate(bodyPersonal)
                    });
                    await pool.query('INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5)', [sub.id, 'broadcast', broadcast.id, subj, 'sent']);
                    sentCount++;
                    await throttleAfterSend();
                } catch (e) { /* skip */ }
            }
            await pool.query('UPDATE broadcasts SET sent_count = sent_count + $1 WHERE id = $2', [sentCount, broadcast.id]);
            console.log(`✅ A/B remainder sent for broadcast ${broadcast.id}: winner ${winner}, ${sentCount} sent`);
        }
    } catch (error) {
        console.error('❌ Scheduler error (A/B remainder):', error.message);
    }
}

// Check sequence step conditions (previous_email_opened, has_tags, not_has_tags). stepPosition = step we're about to send.
async function checkSequenceStepConditions(subscriberId, sequenceId, stepPosition, conditions) {
    if (!conditions || typeof conditions !== 'object') return true;
    if (conditions.previous_email_opened && stepPosition > 1) {
        const prevStep = await pool.query(
            'SELECT id FROM sequence_emails WHERE sequence_id = $1 AND position = $2',
            [sequenceId, stepPosition - 1]
        );
        if (prevStep.rows.length === 0) return true;
        const prevOpened = await pool.query(
            "SELECT id FROM email_log WHERE subscriber_id = $1 AND email_type = 'sequence' AND reference_id = $2 AND status IN ('opened', 'clicked')",
            [subscriberId, prevStep.rows[0].id]
        );
        if (prevOpened.rows.length === 0) return false;
    }
    if (conditions.has_tags && Array.isArray(conditions.has_tags) && conditions.has_tags.length > 0) {
        const tagNames = conditions.has_tags;
        const hasAll = await pool.query(`
            SELECT COUNT(DISTINCT t.id) as c FROM subscriber_tags st
            JOIN tags t ON st.tag_id = t.id
            WHERE st.subscriber_id = $1 AND t.name = ANY($2::text[])
        `, [subscriberId, tagNames]);
        if (parseInt(hasAll.rows[0].c, 10) < tagNames.length) return false;
    }
    if (conditions.not_has_tags && Array.isArray(conditions.not_has_tags) && conditions.not_has_tags.length > 0) {
        const hasAny = await pool.query(`
            SELECT 1 FROM subscriber_tags st
            JOIN tags t ON st.tag_id = t.id
            WHERE st.subscriber_id = $1 AND t.name = ANY($2::text[]) LIMIT 1
        `, [subscriberId, conditions.not_has_tags]);
        if (hasAny.rows.length > 0) return false;
    }
    return true;
}

// ==================== PER-SEQUENCE UNSUBSCRIBE TOKENS ====================

function createSequenceUnsubToken(subscriberId, sequenceId) {
    const payload = { sub: subscriberId, seq: sequenceId, purpose: 'seq-unsub' };
    return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

function decodeSequenceUnsubToken(token) {
    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded || decoded.purpose !== 'seq-unsub') return null;
        const subscriberId = parseInt(decoded.sub, 10);
        const sequenceId = parseInt(decoded.seq, 10);
        if (!subscriberId || !sequenceId) return null;
        return { subscriberId, sequenceId };
    } catch {
        return null;
    }
}

// Process sequence emails. Only active sequences and active subscribers are sent; draft/paused sequences are never run.
// Subscribers with status 'pending' (unconfirmed) do NOT receive sequence emails — they must be 'active'.
async function processSequenceEmails() {
    try {
        const dueEmails = await pool.query(`
            SELECT ss.*, s.email, s.first_name, s.custom_fields, COALESCE(s.locale, 'en') as locale, seq.status as sequence_status
            FROM subscriber_sequences ss
            JOIN subscribers s ON ss.subscriber_id = s.id
            JOIN sequences seq ON ss.sequence_id = seq.id
            WHERE ss.status = 'active'
              AND seq.status = 'active'
              AND ss.next_email_at <= NOW()
              AND s.status = 'active'
        `);

        // If nothing to send, log hint when there are due rows blocked by subscriber status (e.g. pending)
        if (dueEmails.rows.length === 0) {
            const blocked = await pool.query(`
                SELECT COUNT(*) as cnt FROM subscriber_sequences ss
                JOIN subscribers s ON ss.subscriber_id = s.id
                JOIN sequences seq ON ss.sequence_id = seq.id
                WHERE ss.status = 'active' AND seq.status = 'active' AND ss.next_email_at <= NOW() AND s.status != 'active'
            `);
            if (Number(blocked.rows[0]?.cnt || 0) > 0) {
                console.log('[sequence] No emails sent this run;', blocked.rows[0].cnt, 'due row(s) skipped — subscriber status is not active (confirm email or set status=active for testing).');
            }
        }

        for (const subSeq of dueEmails.rows) {
            // Get the email at current_step + 1
            const emailResult = await pool.query(
                'SELECT * FROM sequence_emails WHERE sequence_id = $1 AND position = $2',
                [subSeq.sequence_id, subSeq.current_step + 1]
            );

            if (emailResult.rows.length === 0) {
                // No more emails, mark as completed
                await pool.query(
                    "UPDATE subscriber_sequences SET status = 'completed' WHERE id = $1",
                    [subSeq.id]
                );
                console.log(`✅ Sequence completed for ${subSeq.email}`);
                continue;
            }

            const seqEmail = emailResult.rows[0];
            const stepPosition = subSeq.current_step + 1;
            const conditions = typeof seqEmail.conditions === 'string' ? (() => { try { return JSON.parse(seqEmail.conditions); } catch (_) { return null; } })() : seqEmail.conditions;
            const shouldSend = await checkSequenceStepConditions(subSeq.subscriber_id, subSeq.sequence_id, stepPosition, conditions);

            if (!shouldSend) {
                // Skip this step, schedule next or complete
                const nextEmail = await pool.query(
                    'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 AND position = $2',
                    [subSeq.sequence_id, subSeq.current_step + 2]
                );
                if (nextEmail.rows.length > 0) {
                    const { delay_days, delay_hours } = nextEmail.rows[0];
                    const nextAt = new Date();
                    nextAt.setUTCDate(nextAt.getUTCDate() + (delay_days || 0));
                    nextAt.setUTCHours(nextAt.getUTCHours() + (delay_hours || 0));
                    await pool.query(
                        'UPDATE subscriber_sequences SET current_step = current_step + 1, next_email_at = $1 WHERE id = $2',
                        [nextAt, subSeq.id]
                    );
                } else {
                    await pool.query(
                        "UPDATE subscriber_sequences SET current_step = current_step + 1, status = 'completed' WHERE id = $1",
                        [subSeq.id]
                    );
                }
                continue;
            }

            try {
                const subLocale = subSeq.locale === 'am' ? 'am' : 'en';
                const content = pickContentByLocale(seqEmail, subLocale);
                const subscriber = { email: subSeq.email, first_name: subSeq.first_name, custom_fields: subSeq.custom_fields || {}, locale: subLocale };
                const subj = replaceMergeTags(content.subject, subscriber);
                const bodyRaw = replaceMergeTags(content.body, subscriber);
                const bodyHtml = renderSequenceBodyWithNameAndMarkdown(bodyRaw, subscriber);
                const logResult = await pool.query(
                    'INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [subSeq.subscriber_id, 'sequence', seqEmail.id, subj, 'sending']
                );
                const logId = logResult.rows[0].id;

                // Per-sequence unsubscribe link (localized)
                let bodyWithUnsub = bodyHtml;
                try {
                    const apiUrl = process.env.API_URL || 'http://localhost:3001';
                    const seqToken = createSequenceUnsubToken(subSeq.subscriber_id, subSeq.sequence_id);
                    const seqUnsubUrl = `${apiUrl}/api/unsubscribe-sequence?token=${encodeURIComponent(seqToken)}`;
                    const isAmSeq = (subSeq.locale === 'am');
                    const footerText = isAmSeq
                        ? `Եթե այլևս չես ցանկանում ստանալ այս շարքի նամակները, սեղմիր այստեղ՝ <a href="${seqUnsubUrl}">unsubscribe</a>.`
                        : `If you no longer want to receive this type of email, click here to <a href="${seqUnsubUrl}">unsubscribe</a>.`;
                    bodyWithUnsub += `
                        <div class="divider"></div>
                        <p class="muted" style="font-size:13px;color:#9ca3af;margin-top:16px;">
                            ${footerText}
                        </p>
                    `;
                } catch {
                    // If token generation fails, send without additional per-sequence link.
                }

                const mailOpts = {
                    from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                    to: subSeq.email,
                    subject: subj,
                    html: wrapEmailTemplate(bodyWithUnsub, logId)
                };
                const attachList = Array.isArray(seqEmail.attachments) ? seqEmail.attachments : (typeof seqEmail.attachments === 'string' ? (() => { try { return JSON.parse(seqEmail.attachments); } catch (_) { return []; } })() : []);
                if (attachList.length > 0) {
                    mailOpts.attachments = attachList.map((a) => {
                        const fullPath = path.isAbsolute(a.path) ? a.path : path.join(__dirname, a.path);
                        return fs.existsSync(fullPath) ? { filename: a.filename || path.basename(a.path), path: fullPath } : null;
                    }).filter(Boolean);
                }
                await transporter.sendMail(mailOpts);

                await pool.query("UPDATE email_log SET status = 'sent' WHERE id = $1", [logId]);

                console.log(`📧 Sequence email sent to ${subSeq.email}: ${content.subject}`);
                await throttleAfterSend();

                const nextEmail = await pool.query(
                    'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 AND position = $2',
                    [subSeq.sequence_id, subSeq.current_step + 2]
                );

                if (nextEmail.rows.length > 0) {
                    const { delay_days, delay_hours } = nextEmail.rows[0];
                    const nextAt = new Date();
                    nextAt.setUTCDate(nextAt.getUTCDate() + (delay_days || 0));
                    nextAt.setUTCHours(nextAt.getUTCHours() + (delay_hours || 0));

                    await pool.query(
                        'UPDATE subscriber_sequences SET current_step = current_step + 1, next_email_at = $1 WHERE id = $2',
                        [nextAt, subSeq.id]
                    );
                } else {
                    await pool.query(
                        "UPDATE subscriber_sequences SET current_step = current_step + 1, status = 'completed' WHERE id = $1",
                        [subSeq.id]
                    );
                }
            } catch (e) {
                console.error(`❌ Failed to send sequence email to ${subSeq.email}:`, e.message);
            }
        }
    } catch (error) {
        console.error('❌ Scheduler error (sequences):', error.message);
    }
}

// Process one pending job from email_send_jobs (broadcast send queue)
async function processEmailSendJobs() {
    try {
        const pick = await pool.query(
            `UPDATE email_send_jobs SET status = 'processing', started_at = NOW() WHERE id = (
                SELECT id FROM email_send_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1
            ) RETURNING *`
        );
        if (pick.rows.length === 0) return;
        const job = pick.rows[0];
        const payload = job.payload && typeof job.payload === 'object' ? job.payload : (typeof job.payload === 'string' ? (() => { try { return JSON.parse(job.payload); } catch (_) { return {}; } })() : {});
        try {
            if (job.job_type === 'broadcast') {
                await runBroadcastSend(job.reference_id, { ab_test: payload.ab_test, subject_b: payload.subject_b });
            }
            await pool.query("UPDATE email_send_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1", [job.id]);
            console.log(`✅ Job ${job.id} (${job.job_type} ${job.reference_id}) completed`);
        } catch (err) {
            const retryCount = (job.retry_count || 0) + 1;
            const maxRetries = job.max_retries != null ? job.max_retries : 3;
            if (retryCount < maxRetries) {
                await pool.query("UPDATE email_send_jobs SET status = 'pending', started_at = NULL, retry_count = $1, error_message = $2 WHERE id = $3", [retryCount, err.message, job.id]);
                console.log(`⚠️ Job ${job.id} failed, will retry (${retryCount}/${maxRetries}): ${err.message}`);
            } else {
                await pool.query("UPDATE email_send_jobs SET status = 'failed', completed_at = NOW(), retry_count = $1, error_message = $2 WHERE id = $3", [retryCount, err.message, job.id]);
                console.error(`❌ Job ${job.id} failed: ${err.message}`);
            }
        }
    } catch (e) {
        if (!/relation "email_send_jobs" does not exist/i.test(e.message)) console.error('Job worker error:', e.message);
    }
}

// Run scheduler every minute
function startScheduler() {
    console.log('⏰ Scheduler started - checking every minute');

    setInterval(async () => {
        await processScheduledBroadcasts();
        await processAbTestRemainder();
        await processSequenceEmails();
        await processEmailSendJobs();
    }, 60000); // Every 60 seconds

    // Also run immediately on startup
    setTimeout(async () => {
        await processScheduledBroadcasts();
        await processAbTestRemainder();
        await processSequenceEmails();
        await processEmailSendJobs();
    }, 5000);
}

// Start server
app.listen(PORT, async () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║   📧 Email Marketing API Running!                  ║
║   http://localhost:${PORT}                            ║
╠════════════════════════════════════════════════════╣
║   PostgreSQL Database: superengulfing_email        ║
╚════════════════════════════════════════════════════╝
  `);

    // Test DB connection
    try {
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL connected');
        // Ensure locale columns exist (migration 016)
        const fs = require('fs');
        const migrationPath = path.join(__dirname, 'migrations', '016_locale.sql');
        if (fs.existsSync(migrationPath)) {
            const migrationSql = fs.readFileSync(migrationPath, 'utf8');
            await pool.query(migrationSql);
            console.log('   Locale migration (016) applied');
        }
        const migration017Path = path.join(__dirname, 'migrations', '017_admin_auth.sql');
        if (fs.existsSync(migration017Path)) {
            const migration017Sql = fs.readFileSync(migration017Path, 'utf8');
            await pool.query(migration017Sql);
            console.log('   Admin auth migration (017) applied');
        }
        const migration018Path = path.join(__dirname, 'migrations', '018_admin_2fa.sql');
        if (fs.existsSync(migration018Path)) {
            const migration018Sql = fs.readFileSync(migration018Path, 'utf8');
            await pool.query(migration018Sql);
            console.log('   Admin 2FA migration (018) applied');
        }
        const migration023Path = path.join(__dirname, 'migrations', '023_email_attachments.sql');
        if (fs.existsSync(migration023Path)) {
            const migration023Sql = fs.readFileSync(migration023Path, 'utf8');
            await pool.query(migration023Sql);
            console.log('   Email attachments migration (023) applied');
        }
        console.log('   Profile: GET/PUT /api/me, PUT /api/me/password | Courses: /api/courses/resume, /api/me, etc.');
    } catch (e) {
        console.log('❌ PostgreSQL connection failed:', e.message);
    }

    // Test SMTP
    transporter.verify((error) => {
        if (error) {
            console.log('⚠️  SMTP Connection Error:', error.message);
        } else {
            console.log('✅ SMTP Server ready');
        }
    });

    // Start the scheduler
    startScheduler();
    // Start USDT payment polling
    startUsdtPolling();
});
