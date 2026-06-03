const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

/**
 * @openapi
 * /api/limits:
 *   get:
 *     tags:
 *       - App Limits
 *     summary: Dapatkan daftar batas waktu aplikasi untuk pengguna saat ini
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil batas waktu
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   package_name:
 *                     type: string
 *                   app_name:
 *                     type: string
 *                   limit_minutes:
 *                     type: integer
 *                   is_active:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
router.get('/limits', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `SELECT id, package_name, app_name, limit_minutes, is_active, created_at, updated_at 
             FROM app_limits 
             WHERE user_id = $1 
             ORDER BY updated_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching app limits:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/limits:
 *   post:
 *     tags:
 *       - App Limits
 *     summary: Tambah atau perbarui batas waktu untuk aplikasi tertentu (Upsert)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageName
 *               - limitMinutes
 *             properties:
 *               packageName:
 *                 type: string
 *                 example: "com.instagram.android"
 *               appName:
 *                 type: string
 *                 example: "Instagram"
 *               limitMinutes:
 *                 type: integer
 *                 example: 60
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Batas waktu berhasil disimpan/diperbarui
 *       400:
 *         description: Field wajib tidak lengkap atau tipe data tidak valid
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
router.post('/limits', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { packageName, appName, limitMinutes, isActive } = req.body;

    if (!packageName || limitMinutes === undefined) {
        return res.status(400).json({ error: 'Field packageName dan limitMinutes wajib diisi' });
    }

    if (typeof limitMinutes !== 'number' || limitMinutes < 0) {
        return res.status(400).json({ error: 'limitMinutes harus berupa angka positif' });
    }

    const active = isActive !== undefined ? isActive : true;

    try {
        const result = await pool.query(
            `INSERT INTO app_limits (user_id, package_name, app_name, limit_minutes, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, package_name) DO UPDATE SET
                limit_minutes = EXCLUDED.limit_minutes,
                app_name = EXCLUDED.app_name,
                is_active = EXCLUDED.is_active
             RETURNING id, package_name, app_name, limit_minutes, is_active, updated_at`,
            [userId, packageName, appName || null, limitMinutes, active]
        );
        res.status(200).json({ message: 'Batas waktu aplikasi berhasil disimpan', data: result.rows[0] });
    } catch (err) {
        console.error('Error saving app limit:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/limits/{package_name}:
 *   delete:
 *     tags:
 *       - App Limits
 *     summary: Hapus batas waktu aplikasi tertentu
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: package_name
 *         required: true
 *         schema:
 *           type: string
 *         description: Package name aplikasi (contoh com.instagram.android)
 *     responses:
 *       200:
 *         description: Batas waktu berhasil dihapus
 *       404:
 *         description: Batas waktu tidak ditemukan untuk aplikasi tersebut
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
router.delete('/limits/:package_name', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const packageName = req.params.package_name;

    try {
        const result = await pool.query(
            `DELETE FROM app_limits 
             WHERE user_id = $1 AND package_name = $2`,
            [userId, packageName]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Batas waktu tidak ditemukan untuk aplikasi ini' });
        }

        res.json({ message: 'Batas waktu aplikasi berhasil dihapus' });
    } catch (err) {
        console.error('Error deleting app limit:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;
