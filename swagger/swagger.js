const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EyeGuard Mobile API',
            version: '1.0.0',
            description: 'API untuk aplikasi monitoring penggunaan smartphone dengan deteksi cahaya lingkungan',
            contact: {
                name: 'Developer',
                email: 'iqbalnurhakimy83@gmail.com'
            }
        },
        servers: [
            {
                url: 'https://eye-guard-api.vercel.app',
                description: 'Production Server'
            },
            {
                url: 'http://localhost:3000',
                description: 'Development Server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                RegisterRequest: {
                    type: 'object',
                    required: ['name', 'email', 'password'],
                    properties: {
                        name: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', format: 'email', example: 'user@example.com' },
                        password: { type: 'string', format: 'password', minLength: 8, example: 'Password123' }
                    }
                },
                VerifyOtpRequest: {
                    type: 'object',
                    required: ['email', 'otp_code'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        otp_code: { type: 'string', example: '123456' }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                    }
                },
                ResendOtpRequest: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: { type: 'string', format: 'email' }
                    }
                },
                ForgotPasswordRequest: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: { type: 'string', format: 'email' }
                    }
                },
                ResetPasswordRequest: {
                    type: 'object',
                    required: ['email', 'otp_code', 'new_password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        otp_code: { type: 'string' },
                        new_password: { type: 'string', minLength: 8 }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Login berhasil' },
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                        userId: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'John Doe' }
                    }
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                // Schemas untuk Usage & Stats (sudah ada)
                AppUsage: {
                    type: 'object',
                    properties: {
                        packageName: { type: 'string' },
                        appName: { type: 'string' },
                        durationMinutes: { type: 'integer' },
                        darkDurationMinutes: { type: 'integer' }
                    }
                },
                UsagePayload: {
                    type: 'object',
                    required: ['date', 'totalUsageMinutes', 'apps'],
                    properties: {
                        date: { type: 'string', format: 'date' },
                        totalUsageMinutes: { type: 'integer' },
                        darkUsageMinutes: { type: 'integer' },
                        apps: { type: 'array', items: { $ref: '#/components/schemas/AppUsage' } },
                        lightReadings: { type: 'array', items: { type: 'object', properties: { lux: { type: 'integer' }, timestamp: { type: 'string', format: 'date-time' } } } }
                    }
                },
                DailyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string' },
                        date: { type: 'string', format: 'date' },
                        summary: { type: 'object' },
                        apps: { type: 'array' }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication', description: 'Endpoint autentikasi' },
            { name: 'Usage Data', description: 'Mengirim data penggunaan HP' },
            { name: 'Statistics', description: 'Mengambil statistik' }
        ]
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);