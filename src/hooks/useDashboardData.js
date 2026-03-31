import { useState, useEffect } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(d, months) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1, 0, 0, 0, 0)
}

function monthLabel(d) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return labels[d.getMonth()]
}

function bucketByMonthsPastDue(dueDate, now) {
  if (!dueDate) return '<1 months'
  const due = toDate(dueDate)
  if (!due) return '<1 months'
  const diffMs = now.getTime() - due.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30)
  if (diffMonths < 1) return '<1 months'
  if (diffMonths < 2) return '1 months'
  if (diffMonths < 3) return '2 months'
  if (diffMonths < 4) return '3 months'
  return 'Older'
}

export function useDashboardData() {
  const [data, setData] = useState({
    cash: null,
    bills: null,
    bankAccount: null,
    expenses: null,
    giro: null,
    cashFlow: null,
    profitLoss: null,
    summaryBoxes: null,
    debtReceivables: null,
    customerBills: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)

        const [accountsSnapshot, transactionsSnapshot, expensesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'accounts'), orderBy('code'))),
          getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(1500))),
          getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(1000))),
        ])

        const now = new Date()
        const thisMonthStart = startOfMonth(now)
        const lastMonthStart = addMonths(thisMonthStart, -1)
        const last6Months = Array.from({ length: 6 }).map((_, i) => addMonths(thisMonthStart, -(5 - i)))
        const last6MonthKeys = last6Months.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)

        // Accounts → cash
        const accountsData = accountsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        const totalSaldo = accountsData.reduce((sum, a) => sum + (parseFloat(a.saldo) || 0), 0)
        const cashInfo = { saldoKledo: totalSaldo, saldoBank: 0, total: totalSaldo }

        // Transactions (unified) → bills, customer bills, debt/receivables, cashflow, P&L
        const txs = transactionsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

        const payables = txs.filter((t) => t.type === 'invoice_purchase' && (t.remaining ?? t.total ?? 0) > 0.01)
        const receivables = txs.filter((t) => t.type === 'invoice_sale' && (t.remaining ?? t.total ?? 0) > 0.01)
        const debts = txs.filter((t) => t.type === 'debt' && (t.remaining ?? t.total ?? 0) > 0.01)
        const receivableDocs = txs.filter((t) => t.type === 'receivable' && (t.remaining ?? t.total ?? 0) > 0.01)

        const isOverdue = (t) => {
          const due = toDate(t.dueDate)
          return !!due && due < now
        }

        const billsInfo = {
          menungguPembayaran: payables.filter((t) => !isOverdue(t)).length,
          totalMenunggu: payables.filter((t) => !isOverdue(t)).reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
          jatuhTempo: payables.filter((t) => isOverdue(t)).length,
          totalJatuhTempo: payables.filter((t) => isOverdue(t)).reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
        }

        const customerBillsInfo = {
          menungguPembayaran: receivables.filter((t) => !isOverdue(t)).length,
          totalMenunggu: receivables.filter((t) => !isOverdue(t)).reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
          jatuhTempo: receivables.filter((t) => isOverdue(t)).length,
          totalJatuhTempo: receivables.filter((t) => isOverdue(t)).reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
        }

        const initAgeBuckets = () => [
          { period: '<1 months', amount: 0 },
          { period: '1 months', amount: 0 },
          { period: '2 months', amount: 0 },
          { period: '3 months', amount: 0 },
          { period: 'Older', amount: 0 },
        ]

        const billsChartData = initAgeBuckets()
        for (const t of payables) {
          const bucket = bucketByMonthsPastDue(t.dueDate, now)
          const item = billsChartData.find((b) => b.period === bucket)
          if (item) item.amount += Number(t.remaining ?? t.total ?? 0) || 0
        }

        const customerBillsChartData = initAgeBuckets()
        for (const t of receivables) {
          const bucket = bucketByMonthsPastDue(t.dueDate, now)
          const item = customerBillsChartData.find((b) => b.period === bucket)
          if (item) item.amount += Number(t.remaining ?? t.total ?? 0) || 0
        }

        // Expenses (last month donut) from expenses collection
        const expenses = expensesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        const lastMonthExpenses = expenses.filter((e) => {
          const dt = toDate(e.date || e.createdAt)
          if (!dt) return false
          return dt >= lastMonthStart && dt < thisMonthStart
        })
        const byCategory = new Map()
        for (const e of lastMonthExpenses) {
          const key = (e.accountName || e.account || e.category || e.title || 'Biaya').toString()
          const val = Number(e.total || 0) || 0
          byCategory.set(key, (byCategory.get(key) || 0) + val)
        }
        const expensesList = Array.from(byCategory.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)

        // Cash flow + Profit/Loss (approx from totals created per month)
        const cashFlowData = last6Months.map((m) => {
          const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
          return { key, month: monthLabel(m), net: 0, in: 0, out: 0 }
        })

        const profitLossChartData = last6Months.map((m) => {
          const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
          return { key, month: monthLabel(m), labaKotor: 0, labaBersih: 0 }
        })

        let yearIncome = 0
        let yearOut = 0
        const yearStart = new Date(now.getFullYear(), 0, 1)

        const addToMonth = (arr, dt, field, amount) => {
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
          const idx = last6MonthKeys.indexOf(key)
          if (idx >= 0) arr[idx][field] += amount
        }

        for (const t of txs) {
          const dt = toDate(t.date || t.createdAt)
          if (!dt) continue
          const total = Number(t.total || 0) || 0

          if (t.type === 'invoice_sale') {
            addToMonth(cashFlowData, dt, 'in', total)
            if (dt >= yearStart) yearIncome += total
          }

          if (t.type === 'invoice_purchase' || t.type === 'expense') {
            addToMonth(cashFlowData, dt, 'out', total)
            if (dt >= yearStart) yearOut += total
          }
        }

        for (const row of cashFlowData) {
          row.net = row.in - row.out
        }

        for (let i = 0; i < profitLossChartData.length; i++) {
          const income = cashFlowData[i].in
          const out = cashFlowData[i].out
          profitLossChartData[i].labaKotor = income - out
          profitLossChartData[i].labaBersih = income - out
        }

        const profitLossInfo = { labaBersihTahunIni: yearIncome - yearOut }

        // Debt & Receivables summary + chart (approx from tx totals per month)
        const debtReceivablesInfo = {
          jumlahHutang: debts.length,
          totalHutang: debts.reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
          jumlahPiutang: receivableDocs.length,
          totalPiutang: receivableDocs.reduce((s, t) => s + (Number(t.remaining ?? t.total ?? 0) || 0), 0),
        }

        const debtReceivablesChartData = last6Months.map((m) => ({
          key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
          month: monthLabel(m),
          piutang: 0,
          hutang: 0,
          net: 0,
        }))

        for (const t of [...debts, ...receivableDocs]) {
          const dt = toDate(t.date || t.createdAt)
          if (!dt) continue
          const amt = Number(t.remaining ?? t.total ?? 0) || 0
          if (t.type === 'receivable') addToMonth(debtReceivablesChartData, dt, 'piutang', amt)
          if (t.type === 'debt') addToMonth(debtReceivablesChartData, dt, 'hutang', amt)
        }
        for (const row of debtReceivablesChartData) row.net = row.piutang - row.hutang

        // Bank account + giro sections are currently UI-only; map them to cash totals for now
        const bankAccountInfo = { saldoKledo: totalSaldo, saldoBank: 0, value1: totalSaldo, value2: 0 }
        const bankAccountChartData = last6Months.map((m) => ({
          month: monthLabel(m),
          value: 0,
        }))
        const giroInfo = { saldoKledo: 0, saldoBank: 0, value1: 0, value2: 0 }
        const giroChartData = last6Months.map((m) => ({
          month: monthLabel(m),
          value: 0,
        }))

        // Summary boxes: keep existing fallback behavior by returning empty (DashboardContent has defaults)
        const summaryBoxesData = []

        setData({
          cash: {
            info: cashInfo,
            accounts: accountsData,
          },
          bills: {
            info: billsInfo,
            chartData: billsChartData,
          },
          bankAccount: {
            info: bankAccountInfo,
            chartData: bankAccountChartData,
          },
          expenses: expensesList,
          giro: {
            info: giroInfo,
            chartData: giroChartData,
          },
          cashFlow: cashFlowData,
          profitLoss: {
            info: profitLossInfo,
            chartData: profitLossChartData,
          },
          summaryBoxes: summaryBoxesData,
          debtReceivables: {
            info: debtReceivablesInfo,
            chartData: debtReceivablesChartData,
          },
          customerBills: {
            info: customerBillsInfo,
            chartData: customerBillsChartData,
          },
        })
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err.message)
        // Set empty data structure so component can still render
        setData({
          cash: { info: null, chartData: [] },
          bills: { info: null, chartData: [] },
          bankAccount: { info: null, chartData: [] },
          expenses: [],
          giro: { info: null, chartData: [] },
          cashFlow: [],
          profitLoss: { info: null, chartData: [] },
          summaryBoxes: [],
          debtReceivables: { info: null, chartData: [] },
          customerBills: { info: null, chartData: [] },
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return { data, loading, error }
}

