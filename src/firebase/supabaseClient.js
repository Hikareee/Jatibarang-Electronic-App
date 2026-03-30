import { createClient } from '@supabase/supabase-js'

// Prefer env vars; fallback to provided constants if not set
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://idkznzsdqkqlopnltmac.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlka3puenNkcWtxbG9wbmx0bWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MjAwNzksImV4cCI6MjA4Nzk5NjA3OX0.Jy-lVOZQCtJ3xEw7oy3-fwVFNmvomLd1e7bunChxwOQ'
const SIGN_UPLOAD_URL = import.meta.env.VITE_SIGN_UPLOAD_URL || '/api/sign-upload'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function sanitizeName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_')
}

async function signedUpload(file, bucket, prefix) {
  if (!file) throw new Error('No file provided')
  const bucketId = (bucket || 'AttachmentInvoice').toString().trim()
  if (!bucketId) throw new Error('Bucket is required')

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
