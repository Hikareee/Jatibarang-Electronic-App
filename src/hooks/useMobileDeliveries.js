import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'

function readinessForRow(row) {
  const unpaid = Number(row.remaining || 0) > 0 || row.paymentMethod === 'pay_later'
  if (unpaid) return { key: 'unpaid', label: 'Belum lunas', tone: 'rose' }
  if (!row.customerAddress) return { key: 'not_ready', label: 'Alamat kurang', tone: 'amber' }
  return { key: 'ready', label: 'Siap kirim', tone: 'emerald' }
}

export function useMobileDeliveries() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const serialQuery = query(
          collection(db, 'itemSerials'),
          where('deliveryEnabled', '==', true)
        )
        const serialSnap = await getDocs(serialQuery)
        const serialRows = serialSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

        const invoiceIds = [...new Set(serialRows.map((row) => row.deliveryInvoiceId).filter(Boolean))]
        const invoicePairs = await Promise.all(
          invoiceIds.map(async (invoiceId) => {
            const invoiceSnap = await getDoc(doc(db, 'invoices', invoiceId))
            return [invoiceId, invoiceSnap.exists() ? { id: invoiceSnap.id, ...invoiceSnap.data() } : null]
          })
        )
        const invoiceById = Object.fromEntries(invoicePairs)

        const expanded = serialRows.map((row) => {
          const invoice = invoiceById[row.deliveryInvoiceId] || null
          const merged = {
            id: `${row.deliveryInvoiceId || 'no_invoice'}:${row.id}`,
            invoiceId: row.deliveryInvoiceId || '',
            invoiceNumber: row.deliveryInvoiceNumber || invoice?.number || '',
            customerName: row.deliveryCustomerName || invoice?.customerName || invoice?.customer || 'Walk-in',
            customerPhone: row.deliveryCustomerPhone || invoice?.customerPhone || '',
            customerAddress: row.deliveryCustomerAddress || invoice?.customerAddress || '',
            paymentMethod: row.deliveryPaymentMethod || invoice?.paymentMethod || '',
            remaining: Number(row.deliveryPaymentRemaining ?? invoice?.remaining ?? 0) || 0,
            paidInFull:
              row.deliveryPaidInFull === true ||
              (Number(row.deliveryPaymentRemaining ?? invoice?.remaining ?? 0) < 1 &&
                (row.deliveryPaymentMethod || invoice?.paymentMethod) !== 'pay_later'),
            serialNumber: row.serialNumber || row.id,
            serialWarehouseId: row.warehouseId || '',
            productName: row.productName || '',
            sku: row.sku || '',
            invoiceStatus: invoice?.status || '',
            deliveryStatus: row.deliveryStatus || 'awaiting_dispatch',
            deliveryStatusLabel: row.deliveryStatusLabel || 'Menunggu dispatch',
            createdAt: invoice?.createdAt || row.soldAt || row.updatedAt || '',
          }
          return {
            ...merged,
            readiness: readinessForRow(merged),
          }
        })
        expanded.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        setRows(expanded)
      } catch (error) {
        console.error('Failed to load mobile deliveries:', error)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const groupedSummary = useMemo(() => {
    const ready = rows.filter((row) => row.readiness.key === 'ready').length
    const unpaid = rows.filter((row) => row.readiness.key === 'unpaid').length
    const active = rows.filter((row) => row.deliveryStatus !== 'delivered').length
    return { ready, unpaid, active }
  }, [rows])

  return { rows, loading, groupedSummary }
}
