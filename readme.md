# EyeGuard Mobile API

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-blue.svg)](https://nodejs.org)
[![Express Version](https://img.shields.io/badge/express-v5.2.1-green.svg)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/postgres-%3E%3D%2012-blue.svg)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](https://opensource.org/licenses/ISC)

Backend REST API untuk **EyeGuard**, sebuah aplikasi monitoring penggunaan smartphone yang dilengkapi dengan fitur deteksi cahaya lingkungan. API ini menangani otentikasi pengguna, verifikasi OTP via email, manajemen reset password, serta proteksi endpoint data statistik menggunakan JWT (JSON Web Tokens).

---

## Fitur Utama

- **Authentication & Authorization**: Registrasi dan login pengguna dengan password terenkripsi (`bcrypt`) dan otorisasi berbasis Token JWT.
- **Secure OTP Verification**: Verifikasi pendaftaran akun baru menggunakan kode OTP 6-digit yang dikirimkan langsung ke email pengguna (menggunakan Nodemailer & SMTP Gmail).
- **Password Self-Service**: Fitur lupa password dan reset password terproteksi menggunakan kode verifikasi OTP.
- **Protected Routes**: Middleware JWT untuk mengamankan data privat seperti statistik penggunaan aplikasi.
- **Interactive API Docs**: Dokumentasi API interaktif menggunakan **Swagger UI** yang dapat diakses langsung dari browser.

---

## Tech Stack

- **Runtime Environment**: [Node.js](https://nodejs.org/)
- **Web Framework**: [Express.js](https://expressjs.com/) (v5.2.1)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (`pg` pool)
- **Security**: 
  - `bcrypt` (Hashing password)
  - `jsonwebtoken` (Otentikasi JWT)
- **Email Service**: [Nodemailer](https://nodemailer.com/) (Gmail SMTP)
- **Documentation**: [Swagger UI Express](https://swagger.io/tools/swagger-ui/) & `swagger-jsdoc`

---

## Struktur Proyek

```text
EyeGuardAPI/
├── config/
│   └── db.js                 # Koneksi PostgreSQL pool
├── middlewares/
│   └── authMiddleware.js     # Middleware validasi JWT
├── routes/
│   ├── auth.js               # Endpoint registrasi, login, & OTP
│   └── dashboard.js          # Endpoint statistik terproteksi
├── swagger/
│   └── swagger.js            # Konfigurasi Swagger JSDoc
├── utils/
│   └── mailer.js             # Integrasi Nodemailer untuk email OTP
├── .env                      # Konfigurasi Environment Variables
├── index.js                  # Main entry point aplikasi
├── package.json              # Daftar dependency & skrip npm
└── README.md                 # Dokumentasi proyek
```

---

## Persiapan Database

Sebelum menjalankan API, buatlah database PostgreSQL baru dengan nama `eyeguard_db` (atau sesuai konfigurasi `.env` Anda), kemudian jalankan query SQL berikut untuk membuat tabel-tabel yang diperlukan:

```sql
-- 1. Tabel Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel OTP Codes (Untuk Registrasi/Verifikasi Email)
CREATE TABLE otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Password Resets (Untuk Lupa Password)
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Instalasi & Konfigurasi

### 1. Kloning Repositori
```bash
git clone https://github.com/iqbalmuhammad08f/EyeGuardAPI.git
cd EyeGuardAPI
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Buat berkas `.env` di root direktori proyek Anda dan sesuaikan isinya:

```env
PORT=3000

# Konfigurasi PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=eyeguard_db

# Kunci Keamanan JWT
JWT_SECRET=gunakan_kunci_rahasia_dan_panjang_disini

# Konfigurasi SMTP Gmail (Gunakan App Password dari Google Account)
EMAIL_USER=email_anda@gmail.com
EMAIL_PASS=16_karakter_app_password
```

> **Tips Gmail SMTP**: Untuk `EMAIL_PASS`, Anda wajib mengaktifkan 2-Step Verification pada akun Google Anda, kemudian buat **App Password** (Sandi Aplikasi) berukuran 16 karakter dan tempel tanpa spasi ke berkas `.env`.

---

## Menjalankan Aplikasi

### Mode Pengembangan (Development)
Menggunakan `nodemon` agar server otomatis memuat ulang saat ada perubahan kode:
```bash
npm run dev
```

### Mode Produksi (Production)
```bash
npm start
```

Setelah server berhasil dijalankan, Anda akan melihat output di terminal:
```text
Server running on port 3000
Swagger docs: http://localhost:3000/api-docs
```

---

## Dokumentasi API & Swagger

Dokumentasi API telah terintegrasi secara interaktif menggunakan **Swagger UI**. Anda dapat melihat detail skema *request body*, skema *response*, dan mencoba langsung seluruh endpoint melalui:

**Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)  
**Swagger JSON**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

### Ringkasan Endpoint API

#### Authentication & Account Management (`/api/auth`)

| Method | Endpoint | Keterangan | Proteksi |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Registrasi akun baru (Kirim OTP Verifikasi) | Bebas |
| **POST** | `/api/auth/verify-otp` | Verifikasi akun baru dengan kode OTP | Bebas |
| **POST** | `/api/auth/login` | Login pengguna, mendapatkan JWT Token | Bebas |
| **POST** | `/api/auth/resend-otp` | Kirim ulang kode OTP verifikasi email | Bebas |
| **POST** | `/api/auth/forgot-password` | Kirim OTP untuk verifikasi lupa password | Bebas |
| **POST** | `/api/auth/reset-password` | Reset password dengan kode OTP baru | Bebas |

#### Dashboard & Monitoring (`/api/dashboard`)

| Method | Endpoint | Keterangan | Proteksi |
| :--- | :--- | :--- | :---: |
| **GET** | `/api/dashboard/stats` | Dapatkan statistik penggunaan smartphone | **JWT Token** |
