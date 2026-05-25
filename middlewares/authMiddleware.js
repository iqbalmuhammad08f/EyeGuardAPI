const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Ambil token dari header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token tidak disediakan atau format salah' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // menyimpan data user (userId, email) ke request
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token tidak valid' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token sudah kadaluarsa' });
        }
        return res.status(500).json({ error: 'Terjadi kesalahan verifikasi token' });
    }
};

module.exports = authMiddleware;