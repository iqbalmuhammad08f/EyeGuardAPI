# EyeGuard Mobile API

Backend API untuk aplikasi **EyeGuard Mobile** — monitoring penggunaan smartphone dengan deteksi kondisi cahaya lingkungan.  
Dibangun menggunakan **Node.js + Express** dan database **PostgreSQL (Neon Serverless)**.

[![Deploy](https://img.shields.io/badge/deploy-Vercel-black)](https://eye-guard-api.vercel.app)
[![Docs](https://img.shields.io/badge/docs-Swagger%20UI-green)](https://eye-guard-api.vercel.app/api-docs)

---

## 📦 Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 5 |
| Database | PostgreSQL via Neon Serverless |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Email | Nodemailer + Gmail SMTP |
| Dokumentasi | Swagger (swagger-jsdoc + custom UI) |
| Deploy | Vercel |

---

## 🚀 Setup Lokal

### 1. Clone & Install

```bash
git clone https://github.com/iqbalmuhammad08f/EyeGuardAPI.git
cd EyeGuardAPI
npm install
```

### 2. Konfigurasi Environment

Salin contoh berikut ke file `.env` di root project:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# JWT
JWT_SECRET=ganti_dengan_secret_yang_kuat_dan_panjang

# Email (Gmail SMTP)
EMAIL_USER=emailkamu@gmail.com
EMAIL_PASS=gmail_app_password

# CORS — daftar origin yang diizinkan, pisahkan dengan koma
# Kosongkan / tidak diset = hanya localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com

# Environment
NODE_ENV=development
```

> **Catatan Gmail:** Gunakan [App Password](https://myaccount.google.com/apppasswords), bukan password akun utama. Aktifkan 2FA terlebih dahulu.

### 3. Jalankan

```bash
# Development (dengan auto-restart)
npm run dev

# Production
npm start
```

Server berjalan di `http://localhost:3000`.  
Swagger UI tersedia di `http://localhost:3000/api-docs`.

---

## 🗄️ Skema Database

```sql
-- Tabel utama pengguna
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'user',   -- 'user' | 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token OTP (register & reset password)
CREATE TABLE verification_tokens (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token_type TEXT NOT NULL,   -- 'register' | 'reset'
    token_hash TEXT NOT NULL,
    password_hash TEXT,         -- hanya untuk register
    name TEXT,                  -- hanya untuk register
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregat penggunaan harian
CREATE TABLE daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_minutes INT DEFAULT 0,
    UNIQUE (user_id, date)
);

-- Detail per aplikasi
CREATE TABLE app_usage (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_usage_id INT REFERENCES daily_usage(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    app_name TEXT,
    duration_minutes INT DEFAULT 0,
    UNIQUE (daily_usage_id, package_name)
);

-- Pembacaan sensor cahaya
CREATE TABLE light_readings (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    lux FLOAT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);
```

---

## 🔑 Autentikasi

API menggunakan **JWT Bearer Token**.

1. Register → verifikasi OTP → Login → dapat `token`
2. Sertakan token di setiap request yang membutuhkan auth:

```
Authorization: Bearer <token>
```

Token berlaku **7 hari**.

---

## 📡 Endpoint Ringkasan

### Auth
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/auth/register` | Daftar akun baru, kirim OTP ke email |
| POST | `/api/auth/verify-otp` | Verifikasi OTP untuk aktivasi akun |
| POST | `/api/auth/login` | Login, mendapat JWT token |
| POST | `/api/auth/resend-otp` | Kirim ulang OTP (cooldown 60 detik) |
| POST | `/api/auth/forgot-password` | Minta OTP reset password |
| POST | `/api/auth/reset-password` | Reset password dengan OTP |

### Usage (🔒 Auth required)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/usage` | Kirim data penggunaan aplikasi harian |
| GET | `/api/stats?period=day\|week\|month` | Ambil statistik penggunaan |

### Light Sensor (🔒 Auth required)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/light` | Kirim batch data sensor cahaya (lux) |
| GET | `/api/stats/light?date=YYYY-MM-DD` | Ambil riwayat cahaya harian |

### Profile (🔒 Auth required)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/profile/me` | Lihat profil |
| PATCH | `/api/profile/me` | Edit nama / ganti password |
| DELETE | `/api/profile/me` | Hapus akun (konfirmasi password) |

### Admin (🔒 Admin only)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/admin/summary` | KPI dashboard admin |
| GET | `/api/admin/users` | Daftar user (paginated + search) |
| GET | `/api/admin/stats/apps` | Top 10 aplikasi terpopuler |

### System
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Health check server |

---

## 📝 Contoh Request

### Register
```bash
curl -X POST https://eye-guard-api.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"Password123"}'
```

### Login
```bash
curl -X POST https://eye-guard-api.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Password123"}'
```

### Kirim Data Usage
```bash
curl -X POST https://eye-guard-api.vercel.app/api/usage \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-06-13",
    "totalUsageMinutes": 155,
    "apps": [
      {"packageName": "com.zhiliaoapp.musically", "appName": "TikTok", "durationMinutes": 46},
      {"packageName": "com.instagram.android", "appName": "Instagram", "durationMinutes": 30}
    ]
  }'
```

---

## 🛡️ Keamanan

- **Rate Limiting**: Auth endpoints dibatasi 30 req / 15 menit per IP; semua API 300 req / 15 menit
- **Password Policy**: Minimal 8 karakter, huruf besar, huruf kecil, dan angka
- **OTP**: Di-hash dengan bcrypt, berlaku 10 menit, cooldown 60 detik antar kirim
- **JWT**: Berisi `userId`, `email`, `name`, `role` — berlaku 7 hari
- **CORS**: Dibatasi ke origin yang dikonfigurasi via `ALLOWED_ORIGINS`

---

## 📚 Dokumentasi API

Dokumentasi lengkap tersedia via Swagger UI:

- **Production**: https://eye-guard-api.vercel.app/api-docs
- **Lokal**: http://localhost:3000/api-docs
- **JSON Spec**: https://eye-guard-api.vercel.app/api-docs.json
