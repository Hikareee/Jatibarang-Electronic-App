import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { MoreVertical, ChevronDown, MessageCircle, Loader2 } from 'lucide-react'
import { useDashboardData } from '../../hooks/useDashboardData'

const COLORS = {
  pink: '#EC4899',
  yellow: '#F59E0B',
  teal: '#14B8A6',
  blue: '#3B82F6',
  purple: '#A855F7',
  red: '#EF4444',
}

// Format number to Indonesian format
function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(num)
}

export default function DashboardContent() {
  const { data, loading, error } = useDashboardData()

  // Use Firestore data or show zeros - handle null/undefined safely
  const cashInfo = (data?.cash?.info && typeof data.cash.info === 'object') 
    ? data.cash.info 
    : { saldoKledo: 0, saldoBank: 0 }
  const cashChartData = (data?.cash?.chartData && Array.isArray(data.cash.chartData) && data.cash.chartData.length > 0)
    ? data.cash.chartData 
    : [
        { month: 'Jul', value: 0 },
        { month: 'Agu', value: 0 },
        { month: 'Sep', value: 0 },
        { month: 'Okt', value: 0 },
        { month: 'Nov', value: 0 },
        { month: 'Des', value: 0 },
      ]

  const billsInfo = (data?.bills?.info && typeof data.bills.info === 'object')
    ? data.bills.info 
    : { 
        menungguPembayaran: 0, 
        totalMenunggu: 0, 
        jatuhTempo: 0, 
        totalJatuhTempo: 0 
      }
  const billsChartData = (data?.bills?.chartData && Array.isArray(data.bills.chartData) && data.bills.chartData.length > 0)
    ? data.bills.chartData 
    : [
        { period: '<1 months', amount: 0 },
        { period: '1 months', amount: 0 },
        { period: '2 months', amount: 0 },
        { period: '3 months', amount: 0 },
        { period: 'Older', amount: 0 },
      ]

  const bankAccountInfo = (data?.bankAccount?.info && typeof data.bankAccount.info === 'object')
    ? data.bankAccount.info 
    : { saldoKledo: 0, saldoBank: 0 }
  const bankAccountChartData = (data?.bankAccount?.chartData && Array.isArray(data.bankAccount.chartData) && data.bankAccount.chartData.length > 0)
    ? data.bankAccount.chartData 
    : [
        { month: 'Jul', value: 0 },
        { month: 'Agu', value: 0 },
        { month: 'Sep', value: 0 },
        { month: 'Okt', value: 0 },
        { month: 'Nov', value: 0 },
        { month: 'Des', value: 0 },
      ]

  // Expenses for donut chart
  const expensesData = (data?.expenses && Array.isArray(data.expenses) && data.expenses.length > 0)
    ? data.expenses.map(expense => ({
        name: expense.name,
        value: expense.value || 0,
        color: expense.color || COLORS.pink
      }))
    : []

  // GIRO data
  const giroInfo = (data?.giro?.info && typeof data.giro.info === 'object') 
    ? data.giro.info 
    : { saldoKledo: 0, saldoBank: 0 }
  const giroChartData = (data?.giro?.chartData && Array.isArray(data.giro.chartData) && data.giro.chartData.length > 0)
    ? data.giro.chartData 
    : [
        { month: 'Jul', value: 0 },
        { month: 'Agt', value: 0 },
        { month: 'Sep', value: 0 },
        { month: 'Okt', value: 0 },
        { month: 'Nov', value: 0 },
        { month: 'Des', value: 0 },
      ]

  // Expense list data (for list view)
  const expenseListData = (data?.expenses && Array.isArray(data.expenses) && data.expenses.length > 0)
    ? data.expenses 
    : []
  const totalExpenses = expenseListData.reduce((sum, item) => sum + (item?.value || 0), 0)

  // Cash flow data
  const cashFlowData = (data?.cashFlow && Array.isArray(data.cashFlow) && data.cashFlow.length > 0)
    ? data.cashFlow 
    : [
        { month: 'Jul', net: 0, in: 0, out: 0 },
        { month: 'Agt', net: 0, in: 0, out: 0 },
        { month: 'Sep', net: 0, in: 0, out: 0 },
        { month: 'Okt', net: 0, in: 0, out: 0 },
        { month: 'Nov', net: 0, in: 0, out: 0 },
        { month: 'Des', net: 0, in: 0, out: 0 },
      ]

  // Profit & Loss data
  const profitLossInfo = (data?.profitLoss?.info && typeof data.profitLoss.info === 'object')
    ? data.profitLoss.info 
    : { labaBersihTahunIni: 0 }
  const profitLossChartData = (data?.profitLoss?.chartData && Array.isArray(data.profitLoss.chartData) && data.profitLoss.chartData.length > 0)
    ? data.profitLoss.chartData 
    : [
        { month: 'Jul', labaKotor: 0, labaBersih: 0 },
        { month: 'Agt', labaKotor: 0, labaBersih: 0 },
        { month: 'Sep', labaKotor: 0, labaBersih: 0 },
        { month: 'Okt', labaKotor: 0, labaBersih: 0 },
        { month: 'Nov', labaKotor: 0, labaBersih: 0 },
        { month: 'Des', labaKotor: 0, labaBersih: 0 },
      ]

  // Summary boxes data
  const summaryBoxes = (data?.summaryBoxes && Array.isArray(data.summaryBoxes) && data.summaryBoxes.length > 0)
    ? data.summaryBoxes 
    : [
        { title: 'Rekening Bank', value1: 0, value2: 0, account: '1-10002' },
        { title: 'Giro', value1: 0, value2: 0, account: '1-10003' },
        { title: 'Piutang Usaha', value1: 0, value2: 0, account: '1-10100' },
      ]

  // Debt & Receivables data
  const debtReceivablesInfo = (data?.debtReceivables?.info && typeof data.debtReceivables.info === 'object')
    ? data.debtReceivables.info 
    : { 
        jumlahHutang: 0, 
        totalHutang: 0, 
        jumlahPiutang: 0, 
        totalPiutang: 0 
      }
  const debtReceivablesChartData = (data?.debtReceivables?.chartData && Array.isArray(data.debtReceivables.chartData) && data.debtReceivables.chartData.length > 0)
    ? data.debtReceivables.chartData 
    : [
        { month: 'Jul', piutang: 0, hutang: 0, net: 0 },
        { month: 'Agt', piutang: 0, hutang: 0, net: 0 },
        { month: 'Sep', piutang: 0, hutang: 0, net: 0 },
        { month: 'Okt', piutang: 0, hutang: 0, net: 0 },
        { month: 'Nov', piutang: 0, hutang: 0, net: 0 },
        { month: 'Des', piutang: 0, hutang: 0, net: 0 },
      ]

  // Customer Bills data
  const customerBillsInfo = (data?.customerBills?.info && typeof data.customerBills.info === 'object')
    ? data.customerBills.info 
    : { 
        menungguPembayaran: 0, 
        totalMenunggu: 0, 
        jatuhTempo: 0, 
        totalJatuhTempo: 0 
      }
  const customerBillsChartData = (data?.customerBills?.chartData && Array.isArray(data.customerBills.chartData) && data.customerBills.chartData.length > 0)
    ? data.customerBills.chartData 
    : [
        { period: '<1 months', amount: 0 },
        { period: '1 months', amount: 0 },
        { period: '2 months', amount: 0 },
        { period: '3 months', amount: 0 },
        { period: 'Older', amount: 0 },
      ]

  // Show loading only briefly, then show dashboard with zeros
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat data dashboard...</p>
        </div>
      </div>
    )
  }

  // Show error message but still render dashboard
  if (error) {
    console.warn('Dashboard data error:', error)
  }
  return (
    <div className="space-y-6">
      {/* Original Layout: CASH, TAGIHAN, BANK ACCOUNT, BIAYA BULAN LALU */}
      <div className="space-y-6">
        {/* Top Row - CASH and TAGIHAN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CASH Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CASH.</h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Saldo di kledo</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(cashInfo.saldoKledo || cashInfo.value1 || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Saldo di bank</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(cashInfo.saldoBank || cashInfo.value2 || 0)}
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashChartData}>
                  <defs>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.pink} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.pink} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                    domain={[0, 35000000]}
                  />
                  <Tooltip 
                    formatter={(value) => formatNumber(value)}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={COLORS.pink} 
                    fillOpacity={1} 
                    fill="url(#colorCash)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TAGIHAN YANG PERLU KAMU BAYAR Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                TAGIHAN YANG PERLU KAMU BAYAR.
              </h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
      </div>

            <div className="mb-4 space-y-2">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {billsInfo.menungguPembayaran || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Menunggu pembayaran </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(billsInfo.totalMenunggu || 0)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {billsInfo.jatuhTempo || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Jatuh tempo </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(billsInfo.totalJatuhTempo || 0)}
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={billsChartData}>
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
                    domain={[0, 10000000]}
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
                    dataKey="amount" 
                    radius={[8, 8, 0, 0]}
                  >
                    {billsChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? COLORS.pink : index === 1 ? COLORS.yellow : '#E5E7EB'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row - BANK ACCOUNT and BIAYA BULAN LALU */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BANK ACCOUNT Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">BANK ACCOUNT.</h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Saldo di kledo</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(bankAccountInfo.saldoKledo || bankAccountInfo.value1 || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Saldo di bank</span>
                <span className={`font-semibold ${
                  (bankAccountInfo.saldoBank || bankAccountInfo.value2 || 0) < 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {formatNumber(bankAccountInfo.saldoBank || bankAccountInfo.value2 || 0)}
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bankAccountChartData}>
                  <defs>
                    <linearGradient id="colorBank" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                    domain={[0, 18000000]}
                  />
                  <Tooltip 
                    formatter={(value) => formatNumber(value)}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={COLORS.yellow} 
                    fillOpacity={1} 
                    fill="url(#colorBank)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BIAYA BULAN LALU Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                BIAYA BULAN LALU.
              </h2>
              <div className="flex items-center gap-2">
                <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <MoreVertical className="h-5 w-5 text-gray-400" />
                </button>
              </div>
                </div>

            <div className="flex gap-6">
              {/* Legend */}
              <div className="flex-1 space-y-2">
                {expensesData.length > 0 ? (
                  expensesData.map((expense, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: expense.color }}
                      ></div>
                      <span className="text-gray-700 dark:text-gray-300">{expense.name}</span>
                  </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data
                  </div>
                )}
              </div>

              {/* Donut Chart */}
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesData.length > 0 ? expensesData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expensesData.length > 0 ? (
                        expensesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      ) : (
                        <Cell fill="#E5E7EB" />
                      )}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatNumber(value)}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Layout: GIRO, Cash Flow, Profit & Loss */}
      <div className="space-y-6 mt-6">
        {/* GIRO Section - Full Width */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">GIRO.</h2>
            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Saldo di kledo</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNumber(giroInfo.saldoKledo || giroInfo.value1 || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Saldo di bank</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNumber(giroInfo.saldoBank || giroInfo.value2 || 0)}
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={giroChartData}>
                <defs>
                  <linearGradient id="colorGiro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                  domain={[0, 50000000]}
                />
                <Tooltip 
                  formatter={(value) => formatNumber(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={COLORS.teal} 
                  fillOpacity={1} 
                  fill="url(#colorGiro)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row - TOTAL KELUAR MASUK KAS and LABA RUGI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TOTAL KELUAR MASUK KAS Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                TOTAL KELUAR MASUK KAS.
              </h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6B7280"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    tick={{ fontSize: 12 }}
                    domain={[0, 1]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke={COLORS.purple} 
                    strokeWidth={2}
                    name="Net"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="in" 
                    stroke={COLORS.teal} 
                    strokeWidth={2}
                    name="In"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="out" 
                    stroke={COLORS.red} 
                    strokeWidth={2}
                    name="Out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LABA RUGI Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LABA RUGI.</h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Laba bersih tahun ini{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(profitLossInfo.labaBersihTahunIni || 0)}
                </span>
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitLossChartData}>
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
                    domain={[0, 40000000]}
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
                    dataKey="labaKotor" 
                    fill={COLORS.teal}
                    radius={[8, 8, 0, 0]}
                    name="Laba kotor"
                  />
                  <Bar 
                    dataKey="labaBersih" 
                    fill={COLORS.yellow}
                    radius={[8, 8, 0, 0]}
                    name="Laba bersih"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Third Layout: Debt & Receivables, Customer Bills */}
      <div className="space-y-6 mt-6">
        {/* Debt & Receivables and Customer Bills Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HUTANG & PIUTANG Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                HUTANG & PIUTANG.
          </h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {debtReceivablesInfo.jumlahHutang || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Hutang </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(debtReceivablesInfo.totalHutang || 0)}
                </span>
                  </div>
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {debtReceivablesInfo.jumlahPiutang || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Piutang </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(debtReceivablesInfo.totalPiutang || 0)}
                  </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={debtReceivablesChartData}>
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
                    domain={[-15000000, 35000000]}
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
                    dataKey="piutang" 
                    fill={COLORS.teal}
                    radius={[8, 8, 0, 0]}
                    name="Piutang"
                  />
                  <Bar 
                    dataKey="hutang" 
                    fill={COLORS.red}
                    radius={[8, 8, 0, 0]}
                    name="Hutang"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke={COLORS.purple} 
                    strokeWidth={2}
                    name="Net"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TAGIHAN PELANGGAN TERHUTANG Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                TAGIHAN PELANGGAN TERHUTANG.
              </h2>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="h-5 w-5 text-gray-400" />
                </button>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {customerBillsInfo.menungguPembayaran || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Menunggu pembayaran </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(customerBillsInfo.totalMenunggu || 0)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {customerBillsInfo.jatuhTempo || 0}{' '}
                </span>
                <span className="text-gray-700 dark:text-gray-300">Jatuh tempo </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(customerBillsInfo.totalJatuhTempo || 0)}
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerBillsChartData}>
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
                    domain={[0, 30000000]}
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
                    dataKey="amount" 
                    radius={[8, 8, 0, 0]}
                  >
                    {customerBillsChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? COLORS.pink : index === 1 ? COLORS.yellow : '#E5E7EB'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
