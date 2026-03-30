/**
 * Format a number as Indonesian Rupiah (no decimals by default).
 * @param {number|string} value
 * @param {{ maximumFractionDigits?: number }} [opts]
 * @returns {string}
 */
export function formatCurrencyIDR(value, opts = {}) {
  const n = Number(value)
  if (Number.isNaN(n)) return 'Rp\u00a00'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  }).format(n)
}
