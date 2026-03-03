// Supabase Edge Function: sign-upload
// Issues a short-lived signed upload token for Storage using the service role key.
// Frontend can then use uploadToSignedUrl() with the returned token to upload directly
// without exposing the service role key.

// Using Deno.serve eliminates the need for std/http URL imports
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not set")
}
if (!SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function sanitizeName(name: string) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const bucket = String(body.bucket || "AttachmentInvoice").trim()
    const prefix = String(body.prefix || "invoices-draft").trim()
    const filename = sanitizeName(String(body.filename || "file"))
    const upsert = Boolean(body.upsert || false) // reserved for future use; upload token currently doesn't accept upsert option
    const expiresIn = Number(body.expiresIn || 60) // reserved for future use; SDK sets a default TTL for upload tokens

    if (!bucket) {
      return new Response(JSON.stringify({ error: "bucket is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const path = `${prefix}/${Date.now()}-${filename}`

    // Create a signed upload URL (SDK uses a default TTL).
    // Note: createSignedUploadUrl currently doesn't accept expiresIn/upsert params.
    const { data, error } = await admin
      .storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (error) {
      return new Response(JSON.stringify({ error: error.message || String(error) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Return token + path; client will call uploadToSignedUrl(path, token, file)
    return new Response(
      JSON.stringify({ bucket, path, token: data?.token || null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
