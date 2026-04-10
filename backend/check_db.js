const pool = require('./db');

async function check() {
  try {
    const tableRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_activity';
    `);
    console.log("Table structure for 'user_activity':");
    console.table(tableRes.rows);

    const checkRes = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'user_activity'::regclass;
    `);
    console.log("Constraints for 'user_activity':");
    console.table(checkRes.rows);

    const indexRes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_activity';
    `);
    console.log("Indexes for 'user_activity':");
    console.table(indexRes.rows);

    const countRes = await pool.query("SELECT COUNT(*) FROM user_activity");
    console.log("Total records in 'user_activity':", countRes.rows[0].count);

  } catch (err) {
    console.error("Error checking DB:", err);
  } finally {
    await pool.end();
  }
}

check();
