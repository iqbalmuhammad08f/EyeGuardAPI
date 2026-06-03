const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendOTPEmail } = require('../utils/mailer');

const router = express.Router();

// Helper: generate OTP 6 digit
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

// Helper: hash OTP
const hashOTP = async (otp) => {
    return await bcrypt.hash(otp, 10);
};

// Helper: verify OTP
const verifyOTP = async (otp, hash) => {
    return await bcrypt.compare(otp, hash);
};

// Helper: cek cooldown 60 detik
const checkCooldown = async (email, tokenType) => {
    const result = await pool.query(
        `SELECT last_sent_at FROM verification_tokens 
         WHERE email = $1 AND token_type = $2 AND is_used = FALSE
         ORDER BY last_sent_at DESC LIMIT 1`,
        [email, tokenType]
    );
    if (result.rows.length > 0) {
        const lastSent = new Date(result.rows[0].last_sent_at);
        const now = new Date();
        const diffSeconds = (now - lastSent) / 1000;
        if (diffSeconds < 60) {
            const remaining = Math.ceil(60 - diffSeconds);
            throw new Error(`Tunggu ${remaining} detik sebelum meminta kode baru`);
        }
    }
    return true;
};

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registrasi pengguna baru
 *     description: Mengirim OTP ke email. Data disimpan sementara di verification_tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Registrasi berhasil, OTP dikirim
 *       400:
 *         description: Input tidak valid atau password lemah
 *       409:
 *         description: Email sudah terdaftar
 *       500:
 *         description: Server error
 */
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nama, email dan password wajib diisi' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka' });
    }

    try {
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'Email sudah terdaftar' });
        }

        // Hapus token register lama yang belum dipakai
        await pool.query(
            `DELETE FROM verification_tokens WHERE email = $1 AND token_type = 'register' AND is_used = FALSE`,
            [email]
        );

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const hashedOTP = await hashOTP(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            `INSERT INTO verification_tokens (email, token_type, token_hash, password_hash, name, expires_at, last_sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [email, 'register', hashedOTP, hashedPassword, name, expiresAt]
        );

        await sendOTPEmail(email, otp, 'verify');
        res.status(201).json({ message: 'Registrasi berhasil. Cek email untuk kode OTP.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

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
 *         description: OTP tidak valid atau kadaluarsa
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', async (req, res) => {
    const { email, otp_code } = req.body;
    if (!email || !otp_code) return res.status(400).json({ error: 'Email dan kode OTP wajib diisi' });

    try {
        const tokenResult = await pool.query(
            `SELECT * FROM verification_tokens 
             WHERE email = $1 AND token_type = 'register' AND expires_at > NOW() AND is_used = FALSE
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa' });
        }

        const token = tokenResult.rows[0];
        const isValid = await verifyOTP(otp_code, token.token_hash);
        if (!isValid) {
            return res.status(400).json({ error: 'Kode OTP salah' });
        }

        await pool.query('UPDATE verification_tokens SET is_used = TRUE WHERE id = $1', [token.id]);

        // Pindahkan data ke users (termasuk name)
        await pool.query(
            `INSERT INTO users (name, email, password_hash, is_verified)
             VALUES ($1, $2, $3, $4)`,
            [token.name, email, token.password_hash, true]
        );

        res.json({ message: 'Verifikasi berhasil. Silakan login.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Kirim ulang kode OTP (cooldown 60 detik)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP baru dikirim
 *       429:
 *         description: Cooldown, tunggu beberapa detik
 *       400:
 *         description: Email sudah terverifikasi atau tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

    try {
        const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (user.rows.length > 0) {
            return res.status(400).json({ error: 'Email sudah terverifikasi' });
        }

        await checkCooldown(email, 'register');

        const tokenResult = await pool.query(
            `SELECT id FROM verification_tokens 
             WHERE email = $1 AND token_type = 'register' AND is_used = FALSE`,
            [email]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tidak ada proses registrasi untuk email ini' });
        }

        const otp = generateOTP();
        const hashedOTP = await hashOTP(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            `UPDATE verification_tokens 
             SET token_hash = $1, expires_at = $2, last_sent_at = NOW()
             WHERE id = $3`,
            [hashedOTP, expiresAt, tokenResult.rows[0].id]
        );

        await sendOTPEmail(email, otp, 'verify');
        res.json({ message: 'Kode OTP baru telah dikirim ke email.' });
    } catch (err) {
        if (err.message && err.message.includes('Tunggu')) {
            return res.status(429).json({ error: err.message });
        }
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

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
 *         description: Login berhasil, mengembalikan token JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 userId:
 *                   type: integer
 *                 name:
 *                   type: string
 *       401:
 *         description: Email atau password salah
 *       403:
 *         description: Email belum diverifikasi
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

    try {
        const userResult = await pool.query(
            'SELECT id, name, email, password_hash, is_verified FROM users WHERE email = $1',
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

        const token = jwt.sign(
            { userId: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ message: 'Login berhasil', token, userId: user.id, name: user.name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Kirim OTP untuk reset password (cooldown 60 detik)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP dikirim (atau email tidak ditemukan)
 *       429:
 *         description: Cooldown, tunggu beberapa detik
 *       500:
 *         description: Server error
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

    try {
        const user = await pool.query('SELECT id FROM users WHERE email = $1 AND is_verified = TRUE', [email]);
        if (user.rows.length === 0) {
            return res.status(200).json({ message: 'Jika email terdaftar, kode OTP akan dikirim.' });
        }

        await checkCooldown(email, 'reset');

        await pool.query(
            `DELETE FROM verification_tokens WHERE email = $1 AND token_type = 'reset' AND is_used = FALSE`,
            [email]
        );

        const otp = generateOTP();
        const hashedOTP = await hashOTP(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            `INSERT INTO verification_tokens (email, token_type, token_hash, expires_at, last_sent_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [email, 'reset', hashedOTP, expiresAt]
        );

        await sendOTPEmail(email, otp, 'reset');
        res.status(200).json({ message: 'Kode OTP untuk reset password telah dikirim ke email.' });
    } catch (err) {
        if (err.message && err.message.includes('Tunggu')) {
            return res.status(429).json({ error: err.message });
        }
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

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
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *       400:
 *         description: OTP tidak valid atau password lemah
 *       500:
 *         description: Server error
 */
router.post('/reset-password', async (req, res) => {
    const { email, otp_code, new_password } = req.body;
    if (!email || !otp_code || !new_password) {
        return res.status(400).json({ error: 'Email, kode OTP, dan password baru wajib diisi' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password minimal 8 karakter' });
    }

    try {
        const tokenResult = await pool.query(
            `SELECT * FROM verification_tokens 
             WHERE email = $1 AND token_type = 'reset' AND expires_at > NOW() AND is_used = FALSE
             ORDER BY created_at DESC LIMIT 1`,
            [email]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kadaluarsa' });
        }

        const token = tokenResult.rows[0];
        const isValid = await verifyOTP(otp_code, token.token_hash);
        if (!isValid) {
            return res.status(400).json({ error: 'Kode OTP salah' });
        }

        await pool.query('UPDATE verification_tokens SET is_used = TRUE WHERE id = $1', [token.id]);

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);

        res.json({ message: 'Password berhasil direset. Silakan login dengan password baru.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

module.exports = router;