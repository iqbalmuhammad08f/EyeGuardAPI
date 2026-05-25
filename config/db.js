// config/db.js
const { Pool } = require('@neondatabase/serverless');

// Ambil connection string dari environment variable yang disediakan Vercel
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('FATAL ERROR: Environment variable POSTGRES_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  // Opsional, tambahkan ini untuk koneksi yang lebih stabil di serverless
  ssl: { rejectUnauthorized: false } 
});

module.exports = pool;