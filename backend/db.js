const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is NOT set. Falling back to local configuration.");
}

console.log("Using DATABASE_URL:", !!process.env.DATABASE_URL);

const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
      user: "postgres",
      host: "localhost",
      database: "eventflow_db",
      password: "risha", 
      port: 5432,
    });

module.exports = pool;