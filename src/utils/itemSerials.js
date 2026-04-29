/**
 * Normalize serial for Firestore document IDs and uniqueness checks.
 * Uppercase, trim, collapse internal spaces.
 */
export function normalizeSerialId(raw) {
  if (raw == null || raw === '') return ''
  return String(raw)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}
