import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Basic CORS helper
const cors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
}

function sanitizeName(name: string) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok')
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  try {
    const { bucket = 'AttachmentInvoice', prefix = 'invoices-draft', filename = 'file' } = (req.body || {})
    const safeBucket = String(bucket).trim()
    const safePrefix = String(prefix).trim()
    const safeName = sanitizeName(String(filename))
    if (!safeBucket) return res.status(400).json({ error: 'bucket is required' })

    const path = `${safePrefix}/${Date.now()}-${safeName}`

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data, error } = await admin.storage.from(safeBucket).createSignedUploadUrl(path)

    if (error) {
      return res.status(500).json({ error: error.message || String(error) })
    }

    return res.status(200).json({ bucket: safeBucket, path, token: data?.token || null })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
