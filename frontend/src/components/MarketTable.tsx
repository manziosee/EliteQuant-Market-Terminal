import React from 'react';
import { Activity } from 'lucide-react';

interface Props {
  prices: any;
  onSelect: (asset: string) => void;
}

const MarketTable: React.FC<Props> = ({ prices, onSelect }) => {
  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#2D3139] flex justify-between items-center bg-white/[0.02]">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#00FF88]" />
          Market Overview
        </h3>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse"></span>
          <span className="text-[9px] text-[#00FF88] uppercase font-black tracking-widest">Active Feed</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-black/20">
            <tr>
              <th className="p-4 text-[10px] font-bold uppercase text-gray-500 italic border-b border-[#2D3139]/50">Asset Pair</th>
              <th className="p-4 text-[10px] font-bold uppercase text-gray-500 italic border-b border-[#2D3139]/50 text-right">Price</th>
              <th className="hidden sm:table-cell p-4 text-[10px] font-bold uppercase text-gray-500 italic border-b border-[#2D3139]/50 text-right">24h Change</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(prices || {}).map(([key, data]: [string, any]) => (
              <tr key={key} onClick={() => onSelect(key)} className="border-b border-[#2D3139] last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer group">
                <td className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#0A0B0D] border border-[#2D3139] flex items-center justify-center text-[9px] sm:text-[10px] font-black text-gray-500 group-hover:text-[#00FF88] transition-colors uppercase">
                    {key.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-[12px] sm:text-[13px] font-bold capitalize">{key}</p>
                    <p className="text-[8px] sm:text-[9px] text-gray-500 font-mono italic uppercase">{key.slice(0, 3)} / USDT</p>
                  </div>
                </td>
                <td className="p-3 sm:p-4 text-right font-mono text-xs sm:text-sm font-bold text-white">
                  <div className="flex flex-col items-end">
                    <span>${data.usd?.toLocaleString()}</span>
                    <span className={`sm:hidden text-[9px] ${(data.usd_24h_change || data.change) >= 0 ? 'text-[#00FF88]' : 'text-red-500'}`}>
                      {(data.usd_24h_change || data.change) >= 0 ? '+' : ''}{(data.usd_24h_change || data.change)?.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className={`hidden sm:table-cell p-4 text-right font-mono text-[11px] font-bold ${(data.usd_24h_change || data.change) >= 0 ? 'text-[#00FF88]' : 'text-red-500'}`}>
                  {(data.usd_24h_change || data.change) >= 0 ? '+' : ''}{(data.usd_24h_change || data.change)?.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MarketTable;
