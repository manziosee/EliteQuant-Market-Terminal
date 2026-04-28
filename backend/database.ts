import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InMemoryDatabase {
  private trades: Array<{
    id: string; asset: string; type: string;
    price: number; amount: number; timestamp: number; pnl: number;
  }> = [];

  private portfolio = [
    { asset: 'bitcoin',   quantity: 1.25,      avg_price: 62000 },
    { asset: 'ethereum',  quantity: 15.4,       avg_price: 3400  },
    { asset: 'solana',    quantity: 240.5,      avg_price: 145   },
    { asset: 'cardano',   quantity: 5000,       avg_price: 0.45  },
    { asset: 'polkadot',  quantity: 100,        avg_price: 7.5   },
    { asset: 'dogecoin',  quantity: 10000,      avg_price: 0.12  },
    { asset: 'ripple',    quantity: 3000,       avg_price: 0.52  },
    { asset: 'chainlink', quantity: 200,        avg_price: 14.5  },
    { asset: 'uniswap',   quantity: 150,        avg_price: 10.0  },
    { asset: 'usd',       quantity: 142509.42,  avg_price: 1     },
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
          const [id, asset, type, price, amount, timestamp, pnl] = args;
          self.trades.push({ id, asset, type, price: +price, amount: +amount, timestamp: +timestamp, pnl: +(pnl ?? 0) });
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
  db = new InMemoryDatabase();
} else {
  try {
    const _require = createRequire(import.meta.url);
    const Database = _require('better-sqlite3') as any;
    const dbPath = process.env.NODE_ENV === 'production'
      ? ':memory:'
      : path.join(__dirname, '../trading.db');
    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        asset TEXT NOT NULL,
        type TEXT CHECK(type IN ('BUY','SELL')) NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        pnl REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS portfolio (
        asset TEXT PRIMARY KEY,
        quantity REAL NOT NULL DEFAULT 0,
        avg_price REAL NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('bitcoin',   1.25,      62000);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('ethereum',  15.4,      3400);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('solana',    240.5,     145);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('cardano',   5000,      0.45);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('polkadot',  100,       7.5);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('dogecoin',  10000,     0.12);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('ripple',    3000,      0.52);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('chainlink', 200,       14.5);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('uniswap',   150,       10.0);
      INSERT OR IGNORE INTO portfolio (asset, quantity, avg_price) VALUES ('usd',       142509.42, 1);
    `);
    db = sqlite;
  } catch {
    console.warn('better-sqlite3 unavailable, falling back to in-memory store');
    db = new InMemoryDatabase();
  }
}

export default db;
