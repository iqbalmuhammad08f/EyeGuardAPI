require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerSpec = require('./swagger/swagger');
const { getSwaggerUIHtml } = require('./swagger/ui');

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const lightRoutes = require('./routes/light');
const statsRoutes = require('./routes/stats');
const profileRoutes = require('./routes/profile');

const app = express();
app.use(cors());
app.use(express.json());

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
            usage: 'POST /api/usage',
            light: 'POST /api/light',
            stats: {
                main: 'GET /api/stats?period=day|week|month',
                summary: 'GET /api/stats/summary',
                light: 'GET /api/stats/light?date=YYYY-MM-DD',
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
app.use('/api', usageRoutes);   // POST /api/usage
app.use('/api', lightRoutes);   // POST /api/light
app.use('/api', statsRoutes);   // GET  /api/stats, /api/stats/summary, /api/stats/light
app.use('/api', profileRoutes); // GET/PATCH/DELETE /api/profile/me

// ────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});