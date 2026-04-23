import React, { useEffect, useMemo } from 'react';

interface Props {
  symbol?: string;
}

const TradingChart: React.FC<Props> = ({ symbol = 'BINANCE:BTCUSDT' }) => {
  const containerId = useMemo(() => `tv-chart-${Math.random().toString(36).substring(7)}`, []);

  useEffect(() => {
    const initChart = () => {
      if (typeof (window as any).TradingView === 'undefined') {
        setTimeout(initChart, 500);
        return;
      }

      new (window as any).TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "container_id": containerId,
        "backgroundColor": "#15171A",
        "gridColor": "rgba(42, 46, 57, 0.06)",
        "withdateranges": true,
      });
    };

    initChart();
  }, [symbol, containerId]);

  return <div id={containerId} className="w-full h-full" />;
};

export default TradingChart;
