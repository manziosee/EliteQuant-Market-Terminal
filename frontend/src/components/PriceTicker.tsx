import React, { useMemo } from 'react';

interface Props {
  prices: any;
  forex: any;
  stocks: any;
}

const PriceTicker: React.FC<Props> = ({ prices, forex, stocks }) => {
  const items = useMemo(() => {
    const arr = [];
    // Key Indices First
    if (stocks?.spy) arr.push({ label: 'S&P 500', value: stocks.spy.usd, change: stocks.spy.change, type: 'stock' });
    if (stocks?.qqq) arr.push({ label: 'NASDAQ', value: stocks.qqq.usd, change: stocks.qqq.change, type: 'stock' });

    for (const [key, data] of Object.entries(prices || {})) {
      arr.push({ label: key, value: (data as any).usd, change: (data as any).usd_24h_change, type: 'crypto' });
    }
    ['EUR', 'GBP', 'JPY'].forEach(ccy => {
      if (forex?.[ccy]) arr.push({ label: `USD/${ccy}`, value: forex[ccy], type: 'forex' });
    });
    return arr;
  }, [prices, forex, stocks]);

  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl overflow-hidden h-12 flex items-center relative shadow-inner">
      <div className="absolute left-0 top-0 bottom-0 px-4 bg-[#00FF88] text-black flex items-center justify-center z-20 font-black text-[10px] uppercase italic whitespace-nowrap shadow-[4px_0_15px_rgba(0,0,0,0.5)]">
        Intelligence Stream
      </div>
      <div className="flex animate-marquee items-center gap-10 px-8">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 whitespace-nowrap shrink-0 border-r border-[#2D3139] pr-10 last:border-0 h-10">
            <span className="text-[9px] font-black uppercase text-gray-400 tracking-tighter leading-none">{item.label}</span>
            <span className="text-[11px] font-mono font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
              {item.type === 'forex' ? '' : '$'}{item.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            {(item.type === 'crypto' || item.type === 'stock') && (
              <span className={`text-[10px] font-bold font-mono px-1 rounded ${(item.change || 0) >= 0 ? 'text-[#00FF88] bg-[#00FF88]/5' : 'text-red-500 bg-red-500/5'}`}>
                {item.change >= 0 ? '▲' : '▼'}{Math.abs(item.change || 0).toFixed(2)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PriceTicker;
