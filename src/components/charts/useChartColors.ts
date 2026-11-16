import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';

const read = (name: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().split(/\s+/).join(',')})`;

/** Recharts writes colours as SVG attributes, which can't resolve CSS variables — resolve them here. */
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => ({
    accent: read('accent'), good: read('good'), warn: read('warn'), bad: read('bad'), muted: read('muted'),
    faint: read('faint'), line: read('line'), ink: read('ink'), surface: read('surface'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [theme]);
}

export function tooltipStyle(c: ReturnType<typeof useChartColors>) {
  return {
    contentStyle: { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 10, fontSize: 12, color: c.ink, boxShadow: '0 8px 24px -6px rgba(0,0,0,.18)' },
    labelStyle: { color: c.muted, marginBottom: 4 },
    itemStyle: { color: c.ink, padding: 0 },
    cursor: { fill: c.line, opacity: 0.35 },
  };
}
