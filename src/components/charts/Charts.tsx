import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts';
import { tooltipStyle, useChartColors } from './useChartColors';

export function HBars({ data, height, color }: { data: { name: string; value: number }[]; height?: number; color?: 'accent' | 'good' | 'warn' | 'bad' }) {
  const c = useChartColors();
  const h = height ?? Math.max(120, data.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: c.muted }} />
        <Tooltip {...tooltipStyle(c)} formatter={(v: number) => [v, 'Count']} />
        <Bar dataKey="value" fill={c[color ?? 'accent']} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: c.muted }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VBars({ data, height = 220, series }: { data: Record<string, string | number>[]; height?: number; series: { key: string; label: string; color: 'accent' | 'good' | 'warn' | 'bad' | 'faint' }[] }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} />
        <Tooltip {...tooltipStyle(c)} />
        {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={c[s.color]} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={28} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, height = 200, dataKey, label }: { data: Record<string, string | number>[]; height?: number; dataKey: string; label: string }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.accent} stopOpacity={0.25} /><stop offset="100%" stopColor={c.accent} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.muted }} />
        <Tooltip {...tooltipStyle(c)} formatter={(v: number) => [v, label]} />
        <Area type="monotone" dataKey={dataKey} stroke={c.accent} strokeWidth={1.75} fill={`url(#g-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
