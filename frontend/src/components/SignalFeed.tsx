import React from 'react';
import { Bell, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Signal {
  id: string;
  asset: string;
  type: 'BULLISH' | 'BEARISH';
  message: string;
  timestamp: string;
}

interface Props {
  analysis: any;
}

const SignalFeed: React.FC<Props> = ({ analysis }) => {
  const signals: Signal[] = React.useMemo(() => {
    const list: Signal[] = [];
    if (!analysis) return [];

    Object.entries(analysis).forEach(([asset, data]: [string, any]) => {
      if (parseFloat(data.rsi) < 30) {
        list.push({
          id: `${asset}-rsi-low`,
          asset: asset.toUpperCase(),
          type: 'BULLISH',
          message: 'Oversold RSI condition detected',
          timestamp: 'Just now'
        });
      }
      if (parseFloat(data.rsi) > 70) {
        list.push({
          id: `${asset}-rsi-high`,
          asset: asset.toUpperCase(),
          type: 'BEARISH',
          message: 'Overbought RSI condition detected',
          timestamp: 'Just now'
        });
      }
      if (data.trend === 'BULLISH' && parseFloat(data.trendStrength.replace('%', '')) > 80) {
        list.push({
          id: `${asset}-trend-strong`,
          asset: asset.toUpperCase(),
          type: 'BULLISH',
          message: 'High-conviction trend breakout',
          timestamp: 'Live'
        });
      }
    });

    return list.slice(0, 4);
  }, [analysis]);

  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          Quant Intelligence Signals
        </h3>
        <Bell className="w-3.5 h-3.5 text-gray-600" />
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {signals.length > 0 ? (
            signals.map((signal) => (
              <motion.div
                layout
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                key={signal.id}
                className={`p-3 rounded-lg border bg-[#0A0B0D]/50 flex items-start gap-4 transition-all hover:bg-black/40 ${signal.type === 'BULLISH' ? 'border-[#00FF88]/10 group' : 'border-red-500/10'}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${signal.type === 'BULLISH' ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-red-500/10 text-red-500'}`}>
                  {signal.type === 'BULLISH' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black tracking-widest text-white">{signal.asset}</span>
                    <span className="text-[8px] text-gray-600 font-bold uppercase">{signal.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-tight font-medium">{signal.message}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-6">
              <p className="text-[10px] text-gray-600 italic">Scanning global markets for signals...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignalFeed;
