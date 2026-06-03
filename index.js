require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerSpec = require('./swagger/swagger');

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const statsRoutes = require('./routes/stats');
const limitsRoutes = require('./routes/limits');

const app = express();
app.use(cors());
app.use(express.json());

// Welcome route
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
                resetPassword: 'POST /api/auth/reset-password'
            },
            usage: 'POST /api/usage',
            stats: 'GET /api/stats?period=day&date=YYYY-MM-DD',
            limits: {
                list: 'GET /api/limits',
                upsert: 'POST /api/limits',
                delete: 'DELETE /api/limits/:package_name'
            }
        }
    });
});

// Swagger docs
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

app.get('/api-docs', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>EyeGuard Mobile API Docs</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.min.css" />
        </head>
        <body>
            <div id="swagger-ui"></div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js" charset="UTF-8"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
            <script>
                window.onload = () => {
                    window.ui = SwaggerUIBundle({
                        url: '/api-docs.json',
                        dom_id: '#swagger-ui',
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIStandalonePreset
                        ],
                        layout: "StandaloneLayout"
                    });
                };
            </script>
        </body>
        </html>
    `);
});

// Routes public
app.use('/api/auth', authRoutes);
app.use('/api', usageRoutes);   // POST /api/usage
app.use('/api', statsRoutes);   // GET /api/stats
app.use('/api', limitsRoutes);  // GET/POST/DELETE /api/limits


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});