import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  ChevronLeft, 
  Loader2,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useInvoiceDetail } from '../hooks/useInvoiceDetail'
import { useProducts } from '../hooks/useProductsData'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import jsPDF from 'jspdf'
import { uploadPaymentProof } from '../firebase/supabaseClient'
import { v4 as uuidv4 } from 'uuid'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { invoice, loading, error, updateInvoice } = useInvoiceDetail(id)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentPercent, setPaymentPercent] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentFile, setPaymentFile] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const { products } = useProducts()
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false)
  const [deliveryStatusMenuOpen, setDeliveryStatusMenuOpen] = useState(false)

  const productNameById = useMemo(() => {
    if (!Array.isArray(products)) return {}
    const map = {}
    for (const p of products) {
      if (!p || !p.id) continue
      map[p.id] = p.nama || p.name || p.kode || ''
    }
    return map
  }, [products])

  const formatNumberCommas = (num) => {
    const n = Number(num || 0)
    if (!Number.isFinite(n)) return '0'
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
  }

  const formatRp = (num) => `Rp${formatNumberCommas(num)}`

  const formatDateDash = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ''
    return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`
  }

  const toTitleCase = (s) =>
    String(s || '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const terbilang = (n) => {
    const num = Math.floor(Number(n || 0))
    if (!Number.isFinite(num) || num === 0) return 'Nol'

    const satuan = [
      '',
      'satu',
      'dua',
      'tiga',
      'empat',
      'lima',
      'enam',
      'tujuh',
      'delapan',
      'sembilan',
      'sepuluh',
      'sebelas'
    ]

    const spell = (x) => {
      if (x < 12) return satuan[x]
      if (x < 20) return `${spell(x - 10)} belas`
      if (x < 100) return `${spell(Math.floor(x / 10))} puluh ${spell(x % 10)}`.trim()
      if (x < 200) return `seratus ${spell(x - 100)}`.trim()
      if (x < 1000) return `${spell(Math.floor(x / 100))} ratus ${spell(x % 100)}`.trim()
      if (x < 2000) return `seribu ${spell(x - 1000)}`.trim()
      if (x < 1000000) return `${spell(Math.floor(x / 1000))} ribu ${spell(x % 1000)}`.trim()
      if (x < 1000000000) return `${spell(Math.floor(x / 1000000))} juta ${spell(x % 1000000)}`.trim()
      if (x < 1000000000000)
        return `${spell(Math.floor(x / 1000000000))} milyar ${spell(x % 1000000000)}`.trim()
      return `${spell(Math.floor(x / 1000000000000))} triliun ${spell(x % 1000000000000)}`.trim()
    }

    return toTitleCase(spell(num))
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

  // Get delivery status label
  const getDeliveryStatusLabel = (deliveryStatus) => {
    if (deliveryStatus === 100) return 'Selesai'
    if (deliveryStatus > 0) return 'Dalam Proses'
    return 'Open'
  }

  // Get delivery status color
  const getDeliveryStatusColor = (deliveryStatus) => {
    if (deliveryStatus === 100) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    }
    if (deliveryStatus > 0) {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    }
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
  }

  const handleDeliveryStatusUpdate = async (newStatus) => {
    try {
      const invoiceRef = doc(db, 'invoices', id)
      await updateDoc(invoiceRef, {
        deliveryStatus: newStatus,
        updatedAt: new Date().toISOString()
      })
      
      await updateInvoice({ deliveryStatus: newStatus })
      setDeliveryStatusMenuOpen(false)
      alert(`Status pengiriman diperbarui menjadi ${newStatus}%`)
    } catch (err) {
      console.error('Error updating delivery status:', err)
      alert('Gagal memperbarui status pengiriman')
    }
  }

  const deliveryStatusOptions = [0, 25, 50, 75, 100]

  const cumulativePaidPercent = useMemo(() => {
    const list = Array.isArray(invoice?.payments) ? invoice.payments : []
    return list.reduce((s, p) => s + (Number(p.percent) || 0), 0)
  }, [invoice])

  const handleAddPayment = async () => {
    try {
      setPaymentError('')
      const percent = Number(paymentPercent)
      if (!Number.isFinite(percent) || percent <= 0) {
        setPaymentError('Persentase tidak valid')
        return
      }
      const remaining = 100 - cumulativePaidPercent
      if (percent > remaining + 1e-6) {
        setPaymentError(`Maksimal ${remaining}% (sisa)`) 
        return
      }
      if (!paymentFile) {
        setPaymentError('File bukti pembayaran wajib diunggah')
        return
      }

      setAddingPayment(true)
      // Compute grandTotal using same logic as PDF
      const items = Array.isArray(invoice.items) ? invoice.items : []
      const vatRate = Number(invoice.vatRate ?? 0)
      const dpp = items.reduce((sum, item) => {
        const q = Number(item.quantity || 0)
        const pr = Number(item.price || 0)
        const disc = Number(item.discount || 0)
        const sub = q * pr
        const d = sub * (disc / 100)
        return sum + (sub - d)
      }, 0)
      const vat = vatRate > 0 ? dpp * (vatRate / 100) : 0
      const subTotal = dpp + vat
      const explicitPph = Number(invoice.pph?.value ?? invoice.pphValue ?? NaN)
      const explicitPphRate = Number(invoice.pph?.rate ?? invoice.pphRate ?? NaN)
      const pph = Number.isFinite(explicitPph) ? explicitPph : (Number.isFinite(explicitPphRate) ? dpp * (explicitPphRate / 100) : 0)
      const grandTotal = Number.isFinite(Number(invoice.total)) ? Number(invoice.total) : (subTotal - pph)

      const fileMeta = await uploadPaymentProof(paymentFile, id, 'payments')

      const paymentRecord = {
        id: uuidv4(),
        percent,
        amount: Math.round((grandTotal * percent) / 100),
        note: paymentNote || '',
        file: fileMeta,
        createdAt: new Date().toISOString(),
      }

      const newPayments = [ ...(invoice.payments || []), paymentRecord ]
      const newTotalPercent = newPayments.reduce((s, p) => s + (Number(p.percent) || 0), 0)
      const isPaidOff = Math.abs(newTotalPercent - 100) < 1e-6 || newTotalPercent >= 100

      const invoiceRef = doc(db, 'invoices', id)
      await updateDoc(invoiceRef, {
        payments: newPayments,
        paymentStatus: {
          totalPercent: Math.min(newTotalPercent, 100),
          isPaidOff,
          lastUpdatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      })

      await updateInvoice({ payments: newPayments, paymentStatus: { totalPercent: Math.min(newTotalPercent, 100), isPaidOff } })

      // reset form
      setPaymentPercent('')
      setPaymentNote('')
      setPaymentFile(null)
    } catch (err) {
      console.error('Add payment error', err)
      setPaymentError(err.message || 'Gagal menambahkan pembayaran')
    } finally {
      setAddingPayment(false)
    }
  }

  const handleExportPdf = () => {
    if (!invoice) return

    const docPdf = new jsPDF('p', 'pt', 'a4')

    const marginLeft = 40
    let cursorY = 40

    const companyName = invoice.companyName || 'PT. INTEGRASI BANGUN PERKASA'
    const companyAddress =
      invoice.companyAddress ||
      'Jl. Raya Bandengan Mundu No. 09 Ds. Bandengan Kec. Mundu Kab. Cirebon Kode Pos 45173'
    const companyPhone = invoice.companyPhone || '0818345654'
    const companyEmail = invoice.companyEmail || 'integrasibangunperkasa@gmail.com'
    const companyContact = `Telp. ${companyPhone}, Email :${companyEmail}`
    const companyContactKwitansi = `Telp. ${companyPhone}, Email ${companyEmail}`

    const bankName = invoice.bankName || 'BANK MANDIRI'
    const bankAccountNo = invoice.bankAccountNo || '134-00-5000001-6'
    const bankAccountName = invoice.bankAccountName || companyName
    const signName = invoice.signName || 'Wempi'
    const signTitle = invoice.signTitle || 'Direktur'

    const invoiceNumber = invoice.number || '-'
    const customerName = invoice.customerName || invoice.customer || '-'
    const customerAddress = invoice.customerAddress || ''
    const attn = invoice.attn || ''
    const invoiceDateDash = formatDateDash(invoice.transactionDate || invoice.createdAt) || ''

    const items = Array.isArray(invoice.items) ? invoice.items : []
    const vatRate = Number(invoice.vatRate ?? 11)
    const totalBeforeTax = items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0)
      const price = Number(item.price || 0)
      const discount = Number(item.discount || 0)
      const itemSubtotal = quantity * price
      const itemDiscount = itemSubtotal * (discount / 100)
      return sum + (itemSubtotal - itemDiscount)
    }, 0)
    const totalTax =
      Number.isFinite(vatRate) && vatRate > 0 ? totalBeforeTax * (vatRate / 100) : 0
    const subTotal = totalBeforeTax + totalTax
    const explicitPph = Number(invoice.pph?.value ?? invoice.pphValue ?? invoice.pph ?? NaN)
    const explicitPphRate = Number(invoice.pph?.rate ?? invoice.pphRate ?? NaN)
    const pph = Number.isFinite(explicitPph)
      ? explicitPph
      : (Number.isFinite(explicitPphRate) ? totalBeforeTax * (explicitPphRate / 100) : 0)
    const grandTotal = Number.isFinite(Number(invoice.total))
      ? Number(invoice.total)
      : subTotal - pph

    const poNumber = invoice.poNumber || invoice.reference || ''
    const poDate = invoice.poDate || ''
    const sphNumber = invoice.sphNumber || ''
    const jobTitle = invoice.jobTitle || ''

    const workItems = Array.isArray(invoice.workItems)
      ? invoice.workItems
      : (typeof invoice.workItems === 'string' ? invoice.workItems.split('\n') : [])

    // ---- Page 1: INVOICE ----
    docPdf.setFont('Helvetica', 'normal')
    docPdf.setFontSize(10)
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text(companyName, marginLeft, cursorY)
    cursorY += 14
    docPdf.setFont('Helvetica', 'normal')
    docPdf.setFontSize(9)
    docPdf.text(companyAddress, marginLeft, cursorY)
    cursorY += 12
    docPdf.text(companyContact, marginLeft, cursorY)

    cursorY += 18
    docPdf.setFont('Helvetica', 'bold')
    docPdf.setFontSize(14)
    docPdf.text('INVOICE', marginLeft, cursorY)

    cursorY += 20
    docPdf.setFont('Helvetica', 'normal')
    docPdf.setFontSize(9)

    docPdf.text('Customer :', marginLeft, cursorY)
    docPdf.text(customerName, marginLeft + 70, cursorY)
    docPdf.text('No Invoice :', marginLeft + 300, cursorY)
    docPdf.text(invoiceNumber, marginLeft + 370, cursorY)

    cursorY += 14
    if (customerAddress) {
      const addr = docPdf.splitTextToSize(customerAddress, 260)
      docPdf.text(addr, marginLeft + 70, cursorY)
    }
    docPdf.text('DATE', marginLeft + 370, cursorY)
    docPdf.text(invoiceDateDash || '-', marginLeft + 410, cursorY)

    if (attn) {
      cursorY += 28
      docPdf.text(`Attn. ${attn}`, marginLeft + 70, cursorY)
    }

    cursorY += 30
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text('NO', marginLeft, cursorY)
    docPdf.text('DESCRIPTION', marginLeft + 30, cursorY)
    docPdf.text('SPEK', marginLeft + 230, cursorY)
    docPdf.text('QTY', marginLeft + 290, cursorY)
    docPdf.text('SATUAN', marginLeft + 330, cursorY)
  // Position HARSAT header further left (away from TOTAL) and left-align
  const xHarsat = marginLeft + 400
  const xTotal = marginLeft + 520
  docPdf.text('HARSAT', xHarsat, cursorY)
  docPdf.text('TOTAL', xTotal, cursorY, { align: 'right' })

    cursorY += 8
    docPdf.setLineWidth(0.7)
    docPdf.line(marginLeft, cursorY, marginLeft + 520, cursorY)

    cursorY += 16
    docPdf.setFont('Helvetica', 'normal')

    if (jobTitle) {
      docPdf.setFont('Helvetica', 'bold')
      docPdf.text(jobTitle, marginLeft + 30, cursorY)
      docPdf.text('-', marginLeft + 230, cursorY)
      docPdf.setFont('Helvetica', 'normal')
      cursorY += 16
    }

    items.forEach((item, index) => {
      if (cursorY > 560) {
        // leave space for totals + footer blocks; move to next page if needed
        docPdf.addPage()
        cursorY = 40
      }

      const quantity = Number(item.quantity || 0)
      const unit = item.unit || ''
      const price = Number(item.price || 0)
      const discount = Number(item.discount || 0)
      const itemSubtotal = quantity * price
      const itemDiscount = itemSubtotal * (discount / 100)
      const afterDisc = itemSubtotal - itemDiscount
      const itemTotal = Number(item.amount ?? afterDisc)

      const desc = item.description || item.product || '-'
      const spek = item.spek || item.spec || '-'

      docPdf.text(String(index + 1), marginLeft, cursorY)
      docPdf.text(docPdf.splitTextToSize(desc, 190), marginLeft + 30, cursorY)
      docPdf.text(String(spek || '-'), marginLeft + 230, cursorY)
      docPdf.text(quantity ? String(quantity) : '-', marginLeft + 290, cursorY)
      docPdf.text(unit || '', marginLeft + 330, cursorY)
  // Print HARSAT (price) left-aligned under the HARSAT header (moved left)
  docPdf.text(formatNumberCommas(price), xHarsat, cursorY)
  // Print TOTAL aligned to the right under the TOTAL header
  docPdf.text(formatNumberCommas(itemTotal), xTotal, cursorY, { align: 'right' })

      cursorY += 16
    })

    cursorY += 6
    docPdf.setLineWidth(0.7)
    docPdf.line(marginLeft, cursorY, marginLeft + 520, cursorY)

    cursorY += 16
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text('ITEM PEKERJAAN :', marginLeft, cursorY)
    docPdf.setFont('Helvetica', 'normal')

    cursorY += 14
    const derivedWorkItems =
      workItems.length > 0
        ? workItems
        : []

    derivedWorkItems.slice(0, 10).forEach((w, idx) => {
      const raw = String(w || '').trim()
      if (!raw) return
      const cleaned = raw.replace(/^\d+[\.\)]\s*/g, '').replace(/^\-\s*/g, '').trim()
      docPdf.text(`${idx + 1}  ${cleaned}`, marginLeft, cursorY)
      cursorY += 12
    })

    cursorY += 10
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text('REFERENSI', marginLeft, cursorY)
    docPdf.setFont('Helvetica', 'normal')
    cursorY += 14
    docPdf.text('- NO SPH * :', marginLeft, cursorY)
    docPdf.text(sphNumber || '..................................', marginLeft + 90, cursorY)
    cursorY += 12
    docPdf.text('- NO PO * :', marginLeft, cursorY)
    docPdf.text(poNumber || '..................................', marginLeft + 90, cursorY)
    cursorY += 12
    docPdf.text('- TGL PO * :', marginLeft, cursorY)
    docPdf.text(poDate || '..................................', marginLeft + 90, cursorY)

    // Totals block (right)
    const totalsXLabel = marginLeft + 330
    const totalsXValue = marginLeft + 520
    cursorY += 10
    let totalsY = cursorY - 36
    if (totalsY < 420) totalsY = 420

    docPdf.setFont('Helvetica', 'bold')
    docPdf.text('TOTAL', totalsXLabel, totalsY)
    docPdf.text(formatRp(totalBeforeTax), totalsXValue, totalsY, { align: 'right' })
    totalsY += 14
    docPdf.text(`VAT ${Number.isFinite(vatRate) ? vatRate : 11}% (+)`, totalsXLabel, totalsY)
    docPdf.text(formatRp(totalTax), totalsXValue, totalsY, { align: 'right' })
    totalsY += 14
    docPdf.text('SUB TOTAL', totalsXLabel, totalsY)
    docPdf.text(formatRp(subTotal), totalsXValue, totalsY, { align: 'right' })
    totalsY += 14
    docPdf.text('PPH (-)', totalsXLabel, totalsY)
    docPdf.text(formatRp(pph), totalsXValue, totalsY, { align: 'right' })
    totalsY += 14
    docPdf.text('GRAND TOTAL', totalsXLabel, totalsY)
    docPdf.text(formatRp(grandTotal), totalsXValue, totalsY, { align: 'right' })

    // Bank + signature
    let footerY = Math.max(totalsY + 20, 560)
    if (footerY > 730) footerY = 730

    docPdf.setFont('Helvetica', 'bold')
    docPdf.text('PEMBAYARAN DAPAT DI TRF KE :', marginLeft, footerY)
    docPdf.setFont('Helvetica', 'normal')
    footerY += 14
    docPdf.text(bankName, marginLeft, footerY)
    footerY += 12
    docPdf.text('NO. REK', marginLeft, footerY)
    docPdf.text(`: ${bankAccountNo}`, marginLeft + 55, footerY)
    footerY += 12
    docPdf.text('A/N', marginLeft, footerY)
    docPdf.text(`: ${bankAccountName}`, marginLeft + 55, footerY)

    docPdf.text('Regards,', marginLeft + 360, footerY - 26)
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text(companyName, marginLeft + 360, footerY - 12)
    docPdf.setFont('Helvetica', 'normal')
    docPdf.text(signName, marginLeft + 360, footerY + 26)
    docPdf.text(signTitle, marginLeft + 360, footerY + 40)

    // ---- Page 2: KWITANSI ----
    docPdf.addPage()
    cursorY = 40

    docPdf.setFont('Helvetica', 'bold')
    docPdf.setFontSize(10)
    docPdf.text(companyName, marginLeft, cursorY)
    cursorY += 14
    docPdf.setFont('Helvetica', 'normal')
    docPdf.setFontSize(9)
    docPdf.text(`${companyAddress},`, marginLeft, cursorY)
    cursorY += 12
    docPdf.text(companyContactKwitansi, marginLeft, cursorY)

    cursorY += 18
    docPdf.setFont('Helvetica', 'bold')
    docPdf.setFontSize(14)
    docPdf.text('KWITANSI', marginLeft, cursorY)
    cursorY += 16
    docPdf.setFontSize(10)
    docPdf.text(invoiceNumber, marginLeft, cursorY)

    cursorY += 22
    docPdf.setFont('Helvetica', 'normal')
    docPdf.setFontSize(10)
    docPdf.text('Received From', marginLeft, cursorY)
    docPdf.text(':', marginLeft + 110, cursorY)
    docPdf.text(customerName, marginLeft + 125, cursorY)

    cursorY += 18
    docPdf.text('In Number', marginLeft, cursorY)
    docPdf.text(':', marginLeft + 110, cursorY)
    docPdf.text(`${terbilang(grandTotal)}.`, marginLeft + 125, cursorY, { maxWidth: 420 })

    cursorY += 18
    docPdf.text('For Payment', marginLeft, cursorY)
    docPdf.text(':', marginLeft + 110, cursorY)
    docPdf.text('Pembayaran Invoice No * :', marginLeft + 125, cursorY)
    docPdf.text(invoiceNumber, marginLeft + 290, cursorY)

    cursorY += 18
    docPdf.text('Untuk Pekerjaan :', marginLeft + 125, cursorY)

    cursorY += 14
    const kwitansiLines = [
      jobTitle,
      items[0]?.description || items[0]?.product || '',
      items[1]?.description || items[1]?.product || '',
    ].filter((s) => String(s || '').trim())
    kwitansiLines.slice(0, 3).forEach((line) => {
      docPdf.text(docPdf.splitTextToSize(String(line), 420), marginLeft + 125, cursorY)
      cursorY += 12
    })

    cursorY += 12
    docPdf.text('- NO SPH * :', marginLeft + 125, cursorY)
    docPdf.text(sphNumber || '..................................', marginLeft + 210, cursorY)
    cursorY += 12
    docPdf.text('- NO PO * :', marginLeft + 125, cursorY)
    docPdf.text(poNumber || '..................................', marginLeft + 210, cursorY)
    cursorY += 12
    docPdf.text('- TGL PO * :', marginLeft + 125, cursorY)
    docPdf.text(poDate || '..................................', marginLeft + 210, cursorY)

    cursorY += 22
    const city = invoice.city || 'Cirebon'
    docPdf.text(`${city}, ${invoiceDateDash || '-'}`, marginLeft + 360, cursorY)

    cursorY += 22
    docPdf.setFont('Helvetica', 'bold')
    docPdf.text(formatRp(grandTotal), marginLeft + 360, cursorY)

    cursorY += 34
    docPdf.setFont('Helvetica', 'normal')
    docPdf.text(signName.toUpperCase(), marginLeft + 360, cursorY)
    cursorY += 14
    docPdf.text(signTitle, marginLeft + 360, cursorY)

    const safeNumber = String(invoiceNumber || 'invoice').replace(/[^\w\- ]+/g, ' ').trim()
    const fileName = `${safeNumber || 'invoice'}.pdf`
    docPdf.save(fileName)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat detail tagihan...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Tagihan tidak ditemukan'}</p>
        <button
          onClick={() => navigate('/penjualan/tagihan')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Kembali
        </button>
      </div>
    )
  }

  const deliveryStatus = invoice.deliveryStatus || 0
  const deliveryStatusLabel = getDeliveryStatusLabel(deliveryStatus)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Beranda &gt; Penjualan &gt; Tagihan &gt; Detail
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {invoice.number || 'Tagihan'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setDeliveryStatusMenuOpen(!deliveryStatusMenuOpen)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(deliveryStatus)}`}
              >
                {deliveryStatus}% - {deliveryStatusLabel}
                <ChevronDown className="inline h-3 w-3 ml-1" />
              </button>
              {deliveryStatusMenuOpen && (
                <div className="absolute mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10">
                  <div className="py-1">
                    {deliveryStatusOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleDeliveryStatusUpdate(option)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          deliveryStatus === option 
                            ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
          >
            <span>Export PDF</span>
          </button>
          <button 
            onClick={() => navigate('/penjualan/tagihan')}
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
              Pelanggan
            </label>
            <p className="text-lg text-gray-900 dark:text-white">
              {invoice.customerName || invoice.customer || 'N/A'}
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
          {invoice.sourceType === 'pos' &&
          (invoice.posFulfillmentLabel || invoice.posFulfillmentMode) ? (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Pengambilan / layanan
              </label>
              <p className="text-lg text-gray-900 dark:text-white">
                {invoice.posFulfillmentLabel ||
                  String(invoice.posFulfillmentMode || '')}
              </p>
            </div>
          ) : null}
          {invoice.sourceType === 'pos' &&
          (invoice.paymentMethod === 'pay_later' || invoice.posPayLater === true) ? (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Pembayaran
              </label>
              <p className="text-lg font-medium text-amber-800 dark:text-amber-200">
                Bayar nanti (piutang)
                {Number(invoice.posPiutangDueDays) > 0 ? (
                  <span className="block text-sm font-normal text-gray-600 dark:text-gray-400">
                    Target termin ±{invoice.posPiutangDueDays} hari dari tanggal transaksi
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
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
                      Pajak
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
                    
                    const productLabel =
                      item.productName ||
                      productNameById[item.product] ||
                      item.product ||
                      '-'

                    return (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {productLabel}
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

        {/* Total Breakdown - Expandable */}
        {showTotalBreakdown && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rincian Total</h3>
            <div className="flex justify-end">
              <div className="w-full max-w-md">
                <div className="space-y-2">
                  {(() => {
                    const dpp = (invoice.items || []).reduce((sum, item) => {
                      const quantity = Number(item.quantity || 0)
                      const price = Number(item.price || 0)
                      const discount = Number(item.discount || 0)
                      const itemSubtotal = quantity * price
                      const itemDiscount = itemSubtotal * (discount / 100)
                      return sum + (itemSubtotal - itemDiscount)
                    }, 0)

                    const vatRate = Number(invoice.vatRate || 0)
                    const vat = vatRate > 0 ? dpp * (vatRate / 100) : 0
                    const subTotal = dpp + vat

                    const explicitPph = Number(invoice.pph?.value ?? invoice.pphValue ?? NaN)
                    const explicitPphRate = Number(invoice.pph?.rate ?? invoice.pphRate ?? NaN)
                    const pph = Number.isFinite(explicitPph)
                      ? explicitPph
                      : (Number.isFinite(explicitPphRate) ? dpp * (explicitPphRate / 100) : 0)

                    const grandTotal = Number.isFinite(Number(invoice.total))
                      ? Number(invoice.total)
                      : subTotal - pph

                    return (
                      <>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>TOTAL (DPP)</span>
                          <span>{formatNumber(dpp)}</span>
                        </div>
                        {vat > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>VAT {Number.isFinite(vatRate) ? vatRate : 0}% (+)</span>
                            <span>{formatNumber(vat)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>SUB TOTAL</span>
                          <span>{formatNumber(subTotal)}</span>
                        </div>
                        {pph > 0 && (
                          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>PPH (-)</span>
                            <span>{formatNumber(pph)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span>GRAND TOTAL</span>
                          <span>{formatNumber(grandTotal)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

              </div>

      {/* Status Pembayaran - moved to bottom */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Status Pembayaran</h3>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Dibayar: {cumulativePaidPercent}% {invoice?.paymentStatus?.isPaidOff ? '(Lunas)' : ''}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">Sisa: {Math.max(0, 100 - cumulativePaidPercent)}%</div>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded mt-2">
          <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.min(100, cumulativePaidPercent)}%` }}></div>
        </div>

        {Array.isArray(invoice?.payments) && invoice.payments.length > 0 && (
          <div className="mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600 dark:text-gray-400">
                  <th className="text-left py-1">Tanggal</th>
                  <th className="text-left py-1">Persentase</th>
                  <th className="text-left py-1">Nominal</th>
                  <th className="text-left py-1">Catatan</th>
                  <th className="text-left py-1">Bukti</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="text-gray-900 dark:text-white">
                    <td className="py-1">{new Date(p.createdAt).toLocaleString('id-ID')}</td>
                    <td className="py-1">{p.percent}%</td>
                    <td className="py-1">{formatNumber(p.amount)}</td>
                    <td className="py-1">{p.note || '-'}</td>
                    <td className="py-1">{p.file?.url ? <a className="text-blue-600 dark:text-blue-400 underline" href={p.file.url} target="_blank" rel="noreferrer">Buka</a> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!invoice?.paymentStatus?.isPaidOff && (
          <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Persentase</label>
                <input type="number" className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={paymentPercent} onChange={(e)=>setPaymentPercent(e.target.value)} placeholder={`0 - ${Math.max(0, 100 - cumulativePaidPercent)}`} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Catatan (opsional)</label>
                <input type="text" className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={paymentNote} onChange={(e)=>setPaymentNote(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Bukti Pembayaran (wajib)</label>
                <input type="file" className="w-full text-sm" onChange={(e)=> setPaymentFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            {paymentError && <p className="text-xs text-red-600 mt-2">{paymentError}</p>}
            <button onClick={handleAddPayment} disabled={addingPayment} className="mt-3 px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{addingPayment ? 'Menyimpan...' : 'Tambah Pembayaran'}</button>
          </div>
        )}
      </div>

      {/* Lampiran (dari saat membuat invoice) - ditempatkan di bawah Status Pembayaran */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Lampiran</h3>
        {Array.isArray(invoice.attachments) && invoice.attachments.length > 0 ? (
          <ul className="space-y-2">
            {invoice.attachments.map((att, index) => (
              <li
                key={att.path || att.url || `${att.name}-${index}`}
                className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200"
              >
                <span className="truncate max-w-xs">{att.name || `Lampiran ${index + 1}`}</span>
                {att.url ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                  >
                    Buka
                  </a>
                ) : (
                  <span className="ml-2 text-gray-500">No link</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">Tidak ada lampiran.</p>
        )}
      </div>
    </div>
  )
}

