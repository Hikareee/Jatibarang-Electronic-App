import { useState, useEffect } from 'react'
import { auth } from '../firebase/config'
import { canonicalRole } from './useUserApproval'

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

  async function fetchUsersViaAdminApi() {
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) return { ok: false, status: 401, error: 'Not authenticated' }

      const resp = await fetch('/api/admin-list-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        return {
          ok: false,
          status: resp.status,
          error: data?.error || `Failed to list users (${resp.status})`,
        }
      }

      const rows = Array.isArray(data?.users) ? data.users : []
      return { ok: true, users: rows }
    } catch (e) {
      // Network / dev environment without Vercel API runtime.
      return { ok: false, status: 0, error: e?.message || String(e) }
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Prefer admin API (works even if Firestore rules block collection listing).
      const apiResult = await fetchUsersViaAdminApi()
      if (apiResult.ok) {
        const normalized = apiResult.users.map((u) =>
          normalizeUserShape(u, u?.id || '', 'users')
        )
        const dedup = new Map()
        normalized.forEach((u) => {
          if (!dedup.has(u.id)) dedup.set(u.id, u)
        })
        const usersData = Array.from(dedup.values()).sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        )
        setUsers(usersData)
        return
      }

      // No Firestore client fallback here because many deployments correctly deny
      // listing/patching `users` from the browser. Surface API errors instead.
      if (apiResult.status === 0) {
        setError(
          'Tidak bisa mengakses API /api/admin-list-users. Jalankan backend API (misalnya `npx vercel dev`) atau deploy ulang agar endpoint tersedia.'
        )
      } else {
        setError(apiResult.error)
      }
      setUsers([])
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
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) throw new Error('Not authenticated')

      const resp = await fetch('/api/admin-set-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: userId, role: canonicalRole(role) }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to update role')
      
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
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) throw new Error('Not authenticated')

      const resp = await fetch('/api/admin-approve-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: userId }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error || 'Failed to approve user')
      
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

  const createUserWithUsernamePassword = async ({ username, password, role }) => {
    const token = await auth.currentUser?.getIdToken?.()
    if (!token) throw new Error('Not authenticated')

    const resp = await fetch('/api/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username,
        password,
        role: canonicalRole(role),
      }),
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      throw new Error(data?.error || 'Failed to create user')
    }

    await fetchUsers()
    return data
  }

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    updateUserRole,
    approveUser,
    createUserWithUsernamePassword,
  }
}

