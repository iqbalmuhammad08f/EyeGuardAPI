const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const { validatePassword } = require('../utils/validators');

const router = express.Router();

/**
 * @openapi
 * /api/profile/me:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Ambil data profil pengguna yang sedang login
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mengambil data profil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "user@example.com"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token tidak valid
 *       404:
 *         description: Pengguna tidak ditemukan
 *       500:
 *         description: Terjadi kesalahan server
 */
router.get('/profile/me', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            'SELECT id, name, email, created_at FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/profile/me:
 *   patch:
 *     tags:
 *       - Profile
 *     summary: Edit nama dan/atau ganti password
 *     description: |
 *       Minimal salah satu dari `name` atau `newPassword` harus diisi.
 *       Jika `newPassword` diisi, maka `currentPassword` wajib disertakan untuk konfirmasi.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Doe"
 *               currentPassword:
 *                 type: string
 *                 description: Password saat ini, wajib jika ingin ganti password
 *                 example: "OldPassword123"
 *               newPassword:
 *                 type: string
 *                 description: Password baru (min 8 karakter, huruf besar, huruf kecil, angka)
 *                 example: "NewPassword456"
 *     responses:
 *       200:
 *         description: Profil berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Input tidak valid atau password lama salah
 *       401:
 *         description: Token tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
router.patch('/profile/me', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { name, currentPassword, newPassword } = req.body;

    // Minimal salah satu harus diisi
    if (!name && !newPassword) {
        return res.status(400).json({ error: 'Minimal isi name atau newPassword untuk diperbarui' });
    }

    // Jika ingin ganti password, currentPassword wajib ada
    if (newPassword && !currentPassword) {
        return res.status(400).json({ error: 'currentPassword wajib diisi untuk mengganti password' });
    }

    if (newPassword) {
        const pwCheck = validatePassword(newPassword);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.message });
        }
    }

    try {
        // Ambil data user saat ini
        const userResult = await pool.query(
            'SELECT id, name, email, password_hash FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
        }
        const user = userResult.rows[0];

        // Verifikasi password lama jika ingin ganti password
        if (newPassword) {
            const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Password saat ini salah' });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({ error: 'Password baru tidak boleh sama dengan password lama' });
            }
        }

        // Bangun query dinamis
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name && name.trim() !== '') {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }

        if (newPassword) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(hashedNewPassword);
        }

        values.push(userId);
        const updateQuery = `
            UPDATE users SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, name, email
        `;

        const result = await pool.query(updateQuery, values);
        res.json({
            message: 'Profil berhasil diperbarui',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/profile/me:
 *   delete:
 *     tags:
 *       - Profile
 *     summary: Hapus akun pengguna
 *     description: |
 *       Menghapus akun beserta seluruh data terkait (riwayat penggunaan, sensor cahaya, dll).
 *       Memerlukan konfirmasi password untuk keamanan.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: Password saat ini untuk konfirmasi penghapusan akun
 *                 example: "Password123"
 *     responses:
 *       200:
 *         description: Akun berhasil dihapus
 *       400:
 *         description: Password tidak diisi atau salah
 *       401:
 *         description: Token tidak valid
 *       404:
 *         description: Pengguna tidak ditemukan
 *       500:
 *         description: Terjadi kesalahan server
 */
router.delete('/profile/me', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password diperlukan untuk menghapus akun' });
    }

    const client = await pool.connect();
    try {
        const userResult = await client.query(
            'SELECT id, email, password_hash FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
        }

        const user = userResult.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Password salah' });
        }

        await client.query('BEGIN');

        // Hapus semua data terkait user
        await client.query('DELETE FROM light_readings WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM app_usage WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM daily_usage WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM verification_tokens WHERE email = $1', [user.email]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.json({ message: 'Akun berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting profile:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    } finally {
        client.release();
    }
});

module.exports = router;
