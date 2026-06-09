const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

// Helper: hitung rentang tanggal berdasarkan period
const getDateRange = (period) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const end = new Date(todayStr);
    const start = new Date(todayStr);

    if (period === 'week') {
        start.setDate(end.getDate() - 6);
    } else if (period === 'month') {
        start.setDate(end.getDate() - 29);
    }

    return {
        startStr: start.toISOString().split('T')[0],
        endStr: end.toISOString().split('T')[0],
    };
};

// Helper: hitung agregat dari rows daily_usage
const aggregateRows = (rows) => {
    let totalMinutes = 0, darkMinutes = 0;
    for (const row of rows) {
        totalMinutes += row.total_minutes;
        darkMinutes += row.dark_minutes;
    }
    const darkPercentage = totalMinutes ? (darkMinutes / totalMinutes) * 100 : 0;
    return {
        total_minutes: totalMinutes,
        dark_minutes: darkMinutes,
        dark_percentage: Math.min(100, darkPercentage),
    };
};

/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags:
 *       - Statistics
 *     summary: Ambil statistik penggunaan
 *     description: Mendapatkan ringkasan penggunaan HP (total durasi, durasi gelap, persentase, dan per aplikasi)
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
 *         description: Tanggal spesifik untuk period=day (default hari ini)
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
        if (period === 'day') {
            const targetDate = date || today;
            const [dailyResult, appsResult] = await Promise.all([
                pool.query(
                    `SELECT date, total_minutes, dark_minutes, dark_percentage
                     FROM daily_usage WHERE user_id = $1 AND date = $2`,
                    [userId, targetDate]
                ),
                pool.query(
                    `SELECT package_name, app_name, duration_minutes, dark_duration_minutes
                     FROM app_usage WHERE user_id = $1 AND date = $2
                     ORDER BY duration_minutes DESC`,
                    [userId, targetDate]
                )
            ]);

            return res.json({
                period: 'day',
                date: targetDate,
                summary: dailyResult.rows[0] || { total_minutes: 0, dark_minutes: 0, dark_percentage: 0 },
                apps: appsResult.rows,
            });
        }

        if (period === 'week' || period === 'month') {
            const { startStr, endStr } = getDateRange(period);
            const result = await pool.query(
                `SELECT date, total_minutes, dark_minutes, dark_percentage
                 FROM daily_usage
                 WHERE user_id = $1 AND date BETWEEN $2 AND $3
                 ORDER BY date ASC`,
                [userId, startStr, endStr]
            );

            return res.json({
                period,
                startDate: startStr,
                endDate: endStr,
                daily: result.rows,
                summary: aggregateRows(result.rows),
            });
        }

        return res.status(400).json({ error: 'Invalid period. Use day, week, or month.' });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/stats/summary:
 *   get:
 *     tags:
 *       - Statistics
 *     summary: Ringkasan statistik untuk Home screen
 *     description: Mengembalikan total hari aktif, streak hari berturut-turut, dan rata-rata penggunaan harian dalam 30 hari terakhir
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil ringkasan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_active_days:
 *                   type: integer
 *                   description: Total hari dengan data penggunaan (30 hari terakhir)
 *                 current_streak:
 *                   type: integer
 *                   description: Jumlah hari berturut-turut dengan data (dari hari ini ke belakang)
 *                 avg_daily_minutes:
 *                   type: number
 *                   description: Rata-rata penggunaan harian dalam menit (30 hari terakhir)
 *                 avg_dark_percentage:
 *                   type: number
 *                   description: Rata-rata persentase penggunaan gelap (30 hari terakhir)
 *                 today:
 *                   type: object
 *                   description: Ringkasan hari ini
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.get('/stats/summary', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { startStr, endStr } = getDateRange('month');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    try {
        const result = await pool.query(
            `SELECT date, total_minutes, dark_minutes, dark_percentage
             FROM daily_usage
             WHERE user_id = $1 AND date BETWEEN $2 AND $3
             ORDER BY date DESC`,
            [userId, startStr, endStr]
        );

        const rows = result.rows;
        const totalActiveDays = rows.length;

        // Hitung streak (hari berturut-turut dari hari ini ke belakang)
        let streak = 0;
        const dateSet = new Set(rows.map(r => r.date));
        const checkDate = new Date(today);
        while (dateSet.has(checkDate.toISOString().split('T')[0])) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Rata-rata harian
        const totalMins = rows.reduce((sum, r) => sum + r.total_minutes, 0);
        const totalDarkMins = rows.reduce((sum, r) => sum + r.dark_minutes, 0);
        const avgDailyMinutes = totalActiveDays ? (totalMins / totalActiveDays) : 0;
        const avgDarkPercentage = totalMins ? (totalDarkMins / totalMins) * 100 : 0;

        // Data hari ini
        const todayData = rows.find(r => r.date === today) || {
            total_minutes: 0,
            dark_minutes: 0,
            dark_percentage: 0,
        };

        return res.json({
            total_active_days: totalActiveDays,
            current_streak: streak,
            avg_daily_minutes: Math.round(avgDailyMinutes * 10) / 10,
            avg_dark_percentage: Math.min(100, Math.round(avgDarkPercentage * 10) / 10),
            today: todayData,
        });
    } catch (err) {
        console.error('Error fetching stats summary:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/stats/light:
 *   get:
 *     tags:
 *       - Statistics
 *     summary: Ambil riwayat sensor cahaya harian
 *     description: Mendapatkan data pembacaan sensor cahaya (lux) dan timestamp untuk tanggal tertentu
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal spesifik (YYYY-MM-DD), default hari ini
 *     responses:
 *       200:
 *         description: Berhasil mengambil data riwayat cahaya
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   lux:
 *                     type: number
 *                   recorded_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.get('/stats/light', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { date } = req.query;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const targetDate = date || today;

    try {
        const result = await pool.query(
            `SELECT lux, recorded_at
             FROM light_readings
             WHERE user_id = $1 AND recorded_at::date = $2
             ORDER BY recorded_at ASC`,
            [userId, targetDate]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching light stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;