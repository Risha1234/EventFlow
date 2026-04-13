const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

console.log("Connecting to PostgreSQL...");
console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log("Database Host:", dbUrl.host);
  } catch (e) {
    console.log("Database URL is present but not a valid URL format");
  }
} else {
  console.error("❌ ERROR: DATABASE_URL is not defined in environment variables!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;