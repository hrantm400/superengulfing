require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'superengulfing_email',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Hrant1996...'
});

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', '011_dashboard_users_first_name.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration 011 (dashboard_users first_name)...');
        await pool.query(sql);
        console.log('Migration 011 success');
    } catch (e) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
