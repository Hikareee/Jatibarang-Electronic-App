import { createClient } from '@supabase/supabase-js'

// Prefer env vars; fallback to provided constants if not set
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://idkznzsdqkqlopnltmac.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlka3puenNkcWtxbG9wbmx0bWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MjAwNzksImV4cCI6MjA4Nzk5NjA3OX0.Jy-lVOZQCtJ3xEw7oy3-fwVFNmvomLd1e7bunChxwOQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function sanitizeName(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_')
}

async function uploadInternal(file, bucket, prefix) {
  if (!file) throw new Error('No file provided')
  const bucketId = (bucket || 'AttachmentInvoice').toString().trim()
  if (!bucketId) throw new Error('Bucket is required')

  const safeName = sanitizeName(file.name)
  const path = `${prefix}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

  const { data: pub } = supabase.storage.from(bucketId).getPublicUrl(path)
  const url = pub?.publicUrl || ''

  return {
    name: file.name || safeName,
    url,
    path,
    size: file.size || 0,
    type: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }
}

// Generic bucket upload helper
export async function uploadToBucket(file, { bucket, prefix }) {
  const pfx = prefix || 'uploads'
  return uploadInternal(file, bucket, pfx)
}

// Upload proof of payment to 'payments' bucket under invoiceId folder
export async function uploadPaymentProof(file, invoiceId, bucket = 'payments') {
  const prefix = `${invoiceId}`
  return uploadInternal(file, bucket, prefix)
}

// Upload invoice attachments to 'attachments' bucket under invoices/{invoiceId} or invoices-draft
export async function uploadInvoiceAttachment(file, invoiceId, bucket = 'AttachmentInvoice') {
  const prefix = invoiceId ? `invoices/${invoiceId}` : 'invoices-draft'
  return uploadInternal(file, bucket, prefix)
}
