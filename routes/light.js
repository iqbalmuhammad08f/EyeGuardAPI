const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const pool = require('../config/db');

const router = express.Router();

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

    // Validasi setiap item
    for (const r of readings) {
        if (r.lux === undefined || r.lux === null || typeof r.lux !== 'number') {
            return res.status(400).json({ error: 'Setiap reading harus memiliki field "lux" bertipe number' });
        }
        if (!r.timestamp) {
            return res.status(400).json({ error: 'Setiap reading harus memiliki field "timestamp"' });
        }
    }

    try {
        // Bulk insert dengan single query
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

module.exports = router;
