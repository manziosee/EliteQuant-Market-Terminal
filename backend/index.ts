import { Express } from 'express';
import { Server } from 'socket.io';
import axios from 'axios';
import OpenAI from 'openai';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import db from './database.ts';
import * as quant from './quantEngine.ts';

// Price history seeds — updated by live fetches
const priceHistory: Record<string, number[]> = {
  bitcoin:  [62000,62500,61800,63000,64200,64100,65000,64800,65500,63100,62800,62200,63500,64000,64500,63800,64200,65100,64900,65800],
  ethereum: [2400,2450,2420,2480,2510,2490,2550,2530,2580,2600,2580,2550,2480,2450,2420,2400,2380,2410,2450,2480],
  solana:   [140,142,138,145,148,147,152,150,155,153,158,160,157,154,151,148,145,143,146,149],
  cardano:  [0.45,0.46,0.44,0.47,0.48,0.47,0.50,0.49,0.51,0.50,0.52,0.53,0.51,0.49,0.47,0.46,0.44,0.45,0.47,0.48],
  polkadot: [7.2,7.4,7.1,7.6,7.8,7.7,8.0,7.9,8.2,8.1,8.4,8.5,8.3,8.1,7.9,7.7,7.5,7.6,7.8,8.0],
  dogecoin: [0.12,0.123,0.119,0.126,0.129,0.127,0.133,0.131,0.137,0.135,0.140,0.142,0.139,0.136,0.133,0.130,0.127,0.129,0.132,0.135],
  ripple:   [0.52,0.53,0.51,0.55,0.57,0.56,0.59,0.58,0.61,0.60,0.63,0.64,0.62,0.60,0.58,0.56,0.54,0.55,0.57,0.59],
  chainlink:[14.2,14.6,14.0,15.0,15.4,15.2,15.8,15.6,16.2,16.0,16.6,16.8,16.4,16.0,15.6,15.2,14.8,15.0,15.4,15.8],
  uniswap:  [9.8,10.1,9.7,10.4,10.7,10.5,11.0,10.8,11.3,11.1,11.6,11.8,11.4,11.0,10.6,10.2,9.8,10.0,10.4,10.8],
  spy:   [510,512,511,514,516,515,518,520,522,521,519,518,520,523,525,524,526,528,530,532],
  qqq:   [430,435,432,438,442,440,445,448,452,450,448,445,440,442,445,448,452,455,458,461],
  apple: [170,172,171,175,178,176,180,182,185,183,181,179,182,185,188,190,192,195,198,201],
  tesla: [160,165,162,170,175,172,180,178,185,182,178,175,170,172,175,178,182,185,188,192],
};

function getHistory(asset: string) {
  return priceHistory[asset.toLowerCase()] || priceHistory.bitcoin;
}

// AI result cache — keyed by asset, 10-minute TTL
const aiCache: Record<string, { ts: number; data: any }> = {};

// Backoff state per data source
const backoff: Record<string, { delay: number; baseDelay: number; failures: number }> = {
  coinGecko: { delay: 90000,  baseDelay: 90000,  failures: 0 },
  stocks:    { delay: 65000,  baseDelay: 65000,  failures: 0 },
  binance:   { delay: 5000,   baseDelay: 5000,   failures: 0 },
  forex:     { delay: 600000, baseDelay: 600000, failures: 0 },
};

function scheduleWithBackoff(fn: () => Promise<void>, key: string) {
  const run = async () => {
    try {
      await fn();
      if (backoff[key].failures > 0) {
        backoff[key].failures = 0;
        backoff[key].delay = backoff[key].baseDelay;
      }
    } catch {
      backoff[key].failures++;
      // Exponential backoff: double each failure, cap at 10 minutes
      backoff[key].delay = Math.min(backoff[key].delay * 2, 600000);
    }
    setTimeout(run, backoff[key].delay);
  };
  setTimeout(run, backoff[key].delay);
}

export function startBackend(app: Express, io: Server) {
  let cryptoPrices: Record<string, any> = {};
  let binanceTickers: any[] = [];
  let forexRates: Record<string, any> = {};
  let stockPrices: Record<string, any> = {
    spy:   { usd: 520, change: 0 },
    qqq:   { usd: 440, change: 0 },
    apple: { usd: 190, change: 0 },
    tesla: { usd: 170, change: 0 },
  };

  // --- Swagger ---
  try {
    const swaggerDocs = swaggerJsdoc({
      definition: { openapi: '3.0.0', info: { title: 'EliteQuant API', version: '1.0.0' }, servers: [{ url: '/api' }] },
      apis: ['./backend/index.ts'],
    });
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  } catch { /* non-critical */ }

  // --- Quant Analysis ---
  function calculateAnalysis(asset: string) {
    const prices = getHistory(asset);
    const rsi      = quant.calculateRSI(prices);
    const macd     = quant.calculateMACD(prices);
    const vol      = quant.calculateVolatility(prices);
    const predicted = quant.predictPrice(prices, 3);
    const trend    = quant.detectTrend(prices);
    return {
      rsi,
      macd,
      trend: trend.direction,
      trendStrength: (trend.strength * 100).toFixed(2) + '%',
      momentum: trend.momentum,
      volatility: (vol / prices[prices.length - 1] * 100).toFixed(2) + '%',
      prediction: predicted.toFixed(2),
    };
  }

  const ALL_ASSETS = ['bitcoin','ethereum','solana','cardano','polkadot','dogecoin','ripple','chainlink','uniswap','spy','qqq','apple','tesla'];

  function getCurrentState() {
    const analysisMap: Record<string, any> = {};
    ALL_ASSETS.forEach(a => { analysisMap[a] = calculateAnalysis(a); });
    return {
      crypto: cryptoPrices,
      binance: binanceTickers,
      forex: forexRates,
      stocks: stockPrices,
      recentTrades: db.prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 20').all(),
      analysis: analysisMap,
    };
  }

  function broadcastState() { io.emit('market-data', getCurrentState()); }

  // --- Data Fetchers ---
  async function fetchStocks() {
    const symbols = ['SPY','QQQ','AAPL','TSLA'];
    const keyMap: Record<string, string> = { SPY:'spy', QQQ:'qqq', AAPL:'apple', TSLA:'tesla' };
    await Promise.allSettled(symbols.map(async (sym) => {
      try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`, {
          params: { interval: '1d', range: '1d' }, timeout: 4000,
        });
        const meta = res.data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        const change = ((price - meta.previousClose) / meta.previousClose) * 100;
        const key = keyMap[sym];
        stockPrices[key] = { usd: price, change };
        if (priceHistory[key]) priceHistory[key][priceHistory[key].length - 1] = price;
      } catch { /* keep cached */ }
    }));
    broadcastState();
  }

  async function fetchBinance() {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
      params: { symbols: '["BTCUSDT","ETHUSDT","SOLUSDT","ADAUSDT","DOTUSDT","DOGEUSDT","XRPUSDT","LINKUSDT","UNIUSDT"]' },
      timeout: 4000,
    });
    binanceTickers = res.data;
    broadcastState();
  }

  async function fetchCoinGecko() {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'bitcoin,ethereum,solana,cardano,polkadot,dogecoin,ripple,binancecoin,chainlink,uniswap',
        vs_currencies: 'usd',
        include_24hr_change: 'true',
        include_market_cap: 'true',
      },
      timeout: 10000,
    });
    cryptoPrices = res.data;
    // Update price history seeds with live last price
    const map: Record<string, string> = { ripple: 'ripple', cardano: 'cardano', polkadot: 'polkadot', dogecoin: 'dogecoin', chainlink: 'chainlink', uniswap: 'uniswap' };
    for (const [gecko, hist] of Object.entries(map)) {
      const p = cryptoPrices[gecko]?.usd;
      if (p && priceHistory[hist]) priceHistory[hist][priceHistory[hist].length - 1] = p;
    }
    broadcastState();
  }

  async function fetchForex() {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 });
    forexRates = res.data.rates;
    broadcastState();
  }

  // Smart backoff scheduling — replaces static setInterval
  scheduleWithBackoff(fetchStocks,    'stocks');
  scheduleWithBackoff(fetchBinance,   'binance');
  scheduleWithBackoff(fetchCoinGecko, 'coinGecko');
  scheduleWithBackoff(fetchForex,     'forex');

  // Immediate warm-up
  fetchBinance().catch(() => {});
  fetchCoinGecko().catch(() => {});
  fetchStocks().catch(() => {});
  fetchForex().catch(() => {});

  // --- API Endpoints ---

  app.get('/api/market/pulse', async (_req, res) => {
    if (binanceTickers.length === 0) {
      await Promise.race([fetchBinance().catch(() => {}), new Promise<void>(r => setTimeout(r, 3000))]);
    }
    res.json(getCurrentState());
  });

  app.get('/api/market', (_req, res) => {
    res.json({ crypto: cryptoPrices, binance: binanceTickers, forex: forexRates });
  });

  app.get('/api/trades', (_req, res) => {
    res.json(db.prepare('SELECT * FROM trades ORDER BY timestamp DESC').all());
  });

  app.post('/api/trade', (req, res) => {
    const { asset, type, price, amount } = req.body;
    if (!asset || !type || !price || !amount) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const id = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    const totalCost = price * amount;

    const portfolio = db.prepare('SELECT * FROM portfolio').all() as any[];
    const usdItem   = portfolio.find(p => p.asset === 'usd');
    const assetItem = portfolio.find(p => p.asset === asset);

    if (type === 'BUY' && totalCost > (usdItem?.quantity ?? 0)) {
      return res.status(400).json({ error: 'Insufficient USD balance.' });
    }
    if (type === 'SELL' && amount > (assetItem?.quantity ?? 0)) {
      return res.status(400).json({ error: `Insufficient ${asset} balance.` });
    }

    // Compute realized P&L for SELL trades
    let pnl = 0;
    if (type === 'SELL' && assetItem) {
      const buys = (db.prepare('SELECT * FROM trades ORDER BY timestamp DESC').all() as any[])
        .filter((t: any) => t.asset === asset && t.type === 'BUY');
      const avgBuy = buys.length > 0
        ? buys.reduce((s: number, t: any) => s + t.price, 0) / buys.length
        : assetItem.avg_price ?? 0;
      pnl = (price - avgBuy) * amount;
    }

    db.prepare('INSERT INTO trades (id, asset, type, price, amount, timestamp, pnl) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, asset, type, price, amount, timestamp, pnl);

    const qtyStmt = type === 'BUY'
      ? db.prepare('UPDATE portfolio SET quantity = quantity + ? WHERE asset = ?')
      : db.prepare('UPDATE portfolio SET quantity = quantity - ? WHERE asset = ?');
    qtyStmt.run(amount, asset);

    const usdStmt = type === 'BUY'
      ? db.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = 'usd'")
      : db.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = 'usd'");
    usdStmt.run(totalCost);

    broadcastState();
    res.status(201).json({ id, asset, type, price, amount, timestamp, pnl });
  });

  app.post('/api/portfolio/reset', (_req, res) => {
    db.exec(`
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
    res.json({ message: 'Portfolio reset' });
  });

  app.get('/api/portfolio', (_req, res) => {
    res.json(db.prepare('SELECT * FROM portfolio').all());
  });

  // AI Analysis — OpenAI backend endpoint with 10-minute per-asset cache
  app.post('/api/ai/analyze', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI not configured — add OPENAI_API_KEY to environment variables.' });

    const { asset, stats } = req.body;
    if (!asset || !stats) return res.status(400).json({ error: 'Missing asset or stats.' });

    const cacheKey = asset.toLowerCase();
    const cached = aiCache[cacheKey];
    if (cached && Date.now() - cached.ts < 600000) return res.json(cached.data);

    const nameMap: Record<string, string> = {
      bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana',
      cardano: 'Cardano', polkadot: 'Polkadot', dogecoin: 'Dogecoin',
      ripple: 'XRP/Ripple', chainlink: 'Chainlink', uniswap: 'Uniswap',
      spy: 'S&P 500 (SPY)', qqq: 'NASDAQ 100 (QQQ)', apple: 'Apple (AAPL)', tesla: 'Tesla (TSLA)',
    };

    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: `You are a quantitative trading analyst. Analyze ${nameMap[cacheKey] || asset}.
Quant data: RSI=${stats.rsi}, Trend=${stats.trend}, Strength=${stats.trendStrength}, Volatility=${stats.volatility}, MACD=${JSON.stringify(stats.macd)}, ML prediction=$${stats.prediction}.
Return JSON with exactly these keys:
"sentiment": one of [Ultra Bullish, Bullish, Neutral, Bearish, Ultra Bearish],
"risk_score": integer 0-100,
"prediction": next 4h outlook in 5 words or fewer,
"alpha_insight": one actionable sentence for a trader.`,
        }],
      });
      const data = JSON.parse(completion.choices[0].message.content || '{}');
      aiCache[cacheKey] = { ts: Date.now(), data };
      res.json(data);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'AI analysis failed' });
    }
  });

  app.get('/api/quant/snapshot', (_req, res) => {
    const results: Record<string, any> = {};
    ['bitcoin','ethereum','solana'].forEach(a => {
      const prices = getHistory(a);
      results[a] = {
        series: prices,
        mean: prices.reduce((s, v) => s + v, 0) / prices.length,
        predictive_slope: quant.predictPrice(prices, 1) - prices[prices.length - 1],
        volatility_matrix: quant.calculateVolatility(prices),
      };
    });
    res.json(results);
  });

  io.on('connection', () => { broadcastState(); });
}
