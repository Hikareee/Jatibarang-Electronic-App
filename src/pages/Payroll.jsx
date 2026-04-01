import { useMemo, useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useAuth } from '../contexts/AuthContext'
import { usePayrollEmployeesFromContacts, usePayrollRuns } from '../hooks/usePayrollData'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Loader2, Settings2 } from 'lucide-react'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(Number(num) || 0)
}

function downloadCsv(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function monthStampNow() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const KOPRA_TEMPLATE_STORAGE_KEY = 'payroll_kopra_template_v1'

function getDefaultKopraTemplate() {
  return {
    delimiter: ',',
    headers: ['bank_code', 'bank_name', 'account_number', 'account_name', 'amount', 'description'],
    // keys map to payslip/run fields (see exportKopraCsv)
    mapping: {
      bank_code: 'bankCode',
      bank_name: 'bankName',
      account_number: 'accountNumber',
      account_name: 'accountName',
      amount: 'amount',
      description: 'description',
    },
  }
}

function loadKopraTemplate() {
  try {
    const raw = localStorage.getItem(KOPRA_TEMPLATE_STORAGE_KEY)
    if (!raw) return getDefaultKopraTemplate()
    const parsed = JSON.parse(raw)
    if (!parsed?.headers || !Array.isArray(parsed.headers)) return getDefaultKopraTemplate()
    return { ...getDefaultKopraTemplate(), ...parsed }
  } catch {
    return getDefaultKopraTemplate()
  }
}

function saveKopraTemplate(tpl) {
  localStorage.setItem(KOPRA_TEMPLATE_STORAGE_KEY, JSON.stringify(tpl))
}

export default function Payroll() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [tab, setTab] = useState('employees') // employees | runs
  const { employees, loading: empLoading, error: empError, refetch: refetchEmployees } = usePayrollEmployeesFromContacts()
  const { runs, loading: runsLoading, error: runsError, createRun, getPayslipsForRun } = usePayrollRuns()

  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [savingEmployee, setSavingEmployee] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    baseSalary: 0,
    ptkp: 'TK/0',
    npwp: '',
    bpjsEnabled: false,
    active: true,
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
  })

  const [showCreateRun, setShowCreateRun] = useState(false)
  const [creatingRun, setCreatingRun] = useState(false)
  const [runForm, setRunForm] = useState({
    period: monthStampNow(),
    payDate: '',
    includeInactive: false,
    workDays: 22,
  })

  const employeesForRun = useMemo(() => {
    return employees
  }, [employees])

  const [absentDaysByEmployeeId, setAbsentDaysByEmployeeId] = useState({})
  const [showKopraSettings, setShowKopraSettings] = useState(false)
  const [kopraTemplate, setKopraTemplate] = useState(() => loadKopraTemplate())


  const handleCreateEmployee = async () => {
    if (!employeeForm.name.trim()) return alert('Nama karyawan wajib diisi')
    if (!Number(employeeForm.baseSalary) || Number(employeeForm.baseSalary) <= 0) {
      return alert('Gaji pokok wajib diisi dan harus > 0')
    }
    try {
      setSavingEmployee(true)
      const { saveContact } = await import('../hooks/useContactsData')
      await saveContact({
        types: ['Pegawai'],
        name: employeeForm.name.trim(),
        email: (employeeForm.email || '').trim(),
        fullName: employeeForm.name.trim(),
        phone: '',
        company: '',
        number: '',
        group: '',
        payroll: {
          baseSalary: Number(employeeForm.baseSalary) || 0,
          ptkp: employeeForm.ptkp || 'TK/0',
          npwp: (employeeForm.npwp || '').trim(),
          bpjsEnabled: !!employeeForm.bpjsEnabled,
          bank: {
            bankName: (employeeForm.bankName || '').trim(),
            bankCode: (employeeForm.bankCode || '').trim(),
            accountNumber: (employeeForm.accountNumber || '').trim(),
            accountName: (employeeForm.accountName || '').trim(),
          },
        },
        andaHutang: 0,
        merekaHutang: 0,
        pembayaranDiterima: 0,
        hutangAndaJatuhTempo: 0,
        hutangMereka: 0,
      })
      setShowAddEmployee(false)
      setEmployeeForm({
        name: '',
        email: '',
        baseSalary: 0,
        ptkp: 'TK/0',
        npwp: '',
        bpjsEnabled: false,
        active: true,
        bankName: '',
        bankCode: '',
        accountNumber: '',
        accountName: '',
      })
    } catch (err) {
      console.error(err)
      alert('Gagal menambah karyawan')
    } finally {
      setSavingEmployee(false)
    }
  }

  const handleCreatePayrollRun = async () => {
    if (!runForm.period) return alert('Periode wajib diisi')
    if (employeesForRun.length === 0) return alert('Tidak ada karyawan untuk digaji')
    try {
      setCreatingRun(true)
      const overridesByEmployeeId = {}
      for (const e of employeesForRun) {
        const absentDays = Number(absentDaysByEmployeeId?.[e.id] || 0) || 0
        if (absentDays > 0) overridesByEmployeeId[e.id] = { absentDays }
      }
      await createRun({
        period: runForm.period,
        payDate: runForm.payDate,
        createdBy: currentUser?.uid || '',
        employees: employeesForRun,
        workDays: runForm.workDays,
        overridesByEmployeeId,
      })
      setShowCreateRun(false)
      setTab('runs')
    } catch (err) {
      console.error(err)
      alert(err?.message ? String(err.message) : 'Gagal membuat payroll')
    } finally {
      setCreatingRun(false)
    }
  }

  const exportBankTransferCsv = async (run) => {
    try {
      const slips = await getPayslipsForRun(run.id)
      const headers = ['bank_code', 'bank_name', 'account_number', 'account_name', 'amount', 'description']
      const rows = slips.map((s) => [
        s.employeeBank?.bankCode || '',
        s.employeeBank?.bankName || '',
        s.employeeBank?.accountNumber || '',
        s.employeeBank?.accountName || s.employeeName || '',
        Number(s.net || 0),
        `Payroll ${run.period} - ${s.employeeName || ''}`.trim(),
      ])
      downloadCsv(`payroll-transfer-${run.period}.csv`, headers, rows)
    } catch (err) {
      console.error(err)
      alert('Gagal export bank transfer CSV')
    }
  }

  const exportKopraCsv = async (run) => {
    try {
      const slips = await getPayslipsForRun(run.id)
      const tpl = kopraTemplate || getDefaultKopraTemplate()

      const headers = tpl.headers || []
      const mapping = tpl.mapping || {}
      const delimiter = tpl.delimiter || ','

      const rows = slips.map((s) => {
        const bankCode = s.employeeBank?.bankCode || ''
        const bankName = s.employeeBank?.bankName || ''
        const accountNumber = s.employeeBank?.accountNumber || ''
        const accountName = s.employeeBank?.accountName || s.employeeName || ''
        const amount = Number(s.net || 0)
        const description = `Payroll ${run.period} - ${s.employeeName || ''}`.trim()

        const dict = { bankCode, bankName, accountNumber, accountName, amount, description }
        return headers.map((h) => dict[mapping[h]] ?? dict[h] ?? '')
      })

      // Custom delimiter support (KOPRA templates sometimes use semicolon)
      const escape = (v) => {
        const s = String(v ?? '')
        if (new RegExp(`[\"\\n${delimiter}]`).test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }
      const lines = [headers.map(escape).join(delimiter), ...rows.map((r) => r.map(escape).join(delimiter))]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.setAttribute('download', `kopra-transfer-${run.period}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
      alert('Gagal export KOPRA CSV')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Beranda &gt; Payroll</div>

            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payroll</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Kelola karyawan, buat payroll bulanan, dan generate slip gaji.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {tab === 'employees' && (
                  <button
                    type="button"
                    onClick={() => setShowAddEmployee(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Pegawai
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCreateRun(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Buat Payroll
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setTab('employees')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  tab === 'employees'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pegawai
              </button>
              <button
                onClick={() => setTab('runs')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  tab === 'runs'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Payroll Bulanan
              </button>
            </div>

            {tab === 'employees' ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {empLoading ? (
                  <div className="p-10 flex items-center justify-center text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat…
                  </div>
                ) : empError ? (
                  <div className="p-6 text-red-600 dark:text-red-400">{empError}</div>
                ) : employees.length === 0 ? (
                  <div className="p-10 text-center text-gray-600 dark:text-gray-400">
                    Belum ada pegawai. Tambahkan kontak dengan tipe “Pegawai” di menu Kontak, atau klik “Tambah Pegawai”.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Nama
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            PTKP
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Gaji Pokok
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {employees.map((e) => (
                          <tr
                            key={e.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer"
                            onClick={() => navigate(`/payroll/pegawai/${e.id}`)}
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {e.name || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {e.email || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {e?.payroll?.ptkp || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {formatNumber(e?.payroll?.baseSalary || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              Aktif
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {runsLoading ? (
                  <div className="p-10 flex items-center justify-center text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat…
                  </div>
                ) : runsError ? (
                  <div className="p-6 text-red-600 dark:text-red-400">{runsError}</div>
                ) : runs.length === 0 ? (
                  <div className="p-10 text-center text-gray-600 dark:text-gray-400">
                    Belum ada payroll. Klik “Buat Payroll” untuk generate payroll bulanan.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Periode
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Tgl Bayar
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Karyawan
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Gross
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Net
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {runs.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {r.period || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{r.payDate || '-'}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                              {formatNumber(r.employeeCount || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {formatNumber(r?.totals?.gross || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                              {formatNumber(r?.totals?.net || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {r.status || 'draft'}
                            </td>
                            <td className="px-6 py-4 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => exportKopraCsv(r)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Export KOPRA CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowKopraSettings(true)}
                                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30 text-gray-700 dark:text-gray-200"
                                  aria-label="Pengaturan KOPRA"
                                  title="Pengaturan KOPRA"
                                >
                                  <Settings2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>

      {/* Add employee modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Pegawai</h2>
              <button
                onClick={() => setShowAddEmployee(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama *
                  </label>
                  <input
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gaji Pokok *
                  </label>
                  <input
                    type="number"
                    value={employeeForm.baseSalary}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, baseSalary: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PTKP</label>
                  <select
                    value={employeeForm.ptkp}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, ptkp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  >
                    <option value="TK/0">TK/0</option>
                    <option value="TK/1">TK/1</option>
                    <option value="TK/2">TK/2</option>
                    <option value="TK/3">TK/3</option>
                    <option value="K/0">K/0</option>
                    <option value="K/1">K/1</option>
                    <option value="K/2">K/2</option>
                    <option value="K/3">K/3</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NPWP</label>
                  <input
                    value={employeeForm.npwp}
                    onChange={(e) => setEmployeeForm((p) => ({ ...p, npwp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>

              <div className="md:col-span-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Bank transfer</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank</label>
                    <input
                      value={employeeForm.bankName}
                      onChange={(e) => setEmployeeForm((p) => ({ ...p, bankName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="BCA / BRI / Mandiri / BNI / ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode bank</label>
                    <input
                      value={employeeForm.bankCode}
                      onChange={(e) => setEmployeeForm((p) => ({ ...p, bankCode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="014 / 002 / 008 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      No. rekening
                    </label>
                    <input
                      value={employeeForm.accountNumber}
                      onChange={(e) => setEmployeeForm((p) => ({ ...p, accountNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nama pemilik
                    </label>
                    <input
                      value={employeeForm.accountName}
                      onChange={(e) => setEmployeeForm((p) => ({ ...p, accountName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

                <div className="md:col-span-2 flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">BPJS</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Aktifkan placeholder iuran (MVP).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmployeeForm((p) => ({ ...p, bpjsEnabled: !p.bpjsEnabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      employeeForm.bpjsEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        employeeForm.bpjsEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddEmployee(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleCreateEmployee}
                disabled={savingEmployee}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEmployee ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create run modal */}
      {showCreateRun && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Payroll Bulanan</h2>
              <button
                onClick={() => setShowCreateRun(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Periode (YYYY-MM)
                  </label>
                  <input
                    value={runForm.period}
                    onChange={(e) => setRunForm((p) => ({ ...p, period: e.target.value }))}
                    placeholder="2026-03"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Bayar</label>
                  <input
                    type="date"
                    value={runForm.payDate}
                    onChange={(e) => setRunForm((p) => ({ ...p, payDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hari kerja per bulan
                  </label>
                  <input
                    type="number"
                    value={runForm.workDays}
                    onChange={(e) => setRunForm((p) => ({ ...p, workDays: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Termasuk karyawan nonaktif</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Jika dimatikan, hanya karyawan aktif yang diproses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRunForm((p) => ({ ...p, includeInactive: !p.includeInactive }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      runForm.includeInactive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        runForm.includeInactive ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Penyesuaian absensi</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Potongan otomatis: gajiPokok / hariKerja × hariAbsen.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-white dark:bg-gray-900/10">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Pegawai
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Gaji pokok
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Hari absen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900/0 divide-y divide-gray-200 dark:divide-gray-700">
                      {employeesForRun.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{e.name || '-'}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
                            {formatNumber(e?.payroll?.baseSalary || 0)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            <input
                              type="number"
                              min="0"
                              value={absentDaysByEmployeeId?.[e.id] ?? 0}
                              onChange={(ev) =>
                                setAbsentDaysByEmployeeId((prev) => ({
                                  ...prev,
                                  [e.id]: ev.target.value,
                                }))
                              }
                              className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/40">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Ringkasan</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>Jumlah karyawan</div>
                  <div className="text-right text-gray-900 dark:text-white font-semibold">
                    {formatNumber(employeesForRun.length)}
                  </div>
                  <div>Catatan</div>
                  <div className="text-right">
                    PPh21 & BPJS masih placeholder (MVP), akan kita otomatisasi berikutnya.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateRun(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleCreatePayrollRun}
                disabled={creatingRun}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingRun ? 'Membuat…' : 'Generate Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KOPRA settings modal */}
      {showKopraSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pengaturan Export KOPRA</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Sesuaikan kolom & delimiter sesuai template upload KOPRA Mandiri Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKopraSettings(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Delimiter
                  </label>
                  <select
                    value={kopraTemplate.delimiter}
                    onChange={(e) => setKopraTemplate((p) => ({ ...p, delimiter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Urutan kolom (header)
                  </label>
                  <input
                    value={(kopraTemplate.headers || []).join(',')}
                    onChange={(e) => {
                      const headers = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      setKopraTemplate((p) => ({ ...p, headers }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    placeholder="bank_code,bank_name,account_number,account_name,amount,description"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tips: buka KOPRA → menu upload transfer → download template → salin nama kolomnya di sini.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/20">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Field yang tersedia</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <div><span className="font-mono">bankCode</span></div>
                  <div><span className="font-mono">bankName</span></div>
                  <div><span className="font-mono">accountNumber</span></div>
                  <div><span className="font-mono">accountName</span></div>
                  <div><span className="font-mono">amount</span></div>
                  <div><span className="font-mono">description</span></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Untuk mapping khusus header, saat ini export memakai nama header yang Anda isi (contoh: <span className="font-mono">bank_code</span> otomatis mengambil <span className="font-mono">bankCode</span>).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setKopraTemplate(getDefaultKopraTemplate())}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                Reset default
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = kopraTemplate || getDefaultKopraTemplate()
                    saveKopraTemplate(next)
                    setShowKopraSettings(false)
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Simpan pengaturan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

