import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Plus, Trash2, X } from 'lucide-react';

interface Alert {
  id: string;
  asset: string;
  target: number;
  direction: 'above' | 'below';
  triggered: boolean;
  created: number;
}

interface Props {
  prices: Record<string, any>;
}

const STORAGE_KEY = 'eq_price_alerts';

function loadAlerts(): Alert[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveAlerts(a: Alert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

const ASSETS = ['bitcoin','ethereum','solana','cardano','polkadot','dogecoin','ripple','chainlink','uniswap'];

const PriceAlerts: React.FC<Props> = ({ prices }) => {
  const [alerts, setAlerts]   = useState<Alert[]>(loadAlerts);
  const [open, setOpen]       = useState(false);
  const [asset, setAsset]     = useState('bitcoin');
  const [target, setTarget]   = useState('');
  const [direction, setDir]   = useState<'above' | 'below'>('above');
  const [toasts, setToasts]   = useState<{ id: string; msg: string }[]>([]);

  // Persist whenever alerts change
  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  // Check alerts against live prices
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;
    setAlerts(prev => prev.map(a => {
      if (a.triggered) return a;
      const price = prices[a.asset]?.usd;
      if (!price) return a;
      const hit = a.direction === 'above' ? price >= a.target : price <= a.target;
      if (hit) {
        const msg = `${a.asset.toUpperCase()} ${a.direction === 'above' ? '▲' : '▼'} $${a.target.toLocaleString()}`;
        const toastId = Math.random().toString(36).slice(2);
        setToasts(t => [...t, { id: toastId, msg }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 5000);
        return { ...a, triggered: true };
      }
      return a;
    }));
  }, [prices]);

  const addAlert = () => {
    const t = parseFloat(target);
    if (!t || t <= 0) return;
    const newAlert: Alert = { id: Date.now().toString(), asset, target: t, direction, triggered: false, created: Date.now() };
    setAlerts(prev => [newAlert, ...prev]);
    setTarget('');
    setOpen(false);
  };

  const removeAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));
  const clearTriggered = () => setAlerts(prev => prev.filter(a => !a.triggered));

  const active    = alerts.filter(a => !a.triggered).length;
  const triggered = alerts.filter(a => a.triggered).length;

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#00FF88] text-black text-[11px] font-black uppercase px-4 py-2 rounded-lg shadow-lg animate-pulse">
            🔔 Alert: {t.msg}
          </div>
        ))}
      </div>

      <div className="bg-[#15171A] border border-[#2D3139] rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-[#00FF88]" />
            Price Alerts
          </h3>
          <div className="flex items-center gap-2">
            {triggered > 0 && (
              <button onClick={clearTriggered} className="text-[8px] text-gray-500 hover:text-red-400 uppercase font-bold transition-colors">
                Clear {triggered} hit
              </button>
            )}
            <button onClick={() => setOpen(v => !v)}
              className="flex items-center gap-1 text-[9px] font-bold text-[#00FF88] uppercase hover:text-white transition-colors">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>

        {/* Add form */}
        {open && (
          <div className="mb-4 p-3 bg-white/[0.02] border border-[#2D3139] rounded-lg space-y-2">
            <select value={asset} onChange={e => setAsset(e.target.value)}
              className="w-full p-2 bg-[#0A0B0D] border border-[#2D3139] rounded text-[10px] text-white uppercase font-mono focus:outline-none focus:border-[#00FF88]">
              {ASSETS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={direction} onChange={e => setDir(e.target.value as 'above' | 'below')}
                className="flex-shrink-0 p-2 bg-[#0A0B0D] border border-[#2D3139] rounded text-[10px] text-white font-mono focus:outline-none focus:border-[#00FF88]">
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
              <input type="number" placeholder="Target price $" value={target}
                onChange={e => setTarget(e.target.value)}
                className="flex-grow p-2 bg-[#0A0B0D] border border-[#2D3139] rounded text-[10px] font-mono text-white focus:outline-none focus:border-[#00FF88]" />
            </div>
            <div className="flex gap-2">
              <button onClick={addAlert}
                className="flex-grow py-2 bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] text-[9px] font-black uppercase rounded hover:bg-[#00FF88] hover:text-black transition-all">
                Set Alert
              </button>
              <button onClick={() => setOpen(false)}
                className="px-3 py-2 border border-[#2D3139] text-gray-500 text-[9px] rounded hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <p className="text-[9px] text-gray-600 italic text-center py-3">No alerts set</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.map(a => (
              <div key={a.id} className={`flex items-center justify-between p-2 rounded-lg border text-[9px] ${a.triggered ? 'border-[#00FF88]/30 bg-[#00FF88]/5' : 'border-[#2D3139] bg-black/20'}`}>
                <div className="flex items-center gap-2">
                  {a.triggered
                    ? <Bell className="w-3 h-3 text-[#00FF88]" />
                    : <BellOff className="w-3 h-3 text-gray-500" />
                  }
                  <span className="font-mono font-bold text-white uppercase">{a.asset}</span>
                  <span className="text-gray-500">{a.direction}</span>
                  <span className="font-mono text-[#00FF88]">${a.target.toLocaleString()}</span>
                  {a.triggered && <span className="text-[#00FF88] font-black">✓ HIT</span>}
                </div>
                <button onClick={() => removeAlert(a.id)} className="text-gray-600 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {active > 0 && (
          <p className="text-[8px] text-gray-600 uppercase font-bold mt-3 text-center tracking-wider">
            {active} active alert{active !== 1 ? 's' : ''} watching live prices
          </p>
        )}
      </div>
    </>
  );
};

export default PriceAlerts;
