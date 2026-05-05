import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Camera, X } from 'lucide-react'

/**
 * Reusable camera scanner modal (1D barcodes + QR).
 *
 * Props:
 * - open: boolean
 * - onScan: (code: string) => void
 * - onClose: () => void
 * - title?: string
 * - hint?: string
 */
export default function CameraScannerModal({
  open,
  onScan,
  onClose,
  title = 'Scan Barcode / QR',
  hint = 'Arahkan kamera ke barcode atau QR.',
}) {
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
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.AZTEC,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
        ])

        const reader = new BrowserMultiFormatReader(hints)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-white" />
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white/90 hover:bg-white/25"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative h-36 w-36 rounded-2xl bg-blue-600/5 ring-1 ring-blue-400/50 shadow-[0_0_0_4px_rgba(59,130,246,.10)]">
              <div className="absolute left-2 top-2 h-4 w-4 border-t-2 border-l-2 border-blue-500/90 rounded-tl-lg" />
              <div className="absolute right-2 top-2 h-4 w-4 border-t-2 border-r-2 border-blue-500/90 rounded-tr-lg" />
              <div className="absolute left-2 bottom-2 h-4 w-4 border-b-2 border-l-2 border-blue-500/90 rounded-bl-lg" />
              <div className="absolute right-2 bottom-2 h-4 w-4 border-b-2 border-r-2 border-blue-500/90 rounded-br-lg" />
              <div className="absolute left-5 right-5 top-3 h-px bg-gradient-to-r from-transparent via-blue-500/80 to-transparent animate-pulse" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          {scanError ? (
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {scanError}
            </p>
          ) : (
            <p className="text-xs text-slate-500">{isScanning ? hint : 'Memulai scan...'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

