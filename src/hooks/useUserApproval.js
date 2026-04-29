import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

const ALLOWED_ROLES = ['owner', 'manager', 'admin', 'employee']

/**
 * Map Firestore `role` strings to canonical values (`owner`, …).
 * Fixes strict Route checks failing on "Owner ", "MANAGER", fullwidth Unicode, etc.
 */
export function canonicalRole(raw) {
  if (raw == null) return 'employee'

  let s =
    typeof raw === 'string'
      ? raw.normalize('NFKC').trim().toLowerCase()
      : String(raw).trim().toLowerCase()

  // Strip zero-width spaces and common invisible chars
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')

  if (!s) return 'employee'
  if (ALLOWED_ROLES.includes(s)) return s

  const noSpace = s.replace(/\s+/g, '')
  if (ALLOWED_ROLES.includes(noSpace)) return noSpace

  const aliasMap = {
    superadmin: 'owner',
    super_admin: 'owner',
    administrator: 'admin',
    staff: 'employee',
    kasir: 'employee',
    sales: 'employee',
    finance: 'manager',
  }
  if (aliasMap[noSpace]) return aliasMap[noSpace]

  return 'employee'
}

export function useUserApproval() {
  const { currentUser } = useAuth()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const data = userSnap.data()
          setUserData({
            id: userSnap.id,
            ...data,
            role: canonicalRole(data.role),
          })
        } else {
          // SECURITY: Do NOT auto-create/auto-approve roles on the client.
          // If the user has no Firestore user doc, treat as unapproved.
          setUserData({
            id: currentUser.uid,
            email: currentUser.email,
            role: 'employee',
            approved: false,
          })
        }
      } catch (err) {
        console.error('useUserApproval: Error fetching user data:', err)
        setError(err?.message || String(err))
        // SECURITY: On error, do not grant access implicitly.
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [currentUser])

  const roleNormalized = canonicalRole(userData?.role)

  const isApproved = () => {
    return userData?.approved === true
  }

  const canApprove = () => {
    return ['owner', 'manager', 'admin'].includes(roleNormalized)
  }

  const canEditApproved = () => {
    return roleNormalized === 'owner' || roleNormalized === 'admin'
  }

  return {
    userData,
    loading,
    error,
    isApproved: isApproved(),
    canApprove: canApprove(),
    canEditApproved: canEditApproved(),
    role: roleNormalized,
  }
}
