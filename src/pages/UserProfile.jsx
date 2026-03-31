import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase/config'
import { Save, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UserProfile() {
  const { currentUser } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [displayName, setDisplayName] = useState('')
  const [notes, setNotes] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const userRef = doc(db, 'users', currentUser.uid)
        const snap = await getDoc(userRef)
        if (!alive) return
        if (snap.exists()) {
          const data = snap.data() || {}
          setDisplayName(data.displayName || '')
          setNotes(data.profileNotes || '')
        } else {
          setDisplayName(currentUser.email || '')
        }
      } catch (e) {
        console.error(e)
        if (alive) setError('Gagal memuat profil pengguna.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [currentUser])

  const handleSave = async () => {
    if (!currentUser) return
    try {
      setSaving(true)
      setError(null)
      const userRef = doc(db, 'users', currentUser.uid)
      await setDoc(
        userRef,
        {
          email: currentUser.email || null,
          displayName: displayName.trim(),
          profileNotes: notes,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      navigate('/dashboard')
    } catch (e) {
      console.error(e)
      setError('Gagal menyimpan profil.')
    } finally {
      setSaving(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">Tidak ada pengguna yang sedang login.</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Beranda &gt; Profil Pengguna
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Profil Pengguna</h1>

            {loading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
                <p className="text-gray-600 dark:text-gray-400">Memuat data profil…</p>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {displayName || currentUser.email || 'User'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Informasi pribadi
                      </h3>
                    </div>

                    {error && (
                      <div className="p-3 rounded bg-red-50 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
                          Email
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {currentUser.email || '-'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                          Username / Nama tampilan
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Masukkan username yang ingin ditampilkan"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Informasi tambahan
                      </h3>
                    </div>
                    <textarea
                      rows={7}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catat informasi apa pun tentang diri Anda, role, preferensi, atau catatan lain."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    <Save className="h-5 w-5" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

