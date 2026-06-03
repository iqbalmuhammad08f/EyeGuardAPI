const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal awal untuk rentang bebas (gunakan bersama endDate)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir untuk rentang bebas
 *     responses:
 *       200:
 *         description: Berhasil mengambil data
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/DailyStatsResponse'
 *                 - $ref: '#/components/schemas/WeeklyStatsResponse'
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    let { period, date, startDate, endDate } = req.query;

    period = period || 'day';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    try {
        let query = '';
        let params = [userId];
        let dateRange = { start: '', end: '' };

        if (period === 'day') {
            const targetDate = date || today;
            query = `
                SELECT date, total_minutes, dark_minutes, dark_percentage
                FROM daily_usage
                WHERE user_id = $1 AND date = $2
            `;
            params.push(targetDate);
            const dailyResult = await pool.query(query, params);

            // Ambil detail apps untuk tanggal tersebut
            const appsQuery = `
                SELECT package_name, app_name, duration_minutes, dark_duration_minutes
                FROM app_usage
                WHERE user_id = $1 AND date = $2
                ORDER BY duration_minutes DESC
            `;
            const appsResult = await pool.query(appsQuery, [userId, targetDate]);

            return res.json({
                period: 'day',
                date: targetDate,
                summary: dailyResult.rows[0] || { total_minutes: 0, dark_minutes: 0, dark_percentage: 0 },
                apps: appsResult.rows
            });
        }

        if (period === 'week') {
            // 7 hari terakhir termasuk hari ini (dalam zona waktu Jakarta)
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            const end = new Date(todayStr);
            const start = new Date(todayStr);
            start.setDate(end.getDate() - 6);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const weekQuery = `
                SELECT date, total_minutes, dark_minutes, dark_percentage
                FROM daily_usage
                WHERE user_id = $1 AND date BETWEEN $2 AND $3
                ORDER BY date ASC
            `;
            const result = await pool.query(weekQuery, [userId, startStr, endStr]);

            // Hitung total agregat
            let totalMinutes = 0, darkMinutes = 0;
            for (const row of result.rows) {
                totalMinutes += row.total_minutes;
                darkMinutes += row.dark_minutes;
            }
            const avgPercentage = totalMinutes ? (darkMinutes / totalMinutes) * 100 : 0;

            return res.json({
                period: 'week',
                startDate: startStr,
                endDate: endStr,
                daily: result.rows,
                summary: {
                    total_minutes: totalMinutes,
                    dark_minutes: darkMinutes,
                    dark_percentage: Math.min(100, avgPercentage)
                }
            });
        }

        if (period === 'month') {
            // 30 hari terakhir (dalam zona waktu Jakarta)
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            const end = new Date(todayStr);
            const start = new Date(todayStr);
            start.setDate(end.getDate() - 29);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const monthQuery = `
                SELECT date, total_minutes, dark_minutes, dark_percentage
                FROM daily_usage
                WHERE user_id = $1 AND date BETWEEN $2 AND $3
                ORDER BY date ASC
            `;
            const result = await pool.query(monthQuery, [userId, startStr, endStr]);

            let totalMinutes = 0, darkMinutes = 0;
            for (const row of result.rows) {
                totalMinutes += row.total_minutes;
                darkMinutes += row.dark_minutes;
            }
            const avgPercentage = totalMinutes ? (darkMinutes / totalMinutes) * 100 : 0;

            return res.json({
                period: 'month',
                startDate: startStr,
                endDate: endStr,
                daily: result.rows,
                summary: {
                    total_minutes: totalMinutes,
                    dark_minutes: darkMinutes,
                    dark_percentage: Math.min(100, avgPercentage)
                }
            });
        }

        // fallback jika period tidak dikenal
        return res.status(400).json({ error: 'Invalid period. Use day, week, or month.' });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;