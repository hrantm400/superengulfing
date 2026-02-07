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
        const sqlPath = path.join(__dirname, 'migrations', '010_video_type_wistia.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration 010 (video_type: vimeo -> wistia)...');
        await pool.query(sql);
        console.log('Migration 010 success');
    } catch (e) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
