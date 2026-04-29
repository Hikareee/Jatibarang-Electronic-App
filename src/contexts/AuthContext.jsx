import { createContext, useContext, useState, useEffect } from 'react'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const autoProvisionUserDoc =
    String(import.meta.env.VITE_AUTH_AUTO_PROVISION_USER_DOC || 'false').toLowerCase() ===
    'true'

  async function ensureUserDoc(user) {
    if (!user?.uid) return
    if (!autoProvisionUserDoc) return
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email || '',
        role: 'employee',
        approved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await ensureUserDoc(result.user)
    return result
  }

  function logout() {
    return signOut(auth)
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider).then(async (result) => {
      await ensureUserDoc(result.user)
      return result
    })
  }

  async function register(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    await ensureUserDoc(userCredential.user)
    return userCredential
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          await ensureUserDoc(user)
        } catch (err) {
          console.error('AuthProvider: failed ensuring Firestore user doc:', err)
        }
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    currentUser,
    login,
    logout,
    resetPassword,
    loginWithGoogle,
    register
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

