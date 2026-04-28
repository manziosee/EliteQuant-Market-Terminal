// api/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// backend/index.ts
import axios from "axios";
import OpenAI from "openai";
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
      { asset: "cardano", quantity: 5e3, avg_price: 0.45 },
      { asset: "polkadot", quantity: 100, avg_price: 7.5 },
      { asset: "dogecoin", quantity: 1e4, avg_price: 0.12 },
      { asset: "ripple", quantity: 3e3, avg_price: 0.52 },
      { asset: "chainlink", quantity: 200, avg_price: 14.5 },
      { asset: "uniswap", quantity: 150, avg_price: 10 },
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
          const [id, asset, type, price, amount, timestamp, pnl] = args;
          self.trades.push({ id, asset, type, price: +price, amount: +amount, timestamp: +timestamp, pnl: +(pnl ?? 0) });
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
  cardano: [0.45, 0.46, 0.44, 0.47, 0.48, 0.47, 0.5, 0.49, 0.51, 0.5, 0.52, 0.53, 0.51, 0.49, 0.47, 0.46, 0.44, 0.45, 0.47, 0.48],
  polkadot: [7.2, 7.4, 7.1, 7.6, 7.8, 7.7, 8, 7.9, 8.2, 8.1, 8.4, 8.5, 8.3, 8.1, 7.9, 7.7, 7.5, 7.6, 7.8, 8],
  dogecoin: [0.12, 0.123, 0.119, 0.126, 0.129, 0.127, 0.133, 0.131, 0.137, 0.135, 0.14, 0.142, 0.139, 0.136, 0.133, 0.13, 0.127, 0.129, 0.132, 0.135],
  ripple: [0.52, 0.53, 0.51, 0.55, 0.57, 0.56, 0.59, 0.58, 0.61, 0.6, 0.63, 0.64, 0.62, 0.6, 0.58, 0.56, 0.54, 0.55, 0.57, 0.59],
  chainlink: [14.2, 14.6, 14, 15, 15.4, 15.2, 15.8, 15.6, 16.2, 16, 16.6, 16.8, 16.4, 16, 15.6, 15.2, 14.8, 15, 15.4, 15.8],
  uniswap: [9.8, 10.1, 9.7, 10.4, 10.7, 10.5, 11, 10.8, 11.3, 11.1, 11.6, 11.8, 11.4, 11, 10.6, 10.2, 9.8, 10, 10.4, 10.8],
  spy: [510, 512, 511, 514, 516, 515, 518, 520, 522, 521, 519, 518, 520, 523, 525, 524, 526, 528, 530, 532],
  qqq: [430, 435, 432, 438, 442, 440, 445, 448, 452, 450, 448, 445, 440, 442, 445, 448, 452, 455, 458, 461],
  apple: [170, 172, 171, 175, 178, 176, 180, 182, 185, 183, 181, 179, 182, 185, 188, 190, 192, 195, 198, 201],
  tesla: [160, 165, 162, 170, 175, 172, 180, 178, 185, 182, 178, 175, 170, 172, 175, 178, 182, 185, 188, 192]
};
function getHistory(asset) {
  return priceHistory[asset.toLowerCase()] || priceHistory.bitcoin;
}
var aiCache = {};
var backoff = {
  coinGecko: { delay: 9e4, baseDelay: 9e4, failures: 0 },
  stocks: { delay: 65e3, baseDelay: 65e3, failures: 0 },
  binance: { delay: 5e3, baseDelay: 5e3, failures: 0 },
  forex: { delay: 6e5, baseDelay: 6e5, failures: 0 }
};
function scheduleWithBackoff(fn, key) {
  const run = async () => {
    try {
      await fn();
      if (backoff[key].failures > 0) {
        backoff[key].failures = 0;
        backoff[key].delay = backoff[key].baseDelay;
      }
    } catch {
      backoff[key].failures++;
      backoff[key].delay = Math.min(backoff[key].delay * 2, 6e5);
    }
    setTimeout(run, backoff[key].delay);
  };
  setTimeout(run, backoff[key].delay);
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
    const swaggerDocs = swaggerJsdoc({
      definition: { openapi: "3.0.0", info: { title: "EliteQuant API", version: "1.0.0" }, servers: [{ url: "/api" }] },
      apis: ["./backend/index.ts"]
    });
    app2.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  } catch {
  }
  function calculateAnalysis(asset) {
    const prices = getHistory(asset);
    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const vol = calculateVolatility(prices);
    const predicted = predictPrice(prices, 3);
    const trend = detectTrend(prices);
    return {
      rsi,
      macd,
      trend: trend.direction,
      trendStrength: (trend.strength * 100).toFixed(2) + "%",
      momentum: trend.momentum,
      volatility: (vol / prices[prices.length - 1] * 100).toFixed(2) + "%",
      prediction: predicted.toFixed(2)
    };
  }
  const ALL_ASSETS = ["bitcoin", "ethereum", "solana", "cardano", "polkadot", "dogecoin", "ripple", "chainlink", "uniswap", "spy", "qqq", "apple", "tesla"];
  function getCurrentState() {
    const analysisMap = {};
    ALL_ASSETS.forEach((a) => {
      analysisMap[a] = calculateAnalysis(a);
    });
    return {
      crypto: cryptoPrices,
      binance: binanceTickers,
      forex: forexRates,
      stocks: stockPrices,
      recentTrades: database_default.prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 20").all(),
      analysis: analysisMap
    };
  }
  function broadcastState() {
    io.emit("market-data", getCurrentState());
  }
  async function fetchStocks() {
    const symbols = ["SPY", "QQQ", "AAPL", "TSLA"];
    const keyMap = { SPY: "spy", QQQ: "qqq", AAPL: "apple", TSLA: "tesla" };
    await Promise.allSettled(symbols.map(async (sym) => {
      try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`, {
          params: { interval: "1d", range: "1d" },
          timeout: 4e3
        });
        const meta = res.data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        const change = (price - meta.previousClose) / meta.previousClose * 100;
        const key = keyMap[sym];
        stockPrices[key] = { usd: price, change };
        if (priceHistory[key]) priceHistory[key][priceHistory[key].length - 1] = price;
      } catch {
      }
    }));
    broadcastState();
  }
  async function fetchBinance() {
    const res = await axios.get("https://api.binance.com/api/v3/ticker/24hr", {
      params: { symbols: '["BTCUSDT","ETHUSDT","SOLUSDT","ADAUSDT","DOTUSDT","DOGEUSDT","XRPUSDT","LINKUSDT","UNIUSDT"]' },
      timeout: 4e3
    });
    binanceTickers = res.data;
    broadcastState();
  }
  async function fetchCoinGecko() {
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
    const map = { ripple: "ripple", cardano: "cardano", polkadot: "polkadot", dogecoin: "dogecoin", chainlink: "chainlink", uniswap: "uniswap" };
    for (const [gecko, hist] of Object.entries(map)) {
      const p = cryptoPrices[gecko]?.usd;
      if (p && priceHistory[hist]) priceHistory[hist][priceHistory[hist].length - 1] = p;
    }
    broadcastState();
  }
  async function fetchForex() {
    const res = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 1e4 });
    forexRates = res.data.rates;
    broadcastState();
  }
  scheduleWithBackoff(fetchStocks, "stocks");
  scheduleWithBackoff(fetchBinance, "binance");
  scheduleWithBackoff(fetchCoinGecko, "coinGecko");
  scheduleWithBackoff(fetchForex, "forex");
  fetchBinance().catch(() => {
  });
  fetchCoinGecko().catch(() => {
  });
  fetchStocks().catch(() => {
  });
  fetchForex().catch(() => {
  });
  app2.get("/api/market/pulse", async (_req, res) => {
    if (binanceTickers.length === 0) {
      await Promise.race([fetchBinance().catch(() => {
      }), new Promise((r) => setTimeout(r, 3e3))]);
    }
    res.json(getCurrentState());
  });
  app2.get("/api/market", (_req, res) => {
    res.json({ crypto: cryptoPrices, binance: binanceTickers, forex: forexRates });
  });
  app2.get("/api/trades", (_req, res) => {
    res.json(database_default.prepare("SELECT * FROM trades ORDER BY timestamp DESC").all());
  });
  app2.post("/api/trade", (req, res) => {
    const { asset, type, price, amount } = req.body;
    if (!asset || !type || !price || !amount) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const id = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    const totalCost = price * amount;
    const portfolio = database_default.prepare("SELECT * FROM portfolio").all();
    const usdItem = portfolio.find((p) => p.asset === "usd");
    const assetItem = portfolio.find((p) => p.asset === asset);
    if (type === "BUY" && totalCost > (usdItem?.quantity ?? 0)) {
      return res.status(400).json({ error: "Insufficient USD balance." });
    }
    if (type === "SELL" && amount > (assetItem?.quantity ?? 0)) {
      return res.status(400).json({ error: `Insufficient ${asset} balance.` });
    }
    let pnl = 0;
    if (type === "SELL" && assetItem) {
      const buys = database_default.prepare("SELECT * FROM trades ORDER BY timestamp DESC").all().filter((t) => t.asset === asset && t.type === "BUY");
      const avgBuy = buys.length > 0 ? buys.reduce((s, t) => s + t.price, 0) / buys.length : assetItem.avg_price ?? 0;
      pnl = (price - avgBuy) * amount;
    }
    database_default.prepare("INSERT INTO trades (id, asset, type, price, amount, timestamp, pnl) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, asset, type, price, amount, timestamp, pnl);
    const qtyStmt = type === "BUY" ? database_default.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = ?") : database_default.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = ?");
    qtyStmt.run(amount, asset);
    const usdStmt = type === "BUY" ? database_default.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = 'usd'") : database_default.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = 'usd'");
    usdStmt.run(totalCost);
    broadcastState();
    res.status(201).json({ id, asset, type, price, amount, timestamp, pnl });
  });
  app2.post("/api/portfolio/reset", (_req, res) => {
    database_default.exec(`
      DELETE FROM trades;
      UPDATE portfolio SET quantity = 1.25      WHERE asset = 'bitcoin';
      UPDATE portfolio SET quantity = 15.4      WHERE asset = 'ethereum';
      UPDATE portfolio SET quantity = 240.5     WHERE asset = 'solana';
      UPDATE portfolio SET quantity = 5000      WHERE asset = 'cardano';
      UPDATE portfolio SET quantity = 100       WHERE asset = 'polkadot';
      UPDATE portfolio SET quantity = 10000     WHERE asset = 'dogecoin';
      UPDATE portfolio SET quantity = 3000      WHERE asset = 'ripple';
      UPDATE portfolio SET quantity = 200       WHERE asset = 'chainlink';
      UPDATE portfolio SET quantity = 150       WHERE asset = 'uniswap';
      UPDATE portfolio SET quantity = 142509.42 WHERE asset = 'usd';
    `);
    broadcastState();
    res.json({ message: "Portfolio reset" });
  });
  app2.get("/api/portfolio", (_req, res) => {
    res.json(database_default.prepare("SELECT * FROM portfolio").all());
  });
  app2.post("/api/ai/analyze", async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "AI not configured \u2014 add OPENAI_API_KEY to environment variables." });
    const { asset, stats } = req.body;
    if (!asset || !stats) return res.status(400).json({ error: "Missing asset or stats." });
    const cacheKey = asset.toLowerCase();
    const cached = aiCache[cacheKey];
    if (cached && Date.now() - cached.ts < 6e5) return res.json(cached.data);
    const nameMap = {
      bitcoin: "Bitcoin",
      ethereum: "Ethereum",
      solana: "Solana",
      cardano: "Cardano",
      polkadot: "Polkadot",
      dogecoin: "Dogecoin",
      ripple: "XRP/Ripple",
      chainlink: "Chainlink",
      uniswap: "Uniswap",
      spy: "S&P 500 (SPY)",
      qqq: "NASDAQ 100 (QQQ)",
      apple: "Apple (AAPL)",
      tesla: "Tesla (TSLA)"
    };
    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 250,
        messages: [{
          role: "user",
          content: `You are a quantitative trading analyst. Analyze ${nameMap[cacheKey] || asset}.
Quant data: RSI=${stats.rsi}, Trend=${stats.trend}, Strength=${stats.trendStrength}, Volatility=${stats.volatility}, MACD=${JSON.stringify(stats.macd)}, ML prediction=$${stats.prediction}.
Return JSON with exactly these keys:
"sentiment": one of [Ultra Bullish, Bullish, Neutral, Bearish, Ultra Bearish],
"risk_score": integer 0-100,
"prediction": next 4h outlook in 5 words or fewer,
"alpha_insight": one actionable sentence for a trader.`
        }]
      });
      const data = JSON.parse(completion.choices[0].message.content || "{}");
      aiCache[cacheKey] = { ts: Date.now(), data };
      res.json(data);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "AI analysis failed" });
    }
  });
  app2.get("/api/quant/snapshot", (_req, res) => {
    const results = {};
    ["bitcoin", "ethereum", "solana"].forEach((a) => {
      const prices = getHistory(a);
      results[a] = {
        series: prices,
        mean: prices.reduce((s, v) => s + v, 0) / prices.length,
        predictive_slope: predictPrice(prices, 1) - prices[prices.length - 1],
        volatility_matrix: calculateVolatility(prices)
      };
    });
    res.json(results);
  });
  io.on("connection", () => {
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
