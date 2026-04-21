import { useState, useMemo } from 'react';
import {
  formatPrice,
  formatLTV,
  formatDays,
  formatVolume,
  truncate,
  getBucketColor,
} from '../utils/format';

/**
 * MarketTable — Sortable, filterable table of enriched markets.
 *
 * Columns: Market Name | Price | Days Left | Bucket | Base LTV | Effective LTV | Borrow Cap/$100 | Flags
 * Color coding: Bucket A (green), Bucket B (amber), Liquidation Risk (red), Mispriced (orange)
 */

const COLUMNS = [
  { key: 'question', label: 'Market', sortable: true },
  { key: 'yes_price', label: 'Price', sortable: true },
  { key: 'days_to_resolution', label: 'Days Left', sortable: true },
  { key: 'bucket', label: 'Bucket', sortable: true },
  { key: 'base_ltv', label: 'Base LTV', sortable: true },
  { key: 'effective_ltv', label: 'Eff. LTV', sortable: true },
  { key: 'borrow_capacity_per_100', label: 'Borrow/$100', sortable: true },
  { key: 'volume_24h', label: '24h Vol', sortable: true },
  { key: 'flags', label: 'Flags', sortable: false },
];

export default function MarketTable({ markets }) {
  const [sortKey, setSortKey] = useState('volume_24h');
  const [sortDir, setSortDir] = useState('desc');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedMarkets = useMemo(() => {
    let filtered = markets || [];
    if (showFlaggedOnly) {
      filtered = filtered.filter((m) => m.liquidation_risk || m.mispriced);
    }
    return [...filtered].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [markets, sortKey, sortDir, showFlaggedOnly]);

  const flaggedCount = (markets || []).filter(
    (m) => m.liquidation_risk || m.mispriced
  ).length;

  return (
    <div className="animate-fade-in">
      {/* Filter bar */}
      <div className="flex items-center justify-between px-1 mb-4">
        <p className="text-sm text-text-secondary">
          Showing <span className="text-text-primary font-semibold">{sortedMarkets.length}</span> markets
          {showFlaggedOnly && ' (flagged only)'}
        </p>
        <button
          id="filter-flagged-btn"
          onClick={() => setShowFlaggedOnly((v) => !v)}
          className={`
            text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
            ${
              showFlaggedOnly
                ? 'bg-risk/15 text-risk border-risk/30'
                : 'bg-bg-card text-text-secondary border-border hover:border-risk/30 hover:text-risk'
            }
          `}
        >
          ⚠ Flagged Only ({flaggedCount})
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="market-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`${sortKey === col.key ? 'sorted' : ''} ${
                      col.sortable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-accent">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMarkets.map((market, idx) => (
                <tr
                  key={market.condition_id || idx}
                  className={
                    market.liquidation_risk
                      ? 'border-l-2 border-l-risk'
                      : ''
                  }
                >
                  {/* Market Name */}
                  <td className="max-w-[300px]">
                    <span
                      className="text-text-primary font-medium"
                      title={market.question}
                    >
                      {truncate(market.question, 55)}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="font-mono text-text-primary font-medium">
                    {formatPrice(market.yes_price)}
                  </td>

                  {/* Days Left */}
                  <td>
                    <span
                      className={`font-mono ${
                        market.days_to_resolution <= 3
                          ? 'text-risk font-semibold'
                          : market.days_to_resolution <= 7
                          ? 'text-bucket-b'
                          : 'text-text-secondary'
                      }`}
                    >
                      {formatDays(market.days_to_resolution)}
                    </span>
                  </td>

                  {/* Bucket */}
                  <td>
                    <span className={`badge ${getBucketColor(market.bucket)}`}>
                      {market.bucket}
                    </span>
                  </td>

                  {/* Base LTV */}
                  <td className="font-mono text-text-secondary">
                    {formatLTV(market.base_ltv)}
                  </td>

                  {/* Effective LTV */}
                  <td>
                    <span
                      className="font-mono font-semibold"
                      style={{
                        color:
                          market.effective_ltv >= 0.6
                            ? '#10b981'
                            : market.effective_ltv >= 0.4
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {formatLTV(market.effective_ltv)}
                    </span>
                  </td>

                  {/* Borrow Cap */}
                  <td className="font-mono text-text-primary">
                    ${market.borrow_capacity_per_100.toFixed(1)}
                  </td>

                  {/* 24h Volume */}
                  <td className="font-mono text-text-secondary">
                    {formatVolume(market.volume_24h)}
                  </td>

                  {/* Flags */}
                  <td>
                    <div className="flex gap-1.5">
                      {market.liquidation_risk && (
                        <span className="badge badge-risk animate-pulse-glow">
                          ⚠ Liq Risk
                        </span>
                      )}
                      {market.mispriced && (
                        <span className="badge badge-mispriced">
                          ◈ Mispriced
                        </span>
                      )}
                      {!market.liquidation_risk && !market.mispriced && (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedMarkets.length === 0 && (
            <div className="text-center py-16 text-text-muted">
              {showFlaggedOnly
                ? 'No flagged markets found.'
                : 'No market data available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
