import type { auth as AuthNS, firestore as FirestoreNS } from 'firebase-admin'

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

export type GateResult =
  | { ok: true; role: 'owner' | 'admin' | 'manager' | 'employee'; bootstrap: boolean }
  | { ok: false; status: number; error: string }

/**
 * Gate admin endpoints based on `users/{uid}.role`.
 *
 * Bootstrap escape hatch:
 * - If the requester doc doesn't exist yet, allow if requester uid/email matches
 *   `BOOTSTRAP_OWNER_UID` or `BOOTSTRAP_OWNER_EMAIL`, and (optionally) create
 *   an owner doc so subsequent calls work without env flags.
 */
export async function gateRequester(
  adminAuth: AuthNS.Auth,
  adminDb: FirestoreNS.Firestore,
  decoded: { uid: string; email?: string | null },
  allowedRoles: Array<'owner' | 'admin' | 'manager' | 'employee'>,
  opts?: { autoBootstrapOwnerDoc?: boolean }
): Promise<GateResult> {
  const requesterRef = adminDb.collection('users').doc(decoded.uid)
  const requesterSnap = await requesterRef.get()
  const role = canonicalRole(requesterSnap.exists ? requesterSnap.data()?.role : '')

  if (requesterSnap.exists && allowedRoles.includes(role as any)) {
    return { ok: true, role: role as any, bootstrap: false }
  }

  const bootstrapUid = String(process.env.BOOTSTRAP_OWNER_UID || '').trim()
  const bootstrapEmail = String(process.env.BOOTSTRAP_OWNER_EMAIL || '').trim().toLowerCase()
  const requesterEmail = String(decoded.email || '').trim().toLowerCase()

  const isBootstrap =
    (!!bootstrapUid && decoded.uid === bootstrapUid) ||
    (!!bootstrapEmail && requesterEmail && requesterEmail === bootstrapEmail)

  if (!isBootstrap) {
    return { ok: false, status: 403, error: 'Not authorized' }
  }

  if (opts?.autoBootstrapOwnerDoc !== false) {
    const nowIso = new Date().toISOString()
    // Use Auth record as best-effort identity source.
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
  }

  if (!allowedRoles.includes('owner')) {
    return { ok: false, status: 403, error: 'Not authorized' }
  }

  return { ok: true, role: 'owner', bootstrap: true }
}

