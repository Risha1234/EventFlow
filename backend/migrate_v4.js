const pool = require("./db");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Starting migration v4 (Dynamic Registration Forms)...");

    await client.query('BEGIN');

    // 1. Add form_fields column to events table
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS form_fields JSONB DEFAULT '[]'::jsonb
    `);
    console.log("✓ Added form_fields column to events table.");

    // 2. Add responses column to registrations table
    await client.query(`
      ALTER TABLE registrations
      ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb
    `);
    console.log("✓ Added responses column to registrations table.");

    // 3. Add responses column to bookings table
    await client.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb
    `);
    console.log("✓ Added responses column to bookings table.");

    await client.query('COMMIT');
    console.log("\n✅ Migration v4 successful.");
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Migration v4 failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
