import React, { useMemo } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface NewsItem {
  id: string;
  source: string;
  headline: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  time: string;
}

interface Props {
  activeAsset: string;
}

const NewsSentimentHub: React.FC<Props> = ({ activeAsset }) => {
  // Simulating a real-time intelligence feed based on asset
  const news: NewsItem[] = useMemo(() => {
    const assets: any = {
      bitcoin: [
        { id: '1', source: 'Elite Terminal', headline: 'Institutional accumulation detected in sub-60k zones.', sentiment: 'BULLISH', impact: 'HIGH', time: '12m ago' },
        { id: '2', source: 'Reuters Monitor', headline: 'Spot ETF inflows hit record 3-day streak.', sentiment: 'BULLISH', impact: 'MEDIUM', time: '45m ago' },
        { id: '3', source: 'Macro Watch', headline: 'Fed rate cut expectations fueling long-duration assets.', sentiment: 'BULLISH', impact: 'HIGH', time: '1h ago' }
      ],
      ethereum: [
        { id: '4', source: 'L2 Analytics', headline: 'Gas fees hit multi-month lows as EIP-4844 adoption scales.', sentiment: 'BULLISH', impact: 'MEDIUM', time: '5m ago' },
        { id: '5', source: 'Exchange Flow', headline: 'Dormant whale moves 50,000 ETH to cold storage.', sentiment: 'BULLISH', impact: 'MEDIUM', time: '22m ago' }
      ],
      spy: [
        { id: '6', source: 'WSJ Live', headline: 'Tech giants report earnings beat, indices push session highs.', sentiment: 'BULLISH', impact: 'HIGH', time: '2m ago' },
        { id: '7', source: 'Bond Market', headline: '10-Year yield stabilizes below 4.5% after jobs data.', sentiment: 'BULLISH', impact: 'MEDIUM', time: '14m ago' }
      ],
      tesla: [
        { id: '8', source: 'EV Inside', headline: 'Production targets in China revised upwards for Q3.', sentiment: 'BULLISH', impact: 'HIGH', time: '4m ago' },
        { id: '9', source: 'Technical Desk', headline: 'TSLA faces rejection at key 200-day moving average.', sentiment: 'BEARISH', impact: 'MEDIUM', time: '55m ago' }
      ]
    };
    
    return assets[activeAsset.toLowerCase()] || assets.bitcoin;
  }, [activeAsset]);

  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[#00FF88]" />
          Market Narrative: News & Sentiment
        </h3>
        <div className="flex items-center gap-2">
           <span className="text-[8px] text-gray-600 font-bold uppercase">AI Evaluated</span>
        </div>
      </div>

      <div className="space-y-4">
        {news.map((item) => (
          <div key={item.id} className="group relative pl-4 border-l-2 border-[#2D3139] hover:border-[#00FF88] transition-all cursor-default">
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-[#15171A] border-2 border-[#2D3139] group-hover:border-[#00FF88] transition-colors"></div>
            
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{item.source}</span>
              <div className="flex items-center gap-1 text-[8px] text-gray-600 font-mono italic">
                <Clock className="w-2.5 h-2.5" />
                {item.time}
              </div>
            </div>
            
            <p className="text-[11px] font-bold text-gray-200 leading-snug mb-2 group-hover:text-white transition-colors">{item.headline}</p>
            
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-tight ${item.sentiment === 'BULLISH' ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-red-500/10 text-red-500'}`}>
                {item.sentiment}
              </span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-tight bg-white/[0.03] text-gray-500 border border-white/5`}>
                IMPACT: {item.impact}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-[#2D3139]">
        <div className="p-3 bg-[#00FF88]/[0.02] border border-[#00FF88]/10 rounded-lg flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Overall Market Sentiment</p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-3 h-1 rounded-full ${i <= 4 ? 'bg-[#00FF88]' : 'bg-[#2D3139]'}`}></div>
              ))}
            </div>
            <span className="text-[10px] font-black text-[#00FF88]">82% BULLISH</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsSentimentHub;
