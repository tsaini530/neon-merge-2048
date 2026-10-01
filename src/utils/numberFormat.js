/**
 * Number formatting utilities for compact arcade display
 */

/**
 * Format a tile value compactly so it always fits cleanly inside the tile
 * Examples:
 *   2 -> '2'
 *   512 -> '512'
 *   1024 -> '1K'
 *   2048 -> '2K'
 *   16384 -> '16K'
 *   131072 -> '128K'
 *   1048576 -> '1M'
 *   34359738368 -> '34.4B'
 * @param {number} val 
 * @returns {string}
 */
export function formatTileNumber(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val; // Handle wildcard or special tiles

  const num = Number(val);
  if (isNaN(num)) return String(val);

  if (num < 1000) {
    return `${num}`;
  }

  // Exact binary powers of 1024 (1024, 2048, 4096, 8192, 16384, etc.)
  if (num < 1000000) {
    const k = num / 1024;
    return k % 1 === 0 ? `${k}K` : `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  if (num < 1000000000) {
    const m = num / (1024 * 1024);
    return m % 1 === 0 ? `${m}M` : `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (num < 1000000000000) {
    const b = num / (1024 * 1024 * 1024);
    return b % 1 === 0 ? `${b}B` : `${(num / 1000000000).toFixed(1).replace(/\.0$/, '')}B`;
  }

  // Extremely large numbers (trillions+)
  const t = num / 1000000000000;
  return `${t.toFixed(1).replace(/\.0$/, '')}T`;
}

/**
 * Format score for HUD header so it never overflows across buttons
 * @param {number} score 
 * @returns {string}
 */
export function formatScore(score) {
  if (!score || isNaN(score)) return '0';
  const num = Number(score);

  if (num < 100000) {
    return num.toLocaleString();
  }
  if (num < 1000000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (num < 1000000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num < 1000000000000) {
    return `${(num / 1000000000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  return `${(num / 1000000000000).toFixed(1).replace(/\.0$/, '')}T`;
}

export default { formatTileNumber, formatScore };
