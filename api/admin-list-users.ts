import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAdminAuth, getAdminDb } from './lib/firebaseAdmin'
import { gateRequester } from './lib/adminGate'

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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
      ['owner', 'admin', 'manager']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    // Source of truth for "who exists" is Firebase Auth.
    // Firestore `users/{uid}` may not exist yet if auto-provision is disabled.
    const list = await adminAuth.listUsers(1000)
    const authUsers = list.users

    const docRefs = authUsers.map((u) => adminDb.collection('users').doc(u.uid))
    const docSnaps = docRefs.length > 0 ? await adminDb.getAll(...docRefs) : []
    const byUid = new Map<string, FirebaseFirestore.DocumentSnapshot>()
    docSnaps.forEach((s) => byUid.set(s.id, s))

    const users = authUsers.map((u) => {
      const docSnap = byUid.get(u.uid)
      const docData = docSnap?.exists ? docSnap.data() : null

      // Convert Firebase Auth creationTime to ISO if present.
      const createdAt =
        typeof u?.metadata?.creationTime === 'string'
          ? new Date(u.metadata.creationTime).toISOString()
          : ''

      return {
        id: u.uid,
        uid: u.uid,
        email: u.email || docData?.email || '',
        username: docData?.username || u.displayName || '',
        role: canonicalRole(docData?.role),
        approved: docData?.approved === true,
        createdAt: docData?.createdAt || createdAt,
        approvedAt: docData?.approvedAt || '',
        updatedAt: docData?.updatedAt || '',
        _hasUserDoc: Boolean(docSnap?.exists),
      }
    })

    return res.status(200).json({ users })
  } catch (e: any) {
    const msg = e?.message || String(e)
    return res.status(500).json({ error: msg })
  }
}

