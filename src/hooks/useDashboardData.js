import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

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

        // Helper function to safely fetch collection
        const safeGetDocs = async (collectionPath, orderByField = 'order') => {
          try {
            const colRef = collection(db, ...collectionPath)
            const q = query(colRef, orderBy(orderByField))
            return await getDocs(q)
          } catch (err) {
            console.warn(`Collection ${collectionPath.join('/')} not found or error:`, err)
            // Return a mock snapshot-like object
            return { 
              docs: [],
              empty: true,
              size: 0
            }
          }
        }

        // Helper function to safely fetch document
        const safeGetDoc = async (docPath) => {
          try {
            return await getDoc(doc(db, ...docPath))
          } catch (err) {
            console.warn(`Document ${docPath.join('/')} not found or error:`, err)
            // Return a mock document-like object
            return { 
              exists: () => false, 
              data: () => null,
              id: docPath[docPath.length - 1]
            }
          }
        }

        // Fetch all dashboard data with error handling
        const [
          cashDoc,
          cashChartSnapshot,
          accountsSnapshot,
          billsDoc,
          billsChartSnapshot,
          bankAccountDoc,
          bankAccountChartSnapshot,
          expensesSnapshot,
          giroDoc,
          giroChartSnapshot,
          cashFlowSnapshot,
          profitLossDoc,
          profitLossSnapshot,
          summaryBoxesSnapshot,
          debtReceivablesDoc,
          debtReceivablesSnapshot,
          customerBillsDoc,
          customerBillsSnapshot,
        ] = await Promise.all([
          safeGetDoc(['dashboard', 'cash']),
          safeGetDocs(['dashboard', 'cash', 'chartData'], 'order'),
          safeGetDocs(['accounts'], 'code'),
          safeGetDoc(['dashboard', 'bills']),
          safeGetDocs(['dashboard', 'bills', 'chartData'], 'order'),
          safeGetDoc(['dashboard', 'bankAccount']),
          safeGetDocs(['dashboard', 'bankAccount', 'chartData'], 'order'),
          safeGetDocs(['dashboard', 'expenses', 'items'], 'value'),
          safeGetDoc(['dashboard', 'giro']),
          safeGetDocs(['dashboard', 'giro', 'chartData'], 'order'),
          safeGetDocs(['dashboard', 'cashFlow', 'chartData'], 'order'),
          safeGetDoc(['dashboard', 'profitLoss']),
          safeGetDocs(['dashboard', 'profitLoss', 'chartData'], 'order'),
          safeGetDocs(['dashboard', 'summaryBoxes', 'items'], 'order'),
          safeGetDoc(['dashboard', 'debtReceivables']),
          safeGetDocs(['dashboard', 'debtReceivables', 'chartData'], 'order'),
          safeGetDoc(['dashboard', 'customerBills']),
          safeGetDocs(['dashboard', 'customerBills', 'chartData'], 'order'),
        ])

        // Process CASH data using accounts collection
        const accountsData = accountsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        const totalSaldo = accountsData.reduce((sum, a) => sum + (parseFloat(a.saldo) || 0), 0)
        const cashInfo = cashDoc.exists() ? cashDoc.data() : { saldoKledo: totalSaldo, saldoBank: 0 }
        const cashChartData = accountsData.length > 0
          ? accountsData.map(acc => ({
              name: acc.name || acc.code || 'Akun',
              value: parseFloat(acc.saldo) || 0,
            }))
          : cashChartSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }))

        // Process Bills data
        const billsInfo = billsDoc.exists() ? billsDoc.data() : null
        const billsChartData = billsChartSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process Bank Account data
        const bankAccountInfo = bankAccountDoc.exists() ? bankAccountDoc.data() : null
        const bankAccountChartData = bankAccountChartSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process expenses (for donut chart)
        const expensesList = expensesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process GIRO data
        const giroInfo = giroDoc.exists() ? giroDoc.data() : null
        const giroChartData = giroChartSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process cash flow
        const cashFlowData = cashFlowSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process profit & loss
        const profitLossInfo = profitLossDoc.exists() ? profitLossDoc.data() : null
        const profitLossChartData = profitLossSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process summary boxes
        const summaryBoxesData = summaryBoxesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process debt & receivables
        const debtReceivablesInfo = debtReceivablesDoc.exists() ? debtReceivablesDoc.data() : null
        const debtReceivablesChartData = debtReceivablesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        // Process customer bills
        const customerBillsInfo = customerBillsDoc.exists() ? customerBillsDoc.data() : null
        const customerBillsChartData = customerBillsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        setData({
          cash: {
            info: cashInfo,
            chartData: cashChartData,
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

