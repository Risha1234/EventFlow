const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "eventflow_db",
  password: "risha", 
  port: 5432,
});

module.exports = pool;