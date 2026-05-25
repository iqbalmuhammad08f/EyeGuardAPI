const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // gunakan SSL/TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOTPEmail = async (toEmail, otpCode, type = 'verify') => {
    let subject, text, html;
    
    if (type === 'reset') {
        subject = 'Reset Password EyeGuard Mobile';
        text = `Kode OTP untuk reset password Anda: ${otpCode}. Berlaku 10 menit. Jika Anda tidak meminta reset password, abaikan email ini.`;
        html = `<b>Kode OTP untuk reset password Anda: ${otpCode}</b><br/>Berlaku 10 menit.<br/><br/>Jika Anda tidak meminta reset password, abaikan email ini.`;
    } else {
        subject = 'Verifikasi Email EyeGuard Mobile';
        text = `Kode OTP verifikasi Anda: ${otpCode}. Berlaku 10 menit.`;
        html = `<b>Kode OTP verifikasi Anda: ${otpCode}</b><br/>Berlaku 10 menit.`;
    }

    const info = await transporter.sendMail({
        from: `"EyeGuard Mobile" <${process.env.EMAIL_USER}>`, // dari email asli
        to: toEmail,
        subject,
        text,
        html
    });
    
    console.log('Email sent: %s', info.messageId);
    // Dengan Gmail, tidak ada preview URL seperti Ethereal. Tapi email akan masuk ke kotak masuk penerima.
    // Anda bisa cek di sent folder atau inbox penerima.
    return info;
};

module.exports = { sendOTPEmail };