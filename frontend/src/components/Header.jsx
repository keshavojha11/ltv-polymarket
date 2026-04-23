import { formatRelativeTime } from '../utils/format';

/**
 * Header — App title, status indicator, refresh controls, and last-fetched timestamp.
 */
export default function Header({ lastFetched, loading, error, onRefresh }) {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-50">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        {/* Logo icon */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/20">
          P
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-text-primary">
            LTV Risk Simulator
          </h1>
          <p className="text-xs text-text-muted">
            Polymarket · Two-Bucket LTV Model
          </p>
        </div>
      </div>

      {/* Right: Status + Refresh */}
      <div className="flex items-center gap-4">
        {/* Status pill */}
        <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg-card px-3 py-1.5 rounded-full border border-border">
          <span
            className={`w-2 h-2 rounded-full ${
              error
                ? 'bg-risk animate-pulse-glow'
                : loading
                ? 'bg-bucket-b animate-pulse'
                : 'bg-bucket-a'
            }`}
          />
          <span>
            {error ? 'Error' : loading ? 'Fetching…' : 'Live'}
          </span>
          {lastFetched && (
            <>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted font-mono">
                {formatRelativeTime(lastFetched)}
              </span>
            </>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          id="refresh-btn"
          className="p-2 rounded-lg bg-bg-card border border-border hover:border-accent hover:text-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Force refresh data"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
