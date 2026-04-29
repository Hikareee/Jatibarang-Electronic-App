import { useState } from 'react'
import { Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { useAuth } from '../../contexts/AuthContext'
import { useUserPosPin } from '../../hooks/useUserPosPin'

export default function PosSettingsResetPIN() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const { currentUser } = useAuth()
  const { hasPin, loading, clearPin } = useUserPosPin()

  async function handleSubmit(e) {
    e.preventDefault()
    const pw = password.trim()
    if (!pw) {
      alert('Masukkan kata sandi login.')
      return
    }
    if (!hasPin) {
      alert('Tidak ada PIN POS untuk direset.')
      return
    }
    if (!currentUser?.email) {
      alert('Akun harus menggunakan email/password untuk reset PIN.')
      return
    }
    try {
      setBusy(true)
      const cred = EmailAuthProvider.credential(currentUser.email, pw)
      await reauthenticateWithCredential(currentUser, cred)
      await clearPin()
      setPassword('')
      alert('PIN POS telah dihapus. Atur PIN baru di halaman Ganti PIN.')
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        alert('Kata sandi tidak benar.')
      } else {
        alert(err?.message || 'Gagal mereset PIN')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Memuat…
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reset PIN</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Masukkan kata sandi login (Firebase) untuk menghapus PIN POS. Setelah itu buat PIN
          baru di Ganti PIN.
        </p>
      </div>

      {!hasPin ? (
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          Anda belum punya PIN POS — tidak perlu reset.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
        >
          <label className="block">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Kata sandi login <span className="text-red-500">*</span>
            </span>
            <div className="relative mt-1.5">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password akun Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-11 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Sembunyikan' : 'Tampilkan'}
              >
                {show ? (
                  <EyeOff className="h-5 w-5" aria-hidden />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
          </label>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={busy || !currentUser}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-45"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden />
                  Hapus PIN POS
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
