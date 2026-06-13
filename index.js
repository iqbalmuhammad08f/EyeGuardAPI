require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerSpec = require('./swagger/swagger');
const { getSwaggerUIHtml } = require('./swagger/ui');

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const lightRoutes = require('./routes/light');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');

const app = express();

// ────────────────────────────────────────────────
// CORS — batasi ke origin yang diizinkan
// ────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Izinkan request tanpa origin (Postman, curl, mobile native)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin "${origin}" tidak diizinkan`));
    },
    credentials: true,
}));

app.use(express.json());

// ────────────────────────────────────────────────
// Rate Limiting
// ────────────────────────────────────────────────

/** Limiter ketat untuk endpoint auth (mencegah brute force) */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 30,                   // maks 30 request per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.' },
});

/** Limiter umum untuk semua endpoint API */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// ────────────────────────────────────────────────
// Health Check
// ────────────────────────────────────────────────
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check endpoint
 *     description: Cek apakah server sedang berjalan dengan normal
 *     responses:
 *       200:
 *         description: Server berjalan normal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    });
});

// ────────────────────────────────────────────────
// Welcome / Root
// ────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        message: 'EyeGuard API is running',
        documentation: '/api-docs',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                verifyOtp: 'POST /api/auth/verify-otp',
                login: 'POST /api/auth/login',
                resendOtp: 'POST /api/auth/resend-otp',
                forgotPassword: 'POST /api/auth/forgot-password',
                resetPassword: 'POST /api/auth/reset-password',
            },
            usage: {
                send: 'POST /api/usage',
                history: 'GET /api/stats?period=day|week|month',
            },
            light: {
                send: 'POST /api/light',
                history: 'GET /api/stats/light?date=YYYY-MM-DD',
            },
            profile: {
                get: 'GET /api/profile/me',
                update: 'PATCH /api/profile/me',
                delete: 'DELETE /api/profile/me',
            },
            health: 'GET /api/health',
        },
    });
});

// ────────────────────────────────────────────────
// Swagger Docs
// ────────────────────────────────────────────────
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

app.get('/api-docs', (req, res) => {
    res.send(getSwaggerUIHtml('/api-docs.json'));
});

// ────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', usageRoutes);   // POST /api/usage | GET /api/stats | GET /api/stats/summary
app.use('/api', lightRoutes);   // POST /api/light | GET /api/stats/light
app.use('/api', profileRoutes); // GET/PATCH/DELETE /api/profile/me
app.use('/api/admin', adminRoutes);

// ────────────────────────────────────────────────
// 404 Handler
// ────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Endpoint '${req.method} ${req.path}' tidak ditemukan` });
});

// ────────────────────────────────────────────────
// Global Error Handler
// ────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // CORS error
    if (err.message && err.message.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server yang tidak terduga' });
});

// ────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});