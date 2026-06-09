const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

/**
 * @openapi
 * /api/usage:
 *   post:
 *     tags:
 *       - Usage Data
 *     summary: Kirim data penggunaan aplikasi
 *     description: |
 *       Endpoint ini menerima data agregat penggunaan HP dari Flutter.
 *       Dipanggil saat pengguna membuka app atau melakukan pull-to-refresh.
 *       Data sensor cahaya dikirim terpisah via `POST /api/light`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsagePayload'
 *     responses:
 *       201:
 *         description: Data berhasil disimpan
 *       400:
 *         description: Field wajib tidak lengkap
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.post('/usage', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { date, totalUsageMinutes, darkUsageMinutes, apps } = req.body;

    // Validasi field wajib
    if (!date || totalUsageMinutes === undefined || !apps || !apps.length) {
        return res.status(400).json({ error: 'Missing required fields: date, totalUsageMinutes, apps' });
    }

    // Hitung darkPercentage, cegah pembagian dengan nol
    let darkPercentage = 0;
    if (totalUsageMinutes > 0) {
        darkPercentage = ((darkUsageMinutes || 0) / totalUsageMinutes) * 100;
    }
    if (req.body.darkPercentage !== undefined) darkPercentage = req.body.darkPercentage;
    darkPercentage = Math.min(100, Math.max(0, darkPercentage));

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Simpan / update daily_usage (UPSERT)
        await client.query(
            `INSERT INTO daily_usage (user_id, date, total_minutes, dark_minutes, dark_percentage)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, date) DO UPDATE SET
                total_minutes = EXCLUDED.total_minutes,
                dark_minutes = EXCLUDED.dark_minutes,
                dark_percentage = EXCLUDED.dark_percentage`,
            [userId, date, totalUsageMinutes, darkUsageMinutes || 0, darkPercentage]
        );

        // 2. Simpan setiap app (UPSERT)
        for (const app of apps) {
            await client.query(
                `INSERT INTO app_usage (user_id, date, package_name, app_name, duration_minutes, dark_duration_minutes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, date, package_name) DO UPDATE SET
                    duration_minutes = EXCLUDED.duration_minutes,
                    dark_duration_minutes = EXCLUDED.dark_duration_minutes,
                    app_name = EXCLUDED.app_name`,
                [userId, date, app.packageName, app.appName, app.durationMinutes, app.darkDurationMinutes || 0]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Usage data saved successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving usage data:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;