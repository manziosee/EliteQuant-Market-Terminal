import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, TrendingUp, Info } from 'lucide-react';

interface Trade {
  asset: string;
  type: 'BUY' | 'SELL';
  price: number;
  amount: number;
  timestamp: number;
}

interface Props {
  trades: Trade[];
}

const PerformanceAnalytics: React.FC<Props> = ({ trades }) => {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const chartData = React.useMemo(() => {
    let balance = 0;
    return trades.sort((a,b) => a.timestamp - b.timestamp).map(t => {
      const profit = t.type === 'SELL' ? (t.price * t.amount) : -(t.price * t.amount);
      balance += profit;
      return {
        time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pnl: balance
      };
    });
  }, [trades]);

  const metrics = React.useMemo(() => {
    const totalVolume = trades.reduce((acc, t) => acc + (t.price * t.amount), 0);

    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const buyPricesByAsset: Record<string, number[]> = {};
    let wins = 0;
    let sellCount = 0;
    let totalPnL = 0;

    for (const trade of sorted) {
      if (trade.type === 'BUY') {
        if (!buyPricesByAsset[trade.asset]) buyPricesByAsset[trade.asset] = [];
        buyPricesByAsset[trade.asset].push(trade.price);
      } else {
        sellCount++;
        const buys = buyPricesByAsset[trade.asset] || [];
        const avgBuyPrice = buys.length > 0 ? buys.reduce((a, b) => a + b, 0) / buys.length : 0;
        const pnl = (trade.price - avgBuyPrice) * trade.amount;
        totalPnL += pnl;
        if (avgBuyPrice === 0 || trade.price >= avgBuyPrice) wins++;
      }
    }

    const winRate = sellCount > 0 ? ((wins / sellCount) * 100).toFixed(1) + '%' : '—';
    const avgProfit = sellCount > 0
      ? (totalPnL / sellCount >= 0 ? '+' : '') + '$' + Math.abs(totalPnL / sellCount).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

    return {
      winRate,
      avgProfit,
      totalTrades: trades.length,
      volume: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })
    };
  }, [trades]);

  const totalReturn = React.useMemo(() => {
    const buyCost = trades.filter((t: Trade) => t.type === 'BUY').reduce((acc: number, t: Trade) => acc + t.price * t.amount, 0);
    const sellRevenue = trades.filter((t: Trade) => t.type === 'SELL').reduce((acc: number, t: Trade) => acc + t.price * t.amount, 0);
    if (buyCost === 0) return null;
    return ((sellRevenue - buyCost) / buyCost) * 100;
  }, [trades]);

  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-blue-500" />
          Execution Analytics & PnL
        </h3>
        <Info className="w-3.5 h-3.5 text-gray-600 cursor-help" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Win Rate', value: metrics.winRate, color: 'text-[#00FF88]' },
          { label: 'Avg Trade', value: metrics.avgProfit, color: 'text-white' },
          { label: 'Intensity', value: metrics.totalTrades, color: 'text-white' },
          { label: 'Sim Volume', value: `$${metrics.volume}`, color: 'text-gray-400' }
        ].map(m => (
          <div key={m.label} className="p-2 border border-[#2D3139] rounded-lg bg-black/20">
            <p className="text-[8px] text-gray-600 uppercase font-bold mb-1">{m.label}</p>
            <p className={`text-xs font-mono font-black ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="h-40 min-h-[160px] w-full">
        {trades.length > 0 && isReady ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#15171A', border: '1px solid #2D3139', fontSize: '10px' }}
                itemStyle={{ color: '#00FF88' }}
              />
              <Area type="monotone" dataKey="pnl" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center border border-dashed border-[#2D3139] rounded-lg">
            <p className="text-[9px] text-gray-600 italic uppercase">Execute sandbox trades to trigger analytics</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
         <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Real-time Performance Curve</p>
         {totalReturn !== null && (
           <div className="flex items-center gap-1">
             <TrendingUp className={`w-3 h-3 ${totalReturn >= 0 ? 'text-[#00FF88]' : 'text-red-500'}`} />
             <span className={`text-[10px] font-black ${totalReturn >= 0 ? 'text-[#00FF88]' : 'text-red-500'}`}>
               {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
             </span>
           </div>
         )}
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
