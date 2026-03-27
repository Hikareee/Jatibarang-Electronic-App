import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true)
        setError(null)
        const ref = collection(db, 'projects')
        const q = query(ref, orderBy('name', 'asc'))
        const snap = await getDocs(q)
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError(err.message)
        setProjects([])
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  return { projects, loading, error }
}

