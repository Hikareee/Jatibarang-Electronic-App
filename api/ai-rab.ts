import type { VercelRequest, VercelResponse } from '@vercel/node'
import { aiEstimateRAB } from './gemini.js'

const cors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok')
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const baseResult = body.baseResult

    if (baseResult === undefined || baseResult === null) {
      return res.status(400).json({ error: 'baseResult is required' })
    }

    const enhanced = await aiEstimateRAB(baseResult)
    return res.status(200).json({ ok: true, data: enhanced })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[ai-rab]', message)
    return res.status(500).json({ ok: false, error: message })
  }
}
