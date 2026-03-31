/**
 * Renumber Firestore `products` so every SKU is unique and sequential.
 *
 * - Loads ALL documents (no orderBy — avoids missing `createdAt` dropping rows).
 * - Sorts by `createdAt` → `updatedAt` → document id (stable).
 * - Assigns `SKU/00001`, `SKU/00002`, … (prefix & width configurable).
 * - Writes the same value to both `kode` and `sku` (app uses both).
 *
 * DRY RUN by default. Use `--apply` to write.
 *
 * Auth (pick one):
 * - GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 * - FIREBASE_SERVICE_ACCOUNT_JSON='{...}'  (+ FIREBASE_PROJECT_ID if needed)
 *
 * Optional env:
 * - SKU_PREFIX (default SKU/)
 * - SKU_PAD (default 5)
 *
 * Usage:
 *   npm run fix:skus
 *   npm run fix:skus -- --apply
 */

import fs from 'node:fs'
import path from 'node:path'
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
  } catch {
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
        'Missing project id. Set FIREBASE_PROJECT_ID or include "project_id" in service account JSON.'
      )
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
    return
  }

  const jsonPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!jsonPath) {
    throw new Error(
      [
        'Missing credentials for Firebase Admin.',
        '',
        'Set ONE of:',
        '- GOOGLE_APPLICATION_CREDENTIALS=/Users/you/Downloads/your-project-firebase-adminsdk-xxxxx.json',
        '  (must be a real file path from Firebase Console → Project settings → Service accounts → Generate key)',
        '- FIREBASE_SERVICE_ACCOUNT_JSON=\'{"type":"service_account",...}\'',
        '',
        'If needed:',
        '- FIREBASE_PROJECT_ID=your-project-id',
      ].join('\n')
    )
  }

  const resolved = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(
      [
        `GOOGLE_APPLICATION_CREDENTIALS file not found (or not a file):`,
        `  "${jsonPath}"`,
        resolved !== jsonPath ? `  resolved: "${resolved}"` : '',
        '',
        'Do not use the placeholder path from the readme. Download a JSON key from Firebase and point to that file.',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved

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
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** ms for sort; missing → 0 */
function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : 0
  }
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  return 0
}

async function main() {
  const { apply } = parseArgs(process.argv)
  const prefix = (process.env.SKU_PREFIX || 'SKU/').toString()
  const pad = Number(process.env.SKU_PAD || 5)

  try {
    ensureAdminInitialized()
  } catch (e) {
    console.error(String(e?.message || e))
    console.error('\nUsage:')
    console.error('  npm run fix:skus           # dry run')
    console.error('  npm run fix:skus -- --apply')
    process.exit(1)
  }

  const db = admin.firestore()
  const snap = await db.collection('products').get()
  let docs = snap.docs

  docs = [...docs].sort((a, b) => {
    const da = a.data() || {}
    const db_ = b.data() || {}
    const ta = toMillis(da.createdAt) || toMillis(da.updatedAt)
    const tb = toMillis(db_.createdAt) || toMillis(db_.updatedAt)
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })

  if (!docs.length) {
    console.log('No products found.')
    return
  }

  const updates = []

  for (let i = 0; i < docs.length; i++) {
    const docSnap = docs[i]
    const data = docSnap.data() || {}
    const desired = `${prefix}${padSku(i + 1, pad)}`
    const currentKode = String(data.kode || '').trim()
    const currentSku = String(data.sku || '').trim()
    const createdAt = toIso(data.createdAt) || toIso(data.updatedAt)
    const name = data.nama || data.name || ''

    const needsKode = currentKode !== desired
    const needsSku = currentSku !== desired

    if (needsKode || needsSku) {
      updates.push({
        id: docSnap.id,
        ref: docSnap.ref,
        from: currentKode || currentSku || '(empty)',
        to: desired,
        createdAt,
        name,
      })
    }
  }

  console.log(`Products scanned: ${docs.length}`)
  console.log(`Changes needed: ${updates.length} (kode/sku out of sequence or duplicate)`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`)
  console.log('')

  for (const u of updates.slice(0, 50)) {
    console.log(`${u.createdAt || '-'} | ${u.id} | ${u.name || '-'} | ${u.from} -> ${u.to}`)
  }
  if (updates.length > 50) console.log(`...and ${updates.length - 50} more`)

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to write changes.')
    return
  }

  const chunkSize = 450
  let written = 0
  const nowIso = new Date().toISOString()

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize)
    const batch = db.batch()
    for (let j = 0; j < chunk.length; j++) {
      const docSnap = chunk[j]
      const globalIndex = i + j
      const desired = `${prefix}${padSku(globalIndex + 1, pad)}`
      batch.update(docSnap.ref, {
        kode: desired,
        sku: desired,
        updatedAt: nowIso,
      })
    }
    await batch.commit()
    written += chunk.length
    console.log(`Committed ${written}/${docs.length}`)
  }

  console.log('Done. All products now have unique sequential kode + sku.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
