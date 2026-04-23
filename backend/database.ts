import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Vercel or in serverless, the filesystem is often read-only.
// We fallback to in-memory db which works for a stateless session.
let dbPath = path.join(__dirname, '../trading.db');
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  console.log('🚀 Serverless/Production environment detected: Using in-memory database for security and compatibility.');
  dbPath = ':memory:';
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    asset TEXT NOT NULL,
    type TEXT CHECK(type IN ('BUY', 'SELL')) NOT NULL,
    price REAL NOT NULL,
    amount REAL NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portfolio (
    asset TEXT PRIMARY KEY,
    quantity REAL NOT NULL DEFAULT 0,
    avg_price REAL NOT NULL DEFAULT 0
  );

  -- Initial portfolio state
  INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('bitcoin', 1.25, 62000);
  INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('ethereum', 15.4, 3400);
  INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('solana', 240.5, 145);
  INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('usd', 142509.42, 1);
`);

export default db;
