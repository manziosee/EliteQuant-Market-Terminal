# EliteQuant Market Terminal 🚀

EliteQuant is a high-performance, institutional-grade market intelligence terminal designed for real-time analysis across global stocks, indices, and cryptocurrencies.

## 📊 Core Features
- **Global Intelligence Stream**: Live-linked telemetry for S&P 500 (SPY), NASDAQ (QQQ), Apple (AAPL), Tesla (TSLA), and major cryptocurrencies.
- **Quant Analytics Core**: Pro-grade technical indicators including RSI, MACD, Volatility indexing, and Trend Strength detection.
- **AI-Powered Market Narrative**: Asset-specific intelligence feed with AI-driven sentiment scoring and alpha insights.
- **Visual Intelligence**: Cross-asset correlation matrices, market performance heatmaps, and breakout signal feeds.
- **Execution Sandbox**: A secure environment to test quantitative trading strategies against live market telemetry with PnL tracking and win-rate analytics.
- **Hybrid Resilience**: Native Socket.io support with automatic failing over to REST polling for serverless environments (Vercel).

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Lucide Icons, Motion.
- **Backend**: Node.js, Express, Socket.io, Better-SQLite3.
- **Security**: Helmet, Express-Rate-Limit, AES-256 (simulated).
- **Data Providers**: Binance (Crypto), Yahoo Finance (Stocks/Indices), ER-API (Forex), CoinGecko.

## 📁 Structure
- `/frontend`: React application source code and intelligence widgets.
- `/backend`: Quantitative logic, real-time data aggregators, and database handlers.
- `/server.ts`: Modern Express bootstrapper with security hardening.
- `/vercel.json`: Deployment configuration for serverless environments.

## 🚀 Deployment & Setup
### Local Environment
1. Configure `GEMINI_API_KEY` in your `.env` (Required for AI insights).
2. Install dependencies: `npm install`
3. Start terminal: `npm run dev`

### Vercel Deployment
The system is pre-configured for Vercel. 
- Ensure `GEMINI_API_KEY` is added to Vercel Environment Variables.
- The system will automatically detect the serverless environment and switch to **In-Memory DB** and **REST Polling** for maximum stability.

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
