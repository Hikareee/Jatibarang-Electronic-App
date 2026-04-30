import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAdminAuth, getAdminDb } from './lib/firebaseAdmin'
import { gateRequester } from './lib/adminGate'

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
}

function canonicalRole(raw: unknown) {
  const s = String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
  if (!s) return 'employee'
  if (s === 'owner' || s === 'admin' || s === 'manager' || s === 'employee') return s
  return 'employee'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)

  if (req.method === 'OPTIONS') return res.status(200).send('ok')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = String(req.headers.authorization || '')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' })

    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()
    const decoded = await adminAuth.verifyIdToken(token)

    // Role changes are owner-only
    const gate = await gateRequester(
      adminAuth,
      adminDb,
      { uid: decoded.uid, email: decoded.email },
      ['owner']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const body = (req.body || {}) as any
    const uid = String(body.uid || body.userId || '').trim()
    const role = canonicalRole(body.role)
    if (!uid) return res.status(400).json({ error: 'uid is required' })

    const nowIso = new Date().toISOString()
    const authUser = await adminAuth.getUser(uid).catch(() => null)

    await adminDb
      .collection('users')
      .doc(uid)
      .set(
        {
          email: authUser?.email || '',
          username: authUser?.displayName || '',
          role,
          approved: true,
          approvedAt: nowIso,
          updatedAt: nowIso,
          roleUpdatedByUid: decoded.uid,
        },
        { merge: true }
      )

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    const msg = e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}

