require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'superengulfing_email',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
});

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', '019_site_settings_locale.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration 019 (site_settings per locale)...');
        await pool.query(sql);
        console.log('✅ Migration 019 success');
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
