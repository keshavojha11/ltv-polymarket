import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * ParameterTuner — Interactive sliders for LTV simulation parameters.
 *
 * 5 sliders that control the simulation config. Changes are debounced (400ms)
 * and trigger a POST /api/simulate call to re-run the model.
 *
 * Also displays the diff from default values for quick visual feedback.
 */

const DEFAULT_CONFIG = {
  ltv_bucket_a: 0.80,
  ltv_bucket_b: 0.70,
  liquidation_threshold_high: 0.90,
  liquidation_threshold_low: 0.10,
  liquidation_window_days: 7,
};

const PARAMS = [
  {
    key: 'ltv_bucket_a',
    label: 'Base LTV — Bucket A',
    description: 'LTV for high-confidence, near-term markets',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#10b981',
  },
  {
    key: 'ltv_bucket_b',
    label: 'Base LTV — Bucket B',
    description: 'LTV for standard/uncertain markets',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#f59e0b',
  },
  {
    key: 'liquidation_threshold_high',
    label: 'Liquidation Threshold (High)',
    description: 'Price above this triggers liq. risk flag near expiry',
    min: 0.5,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#ef4444',
  },
  {
    key: 'liquidation_threshold_low',
    label: 'Liquidation Threshold (Low)',
    description: 'Price below this triggers liq. risk flag near expiry',
    min: 0,
    max: 0.5,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    color: '#ef4444',
  },
  {
    key: 'liquidation_window_days',
    label: 'Liquidation Window (Days)',
    description: 'Days-to-resolution threshold for liquidation risk flag',
    min: 1,
    max: 30,
    step: 1,
    format: (v) => `${v} days`,
    color: '#6366f1',
  },
];

export default function ParameterTuner({ config, onConfigChange, loading }) {
  const [localConfig, setLocalConfig] = useState(config || DEFAULT_CONFIG);
  const debounceRef = useRef(null);

  // Sync with parent config
  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const handleChange = useCallback(
    (key, value) => {
      const numValue =
        key === 'liquidation_window_days' ? parseInt(value) : parseFloat(value);
      const newConfig = { ...localConfig, [key]: numValue };
      setLocalConfig(newConfig);

      // Debounce the API call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onConfigChange(newConfig);
      }, 400);
    },
    [localConfig, onConfigChange]
  );

  const handleReset = () => {
    setLocalConfig({ ...DEFAULT_CONFIG });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onConfigChange({ ...DEFAULT_CONFIG });
  };

  const isModified = Object.keys(DEFAULT_CONFIG).some(
    (k) => localConfig[k] !== DEFAULT_CONFIG[k]
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Simulation Parameters
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Adjust the LTV model parameters. All views update in real-time.
          </p>
        </div>
        <button
          id="reset-params-btn"
          onClick={handleReset}
          disabled={!isModified}
          className={`
            text-xs font-medium px-4 py-2 rounded-lg border transition-all
            ${
              isModified
                ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
                : 'bg-bg-card text-text-muted border-border cursor-not-allowed'
            }
          `}
        >
          ↻ Reset to Defaults
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 px-3 py-2 rounded-lg border border-accent/20">
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Re-simulating with new parameters…
        </div>
      )}

      {/* Sliders */}
      <div className="space-y-2 stagger-children">
        {PARAMS.map((param) => {
          const value = localConfig[param.key];
          const defaultVal = DEFAULT_CONFIG[param.key];
          const diff = value - defaultVal;
          const isChanged = Math.abs(diff) > 0.001;
          const pct =
            ((value - param.min) / (param.max - param.min)) * 100;

          return (
            <div key={param.key} className="glass-card p-5">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <label className="text-sm font-medium text-text-primary">
                    {param.label}
                  </label>
                  <p className="text-xs text-text-muted mt-0.5">
                    {param.description}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="text-xl font-bold font-mono"
                    style={{ color: param.color }}
                  >
                    {param.format(value)}
                  </span>
                  {isChanged && (
                    <div
                      className={`text-xs font-mono mt-0.5 ${
                        diff > 0 ? 'text-bucket-a' : 'text-risk'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}
                      {param.key === 'liquidation_window_days'
                        ? `${diff} days`
                        : `${(diff * 100).toFixed(0)}%`}{' '}
                      from default
                    </div>
                  )}
                </div>
              </div>

              {/* Slider track with filled portion */}
              <div className="relative mt-3">
                <div
                  className="absolute top-0 left-0 h-1.5 rounded-full opacity-30"
                  style={{
                    width: `${pct}%`,
                    background: param.color,
                  }}
                />
                <input
                  type="range"
                  id={`slider-${param.key}`}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={value}
                  onChange={(e) => handleChange(param.key, e.target.value)}
                  className="relative z-10"
                  style={{
                    background: `linear-gradient(to right, ${param.color}33 0%, ${param.color}33 ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
                  }}
                />
              </div>

              {/* Min/Max labels */}
              <div className="flex justify-between mt-1 text-xs text-text-muted font-mono">
                <span>{param.format(param.min)}</span>
                <span>{param.format(param.max)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Formula reference */}
      <div className="glass-card p-5 text-sm">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Model Formula Reference
        </h3>
        <div className="space-y-2 text-text-secondary font-mono text-xs">
          <p>
            <span className="text-accent">effective_ltv</span> = base_ltv × time_decay(days) × confidence_mult(price)
          </p>
          <p>
            <span className="text-accent">confidence_mult</span> = 0.5 + (|price − 0.50| × 0.8)
          </p>
          <p>
            <span className="text-accent">time_decay</span> = {'{'} {'>'} 30d: 1.0 | {'>'} 7d: 0.85 | {'>'} 3d: 0.65 | ≤3d: 0.40 {'}'}
          </p>
          <p>
            <span className="text-risk">liquidation_risk</span> = (price {'>'} high_thresh OR price {'<'} low_thresh) AND days {'<'} window
          </p>
        </div>
      </div>
    </div>
  );
}
