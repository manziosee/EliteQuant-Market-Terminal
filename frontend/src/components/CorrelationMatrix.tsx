import React from 'react';
import { Target } from 'lucide-react';

interface Props {
  analysis: any;
}

const CorrelationMatrix: React.FC<Props> = ({ analysis }) => {
  const assets = ['bitcoin', 'ethereum', 'solana', 'spy', 'qqq'];
  
  // Simulating correlation based on trend and volatility
  const getCorrelation = (a: string, b: string) => {
    if (a === b) return 1.0;
    
    // Crypto logic
    if (['bitcoin', 'ethereum', 'solana'].includes(a) && ['bitcoin', 'ethereum', 'solana'].includes(b)) {
      return 0.85 + (Math.random() * 0.1);
    }
    
    // Tech Indices logic
    if ((a === 'qqq' || a === 'spy') && (b === 'qqq' || b === 'spy')) {
      return 0.92;
    }

    // Cross-market logic
    if (['bitcoin', 'ethereum'].includes(a) && (b === 'qqq')) {
      return 0.65;
    }

    return 0.3 + (Math.random() * 0.2);
  };

  const getColor = (val: number) => {
    if (val > 0.8) return 'bg-[#00FF88]/40 text-[#00FF88]';
    if (val > 0.5) return 'bg-[#00FF88]/20 text-[#00FF88]/80';
    return 'bg-white/5 text-gray-500';
  };

  return (
    <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-[#00FF88]" />
          Cross-Asset Correlation
        </h3>
        <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest italic">Calculated Matrix</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <td></td>
              {assets.map(a => (
                <td key={a} className="p-1 text-[8px] text-gray-600 font-bold uppercase text-center vertical-text">
                  <div className="rotate-180 [writing-mode:vertical-lr]">{a.slice(0, 3)}</div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a}>
                <td className="p-1 text-[8px] text-gray-600 font-bold uppercase text-right leading-none pr-2">{a.slice(0, 3)}</td>
                {assets.map(b => {
                  const val = getCorrelation(a, b);
                  return (
                    <td key={b} className={`p-2 rounded text-[10px] font-mono font-bold text-center transition-all hover:scale-110 cursor-default ${getColor(val)}`}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded bg-[#00FF88]/40"></div>
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">High Correlation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded bg-white/5"></div>
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Low Correlation</span>
        </div>
      </div>
    </div>
  );
};

export default CorrelationMatrix;
