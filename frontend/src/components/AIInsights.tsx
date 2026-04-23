import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Props {
  asset: string;
  marketData: any;
}

const AIInsights: React.FC<Props> = ({ asset, marketData }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const stats = marketData.analysis?.[asset.toLowerCase()];
      if (!stats) return;

      const assetNameMap: any = {
        spy: 'S&P 500 Index',
        qqq: 'NASDAQ 100 Index',
        apple: 'Apple Inc. (AAPL)',
        tesla: 'Tesla Inc. (TSLA)',
        bitcoin: 'Bitcoin',
        ethereum: 'Ethereum',
        solana: 'Solana'
      };
      
      const displayName = assetNameMap[asset.toLowerCase()] || asset;

      const prompt = `Perform a deep technical analysis for ${displayName}.
      Market Status:
      - Quant Metrics: RSI: ${stats.rsi}, Trend: ${stats.trend}, Strength: ${stats.trendStrength}, Volatility: ${stats.volatility}
      - ML Prediction (Linear Regression): Next value approx $${stats.prediction || 'unknown'}
      - MACD Snapshot: ${JSON.stringify(stats.macd)}
      
      Compare these metrics and return JSON with keys: 
      "sentiment" (Ultra Bullish/Bullish/Neutral/Bearish/Ultra Bearish), 
      "risk_score" (0-100), 
      "prediction" (Next 4h outlook in 5 words),
      "alpha_insight" (One sentence high-value technical advice).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response.text) {
        setAnalysis(JSON.parse(response.text));
      }
    } catch (error) {
      console.error('AI Analysis failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (asset) analyze();
  }, [asset]);

  return (
    <div className="bg-[#15171A] border border-[#2D3139] border-l-[3px] border-l-[#00FF88] rounded-xl p-5 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00FF88]" />
          Intelligence: AI Analysis
        </h3>
        <button onClick={analyze} disabled={loading} className="text-[10px] text-[#00FF88] hover:text-white font-bold uppercase disabled:opacity-50 flex items-center gap-1 transition-all">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse relative z-10">
          <div className="h-3 bg-white/5 rounded w-3/4"></div>
          <div className="h-3 bg-white/5 rounded w-1/2"></div>
        </div>
      ) : analysis ? (
        <div className="space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#0A0B0D]/50 border border-[#2D3139] rounded-lg">
              <p className="text-[9px] text-gray-500 uppercase mb-1">Sentiment</p>
              <p className={`text-[11px] font-bold uppercase italic tracking-tighter ${analysis.sentiment?.includes('Bullish') ? 'text-[#00FF88]' : 'text-red-500'}`}>{analysis.sentiment}</p>
            </div>
            <div className="p-3 bg-[#0A0B0D]/50 border border-[#2D3139] rounded-lg">
              <p className="text-[9px] text-gray-500 uppercase mb-1">Risk Score</p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-orange-400">{analysis.risk_score}</p>
                <div className="flex-grow h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 transition-all duration-1000" style={{ width: `${analysis.risk_score || 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-white/[0.02] border border-[#2D3139] rounded-lg">
              <p className="text-[9px] text-gray-500 uppercase mb-1">4H Outlook</p>
              <p className="text-[11px] font-medium text-[#00FF88] italic">{analysis.prediction}</p>
            </div>
            <div className="p-4 bg-[#00FF88]/[0.02] border border-[#00FF88]/20 rounded-lg">
              <p className="text-[9px] text-[#00FF88] uppercase font-black mb-2 tracking-[0.1em]">Alpha Insight</p>
              <p className="text-[12px] text-gray-300 leading-relaxed font-medium">{analysis.alpha_insight}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-gray-500 italic text-center py-4">Initialize intelligence scan for {asset.toUpperCase()}</p>
      )}
    </div>
  );
};

export default AIInsights;
