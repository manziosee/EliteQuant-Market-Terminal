import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  asset: string;
  marketData: any;
}

const AIInsights: React.FC<Props> = ({ asset, marketData }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    const stats = marketData.analysis?.[asset.toLowerCase()];
    if (!stats) return;

    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/ai/analyze', { asset, stats });
      setAnalysis(res.data);
    } catch (err: any) {
      const msg: string = err.response?.data?.error || err.message || 'Analysis failed';
      const isQuota = msg.includes('quota') || msg.includes('429') || msg.includes('rate') || err.response?.status === 429;
      setError(isQuota
        ? 'OpenAI quota limit reached. Check your plan at platform.openai.com/usage.'
        : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#15171A] border border-[#2D3139] border-l-[3px] border-l-[#00FF88] rounded-xl p-5 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00FF88]" />
          Intelligence: AI Analysis
        </h3>
        <button onClick={analyze} disabled={loading}
          className="text-[10px] text-[#00FF88] hover:text-white font-bold uppercase disabled:opacity-50 flex items-center gap-1 transition-all">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : analysis ? 'Refresh' : 'Analyze'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-white/5 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
          <div className="h-8 bg-white/5 rounded w-full" />
        </div>
      ) : error ? (
        <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-[10px] font-bold text-orange-400 uppercase">AI Unavailable</p>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">{error}</p>
        </div>
      ) : analysis ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#0A0B0D]/50 border border-[#2D3139] rounded-lg">
              <p className="text-[9px] text-gray-500 uppercase mb-1">Sentiment</p>
              <p className={`text-[11px] font-bold uppercase italic ${analysis.sentiment?.includes('Bullish') ? 'text-[#00FF88]' : analysis.sentiment?.includes('Bearish') ? 'text-red-500' : 'text-gray-300'}`}>
                {analysis.sentiment}
              </p>
            </div>
            <div className="p-3 bg-[#0A0B0D]/50 border border-[#2D3139] rounded-lg">
              <p className="text-[9px] text-gray-500 uppercase mb-1">Risk Score</p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-orange-400">{analysis.risk_score}</p>
                <div className="flex-grow h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 transition-all duration-700" style={{ width: `${analysis.risk_score || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white/[0.02] border border-[#2D3139] rounded-lg">
            <p className="text-[9px] text-gray-500 uppercase mb-1">4H Outlook</p>
            <p className="text-[11px] font-medium text-[#00FF88] italic">{analysis.prediction}</p>
          </div>
          <div className="p-4 bg-[#00FF88]/[0.02] border border-[#00FF88]/20 rounded-lg">
            <p className="text-[9px] text-[#00FF88] uppercase font-black mb-2 tracking-[0.1em]">Alpha Insight</p>
            <p className="text-[12px] text-gray-300 leading-relaxed font-medium">{analysis.alpha_insight}</p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-gray-500 italic text-center py-4">
          Click Analyze to run AI intelligence scan for {asset.toUpperCase()}
        </p>
      )}
    </div>
  );
};

export default AIInsights;
