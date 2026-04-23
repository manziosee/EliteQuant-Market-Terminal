import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pure-JS in-memory store — used on Vercel where native binaries can be
// incompatible with the Lambda runtime. Mirrors the better-sqlite3 API for
// the exact queries used in backend/index.ts.
class InMemoryDatabase {
  private trades: Array<{
    id: string; asset: string; type: string;
    price: number; amount: number; timestamp: number;
  }> = [];

  private portfolio = [
    { asset: 'bitcoin', quantity: 1.25,      avg_price: 62000 },
    { asset: 'ethereum', quantity: 15.4,      avg_price: 3400  },
    { asset: 'solana',   quantity: 240.5,     avg_price: 145   },
    { asset: 'usd',      quantity: 142509.42, avg_price: 1     },
  ];

  prepare(sql: string) {
    const self = this;
    const s = sql.trim().toLowerCase();

    return {
      all(..._args: any[]): any[] {
        if (s.includes('from trades')) {
          const sorted = [...self.trades].sort((a, b) => b.timestamp - a.timestamp);
          const m = s.match(/limit\s+(\d+)/);
          return m ? sorted.slice(0, parseInt(m[1])) : sorted;
        }
        if (s.includes('from portfolio')) return [...self.portfolio];
        return [];
      },
      get(...args: any[]): any {
        return this.all(...args)[0] ?? null;
      },
      run(...args: any[]) {
        if (s.startsWith('insert into trades')) {
          const [id, asset, type, price, amount, timestamp] = args;
          self.trades.push({ id, asset, type, price: +price, amount: +amount, timestamp: +timestamp });
        } else if (s.includes("asset = 'usd'") && s.includes('quantity + ?')) {
          const usd = self.portfolio.find(p => p.asset === 'usd');
          if (usd) usd.quantity += +args[0];
        } else if (s.includes("asset = 'usd'") && s.includes('quantity - ?')) {
          const usd = self.portfolio.find(p => p.asset === 'usd');
          if (usd) usd.quantity -= +args[0];
        } else if (s.includes('quantity + ? where asset = ?')) {
          const item = self.portfolio.find(p => p.asset === args[1]);
          if (item) item.quantity += +args[0];
        } else if (s.includes('quantity - ? where asset = ?')) {
          const item = self.portfolio.find(p => p.asset === args[1]);
          if (item) item.quantity -= +args[0];
        }
        return { changes: 1, lastInsertRowid: 0 };
      },
    };
  }

  exec(sql: string) {
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      const lower = stmt.toLowerCase();
      if (lower.startsWith('delete from trades')) {
        this.trades = [];
      } else {
        const m = lower.match(/update portfolio set quantity = ([\d.]+) where asset = '(\w+)'/);
        if (m) {
          const item = this.portfolio.find(p => p.asset === m[2]);
          if (item) item.quantity = parseFloat(m[1]);
        }
      }
    }
  }
}

let db: any;

if (process.env.VERCEL) {
  // Vercel serverless: avoid native module entirely
  db = new InMemoryDatabase();
} else {
  try {
    // Dynamic import so bundlers don't hard-fail if the binary is missing
    const mod = await import('better-sqlite3' as any);
    const Database = (mod.default ?? mod) as any;
    const dbPath = process.env.NODE_ENV === 'production'
      ? ':memory:'
      : path.join(__dirname, '../trading.db');
    const sqlite = new Database(dbPath);
    sqlite.exec(`
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
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('bitcoin', 1.25, 62000);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('ethereum', 15.4, 3400);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('solana', 240.5, 145);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('usd', 142509.42, 1);
    `);
    db = sqlite;
  } catch {
    console.warn('better-sqlite3 unavailable, falling back to in-memory store');
    db = new InMemoryDatabase();
  }
}

export default db;
