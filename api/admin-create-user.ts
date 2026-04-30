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

function emailForUsername(username: string) {
  const trimmed = String(username || '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('@')) return trimmed
  const domain = String(process.env.EMPLOYEE_EMAIL_DOMAIN || 'pos.local').trim() || 'pos.local'
  const safeUser = trimmed.toLowerCase().replace(/[^\w.\-]+/g, '.').replace(/^\.+|\.+$/g, '')
  return `${safeUser}@${domain}`
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

    const gate = await gateRequester(
      adminAuth,
      adminDb,
      { uid: decoded.uid, email: decoded.email },
      ['owner']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const body = (req.body || {}) as any
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    const role = canonicalRole(body.role)

    if (!username) return res.status(400).json({ error: 'username is required' })
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'password must be at least 6 characters' })

    const email = emailForUsername(username)
    if (!email) return res.status(400).json({ error: 'Invalid username/email' })

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: username,
      disabled: false,
    })

    const nowIso = new Date().toISOString()
    await adminDb
      .collection('users')
      .doc(userRecord.uid)
      .set(
        {
          email,
          username,
          role,
          approved: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          approvedAt: nowIso,
          createdByUid: decoded.uid,
        },
        { merge: true }
      )

    return res.status(200).json({
      uid: userRecord.uid,
      email,
      username,
      role,
    })
  } catch (e: any) {
    const msg = e?.message || String(e)
    const code = String(e?.code || '')
    if (code.includes('auth/email-already-exists')) {
      return res.status(409).json({ error: 'Email already exists' })
    }
    return res.status(500).json({ error: msg })
  }
}

