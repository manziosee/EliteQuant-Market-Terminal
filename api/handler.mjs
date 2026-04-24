// api/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// backend/index.ts
import axios from "axios";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

// backend/database.ts
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var InMemoryDatabase = class {
  constructor() {
    this.trades = [];
    this.portfolio = [
      { asset: "bitcoin", quantity: 1.25, avg_price: 62e3 },
      { asset: "ethereum", quantity: 15.4, avg_price: 3400 },
      { asset: "solana", quantity: 240.5, avg_price: 145 },
      { asset: "usd", quantity: 142509.42, avg_price: 1 }
    ];
  }
  prepare(sql) {
    const self = this;
    const s = sql.trim().toLowerCase();
    return {
      all(..._args) {
        if (s.includes("from trades")) {
          const sorted = [...self.trades].sort((a, b) => b.timestamp - a.timestamp);
          const m = s.match(/limit\s+(\d+)/);
          return m ? sorted.slice(0, parseInt(m[1])) : sorted;
        }
        if (s.includes("from portfolio")) return [...self.portfolio];
        return [];
      },
      get(...args) {
        return this.all(...args)[0] ?? null;
      },
      run(...args) {
        if (s.startsWith("insert into trades")) {
          const [id, asset, type, price, amount, timestamp] = args;
          self.trades.push({ id, asset, type, price: +price, amount: +amount, timestamp: +timestamp });
        } else if (s.includes("asset = 'usd'") && s.includes("quantity + ?")) {
          const usd = self.portfolio.find((p) => p.asset === "usd");
          if (usd) usd.quantity += +args[0];
        } else if (s.includes("asset = 'usd'") && s.includes("quantity - ?")) {
          const usd = self.portfolio.find((p) => p.asset === "usd");
          if (usd) usd.quantity -= +args[0];
        } else if (s.includes("quantity + ? where asset = ?")) {
          const item = self.portfolio.find((p) => p.asset === args[1]);
          if (item) item.quantity += +args[0];
        } else if (s.includes("quantity - ? where asset = ?")) {
          const item = self.portfolio.find((p) => p.asset === args[1]);
          if (item) item.quantity -= +args[0];
        }
        return { changes: 1, lastInsertRowid: 0 };
      }
    };
  }
  exec(sql) {
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      const lower = stmt.toLowerCase();
      if (lower.startsWith("delete from trades")) {
        this.trades = [];
      } else {
        const m = lower.match(/update portfolio set quantity = ([\d.]+) where asset = '(\w+)'/);
        if (m) {
          const item = this.portfolio.find((p) => p.asset === m[2]);
          if (item) item.quantity = parseFloat(m[1]);
        }
      }
    }
  }
};
var db;
if (process.env.VERCEL) {
  db = new InMemoryDatabase();
} else {
  try {
    const _require = createRequire(import.meta.url);
    const Database = _require("better-sqlite3");
    const dbPath = process.env.NODE_ENV === "production" ? ":memory:" : path.join(__dirname, "../trading.db");
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
    console.warn("better-sqlite3 unavailable, falling back to in-memory store");
    db = new InMemoryDatabase();
  }
}
var database_default = db;

// backend/quantEngine.ts
function predictPrice(prices, periodsAhead = 1) {
  const n = prices.length;
  if (n < 2) return prices[prices.length - 1];
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumXX += i * i;
  }
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  return m * (n + periodsAhead - 1) + b;
}
function calculateVolatility(prices) {
  const n = prices.length;
  if (n === 0) return 0;
  const mean = prices.reduce((a, b) => a + b) / n;
  const deviation = prices.map((p) => Math.pow(p - mean, 2));
  const variance = deviation.reduce((a, b) => a + b) / n;
  return Math.sqrt(variance);
}
function detectTrend(prices) {
  const shortWindow = prices.slice(-5);
  const longWindow = prices.slice(-14);
  const shortAvg = shortWindow.reduce((a, b) => a + b) / shortWindow.length;
  const longAvg = longWindow.reduce((a, b) => a + b) / longWindow.length;
  const slope = (prices[prices.length - 1] - prices[prices.length - 5]) / 5;
  return {
    direction: shortAvg > longAvg ? "BULLISH" : "BEARISH",
    strength: Math.abs(shortAvg - longAvg) / longAvg,
    momentum: slope > 0 ? "ACCELERATING" : "DECELERATING"
  };
}
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[prices.length - i] - prices[prices.length - i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  return {
    line: macdLine,
    signal: macdLine * 0.9,
    // simplified signal
    histogram: macdLine - macdLine * 0.9
  };
}
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// backend/index.ts
var priceHistory = {
  bitcoin: [62e3, 62500, 61800, 63e3, 64200, 64100, 65e3, 64800, 65500, 63100, 62800, 62200, 63500, 64e3, 64500, 63800, 64200, 65100, 64900, 65800],
  ethereum: [2400, 2450, 2420, 2480, 2510, 2490, 2550, 2530, 2580, 2600, 2580, 2550, 2480, 2450, 2420, 2400, 2380, 2410, 2450, 2480],
  solana: [140, 142, 138, 145, 148, 147, 152, 150, 155, 153, 158, 160, 157, 154, 151, 148, 145, 143, 146, 149],
  spy: [510, 512, 511, 514, 516, 515, 518, 520, 522, 521, 519, 518, 520, 523, 525, 524, 526, 528, 530, 532],
  qqq: [430, 435, 432, 438, 442, 440, 445, 448, 452, 450, 448, 445, 440, 442, 445, 448, 452, 455, 458, 461],
  apple: [170, 172, 171, 175, 178, 176, 180, 182, 185, 183, 181, 179, 182, 185, 188, 190, 192, 195, 198, 201],
  tesla: [160, 165, 162, 170, 175, 172, 180, 178, 185, 182, 178, 175, 170, 172, 175, 178, 182, 185, 188, 192]
};
function getHistory(asset) {
  return priceHistory[asset.toLowerCase()] || priceHistory.bitcoin;
}
function startBackend(app2, io) {
  let cryptoPrices = {};
  let binanceTickers = [];
  let forexRates = {};
  let stockPrices = {
    spy: { usd: 520, change: 0 },
    qqq: { usd: 440, change: 0 },
    apple: { usd: 190, change: 0 },
    tesla: { usd: 170, change: 0 }
  };
  try {
    const swaggerOptions = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Elite Trade Hub API",
          version: "1.0.0",
          description: "Professional Trading Platform API"
        },
        servers: [{ url: "/api" }]
      },
      apis: ["./backend/index.ts"]
    };
    const swaggerDocs = swaggerJsdoc(swaggerOptions);
    app2.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  } catch {
  }
  function calculateAnalysis(asset) {
    const prices = getHistory(asset);
    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const volatility = calculateVolatility(prices);
    const predictedPrice = predictPrice(prices, 3);
    const trendLogic = detectTrend(prices);
    return {
      rsi,
      macd,
      trend: trendLogic.direction,
      trendStrength: (trendLogic.strength * 100).toFixed(2) + "%",
      momentum: trendLogic.momentum,
      volatility: (volatility / prices[prices.length - 1] * 100).toFixed(2) + "%",
      prediction: predictedPrice.toFixed(2)
    };
  }
  function getCurrentState() {
    const assets = ["bitcoin", "ethereum", "solana", "spy", "qqq", "apple", "tesla"];
    const analysisMap = {};
    assets.forEach((a) => analysisMap[a] = calculateAnalysis(a));
    return {
      crypto: cryptoPrices,
      binance: binanceTickers,
      forex: forexRates,
      stocks: stockPrices,
      recentTrades: database_default.prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10").all(),
      analysis: analysisMap
    };
  }
  function broadcastState() {
    const state = getCurrentState();
    io.emit("market-data", state);
  }
  async function fetchStocks() {
    const symbols = ["SPY", "QQQ", "AAPL", "TSLA"];
    const keyMap = { SPY: "spy", QQQ: "qqq", AAPL: "apple", TSLA: "tesla" };
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
            params: { interval: "1d", range: "1d" },
            timeout: 4e3
          });
          const meta = res.data.chart.result[0].meta;
          const currentPrice = meta.regularMarketPrice;
          const change = (currentPrice - meta.previousClose) / meta.previousClose * 100;
          const key = keyMap[symbol];
          stockPrices[key] = { usd: currentPrice, change };
          if (priceHistory[key]) priceHistory[key][priceHistory[key].length - 1] = currentPrice;
        } catch {
        }
      })
    );
    broadcastState();
  }
  async function fetchBinance() {
    try {
      const res = await axios.get("https://api.binance.com/api/v3/ticker/24hr", {
        params: { symbols: '["BTCUSDT","ETHUSDT","SOLUSDT"]' },
        timeout: 4e3
      });
      binanceTickers = res.data;
      broadcastState();
    } catch (e) {
      console.warn("Binance Fetch Error");
    }
  }
  async function fetchCoinGecko() {
    try {
      const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
        params: {
          ids: "bitcoin,ethereum,solana,cardano,polkadot,dogecoin,ripple,binancecoin,chainlink,uniswap",
          vs_currencies: "usd",
          include_24hr_change: "true",
          include_market_cap: "true"
        },
        timeout: 1e4
      });
      cryptoPrices = res.data;
      broadcastState();
    } catch (e) {
      if (e.response?.status === 429) {
        console.log("\u{1F6E1}\uFE0F CoinGecko: Rate limit hit. Keeping existing cache to prevent data drops.");
      } else {
        console.warn("\u{1F4E1} CoinGecko: Provider sync error.");
      }
    }
  }
  async function fetchForex() {
    try {
      const res = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 1e4 });
      forexRates = res.data.rates;
      broadcastState();
    } catch (e) {
      console.warn("\u{1F4B9} Forex: Sync error.");
    }
  }
  setInterval(fetchStocks, 65e3);
  setInterval(fetchBinance, 5e3);
  setInterval(fetchCoinGecko, 9e4);
  setInterval(fetchForex, 6e5);
  fetchStocks();
  fetchBinance();
  fetchCoinGecko();
  fetchForex();
  app2.get("/api/market/pulse", async (_req, res) => {
    if (binanceTickers.length === 0) {
      await Promise.race([
        fetchBinance(),
        new Promise((resolve) => setTimeout(resolve, 3e3))
      ]);
    }
    res.json(getCurrentState());
  });
  app2.get("/api/market", (req, res) => {
    res.json({ crypto: cryptoPrices, binance: binanceTickers, forex: forexRates });
  });
  app2.get("/api/trades", (req, res) => {
    const stmt = database_default.prepare("SELECT * FROM trades ORDER BY timestamp DESC");
    res.json(stmt.all());
  });
  app2.post("/api/trade", (req, res) => {
    const { asset, type, price, amount } = req.body;
    const id = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    const totalCost = price * amount;
    const portfolio = database_default.prepare("SELECT * FROM portfolio").all();
    const usdItem = portfolio.find((p) => p.asset === "usd");
    const assetItem = portfolio.find((p) => p.asset === asset);
    const usdBalance = usdItem ? usdItem.quantity : 0;
    const assetBalance = assetItem ? assetItem.quantity : 0;
    if (type === "BUY" && totalCost > usdBalance) {
      return res.status(400).json({ error: "Insufficient USD balance for this trade." });
    }
    if (type === "SELL" && amount > assetBalance) {
      return res.status(400).json({ error: `Insufficient ${asset} quantity for this trade.` });
    }
    const insert = database_default.prepare("INSERT INTO trades (id, asset, type, price, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run(id, asset, type, price, amount, timestamp);
    const portfolioUpdate = type === "BUY" ? database_default.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = ?") : database_default.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = ?");
    portfolioUpdate.run(amount, asset);
    const usdUpdate = type === "BUY" ? database_default.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = 'usd'") : database_default.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = 'usd'");
    usdUpdate.run(totalCost);
    broadcastState();
    res.status(201).json({ id, asset, type, price, amount, timestamp });
  });
  app2.post("/api/portfolio/reset", (req, res) => {
    database_default.exec(`
      DELETE FROM trades;
      UPDATE portfolio SET quantity = 1.25 WHERE asset = 'bitcoin';
      UPDATE portfolio SET quantity = 15.4 WHERE asset = 'ethereum';
      UPDATE portfolio SET quantity = 240.5 WHERE asset = 'solana';
      UPDATE portfolio SET quantity = 142509.42 WHERE asset = 'usd';
    `);
    broadcastState();
    res.json({ message: "Portfolio reset" });
  });
  app2.get("/api/portfolio", (req, res) => {
    const portfolio = database_default.prepare("SELECT * FROM portfolio").all();
    res.json(portfolio);
  });
  app2.get("/api/quant/snapshot", (req, res) => {
    const results = {};
    ["bitcoin", "ethereum", "solana"].forEach((asset) => {
      const prices = getHistory(asset);
      results[asset] = {
        series: prices,
        mean: prices.reduce((a, b) => a + b) / prices.length,
        predictive_slope: predictPrice(prices, 1) - prices[prices.length - 1],
        volatility_matrix: calculateVolatility(prices)
      };
    });
    res.json(results);
  });
  io.on("connection", (socket) => {
    broadcastState();
  });
}

// api/index.ts
dotenv.config();
var app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1e3, max: 1e3 }));
var mockIo = {
  emit: (_event, _data) => {
  },
  on: (_event, _cb) => {
  }
};
startBackend(app, mockIo);
var index_default = app;
export {
  index_default as default
};
