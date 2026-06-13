/**
 * Middleware untuk memastikan user yang mengakses adalah admin.
 * Role dibaca dari JWT payload (sudah disimpan saat login),
 * sehingga tidak perlu query DB setiap request.
 */
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Otorisasi gagal, token tidak valid' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Endpoint ini hanya untuk admin.' });
    }

    next();
};

module.exports = adminMiddleware;
