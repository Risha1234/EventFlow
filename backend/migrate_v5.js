const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log("Adding schema indexes for search and queries...");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_events_is_paid ON events(is_paid);
      CREATE INDEX IF NOT EXISTS idx_tickets_event_id_price ON tickets(event_id, price);
    `);

    console.log("Indexes successfully created.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

migrate();
