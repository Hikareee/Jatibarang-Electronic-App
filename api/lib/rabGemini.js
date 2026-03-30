/**
 * Server-only Gemini helper for Vercel / Node.
 * @param {unknown} baseResult
 * @returns {Promise<{ adjusted_total: number, breakdown: Array<{ name: string, estimated_cost: number }>, notes: string }>}
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function aiEstimateRAB(baseResult) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a senior construction cost estimator in Indonesia.

Rules:
- Use realistic Indonesian market pricing context
- Include waste factor (5–10%) where appropriate
- Mention hidden costs (transport, tools, inefficiency) in reasoning
- Avoid underestimation; be prudent

Given this base RAB (deterministic engine output):
${JSON.stringify(baseResult, null, 2)}

Return ONLY valid JSON with this exact shape (no markdown, no code fences):
{
  "adjusted_total": <number>,
  "breakdown": [
    { "name": "<string>", "estimated_cost": <number> }
  ],
  "notes": "<string, concise explanation in Indonesian>"
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return parseAiRabJson(text)
}

/**
 * @param {string} text
 */
export function parseAiRabJson(text) {
  let t = String(text || '').trim()
  if (!t) throw new Error('AI returned empty response')

  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    t = t.trim()
  }

  const parsed = JSON.parse(t)

  if (typeof parsed.adjusted_total !== 'number' || Number.isNaN(parsed.adjusted_total)) {
    throw new Error('AI JSON missing adjusted_total')
  }
  if (!Array.isArray(parsed.breakdown)) {
    throw new Error('AI JSON missing breakdown array')
  }
  if (typeof parsed.notes !== 'string') {
    parsed.notes = ''
  }

  return {
    adjusted_total: parsed.adjusted_total,
    breakdown: parsed.breakdown.map((row) => ({
      name: String(row?.name ?? ''),
      estimated_cost: Number(row?.estimated_cost) || 0,
    })),
    notes: parsed.notes,
  }
}
