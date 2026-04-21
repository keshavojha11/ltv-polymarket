import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Label,
} from 'recharts';
import { formatPrice, formatLTV, formatDays, ltvToColor, truncate } from '../utils/format';

/**
 * RiskHeatmap — Scatter plot visualization of market risk.
 *
 * X-axis: YES price (0–1)
 * Y-axis: Days to resolution (0–90)
 * Dot color: Effective LTV (green=high → red=low)
 * Dot size: 24h volume
 * Reference lines: Bucket A boundaries (price=0.65, days=30)
 */

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="custom-tooltip">
      <p className="label">{truncate(data.question, 50)}</p>
      <div className="flex flex-col gap-1 mt-1">
        <span className="value">
          Price: <strong className="text-text-primary">{formatPrice(data.yes_price)}</strong>
        </span>
        <span className="value">
          Days Left: <strong className="text-text-primary">{formatDays(data.days_to_resolution)}</strong>
        </span>
        <span className="value">
          Effective LTV: <strong style={{ color: ltvToColor(data.effective_ltv) }}>{formatLTV(data.effective_ltv)}</strong>
        </span>
        <span className="value">
          Bucket: <strong className={data.bucket === 'A' ? 'text-bucket-a' : 'text-bucket-b'}>{data.bucket}</strong>
        </span>
        {data.liquidation_risk && (
          <span className="text-risk text-xs font-semibold mt-1">⚠ Liquidation Risk</span>
        )}
      </div>
    </div>
  );
}

export default function RiskHeatmap({ markets }) {
  // Cap days at 90 for better visualization
  const data = (markets || []).map((m) => ({
    ...m,
    days_capped: Math.min(m.days_to_resolution, 90),
    volume_z: Math.max(Math.log10(m.volume_24h + 1) * 20, 40),
  }));

  return (
    <div className="animate-fade-in">
      {/* Legend */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: ltvToColor(0.7) }} />
            High LTV
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: ltvToColor(0.4) }} />
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: ltvToColor(0.15) }} />
            Low LTV
          </span>
          <span className="text-text-muted">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-accent inline-block" style={{ borderBottom: '2px dashed var(--color-accent)' }} />
            Bucket A boundaries
          </span>
        </div>
        <div className="text-xs text-text-muted">
          Dot size = log(volume)
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart margin={{ top: 20, right: 40, bottom: 30, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(30, 41, 59, 0.5)"
            />
            <XAxis
              type="number"
              dataKey="yes_price"
              domain={[0, 1]}
              tickCount={11}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              stroke="#64748b"
              fontSize={12}
              fontFamily="var(--font-mono)"
            >
              <Label
                value="YES Price"
                position="bottom"
                offset={10}
                style={{ fill: '#94a3b8', fontSize: 13, fontFamily: 'var(--font-sans)' }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="days_capped"
              domain={[0, 90]}
              tickCount={10}
              stroke="#64748b"
              fontSize={12}
              fontFamily="var(--font-mono)"
            >
              <Label
                value="Days to Resolution"
                angle={-90}
                position="left"
                offset={0}
                style={{ fill: '#94a3b8', fontSize: 13, fontFamily: 'var(--font-sans)' }}
              />
            </YAxis>
            <ZAxis type="number" dataKey="volume_z" range={[40, 200]} />

            {/* Bucket A boundary: price > 0.65 */}
            <ReferenceLine
              x={0.65}
              stroke="#6366f1"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: 'p=0.65',
                position: 'top',
                fill: '#6366f1',
                fontSize: 11,
              }}
            />

            {/* Bucket A boundary: days < 30 */}
            <ReferenceLine
              y={30}
              stroke="#6366f1"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: 'd=30',
                position: 'right',
                fill: '#6366f1',
                fontSize: 11,
              }}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
            />

            <Scatter data={data}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={ltvToColor(entry.effective_ltv)}
                  stroke={
                    entry.liquidation_risk
                      ? '#ef4444'
                      : 'rgba(255,255,255,0.1)'
                  }
                  strokeWidth={entry.liquidation_risk ? 2 : 1}
                  fillOpacity={0.85}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Annotation */}
        <div className="mt-2 px-4 text-xs text-text-muted text-center">
          Bottom-right quadrant (high price, few days) = Bucket A · Dashed lines show bucket boundary thresholds
        </div>
      </div>
    </div>
  );
}
