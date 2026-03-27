import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useLanguage } from '../contexts/LanguageContext'
import { getDocs, collection, query, orderBy } from 'firebase/firestore'
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
import { use } from 'react'

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
        items: [{ key: 'pembelian-detail', label: 'Detail Pembelian', disabled: true }],
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
            // Match the reference PDF layout: same line wording and two-column style.
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)

            const valueX = 500
            const labelX = 40
            let y = 30

            // Header currency marker (reference shows "Rp")
            docPdf.text('Rp', labelX, y)
            y += 16

            const row = (label, value, style) => {
              if (style === 'header') {
                docPdf.setFontSize(11)
                docPdf.setFont('times', 'bold')
              } else {
                docPdf.setFontSize(10)
                docPdf.setFont('times', 'normal')
              }
              docPdf.text(label, labelX, y)
              if (value !== undefined && value !== '') {
                const out = typeof value === 'string' ? value : formatRp(value)
                alignRight(docPdf, out, valueX, y)
              }
              y += style === 'header' ? 16 : 14
            }

            // Use 31 DESEMBER YYYY like reference (upper month)
            const periodUpper = to ? formatTanggalIdUpper(to) : '31 DESEMBER'
            y += 10
            const signatureDate = formatTanggalIdShort(new Date().toISOString())
            docPdf.setFontSize(10)
            docPdf.setFont('times', 'normal')
            docPdf.text(`'Cirebon', ${signatureDate}`, 40, y)
            y += 16
            y += 14
            docPdf.text('PT. INTEGRASI BANGUN PERKASA', 120, y)

            y += 18
            docPdf.setFontSize(12)
            docPdf.setFont('times', 'bold')
            docPdf.text('LAPORAN RUGI LABA', 40, y)
            y += 16
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)
            docPdf.text(`UNTUK TAHUN YANG BERAKHIR PADA TANGGAL ${periodUpper}`, 40, y)
            y += 16
            row('PENJUALAN', '', 'header')
            row('PENJUALAN', model.penjualan)
            row('TOTAL PENDAPATAN', model.totalPendapatan)
            row('HARGA POKOK PENJUALAN', '', 'header')
            row('PERSEDIAAN BARANG AWAL', model.persediaanAwal)
            row('PEMBELIAN BERSIH', model.pembelianBersih)
            row('BARANG SIAP DIJUAL', model.barangSiapDijual)
            row('PERSEDIAAN BARANG AKHIR', model.persediaanAkhir)
            row('TOTAL HARGA POKOK BARANG', model.totalHPPBar)
            row('BIAYA PENJUALAN LANGSUNG', model.biayaPenjualanLangsung || 0)
            row('TOTAL HARGA POKOK PENJUALAN', model.totalHargaPokokPenjualan)
            row('LABA KOTOR', model.labaKotor)
            row('BIAYA OPERASI', '', 'header')
            row('BIAYA KARYAWAN', model.biayaKaryawan)
            row('BIAYA UMUM & ADMINISTRASI', model.biayaUmumAdmin)
            row('TOTAL BIAYA OPERASI', model.totalBiayaOperasi)
            row('LABA/RUGI USAHA', model.labaUsaha)
            row('PENDAPATAN DAN BIAYA LAIN-LAIN', '', 'header')
            row('PENDAPATAN LAIN-LAIN', model.pendapatanLainLain)
            // In reference it prints (8.414.206) with parentheses for negative.
            row('BIAYA LAIN-LAIN', model.biayaLainLain)
            row('TOTAL PENDAPATAN & BIAYA LAIN-LAIN', model.totalPendapatanBiayaLain)
            row('LABA / RUGI SEBELUM PAJAK', model.labaSebelumPajak)
            // Pajak line uses '-' in reference if empty.
            row('PAJAK PENGHASILAN', model.pajakPenghasilan ? model.pajakPenghasilan : '-')
            row('LABA / RUGI SETELAH PAJAK', model.labaSetelahPajak)

            // Footer order to match reference: signature date/name first, then title lines.
  
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
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)

            const valueX = 500
            const labelX = 40
            let y = 30  

            const section = (label) => {
              docPdf.setFontSize(11)
              docPdf.setFont('times', 'bold')
              docPdf.text(label, labelX, y)
              y += 18
            }

            const line = (label, value) => {
              docPdf.setFont('times', 'normal')
              docPdf.setFontSize(10)
              docPdf.text(label, labelX, y)
              alignRight(docPdf, formatRp(value), valueX, y)
              y += 14
            }

            const netLine = (value) => {
              docPdf.setFont('times', 'normal')
              docPdf.text('', labelX, y)
              alignRight(docPdf, formatRp(value), valueX, y)
              y += 14
            }

            // PERIOD
            const periodUpper = to ? formatTanggalIdUpper(to) : '31 DESEMBER'

            // Header
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)
            y += 10
            const signatureDate = formatTanggalIdShort(new Date().toISOString())
            // Match reference: PT name -> NERACA -> export date
            docPdf.text('PT. INTEGRASI BANGUN PERKASA', labelX + 100, y)
            y += 18
            docPdf.setFont('times', 'bold') 
            docPdf.setFontSize(18)
            docPdf.text('NERACA', 170, y)
            y += 18
            docPdf.setFont('times', 'normal')
            docPdf.setFontSize(10)
            docPdf.text(`Cirebon, ${signatureDate}`, labelX + 100, y)
            y += 20
            docPdf.text(`PER ${periodUpper}`, 160, y)
            y += 22

            section('AKTIVA')
            section('AKTIVA LANCAR')
            line('KAS & BANK', model.kasBank)
            line('PIUTANG USAHA (IDR)', model.piutangUsaha)
            line('PIUTANG PEMEGANG SAHAM', model.piutangPemegangSaham)
            line('PIUTANG LAIN-LAIN', model.piutangLainLain)
            line('PERSEDIAAN BARANG', model.persediaanBarang)
            line('UANG MUKA PEMBELIAN (IDR)', model.uangMukaPembelian)
            line('BEBAN & PAJAK DIBAYAR DIMUKA', model.bebanPajakDibayarDimuka)
            line('TOTAL AKTIVA LANCAR', model.totalAktivaLancar)

            section('AKTIVA TETAP')
            // Inventory
            line('INVENTARIS KANTOR', model.inventarisGross)
            line('AKUMULASI PENYUSUTAN INVENTARIS KANTOR', model.inventarisAcc)
            netLine(model.inventarisNet)
            // Vehicles
            line('KENDARAAN', model.kendaraanGross)
            line('AKUMULASI PENYUSUTAN KENDARAAN', model.kendaraanAcc)
            netLine(model.kendaraanNet)
            // Building
            line('BANGUNAN', model.bangunanGross)
            line('AKUMULASI PENYUSUTAN BANGUNAN', model.bangunanAcc)
            netLine(model.bangunanNet)
            line('TOTAL AKTIVA TETAP', model.totalAktivaTetap)

            line('TOTAL AKTIVA', model.totalAktiva)

            section('HUTANG & MODAL')
            section('HUTANG LANCAR')
            line('HUTANG USAHA (IDR)', model.hutangUsaha)
            line('HUTANG LAIN-LAIN', model.hutangLain)
            line('HUTANG PAJAK', model.hutangPajak)
            line('HUTANG LEASING', model.hutangLeasing)
            line('HUTANG BANK', model.hutangBank)
            line('UANG MUKA PENJUALAN', model.uangMukaPenjualan)
            line('BIAYA YMH DIBAYAR', model.biayaYmhDibayar)
            line('TOTAL HUTANG LANCAR', model.hutangLancarTotal)

            section('MODAL')
            line('MODAL YANG DISETOR', model.modalDisetor)
            line('LABA / RUGI DITAHAN', model.labaDitahan)
            line('LABA / RUGI TAHUN BERJALAN', model.labaTahunBerjalan)
            line('TOTAL MODAL', model.totalModal)

            // Bottom "HUTANG & MODAL" total line (label + value on same row)
            docPdf.setFont('times', 'bold')
            docPdf.setFontSize(11)
            docPdf.text('HUTANG & MODAL', labelX, y)
            alignRight(docPdf, formatRp(model.totalHutangModal), valueX, y)
            y += 20
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
            docPdf.setFontSize(18)
            docPdf.text('NERACA SALDO', 40, 55)
            docPdf.setFontSize(10)
            docPdf.text(`PERIODE: ${to || '-'}`, 40, 75)
            docPdf.setFontSize(11)

            // Very simple table rendering
            let y = 105
            const colX = [40, 120, 260, 360, 430, 520]
            docPdf.text('Kode', colX[0], y)
            docPdf.text('Nama', colX[1], y)
            docPdf.text('Kategori', colX[2], y)
            docPdf.text('Debit', colX[3], y)
            docPdf.text('Kredit', colX[4], y)
            docPdf.text('Saldo', colX[5], y)
            y += 16

            const maxRows = 200
            prepared.slice(0, maxRows).forEach((r) => {
              docPdf.setFontSize(9.5)
              docPdf.text(String(r.code), colX[0], y)
              docPdf.text(String(r.name), colX[1], y)
              docPdf.text(String(r.category), colX[2], y)
              docPdf.text(formatRp(r.debit), colX[3], y)
              docPdf.text(formatRp(r.credit), colX[4], y)
              docPdf.text(formatRp(r.saldo), colX[5], y)
              y += 12
            })
            docPdf.setFontSize(10)
            docPdf.text('— generated by Laporan tab —', 40, 780)
          })
        }
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

