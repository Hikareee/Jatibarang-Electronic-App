/**
 * Resolve URL for POST /api/ai-rab (Vercel) or full URL from env.
 */
export function getAiRabUrl() {
  const base = import.meta.env.VITE_AI_RAB_BASE_URL || ''
  if (base) {
    return `${String(base).replace(/\/$/, '')}/api/ai-rab`
  }
  return '/api/ai-rab'
}

/**
 * @param {unknown} baseResult
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
export async function fetchAiRabEnhancement(baseResult) {
  const res = await fetch(getAiRabUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseResult }),
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok || payload.error) {
    return {
      ok: false,
      error: payload.error || `HTTP ${res.status}`,
    }
  }

  if (payload.ok && payload.data) {
    return { ok: true, data: payload.data }
  }

  return { ok: false, error: 'Invalid response' }
}
