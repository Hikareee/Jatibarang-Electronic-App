import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Camera, X } from 'lucide-react'

/**
 * Camera barcode scanner for mobile web.
 * Props:
 * - open: boolean
 * - onScan: (code: string) => void
 * - onClose: () => void
 */
export default function MobileBarcodeCameraScanner({ open, onScan, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [scanError, setScanError] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function start() {
      setScanError('')
      setIsScanning(true)

      try {
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        const videoEl = videoRef.current
        if (!videoEl) throw new Error('Video element not ready')

        reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoEl,
          (result, err) => {
            if (cancelled) return
            if (result?.getText) {
              const text = result.getText()
              try {
                reader.reset()
              } catch {
                /* ignore */
              }
              if (text) {
                setIsScanning(false)
                onScan?.(text)
              }
              return
            }

            if (err) {
              const name = err?.name || ''
              const msg = err?.message || ''
              // Most decode errors are expected (not found yet). Ignore.
              if (name === 'NotFoundException' || msg.toLowerCase().includes('notfound')) return
              setScanError(err?.message ? String(err.message) : 'Gagal membaca barcode')
            }
          }
        )
      } catch (e) {
        console.error(e)
        setScanError(e?.message ? String(e.message) : 'Gagal membuka kamera / membaca barcode')
        setIsScanning(false)
      }
    }

    start()

    return () => {
      cancelled = true
      setIsScanning(false)
      try {
        readerRef.current?.reset?.()
      } catch {
        /* ignore */
      }
      readerRef.current = null
    }
  }, [open, onScan])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Scan Barcode</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />

          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-32 w-32 rounded-2xl border-2 border-blue-500/90 shadow-[0_0_0_4px_rgba(59,130,246,.15)]" />
          </div>
        </div>

        <div className="px-4 py-3">
          {scanError ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {scanError}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {isScanning ? 'Arahkan kamera ke barcode.' : 'Memulai scan...'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

