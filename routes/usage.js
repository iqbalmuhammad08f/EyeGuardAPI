const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const getDateRange = (period) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const end = new Date(todayStr);
    const start = new Date(todayStr);
    if (period === 'week') start.setDate(end.getDate() - 6);
    else if (period === 'month') start.setDate(end.getDate() - 29);
    return {
        startStr: start.toISOString().split('T')[0],
        endStr: end.toISOString().split('T')[0],
    };
};


// ────────────────────────────────────────────────
// POST /api/usage
// ────────────────────────────────────────────────
/**
 * @openapi
 * /api/usage:
 *   post:
 *     tags:
 *       - Usage Data
 *     summary: Kirim data penggunaan aplikasi
 *     description: |
 *       Menerima data agregat penggunaan HP dari Flutter.
 *       Dipanggil saat pengguna membuka app atau melakukan pull-to-refresh.
 *       Data sensor cahaya dikirim terpisah via `POST /api/light`.
 *
 *       Relasi: users → daily_usage → app_usage
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usage data saved successfully
 *                 daily_usage_id:
 *                   type: integer
 *                   description: ID dari record daily_usage yang dibuat/diperbarui
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
    const { date, totalUsageMinutes, apps } = req.body;

    if (!date || totalUsageMinutes === undefined || !apps || !apps.length) {
        return res.status(400).json({ error: 'Missing required fields: date, totalUsageMinutes, apps' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. UPSERT daily_usage — ambil id (RETURNING id)
        const dailyResult = await client.query(
            `INSERT INTO daily_usage (user_id, date, total_minutes)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, date) DO UPDATE SET
                total_minutes = EXCLUDED.total_minutes
             RETURNING id`,
            [userId, date, totalUsageMinutes]
        );
        const dailyUsageId = dailyResult.rows[0].id;

        // 2. UPSERT setiap app — relasi via daily_usage_id
        for (const app of apps) {
            await client.query(
                `INSERT INTO app_usage
                    (user_id, date, daily_usage_id, package_name, app_name, duration_minutes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (daily_usage_id, package_name) DO UPDATE SET
                    duration_minutes = EXCLUDED.duration_minutes,
                    app_name = EXCLUDED.app_name`,
                [userId, date, dailyUsageId, app.packageName, app.appName, app.durationMinutes]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Usage data saved successfully',
            daily_usage_id: dailyUsageId,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving usage data:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// ────────────────────────────────────────────────
// GET /api/stats
// ────────────────────────────────────────────────
/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags:
 *       - Usage Data
 *     summary: Ambil riwayat penggunaan
 *     description: |
 *       Mendapatkan ringkasan penggunaan HP per hari atau rekap mingguan/bulanan.
 *       - **day**: detail penggunaan hari tertentu beserta daftar aplikasi
 *       - **week**: rekap 7 hari terakhir (data per hari + agregat + apps per hari)
 *       - **month**: rekap 30 hari terakhir (data per hari + agregat + apps per hari)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Periode data (default day)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal spesifik untuk period=day (default hari ini, YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Berhasil mengambil data
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/DailyStatsResponse'
 *                 - $ref: '#/components/schemas/WeeklyStatsResponse'
 *       400:
 *         description: Period tidak valid
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    let { period, date } = req.query;
    period = period || 'day';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    try {
        // ── HARIAN ──────────────────────────────────────────
        if (period === 'day') {
            const targetDate = date || today;

            const [dailyResult, appsResult] = await Promise.all([
                pool.query(
                    `SELECT id, date, total_minutes
                     FROM daily_usage
                     WHERE user_id = $1 AND date = $2`,
                    [userId, targetDate]
                ),
                pool.query(
                    `SELECT au.package_name, au.app_name, au.duration_minutes
                     FROM app_usage au
                     JOIN daily_usage du ON au.daily_usage_id = du.id
                     WHERE du.user_id = $1 AND du.date = $2
                     ORDER BY au.duration_minutes DESC`,
                    [userId, targetDate]
                )
            ]);

            const daily = dailyResult.rows[0] || null;
            return res.json({
                period: 'day',
                date: targetDate,
                summary: daily
                    ? { total_minutes: daily.total_minutes }
                    : { total_minutes: 0 },
                apps: appsResult.rows,
            });
        }

        // ── MINGGUAN / BULANAN ───────────────────────────────
        if (period === 'week' || period === 'month') {
            const { startStr, endStr } = getDateRange(period);

            const dailyResult = await pool.query(
                `SELECT id, date, total_minutes
                 FROM daily_usage
                 WHERE user_id = $1 AND date BETWEEN $2 AND $3
                 ORDER BY date ASC`,
                [userId, startStr, endStr]
            );
            const dailyRows = dailyResult.rows;

            const appRows = dailyRows.length > 0
                ? (await pool.query(
                    `SELECT au.daily_usage_id, au.package_name, au.app_name, au.duration_minutes
                     FROM app_usage au
                     JOIN daily_usage du ON au.daily_usage_id = du.id
                     WHERE du.user_id = $1 AND du.date BETWEEN $2 AND $3
                     ORDER BY du.date ASC, au.duration_minutes DESC`,
                    [userId, startStr, endStr]
                )).rows
                : [];

            const appsByDayId = {};
            for (const app of appRows) {
                if (!appsByDayId[app.daily_usage_id]) appsByDayId[app.daily_usage_id] = [];
                appsByDayId[app.daily_usage_id].push({
                    package_name: app.package_name,
                    app_name: app.app_name,
                    duration_minutes: app.duration_minutes,
                });
            }

            const enrichedDays = dailyRows.map(row => ({
                id: row.id,
                date: row.date,
                total_minutes: row.total_minutes,
                apps: appsByDayId[row.id] || [],
            }));

            return res.json({
                period,
                startDate: startStr,
                endDate: endStr,
                daily: enrichedDays,
                summary: { total_minutes: dailyRows.reduce((s, r) => s + (Number(r.total_minutes) || 0), 0) },
            });
        }

        return res.status(400).json({ error: 'Invalid period. Use day, week, or month.' });
    } catch (err) {
        console.error('Error fetching usage stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;