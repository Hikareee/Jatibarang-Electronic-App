import { useState, useEffect } from 'react'
import { collection, getDocs, query, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { canonicalRole } from './useUserApproval'

function usersCollectionCandidates() {
  const fromEnv = String(import.meta.env.VITE_FIRESTORE_USERS_COLLECTIONS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const defaults = ['users', 'userProfiles', 'profiles']
  return [...new Set([...fromEnv, ...defaults])]
}

function normalizeUserShape(row = {}, id = '', sourceCollection = 'users') {
  const email = String(row.email || row.userEmail || row.mail || '').trim()
  const name =
    String(row.name || row.displayName || row.fullName || row.username || '').trim()
  const createdAt = row.createdAt || row.created_at || row.joinedAt || ''
  const approvedRaw =
    row.approved ??
    row.isApproved ??
    row.active ??
    (row.status ? String(row.status).toLowerCase() === 'approved' : undefined)
  const approved = approvedRaw === true
  return {
    id,
    ...row,
    email,
    name,
    role: canonicalRole(row.role),
    approved,
    createdAt,
    _sourceCollection: sourceCollection,
  }
}

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const collections = usersCollectionCandidates()
      const perCollection = await Promise.all(
        collections.map(async (col) => {
          try {
            const snap = await getDocs(query(collection(db, col)))
            return snap.docs.map((docSnap) =>
              normalizeUserShape(docSnap.data(), docSnap.id, col)
            )
          } catch {
            return []
          }
        })
      )
      const merged = perCollection.flat()
      const dedup = new Map()
      merged.forEach((u) => {
        if (!dedup.has(u.id)) dedup.set(u.id, u)
      })
      const usersData = Array.from(dedup.values()).sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      )

      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const updateUserRole = async (userId, role) => {
    try {
      const current =
        users.find((u) => u.id === userId) || ({ _sourceCollection: 'users' })
      const userRef = doc(db, current._sourceCollection || 'users', userId)
      await updateDoc(userRef, {
        role: canonicalRole(role),
        approved: true,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? {
                ...user,
                role: canonicalRole(role),
                approved: true,
                approvedAt: new Date().toISOString(),
              }
            : user
        )
      )
      
      return true
    } catch (err) {
      console.error('Error updating user role:', err)
      throw err
    }
  }

  const approveUser = async (userId) => {
    try {
      const current =
        users.find((u) => u.id === userId) || ({ _sourceCollection: 'users' })
      const userRef = doc(db, current._sourceCollection || 'users', userId)
      await updateDoc(userRef, {
        approved: true,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, approved: true, approvedAt: new Date().toISOString() }
            : user
        )
      )
      
      return true
    } catch (err) {
      console.error('Error approving user:', err)
      throw err
    }
  }

  return { users, loading, error, refetch: fetchUsers, updateUserRole, approveUser }
}

