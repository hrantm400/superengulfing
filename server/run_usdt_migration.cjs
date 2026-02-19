require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'superengulfing_email',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function run() {
    try {
        const migrations = [
            { file: '029_usdt_orders.sql', label: '029 (usdt_orders)' },
            { file: '030_usdt_deposit_addresses.sql', label: '030 (usdt_deposit_addresses)' },
        ];

        for (const m of migrations) {
            const sqlPath = path.join(__dirname, 'migrations', m.file);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`Running migration ${m.label}...`);
            await pool.query(sql);
            console.log(`Migration ${m.label} success`);
        }
    } catch (e) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
