import React from 'react';
import { Globe, ShieldCheck, Cpu } from 'lucide-react';

const SystemStats: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-4 px-6 py-2 border-b border-[#2D3139] bg-black/40">
      <div className="flex items-center gap-2">
        <Globe className="w-3 h-3 text-gray-600" />
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">Global Connectivity:</span>
        <span className="text-[9px] font-mono font-bold text-[#00FF88] leading-none">STABLE</span>
      </div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3 h-3 text-gray-600" />
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">Security Protocol:</span>
        <span className="text-[9px] font-mono font-bold text-[#00FF88] leading-none">AES-256-GCM</span>
      </div>
      <div className="flex items-center gap-2">
        <Cpu className="w-3 h-3 text-gray-600" />
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">Quant Node:</span>
        <span className="text-[9px] font-mono font-bold text-orange-500 leading-none">PRIMARY_01</span>
      </div>
      <div className="ml-auto hidden sm:flex items-center gap-2">
        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest leading-none">Network Latency:</span>
        <span className="text-[9px] font-mono font-bold text-white leading-none">12ms</span>
      </div>
    </div>
  );
};

export default SystemStats;
