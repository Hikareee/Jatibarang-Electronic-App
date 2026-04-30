import express from 'express'
import cors from 'cors'
import { getAdminAuth, getAdminDb } from './firebaseAdmin.mjs'
import { gateRequester } from './adminGate.mjs'

function canonicalRole(raw) {
  const s = String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
  if (!s) return 'employee'
  if (s === 'owner' || s === 'admin' || s === 'manager' || s === 'employee') return s
  return 'employee'
}

async function requireDecoded(req) {
  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
  if (!token) {
    const err = new Error('Missing Authorization Bearer token')
    err.status = 401
    throw err
  }
  const adminAuth = getAdminAuth()
  return adminAuth.verifyIdToken(token)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/admin-list-users', async (req, res) => {
  try {
    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()
    const decoded = await requireDecoded(req)

    const gate = await gateRequester(
      adminAuth,
      adminDb,
      { uid: decoded.uid, email: decoded.email },
      ['owner', 'admin', 'manager']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const list = await adminAuth.listUsers(1000)
    const authUsers = list.users

    const docRefs = authUsers.map((u) => adminDb.collection('users').doc(u.uid))
    const docSnaps = docRefs.length > 0 ? await adminDb.getAll(...docRefs) : []
    const byUid = new Map()
    docSnaps.forEach((s) => byUid.set(s.id, s))

    const users = authUsers.map((u) => {
      const docSnap = byUid.get(u.uid)
      const docData = docSnap?.exists ? docSnap.data() : null

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

    res.json({ users })
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || String(e) })
  }
})

app.post('/api/admin-approve-user', async (req, res) => {
  try {
    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()
    const decoded = await requireDecoded(req)

    const gate = await gateRequester(
      adminAuth,
      adminDb,
      { uid: decoded.uid, email: decoded.email },
      ['owner', 'admin', 'manager']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const uid = String(req.body?.uid || req.body?.userId || '').trim()
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
          approved: true,
          approvedAt: nowIso,
          updatedAt: nowIso,
          approvedByUid: decoded.uid,
        },
        { merge: true }
      )

    res.json({ ok: true })
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || String(e) })
  }
})

app.post('/api/admin-set-user-role', async (req, res) => {
  try {
    const adminAuth = getAdminAuth()
    const adminDb = getAdminDb()
    const decoded = await requireDecoded(req)

    const gate = await gateRequester(
      adminAuth,
      adminDb,
      { uid: decoded.uid, email: decoded.email },
      ['owner']
    )
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const uid = String(req.body?.uid || req.body?.userId || '').trim()
    const role = canonicalRole(req.body?.role)
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

    res.json({ ok: true })
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || String(e) })
  }
})

const port = Number(process.env.DEV_API_PORT || 3000)
app.listen(port, () => {
  console.log(`[dev-api] listening on http://127.0.0.1:${port}`)
})

