const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const router = express.Router();

// Semua rute admin menggunakan authMiddleware dan adminMiddleware secara terurut
router.use(authMiddleware, adminMiddleware);

/**
 * @openapi
 * /api/admin/summary:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Mendapatkan ringkasan statistik cepat admin (KPI)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil ringkasan dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminSummaryResponse'
 *       401:
 *         description: Token tidak valid
 *       403:
 *         description: Bukan admin
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    try {
        const totalUsersQuery = pool.query(
            "SELECT COUNT(*)::int as total FROM users WHERE role = 'user'"
        );
        const activeUsersQuery = pool.query(
            "SELECT COUNT(DISTINCT user_id)::int as active FROM daily_usage WHERE date = $1",
            [today]
        );
        const avgScreenTimeQuery = pool.query(
            "SELECT COALESCE(AVG(total_minutes), 0)::float as avg_screen_time FROM daily_usage"
        );
        const avgLuxQuery = pool.query(
            "SELECT COALESCE(AVG(lux), 0)::float as avg_lux FROM light_readings"
        );

        const [totalUsers, activeUsers, avgScreenTime, avgLux] = await Promise.all([
            totalUsersQuery,
            activeUsersQuery,
            avgScreenTimeQuery,
            avgLuxQuery
        ]);

        res.json({
            totalUsers: totalUsers.rows[0].total,
            activeUsersToday: activeUsers.rows[0].active,
            averageScreenTime: avgScreenTime.rows[0].avg_screen_time,
            averageLux: avgLux.rows[0].avg_lux
        });
    } catch (err) {
        console.error('Error fetching admin summary:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server internal' });
    }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Mendapatkan daftar pengguna dengan statistik screen time (paginated & searchable)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Halaman data (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Batas data per halaman (default 10)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian (nama / email)
 *     responses:
 *       200:
 *         description: Berhasil mengambil data list user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsersResponse'
 */
router.get('/users', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    try {
        let countQuery = "SELECT COUNT(*)::int as total FROM users WHERE role = 'user'";
        let dataQuery = `
            SELECT u.id, u.name, u.email, u.created_at,
                   COALESCE(AVG(du.total_minutes), 0)::float as avg_screen_time_minutes,
                   COALESCE(MAX(du.total_minutes), 0)::int as max_screen_time_minutes
            FROM users u
            LEFT JOIN daily_usage du ON u.id = du.user_id
            WHERE u.role = 'user'
        `;
        
        const countParams = [];
        const dataParams = [];

        if (search) {
            countQuery += " AND (name ILIKE $1 OR email ILIKE $1)";
            dataQuery += " AND (u.name ILIKE $1 OR u.email ILIKE $1)";
            countParams.push(`%${search}%`);
            dataParams.push(`%${search}%`);
        }

        dataQuery += " GROUP BY u.id ORDER BY u.created_at DESC";

        // Tambahkan limit dan offset ke params data
        dataParams.push(limit);
        dataParams.push(offset);
        dataQuery += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

        const [countResult, dataResult] = await Promise.all([
            pool.query(countQuery, countParams),
            pool.query(dataQuery, dataParams)
        ]);

        const total = countResult.rows[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            users: dataResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (err) {
        console.error('Error fetching admin users:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server internal' });
    }
});

/**
 * @openapi
 * /api/admin/stats/apps:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Mendapatkan statistik aplikasi terpopuler agregat
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data top apps
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdminTopAppItem'
 */
router.get('/stats/apps', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT app_name, package_name,
                   SUM(duration_minutes)::int as total_duration_minutes,
                   COALESCE(AVG(duration_minutes), 0)::float as avg_duration_minutes,
                   COUNT(DISTINCT user_id)::int as active_users_count
            FROM app_usage
            GROUP BY app_name, package_name
            ORDER BY total_duration_minutes DESC
            LIMIT 10
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching app stats:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server internal' });
    }
});

module.exports = router;
