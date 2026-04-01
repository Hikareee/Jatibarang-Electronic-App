import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const RUNS_COL = 'payrollRuns'
const PAYSLIPS_COL = 'payrollPayslips'

function toMoney(n) {
  const v = Number(n || 0) || 0
  return Math.round(v)
}

function sumLines(lines) {
  if (!Array.isArray(lines)) return 0
  return lines.reduce((s, l) => s + toMoney(l?.amount), 0)
}

function normalizePayroll(employee) {
  // employee is a Contact doc (Kontak) with types.includes('Pegawai')
  const payroll = employee?.payroll && typeof employee.payroll === 'object' ? employee.payroll : {}
  return {
    baseSalary: toMoney(payroll.baseSalary ?? 0),
    allowances: Array.isArray(payroll.allowances) ? payroll.allowances : [],
    deductions: Array.isArray(payroll.deductions) ? payroll.deductions : [],
    ptkp: payroll.ptkp || 'TK/0',
    npwp: payroll.npwp || '',
    bpjsEnabled: !!payroll.bpjsEnabled,
    bank: payroll.bank && typeof payroll.bank === 'object' ? payroll.bank : {},
  }
}

export function computePayslip(employee, overrides = {}) {
  const p = normalizePayroll(employee)
  const baseSalary = toMoney(overrides.baseSalary ?? p.baseSalary ?? 0)
  const allowances = Array.isArray(overrides.allowances ?? p.allowances) ? (overrides.allowances ?? p.allowances) : []
  const deductionsBase = Array.isArray(overrides.deductions ?? p.deductions) ? (overrides.deductions ?? p.deductions) : []
  const workDays = Math.max(1, Number(overrides.workDays ?? 22) || 22)
  const absentDays = Math.max(0, Number(overrides.absentDays ?? 0) || 0)
  const absentDeduction = absentDays > 0 ? toMoney((baseSalary / workDays) * absentDays) : 0
  const deductions = absentDeduction
    ? [...deductionsBase, { label: `Potongan absensi (${absentDays} hari)`, amount: absentDeduction }]
    : deductionsBase

  // MVP: taxes & BPJS placeholders (extend later)
  const pph21 = toMoney(overrides.pph21 ?? 0)
  const bpjs = toMoney(overrides.bpjs ?? 0)

  const allowanceTotal = sumLines(allowances)
  const deductionTotal = sumLines(deductions) + pph21 + bpjs
  const gross = baseSalary + allowanceTotal
  const net = Math.max(0, gross - deductionTotal)

  return {
    baseSalary,
    allowances,
    deductions,
    allowanceTotal,
    deductionTotal,
    pph21,
    bpjs,
    gross,
    net,
    absentDays,
    absentDeduction,
  }
}

export function usePayrollEmployeesFromContacts() {
  const [employees, setEmployees] = useState([]) // contacts with types contains 'Pegawai'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEmployees = async (aliveRef = { current: true }) => {
    try {
      setLoading(true)
      setError(null)
      const ref = collection(db, 'contacts')
      // IMPORTANT: Use the same query pattern as Kontak (orderBy only) to avoid
      // requiring a composite Firestore index. Filter Pegawai client-side.
      const q = query(ref, orderBy('name', 'asc'))
      const snap = await getDocs(q)
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => Array.isArray(c.types) && c.types.includes('Pegawai'))
      if (!aliveRef.current) return
      setEmployees(rows)
    } catch (err) {
      console.error('usePayrollEmployeesFromContacts error:', err)
      if (!aliveRef.current) return
      setError(err?.message || String(err))
      setEmployees([])
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    const aliveRef = { current: true }
    ;(async () => {
      try {
        await fetchEmployees(aliveRef)
      } catch {
        // errors are handled inside fetchEmployees
      }
    })()
    return () => {
      aliveRef.current = false
    }
  }, [])

  return {
    employees,
    loading,
    error,
    refetch: () => fetchEmployees({ current: true }),
  }
}

export function usePayrollRuns() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const ref = collection(db, RUNS_COL)
        const q = query(ref, orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (!alive) return
        setRuns(rows)
      } catch (err) {
        console.error('usePayrollRuns error:', err)
        if (!alive) return
        setError(err?.message || String(err))
        setRuns([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const createRun = async ({ period, payDate, createdBy, employees, workDays = 22, overridesByEmployeeId = {} }) => {
    if (!period) throw new Error('period required')
    const runRef = await addDoc(collection(db, RUNS_COL), {
      period,
      payDate: payDate || '',
      status: 'draft',
      employeeCount: Array.isArray(employees) ? employees.length : 0,
      workDays: Math.max(1, Number(workDays) || 22),
      totals: { gross: 0, net: 0, pph21: 0, bpjs: 0 },
      createdBy: createdBy || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const batch = writeBatch(db)
    let gross = 0
    let net = 0
    let pph21 = 0
    let bpjs = 0

    for (const e of employees || []) {
      const ov = overridesByEmployeeId?.[e.id] || {}
      const calc = computePayslip(e, { ...ov, workDays })
      gross += calc.gross
      net += calc.net
      pph21 += calc.pph21
      bpjs += calc.bpjs

      const payroll = normalizePayroll(e)
      const slipRef = doc(collection(db, PAYSLIPS_COL))
      batch.set(slipRef, {
        runId: runRef.id,
        period,
        employeeId: e.id,
        employeeName: e.name || '',
        employeeEmail: e.email || '',
        employeeBank: {
          bankName: payroll.bank.bankName || '',
          bankCode: payroll.bank.bankCode || '',
          accountNumber: payroll.bank.accountNumber || '',
          accountName: payroll.bank.accountName || '',
        },
        baseSalary: calc.baseSalary,
        allowanceTotal: calc.allowanceTotal,
        deductionTotal: calc.deductionTotal,
        pph21: calc.pph21,
        bpjs: calc.bpjs,
        gross: calc.gross,
        net: calc.net,
        absentDays: calc.absentDays || 0,
        absentDeduction: calc.absentDeduction || 0,
        breakdown: {
          allowances: calc.allowances || [],
          deductions: calc.deductions || [],
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    batch.update(doc(db, RUNS_COL, runRef.id), {
      totals: { gross: toMoney(gross), net: toMoney(net), pph21: toMoney(pph21), bpjs: toMoney(bpjs) },
      updatedAt: serverTimestamp(),
    })
    await batch.commit()

    return runRef.id
  }

  const getPayslipsForRun = async (runId) => {
    const ref = collection(db, PAYSLIPS_COL)
    const q = query(ref, where('runId', '==', runId))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  return { runs, loading, error, createRun, getPayslipsForRun }
}

