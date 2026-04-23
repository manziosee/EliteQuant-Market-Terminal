import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { LayoutDashboard, TrendingUp, History, Activity, Sparkles, RefreshCw } from 'lucide-react';
import PriceTicker from './components/PriceTicker.tsx';
import SystemStats from './components/SystemStats.tsx';
import TradingChart from './components/TradingChart.tsx';
import MarketTable from './components/MarketTable.tsx';
import AIInsights from './components/AIInsights.tsx';
import SignalFeed from './components/SignalFeed.tsx';
import CorrelationMatrix from './components/CorrelationMatrix.tsx';
import MarketHeatmap from './components/MarketHeatmap.tsx';
import NewsSentimentHub from './components/NewsSentimentHub.tsx';
import PerformanceAnalytics from './components/PerformanceAnalytics.tsx';
import { Download, Share2 } from 'lucide-react';

const socket = io();

const App: React.FC = () => {
  const [marketData, setMarketData] = useState<any>({ crypto: {}, binance: [], forex: {}, recentTrades: [], indicators: {} });
  const [activeAsset, setActiveAsset] = useState('bitcoin');
  const [tradeAmount, setTradeAmount] = useState(0.1);
  const [portfolio, setPortfolio] = useState<any>([]);
  const [tradeError, setTradeError] = useState<string | null>(null);

  useEffect(() => {
    socket.on('market-data', (data) => {
      setMarketData(data);
    });

    const pollInterval = setInterval(async () => {
      // Small delay for initial connection attempt
      if (!socket.connected) {
        try {
          const res = await axios.get('/api/market/pulse');
          if (res.data) setMarketData(res.data);
        } catch (e) {
          // Silent failure for polling to avoid console spam in dev
        }
      }
    }, 10000);

    fetchPortfolio();

    return () => {
      socket.off('market-data');
      clearInterval(pollInterval);
    };
  }, []);

  const fetchPortfolio = async () => {
    const res = await axios.get('/api/portfolio');
    setPortfolio(res.data);
  };

  const selectedAssetData = useMemo(() => {
    const allPrices = { ...marketData.crypto, ...marketData.stocks };
    return allPrices[activeAsset] || {};
  }, [marketData, activeAsset]);

  const binanceSymbol = useMemo(() => {
    const map: any = {
      'bitcoin': 'BINANCE:BTCUSDT',
      'ethereum': 'BINANCE:ETHUSDT',
      'solana': 'BINANCE:SOLUSDT',
      'spy': 'AMEX:SPY',
      'qqq': 'NASDAQ:QQQ',
      'apple': 'NASDAQ:AAPL',
      'tesla': 'NASDAQ:TSLA'
    };
    return map[activeAsset] || 'BINANCE:BTCUSDT';
  }, [activeAsset]);

  const executeTrade = async (type: 'BUY' | 'SELL') => {
    const price = selectedAssetData.usd;
    if (!price) return;
    setTradeError(null);

    try {
      await axios.post('/api/trade', {
        asset: activeAsset,
        type,
        price,
        amount: tradeAmount
      });
      fetchPortfolio();
    } catch (error: any) {
      setTradeError(error.response?.data?.error || 'Trade failed');
      setTimeout(() => setTradeError(null), 5000);
    }
  };

  const resetPortfolio = async () => {
    if (confirm('Reset your portfolio and history?')) {
      await axios.post('/api/portfolio/reset');
      fetchPortfolio();
    }
  };

  const formatPrice = (p: number) => p ? p.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';

  const totalBalance = useMemo(() => {
    const allPrices = { ...marketData.crypto, ...marketData.stocks };
    return portfolio.reduce((acc: number, item: any) => {
      if (item.asset === 'usd') return acc + item.quantity;
      const price = allPrices[item.asset]?.usd || 0;
      return acc + (item.quantity * price);
    }, 0);
  }, [portfolio, marketData]);

  const downloadQuantSnapshot = () => {
    const data = {
      timestamp: new Date().toISOString(),
      market_data: marketData,
      portfolio: portfolio
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elite_quant_snapshot_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen font-sans flex flex-col bg-[#0A0B0D] text-white selection:bg-[#00FF88] selection:text-black">
      {/* Navbar */}
      <nav className="border-b border-[#2D3139] bg-[#15171A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00FF88] rounded-lg flex items-center justify-center font-black text-black italic text-xl shadow-[0_0_15px_rgba(0,255,136,0.3)]">Q</div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-wider uppercase italic leading-none">Elite<span className="text-[#00FF88]">Quant</span></span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Market Intelligence Terminal</span>
            </div>
          </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex bg-[#00FF88]/10 text-[#00FF88] px-3 py-1 rounded-full text-[11px] font-bold items-center gap-2 border border-[#00FF88]/20">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"></div>
                LIVE: INTELLIGENCE_FEED
              </div>
              <div className="flex gap-2">
                <button onClick={downloadQuantSnapshot} className="p-2 bg-[#15171A] border border-[#2D3139] rounded-lg text-gray-400 hover:text-[#00FF88] transition-all" title="Export Quant Data">
                  <Download className="w-4 h-4" />
                </button>
                <a href="/api-docs" target="_blank" className="p-2 bg-[#15171A] border border-[#2D3139] rounded-lg text-gray-400 hover:text-[#00FF88] transition-all flex items-center gap-2 text-[11px] font-bold uppercase" title="API Documentation">
                  <span className="hidden sm:inline">SWAGGER</span>
                  <Share2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </a>
              </div>
            </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-grow p-4 grid grid-cols-12 gap-3 pb-12 max-w-[1440px] mx-auto w-full">
        <section className="col-span-12">
          <PriceTicker prices={marketData.crypto} forex={marketData.forex} stocks={marketData.stocks} />
          <SystemStats />
        </section>

        <section className="col-span-12 lg:col-span-8 space-y-3 order-1">
          <div className="bg-[#15171A] border border-[#2D3139] rounded-xl overflow-hidden h-[350px] sm:h-[450px] md:h-[500px] flex flex-col">
            <div className="p-4 border-b border-[#2D3139] flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02]">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{activeAsset} / USDT</span>
                <span className="text-lg font-mono font-bold text-[#00FF88]">${formatPrice(selectedAssetData.usd)}</span>
              </div>
              <div className="flex gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
                {[
                  { id: 'bitcoin', label: 'BTC' },
                  { id: 'ethereum', label: 'ETH' },
                  { id: 'solana', label: 'SOL' },
                  { id: 'spy', label: 'S&P 500' },
                  { id: 'qqq', label: 'NASDAQ' },
                  { id: 'apple', label: 'AAPL' },
                  { id: 'tesla', label: 'TSLA' }
                ].map(asset => (
                  <button key={asset.id} onClick={() => setActiveAsset(asset.id)}
                          className={`px-3 py-1 text-[9px] rounded-md font-bold transition-all whitespace-nowrap ${activeAsset === asset.id ? 'bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20' : 'text-gray-500 hover:text-white'}`}>
                    {asset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-grow relative">
              <TradingChart symbol={binanceSymbol} />
            </div>
          </div>

          <MarketTable prices={{ ...marketData.crypto, ...marketData.stocks }} onSelect={setActiveAsset} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
            <CorrelationMatrix analysis={marketData.analysis} />
            <SignalFeed analysis={marketData.analysis} />
          </div>

          <div className="pb-12">
            <MarketHeatmap prices={marketData.crypto} stocks={marketData.stocks} />
          </div>
          
          <div className="pb-12">
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <NewsSentimentHub activeAsset={activeAsset} />
                <PerformanceAnalytics trades={marketData.recentTrades || []} />
             </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-3 order-2">
          <AIInsights asset={activeAsset} marketData={marketData} />

          {/* Quant Intelligence Pulse */}
          <div className="bg-[#15171A] border border-[#2D3139] border-r-[3px] border-r-orange-500/50 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Quant Intelligence Pulse</h3>
              <Activity className="w-3.5 h-3.5 text-orange-500" />
            </div>
            {marketData.analysis?.[activeAsset.toLowerCase()] ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-500 uppercase">Trend Profile</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${marketData.analysis[activeAsset.toLowerCase()].trend === 'BULLISH' ? 'bg-[#00FF88] shadow-[0_0_8px_#00FF88]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
                    <p className="text-[11px] font-bold uppercase">{marketData.analysis[activeAsset.toLowerCase()].trend}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-500 uppercase">ML Prediction (Regression)</p>
                  <p className="text-[11px] font-bold text-[#00FF88] leading-none">${marketData.analysis[activeAsset.toLowerCase()].prediction}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] text-gray-500 uppercase">Momentum State</p>
                  <p className="text-[11px] font-bold text-white leading-none italic">{marketData.analysis[activeAsset.toLowerCase()].momentum}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-500 uppercase">Trend Strength</p>
                  <p className="text-[11px] font-bold text-white leading-none">{marketData.analysis[activeAsset.toLowerCase()].trendStrength}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] text-gray-500 uppercase">Volatility Index</p>
                  <p className="text-[11px] font-bold text-orange-400 leading-none">{marketData.analysis[activeAsset.toLowerCase()].volatility}</p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600 italic">Calculating quant telemetry...</p>
            )}
          </div>
          
          <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6 flex justify-between items-center">
              Execution Sandbox
              <TrendingUp className="w-3.5 h-3.5 text-[#00FF88]" />
            </h3>
            <div className="mb-4">
              <p className="text-[9px] text-gray-500 leading-relaxed uppercase font-medium">Test trading strategies against live market telemetry using the simulated environment.</p>
            </div>
            <div className="space-y-4">
              <input type="number" value={tradeAmount} onChange={(e) => setTradeAmount(parseFloat(e.target.value))}
                     className="w-full p-3 bg-white/[0.03] border border-[#2D3139] rounded-lg text-xs font-mono focus:outline-none focus:border-[#00FF88]" />
              
              {tradeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-500 font-bold uppercase animate-pulse">
                  Error: {tradeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => executeTrade('BUY')} className="py-3 bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] font-bold text-[10px] uppercase rounded-lg hover:bg-[#00FF88] hover:text-black transition-all">Buy</button>
                <button onClick={() => executeTrade('SELL')} className="py-3 bg-red-500/10 border border-red-500/30 text-red-500 font-bold text-[10px] uppercase rounded-lg hover:bg-red-500 hover:text-white transition-all">Sell</button>
              </div>
            </div>
          </div>

          <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex justify-between items-center">
              Account Portfolio
              <div className="flex gap-2">
                <button onClick={resetPortfolio} className="text-[8px] text-gray-600 hover:text-red-500 uppercase font-black transition-colors italic">Reset Account</button>
                <LayoutDashboard className="w-3.5 h-3.5 text-[#00FF88]" />
              </div>
            </h3>
            <div className="text-3xl font-mono font-black mb-6 pb-4 border-b border-white/5">${formatPrice(totalBalance)}</div>
            <div className="space-y-3">
              {portfolio.map((item: any) => (
                <div key={item.asset} className="flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-white group-hover:text-[#00FF88] transition-colors">{item.asset}</span>
                    {item.asset !== 'usd' && (
                      <span className="text-[8px] text-gray-500 font-mono italic">
                        Value: ${(item.quantity * (marketData.crypto[item.asset]?.usd || 0)).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-mono font-bold ${item.asset === 'usd' && item.quantity < 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                    {item.quantity.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
