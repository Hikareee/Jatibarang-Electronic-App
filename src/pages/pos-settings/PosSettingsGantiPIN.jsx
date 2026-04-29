import { useState } from 'react'
import { Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { useUserPosPin } from '../../hooks/useUserPosPin'

function PinField({ label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false)

  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} <span className="text-red-500">*</span>
      </span>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
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
  )
}

export default function PosSettingsGantiPIN() {
  const [pinLama, setPinLama] = useState('')
  const [pinBaru, setPinBaru] = useState('')
  const [pinKonfirm, setPinKonfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const { hasPin, loading, setPin, verifyPin } = useUserPosPin()

  async function handleSubmit(e) {
    e.preventDefault()
    const nb = String(pinBaru || '').trim()
    const kb = String(pinKonfirm || '').trim()
    if (nb.length < 4 || kb.length < 4) {
      alert('PIN baru minimal 4 digit.')
      return
    }
    if (nb !== kb) {
      alert('Konfirmasi PIN tidak sama.')
      return
    }
    try {
      setSaving(true)
      if (hasPin) {
        const ok = await verifyPin(pinLama)
        if (!ok) {
          alert('PIN lama tidak sesuai.')
          return
        }
      }
      await setPin(nb)
      setPinLama('')
      setPinBaru('')
      setPinKonfirm('')
      alert('PIN POS berhasil disimpan.')
    } catch (err) {
      alert(err?.message || 'Gagal menyimpan PIN')
    } finally {
      setSaving(false)
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ganti PIN</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hasPin
            ? 'Perbarui PIN untuk otorisasi POS (tersimpan aman di Firestore).'
            : 'Belum ada PIN — buat PIN baru untuk akun Anda.'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
      >
        {hasPin ? (
          <PinField
            label="PIN Lama"
            placeholder="Masukkan PIN lama"
            value={pinLama}
            onChange={setPinLama}
          />
        ) : null}
        <PinField
          label="PIN Baru"
          placeholder="Minimal 4 digit"
          value={pinBaru}
          onChange={setPinBaru}
        />
        <PinField
          label="Konfirmasi PIN Baru"
          placeholder="Ulangi PIN baru"
          value={pinKonfirm}
          onChange={setPinKonfirm}
        />

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-45"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden />
                Simpan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
