/**
 * API Client — Fetch wrapper for the FastAPI backend.
 *
 * In development, requests are proxied via Vite's dev server (see vite.config.js).
 * In production, set VITE_API_URL to the deployed backend URL.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Fetch top markets with default LTV simulation.
 * @returns {Promise<{markets: Array, summary: Object, config_used: Object}>}
 */
export async function fetchMarkets() {
  const res = await fetch(`${API_BASE}/api/markets`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Re-run LTV simulation with custom parameters.
 * @param {Object} config - Simulation config overrides
 * @returns {Promise<{markets: Array, summary: Object, config_used: Object}>}
 */
export async function simulate(config) {
  const res = await fetch(`${API_BASE}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Simulation error: ${res.status}`);
  }
  return res.json();
}

/**
 * Force server-side cache clear and re-fetch fresh data.
 * @returns {Promise<void>}
 */
export async function forceRefresh() {
  const res = await fetch(`${API_BASE}/api/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error('Refresh failed');
}
