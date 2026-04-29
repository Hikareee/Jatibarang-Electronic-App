import { useState } from 'react'
import { Link } from 'react-router-dom'
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore'
import { ScanLine, Truck, PackageCheck } from 'lucide-react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import { db } from '../firebase/config'
import { normalizeSerialId } from '../utils/itemSerials'

export default function MobileDeliveryTracker() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const { currentUser } = useAuth()
  const { role } = useUserApproval()
  const canUpdateDelivery = ['owner', 'manager', 'admin', 'employee'].includes(role)

  const [scanInput, setScanInput] = useState('')
  const [serialData, setSerialData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    const raw = scanInput.trim()
    if (!raw) return
    setMessage('')
    setError('')
    const norm = normalizeSerialId(raw)
    try {
      const sRef = doc(db, 'itemSerials', norm)
      const sSnap = await getDoc(sRef)
      if (!sSnap.exists()) {
        setSerialData(null)
        setError('Serial tidak ditemukan.')
        return
      }
      setSerialData({ id: sSnap.id, ...sSnap.data() })
      setMessage('Serial ditemukan.')
    } catch (e2) {
      console.error(e2)
      setError('Gagal membaca data serial.')
    }
  }

  async function updateDeliveryStatus(nextStatus) {
    if (!serialData?.id || !canUpdateDelivery) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const now = new Date().toISOString()
      const nextLabel =
        nextStatus === 'packed'
          ? 'Packed'
          : nextStatus === 'out_for_delivery'
            ? 'Out for delivery'
            : nextStatus
      const payload = {
        deliveryStatus: nextStatus,
        deliveryStatusLabel: nextLabel,
        deliveryUpdatedAt: now,
        deliveryUpdatedByUid: currentUser?.uid || '',
        lastMovementType: `delivery_${nextStatus}`,
        updatedAt: now,
        deliveryTimeline: arrayUnion({
          status: nextStatus,
          label: nextLabel,
          at: now,
          byUid: currentUser?.uid || '',
        }),
      }
      await updateDoc(doc(db, 'itemSerials', serialData.id), payload)
      setSerialData((prev) => ({ ...prev, ...payload }))
      setMessage(`Status delivery diperbarui: ${nextLabel}.`)
    } catch (e) {
      console.error(e)
      setError('Gagal memperbarui status delivery.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Delivery Tracker (Prototype)</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Lacak serial dari keluar gudang sampai tahap pengantaran.
                </p>
              </div>
              <Link
                to="/mobile/ops"
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Kembali ke Mobile Stock
              </Link>
            </div>

            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <ScanLine className="h-5 w-5 text-gray-400" />
              <input
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan serial item"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Cari
              </button>
            </form>

            {message ? <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{message}</p> : null}
            {error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}

            {serialData ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{serialData.productName || serialData.productId || '-'}</div>
                  <div className="text-gray-500">Serial: {serialData.serialNumber || serialData.id}</div>
                  <div className="text-gray-500">Warehouse: {serialData.warehouseId || '-'}</div>
                  <div className="text-gray-500">Stock status: {serialData.status || '-'}</div>
                  <div className="font-medium text-indigo-700">
                    Delivery status: {serialData.deliveryStatusLabel || serialData.deliveryStatus || 'Belum mulai'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={saving || !canUpdateDelivery}
                    onClick={() => updateDeliveryStatus('packed')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" /> Mark Packed
                  </button>
                  <button
                    type="button"
                    disabled={saving || !canUpdateDelivery}
                    onClick={() => updateDeliveryStatus('out_for_delivery')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <Truck className="h-4 w-4" /> Out for delivery
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon in courier app"
                    className="rounded-lg bg-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 opacity-70"
                  >
                    Mark delivered (next app)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
