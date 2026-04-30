import admin from 'firebase-admin'

function normalizePrivateKey(raw) {
  return String(raw || '').replace(/\\n/g, '\n')
}

function getCertFromEnv() {
  const json = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (parsed?.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key)
      return parsed
    } catch {
      // ignore and fall through to split env vars
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) return null
  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
  }
}

export function getAdminApp() {
  if (admin.apps?.length) return admin.app()
  const cert = getCertFromEnv()
  if (!cert) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_CREDENTIALS_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
    )
  }
  return admin.initializeApp({
    credential: admin.credential.cert(cert),
  })
}

export function getAdminAuth() {
  getAdminApp()
  return admin.auth()
}

export function getAdminDb() {
  getAdminApp()
  return admin.firestore()
}

