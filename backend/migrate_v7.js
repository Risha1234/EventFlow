const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'eventflow_db',
  password: 'risha',
  port: 5432,
});

async function migrate() {
  try {
    console.log("Starting migration v7 (Category Support)...");

    await pool.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    `);

    console.log("Successfully added 'category' column and index to 'events' table.");
  } catch (err) {
    console.error("Migration v7 error:", err);
  } finally {
    await pool.end();
  }
}

migrate();
