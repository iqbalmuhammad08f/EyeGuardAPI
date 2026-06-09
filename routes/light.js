const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

// ────────────────────────────────────────────────
// POST /api/light
// ────────────────────────────────────────────────
/**
 * @openapi
 * /api/light:
 *   post:
 *     tags:
 *       - Light Sensor
 *     summary: Kirim data sensor cahaya
 *     description: |
 *       Endpoint khusus untuk mengirim batch pembacaan sensor cahaya (lux).
 *       Dipanggil secara periodik dari Flutter (setiap 5 menit) — terpisah dari data penggunaan aplikasi.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LightReadingsPayload'
 *     responses:
 *       201:
 *         description: Data cahaya berhasil disimpan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Light data saved successfully
 *                 count:
 *                   type: integer
 *                   description: Jumlah pembacaan yang disimpan
 *                   example: 5
 *       400:
 *         description: Field tidak lengkap atau data tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Internal server error
 */
router.post('/light', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { readings } = req.body;

    if (!readings || !Array.isArray(readings) || readings.length === 0) {
        return res.status(400).json({ error: 'Field "readings" wajib diisi dan tidak boleh kosong' });
    }

    for (const r of readings) {
        if (r.lux === undefined || r.lux === null || typeof r.lux !== 'number') {
            return res.status(400).json({ error: 'Setiap reading harus memiliki field "lux" bertipe number' });
        }
        if (!r.timestamp) {
            return res.status(400).json({ error: 'Setiap reading harus memiliki field "timestamp"' });
        }
    }

    try {
        const values = [];
        const placeholders = readings.map((r, i) => {
            const idx = i * 3;
            values.push(userId, r.lux, r.timestamp);
            return `($${idx + 1}, $${idx + 2}, $${idx + 3})`;
        });

        await pool.query(
            `INSERT INTO light_readings (user_id, lux, recorded_at) VALUES ${placeholders.join(', ')}`,
            values
        );

        res.status(201).json({
            message: 'Light data saved successfully',
            count: readings.length,
        });
    } catch (err) {
        console.error('Error saving light data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ────────────────────────────────────────────────
// GET /api/stats/light
// ────────────────────────────────────────────────
/**
 * @openapi
 * /api/stats/light:
 *   get:
 *     tags:
 *       - Light Sensor
 *     summary: Ambil riwayat sensor cahaya harian
 *     description: Mendapatkan data pembacaan sensor cahaya (lux) untuk tanggal tertentu
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
 *                     format: float
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
            `SELECT lux, recorded_at AT TIME ZONE 'UTC' AS recorded_at
             FROM light_readings
             WHERE user_id = $1 AND (recorded_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = $2
             ORDER BY recorded_at ASC`,
            [userId, targetDate]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching light history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
