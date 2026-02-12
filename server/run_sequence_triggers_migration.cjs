#!/usr/bin/env node
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

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running sequence_triggers migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', '007_sequence_triggers.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(sql);
    console.log('✅ sequence_triggers migration applied successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});