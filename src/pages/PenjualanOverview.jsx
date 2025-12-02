import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import { MoreVertical, TrendingUp, Printer, ChevronDown, MessageCircle, Filter } from 'lucide-react'
import { usePenjualanData } from '../hooks/usePenjualanData'
import { Loader2 } from 'lucide-react'

const COLORS = {
  teal: '#14B8A6',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  blue: '#3B82F6',
  purple: '#A855F7',
  brown: '#8B4513',
}

// Format number to Indonesian format
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

export default function PenjualanOverview() {
  const { data, loading, error } = usePenjualanData()

  // Use Firestore data or show zeros
  const kpiData = data?.kpi || {
    penjualan: { value: 0, tagihanBulanIni: 0, percentage: 0 },
    pembayaranDiterima: { value: 0, tagihanBulanIni: 0, percentage: 0 },
    menungguPembayaran: { value: 0, tagihan: 0, percentage: 0 },
    jatuhTempo: { value: 0, tagihan: 0, text: 'dari total Tagihan belum dibayar' },
    rasioLunas: { percentage: 0, text: 'Tagihan lunas vs total Tagihan bulan ini' }
  }

  const tagihanPemesananData = data?.tagihanPemesanan || []
  const penjualanPerProdukData = data?.penjualanPerProduk || []
  const pembayaranDiterimaData = data?.pembayaranDiterima || []
  const penjualanPerPelangganData = data?.penjualanPerPelanggan || []
  const penjualanPerSalesPersonData = data?.penjualanPerSalesPerson || []
  const alurPenjualanData = data?.alurPenjualan || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data penjualan...</p>
        </div>
      </div>
    )
  }

  if (error) {
    console.warn('Penjualan data error:', error)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Beranda &gt; Penjualan &gt; Overview
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview Penjualan</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-sm text-gray-700 dark:text-gray-300">Panduan</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Printer className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Print</span>
          </button>
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium">Bulan</button>
            <button className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Tahun</button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* PENJUALAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">PENJUALAN</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.penjualan?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.penjualan?.tagihanBulanIni || 0} Tagihan Bulan Ini
          </p>
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.penjualan?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
        </div>

        {/* PEMBAYARAN DITERIMA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">PEMBAYARAN DITERIMA</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.pembayaranDiterima?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.pembayaranDiterima?.tagihanBulanIni || 0} Tagihan Bulan Ini
          </p>
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.pembayaranDiterima?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
        </div>

        {/* MENUNGGU PEMBAYARAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">MENUNGGU PEMBAYARAN</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.menungguPembayaran?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.menungguPembayaran?.tagihan || 0} Tagihan
          </p>
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.menungguPembayaran?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
        </div>

        {/* JATUH TEMPO */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">JATUH TEMPO</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.jatuhTempo?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.jatuhTempo?.tagihan || 0} Tagihan
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {kpiData.jatuhTempo?.text || 'dari total Tagihan belum dibayar'}
          </p>
        </div>

        {/* RASIO LUNAS */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">RASIO LUNAS</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center justify-center mb-2">
            <div className="relative w-32 h-16">
              <svg className="w-32 h-16" viewBox="0 0 100 50">
                {/* Background arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Progress arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  stroke={COLORS.teal}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(kpiData.rasioLunas?.percentage || 0) * 1.256} 125.6`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {kpiData.rasioLunas?.percentage || 0}%
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {kpiData.rasioLunas?.text || 'Tagihan lunas vs total Tagihan bulan ini'}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TAGIHAN & PEMESANAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              TAGIHAN & PEMESANAN
            </h2>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagihanPemesananData.length > 0 ? tagihanPemesananData : [
                { period: 'Jul', value: 0 },
                { period: 'Agt', value: 0 },
                { period: 'Sep', value: 0 },
                { period: 'Okt', value: 0 },
                { period: 'Nov', value: 0 },
                { period: 'Des', value: 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="period" 
                  stroke="#6B7280"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#6B7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  domain={[0, 60000000]}
                />
                <Tooltip 
                  formatter={(value) => formatNumber(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill={COLORS.teal}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PENJUALAN PER PRODUK BULAN INI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PENJUALAN PER PRODUK BULAN INI
            </h2>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
              Jenis Produk
            </button>
            <button className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              Kategori
            </button>
          </div>

          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {penjualanPerProdukData.length > 0 ? (
              <BarChart data={penjualanPerProdukData} width={400} height={250}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatNumber(value)} />
                <Bar dataKey="value" fill={COLORS.teal} />
              </BarChart>
            ) : (
              <p className="text-sm">Tidak ada data</p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PEMBAYARAN DITERIMA */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PEMBAYARAN DITERIMA
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <Filter className="h-5 w-5 text-gray-400" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pembayaranDiterimaData.length > 0 ? pembayaranDiterimaData : [
                { month: 'Jul', tagihan: 0, pemesanan: 0 },
                { month: 'Agt', tagihan: 0, pemesanan: 0 },
                { month: 'Sep', tagihan: 0, pemesanan: 0 },
                { month: 'Okt', tagihan: 0, pemesanan: 0 },
                { month: 'Nov', tagihan: 0, pemesanan: 0 },
                { month: 'Des', tagihan: 0, pemesanan: 0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="month" 
                  stroke="#6B7280"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#6B7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  domain={[0, 25000000]}
                />
                <Tooltip 
                  formatter={(value) => formatNumber(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="tagihan" 
                  stroke={COLORS.teal} 
                  strokeWidth={2}
                  name="Tagihan"
                />
                <Line 
                  type="monotone" 
                  dataKey="pemesanan" 
                  stroke={COLORS.yellow} 
                  strokeWidth={2}
                  name="Pemesanan"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PENJUALAN PER PELANGGAN BULAN INI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PENJUALAN PER PELANGGAN BULAN INI
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <Filter className="h-5 w-5 text-gray-400" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {penjualanPerPelangganData.length > 0 ? (
              <BarChart data={penjualanPerPelangganData} width={400} height={250}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatNumber(value)} />
                <Bar dataKey="value" fill={COLORS.teal} />
              </BarChart>
            ) : (
              <p className="text-sm">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* PENJUALAN PER SALES PERSON */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PENJUALAN PER SALES PERSON
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <Filter className="h-5 w-5 text-gray-400" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {penjualanPerSalesPersonData.length > 0 ? (
              <div className="w-full">
                <BarChart data={penjualanPerSalesPersonData} width={400} height={250}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 1]} />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="jul" fill={COLORS.red} name="Jul" />
                  <Bar dataKey="agt" fill={COLORS.blue} name="Agt" />
                  <Bar dataKey="sep" fill={COLORS.teal} name="Sep" />
                  <Bar dataKey="okt" fill={COLORS.blue} name="Okt" />
                  <Bar dataKey="nov" fill={COLORS.brown} name="Nov" />
                  <Bar dataKey="des" fill={COLORS.purple} name="Des" />
                </BarChart>
              </div>
            ) : (
              <p className="text-sm">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* ALUR PENJUALAN BELUM SELESAI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              ALUR PENJUALAN BELUM SELESAI
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <Filter className="h-5 w-5 text-gray-400" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {alurPenjualanData.length > 0 ? (
              <div className="w-full">
                {/* Add your flow chart component here */}
                <p className="text-sm">Flow chart data available</p>
              </div>
            ) : (
              <p className="text-sm">Tidak ada data</p>
            )}
          </div>
        </div>
      </div>

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

