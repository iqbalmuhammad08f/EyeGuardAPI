const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendOTPEmail } = require('../utils/mailer');

const router = express.Router();

// Helper: generate OTP 6 digit
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

// REGISTER
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registrasi pengguna baru
 *     description: Mengirimkan OTP ke email pengguna setelah pendaftaran berhasil
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registrasi berhasil, OTP dikirim ke email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registrasi berhasil. Cek email untuk kode OTP.
 *       400:
 *         description: Email atau password tidak diisi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email sudah terdaftar
 *       500:
 *         description: Terjadi kesalahan server
 */
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    // Validasi kekuatan password (tanpa simbol)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            error: 'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka'
        });
    }

    try {
        // Cek apakah email sudah terdaftar
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email sudah terdaftar' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Simpan user (belum verified)
        await pool.query(
            'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, $3)',
            [email, hashedPassword, false]
        );

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

        // Simpan OTP ke database (hapus OTP lama untuk email ini jika ada)
        await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO otp_codes (email, otp_code, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Kirim email
        await sendOTPEmail(email, otp, 'verify');

        res.status(201).json({ message: 'Registrasi berhasil. Cek email untuk kode OTP.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// VERIFY OTP
/**
 * @openapi
 * /api/auth/verify-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verifikasi kode OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: Verifikasi berhasil
 *       400:
 *         description: Kode OTP tidak valid atau kadaluarsa
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', async (req, res) => {
    const { email, otp_code } = req.body;
    if (!email || !otp_code) {
        return res.status(400).json({ error: 'Email dan kode OTP wajib diisi' });
    }

    try {
        // Cari OTP yang valid
        const result = await pool.query(
            `SELECT * FROM otp_codes 
             WHERE email = $1 AND otp_code = $2 AND expires_at > NOW() AND is_used = FALSE`,
            [email, otp_code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa' });
        }

        // Tandai OTP sebagai used
        await pool.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);

        // Verifikasi user
        await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);

        res.json({ message: 'Verifikasi berhasil. Silakan login.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// LOGIN
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login pengguna
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Email atau password salah
 *       403:
 *         description: Email belum diverifikasi
 *       500:
 *         description: Server error
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    try {
        const userResult = await pool.query(
            'SELECT id, email, password_hash, is_verified FROM users WHERE email = $1',
            [email]
        );
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Email atau password salah' });
        }

        const user = userResult.rows[0];
        if (!user.is_verified) {
            return res.status(403).json({ error: 'Email belum diverifikasi. Cek OTP.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email atau password salah' });
        }

        // Buat JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ message: 'Login berhasil', token, userId: user.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// RESEND OTP
/**
 * @openapi
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Mengirim ulang kode OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP berhasil dikirim ulang
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       400:
 *         description: Email sudah terverifikasi atau tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

    try {
        // Pastikan user ada dan belum verified
        const user = await pool.query('SELECT is_verified FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'Email tidak terdaftar' });
        }
        if (user.rows[0].is_verified) {
            return res.status(400).json({ error: 'Email sudah terverifikasi' });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query('DELETE FROM otp_codes WHERE email = $1', [email]);
        await pool.query(
            'INSERT INTO otp_codes (email, otp_code, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        await sendOTPEmail(email, otp);
        res.json({ message: 'Kode OTP baru telah dikirim ke email.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// FORGOT PASSWORD
/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Kirim OTP untuk reset password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP terkirim (atau email tidak ditemukan, tetap 200)
 *       400:
 *         description: Email belum diverifikasi
 *       500:
 *         description: Server error
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email wajib diisi' });
    }

    try {
        // Cek apakah email terdaftar dan sudah terverifikasi
        const user = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);

        // Keamanan: jangan bocorkan apakah email terdaftar atau tidak
        if (user.rows.length === 0) {
            // Tetap balas 200 untuk menghindari brute force
            return res.status(200).json({ message: 'Jika email terdaftar, kode OTP akan dikirim.' });
        }

        if (!user.rows[0].is_verified) {
            return res.status(400).json({ error: 'Email belum diverifikasi. Lakukan verifikasi terlebih dahulu.' });
        }

        // Generate OTP 6 digit
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

        // Hapus OTP lama untuk email ini di tabel password_resets
        await pool.query('DELETE FROM password_resets WHERE email = $1', [email]);

        // Simpan OTP baru
        await pool.query(
            'INSERT INTO password_resets (email, otp_code, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Kirim email dengan tipe 'reset'
        await sendOTPEmail(email, otp, 'reset');

        res.status(200).json({ message: 'Kode OTP untuk reset password telah dikirim ke email.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// RESET PASSWORD
/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password dengan OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp_code
 *               - new_password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp_code:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *       400:
 *         description: OTP tidak valid atau password terlalu pendek
 *       500:
 *         description: Server error
 */
router.post('/reset-password', async (req, res) => {
    const { email, otp_code, new_password } = req.body;

    if (!email || !otp_code || !new_password) {
        return res.status(400).json({ error: 'Email, kode OTP, dan password baru wajib diisi' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(new_password)) {
        return res.status(400).json({ error: 'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka' });
    }

    try {
        // Cari OTP yang valid di tabel password_resets
        const result = await pool.query(
            `SELECT * FROM password_resets 
             WHERE email = $1 AND otp_code = $2 AND expires_at > NOW() AND is_used = FALSE`,
            [email, otp_code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa' });
        }

        // Tandai OTP sebagai sudah digunakan
        await pool.query('UPDATE password_resets SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);

        // Hash password baru
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update password user
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);

        res.json({ message: 'Password berhasil direset. Silakan login dengan password baru.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;