import { Express } from 'express';
import { Server } from 'socket.io';
import axios from 'axios';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import db from './database.ts';
import * as quant from './quantEngine.ts';
const priceHistory: Record<string, number[]> = {
  bitcoin: [62000, 62500, 61800, 63000, 64200, 64100, 65000, 64800, 65500, 63100, 62800, 62200, 63500, 64000, 64500, 63800, 64200, 65100, 64900, 65800],
  ethereum: [2400, 2450, 2420, 2480, 2510, 2490, 2550, 2530, 2580, 2600, 2580, 2550, 2480, 2450, 2420, 2400, 2380, 2410, 2450, 2480],
  solana: [140, 142, 138, 145, 148, 147, 152, 150, 155, 153, 158, 160, 157, 154, 151, 148, 145, 143, 146, 149],
  spy: [510, 512, 511, 514, 516, 515, 518, 520, 522, 521, 519, 518, 520, 523, 525, 524, 526, 528, 530, 532],
  qqq: [430, 435, 432, 438, 442, 440, 445, 448, 452, 450, 448, 445, 440, 442, 445, 448, 452, 455, 458, 461],
  apple: [170, 172, 171, 175, 178, 176, 180, 182, 185, 183, 181, 179, 182, 185, 188, 190, 192, 195, 198, 201],
  tesla: [160, 165, 162, 170, 175, 172, 180, 178, 185, 182, 178, 175, 170, 172, 175, 178, 182, 185, 188, 192]
};

function getHistory(asset: string) {
  return priceHistory[asset.toLowerCase()] || priceHistory.bitcoin;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Trade:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         asset:
 *           type: string
 *         type:
 *           type: string
 *           enum: [BUY, SELL]
 *         price:
 *           type: number
 *         amount:
 *           type: number
 *         timestamp:
 *           type: number
 */

export function startBackend(app: Express, io: Server) {
  let cryptoPrices: Record<string, any> = {};
  let binanceTickers: any[] = [];
  let forexRates: Record<string, any> = {};
  let stockPrices: Record<string, any> = {
    spy: { usd: 520, change: 0 },
    qqq: { usd: 440, change: 0 },
    apple: { usd: 190, change: 0 },
    tesla: { usd: 170, change: 0 }
  };

  // --- Swagger Setup ---
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Elite Trade Hub API',
        version: '1.0.0',
        description: 'Professional Trading Platform API',
      },
      servers: [{ url: '/api' }],
    },
    apis: ['./backend/index.ts'],
  };
  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));



  // Advanced Quant Analysis (Mirroring Python/Pandas logic - Built from scratch)
  function calculateAnalysis(asset: string) {
    const prices = getHistory(asset);
    
    // Scratch-built algorithms (NumPy/Pandas/scikit-learn mirror)
    const rsi = quant.calculateRSI(prices);
    const macd = quant.calculateMACD(prices);
    const volatility = quant.calculateVolatility(prices);
    const predictedPrice = quant.predictPrice(prices, 3);
    const trendLogic = quant.detectTrend(prices);

    return {
      rsi,
      macd,
      trend: trendLogic.direction,
      trendStrength: (trendLogic.strength * 100).toFixed(2) + '%',
      momentum: trendLogic.momentum,
      volatility: (volatility / prices[prices.length - 1] * 100).toFixed(2) + '%',
      prediction: predictedPrice.toFixed(2)
    };
  }

  function getCurrentState() {
    const assets = ['bitcoin', 'ethereum', 'solana', 'spy', 'qqq', 'apple', 'tesla'];
    const analysisMap: Record<string, any> = {};
    assets.forEach(a => analysisMap[a] = calculateAnalysis(a));

    return {
      crypto: cryptoPrices,
      binance: binanceTickers,
      forex: forexRates,
      stocks: stockPrices,
      recentTrades: db.prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10').all(),
      analysis: analysisMap
    };
  }

  function broadcastState() {
    const state = getCurrentState();
    io.emit('market-data', state);
  }

  // --- Specialized Polling ---
  async function fetchStocks() {
    try {
      const symbols = ['SPY', 'QQQ', 'AAPL', 'TSLA'];
      for (const symbol of symbols) {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
          params: { interval: '1d', range: '1d' },
          timeout: 4000
        });
        const meta = res.data.chart.result[0].meta;
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.previousClose;
        const change = ((currentPrice - prevClose) / prevClose) * 100;
        
        const keyMap: any = { 'SPY': 'spy', 'QQQ': 'qqq', 'AAPL': 'apple', 'TSLA': 'tesla' };
        const key = keyMap[symbol];
        stockPrices[key] = { usd: currentPrice, change: change };
        
        if (priceHistory[key]) {
          priceHistory[key][priceHistory[key].length - 1] = currentPrice;
        }
      }
      broadcastState();
    } catch (e) {
      console.warn('Stock Fetch Error');
    }
  }

  async function fetchBinance() {
    try {
      const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        params: { symbols: '["BTCUSDT","ETHUSDT","SOLUSDT"]' },
        timeout: 4000
      });
      binanceTickers = res.data;
      broadcastState();
    } catch (e) {
      console.warn('Binance Fetch Error');
    }
  }

  async function fetchCoinGecko() {
    try {
      const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'bitcoin,ethereum,solana,cardano,polkadot,dogecoin,ripple,binancecoin,chainlink,uniswap',
          vs_currencies: 'usd',
          include_24hr_change: 'true',
          include_market_cap: 'true'
        },
        timeout: 10000
      });
      cryptoPrices = res.data;
      broadcastState();
    } catch (e: any) {
      if (e.response?.status === 429) {
        console.log('🛡️ CoinGecko: Rate limit hit. Keeping existing cache to prevent data drops.');
      } else {
        console.warn('📡 CoinGecko: Provider sync error.');
      }
    }
  }

  async function fetchForex() {
    try {
      const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 });
      forexRates = res.data.rates;
      broadcastState();
    } catch (e) {
      console.warn('💹 Forex: Sync error.');
    }
  }

  // Set individual intervals
  setInterval(fetchStocks, 65000);   // Stocks: ~1 minute
  setInterval(fetchBinance, 5000);   // Fast (Binance is generous)
  setInterval(fetchCoinGecko, 90000); // Increased to 90s to stay under free tier
  setInterval(fetchForex, 600000);   // 10 minutes (Forex is slow)

  // Initial calls
  fetchStocks();
  fetchBinance();
  fetchCoinGecko();
  fetchForex();

  // --- API Endpoints ---

  /**
   * @swagger
   * /market/pulse:
   *   get:
   *     summary: Fetch current analytical state (Polling Fallback)
   *     responses:
   *       200:
   *         description: Full market state object
   */
  app.get('/api/market/pulse', (req, res) => {
    res.json(getCurrentState());
  });

  /**
   * @swagger
   * /market:
   *   get:
   *     summary: Get all live market data
   *     responses:
   *       200:
   *         description: Live market prices and rates
   */
  app.get('/api/market', (req, res) => {
    res.json({ crypto: cryptoPrices, binance: binanceTickers, forex: forexRates });
  });

  /**
   * @swagger
   * /trades:
   *   get:
   *     summary: Get trade history from SQL
   *     responses:
   *       200:
   *         description: List of trades
   */
  app.get('/api/trades', (req, res) => {
    const stmt = db.prepare('SELECT * FROM trades ORDER BY timestamp DESC');
    res.json(stmt.all());
  });

  /**
   * @swagger
   * /trade:
   *   post:
   *     summary: Execute a new trade
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Trade'
   *     responses:
   *       201:
   *         description: Trade executed successfully
   */
  app.post('/api/trade', (req, res) => {
    const { asset, type, price, amount } = req.body;
    const id = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    const totalCost = price * amount;

    // Check balances (Authoritative source of truth)
    const portfolio = db.prepare('SELECT * FROM portfolio').all();
    const usdItem = (portfolio as any[]).find(p => p.asset === 'usd');
    const assetItem = (portfolio as any[]).find(p => p.asset === asset);

    const usdBalance = usdItem ? usdItem.quantity : 0;
    const assetBalance = assetItem ? assetItem.quantity : 0;

    if (type === 'BUY' && totalCost > usdBalance) {
      return res.status(400).json({ error: 'Insufficient USD balance for this trade.' });
    }

    if (type === 'SELL' && amount > assetBalance) {
      return res.status(400).json({ error: `Insufficient ${asset} quantity for this trade.` });
    }

    const insert = db.prepare('INSERT INTO trades (id, asset, type, price, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run(id, asset, type, price, amount, timestamp);

    // Update Portfolio
    const portfolioUpdate = type === 'BUY' 
      ? db.prepare('UPDATE portfolio SET quantity = quantity + ? WHERE asset = ?')
      : db.prepare('UPDATE portfolio SET quantity = quantity - ? WHERE asset = ?');
    
    portfolioUpdate.run(amount, asset);
    
    // Update USD balance
    const usdUpdate = type === 'BUY'
      ? db.prepare("UPDATE portfolio SET quantity = quantity - ? WHERE asset = 'usd'")
      : db.prepare("UPDATE portfolio SET quantity = quantity + ? WHERE asset = 'usd'");
    
    usdUpdate.run(totalCost);

    broadcastState();
    res.status(201).json({ id, asset, type, price, amount, timestamp });
  });

  /**
   * @swagger
   * /portfolio/reset:
   *   post:
   *     summary: Reset portfolio to initial state
   *     responses:
   *       200:
   *         description: Portfolio reset successful
   */
  app.post('/api/portfolio/reset', (req, res) => {
    db.exec(`
      DELETE FROM trades;
      UPDATE portfolio SET quantity = 1.25 WHERE asset = 'bitcoin';
      UPDATE portfolio SET quantity = 15.4 WHERE asset = 'ethereum';
      UPDATE portfolio SET quantity = 240.5 WHERE asset = 'solana';
      UPDATE portfolio SET quantity = 142509.42 WHERE asset = 'usd';
    `);
    broadcastState();
    res.json({ message: 'Portfolio reset' });
  });

  /**
   * @swagger
   * /portfolio:
   *   get:
   *     summary: Get current portfolio status
   *     responses:
   *       200:
   *         description: Portfolio assets and quantities
   */
  app.get('/api/portfolio', (req, res) => {
    const portfolio = db.prepare('SELECT * FROM portfolio').all();
    res.json(portfolio);
  });

  /**
   * @swagger
   * /quant/snapshot:
   *   get:
   *     summary: Get raw analytical series (Pandas/NumPy mirror)
   *     responses:
   *       200:
   *         description: Historical price series and calculated matrices
   */
  app.get('/api/quant/snapshot', (req, res) => {
    const results: Record<string, any> = {};
    ['bitcoin', 'ethereum', 'solana'].forEach(asset => {
      const prices = getHistory(asset);
      results[asset] = {
        series: prices,
        mean: prices.reduce((a, b) => a + b) / prices.length,
        predictive_slope: quant.predictPrice(prices, 1) - prices[prices.length - 1],
        volatility_matrix: quant.calculateVolatility(prices)
      };
    });
    res.json(results);
  });

  io.on('connection', (socket) => {
    broadcastState();
  });
}
