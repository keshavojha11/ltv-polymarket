import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import TabNav from './components/TabNav';
import MarketTable from './components/MarketTable';
import RiskHeatmap from './components/RiskHeatmap';
import BucketDistribution from './components/BucketDistribution';
import ParameterTuner from './components/ParameterTuner';
import { fetchMarkets, simulate, forceRefresh } from './api/client';

/**
 * App — Main application shell.
 *
 * State management:
 * - markets/summary: Current data from the backend
 * - config: Active simulation config (synced with ParameterTuner)
 * - activeTab: Which view is displayed
 * - loading/error: UI states
 * - lastFetched: Timestamp of last successful fetch
 *
 * Data flow:
 * 1. On mount, calls GET /api/markets (default params)
 * 2. Auto-refreshes every 60s
 * 3. When ParameterTuner changes config, calls POST /api/simulate
 * 4. Manual refresh clears server cache + re-fetches
 */

const AUTO_REFRESH_INTERVAL = 60_000; // 60 seconds

const DEFAULT_CONFIG = {
  ltv_bucket_a: 0.80,
  ltv_bucket_b: 0.70,
  liquidation_threshold_high: 0.90,
  liquidation_threshold_low: 0.10,
  liquidation_window_days: 7,
};

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState('table');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const intervalRef = useRef(null);

  // ─── Fetch markets (default params) ─────────────────────────
  const loadMarkets = useCallback(async (isRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isRefresh) await forceRefresh();

      const data = await fetchMarkets();
      setMarkets(data.markets || []);
      setSummary(data.summary || null);
      setConfig(data.config_used || DEFAULT_CONFIG);
      setLastFetched(new Date().toISOString());
    } catch (err) {
      console.error('Failed to load markets:', err);
      setError(err.message || 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Re-simulate with custom config ─────────────────────────
  const handleConfigChange = useCallback(async (newConfig) => {
    try {
      setSimulating(true);
      setError(null);

      const data = await simulate(newConfig);
      setMarkets(data.markets || []);
      setSummary(data.summary || null);
      setConfig(data.config_used || newConfig);
    } catch (err) {
      console.error('Simulation failed:', err);
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  }, []);

  // ─── Initial load + auto-refresh ────────────────────────────
  useEffect(() => {
    loadMarkets();

    intervalRef.current = setInterval(() => {
      loadMarkets();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadMarkets]);

  // ─── Manual refresh ─────────────────────────────────────────
  const handleRefresh = () => {
    loadMarkets(true);
  };

  // ─── Render active view ─────────────────────────────────────
  const renderView = () => {
    // Loading skeleton
    if (loading && markets.length === 0) {
      return (
        <div className="space-y-4 animate-fade-in">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg animate-shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case 'table':
        return <MarketTable markets={markets} />;
      case 'heatmap':
        return <RiskHeatmap markets={markets} />;
      case 'distribution':
        return <BucketDistribution markets={markets} summary={summary} />;
      case 'tuner':
        return (
          <ParameterTuner
            config={config}
            onConfigChange={handleConfigChange}
            loading={simulating}
          />
        );
      default:
        return <MarketTable markets={markets} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Header
        lastFetched={lastFetched}
        loading={loading || simulating}
        error={error}
        onRefresh={handleRefresh}
      />

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-risk/10 border border-risk/20 text-risk text-sm flex items-center justify-between animate-fade-in">
          <span>
            <strong>Error:</strong> {error}
          </span>
          <button
            onClick={handleRefresh}
            className="text-xs font-medium px-3 py-1 rounded bg-risk/20 hover:bg-risk/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 text-xs text-text-muted flex items-center justify-between bg-bg-secondary/50">
        <span>
          Polymarket LTV Simulator · {summary?.total_markets || 0} markets loaded
        </span>
        <span className="font-mono">
          Auto-refresh: 60s · Cache TTL: 60s
        </span>
      </footer>
    </div>
  );
}
