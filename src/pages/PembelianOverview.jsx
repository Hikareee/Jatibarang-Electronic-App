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
  Legend
} from 'recharts'
import { MoreVertical, TrendingUp, Printer, ChevronDown, MessageCircle, Loader2 } from 'lucide-react'
import { usePembelianData } from '../hooks/usePembelianData'
import { useLanguage } from '../contexts/LanguageContext'

const COLORS = {
  teal: '#14B8A6',
  yellow: '#F59E0B',
  green: '#10B981',
}

// Format number to Indonesian format
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

export default function PembelianOverview() {
  const { data, loading, error } = usePembelianData()
  const { t } = useLanguage()

  // Use Firestore data or show zeros
  const kpiData = data?.kpi || {
    pembelian: { value: 0, tagihanBulanIni: 0, percentage: 0 },
    pembayaranDikirim: { value: 0, tagihanBulanIni: 0, percentage: 0 },
    rasioLunas: { percentage: 100, text: 'Tagihan Pembelian lunas vs total Tagihan Pembelian bulan ini' },
    menungguPembayaran: { value: 0, tagihan: 0, percentage: 0 },
    jatuhTempo: { value: 0, tagihan: 0, text: 'dari total Tagihan Pembelian belum dibayar' },
    totalPembelianBulanIni: null
  }

  const tagihanPesananData = data?.tagihanPesanan || []
  const pembayaranData = data?.pembayaran || []
  const pembelianPerVendorData = data?.pembelianPerVendor || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data pembelian...</p>
        </div>
      </div>
    )
  }

  if (error) {
    console.warn('Pembelian data error:', error)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Beranda &gt; Pembelian &gt; Overview
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview Pembelian</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('guide')}</span>
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

      {/* KPI Cards - Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PEMBELIAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">PEMBELIAN</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.pembelian?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.pembelian?.tagihanBulanIni || 0} Tagihan Pembelian Bulan Ini
          </p>
          <div className={`flex items-center gap-1 text-xs ${
            (kpiData.pembelian?.percentage || 0) >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.pembelian?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
        </div>

        {/* PEMBAYARAN PEMBELIAN DIKIRIM */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">PEMBAYARAN PEMBELIAN DIKIRIM</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.pembayaranDikirim?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.pembayaranDikirim?.tagihanBulanIni || 0} Tagihan Pembelian Bulan Ini
          </p>
          <div className={`flex items-center gap-1 text-xs ${
            (kpiData.pembayaranDikirim?.percentage || 0) >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.pembayaranDikirim?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
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
                  strokeDasharray={`${(kpiData.rasioLunas?.percentage || 100) * 1.256} 125.6`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {kpiData.rasioLunas?.percentage || 100}%
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {kpiData.rasioLunas?.text || 'Tagihan Pembelian lunas vs total Tagihan Pembelian bulan ini'}
          </p>
        </div>
      </div>

      {/* KPI Cards - Middle Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MENUNGGU PEMBAYARAN PEMBELIAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">MENUNGGU PEMBAYARAN PEMBELIAN</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.menungguPembayaran?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.menungguPembayaran?.tagihan || 0} Tagihan Pembelian
          </p>
          <div className={`flex items-center gap-1 text-xs ${
            (kpiData.menungguPembayaran?.percentage || 0) >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            <TrendingUp className="h-3 w-3" />
            <span>{kpiData.menungguPembayaran?.percentage || 0}% vs tanggal sama bulan lalu</span>
          </div>
        </div>

        {/* JATUH TEMPO TAGIHAN PEMBELIAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">JATUH TEMPO TAGIHAN PEMBELIAN</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {formatNumber(kpiData.jatuhTempo?.value || 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {kpiData.jatuhTempo?.tagihan || 0} Tagihan Pembelian
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {kpiData.jatuhTempo?.text || 'dari total Tagihan Pembelian belum dibayar'}
          </p>
        </div>

        {/* TOTAL PEMBELIAN BULAN INI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">TOTAL PEMBELIAN BULAN INI</h3>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-4 w-4 text-gray-400" />
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
          <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">Tidak ada data</p>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.teal }}></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Tagihan Pembelian</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.yellow }}></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Pesanan Pembelian</span>
            </div>
          </div>
          <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <MoreVertical className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tagihanPesananData.length > 0 ? tagihanPesananData : [
              { month: 'Jul', tagihan: 0, pesanan: 0 },
              { month: 'Agt', tagihan: 0, pesanan: 0 },
              { month: 'Sep', tagihan: 0, pesanan: 0 },
              { month: 'Okt', tagihan: 0, pesanan: 0 },
              { month: 'Nov', tagihan: 0, pesanan: 0 },
              { month: 'Des', tagihan: 0, pesanan: 0 },
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
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                  return value.toString()
                }}
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
              <Bar 
                dataKey="tagihan" 
                fill={COLORS.teal}
                radius={[8, 8, 0, 0]}
                name="Tagihan Pembelian"
              />
              <Bar 
                dataKey="pesanan" 
                fill={COLORS.yellow}
                radius={[8, 8, 0, 0]}
                name="Pesanan Pembelian"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PEMBAYARAN */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PEMBAYARAN
            </h2>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pembayaranData.length > 0 ? pembayaranData : [
                { month: 'Jul', pembelian: 0 },
                { month: 'Agt', pembelian: 0 },
                { month: 'Sep', pembelian: 0 },
                { month: 'Okt', pembelian: 0 },
                { month: 'Nov', pembelian: 0 },
                { month: 'Des', pembelian: 0 },
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
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                    return formatNumber(value)
                  }}
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
                  dataKey="pembelian" 
                  stroke={COLORS.teal} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Pembelian"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PEMBELIAN PER VENDOR BULAN INI */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PEMBELIAN PER VENDOR BULAN INI
            </h2>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="h-64">
            {pembelianPerVendorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pembelianPerVendorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6B7280" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(value)}
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
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">Tidak ada data</p>
              </div>
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

