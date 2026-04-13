const pool = require("./db");

async function fixSchema() {
  const client = await pool.connect();
  try {
    console.log("Starting Schema Fix Migration...");
    await client.query('BEGIN');

    // 1. Ensure events table has required columns
    console.log("Checking 'events' table...");
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS total_seats INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS available_seats INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS form_fields JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
    `);

    // 2. Ensure tickets table has required columns
    console.log("Checking 'tickets' table...");
    // Check if tickets table exists first
    const ticketsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tickets'
      );
    `);

    if (ticketsTableExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE tickets 
        ADD COLUMN IF NOT EXISTS sold INT NOT NULL DEFAULT 0;
      `);
    } else {
      await client.query(`
        CREATE TABLE tickets (
          id SERIAL PRIMARY KEY,
          event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          price NUMERIC(10, 2) NOT NULL DEFAULT 0,
          quantity INT NOT NULL DEFAULT 0,
          sold INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    }

    // 3. Ensure bookings table has required columns
    console.log("Checking 'bookings' table...");
    const bookingsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bookings'
      );
    `);

    if (bookingsTableExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS ticket_type TEXT,
        ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS ticket_id INT REFERENCES tickets(id) ON DELETE SET NULL;
      `);
    } else {
      await client.query(`
        CREATE TABLE bookings (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          ticket_id INT REFERENCES tickets(id) ON DELETE SET NULL,
          ticket_type TEXT,
          responses JSONB DEFAULT '{}'::jsonb,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    }

    // 4. Ensure registrations table has required columns
    console.log("Checking 'registrations' table...");
    await client.query(`
      ALTER TABLE registrations 
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed',
      ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb;
    `);

    // 5. Ensure user_activity table exists (just in case)
    console.log("Checking 'user_activity' table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        action_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log("✅ Schema Fix Successful!");
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Schema Fix Failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

fixSchema();
