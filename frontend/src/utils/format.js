/**
 * Formatting utilities for the dashboard.
 */

/**
 * Format a number as USD with K/M suffixes.
 * @param {number} value
 * @returns {string}
 */
export function formatVolume(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format a price as a percentage (0.87 → "87%").
 * @param {number} price
 * @returns {string}
 */
export function formatPrice(price) {
  return `${(price * 100).toFixed(1)}%`;
}

/**
 * Format effective LTV as percentage.
 * @param {number} ltv
 * @returns {string}
 */
export function formatLTV(ltv) {
  return `${(ltv * 100).toFixed(1)}%`;
}

/**
 * Format days with contextual label.
 * @param {number} days
 * @returns {string}
 */
export function formatDays(days) {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days >= 999) return '—';
  return `${days} days`;
}

/**
 * Format ISO timestamp to relative time
 * @param {string} isoStr
 * @returns {string}
 */
export function formatRelativeTime(isoStr) {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString();
}

/**
 * Truncate a string with ellipsis.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 60) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Get color for bucket badge.
 */
export function getBucketColor(bucket) {
  return bucket === 'A' ? 'badge-a' : 'badge-b';
}

/**
 * Map effective LTV to a hex color (green → yellow → red).
 * Used for the heatmap dots.
 */
export function ltvToColor(ltv) {
  // 0 (red) → 0.5 (yellow) → 1.0 (green)
  const t = Math.max(0, Math.min(1, ltv));
  if (t < 0.5) {
    // Red to Yellow
    const r = 239;
    const g = Math.round(68 + (245 - 68) * (t / 0.5));
    const b = Math.round(68 + (11 - 68) * (t / 0.5));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Green
    const r = Math.round(245 + (16 - 245) * ((t - 0.5) / 0.5));
    const g = Math.round(158 + (185 - 158) * ((t - 0.5) / 0.5));
    const b = Math.round(11 + (129 - 11) * ((t - 0.5) / 0.5));
    return `rgb(${r}, ${g}, ${b})`;
  }
}
