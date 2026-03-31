import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useLanguage } from '../contexts/LanguageContext'
import { getDocs, collection, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAccounts } from '../hooks/useAccountsData'
import jsPDF from 'jspdf'
import {
  Star,
  Search,
  Download,
  FileText,
  ChevronDown,
  Loader2,
  Calendar,
  X,
} from 'lucide-react'

/** Company line for Neraca / Neraca Saldo PDFs (unchanged from your data) */
const PDF_COMPANY_NAME = 'PT. INTEGRASI BANGUN PERKASA'
const PDF_FOOTER_CITY = 'Cirebon'

function formatRp(num) {
  const n = Number(num || 0)
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat('id-ID').format(Math.round(abs))
  if (n < 0) return `(${formatted})`
  return formatted
}

function monthNameId(date) {
  const m = date.getMonth()
  const names = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]
  return names[m] || ''
}

function formatTanggalIdShort(dateString) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${monthNameId(d)} ${d.getFullYear()}`
}

function formatTanggalIdUpper(dateString) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${monthNameId(d).toUpperCase()} ${d.getFullYear()}`
}

function toCsvValue(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCsv(filename, headers, rows) {
  const headerLine = headers.map(toCsvValue).join(',')
  const lines = rows.map((r) => r.map(toCsvValue).join(','))
  const csv = [headerLine, ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadPdf(filename, buildPdfFn) {
  const doc = new jsPDF('p', 'pt', 'a4')
  buildPdfFn(doc)
  doc.save(filename)
}

function sumMoney(list, field) {
  return (list || []).reduce((s, it) => s + (Number(it?.[field] || 0) || 0), 0)
}

function normalizeIsoDateInput(value) {
  // value from <input type="date"> is "YYYY-MM-DD"
  // we need comparable range with invoice.transactionDate (also "YYYY-MM-DD")
  return value || ''
}

function buildLabaRugiModel({ salesInvoices, purchaseInvoices, expenses }) {
  // Minimal model aligned to your example PDF:
  // We don't have inventory roll-forward here, so inventory lines are set to 0 and HPP is purchaseInvoices total.
  const penjualan = sumMoney(salesInvoices, 'total')
  const pembelianBersih = sumMoney(purchaseInvoices, 'total')
  const totalHpp = pembelianBersih
  const labaKotor = penjualan - totalHpp

  const biayaOperasi = sumMoney(expenses, 'total')
  const labaRugiUsaha = labaKotor - biayaOperasi

  const pendapatanLainLain = 0
  const biayaLainLain = 0
  const totalPendapatanBiayaLain = pendapatanLainLain - biayaLainLain

  const labaSebelumPajak = labaRugiUsaha + totalPendapatanBiayaLain
  const pajakPenghasilan = 0
  const labaSetelahPajak = labaSebelumPajak - pajakPenghasilan

  return {
    penjualan,
    totalPendapatan: penjualan,

    persediaanAwal: 0,
    pembelianBersih: pembelianBersih,
    barangSiapDijual: pembelianBersih,
    persediaanAkhir: 0,
    totalHPPBar: totalHpp,

    biayaPenjualanLangsung: 0,
    totalHargaPokokPenjualan: totalHpp,
    labaKotor,

    biayaKaryawan: 0,
    biayaUmumAdmin: biayaOperasi,
    totalBiayaOperasi: biayaOperasi,
    labaUsaha: labaRugiUsaha,

    pendapatanLainLain,
    biayaLainLain,
    totalPendapatanBiayaLain,

    labaSebelumPajak,
    pajakPenghasilan,
    labaSetelahPajak,
  }
}

function buildNeracaModel({ accounts, labaTahunanBerjalan }) {
  const byCategory = (cat) => (accounts || []).filter((a) => (a.category || '') === cat)
  const aktivaLancar = byCategory('Kas & Bank')
    .concat(byCategory('Akun Piutang'))
    .concat(byCategory('Persediaan'))
    .concat(byCategory('Aktiva Lancar Lainnya'))

  const aktivaTetap = byCategory('Aktiva Tetap')
  const kewajiban = byCategory('Kewajiban')
  const ekuitas = byCategory('Ekuitas')

  const getLineByKeywords = (list, keywords, negate = false) => {
    const match = (acc) => keywords.some((k) => (acc.name || '').toLowerCase().includes(k.toLowerCase()))
    const sum = (list || [])
      .filter(match)
      .reduce((s, a) => s + (Number(a.saldo) || 0), 0)
    return negate ? -sum : sum
  }

  // Aktiva lancar mapping (best effort by keywords)
  const kasBank = sumMoney(
    aktivaLancar.filter((a) => (a.category || '') === 'Kas & Bank'),
    'saldo'
  )
  const piutangUsaha = getLineByKeywords(byCategory('Akun Piutang'), ['usaha'])
  const piutangPemegangSaham = getLineByKeywords(byCategory('Akun Piutang'), ['pemegang'])
  const piutangLainLain = getLineByKeywords(byCategory('Akun Piutang'), ['lain'])
  const persediaanBarang = sumMoney(byCategory('Persediaan'), 'saldo')

  const uangMukaPembelian = getLineByKeywords(byCategory('Aktiva Lancar Lainnya'), ['uang muka pembelian', 'uang muka'])
  const bebanPajakDibayarDimuka = getLineByKeywords(byCategory('Aktiva Lancar Lainnya'), ['beban', 'pajak', 'dibayar dimuka'])

  const totalAktivaLancar =
    kasBank + piutangUsaha + piutangPemegangSaham + piutangLainLain + persediaanBarang + uangMukaPembelian + bebanPajakDibayarDimuka

  // Aktiva tetap mapping with accumulated depreciation lines
  const fixedList = aktivaTetap
  const grossBy = (kw) =>
    fixedList
      .filter((a) => (a.name || '').toLowerCase().includes(kw) && !(a.name || '').toLowerCase().includes('akumulasi penyusutan'))
      .reduce((s, a) => s + (Number(a.saldo) || 0), 0)
  const accBy = (kw) =>
    fixedList
      .filter((a) => (a.name || '').toLowerCase().includes(kw) && (a.name || '').toLowerCase().includes('akumulasi penyusutan'))
      .reduce((s, a) => s + (Number(a.saldo) || 0), 0)

  const inventarisGross = grossBy('inventaris')
  const inventarisAcc = accBy('inventaris')
  const inventarisNet = inventarisGross + inventarisAcc

  const kendaraanGross = grossBy('kendaraan')
  const kendaraanAcc = accBy('kendaraan')
  const kendaraanNet = kendaraanGross + kendaraanAcc

  const bangunanGross = grossBy('bangunan')
  const bangunanAcc = accBy('bangunan')
  const bangunanNet = bangunanGross + bangunanAcc

  const totalAktivaTetap = inventarisNet + kendaraanNet + bangunanNet
  const totalAktiva = totalAktivaLancar + totalAktivaTetap

  // Liabilities mapping
  const hutangLancarTotal = sumMoney(kewajiban, 'saldo')
  const hutangUsaha = getLineByKeywords(kewajiban, ['hutang usaha'])
  const hutangLain = getLineByKeywords(kewajiban, ['hutang lain'])
  const hutangPajak = getLineByKeywords(kewajiban, ['hutang pajak'])
  const hutangLeasing = getLineByKeywords(kewajiban, ['leasing'])
  const hutangBank = getLineByKeywords(kewajiban, ['bank'])
  const uangMukaPenjualan = getLineByKeywords(kewajiban, ['uang muka penjualan'])
  const biayaYmhDibayar = getLineByKeywords(kewajiban, ['yMH', 'y m h', 'dibayar'])

  // Equity mapping
  const modalDisetor = getLineByKeywords(ekuitas, ['modal'])
  const labaDitahan = getLineByKeywords(ekuitas, ['ditahan'])
  const labaTahunBerjalan =
    // If you have an account for it, use it; otherwise fall back to computed labaTahunanBerjalan
    (() => {
      const exact = (ekuitas || []).find((a) => (a.name || '').toLowerCase().includes('tahun berjalan'))
      if (exact && Number.isFinite(Number(exact.saldo))) return Number(exact.saldo) || labaTahunanBerjalan
      return labaTahunanBerjalan
    })()

  const totalModal = modalDisetor + labaDitahan + labaTahunBerjalan

  return {
    kasBank,
    piutangUsaha,
    piutangPemegangSaham,
    piutangLainLain,
    persediaanBarang,
    uangMukaPembelian,
    bebanPajakDibayarDimuka,
    totalAktivaLancar,

    inventarisGross,
    inventarisAcc,
    inventarisNet,
    kendaraanGross,
    kendaraanAcc,
    kendaraanNet,
    bangunanGross,
    bangunanAcc,
    bangunanNet,
    totalAktivaTetap,
    totalAktiva,

    hutangUsaha,
    hutangLain,
    hutangPajak,
    hutangLeasing,
    hutangBank,
    uangMukaPenjualan,
    biayaYmhDibayar,
    hutangLancarTotal,

    modalDisetor,
    labaDitahan,
    labaTahunBerjalan,
    totalModal,
    totalHutangModal: hutangLancarTotal + totalModal,
  }
}

function alignRight(docPdf, text, x, y, opts) {
  // Draw text aligned right using getTextWidth.
  const options = opts || {}
  const align = options.align || 'right'
  if (align !== 'right') {
    docPdf.text(text, x, y, options)
    return
  }
  const width = docPdf.getStringUnitWidth(text) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor
  docPdf.text(text, x - width, y, options)
}

function pageWidthPt(docPdf) {
  return docPdf.internal.pageSize.getWidth()
}

function pageHeightPt(docPdf) {
  return docPdf.internal.pageSize.getHeight()
}

/** KKK-style: centered header stack + thick rule (shared for all laporan) */
function drawAccountingReportHeader(docPdf, { title, subtitle, margin, startY }) {
  const w = pageWidthPt(docPdf)
  let y = startY
  docPdf.setFont('times', 'bold')
  docPdf.setFontSize(11)
  docPdf.text(PDF_COMPANY_NAME.toUpperCase(), w / 2, y, { align: 'center' })
  y += 16
  docPdf.setFontSize(13)
  docPdf.text(title.toUpperCase(), w / 2, y, { align: 'center' })
  y += 15
  docPdf.setFontSize(10)
  if (Array.isArray(subtitle)) {
    subtitle.forEach((line) => {
      docPdf.text(String(line || ''), w / 2, y, { align: 'center' })
      y += 12
    })
  } else if (subtitle) {
    docPdf.text(String(subtitle), w / 2, y, { align: 'center' })
    y += 12
  }
  docPdf.setDrawColor(0, 0, 0)
  docPdf.setLineWidth(1.2)
  docPdf.line(margin, y, w - margin, y)
  y += 16
  return y
}

/** (Rp) label flush right with short underline (KKK / laporan keuangan style) */
function drawRpCurrencyRow(docPdf, valueX, y) {
  docPdf.setFont('times', 'normal')
  docPdf.setFontSize(10)
  alignRight(docPdf, '(Rp)', valueX, y)
  y += 4
  docPdf.setDrawColor(0, 0, 0)
  docPdf.setLineWidth(0.5)
  docPdf.line(valueX - 88, y, valueX, y)
  y += 14
  return y
}

// (Legacy header helpers replaced by drawAccountingReportHeader)

function drawReportFooter(docPdf, margin) {
  const w = pageWidthPt(docPdf)
  const h = pageHeightPt(docPdf)
  const footY = h - 40
  docPdf.setFont('times', 'normal')
  docPdf.setFontSize(10)
  const footerText = `${PDF_FOOTER_CITY}, ${formatTanggalIdShort(new Date().toISOString())}`
  alignRight(docPdf, footerText, w - margin, footY)
}

/** KKK-style: horizontal rule, kota & tanggal kanan, garis tanda tangan */
function drawAccountingSignatureFooter(docPdf, { margin, totalX, yStart }) {
  const pageW = pageWidthPt(docPdf)
  let y = yStart
  docPdf.setLineWidth(0.5)
  docPdf.line(margin, y, pageW - margin, y)
  y += 24
  docPdf.setFont('times', 'normal')
  docPdf.setFontSize(10)
  alignRight(
    docPdf,
    `${PDF_FOOTER_CITY}, ${formatTanggalIdShort(new Date().toISOString())}`,
    totalX,
    y
  )
  y += 20
  docPdf.setLineWidth(0.35)
  docPdf.line(totalX - 200, y, totalX, y)
}

function truncatePdfText(s, maxLen) {
  const t = String(s || '')
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

async function resolveContactNamesById(ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)))
  const out = new Map()
  await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'contacts', id))
        if (snap.exists()) {
          const d = snap.data() || {}
          out.set(id, d.name || d.company || id)
        }
      } catch (e) {
        // ignore; fall back to id
      }
    })
  )
  return out
}


export default function Laporan() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  useLanguage() // keep Language provider active for translations used elsewhere
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReport, setSelectedReport] = useState(null) // keys: neraca | laba-rugi | trial-balance

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [reportLoading, setReportLoading] = useState(false)

  const reportItems = useMemo(() => {
    return [
      {
        title: 'Finansial',
        items: [
          { key: 'neraca', label: 'Neraca' },
          { key: 'arus-kas', label: 'Arus Kas', disabled: true },
          { key: 'laba-rugi', label: 'Laba Rugi' },
          { key: 'perubahan-modal', label: 'Perubahan Modal', disabled: true },
          { key: 'ringkasan-eksekutif', label: 'Ringkasan Eksekutif', disabled: true },
          { key: 'hutang-piutang', label: 'Hutang Piutang per Kontak', disabled: true },
        ],
      },
      {
        title: 'Akuntansi',
        items: [
          { key: 'ringkasan-bank', label: 'Ringkasan Bank', disabled: true },
          { key: 'buku-besar', label: 'Buku Besar', disabled: true },
          { key: 'jurnal', label: 'Jurnal', disabled: true },
          { key: 'trial-balance', label: 'Trial Balance', },
        ],
      },
      {
        title: 'Penjualan',
        items: [{ key: 'penjualan-detail', label: 'Detail Penjualan', disabled: true }],
      },
      {
        title: 'Pembelian',
        items: [{ key: 'pembelian-detail', label: 'Detail Pembelian' }],
      },
    ]
  }, [])

  useEffect(() => {
    // Default year range to current year
    const now = new Date()
    const year = now.getFullYear()
    setDateFrom(`${year}-01-01`)
    setDateTo(`${year}-12-31`)
  }, [])

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return reportItems
    return reportItems
      .map((group) => ({
        ...group,
        items: group.items.filter((it) => it.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0)
  }, [searchQuery, reportItems])

  const fetchSales = async ({ from, to }) => {
    const invoicesRef = collection(db, 'invoices')
    // We'll fetch all and filter in-memory (simpler; avoids missing indexes issues)
    const snap = await getDocs(query(invoicesRef, orderBy('createdAt', 'desc')))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const fromD = from ? new Date(`${from}T00:00:00`) : null
    const toD = to ? new Date(`${to}T23:59:59.999`) : null
    return list.filter((inv) => {
      const raw = inv.transactionDate || inv.createdAt
      if (!raw) return false
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return false
      if (fromD && d < fromD) return false
      if (toD && d > toD) return false
      return true
    })
  }

  const fetchPurchases = async ({ from, to }) => {
    const ref = collection(db, 'purchaseInvoices')
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const fromD = from ? new Date(`${from}T00:00:00`) : null
    const toD = to ? new Date(`${to}T23:59:59.999`) : null
    return list
      .filter((inv) => (inv.status ? inv.status === 'approved' : true))
      .filter((inv) => {
        const raw = inv.transactionDate || inv.createdAt
        if (!raw) return false
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) return false
        if (fromD && d < fromD) return false
        if (toD && d > toD) return false
        return true
      })
  }

  const fetchPurchasesDetail = async ({ from, to }) => {
    const rows = await fetchPurchases({ from, to })
    const vendorIds = rows
      .map((r) => r.vendor)
      .filter((v) => v && String(v).length > 0 && !String(v).includes(' '))
    const vendorMap = await resolveContactNamesById(vendorIds)
    return rows.map((r) => {
      const rawVendor = r.vendor || ''
      const vendorName = vendorMap.get(rawVendor) || rawVendor || 'N/A'
      return {
        ...r,
        vendorId: rawVendor,
        vendorName,
      }
    })
  }

  const fetchExpenses = async ({ from, to }) => {
    const ref = collection(db, 'expenses')
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')))
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const fromD = from ? new Date(`${from}T00:00:00`) : null
    const toD = to ? new Date(`${to}T23:59:59.999`) : null
    return list.filter((ex) => {
      const raw = ex.date || ex.transactionDate || ex.createdAt
      if (!raw) return false
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) return false
      if (fromD && d < fromD) return false
      if (toD && d > toD) return false
      return true
    })
  }

  const buildAndExport = async (type, format) => {
    setReportLoading(true)
    try {
      const from = normalizeIsoDateInput(dateFrom)
      const to = normalizeIsoDateInput(dateTo)

      const salesInvoices = type === 'laba-rugi' ? await fetchSales({ from, to }) : []
      const purchaseInvoices = type === 'laba-rugi' ? await fetchPurchases({ from, to }) : []
      const expenses = type === 'laba-rugi' ? await fetchExpenses({ from, to }) : []

      // Compute laba for neraca "tahun berjalan"
      let computedLabaTahunan = 0
      if (type === 'neraca') {
        const sales = await fetchSales({ from, to })
        const purchases = await fetchPurchases({ from, to })
        const exps = await fetchExpenses({ from, to })
        const labaModel = buildLabaRugiModel({ salesInvoices: sales, purchaseInvoices: purchases, expenses: exps })
        computedLabaTahunan = labaModel.labaSetelahPajak
      }

      if (type === 'laba-rugi') {
        const model = buildLabaRugiModel({ salesInvoices, purchaseInvoices, expenses })

        if (format === 'csv') {
          const headers = ['Keterangan', 'Nilai']
          const rows = [
            ['PENJUALAN', model.penjualan],
            ['TOTAL PENDAPATAN', model.totalPendapatan],
            ['HARGA POKOK PENJUALAN', model.totalHargaPokokPenjualan],
            ['LABA KOTOR', model.labaKotor],
            ['TOTAL BIAYA OPERASI', model.totalBiayaOperasi],
            ['LABA/RUGI USAHA', model.labaUsaha],
            ['TOTAL PENDAPATAN & BIAYA LAIN-LAIN', model.totalPendapatanBiayaLain],
            ['LABA / RUGI SEBELUM PAJAK', model.labaSebelumPajak],
            ['LABA / RUGI SETELAH PAJAK', model.labaSetelahPajak],
          ]
          const stamp = to ? to.slice(0, 4) : 'periode'
          downloadCsv(`laba-rugi-${stamp}.csv`, headers, rows)
        } else {
          const endLabel = to ? `${to}` : '-'
          downloadPdf(`KKK_LABA_RUGI_${endLabel}.pdf`, (docPdf) => {
            docPdf.setFont('times', 'normal')
            const margin = 48
            const pageW = pageWidthPt(docPdf)
            const totalX = pageW - margin
            const midX = pageW - margin - 130
            const labelX = margin
            const ind1 = margin + 14
            let y = 40

            const periodUpper = to ? formatTanggalIdUpper(to) : '31 DESEMBER 2025'

            y = drawAccountingReportHeader(docPdf, {
              title: 'LAPORAN RUGI LABA',
              subtitle: `UNTUK TAHUN YANG BERAKHIR PADA TANGGAL ${periodUpper}`,
              margin,
              startY: y,
            })
            y = drawRpCurrencyRow(docPdf, totalX, y)

            const strWidth = (txt) =>
              docPdf.getStringUnitWidth(txt) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor

            const lineAboveTotal = (rightEdge, yy) => {
              docPdf.setDrawColor(0, 0, 0)
              docPdf.setLineWidth(0.35)
              // Keep this safely above the text baseline (jsPDF y can behave like top/alphabetic)
              docPdf.line(rightEdge - 100, yy - 6, rightEdge, yy - 6)
            }

            const secTitle = (txt) => {
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(10)
              docPdf.text(txt, labelX, y)
              docPdf.setLineWidth(0.35)
              docPdf.line(labelX, y + 4, labelX + strWidth(txt), y + 4)
              y += 16
            }

            const detailMid = (lbl, val, underlineAmount = false) => {
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(10)
              docPdf.text(lbl, ind1, y)
              const out = typeof val === 'string' ? val : formatRp(val)
              alignRight(docPdf, out, midX, y)
              if (underlineAmount) {
                docPdf.setLineWidth(0.35)
                docPdf.line(midX - strWidth(out), y + 4, midX, y + 4)
              }
              y += 13
            }

            const detailMidBold = (lbl, val, underlineAmount = false) => {
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(10)
              docPdf.text(lbl, ind1, y)
              const out = typeof val === 'string' ? val : formatRp(val)
              alignRight(docPdf, out, midX, y)
              if (underlineAmount) {
                docPdf.setLineWidth(0.35)
                docPdf.line(midX - strWidth(out), y + 4, midX, y + 4)
              }
              y += 13
            }

            const itemTotalRight = (lbl, val) => {
              lineAboveTotal(totalX, y)
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(10)
              docPdf.text(lbl, ind1, y)
              alignRight(docPdf, formatRp(val), totalX, y)
              y += 14
            }

            const sectionTotalRight = (lbl, val) => {
              lineAboveTotal(totalX, y)
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(10)
              docPdf.text(lbl, labelX, y)
              alignRight(docPdf, formatRp(val), totalX, y)
              y += 14
            }

            const bandTotalRight = (lbl, val) => {
              lineAboveTotal(totalX, y)
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(10)
              docPdf.text(lbl, labelX, y)
              alignRight(docPdf, formatRp(val), totalX, y)
              docPdf.setLineWidth(0.35)
              docPdf.line(totalX - 102, y + 6, totalX, y + 6)
              y += 17
            }

            const finalNetAfterTax = (lbl, val) => {
              lineAboveTotal(totalX, y)
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(10)
              docPdf.text(lbl, labelX, y)
              alignRight(docPdf, formatRp(val), totalX, y)
              docPdf.setLineWidth(0.85)
              docPdf.line(totalX - 108, y + 7, totalX, y + 7)
              docPdf.line(totalX - 108, y + 9, totalX, y + 9)
              y += 19
            }

            secTitle('PENJUALAN')
            itemTotalRight('PENJUALAN', model.penjualan)
            sectionTotalRight('TOTAL PENDAPATAN', model.totalPendapatan)

            secTitle('HARGA POKOK PENJUALAN')
            detailMid('PERSEDIAAN BARANG AWAL', model.persediaanAwal)
            detailMid('PEMBELIAN BERSIH', model.pembelianBersih)
            detailMid('BARANG SIAP DIJUAL', model.barangSiapDijual, true)
            detailMid('PERSEDIAAN BARANG AKHIR', model.persediaanAkhir)
            detailMidBold('TOTAL HARGA POKOK BARANG', model.totalHPPBar)
            detailMid('BIAYA PENJUALAN LANGSUNG', model.biayaPenjualanLangsung || 0, true)
            sectionTotalRight('TOTAL HARGA POKOK PENJUALAN', model.totalHargaPokokPenjualan)

            bandTotalRight('LABA KOTOR', model.labaKotor)

            secTitle('BIAYA OPERASI')
            detailMid('BIAYA KARYAWAN', model.biayaKaryawan)
            detailMid('BIAYA UMUM & ADMINISTRASI', model.biayaUmumAdmin, true)
            sectionTotalRight('TOTAL BIAYA OPERASI', model.totalBiayaOperasi)

            sectionTotalRight('LABA/RUGI USAHA', model.labaUsaha)

            secTitle('PENDAPATAN DAN BIAYA LAIN-LAIN')
            detailMid('PENDAPATAN LAIN-LAIN', model.pendapatanLainLain)
            detailMid('BIAYA LAIN-LAIN', model.biayaLainLain, true)
            sectionTotalRight('TOTAL PENDAPATAN & BIAYA LAIN-LAIN', model.totalPendapatanBiayaLain)

            sectionTotalRight('LABA / RUGI SEBELUM PAJAK', model.labaSebelumPajak)

            lineAboveTotal(totalX, y)
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)
            docPdf.text('PAJAK PENGHASILAN', ind1, y)
            const pajakOut =
              model.pajakPenghasilan && Number(model.pajakPenghasilan) !== 0
                ? formatRp(model.pajakPenghasilan)
                : '-'
            alignRight(docPdf, pajakOut, totalX, y)
            y += 14

            finalNetAfterTax('LABA / RUGI SETELAH PAJAK', model.labaSetelahPajak)

            drawAccountingSignatureFooter(docPdf, { margin, totalX, yStart: y + 8 })
          })
        }
        return
      }

      if (type === 'neraca') {
        const model = buildNeracaModel({ accounts, labaTahunanBerjalan: computedLabaTahunan })

        if (format === 'csv') {
          const headers = ['Keterangan', 'Nilai']
          const rows = [
            ['KAS & BANK', model.kasBank],
            ['PIUTANG USAHA (IDR)', model.piutangUsaha],
            ['PIUTANG PEMEGANG SAHAM', model.piutangPemegangSaham],
            ['PIUTANG LAIN-LAIN', model.piutangLainLain],
            ['PERSEDIAAN BARANG', model.persediaanBarang],
            ['UANG MUKA PEMBELIAN (IDR)', model.uangMukaPembelian],
            ['BEBAN & PAJAK DIBAYAR DIMUKA', model.bebanPajakDibayarDimuka],
            ['TOTAL AKTIVA LANCAR', model.totalAktivaLancar],
            ['TOTAL AKTIVA TETAP', model.totalAktivaTetap],
            ['TOTAL AKTIVA', model.totalAktiva],
            ['TOTAL HUTANG LANCAR', model.hutangLancarTotal],
            ['TOTAL MODAL', model.totalModal],
            ['HUTANG & MODAL', model.totalHutangModal],
          ]
          const stamp = to ? to.slice(0, 4) : 'periode'
          downloadCsv(`neraca-${stamp}.csv`, headers, rows)
        } else {
          const endLabel = to ? `${to}` : '-'
          downloadPdf(`KKK_NERACA_${endLabel}.pdf`, (docPdf) => {
            const margin = 48
            const pageW = pageWidthPt(docPdf)
            const valueX = pageW - margin
            const amountColW = 118
            const labelX = margin
            const indent1 = margin + 10
            const indent2 = margin + 22
            const rowGap = 3
            const lh = 12
            let y = 42

            const periodUpper = to ? formatTanggalIdUpper(to) : '31 DESEMBER'
            y = drawAccountingReportHeader(docPdf, {
              title: 'NERACA',
              subtitle: `PER ${periodUpper}`,
              margin,
              startY: y,
            })
            y = drawRpCurrencyRow(docPdf, valueX, y)

            const strWidthUnits = (txt) =>
              docPdf.getStringUnitWidth(txt) * docPdf.internal.getFontSize() / docPdf.internal.scaleFactor

            const section = (label, subLevel = 0) => {
              const x = subLevel <= 0 ? labelX : subLevel === 1 ? indent1 : indent2
              docPdf.setFontSize(10)
              docPdf.setFont('times', 'bold')
              docPdf.text(label, x, y)
              docPdf.setDrawColor(0, 0, 0)
              docPdf.setLineWidth(0.35)
              docPdf.line(x, y + 4, x + strWidthUnits(label), y + 4)
              y += 16
            }

            const line = (label, value, { indent = 1, bold = false } = {}) => {
              const x = indent <= 0 ? labelX : indent === 1 ? indent1 : indent2
              docPdf.setFont('times', bold ? 'bold' : 'normal')
              docPdf.setFontSize(10)
              const labelMaxW = Math.max(72, valueX - amountColW - x)
              const parts = docPdf.splitTextToSize(label, labelMaxW)
              const yStart = y
              parts.forEach((part, i) => {
                docPdf.text(part, x, yStart + i * lh)
              })
              const yAmt = yStart + (parts.length - 1) * lh
              if (bold) {
                docPdf.setDrawColor(0, 0, 0)
                docPdf.setLineWidth(0.35)
                docPdf.line(valueX - amountColW, yAmt - 6, valueX, yAmt - 6)
              }
              alignRight(docPdf, formatRp(value), valueX, yAmt)
              y = yStart + parts.length * lh + rowGap
            }

            const netLine = (value) => {
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(10)
              alignRight(docPdf, formatRp(value), valueX, y)
              y += lh + rowGap
            }

            section('AKTIVA', 0)
            section('AKTIVA LANCAR', 1)
            line('KAS & BANK', model.kasBank, { indent: 2 })
            line('PIUTANG USAHA (IDR)', model.piutangUsaha, { indent: 2 })
            line('PIUTANG PEMEGANG SAHAM', model.piutangPemegangSaham, { indent: 2 })
            line('PIUTANG LAIN-LAIN', model.piutangLainLain, { indent: 2 })
            line('PERSEDIAAN BARANG', model.persediaanBarang, { indent: 2 })
            line('UANG MUKA PEMBELIAN (IDR)', model.uangMukaPembelian, { indent: 2 })
            line('BEBAN & PAJAK DIBAYAR DIMUKA', model.bebanPajakDibayarDimuka, { indent: 2 })
            line('TOTAL AKTIVA LANCAR', model.totalAktivaLancar, { indent: 1, bold: true })

            section('AKTIVA TETAP', 1)
            line('INVENTARIS KANTOR', model.inventarisGross, { indent: 2 })
            line('AKUMULASI PENYUSUTAN INVENTARIS KANTOR', model.inventarisAcc, { indent: 2 })
            netLine(model.inventarisNet)
            line('KENDARAAN', model.kendaraanGross, { indent: 2 })
            line('AKUMULASI PENYUSUTAN KENDARAAN', model.kendaraanAcc, { indent: 2 })
            netLine(model.kendaraanNet)
            line('BANGUNAN', model.bangunanGross, { indent: 2 })
            line('AKUMULASI PENYUSUTAN BANGUNAN', model.bangunanAcc, { indent: 2 })
            netLine(model.bangunanNet)
            line('TOTAL AKTIVA TETAP', model.totalAktivaTetap, { indent: 1, bold: true })

            line('TOTAL AKTIVA', model.totalAktiva, { indent: 0, bold: true })

            section('HUTANG & MODAL', 0)
            section('HUTANG LANCAR', 1)
            line('HUTANG USAHA (IDR)', model.hutangUsaha, { indent: 2 })
            line('HUTANG LAIN-LAIN', model.hutangLain, { indent: 2 })
            line('HUTANG PAJAK', model.hutangPajak, { indent: 2 })
            line('HUTANG LEASING', model.hutangLeasing, { indent: 2 })
            line('HUTANG BANK', model.hutangBank, { indent: 2 })
            line('UANG MUKA PENJUALAN', model.uangMukaPenjualan, { indent: 2 })
            line('BIAYA YMH DIBAYAR', model.biayaYmhDibayar, { indent: 2 })
            line('TOTAL HUTANG LANCAR', model.hutangLancarTotal, { indent: 1, bold: true })

            section('MODAL', 1)
            line('MODAL YANG DISETOR', model.modalDisetor, { indent: 2 })
            line('LABA / RUGI DITAHAN', model.labaDitahan, { indent: 2 })
            line('LABA / RUGI TAHUN BERJALAN', model.labaTahunBerjalan, { indent: 2 })
            line('TOTAL MODAL', model.totalModal, { indent: 1, bold: true })

            y += 4
            docPdf.setDrawColor(0, 0, 0)
            docPdf.setLineWidth(0.9)
            docPdf.line(labelX, y, valueX, y)
            y += 12
            docPdf.setFont('times', 'bold')
            docPdf.setFontSize(11)
            docPdf.text('HUTANG & MODAL', labelX, y)
            alignRight(docPdf, formatRp(model.totalHutangModal), valueX, y)
            docPdf.setLineWidth(0.9)
            docPdf.line(labelX, y + 6, valueX, y + 6)

            drawAccountingSignatureFooter(docPdf, { margin, totalX: valueX, yStart: y + 18 })
          })
        }

        return
      }

      if (type === 'trial-balance') {
        // Neraca Saldo / Trial Balance uses account saldo
        const rows = (accounts || [])
          .map((a) => ({
            code: a.code || '',
            name: a.name || '',
            category: a.category || '',
            saldo: Number(a.saldo || 0),
          }))

        // Split by sign for debit/credit style output
        const prepared = rows.map((r) => ({
          ...r,
          debit: r.saldo >= 0 ? r.saldo : 0,
          credit: r.saldo < 0 ? Math.abs(r.saldo) : 0,
        }))

        const headers = ['Kode', 'Nama', 'Kategori', 'Debit', 'Kredit', 'Saldo']
        const bodyRows = prepared.map((r) => [
          r.code,
          r.name,
          r.category,
          r.debit,
          r.credit,
          r.saldo,
        ])

        const stamp = to ? to.slice(0, 4) : 'periode'

        if (format === 'csv') {
          downloadCsv(`neraca-saldo-${stamp}.csv`, headers, bodyRows)
        } else {
          downloadPdf(`KKK_NERACA_SALDO_${stamp}.pdf`, (docPdf) => {
            docPdf.setFont('times', 'normal')

            const margin = 48
            const pageW = pageWidthPt(docPdf)
            const valueX = pageW - margin
            const debitRight = pageW - margin - 128
            const creditRight = pageW - margin - 68
            const periodLine = to ? `PER ${formatTanggalIdUpper(to)}` : 'PER —'

            const colCode = margin
            const colName = margin + 56
            const colCat = margin + 232

            const sorted = [...prepared].sort((a, b) =>
              String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
            )

            const totalDebit = sorted.reduce((s, r) => s + (Number(r.debit) || 0), 0)
            const totalCredit = sorted.reduce((s, r) => s + (Number(r.credit) || 0), 0)
            const totalSaldo = sorted.reduce((s, r) => s + (Number(r.saldo) || 0), 0)

            const footerReserve = 52
            const rowH = 10

            let y = 40
            let continuation = ''

            const drawTableHeader = (yy) => {
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(9)
              docPdf.text('KODE', colCode, yy)
              docPdf.text('NAMA AKUN', colName, yy)
              docPdf.text('KATEGORI', colCat, yy)
              alignRight(docPdf, 'DEBIT', debitRight, yy)
              alignRight(docPdf, 'KREDIT', creditRight, yy)
              alignRight(docPdf, 'SALDO', valueX, yy)
              yy += 5
              docPdf.setDrawColor(0, 0, 0)
              docPdf.setLineWidth(0.45)
              docPdf.line(margin, yy, pageW - margin, yy)
              yy += 11
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(8.5)
              return yy
            }

            const startPage = () => {
              y = continuation
                ? drawAccountingReportHeader(docPdf, {
                    title: `NERACA SALDO${continuation}`,
                    subtitle: periodLine,
                    margin,
                    startY: 40,
                  })
                : drawAccountingReportHeader(docPdf, {
                    title: 'NERACA SALDO',
                    subtitle: periodLine,
                    margin,
                    startY: 40,
                  })
              y = drawRpCurrencyRow(docPdf, valueX, y)
              y = drawTableHeader(y)
            }

            startPage()

            sorted.forEach((r) => {
              if (y > pageHeightPt(docPdf) - footerReserve) {
                drawReportFooter(docPdf, margin)
                docPdf.addPage()
                continuation = ' (LANJUTAN)'
                startPage()
              }
              docPdf.text(truncatePdfText(r.code, 14), colCode, y)
              docPdf.text(truncatePdfText(r.name, 34), colName, y)
              docPdf.text(truncatePdfText(r.category, 22), colCat, y)
              alignRight(docPdf, formatRp(r.debit), debitRight, y)
              alignRight(docPdf, formatRp(r.credit), creditRight, y)
              alignRight(docPdf, formatRp(r.saldo), valueX, y)
              y += rowH
            })

            if (y > pageHeightPt(docPdf) - footerReserve - 24) {
              drawReportFooter(docPdf, margin)
              docPdf.addPage()
              continuation = ' (LANJUTAN)'
              startPage()
            }

            y += 6
            docPdf.setDrawColor(0, 0, 0)
            docPdf.setLineWidth(0.65)
            docPdf.line(margin, y - 4, pageW - margin, y - 4)
            docPdf.setFont('times', 'bold')
            docPdf.setFontSize(9)
            docPdf.text('JUMLAH', colName, y)
            alignRight(docPdf, formatRp(totalDebit), debitRight, y)
            alignRight(docPdf, formatRp(totalCredit), creditRight, y)
            alignRight(docPdf, formatRp(totalSaldo), valueX, y)
            docPdf.setFont('times', 'normal')
            y += rowH

            drawAccountingSignatureFooter(docPdf, { margin, totalX: valueX, yStart: y + 8 })
          })
        }
      }

      if (type === 'pembelian-detail') {
        const purchases = await fetchPurchasesDetail({ from, to })
        const sorted = [...purchases].sort((a, b) => {
          const da = new Date(a.transactionDate || a.createdAt || 0).getTime() || 0
          const dbb = new Date(b.transactionDate || b.createdAt || 0).getTime() || 0
          return da - dbb
        })

        const totalAll = sorted.reduce((s, r) => s + (Number(r.total) || 0), 0)
        const periodUpper = (() => {
          if (from && to) return `PERIODE ${formatTanggalIdUpper(from)} - ${formatTanggalIdUpper(to)}`
          if (to) return `PER ${formatTanggalIdUpper(to)}`
          return 'PER —'
        })()

        if (format === 'csv') {
          const headers = ['Tanggal', 'No', 'Vendor', 'Status', 'Jatuh Tempo', 'Total']
          const rows = sorted.map((r) => [
            r.transactionDate || '',
            r.number || '',
            r.vendorName || r.vendor || '',
            r.status || '',
            r.dueDate || '',
            Number(r.total) || 0,
          ])
          const stamp = to ? to.slice(0, 4) : 'periode'
          downloadCsv(`detail-pembelian-${stamp}.csv`, headers, rows)
        } else {
          const stamp = to ? to : 'periode'
          downloadPdf(`KKK_DETAIL_PEMBELIAN_${stamp}.pdf`, (docPdf) => {
            docPdf.setFont('times', 'normal')
            const margin = 48
            const pageW = pageWidthPt(docPdf)
            const pageH = pageHeightPt(docPdf)
            const valueX = pageW - margin
            const footerReserve = 68
            const rowH = 10

            const colDate = margin
            const colNo = margin + 74
            const colVendor = margin + 170
            const colStatus = margin + 360
            const colDue = margin + 430
            const colTotal = valueX

            let y = 40
            let continuation = ''

            const drawTableHeader = (yy) => {
              docPdf.setFont('times', 'bold')
              docPdf.setFontSize(9)
              docPdf.text('TANGGAL', colDate, yy)
              docPdf.text('NO', colNo, yy)
              docPdf.text('VENDOR', colVendor, yy)
              docPdf.text('STATUS', colStatus, yy)
              docPdf.text('J.TEMPO', colDue, yy)
              alignRight(docPdf, 'TOTAL', colTotal, yy)
              yy += 5
              docPdf.setDrawColor(0, 0, 0)
              docPdf.setLineWidth(0.45)
              docPdf.line(margin, yy, pageW - margin, yy)
              yy += 11
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(8.5)
              return yy
            }

            const startPage = () => {
              y = drawAccountingReportHeader(docPdf, {
                title: `DETAIL PEMBELIAN${continuation}`,
                subtitle: periodUpper,
                margin,
                startY: 40,
              })
              y = drawRpCurrencyRow(docPdf, valueX, y)
              y = drawTableHeader(y)
            }

            startPage()

            sorted.forEach((r) => {
              if (y > pageH - footerReserve) {
                drawReportFooter(docPdf, margin)
                docPdf.addPage()
                continuation = ' (LANJUTAN)'
                startPage()
              }
              docPdf.text(truncatePdfText(r.transactionDate || '', 12), colDate, y)
              docPdf.text(truncatePdfText(r.number || '', 14), colNo, y)
              docPdf.text(truncatePdfText(r.vendorName || r.vendor || '', 28), colVendor, y)
              docPdf.text(truncatePdfText(r.status || '', 10), colStatus, y)
              docPdf.text(truncatePdfText(r.dueDate || '', 12), colDue, y)
              alignRight(docPdf, formatRp(Number(r.total) || 0), colTotal, y)
              y += rowH
            })

            if (y > pageH - footerReserve - 24) {
              drawReportFooter(docPdf, margin)
              docPdf.addPage()
              continuation = ' (LANJUTAN)'
              startPage()
            }

            y += 6
            docPdf.setDrawColor(0, 0, 0)
            docPdf.setLineWidth(0.65)
            docPdf.line(margin, y - 4, pageW - margin, y - 4)
            docPdf.setFont('times', 'bold')
            docPdf.setFontSize(9)
            docPdf.text('TOTAL', colVendor, y)
            alignRight(docPdf, formatRp(totalAll), colTotal, y)
            docPdf.setFont('times', 'normal')
            y += rowH

            drawAccountingSignatureFooter(docPdf, { margin, totalX: valueX, yStart: y + 10 })
          })
        }
        return
      }
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Gagal export laporan')
    } finally {
      setReportLoading(false)
    }
  }
  
  const activeReportMeta = useMemo(() => {
    if (!selectedReport) return null
    const map = {
      neraca: { title: 'NERACA' },
      'laba-rugi': { title: 'LAPORAN RUGI LABA' },
      'trial-balance': { title: 'NERACA SALDO (TRIAL BALANCE)' },
    }
    return map[selectedReport] || null
  }, [selectedReport])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Beranda &gt; Laporan</div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laporan</h1>
              </div>

              <div className="relative w-full max-w-md ml-6">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredReports.map((group) => (
                <div key={group.title} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{group.title}</h2>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>

                  <div className="space-y-2">
                    {group.items.map((it) => (
                      <button
                        key={it.key}
                        disabled={it.disabled}
                        onClick={() => setSelectedReport(it.key)}
                        className={`w-full flex items-center justify-between rounded-md px-3 py-2 border transition-colors ${
                          selectedReport === it.key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/40'
                        } ${it.disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Star className={`h-4 w-4 ${selectedReport === it.key ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="text-gray-800 dark:text-gray-100 truncate">{it.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal */}
            {activeReportMeta && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{activeReportMeta.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Pilih periode lalu export (CSV/PDF).
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {reportLoading ? (
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span>Menghasilkan export...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                      {(activeReportMeta?.title === 'NERACA' ||
                        activeReportMeta?.title.includes('TRIAL BALANCE')) &&
                        accountsLoading && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            Memuat akun...
                          </div>
                        )}
                      <button
                        onClick={() => buildAndExport(selectedReport, 'pdf')}
                        disabled={
                          (activeReportMeta?.title === 'NERACA' ||
                            activeReportMeta?.title.includes('TRIAL BALANCE')) &&
                          accountsLoading
                        }
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FileText className="h-5 w-5" />
                        Export PDF
                      </button>
                      <button
                        onClick={() => buildAndExport(selectedReport, 'csv')}
                        disabled={
                          (activeReportMeta?.title === 'NERACA' ||
                            activeReportMeta?.title.includes('TRIAL BALANCE')) &&
                          accountsLoading
                        }
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        Export CSV
                      </button>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Catatan: Perhitungan laporan menggunakan data yang tersedia di Firestore (`invoices`, `purchaseInvoices`, `expenses`, `accounts`).
                  </div>
                </div>
              </div>
            )}

            {(accountsError || accountsLoading) && (
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {accountsError ? 'Gagal memuat akun.' : 'Memuat akun...'}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}

