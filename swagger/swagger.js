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
                        date: { type: 'string', format: 'date', example: '2026-06-09' },
                        totalUsageMinutes: { type: 'integer', example: 120 },
                        darkUsageMinutes: { type: 'integer', example: 15 },
                        darkPercentage: { type: 'number', example: 12.5, description: 'Opsional — dihitung otomatis jika tidak dikirim' },
                        apps: { type: 'array', items: { $ref: '#/components/schemas/AppUsage' } }
                    }
                },
                LightReadingsPayload: {
                    type: 'object',
                    required: ['readings'],
                    properties: {
                        readings: {
                            type: 'array',
                            description: 'Batch pembacaan sensor cahaya (dikirim tiap 5 menit)',
                            items: {
                                type: 'object',
                                required: ['lux', 'timestamp'],
                                properties: {
                                    lux: { type: 'number', example: 320, description: 'Nilai cahaya dalam satuan lux' },
                                    timestamp: { type: 'string', format: 'date-time', example: '2026-06-09T10:00:00Z' }
                                }
                            }
                        }
                    }
                },
                DailyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'day' },
                        date: { type: 'string', format: 'date' },
                        summary: { type: 'object' },
                        apps: { type: 'array' }
                    }
                },
                WeeklyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'week' },
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                        daily: { type: 'array' },
                        summary: { type: 'object' }
                    }
                },
                SummaryStatsResponse: {
                    type: 'object',
                    properties: {
                        total_active_days: { type: 'integer', example: 15 },
                        current_streak: { type: 'integer', example: 3 },
                        avg_daily_minutes: { type: 'number', example: 120.5 },
                        avg_dark_percentage: { type: 'number', example: 12.3 },
                        today: { type: 'object' }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication', description: 'Endpoint autentikasi' },
            { name: 'Usage Data', description: 'Mengirim data penggunaan aplikasi (dipicu user action)' },
            { name: 'Light Sensor', description: 'Mengirim data sensor cahaya ambient (dipicu timer 5 menit)' },
            { name: 'Statistics', description: 'Mengambil statistik penggunaan dan sensor cahaya' },
            { name: 'Profile', description: 'Melihat, mengedit, dan menghapus data akun pengguna' },
            { name: 'System', description: 'Endpoint sistem (health check)' }
        ]
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);