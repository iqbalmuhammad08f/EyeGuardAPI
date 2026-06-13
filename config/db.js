// config/db.js
const { Pool } = require('@neondatabase/serverless');

// Ambil connection string dari environment variable yang disediakan Vercel
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('FATAL ERROR: Environment variable DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  // Di production (Vercel/Neon) gunakan SSL penuh; saat dev lokal bisa relax
  ssl: process.env.NODE_ENV === 'production'
    ? true
    : { rejectUnauthorized: false },
});

module.exports = pool;