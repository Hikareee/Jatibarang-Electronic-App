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

/**
 * Gate admin endpoints based on `users/{uid}.role`.
 * Bootstrap escape hatch with env:
 * - BOOTSTRAP_OWNER_UID or BOOTSTRAP_OWNER_EMAIL
 */
export async function gateRequester(adminAuth, adminDb, decoded, allowedRoles) {
  const requesterRef = adminDb.collection('users').doc(decoded.uid)
  const requesterSnap = await requesterRef.get()
  const role = canonicalRole(requesterSnap.exists ? requesterSnap.data()?.role : '')

  if (requesterSnap.exists && allowedRoles.includes(role)) {
    return { ok: true, role, bootstrap: false }
  }

  const bootstrapUid = String(process.env.BOOTSTRAP_OWNER_UID || '').trim()
  const bootstrapEmail = String(process.env.BOOTSTRAP_OWNER_EMAIL || '').trim().toLowerCase()
  const requesterEmail = String(decoded.email || '').trim().toLowerCase()

  const isBootstrap =
    (!!bootstrapUid && decoded.uid === bootstrapUid) ||
    (!!bootstrapEmail && requesterEmail && requesterEmail === bootstrapEmail)

  if (!isBootstrap) return { ok: false, status: 403, error: 'Not authorized' }

  // Auto-bootstrap owner doc for future calls
  const nowIso = new Date().toISOString()
  const user = await adminAuth.getUser(decoded.uid).catch(() => null)
  await requesterRef.set(
    {
      email: user?.email || decoded.email || requesterEmail || '',
      username: user?.displayName || '',
      role: 'owner',
      approved: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      approvedAt: nowIso,
      bootstrapped: true,
    },
    { merge: true }
  )

  if (!allowedRoles.includes('owner')) return { ok: false, status: 403, error: 'Not authorized' }
  return { ok: true, role: 'owner', bootstrap: true }
}

