require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const speakeasy = require('speakeasy');

// Generate confirmation token
const generateToken = () => crypto.randomBytes(32).toString('hex');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware (20MB limit so certificate PNG base64 fits)
const isProduction = process.env.NODE_ENV === 'production';
app.use(cors(isProduction ? { origin: process.env.CORS_ORIGIN || 'https://your-domain.com' } : undefined));
app.use(helmet());
app.use(express.json({ limit: 20 * 1024 * 1024 }));

// Serve static files (PDFs, etc.) from /public folder
app.use('/download', express.static(path.join(__dirname, 'public')));

// Test: GET /api/ping returns 200 if this server is running (use to verify port 3001 is this app)
app.get('/api/ping', (req, res) => res.json({ ok: true, message: 'Dashboard API' }));

// GET /api/site-media - Public: PDF and welcome video URLs per locale (for thank-you page)
const DEFAULT_WELCOME_VIDEO = 'https://fast.wistia.net/embed/iframe/bb9a8qt24g?videoFoam=true';
app.get('/api/site-media', (req, res) => {
    const locale = (req.query.locale === 'am' ? 'am' : 'en');
    const pdfEnv = locale === 'am' ? (process.env.PDF_LINK_AM || process.env.PDF_LINK) : (process.env.PDF_LINK_EN || process.env.PDF_LINK);
    const videoEnv = locale === 'am' ? process.env.WELCOME_VIDEO_AM : process.env.WELCOME_VIDEO_EN;
    res.json({
        welcomePdfUrl: pdfEnv || 'https://drive.google.com/file/d/1DEP8ABq-vjZfK1TWTYQkhJEAcSasqZn5/view?usp=sharing',
        welcomeVideoUrl: videoEnv || DEFAULT_WELCOME_VIDEO
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
    message: { success: false, message: 'Too many login attempts, try again later' },
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
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Admin two-step auth: allowed emails (union of ADMIN_EMAILS_EN + ADMIN_EMAILS_AM, fallback: ADMIN_EMAILS)
const adminEmailsEn = (process.env.ADMIN_EMAILS_EN || process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const adminEmailsAm = (process.env.ADMIN_EMAILS_AM || process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
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

// Certificate: premium diploma-style design (no "Signed" line)
// Server-side certificate strings for PNG/SVG and email (locale from dashboard_users)
const CERT_TRANSLATIONS = {
    en: {
        certTitle: 'MY DECLARATION',
        certIntroPrefix: 'I, ',
        certIntroSuffix: ', declare the following:',
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
        certCommitment: '[ THIS IS MY COMMITMENT \u2192 ]',
        shareTitle: 'My Declaration \u2014 SuperEngulfing',
        shareDescription: 'This is my commitment.',
        shareAlt: 'Certificate of Commitment',
        emailSubject: 'Your Declaration \u2014 SuperEngulfing',
        emailTitle: 'Your Declaration',
        emailLedger: 'This declaration is stored on the SuperEngulfing secure ledger.',
        emailFooter: 'SuperEngulfing. All rights reserved.'
    },
    am: {
        certTitle: 'ԻՄ ՀԱՅՏԱՐԱՐՈՒԹՅՈՒՆԸ',
        certIntroPrefix: 'Ես՝ ',
        certIntroSuffix: '-ս, հայտարարում եմ հետևյալը.',
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
        certCommitment: '[ ՍԱ ԻՄ ՈՐՈՇՈՒՄՆ Է → ]',
        shareTitle: 'Սա իմ որոշումն է — SuperEngulfing',
        shareDescription: 'Սա իմ հանձնառությունն է:',
        shareAlt: 'Հանձնառության վկայական',
        emailSubject: 'Ձեր Հայտարարությունը — SuperEngulfing',
        emailTitle: 'Ձեր Հայտարարությունը',
        emailLedger: 'Այս հայտարարությունը պահպանված է SuperEngulfing-ի ապահով գրանցամատյանում (ledger):',
        emailFooter: 'SuperEngulfing. Բոլոր իրավունքները պաշտպանված են:'
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
    const date = new Date().toISOString().split('T')[0];
    const e = (s) => escapeForSvg(tr[s] || s);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="880" viewBox="0 0 640 880">
  <defs>
    <linearGradient id="bgCert" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#080c14"/>
      <stop offset="35%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#020617"/>
    </linearGradient>
    <linearGradient id="goldMain" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fde68a"/>
      <stop offset="35%" style="stop-color:#d4af37"/>
      <stop offset="100%" style="stop-color:#92400e"/>
    </linearGradient>
    <linearGradient id="goldSoft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(212,175,55,0.5)"/>
      <stop offset="100%" style="stop-color:rgba(212,175,55,0.15)"/>
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="640" height="880" fill="url(#bgCert)"/>
  <!-- Outer ornamental frame -->
  <rect x="0" y="0" width="640" height="880" fill="none" stroke="url(#goldMain)" stroke-width="3"/>
  <rect x="8" y="8" width="624" height="864" fill="none" stroke="url(#goldSoft)" stroke-width="1" opacity="0.6"/>
  <!-- Corner flourishes -->
  <line x1="20" y1="20" x2="20" y2="68" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="20" x2="68" y2="20" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="620" y1="20" x2="620" y2="68" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="572" y1="20" x2="620" y2="20" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="812" x2="20" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="20" y1="860" x2="68" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="620" y1="812" x2="620" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <line x1="572" y1="860" x2="620" y2="860" stroke="url(#goldMain)" stroke-width="2" opacity="0.85"/>
  <!-- Top rule -->
  <line x1="100" y1="56" x2="540" y2="56" stroke="url(#goldMain)" stroke-width="2" opacity="0.9"/>
  <text x="320" y="100" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="rgba(212,175,55,0.85)" letter-spacing="0.35em">${e('certTitle')}</text>
  <line x1="100" y1="118" x2="540" y2="118" stroke="url(#goldMain)" stroke-width="1" opacity="0.6"/>
  <!-- Intro line -->
  <text x="320" y="162" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#f1f5f9">${e('certIntroPrefix')}<tspan fill="#fbbf24" font-weight="bold">${name}</tspan>${e('certIntroSuffix')}</text>
  <line x1="80" y1="188" x2="560" y2="188" stroke="rgba(212,175,55,0.25)" stroke-width="1"/>
  <!-- Declaration lines -->
  <text x="320" y="222" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl1')}</text>
  <text x="320" y="252" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl2')}</text>
  <text x="320" y="282" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl3')}</text>
  <text x="320" y="324" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#fbbf24" font-weight="bold">${e('decl4')}</text>
  <text x="320" y="364" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl5')}</text>
  <text x="320" y="394" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl6')}</text>
  <text x="320" y="424" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl7')}</text>
  <text x="320" y="454" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl8')}</text>
  <text x="320" y="484" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl9')}</text>
  <text x="320" y="514" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#cbd5e1">${e('decl10')}</text>
  <text x="320" y="556" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#f8fafc" font-weight="bold">${e('decl11')}</text>
  <!-- Commitment block -->
  <line x1="80" y1="598" x2="560" y2="598" stroke="url(#goldSoft)" stroke-width="1"/>
  <text x="320" y="638" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="url(#goldMain)" filter="url(#softGlow)" letter-spacing="0.12em">${e('certCommitment')}</text>
  <line x1="120" y1="668" x2="520" y2="668" stroke="url(#goldMain)" stroke-width="1" opacity="0.6"/>
  <!-- Seal -->
  <circle cx="320" cy="758" r="40" fill="none" stroke="url(#goldMain)" stroke-width="2.5" opacity="0.95"/>
  <circle cx="320" cy="758" r="34" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
  <text x="320" y="766" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#d4af37" font-weight="bold">SE</text>
  <text x="320" y="818" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#64748b">${date}</text>
  <text x="320" y="848" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#475569" letter-spacing="0.08em">SuperEngulfing</text>
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
        // Certificate email — light theme, locale-aware
        const certificateHtml = `
<!DOCTYPE html>
<html lang="${locale === 'am' ? 'hy' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(tr.emailTitle)}</title></head>
<body style="margin:0; background:#f8fafc; color:#0f172a; font-family: Georgia, 'Times New Roman', serif;">
  <div style="max-width:620px; margin:0 auto; padding: 32px 20px;">
    <div style="text-align: center; margin-bottom: 28px;">
      <span style="color: #059669; font-size: 20px; font-weight: 700; letter-spacing: 0.05em;">SuperEngulfing</span>
      <div style="color: #64748b; font-size: 11px; margin-top: 6px; letter-spacing: 0.2em;">${esc(tr.certTitle)}</div>
    </div>
    <div style="background:#ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="border: 2px solid #fbbf24; padding: 36px 28px; background:#fffbeb; border-radius: 8px; text-align: center;">
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 16px; max-width: 280px;"></div>
        <h1 style="font-family: Georgia, serif; color: #b45309; font-size: 15px; font-weight: 400; margin: 0 0 12px 0; letter-spacing: 0.15em;">${esc(tr.certTitle)}</h1>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 24px; max-width: 280px;"></div>
        <p style="font-size: 14px; line-height: 1.8; color: #334155; margin: 0 0 20px 0;">${esc(tr.certIntroPrefix)}<strong style="color: #b45309;">${esc(firstName)}</strong>${esc(tr.certIntroSuffix)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl1)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl2)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl3)}</p>
        <p style="font-size: 13px; line-height: 2; color: #b45309; font-weight: bold; margin: 16px 0 4px 0;">${esc(tr.decl4)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl5)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl6)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl7)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl8)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl9)}</p>
        <p style="font-size: 13px; line-height: 2; color: #475569; margin: 4px 0;">${esc(tr.decl10)}</p>
        <p style="font-size: 14px; line-height: 1.8; color: #0f172a; font-weight: bold; margin: 20px 0 24px 0;">${esc(tr.decl11)}</p>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 16px; max-width: 240px;"></div>
        <p style="font-size: 12px; color: #b45309; letter-spacing: 0.1em; margin: 0 0 16px 0;">${esc(tr.certCommitment)}</p>
        <div style="height: 2px; background: linear-gradient(90deg, transparent, #fbbf24, transparent); margin: 0 auto 24px; max-width: 240px;"></div>
        <div style="width: 56px; height: 56px; margin: 0 auto 10px; border: 2px solid #f59e0b; border-radius: 50%; line-height: 52px; text-align: center; background: #fef3c7;"><span style="color: #b45309; font-size: 16px; font-weight: bold;">SE</span></div>
        <p style="margin: 0; font-size: 11px; color: #64748b;">${new Date().toISOString().split('T')[0]}</p>
      </div>
      <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 24px;">${esc(tr.emailLedger)}</p>
    </div>
    <div style="text-align: center; margin-top: 28px; color: #94a3b8; font-size: 11px;">&copy; ${new Date().getFullYear()} ${esc(tr.emailFooter)}</div>
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
            return res.json({ success: true, emailMasked: mask, setupRequired: false });
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
            window: 1
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

    try {
        // Check if exists
        const existing = await pool.query('SELECT id, confirmed_at FROM subscribers WHERE email = $1', [email.toLowerCase()]);

        if (existing.rows.length > 0) {
            if (existing.rows[0].confirmed_at) {
                return res.json({ success: true, message: 'You are already subscribed!' });
            } else {
                return res.json({ success: true, message: 'Please check your email and confirm your subscription!' });
            }
        }

        // Generate confirmation token
        const token = generateToken();

        // Insert new subscriber with pending status
        const result = await pool.query(
            'INSERT INTO subscribers (email, first_name, source, status, confirmation_token, locale) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [email.toLowerCase(), first_name || null, source || 'website', 'pending', token, locale]
        );

        // Send confirmation email
        await sendConfirmationEmail(email, token, locale);

        // Log email
        await pool.query(
            'INSERT INTO email_log (subscriber_id, email_type, subject, status) VALUES ($1, $2, $3, $4)',
            [result.rows[0].id, 'confirmation', 'Confirm your subscription', 'sent']
        );

        res.status(201).json({ success: true, message: 'Please check your email and click the confirmation link!' });
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
            return res.status(400).send('<html><body style="background:#f8fafc;color:#0f172a;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;"><div style="text-align:center;"><h1>❌ Invalid Link</h1><p style="color:#64748b;">This confirmation link is invalid or expired.</p></div></body></html>');
        }

        const subscriber = result.rows[0];

        if (subscriber.confirmed_at) {
            // Already confirmed - redirect to thank you page
            return res.redirect(process.env.THANK_YOU_URL || 'http://localhost:5173/thank-you');
        }

        // Update subscriber to confirmed
        await pool.query(
            "UPDATE subscribers SET status = 'active', confirmed_at = NOW(), confirmation_token = NULL WHERE id = $1",
            [subscriber.id]
        );

        // Send welcome email with PDF link
        await sendWelcomeEmail(subscriber.email, (subscriber.locale === 'am' ? 'am' : 'en'));

        // Log
        await pool.query(
            'INSERT INTO email_log (subscriber_id, email_type, subject, status) VALUES ($1, $2, $3, $4)',
            [subscriber.id, 'welcome', 'Welcome Email with PDF', 'sent']
        );

        // Redirect to thank you page with PDF download
        res.redirect(process.env.THANK_YOU_URL || 'http://localhost:5173/thank-you');
    } catch (error) {
        res.status(500).send('Error confirming subscription');
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
                let nextEmailAt = new Date();
                if (firstEmail.rows.length > 0) {
                    const { delay_days, delay_hours } = firstEmail.rows[0];
                    nextEmailAt.setDate(nextEmailAt.getDate() + (delay_days || 0));
                    nextEmailAt.setHours(nextEmailAt.getHours() + (delay_hours || 0));
                }
                await pool.query('INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at) VALUES ($1, $2, 0, $3)', [id, seqId, nextEmailAt]);
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
    const locale = (reqLocale === 'am' ? 'am' : 'en');
    try {
        const result = await pool.query(
            'INSERT INTO access_requests (email, uid, status, locale) VALUES ($1, $2, $3, $4) RETURNING *',
            [email.toLowerCase().trim(), String(uid).trim(), 'pending', locale]
        );
        await sendRequestReceivedEmail(email, locale);
        await sendAdminNewAccessRequestNotification(email.toLowerCase().trim(), String(uid).trim(), locale);
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
        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK').catch(() => { });
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
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    try {
        const result = await pool.query('SELECT * FROM dashboard_users WHERE email = $1', [email.toLowerCase()]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const user = result.rows[0];
        if (!user.password_hash) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password' });
        const secret = process.env.JWT_SECRET || 'superengulfing-dashboard-secret';
        const token = jwt.sign(
            { email: user.email, sub: user.id },
            secret,
            { expiresIn: '7d' }
        );
        const locale = (user.locale === 'am') ? 'am' : 'en';
        res.json({ success: true, token, locale });
    } catch (error) {
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

// GET /api/courses - List all courses (public, for catalog)
app.get('/api/courses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.title, c.description, c.image_url, c.created_at,
                   (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
            FROM courses c
            ORDER BY c.created_at DESC
        `);
        res.json({ courses: result.rows });
    } catch (error) {
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
            'SELECT id, title, description, image_url, created_at FROM courses WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/enrollments - Enroll in course (JWT)
app.post('/api/enrollments', requireAuth, async (req, res) => {
    const { course_id } = req.body;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });
    try {
        const userId = req.user.id;
        await pool.query(
            'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING',
            [userId, course_id]
        );
        res.json({ success: true });
    } catch (error) {
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
    const { title, description, image_url } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    try {
        const result = await pool.query(
            'INSERT INTO courses (title, description, image_url, updated_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
            [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/courses/:id - Update course (admin)
app.put('/api/courses/:id', requireAdminAuth, async (req, res) => {
    const id = req.params.id;
    const { title, description, image_url } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    try {
        const result = await pool.query(
            'UPDATE courses SET title = $1, description = $2, image_url = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [title.trim(), description && description.trim() || null, image_url && image_url.trim() || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/courses/:id - Delete course (admin)
app.delete('/api/courses/:id', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        let nextEmailAt = new Date();
        if (firstEmail.rows.length > 0) {
            const { delay_days, delay_hours } = firstEmail.rows[0];
            nextEmailAt.setDate(nextEmailAt.getDate() + (delay_days || 0));
            nextEmailAt.setHours(nextEmailAt.getHours() + (delay_hours || 0));
        }
        let count = 0;
        for (const id of subscriber_ids) {
            const existing = await pool.query('SELECT id FROM subscriber_sequences WHERE subscriber_id = $1 AND sequence_id = $2', [id, sequence_id]);
            if (existing.rows.length === 0) {
                await pool.query('INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at) VALUES ($1, $2, 0, $3)', [id, sequence_id, nextEmailAt]);
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

// GET /api/tags - List all tags
app.get('/api/tags', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tags ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/tags - Create tag
app.post('/api/tags', requireAdminAuth, async (req, res) => {
    const { name, color } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *',
            [name, color || '#39FF14']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/tags/:id - Delete tag
app.delete('/api/tags/:id', requireAdminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATES ====================

// GET /api/templates - List templates
app.get('/api/templates', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/templates - Create template
app.post('/api/templates', requireAdminAuth, async (req, res) => {
    const { name, subject, body } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO templates (name, subject, body) VALUES ($1, $2, $3) RETURNING *',
            [name, subject, body]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/templates/:id - Update template
app.put('/api/templates/:id', requireAdminAuth, async (req, res) => {
    const { name, subject, body } = req.body;

    try {
        const result = await pool.query(
            'UPDATE templates SET name = $1, subject = $2, body = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [name, subject, body, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/templates/:id - Delete template
app.delete('/api/templates/:id', requireAdminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BROADCASTS ====================

// GET /api/broadcasts - List all broadcasts
app.get('/api/broadcasts', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM broadcasts ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/broadcasts - Create broadcast
app.post('/api/broadcasts', requireAdminAuth, async (req, res) => {
    const { name, subject, body } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO broadcasts (name, subject, body) VALUES ($1, $2, $3) RETURNING *',
            [name, subject, body]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get subscribers for a broadcast (all active or by segment tags)
async function getBroadcastSubscribers(broadcast) {
    const segmentType = broadcast.segment_type || 'all';
    const tagIds = broadcast.segment_tag_ids && Array.isArray(broadcast.segment_tag_ids) ? broadcast.segment_tag_ids : [];
    if (segmentType === 'tags' && tagIds.length > 0) {
        const result = await pool.query(`
            SELECT DISTINCT s.* FROM subscribers s
            INNER JOIN subscriber_tags st ON s.id = st.subscriber_id
            WHERE s.status = 'active' AND st.tag_id = ANY($1::int[])
        `, [tagIds]);
        return result.rows;
    }
    const result = await pool.query("SELECT * FROM subscribers WHERE status = 'active'");
    return result.rows;
}

// POST /api/broadcasts/:id/send - Send broadcast now. Body: optional { ab_test: true, subject_b: "..." } for A/B test (sends 20%, remainder after 24h)
app.post('/api/broadcasts/:id/send', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { ab_test, subject_b } = req.body || {};

    try {
        const broadcast = await pool.query('SELECT * FROM broadcasts WHERE id = $1', [id]);
        if (broadcast.rows.length === 0) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        const b = broadcast.rows[0];
        let { subject, body } = b;
        if (ab_test && subject_b) {
            await pool.query(
                'UPDATE broadcasts SET subject_b = $1, ab_test_ends_at = NOW() + INTERVAL \'24 hours\', ab_test_winner = NULL WHERE id = $2',
                [subject_b, id]
            );
        }
        const subscribers = { rows: await getBroadcastSubscribers(b) };
        let toSend = subscribers.rows;
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
            const useSubjectB = useAbTest && i >= Math.floor(toSend.length / 2);
            const subjectToUse = useSubjectB && b.subject_b ? b.subject_b : subject;
            try {
                const subj = replaceMergeTags(subjectToUse, sub);
                const bodyPersonal = replaceMergeTags(body, sub);
                // Create log first for tracking ID
                const logResult = await pool.query(
                    'INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [sub.id, 'broadcast', id, subj, 'sending']
                );
                const logId = logResult.rows[0].id;

                await transporter.sendMail({
                    from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                    to: sub.email,
                    subject: subj,
                    html: wrapEmailTemplate(bodyPersonal, logId)
                });

                // Update to sent
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

        res.json({ success: true, sentCount, failedCount, abTest: useAbTest ? '20% sent; remainder in 24h' : null });
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

// PUT /api/broadcasts/:id - Update broadcast (name, subject, body, segment_type, segment_tag_ids)
app.put('/api/broadcasts/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { name, subject, body, segment_type, segment_tag_ids } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name !== undefined) { params.push(name); updates.push('name = $' + params.length); }
        if (subject !== undefined) { params.push(subject); updates.push('subject = $' + params.length); }
        if (body !== undefined) { params.push(body); updates.push('body = $' + params.length); }
        if (segment_type !== undefined) { params.push(segment_type); updates.push('segment_type = $' + params.length); }
        if (segment_tag_ids !== undefined) { params.push(JSON.stringify(segment_tag_ids)); updates.push('segment_tag_ids = $' + params.length); }
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

// DELETE /api/broadcasts/:id - Delete broadcast
app.delete('/api/broadcasts/:id', requireAdminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM broadcasts WHERE id = $1', [req.params.id]);
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

// GET /api/sequences - List sequences
app.get('/api/sequences', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM sequence_emails WHERE sequence_id = s.id) as email_count,
        (SELECT COUNT(*) FROM subscriber_sequences WHERE sequence_id = s.id) as subscriber_count
      FROM sequences s ORDER BY created_at DESC
    `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences - Create sequence
app.post('/api/sequences', requireAdminAuth, async (req, res) => {
    const { name } = req.body;

    try {
        const result = await pool.query('INSERT INTO sequences (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sequences/:id/emails - Get emails in sequence
app.get('/api/sequences/:id/emails', requireAdminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM sequence_emails WHERE sequence_id = $1 ORDER BY position',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sequences/:id/emails - Add email to sequence
app.post('/api/sequences/:id/emails', requireAdminAuth, async (req, res) => {
    const { subject, body, delay_days, delay_hours } = req.body;

    try {
        // Get next position
        const posResult = await pool.query(
            'SELECT COALESCE(MAX(position), 0) + 1 as next FROM sequence_emails WHERE sequence_id = $1',
            [req.params.id]
        );

        const result = await pool.query(
            'INSERT INTO sequence_emails (sequence_id, position, subject, body, delay_days, delay_hours) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [req.params.id, posResult.rows[0].next, subject, body, delay_days || 0, delay_hours || 0]
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
    const { subject, body, delay_days, delay_hours } = req.body;

    try {
        const result = await pool.query(
            'UPDATE sequence_emails SET subject = COALESCE($1, subject), body = COALESCE($2, body), delay_days = COALESCE($3, delay_days), delay_hours = COALESCE($4, delay_hours) WHERE id = $5 AND sequence_id = $6 RETURNING *',
            [subject, body, delay_days != null ? delay_days : null, delay_hours != null ? delay_hours : null, emailId, seqId]
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

// PUT /api/sequences/:id - Update sequence
app.put('/api/sequences/:id', requireAdminAuth, async (req, res) => {
    const { name, status } = req.body;

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

// DELETE /api/sequences/:id - Delete sequence
app.delete('/api/sequences/:id', requireAdminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM sequences WHERE id = $1', [req.params.id]);
        res.json({ success: true });
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

        // Get first email's delay
        const firstEmail = await pool.query(
            'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 ORDER BY position LIMIT 1',
            [seqId]
        );

        let nextEmailAt = new Date();
        if (firstEmail.rows.length > 0) {
            const { delay_days, delay_hours } = firstEmail.rows[0];
            nextEmailAt.setDate(nextEmailAt.getDate() + (delay_days || 0));
            nextEmailAt.setHours(nextEmailAt.getHours() + (delay_hours || 0));
        }

        await pool.query(
            'INSERT INTO subscriber_sequences (subscriber_id, sequence_id, current_step, next_email_at) VALUES ($1, $2, $3, $4)',
            [id, seqId, 0, nextEmailAt]
        );

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
        return { total, today, thisWeek, emailsSent };
    };
    try {
        const { total, today, thisWeek, emailsSent } = await runStats();
        res.json({
            total: parseInt(total.rows[0].count),
            today: parseInt(today.rows[0].count),
            thisWeek: parseInt(thisWeek.rows[0].count),
            emailsSent: parseInt(emailsSent.rows[0].count)
        });
    } catch (error) {
        if (error.message && /column.*locale.*does not exist/i.test(error.message)) {
            try {
                await pool.query("ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en'");
                await pool.query('CREATE INDEX IF NOT EXISTS idx_subscribers_locale ON subscribers(locale)');
                const { total, today, thisWeek, emailsSent } = await runStats();
                return res.json({
                    total: parseInt(total.rows[0].count),
                    today: parseInt(today.rows[0].count),
                    thisWeek: parseInt(thisWeek.rows[0].count),
                    emailsSent: parseInt(emailsSent.rows[0].count)
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

// Replace merge tags in subject/body for broadcasts and sequences. subscriber: { email, first_name, custom_fields (optional) }
function replaceMergeTags(text, subscriber) {
    if (!text || typeof text !== 'string') return text;
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const first = (subscriber && subscriber.first_name) ? String(subscriber.first_name).trim() : '';
    const email = (subscriber && subscriber.email) ? subscriber.email : '';
    const unsubscribeUrl = `${apiUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
    let out = text
        .replace(/\{\{first_name\}\}/g, first)
        .replace(/\{\{email\}\}/g, email)
        .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
    if (subscriber && subscriber.custom_fields && typeof subscriber.custom_fields === 'object') {
        for (const [key, value] of Object.entries(subscriber.custom_fields)) {
            if (key && value != null) out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        }
    }
    return out;
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
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; color: #0f172a; padding: 32px 16px; line-height: 1.6; }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .card { background: #ffffff; border-radius: 16px; padding: 40px 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
    .logo { color: #059669; font-size: 22px; font-weight: 700; letter-spacing: 0.02em; }
    .tagline { color: #64748b; font-size: 12px; margin-top: 4px; }
    .content { color: #334155; font-size: 15px; }
    .content h1 { color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
    .content p { margin: 0 0 14px 0; }
    .content ul { margin: 12px 0; padding-left: 20px; }
    .content li { margin-bottom: 6px; }
    .content a { color: #059669; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .btn { display: inline-block; background: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { margin-top: 32px; text-align: center; color: #64748b; font-size: 12px; }
    .footer a { color: #64748b; }
    .muted { color: #64748b; font-size: 13px; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
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
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Հաստատեք բաժանորդագրությունը – SuperEngulfing' : 'Confirm your subscription - SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Մեկ քայլ ևս</h1>
                <p>Ողջույն,</p>
                <p>Շնորհակալություն <strong>SuperEngulfing</strong>-ին միանալու համար: Ձեր <strong>Liquidity Sweep Cheatsheet</strong> PDF-ը ստանալու համար խնդրում ենք հաստատել բաժանորդագրությունը՝ սեղմելով ներքևի կոճակը:</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${confirmUrl}" class="btn">Հաստատել բաժանորդագրությունը</a>
                </p>
                <div class="divider"></div>
                <p class="muted">Եթե դուք չեք բաժանորդագրվել, կարող եք պարզապես անտեսել այս նամակը:</p>
            ` : `
                <h1>One more step!</h1>
                <p>Hello,</p>
                <p>Thank you for signing up to <strong>SuperEngulfing</strong>. To receive your <strong>Liquidity Sweep Cheatsheet</strong> PDF, please confirm your subscription by clicking the button below.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${confirmUrl}" class="btn">Confirm my subscription</a>
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

// Send welcome email WITH PDF link (sent after confirmation)
async function sendWelcomeEmail(email, locale = 'en') {
    const pdfLinkEnv = locale === 'am' ? (process.env.PDF_LINK_AM || process.env.PDF_LINK) : (process.env.PDF_LINK_EN || process.env.PDF_LINK);
    const pdfLink = pdfLinkEnv || 'https://drive.google.com/file/d/1DEP8ABq-vjZfK1TWTYQkhJEAcSasqZn5/view?usp=sharing';
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const unsubscribeUrl = `${apiUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
    const fromAddr = process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>';
    const replyTo = process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || 'info@superengulfing.com';
    const isAm = locale === 'am';
    const subject = isAm ? 'Ձեր PDF-ը պատրաստ է – SuperEngulfing' : 'Your PDF is ready - SuperEngulfing';
    const htmlContent = isAm ? `
                <h1>Ձեր PDF-ը պատրաստ է</h1>
                <p>Ողջույն,</p>
                <p>Շնորհակալություն բաժանորդագրությունը հաստատելու համար: Ինչպես և խոստացել էինք, ահա ձեր <strong>Liquidity Sweep Cheatsheet</strong>-ը:</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${pdfLink}" class="btn">Ներբեռնել PDF-ը</a>
                </p>
                <p><strong>Ինչ կա ներսում.</strong></p>
                <ul>
                    <li>8 հիմնական setup-ներ՝ շրջադարձերը (reversals) հայտնաբերելու համար</li>
                    <li>Մուտքի և ելքի կանոններ</li>
                    <li>Օրինակներ իրական գծապատկերների վրա</li>
                </ul>
                <div class="divider"></div>
                <p class="muted"><a href="${unsubscribeUrl}">Չեղարկել բաժանորդագրությունը</a></p>
            ` : `
                <h1>Your PDF is ready</h1>
                <p>Hello,</p>
                <p>Thank you for confirming your subscription. As promised, here is your <strong>Liquidity Sweep Cheatsheet</strong>.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${pdfLink}" class="btn">Download your PDF</a>
                </p>
                <p><strong>What's inside:</strong></p>
                <ul>
                    <li>8 essential setups for identifying reversals</li>
                    <li>Entry and exit guidelines</li>
                    <li>Real chart examples</li>
                </ul>
                <div class="divider"></div>
                <p class="muted"><a href="${unsubscribeUrl}">Unsubscribe</a> from these emails.</p>
            `;
    const textContent = isAm ? `Ձեր PDF-ը պատրաստ է – SuperEngulfing\n\nՆերբեռնել Liquidity Sweep Cheatsheet:\n${pdfLink}\n\nՉեղարկել: ${unsubscribeUrl}` : `Your PDF is Ready!\n\nThank you for confirming your subscription to SuperEngulfing.\n\nDownload your Liquidity Sweep Cheatsheet:\n${pdfLink}\n\nThis PDF contains: 8 essential setups, entry/exit guidelines, real chart examples.\n\nUnsubscribe: ${unsubscribeUrl}`;

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
                ${adminUrl ? `<p style="margin-top: 20px;"><a href="${adminUrl}" class="btn">Review in Admin</a></p>` : ''}
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
                <p style="margin: 12px 0 20px 0;"><a href="${TRADINGVIEW_INDICATOR_URL}" class="btn">Open TradingView – SuperEngulfing REV + RUN</a></p>
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
                    <a href="${TRADINGVIEW_INDICATOR_URL}" class="btn">Open TradingView – SuperEngulfing</a>
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const pathPrefix = locale === 'am' ? '/am' : '';
    const setPasswordUrl = `${frontendUrl}${pathPrefix}/set-password?token=${encodeURIComponent(token)}`;
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
                    <a href="${setPasswordUrl}" class="btn">Սահմանել գաղտնաբառը</a>
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
                    <a href="${setPasswordUrl}" class="btn">Set your password</a>
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

// ==================== EMAIL ANALYTICS ====================

// 1x1 transparent pixel for tracking email opens
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

// GET /api/track/open/:logId - Track email open
app.get('/api/track/open/:logId', async (req, res) => {
    const { logId } = req.params;

    try {
        // Update email_log to mark as opened
        await pool.query(
            "UPDATE email_log SET status = 'opened', opened_at = NOW() WHERE id = $1 AND status = 'sent'",
            [logId]
        );
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
                    const subj = replaceMergeTags(broadcast.subject, sub);
                    const bodyPersonal = replaceMergeTags(broadcast.body, sub);
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
                    const subj = replaceMergeTags(winningSubject, sub);
                    const bodyPersonal = replaceMergeTags(broadcast.body, sub);
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

// Process sequence emails
async function processSequenceEmails() {
    try {
        // Get all subscriber_sequences where next_email_at <= now and sequence is active
        const dueEmails = await pool.query(`
            SELECT ss.*, s.email, s.first_name, s.custom_fields, seq.status as sequence_status
            FROM subscriber_sequences ss
            JOIN subscribers s ON ss.subscriber_id = s.id
            JOIN sequences seq ON ss.sequence_id = seq.id
            WHERE ss.status = 'active' 
              AND seq.status = 'active' 
              AND ss.next_email_at <= NOW()
              AND s.status = 'active'
        `);

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

            // Send the email
            try {
                const subscriber = { email: subSeq.email, first_name: subSeq.first_name, custom_fields: subSeq.custom_fields || {} };
                const subj = replaceMergeTags(seqEmail.subject, subscriber);
                const bodyPersonal = replaceMergeTags(seqEmail.body, subscriber);
                // Log first
                const logResult = await pool.query(
                    'INSERT INTO email_log (subscriber_id, email_type, reference_id, subject, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [subSeq.subscriber_id, 'sequence', seqEmail.id, subj, 'sending']
                );
                const logId = logResult.rows[0].id;

                await transporter.sendMail({
                    from: process.env.SMTP_FROM || '"SuperEngulfing" <info@superengulfing.com>',
                    to: subSeq.email,
                    subject: subj,
                    html: wrapEmailTemplate(bodyPersonal, logId)
                });

                await pool.query("UPDATE email_log SET status = 'sent' WHERE id = $1", [logId]);

                console.log(`📧 Sequence email sent to ${subSeq.email}: ${seqEmail.subject}`);
                await throttleAfterSend();

                // Get next email delay
                const nextEmail = await pool.query(
                    'SELECT delay_days, delay_hours FROM sequence_emails WHERE sequence_id = $1 AND position = $2',
                    [subSeq.sequence_id, subSeq.current_step + 2]
                );

                if (nextEmail.rows.length > 0) {
                    const { delay_days, delay_hours } = nextEmail.rows[0];
                    const nextAt = new Date();
                    nextAt.setDate(nextAt.getDate() + (delay_days || 0));
                    nextAt.setHours(nextAt.getHours() + (delay_hours || 0));

                    await pool.query(
                        'UPDATE subscriber_sequences SET current_step = current_step + 1, next_email_at = $1 WHERE id = $2',
                        [nextAt, subSeq.id]
                    );
                } else {
                    // This was the last email
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

// Run scheduler every minute
function startScheduler() {
    console.log('⏰ Scheduler started - checking every minute');

    setInterval(async () => {
        await processScheduledBroadcasts();
        await processAbTestRemainder();
        await processSequenceEmails();
    }, 60000); // Every 60 seconds

    // Also run immediately on startup
    setTimeout(async () => {
        await processScheduledBroadcasts();
        await processAbTestRemainder();
        await processSequenceEmails();
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
});
