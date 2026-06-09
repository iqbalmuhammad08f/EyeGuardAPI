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
                // ── Auth ──────────────────────────────────
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
                    properties: { message: { type: 'string' } }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: { error: { type: 'string' } }
                },

                // ── Usage ─────────────────────────────────
                AppUsage: {
                    type: 'object',
                    required: ['packageName', 'appName', 'durationMinutes'],
                    properties: {
                        packageName: { type: 'string', example: 'com.zhiliaoapp.musically' },
                        appName: { type: 'string', example: 'TikTok' },
                        durationMinutes: { type: 'integer', example: 46 }
                    }
                },
                UsagePayload: {
                    type: 'object',
                    required: ['date', 'totalUsageMinutes', 'apps'],
                    properties: {
                        date: { type: 'string', format: 'date', example: '2026-06-09' },
                        totalUsageMinutes: { type: 'integer', example: 155 },
                        apps: {
                            type: 'array',
                            items: { '$ref': '#/components/schemas/AppUsage' }
                        }
                    }
                },

                // ── Light ─────────────────────────────────
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
                                    lux: { type: 'number', format: 'float', example: 312.75, description: 'Nilai cahaya dalam satuan lux' },
                                    timestamp: { type: 'string', format: 'date-time', example: '2026-06-09T10:00:00Z' }
                                }
                            }
                        }
                    }
                },

                // ── Stats ─────────────────────────────────
                AppUsageStat: {
                    type: 'object',
                    properties: {
                        package_name: { type: 'string', example: 'com.zhiliaoapp.musically' },
                        app_name: { type: 'string', example: 'TikTok' },
                        duration_minutes: { type: 'integer', example: 46 }
                    }
                },
                DailyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'day' },
                        date: { type: 'string', format: 'date', example: '2026-06-09' },
                        summary: {
                            type: 'object',
                            properties: {
                                total_minutes: { type: 'integer', example: 155 }
                            }
                        },
                        apps: {
                            type: 'array',
                            items: { '$ref': '#/components/schemas/AppUsageStat' }
                        }
                    }
                },
                WeeklyStatsResponse: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', example: 'week' },
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                        daily: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    date: { type: 'string', format: 'date' },
                                    total_minutes: { type: 'integer' },
                                    apps: {
                                        type: 'array',
                                        items: { '$ref': '#/components/schemas/AppUsageStat' }
                                    }
                                }
                            }
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                total_minutes: { type: 'integer', example: 6288 }
                            }
                        }
                    }
                },
            }
        },
        tags: [
            { name: 'Authentication', description: 'Endpoint autentikasi' },
            { name: 'Usage Data', description: 'Mengirim dan mengambil data penggunaan aplikasi' },
            { name: 'Light Sensor', description: 'Mengirim dan mengambil data sensor cahaya ambient' },
            { name: 'Profile', description: 'Melihat, mengedit, dan menghapus data akun pengguna' },
            { name: 'System', description: 'Endpoint sistem (health check)' }
        ]
    },
    apis: ['./routes/*.js', './index.js']
};

module.exports = swaggerJsdoc(options);