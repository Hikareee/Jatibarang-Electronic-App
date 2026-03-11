import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  ChevronLeft, 
  CheckCircle,
  XCircle,
  Loader2,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { usePurchaseInvoiceDetail } from '../hooks/usePurchaseInvoiceDetail'
import { useUserApproval } from '../hooks/useUserApproval'
import { useAuth } from '../contexts/AuthContext'
import { useProducts } from '../hooks/useProductsData'

export default function PurchaseInvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { invoice, loading, error, approveInvoice, declineInvoice, updateInvoice } = usePurchaseInvoiceDetail(id)
  const { canApprove, canEditApproved, role } = useUserApproval()
  const { currentUser } = useAuth()
  const { products } = useProducts()
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState(null)
  const [itemDraft, setItemDraft] = useState(null)
  const [savingItem, setSavingItem] = useState(false)

  const productNameById = useMemo(() => {
    if (!Array.isArray(products)) return {}
    const map = {}
    for (const p of products) {
      if (!p || !p.id) continue
      map[p.id] = p.nama || p.name || p.kode || ''
    }
    return map
  }, [products])

  const calcItemAmount = (item) => {
    const quantity = Number(item?.quantity || 0)
    const price = Number(item?.price || 0)
    const discount = Number(item?.discount || 0)
    const tax = Number(item?.tax || 0)
    const amount = (quantity * price) * (1 - discount / 100) * (1 + tax / 100)
    return Number.isFinite(amount) ? amount : 0
  }

  const calcTotalsFromItems = (items) => {
    const subTotal = (items || []).reduce((sum, it) => sum + calcItemAmount(it), 0)
    const additionalDiscount = Number(invoice?.additionalDiscount?.value || 0)
    const shippingCost = Number(invoice?.shippingCost?.value || 0)
    const transactionFee = Number(invoice?.transactionFee?.value || 0)
    const total = subTotal - additionalDiscount + shippingCost + transactionFee
    const deductions = Array.isArray(invoice?.deductions)
      ? invoice.deductions.reduce((s, d) => s + Number(d?.value || 0), 0)
      : 0
    const downPayments = Array.isArray(invoice?.downPayments)
      ? invoice.downPayments.reduce((s, d) => s + Number(d?.value || 0), 0)
      : 0
    const remaining = total - deductions - downPayments
    return {
      subTotal,
      total,
      remaining,
    }
  }

  const openEditItem = (index) => {
    const it = (invoice?.items || [])[index]
    if (!it) return
    setEditingItemIndex(index)
    setItemDraft({
      product: it.product || '',
      productName: it.productName || '',
      description: it.description || '',
      quantity: it.quantity ?? 0,
      unit: it.unit || '',
      discount: it.discount ?? 0,
      price: it.price ?? 0,
      tax: it.tax ?? 0,
    })
  }

  const closeEditItem = () => {
    setEditingItemIndex(null)
    setItemDraft(null)
  }

  const saveEditedItem = async () => {
    if (editingItemIndex === null || !itemDraft) return
    try {
      setSavingItem(true)
      const items = Array.isArray(invoice.items) ? [...invoice.items] : []
      const before = items[editingItemIndex] || {}

      const updated = {
        ...before,
        ...itemDraft,
        quantity: Number(itemDraft.quantity || 0),
        price: Number(itemDraft.price || 0),
        discount: Number(itemDraft.discount || 0),
        tax: Number(itemDraft.tax || 0),
      }
      updated.amount = calcItemAmount(updated)
      // keep consistent display name if we can resolve it
      updated.productName =
        updated.productName ||
        productNameById[updated.product] ||
        before.productName ||
        ''

      items[editingItemIndex] = updated
      const totals = calcTotalsFromItems(items)

      await updateInvoice({
        items,
        subTotal: totals.subTotal,
        total: totals.total,
        remaining: totals.remaining,
        editedBy: currentUser?.uid || '',
        changes: {
          itemUpdate: {
            index: editingItemIndex,
            from: before,
            to: updated,
          },
        },
      })

      closeEditItem()
    } catch (err) {
      console.error('Error saving item edit:', err)
      alert('Gagal menyimpan perubahan item')
    } finally {
      setSavingItem(false)
    }
  }
  
  // Check if user can approve (only owner or manager)
  const canApproveInvoice = () => {
    return role === 'owner' || role === 'manager'
  }
  
  // Check if user can edit this invoice
  const canEdit = () => {
    if (!invoice) return false
    if (invoice.status === 'draft') {
      // Employees can edit their own drafts, managers/owners can edit any draft
      return role === 'owner' || role === 'manager' || (role === 'employee' && invoice.createdBy === currentUser?.uid)
    }
    if (invoice.status === 'approved') {
      // Only owner can edit approved invoices
      return canEditApproved
    }
    return false
  }

  // Format number to Indonesian format
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  // Format date to DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Get status label
  const getStatusLabel = (status, deliveryStatus) => {
    if (status === 'declined') return 'Ditolak'
    if (status === 'approved') {
      if (deliveryStatus === 100) return 'Selesai'
      if (deliveryStatus > 0) return 'Dikirim Sebagian'
      return 'Disetujui'
    }
    return 'Draft'
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
      case 'declined':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'draft':
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
    }
  }

  const handleApprove = async () => {
    try {
      setProcessing(true)
      await approveInvoice()
      alert('Pesanan pembelian telah disetujui')
      navigate('/pembelian/pesanan')
    } catch (err) {
      alert('Gagal menyetujui pesanan pembelian')
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      alert('Harap masukkan alasan penolakan')
      return
    }

    try {
      setProcessing(true)
      await declineInvoice(declineReason)
      alert('Pesanan pembelian telah ditolak')
      navigate('/pembelian/pesanan')
    } catch (err) {
      alert('Gagal menolak pesanan pembelian')
      console.error(err)
    } finally {
      setProcessing(false)
      setShowDeclineModal(false)
      setDeclineReason('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat detail pesanan pembelian...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Pesanan pembelian tidak ditemukan'}</p>
        <button
          onClick={() => navigate('/pembelian/pesanan')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Kembali
        </button>
      </div>
    )
  }

  const status = getStatusLabel(invoice.status, invoice.deliveryStatus || 0)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Beranda &gt; Pembelian &gt; Pesanan Pembelian &gt; Detail
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {invoice.number || 'Pesanan Pembelian'}
          </h1>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
              {status}
            </span>
            {invoice.deliveryStatus !== undefined && invoice.deliveryStatus > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                Pengiriman: {invoice.deliveryStatus}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEdit() && (
            <button
              onClick={() => navigate(`/pembelian/invoice/edit/${id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>Edit</span>
            </button>
          )}
          {canApproveInvoice() && invoice && (invoice.status === 'draft' || !invoice.status) && (
            <>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span>Setujui</span>
              </button>
              <button
                onClick={() => setShowDeclineModal(true)}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" />
                <span>Tolak</span>
              </button>
            </>
          )}
          <button 
            onClick={() => navigate('/pembelian/pesanan')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Kembali</span>
          </button>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Vendor
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {invoice.vendorName || invoice.vendor || 'N/A'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Nomor
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {invoice.number || 'N/A'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tanggal Transaksi
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {formatDate(invoice.transactionDate || invoice.createdAt)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tanggal Jatuh Tempo
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Referensi
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {invoice.reference || '-'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total
            </label>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatNumber(invoice.total || 0)}
              </p>
              <button
                onClick={() => setShowTotalBreakdown(!showTotalBreakdown)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={showTotalBreakdown ? 'Sembunyikan rincian' : 'Tampilkan rincian'}
              >
                {showTotalBreakdown ? (
                  <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Items Table */}
        {invoice.items && invoice.items.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Item</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Kuantitas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Harga
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Diskon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Pajak %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoice.items.map((item, index) => {
                    const itemSubtotal = (item.quantity || 0) * (item.price || 0)
                    const itemDiscount = itemSubtotal * ((item.discount || 0) / 100)
                    const itemAfterDiscount = itemSubtotal - itemDiscount
                    const itemTax = itemAfterDiscount * ((item.tax || 0) / 100)
                    const itemTotal = itemAfterDiscount + itemTax
                    
                    return (
                      <tr key={index}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={editingItemIndex === index}
                            onChange={(e) => {
                              if (e.target.checked) openEditItem(index)
                              else closeEditItem()
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            title="Edit item ini"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.productName || productNameById[item.product] || item.product || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.quantity || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {formatNumber(item.price || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.discount ? `${item.discount}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.tax ? `${item.tax}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {formatNumber(item.amount || itemTotal || 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {editingItemIndex !== null && itemDraft && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Item
                </h2>
                <button
                  onClick={closeEditItem}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  Tutup
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Produk
                    </label>
                    <select
                      value={itemDraft.product}
                      onChange={(e) =>
                        setItemDraft((prev) => ({
                          ...prev,
                          product: e.target.value,
                          productName: productNameById[e.target.value] || prev.productName || '',
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Pilih Produk</option>
                      {(products || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama || p.name || p.kode || 'Unnamed Product'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deskripsi
                    </label>
                    <input
                      type="text"
                      value={itemDraft.description}
                      onChange={(e) => setItemDraft((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kuantitas
                    </label>
                    <input
                      type="number"
                      value={itemDraft.quantity}
                      onChange={(e) =>
                        setItemDraft((prev) => ({ ...prev, quantity: e.target.value === '' ? '' : Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Satuan
                    </label>
                    <input
                      type="text"
                      value={itemDraft.unit}
                      onChange={(e) => setItemDraft((prev) => ({ ...prev, unit: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Harga
                    </label>
                    <input
                      type="number"
                      value={itemDraft.price}
                      onChange={(e) =>
                        setItemDraft((prev) => ({ ...prev, price: e.target.value === '' ? '' : Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Diskon (%)
                    </label>
                    <input
                      type="number"
                      value={itemDraft.discount}
                      onChange={(e) =>
                        setItemDraft((prev) => ({ ...prev, discount: e.target.value === '' ? '' : Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pajak (%)
                    </label>
                    <input
                      type="number"
                      value={itemDraft.tax}
                      onChange={(e) =>
                        setItemDraft((prev) => ({ ...prev, tax: e.target.value === '' ? '' : Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeEditItem}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                  disabled={savingItem}
                >
                  Batal
                </button>
                <button
                  onClick={saveEditedItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={savingItem}
                >
                  {savingItem ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attachments */}
        {Array.isArray(invoice.attachments) && invoice.attachments.length > 0 && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Lampiran
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.attachments.map((att, index) => {
                const key = att.path || att.url || `${att.name}-${index}`
                const name = att.name || `Lampiran ${index + 1}`
                const type = (att.type || '').toLowerCase()
                const url = att.url || ''

                const isImage = type.startsWith('image/')
                const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
                const isVideo = type.startsWith('video/')
                const isAudio = type.startsWith('audio/')

                return (
                  <div
                    key={key}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
                  >
                    <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {name}
                        </div>
                        {type && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {type}
                          </div>
                        )}
                      </div>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                        >
                          Buka
                        </a>
                      )}
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/30">
                      {!url ? (
                        <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                          File tidak memiliki URL.
                        </div>
                      ) : isImage ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={url}
                            alt={name}
                            loading="lazy"
                            className="w-full h-64 object-contain bg-black/5 dark:bg-white/5"
                          />
                        </a>
                      ) : isPdf ? (
                        <iframe
                          title={name}
                          src={url}
                          className="w-full h-80"
                        />
                      ) : isVideo ? (
                        <video src={url} controls className="w-full h-64 bg-black" />
                      ) : isAudio ? (
                        <div className="p-4">
                          <audio src={url} controls className="w-full" />
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-gray-700 dark:text-gray-200">
                          <div className="mb-2">Preview tidak tersedia untuk tipe file ini.</div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Unduh / Buka file
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Total Breakdown - Expandable */}
        {showTotalBreakdown && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rincian Total</h3>
            <div className="flex justify-end">
              <div className="w-full max-w-md">
                <div className="space-y-2">
                  {(() => {
                    // Calculate items subtotal before any discounts
                    const itemsSubtotalBeforeDiscount = invoice.items?.reduce((sum, item) => {
                      return sum + ((item.quantity || 0) * (item.price || 0))
                    }, 0) || 0
                    
                    // Calculate total discount from items
                    const totalItemDiscount = invoice.items?.reduce((sum, item) => {
                      const quantity = item.quantity || 0
                      const price = item.price || 0
                      const discount = item.discount || 0
                      const itemSubtotal = quantity * price
                      const itemDiscount = itemSubtotal * (discount / 100)
                      return sum + itemDiscount
                    }, 0) || 0
                    
                    // Calculate subtotal after item discounts
                    const subtotalAfterItemDiscount = itemsSubtotalBeforeDiscount - totalItemDiscount
                    
                    // Calculate total tax from items
                    const totalTax = invoice.items?.reduce((sum, item) => {
                      const quantity = item.quantity || 0
                      const price = item.price || 0
                      const discount = item.discount || 0
                      const tax = item.tax || 0
                      const itemSubtotal = quantity * price
                      const itemDiscount = itemSubtotal * (discount / 100)
                      const itemAfterDiscount = itemSubtotal - itemDiscount
                      const itemTax = itemAfterDiscount * (tax / 100)
                      return sum + itemTax
                    }, 0) || 0
                    
                    // Subtotal after discounts and before tax
                    const subtotalAfterDiscount = subtotalAfterItemDiscount
                    
                    // Subtotal after tax
                    const subtotalAfterTax = subtotalAfterDiscount + totalTax
                    
                    const additionalDiscount = invoice.additionalDiscount?.value || 0
                    const shippingCost = invoice.shippingCost?.value || 0
                    const transactionFee = invoice.transactionFee?.value || 0
                    const total = subtotalAfterTax - additionalDiscount + shippingCost + transactionFee
                    
                    return (
                      <>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>Subtotal Produk (Sebelum Diskon)</span>
                          <span>{formatNumber(itemsSubtotalBeforeDiscount)}</span>
                        </div>
                        {totalItemDiscount > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Diskon Item</span>
                            <span className="text-red-600 dark:text-red-400">-{formatNumber(totalItemDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>Subtotal Setelah Diskon Item</span>
                          <span>{formatNumber(subtotalAfterItemDiscount)}</span>
                        </div>
                        {totalTax > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Pajak ({invoice.items?.some(item => item.tax > 0) ? invoice.items.find(item => item.tax > 0)?.tax : 0}%)</span>
                            <span>{formatNumber(totalTax)}</span>
                          </div>
                        )}
                        {additionalDiscount > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Diskon Tambahan</span>
                            <span className="text-red-600 dark:text-red-400">-{formatNumber(additionalDiscount)}</span>
                          </div>
                        )}
                        {shippingCost > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Biaya Pengiriman</span>
                            <span>{formatNumber(shippingCost)}</span>
                          </div>
                        )}
                        {transactionFee > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Biaya Transaksi</span>
                            <span>{formatNumber(transactionFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span>Total</span>
                          <span>{formatNumber(invoice.total || total)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decline Reason */}
        {invoice.status === 'declined' && invoice.declineReason && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
              Alasan Penolakan:
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              {invoice.declineReason}
            </p>
          </div>
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tolak Pesanan Pembelian
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Harap masukkan alasan penolakan:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white mb-4"
              rows={4}
              placeholder="Masukkan alasan penolakan..."
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDecline}
                disabled={processing || !declineReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Memproses...' : 'Tolak'}
              </button>
              <button
                onClick={() => {
                  setShowDeclineModal(false)
                  setDeclineReason('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg flex items-center gap-3 transition-colors">
          <MessageCircle className="h-6 w-6" />
          <span className="text-sm font-medium">Halo, ada yang bisa saya bantu?</span>
        </button>
      </div>
    </div>
  )
}
