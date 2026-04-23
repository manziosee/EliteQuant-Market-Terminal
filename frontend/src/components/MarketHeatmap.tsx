import React from 'react';
import { LayoutGrid } from 'lucide-react';

interface Props {
  prices: any;
  stocks: any;
}

const MarketHeatmap: React.FC<Props> = ({ prices, stocks }) => {
  const all = { ...prices, ...stocks };
  
  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5 text-[#00FF88]" />
          Asset Performance Heatmap
        </h3>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {Object.entries(all).map(([key, data]: [string, any]) => {
          const change = data.usd_24h_change || data.change || 0;
          const bgOpacity = Math.min(Math.abs(change) / 5, 1);
          const isPositive = change >= 0;
          
          return (
            <div 
              key={key} 
              className={`p-3 rounded-lg flex flex-col items-center justify-center text-center transition-all hover:scale-105 cursor-pointer border border-white/5
                ${isPositive ? 'bg-[#00FF88]/[0.1]' : 'bg-red-500/[0.1]'}
              `}
              style={{
                backgroundColor: isPositive 
                  ? `rgba(0, 255, 136, ${0.05 + bgOpacity * 0.2})` 
                  : `rgba(239, 68, 68, ${0.05 + bgOpacity * 0.2})`
              }}
            >
              <span className="text-[10px] font-black uppercase text-white truncate w-full">{key}</span>
              <span className={`text-[10px] font-mono font-bold ${isPositive ? 'text-[#00FF88]' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketHeatmap;
