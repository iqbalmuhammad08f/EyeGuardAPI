const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/dashboard/stats:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Mendapatkan statistik penggunaan (test auth)
 *     description: Endpoint ini dilindungi JWT. Hanya bisa diakses dengan token valid.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data (sementara data dummy)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     email:
 *                       type: string
 *       401:
 *         description: Token tidak valid atau tidak disediakan
 */
router.get('/stats', authMiddleware, (req, res) => {
    // Ini hanya endpoint dummy untuk test auth
    res.json({
        message: 'Anda berhasil mengakses dashboard! (Endpoint masih kosong, nanti diisi data real)',
        user: req.user, // menampilkan userId dan email dari token
        stats: {
            totalUsageMinutes: 0,
            darkPercentage: 0,
            apps: []
        }
    });
});

module.exports = router;