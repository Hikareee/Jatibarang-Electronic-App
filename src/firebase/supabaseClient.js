import { createClient } from '@supabase/supabase-js'

// Supabase is optional in this project.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
const SIGN_UPLOAD_URL = import.meta.env.VITE_SIGN_UPLOAD_URL || '/api/sign-upload'

export const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

function createNoopBuilder() {
  const response = { data: [], error: null }
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve) => Promise.resolve(response).then(resolve),
    catch: () => builder,
  }
  return builder
}

function createNoopStorage() {
  return {
    from: () => ({
      uploadToSignedUrl: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  }
}

function createNoopSupabase() {
  return {
    from: () => createNoopBuilder(),
    storage: createNoopStorage(),
  }
}

export const supabase = isSupabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createNoopSupabase()

function sanitizeName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_')
}

async function signedUpload(file, bucket, prefix) {
  if (!file) throw new Error('No file provided')
  const bucketId = (bucket || 'AttachmentInvoice').toString().trim()
  if (!bucketId) throw new Error('Bucket is required')

  // If Supabase credentials are intentionally absent, keep app usable.
  if (!isSupabaseEnabled) {
    const safeName = sanitizeName(file.name)
    const localUrl = URL.createObjectURL(file)
    return {
      name: file.name || safeName,
      url: localUrl,
      path: `local-temp/${prefix}/${Date.now()}-${safeName}`,
      size: file.size || 0,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      provider: 'local-temp',
    }
  }

  const safeName = sanitizeName(file.name)
  const path = `${prefix}/${Date.now()}-${safeName}`

  // Ask the server (Vercel or Supabase Edge) to mint a signed upload URL
  const resp = await fetch(SIGN_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: bucketId, prefix, filename: safeName })
  })
  const payload = await resp.json().catch(() => ({}))
  if (!resp.ok || payload?.error) {
    throw new Error(payload?.error || `Failed to obtain signed upload URL (${resp.status})`)
  }

  const token = payload.token
  const signedPath = payload.path || path
  const { error: upErr } = await supabase.storage.from(bucketId).uploadToSignedUrl(signedPath, token, file)
  if (upErr) throw upErr

  const { data: pub } = supabase.storage.from(bucketId).getPublicUrl(signedPath)
  const url = pub?.publicUrl || ''

  return {
    name: file.name || safeName,
    url,
    path: signedPath,
    size: file.size || 0,
    type: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }
}

// Deprecated: direct upload (kept for fallback only)
async function uploadInternal(file, bucket, prefix) {
  return signedUpload(file, bucket, prefix)
}

// Generic bucket upload helper (uses signed upload)
export async function uploadToBucket(file, { bucket, prefix }) {
  const pfx = prefix || 'uploads'
  return signedUpload(file, bucket, pfx)
}

// Upload proof of payment to 'payments' bucket under invoiceId folder (uses signed upload)
export async function uploadPaymentProof(file, invoiceId, bucket = 'payments') {
  const prefix = `${invoiceId}`
  return signedUpload(file, bucket, prefix)
}

// Upload invoice attachments to 'AttachmentInvoice' under invoices/{invoiceId} or invoices-draft (uses signed upload)
export async function uploadInvoiceAttachment(file, invoiceId, bucket = 'AttachmentInvoice') {
  const prefix = invoiceId ? `invoices/${invoiceId}` : 'invoices-draft'
  return signedUpload(file, bucket, prefix)
}

// Expense (biaya) images: same bucket, prefix biaya/{expenseId} or biaya-draft before the doc exists
export async function uploadExpenseAttachment(file, expenseId, bucket = 'AttachmentInvoice') {
  const prefix = expenseId ? `biaya/${expenseId}` : 'biaya-draft'
  return signedUpload(file, bucket, prefix)
}
