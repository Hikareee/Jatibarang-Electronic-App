import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { db } from '../firebase/config'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { ChevronLeft } from 'lucide-react'

export default function ProyekDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(true)
  const [txError, setTxError] = useState(null)

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0'
    return new Intl.NumberFormat('id-ID').format(num)
  }

  const toDate = (v) => {
    if (!v) return null
    if (v?.toDate && typeof v.toDate === 'function') return v.toDate()
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? null : d
    }
    return null
  }

  const formatDate = (v) => {
    const d = toDate(v)
    if (!d) return '-'
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  }

  const openTransaction = (tx) => {
    if (!tx?.source?.collection || !tx?.source?.id) return
    if (tx.source.collection === 'invoices') return navigate(`/penjualan/tagihan/${tx.source.id}`)
    if (tx.source.collection === 'purchaseInvoices') return navigate(`/pembelian/pesanan/${tx.source.id}`)
    if (tx.source.collection === 'expenses') return navigate(`/biaya/${tx.source.id}`)
  }

  useEffect(() => {
    const fetchProjectAndTransactions = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        setTxLoading(true)
        setTxError(null)

        const projectSnapPromise = getDoc(doc(db, 'projects', id))

        // Fetch all proyek-related transactions from source collections (they hold projectId/projectName)
        // We sort on client to avoid composite-index requirements (where + orderBy).
        const invoicesPromise = getDocs(query(collection(db, 'invoices'), where('projectId', '==', id)))
        const purchaseInvoicesPromise = getDocs(query(collection(db, 'purchaseInvoices'), where('projectId', '==', id)))
        const expensesPromise = getDocs(query(collection(db, 'expenses'), where('projectId', '==', id)))

        const [projectSnap, invoicesSnap, purchaseInvoicesSnap, expensesSnap] = await Promise.all([
          projectSnapPromise,
          invoicesPromise,
          purchaseInvoicesPromise,
          expensesPromise,
        ])

        if (!projectSnap.exists()) {
          setError('Proyek tidak ditemukan')
          setProject(null)
        } else {
          setProject({ id: projectSnap.id, ...projectSnap.data() })
        }

        const tx = []

        for (const d of invoicesSnap.docs) {
          const data = d.data() || {}
          tx.push({
            id: `${d.id}-invoices`,
            type: 'Penjualan',
            number: data.number || '-',
            contactName: data.customer || data.contactName || '-',
            date: data.transactionDate || data.date || data.createdAt,
            total: Number(data.total || 0) || 0,
            status: data.status || (data.paid ? 'Lunas' : ''),
            source: { collection: 'invoices', id: d.id },
          })
        }

        for (const d of purchaseInvoicesSnap.docs) {
          const data = d.data() || {}
          tx.push({
            id: `${d.id}-purchaseInvoices`,
            type: 'Pembelian',
            number: data.number || '-',
            contactName: data.vendor || data.contactName || '-',
            date: data.transactionDate || data.date || data.createdAt,
            total: Number(data.total || 0) || 0,
            status: data.status || (data.paid ? 'Lunas' : ''),
            source: { collection: 'purchaseInvoices', id: d.id },
          })
        }

        for (const d of expensesSnap.docs) {
          const data = d.data() || {}
          tx.push({
            id: `${d.id}-expenses`,
            type: 'Biaya',
            number: data.number || '-',
            contactName: data.recipient || data.contactName || '-',
            date: data.date || data.transactionDate || data.createdAt,
            total: Number(data.total || 0) || 0,
            status: data.paid ? 'Lunas' : (Number(data.remaining ?? data.total ?? 0) === 0 ? 'Lunas' : ''),
            source: { collection: 'expenses', id: d.id },
          })
        }

        tx.sort((a, b) => {
          const da = toDate(a.date)?.getTime() ?? 0
          const dbb = toDate(b.date)?.getTime() ?? 0
          return dbb - da
        })

        setTransactions(tx)
      } catch (err) {
        console.error('Error fetching project detail:', err)
        setError('Gagal memuat detail proyek')
        setTxError('Gagal memuat transaksi proyek')
        setTransactions([])
      } finally {
        setLoading(false)
        setTxLoading(false)
      }
    }
    fetchProjectAndTransactions()
  }, [id])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Beranda &gt; Proyek &gt; Detail</div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => navigate('/proyek')} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Proyek</h1>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              {loading ? (
                <p className="text-gray-600 dark:text-gray-400">Memuat detail proyek...</p>
              ) : error ? (
                <p className="text-red-600 dark:text-red-400">{error}</p>
              ) : (
                <div className="space-y-3">
                  <div><span className="text-sm text-gray-500">Nama Proyek:</span> <span className="text-gray-900 dark:text-white font-medium">{project?.name || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Kode:</span> <span className="text-gray-900 dark:text-white">{project?.code || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Customer:</span> <span className="text-gray-900 dark:text-white">{project?.customer || '-'}</span></div>
                  <div><span className="text-sm text-gray-500">Deskripsi:</span> <span className="text-gray-900 dark:text-white">{project?.description || '-'}</span></div>
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaksi Proyek</h2>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {txLoading ? 'Memuat...' : `${transactions.length} transaksi`}
                </div>
              </div>

              {txLoading ? (
                <div className="p-6 text-gray-600 dark:text-gray-400">Memuat transaksi...</div>
              ) : txError ? (
                <div className="p-6 text-red-600 dark:text-red-400">{txError}</div>
              ) : transactions.length === 0 ? (
                <div className="p-6 text-gray-600 dark:text-gray-400">Belum ada transaksi untuk proyek ini.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nomor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer"
                          onClick={() => openTransaction(tx)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {tx.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {tx.number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {tx.contactName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                            {formatNumber(tx.total)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {tx.status || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}

