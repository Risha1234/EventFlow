const pool = require("./db");

async function migrate() {
  try {
    console.log("Starting migration v2...");

    // 1. Add seat management to events
    await pool.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS total_seats INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS available_seats INT DEFAULT 0
    `);
    console.log("Added seat columns to events table.");

    // 2. Add status to registrations
    await pool.query(`
      ALTER TABLE registrations 
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed'
    `);
    console.log("Added status column to registrations table.");

    // 3. Add unique constraint to registrations
    // Note: This may fail if there are already duplicate user_id, event_id pairs.
    // We'll use a try-catch for this specific step to provide a clear error message.
    try {
      await pool.query(`
        ALTER TABLE registrations 
        ADD CONSTRAINT unique_user_event UNIQUE (user_id, event_id)
      `);
      console.log("Added UNIQUE constraint to registrations table.");
    } catch (err) {
      if (err.code === '42710') {
        console.log("UNIQUE constraint already exists.");
      } else if (err.code === '23505') {
        console.warn("Failed to add UNIQUE constraint: Duplicate registrations already exist. Please clean up data before adding this constraint.");
      } else {
        throw err;
      }
    }

    console.log("Migration v2 successful.");
    process.exit(0);
  } catch (err) {
    console.error("Migration v2 failed:", err);
    process.exit(1);
  }
}

migrate();
