require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const statsRoutes = require('./routes/stats');

const app = express();
app.use(cors());
app.use(express.json());

// Welcome route (menampilkan daftar endpoint)
app.get('/', (req, res) => {
    res.json({
        message: 'EyeGuard API is running',
        documentation: '/api-docs',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                verifyOtp: 'POST /api/auth/verify-otp',
                resendOtp: 'POST /api/auth/resend-otp',
                login: 'POST /api/auth/login',
                forgotPassword: 'POST /api/auth/forgot-password',
                resetPassword: 'POST /api/auth/reset-password'
            },
            usage: 'POST /api/usage (protected)',
            stats: 'GET /api/stats?period=day&date=YYYY-MM-DD (protected)'
        }
    });
});

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', usageRoutes);
app.use('/api', statsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});