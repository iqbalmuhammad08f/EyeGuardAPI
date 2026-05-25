require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/swagger');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'EyeGuard API is running',
        docs: '/api-docs',
        endpoints: {
            auth: '/api/auth',
            dashboard: '/api/dashboard'
        }
    });
});

// Swagger docs
const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.min.css";
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCssUrl: CSS_URL,
    customJs: [
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-bundle.js",
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui-standalone-preset.js"
    ]
}));
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Routes public
app.use('/api/auth', authRoutes);

// Routes protected (perlu JWT)
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});