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
            // {
            //     url: 'http://localhost:3000',
            //     description: 'Development Server'
            // }
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
                    required: ['email', 'password'],
                    properties: {
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
                AppUsage: {
                    type: 'object',
                    required: ['packageName', 'appName', 'durationMinutes'],
                    properties: {
                        packageName: { type: 'string', example: 'com.tiktok.android' },
                        appName: { type: 'string', example: 'TikTok' },
                        durationMinutes: { type: 'integer', example: 90 },
                        darkDurationMinutes: { type: 'integer', example: 75 }
                    }
                },
                LightReading: {
                    type: 'object',
                    properties: {
                        lux: { type: 'integer', example: 25 },
                        timestamp: { type: 'string', format: 'date-time', example: '2026-06-02T08:00:00Z' }
                    }
                },
                UsagePayload: {
                    type: 'object',
                    required: ['date', 'totalUsageMinutes', 'apps'],
                    properties: {
                        date: { type: 'string', format: 'date', example: '2026-06-02' },
                        totalUsageMinutes: { type: 'integer', example: 245 },
                        darkUsageMinutes: { type: 'integer', example: 196 },
                        apps: { type: 'array', items: { $ref: '#/components/schemas/AppUsage' } },
                        lightReadings: { type: 'array', items: { $ref: '#/components/schemas/LightReading' } }
                    }
                },
                DailyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'day' },
                        date: { type: 'string', format: 'date' },
                        summary: {
                            type: 'object',
                            properties: {
                                total_minutes: { type: 'integer' },
                                dark_minutes: { type: 'integer' },
                                dark_percentage: { type: 'number', format: 'float' }
                            }
                        },
                        apps: { type: 'array', items: { $ref: '#/components/schemas/AppUsage' } }
                    }
                },
                WeeklyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'week' },
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                        daily: { type: 'array', items: { $ref: '#/components/schemas/DailySummary' } },
                        summary: {
                            type: 'object',
                            properties: {
                                total_minutes: { type: 'integer' },
                                dark_minutes: { type: 'integer' },
                                dark_percentage: { type: 'number' }
                            }
                        }
                    }
                },
                DailySummary: {
                    type: 'object',
                    properties: {
                        date: { type: 'string', format: 'date' },
                        total_minutes: { type: 'integer' },
                        dark_minutes: { type: 'integer' },
                        dark_percentage: { type: 'number' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication' },
            { name: 'Usage Data' },
            { name: 'Statistics' }
        ]
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);