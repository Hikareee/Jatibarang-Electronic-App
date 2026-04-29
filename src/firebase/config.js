import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const legacyFallbackConfig = {
  apiKey: 'AIzaSyBXCNHjj1NesInaypTb6a-ykb3zPVNgCLg',
  authDomain: 'poselectronic-8e9a1.firebaseapp.com',
  projectId: 'poselectronic-8e9a1',
  storageBucket: 'poselectronic-8e9a1.firebasestorage.app',
  messagingSenderId: '746358751423',
  appId: '1:746358751423:web:35da37b1296e22f61e460a',
  measurementId: 'G-B4139RPCMX',
}

const firebaseConfig = {
  apiKey: String(
    import.meta.env.VITE_FIREBASE_API_KEY || legacyFallbackConfig.apiKey
  ),
  authDomain: String(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || legacyFallbackConfig.authDomain
  ),
  projectId: String(
    import.meta.env.VITE_FIREBASE_PROJECT_ID || legacyFallbackConfig.projectId
  ),
  storageBucket: String(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || legacyFallbackConfig.storageBucket
  ),
  messagingSenderId: String(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      legacyFallbackConfig.messagingSenderId
  ),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || legacyFallbackConfig.appId),
  measurementId: String(
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
      legacyFallbackConfig.measurementId
  ),
}

const missingRequired = ['apiKey', 'authDomain', 'projectId', 'appId'].filter(
  (k) => !firebaseConfig[k]
)
if (missingRequired.length > 0) {
  console.error(
    `[Firebase] Missing required env keys: ${missingRequired.join(
      ', '
    )}. Set VITE_FIREBASE_* in your environment.`
  )
}

const app = initializeApp(firebaseConfig)
if (import.meta.env.DEV) {
  console.info('[Firebase] Connected project:', firebaseConfig.projectId || '(unset)')
}

export const analytics =
  typeof window !== 'undefined' && firebaseConfig.measurementId
    ? getAnalytics(app)
    : null
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app

