import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore'
import { Camera, CheckCircle2, ChevronLeft, PackageCheck, Truck } from 'lucide-react'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { normalizeSerialId } from '../utils/itemSerials'

function nextLabel(status) {
  if (status === 'packed') return 'Packed'
  if (status === 'out_for_delivery') return 'Out for delivery'
  if (status === 'delivered') return 'Delivered'
  return status
}

export default function MobileDeliveryDetail() {
  const { invoiceId, serialNumber } = useParams()
  const { currentUser } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [serial, setSerial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const normSerial = useMemo(() => normalizeSerialId(decodeURIComponent(serialNumber || '')), [serialNumber])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [invoiceSnap, serialSnap] = await Promise.all([
          getDoc(doc(db, 'invoices', decodeURIComponent(invoiceId || ''))),
          getDoc(doc(db, 'itemSerials', normSerial)),
        ])
        setInvoice(invoiceSnap.exists() ? { id: invoiceSnap.id, ...invoiceSnap.data() } : null)
        setSerial(serialSnap.exists() ? { id: serialSnap.id, ...serialSnap.data() } : null)
      } catch (e) {
        console.error(e)
        setError('Gagal memuat detail delivery.')
      } finally {
        setLoading(false)
      }
    }
    if (invoiceId && normSerial) load()
  }, [invoiceId, normSerial])

  const invoiceItem = useMemo(() => {
    return (invoice?.items || []).find((item) => normalizeSerialId(item.serialNumber) === normSerial) || null
  }, [invoice, normSerial])

  async function updateStatus(nextStatus, extra = {}) {
    if (!serial?.id) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const now = new Date().toISOString()
      const payload = {
        deliveryStatus: nextStatus,
        deliveryStatusLabel: nextLabel(nextStatus),
        deliveryUpdatedAt: now,
        deliveryUpdatedByUid: currentUser?.uid || '',
        updatedAt: now,
        lastMovementType: `delivery_${nextStatus}`,
        ...extra,
        deliveryTimeline: arrayUnion({
          status: nextStatus,
          label: nextLabel(nextStatus),
          at: now,
          byUid: currentUser?.uid || '',
          ...(extra.deliveryProofPhotoName
            ? { proofPhotoName: extra.deliveryProofPhotoName }
            : {}),
        }),
      }
      await updateDoc(doc(db, 'itemSerials', serial.id), payload)
      setSerial((prev) => ({
        ...prev,
        ...extra,
        deliveryStatus: nextStatus,
        deliveryStatusLabel: nextLabel(nextStatus),
        deliveryUpdatedAt: now,
        deliveryUpdatedByUid: currentUser?.uid || '',
        updatedAt: now,
        lastMovementType: `delivery_${nextStatus}`,
        deliveryTimeline: [
          ...(Array.isArray(prev?.deliveryTimeline) ? prev.deliveryTimeline : []),
          {
            status: nextStatus,
            label: nextLabel(nextStatus),
            at: now,
            byUid: currentUser?.uid || '',
            ...(extra.deliveryProofPhotoName
              ? { proofPhotoName: extra.deliveryProofPhotoName }
              : {}),
          },
        ],
      }))
      setMessage(`Status diperbarui ke ${nextLabel(nextStatus)}.`)
    } catch (e) {
      console.error(e)
      setError('Gagal menyimpan status delivery.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkDelivered() {
    if (!photoFile) {
      setError('Ambil foto barang yang diserahkan dulu.')
      return
    }
    await updateStatus('delivered', {
      deliveryCompletedAt: new Date().toISOString(),
      deliveryProofPhotoPending: true,
      deliveryProofPhotoName: photoFile.name || 'proof.jpg',
      deliveryProofPhotoMime: photoFile.type || '',
      deliveryProofPhotoUrl: '',
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Link
        to="/mobile/delivery"
        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Kembali ke delivery list
      </Link>

      {loading ? (
        <div className="rounded-3xl bg-white p-6 text-sm shadow-sm dark:bg-slate-900">Memuat detail...</div>
      ) : null}

      {!loading && (error || !invoice || !serial || !invoiceItem) ? (
        <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-700">{error || 'Detail delivery tidak ditemukan.'}</div>
      ) : null}

      {!loading && invoice && serial && invoiceItem ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-bold">{invoiceItem.product || invoiceItem.sku || serial.productName}</p>
            <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <p>Serial: {serial.serialNumber || serial.id}</p>
              <p>Invoice: {invoice.number || invoice.id}</p>
              <p>Pelanggan: {invoice.customerName || invoice.customer || '-'}</p>
              <p>Telepon: {invoice.customerPhone || '-'}</p>
              <p>Alamat: {invoice.customerAddress || '-'}</p>
              <p>Pembayaran: {invoice.paymentMethod || '-'} · Sisa Rp {Number(invoice.remaining || 0).toLocaleString('id-ID')}</p>
              <p>Lokasi ambil: {serial.warehouseId || invoiceItem.serialWarehouseId || '-'}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold">Status delivery</p>
            <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              {serial.deliveryStatusLabel || serial.deliveryStatus || 'Menunggu dispatch'}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => updateStatus('packed', { deliveryAssignedAt: new Date().toISOString() })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <PackageCheck className="h-4 w-4" />
                Barang siap dikirim
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => updateStatus('out_for_delivery', { deliveryStartedAt: new Date().toISOString() })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Truck className="h-4 w-4" />
                Kirim sekarang
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold">Proof of delivery</p>
            <p className="mt-1 text-xs text-slate-500">
              V1 menyimpan placeholder metadata. Upload ke Storage bisa ditambahkan nanti.
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm dark:border-slate-700">
              <Camera className="h-4 w-4" />
              <span>{photoFile ? photoFile.name : 'Ambil / pilih foto penyerahan barang'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setPhotoFile(file)
                  setPhotoPreview(file ? URL.createObjectURL(file) : '')
                }}
              />
            </label>

            {photoPreview ? (
              <img src={photoPreview} alt="Preview proof" className="mt-4 h-48 w-full rounded-2xl object-cover" />
            ) : null}

            <button
              type="button"
              disabled={saving || !photoFile}
              onClick={handleMarkDelivered}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tandai selesai di lokasi
            </button>
          </div>

          {message ? <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
        </>
      ) : null}
    </div>
  )
}
