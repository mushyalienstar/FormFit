// PostgreSQL setup: users + one saved-state blob per user.
require("dotenv").config();

const { Pool } = require("pg");

// Use the DATABASE_URL environment variable provided by Render/Neon/Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Required for many managed Postgres providers (like Render/Neon)
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") 
    ? false 
    : { rejectUnauthorized: false },
});

// Initialize tables
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS states (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database initialized");
  } catch (err) {
    console.error("Failed to initialize database", err);
  }
}

// Call init on startup
initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
