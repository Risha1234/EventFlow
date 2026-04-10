const pool = require("./db");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Starting migration v3 (Ticketing System)...");

    await client.query('BEGIN');

    // 1. Add is_paid column to events table
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false
    `);
    console.log("✓ Added is_paid column to events table.");

    // 2. Create tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        quantity INT NOT NULL DEFAULT 0,
        sold INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✓ Created tickets table.");

    // 3. Create bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        ticket_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✓ Created bookings table.");

    // 4. Add index for faster booking lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id)
    `);
    console.log("✓ Created indexes.");

    await client.query('COMMIT');
    console.log("\n✅ Migration v3 successful.");
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Migration v3 failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
