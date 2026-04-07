'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface Props {
  /** Símbolo de TradingView, p.ej. "TVC:GOLD" */
  symbol: string;
  /** Color de la línea de tendencia en formato rgba */
  trendColor?: string;
  height?: number;
  dateRange?: '1D' | '1W' | '1M' | '3M' | '12M';
}

export function TradingViewMiniChart({
  symbol,
  trendColor = 'rgba(41, 98, 255, 1)',
  height = 220,
  dateRange = '1M',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const colorTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Usamos setTimeout para que en React Strict Mode (dev) el cleanup del primer
    // render cancele el timeout antes de que el script llegue a inyectarse.
    // En producción el timeout se ejecuta normalmente en el siguiente tick.
    let cancelled = false;

    const tid = setTimeout(() => {
      if (cancelled || !containerRef.current) return;

      // Limpiar y crear el div hijo que TradingView necesita
      container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src =
        'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
      script.async = true;
      // El widget lee la configuración del innerHTML del propio script
      script.innerHTML = JSON.stringify({
        symbol,
        width: '100%',
        height,
        locale: 'es',
        dateRange,
        colorTheme,
        trendLineColor: trendColor,
        underLineColor: trendColor.replace(/[\d.]+\)$/, '0.12)'),
        underLineBottomColor: trendColor.replace(/[\d.]+\)$/, '0)'),
        isTransparent: true,
        autosize: false,
        largeChartUrl: '',
      });

      container.appendChild(script);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tid);
      if (container) container.innerHTML = '';
    };
  }, [symbol, colorTheme, trendColor, height, dateRange]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full overflow-hidden"
      style={{ minHeight: height }}
    />
  );
}
