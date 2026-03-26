/**
 * One-time SKU renumbering script for Firestore `products`.
 *
 * - Orders products by "createdAt" ascending (oldest first).
 * - Sets `kode` to sequential "SKU/00001", "SKU/00002", ...
 * - DRY RUN by default. Use `--apply` to actually write.
 *
 * Auth (choose one):
 * - Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path
 * - OR set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON contents (string)
 *
 * Optional:
 * - FIREBASE_PROJECT_ID (if not included in service account)
 * - SKU_PREFIX (default: "SKU/")
 * - SKU_PAD (default: 5)
 * - LIMIT (for testing, e.g. "50")
 *
 * Usage:
 *   node scripts/fix-product-skus.mjs                 # dry run
 *   node scripts/fix-product-skus.mjs --apply        # apply changes
 *   LIMIT=20 node scripts/fix-product-skus.mjs       # dry run first 20
 */

import admin from 'firebase-admin'

function parseArgs(argv) {
  const out = { apply: false }
  for (const a of argv.slice(2)) {
    if (a === '--apply') out.apply = true
  }
  return out
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
}

function ensureAdminInitialized() {
  if (admin.apps?.length) return

  const serviceAccount = getServiceAccount()
  if (serviceAccount) {
    const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
    if (!projectId) {
      throw new Error(
        'Missing project id. Set FIREBASE_PROJECT_ID or include "project_id" in your service account JSON.'
      )
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
    return
  }

  // Fallback: GOOGLE_APPLICATION_CREDENTIALS
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      [
        'Missing credentials for Firebase Admin.',
        '',
        'Set ONE of these:',
        '- GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json',
        '- FIREBASE_SERVICE_ACCOUNT_JSON=\'{...json...}\'',
        '',
        'And (if needed) set:',
        '- FIREBASE_PROJECT_ID=your-project-id',
      ].join('\n')
    )
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}

function padSku(n, width) {
  const s = String(n)
  const w = Math.max(width, s.length)
  return s.padStart(w, '0')
}

function toIso(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  // JS Date
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

async function main() {
  const { apply } = parseArgs(process.argv)
  const prefix = (process.env.SKU_PREFIX || 'SKU/').toString()
  const pad = Number(process.env.SKU_PAD || 5)
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : null

  try {
    ensureAdminInitialized()
  } catch (e) {
    console.error(String(e?.message || e))
    console.error('\nUsage:')
    console.error('  npm run fix:skus                # dry run')
    console.error('  npm run fix:skus -- --apply     # apply changes')
    process.exit(1)
  }
  const db = admin.firestore()

  let q = db.collection('products').orderBy('createdAt', 'asc')
  if (Number.isFinite(limit) && limit > 0) q = q.limit(limit)

  const snap = await q.get()
  const docs = snap.docs

  if (!docs.length) {
    console.log('No products found.')
    return
  }

  const updates = []

  for (let i = 0; i < docs.length; i++) {
    const docSnap = docs[i]
    const data = docSnap.data() || {}
    const desired = `${prefix}${padSku(i + 1, pad)}`
    const current = String(data.kode || '').trim()
    const createdAt = toIso(data.createdAt) || toIso(data.updatedAt)
    const name = data.nama || data.name || ''

    if (current !== desired) {
      updates.push({
        id: docSnap.id,
        ref: docSnap.ref,
        from: current,
        to: desired,
        createdAt,
        name,
      })
    }
  }

  console.log(`Products scanned: ${docs.length}`)
  console.log(`Changes needed: ${updates.length}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`)
  console.log('')

  // Print preview (first 50)
  for (const u of updates.slice(0, 50)) {
    console.log(`${u.createdAt || '-'} | ${u.id} | ${u.name || '-'} | ${u.from || '(empty)'} -> ${u.to}`)
  }
  if (updates.length > 50) console.log(`...and ${updates.length - 50} more`)

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to write changes.')
    return
  }

  // Batch write in chunks of 450 to stay under limits
  const chunkSize = 450
  let written = 0

  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const batch = db.batch()
    for (const u of chunk) {
      batch.update(u.ref, {
        kode: u.to,
        updatedAt: new Date().toISOString(),
      })
    }
    await batch.commit()
    written += chunk.length
    console.log(`Committed ${written}/${updates.length}`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

