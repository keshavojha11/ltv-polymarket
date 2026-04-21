import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatVolume, formatLTV } from '../utils/format';

/**
 * BucketDistribution — Summary stats, bucket bar chart, and flag pie chart.
 */

const BUCKET_COLORS = {
  A: '#10b981',
  B: '#f59e0b',
};

const FLAG_COLORS = {
  liquidation: '#ef4444',
  mispriced: '#f97316',
  clean: '#334155',
};

function StatCard({ label, value, sublabel, color, icon }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">
          {label}
        </span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <span
        className="text-3xl font-bold font-mono"
        style={{ color: color || 'var(--color-text-primary)' }}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-xs text-text-muted">{sublabel}</span>
      )}
    </div>
  );
}

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <p className="label">Bucket {data.name}</p>
      <p className="value">{data.count} markets</p>
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="label">{payload[0].name}</p>
      <p className="value">{payload[0].value} markets</p>
    </div>
  );
}

export default function BucketDistribution({ markets, summary }) {
  if (!summary) return null;

  // Bar chart data
  const bucketData = [
    { name: 'A', count: summary.bucket_a_count, fill: BUCKET_COLORS.A },
    { name: 'B', count: summary.bucket_b_count, fill: BUCKET_COLORS.B },
  ];

  // Pie chart data
  const cleanCount =
    summary.total_markets -
    summary.flagged_liquidation -
    summary.flagged_mispriced;
  const flagData = [
    { name: 'Liquidation Risk', value: summary.flagged_liquidation, fill: FLAG_COLORS.liquidation },
    { name: 'Mispriced', value: summary.flagged_mispriced, fill: FLAG_COLORS.mispriced },
    { name: 'Clean', value: Math.max(0, cleanCount), fill: FLAG_COLORS.clean },
  ].filter((d) => d.value > 0);

  // LTV distribution for histogram
  const ltvBins = [
    { range: '0-20%', count: 0 },
    { range: '20-40%', count: 0 },
    { range: '40-60%', count: 0 },
    { range: '60-80%', count: 0 },
    { range: '80-100%', count: 0 },
  ];
  (markets || []).forEach((m) => {
    const pct = m.effective_ltv * 100;
    if (pct < 20) ltvBins[0].count++;
    else if (pct < 40) ltvBins[1].count++;
    else if (pct < 60) ltvBins[2].count++;
    else if (pct < 80) ltvBins[3].count++;
    else ltvBins[4].count++;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 stagger-children">
        <StatCard
          label="Total Markets"
          value={summary.total_markets}
          icon="📊"
        />
        <StatCard
          label="Bucket A"
          value={summary.bucket_a_count}
          color={BUCKET_COLORS.A}
          sublabel="High confidence"
          icon="🟢"
        />
        <StatCard
          label="Bucket B"
          value={summary.bucket_b_count}
          color={BUCKET_COLORS.B}
          sublabel="Standard"
          icon="🟡"
        />
        <StatCard
          label="Liq. Risk"
          value={summary.flagged_liquidation}
          color={FLAG_COLORS.liquidation}
          sublabel="Extreme + near expiry"
          icon="🔴"
        />
        <StatCard
          label="Mispriced"
          value={summary.flagged_mispriced}
          color={FLAG_COLORS.mispriced}
          sublabel="Bucket mismatch"
          icon="🟠"
        />
        <StatCard
          label="Avg Eff. LTV"
          value={formatLTV(summary.avg_effective_ltv)}
          sublabel={`Vol: ${formatVolume(summary.total_volume_24h)}`}
          icon="📈"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bucket Distribution Bar */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">
            Bucket Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bucketData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.5)" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={13}
                tickFormatter={(v) => `Bucket ${v}`}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {bucketData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Flag Breakdown Pie */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">
            Flag Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={flagData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {flagData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2">
            {flagData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: d.fill }}
                />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* LTV Histogram */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-secondary mb-4 uppercase tracking-wider">
            Effective LTV Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ltvBins} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.5)" />
              <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-accent)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" fill="#6366f1" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
