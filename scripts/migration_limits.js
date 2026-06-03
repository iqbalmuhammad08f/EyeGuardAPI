// scripts/migration_limits.js
require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
    console.log('Starting migration for app_limits table...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS app_limits (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                package_name VARCHAR(255) NOT NULL,
                app_name VARCHAR(255),
                limit_minutes INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, package_name)
            );
        `;
        
        await client.query(createTableQuery);
        
        // Buat trigger untuk update timestamp updated_at otomatis (opsional tapi bagus)
        const createTriggerFunctionQuery = `
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `;
        await client.query(createTriggerFunctionQuery);

        const createTriggerQuery = `
            CREATE OR REPLACE TRIGGER update_app_limits_updated_at
            BEFORE UPDATE ON app_limits
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `;
        await client.query(createTriggerQuery);

        await client.query('COMMIT');
        console.log('Migration completed successfully: app_limits table is ready.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
