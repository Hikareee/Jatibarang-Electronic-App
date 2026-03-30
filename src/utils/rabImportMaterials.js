/**
 * RAB material import utilities for the "AHSP PT. IBASA" Excel format.
 *
 * Supports:
 * - .csv (fallback)
 * - .xlsx / .xls (AHSP-style multi-price + section headers)
 *
 * Returned row shape (universal):
 *  { name: string, unit: string, price: number, category?: 'material'|'labor'|'alat' }
 *
 * MaterialsTab expects `parsed.__matrixSample` (array of arrays) for the column map modal.
 */

function normalizeCell(v) {
  return String(v ?? '').trim()
}

function isEmptyRow(row) {
  return !Array.isArray(row) || row.every((c) => !normalizeCell(c))
}

function looksLikeHeaderWord(v, re) {
  const s = normalizeCell(v).toLowerCase()
  if (!s) return false
  return re.test(s)
}

function parsePrice(v) {
  const raw = normalizeCell(v)
  if (!raw) return null

  // Already a number from xlsx: keep it.
  if (typeof v === 'number' && !Number.isNaN(v)) return v >= 0 ? v : null

  // If it contains letters but isn't currency-like, treat as non-price.
  if (/[A-Za-z]/.test(raw) && !/rp|idr|rupiah/i.test(raw)) return null

  let s = raw.replace(/[\s]/g, '')
  // Remove currency labels but keep digits separators
  s = s.replace(/rp|idr|rupiah/gi, '')
  // Keep only digits, dots, commas, minus.
  s = s.replace(/[^0-9.,-]/g, '')
  if (!s) return null

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // Heuristic: if dot is before comma => '.' thousand sep, ',' decimal
    if (s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(/,/g, '.')
    } else {
      // comma thousand sep, dot decimal => remove commas
      s = s.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // Could be decimal or thousand sep; if last group length is 3 treat as thousand sep
    const commaCount = (s.match(/,/g) || []).length
    const after = s.split(',').pop() || ''
    if (commaCount > 1 || (after.length === 3 && commaCount === 1)) s = s.replace(/,/g, '')
    else s = s.replace(/,/g, '.')
  } else if (hasDot && !hasComma) {
    // Could be decimal or thousand sep; if last group length is 3 treat as thousand sep
    const parts = s.split('.')
    const last = parts[parts.length - 1] || ''
    if (last.length === 3 && parts.length > 1) s = parts.join('')
  }

  const n = Number(s)
  if (Number.isNaN(n) || n < 0) return null
  return n
}

function scoreTextName(s) {
  const t = normalizeCell(s)
  if (!t) return 0
  // Avoid NO/Kode-ish numeric cells and column letters (A, B, C...)
  if (/^\d+([.,]\d+)?$/.test(t)) return 0
  if (/^[A-Z]$/.test(t)) return 0
  // Prefer descriptive text: spaces or longer strings
  let score = 0
  if (t.includes(' ')) score += 2
  if (t.length >= 4) score += 2
  // Prefer not being pure codes
  if (!/^[A-Za-z0-9_.-]{1,6}$/.test(t)) score += 1
  return score
}

function detectAhspHeaderConfig(matrix) {
  // Find header row (must include SATUAN + HARGA SATUAN)
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row) || row.every((c) => !normalizeCell(c))) continue

    const hasUnit = row.some((c) => looksLikeHeaderWord(c, /satuan/i))
    const hasHarga = row.some((c) => looksLikeHeaderWord(c, /harga/i))

    const hasNameMarker = row.some((c) =>
      normalizeCell(c).toLowerCase().includes('upah') &&
      normalizeCell(c).toLowerCase().includes('material') &&
      normalizeCell(c).toLowerCase().includes('alat')
    )

    if (hasUnit && hasHarga && hasNameMarker) {
      const lower = row.map((c) => normalizeCell(c).toLowerCase())

      const unitIdx = lower.findIndex((c) => /satuan/.test(c))
      // Name column: the merged header with "UPAH - MATERIAL - ALAT"
      const nameIdx = lower.findIndex((c) => /upah.*material.*alat/.test(c))

      const priceIndices = []
      for (let c = 0; c < lower.length; c++) {
        if (/harga/.test(lower[c]) && (lower[c].includes('dasar') || lower[c].includes('satua'))) {
          priceIndices.push(c)
        }
      }

      // Prefer "PT. IBASA" column
      const ibasaIdx = lower.findIndex((c) => c.includes('ibasa') && /harga/.test(c))
      const priceIdxs = ibasaIdx !== -1 ? [ibasaIdx, ...priceIndices.filter((x) => x !== ibasaIdx)] : priceIndices

      if (unitIdx !== -1 && nameIdx !== -1 && priceIdxs.length) {
        return { headerRow: i, nameIdx, unitIdx, priceIdxs }
      }
    }
  }

  // Fallback: use common AHSP order:
  // NO | Kode | UPAH-MATERIAL-ALAT | SATUAN | HARGA THN2025 | HARGA IBASA | ...
  return {
    headerRow: 0,
    nameIdx: 2,
    unitIdx: 3,
    priceIdxs: [4, 5],
  }
}

function detectCategoryFromRow(row) {
  // Look for section labels anywhere in the row.
  const any = (idx) => normalizeCell(row?.[idx] ?? '')
  const allText = (Array.isArray(row) ? row.map(any).join(' ') : '').toLowerCase()

  if (/upah/.test(allText) && !/material/.test(allText)) return 'labor'
  if (/material/.test(allText) && !/upah/.test(allText)) return 'material'
  if (/alat/.test(allText) && !/upah/.test(allText)) return 'alat'

  // In AHSP, merged labels may include Roman numerals and dots:
  if (/i\.\s*upah/.test(allText)) return 'labor'
  if (/ii\.\s*material/.test(allText)) return 'material'
  if (/iii\.\s*alat/.test(allText)) return 'alat'

  // Mixed labels: try best-effort by priority order.
  if (/upah/.test(allText)) return 'labor'
  if (/material/.test(allText)) return 'material'
  if (/alat/.test(allText)) return 'alat'

  return null
}

export function parseMaterialsImportFile(file) {
  // For now, materials-only import uses the universal parser but forces category=material.
  return parseUniversalImportFile(file).then((rows) => rows.map((r) => ({ ...r, category: 'material' })))
}

export async function parseUniversalImportFile(file) {
  const lower = (file.name || '').toLowerCase()

  const base = []
  const matrixSample = []

  if (lower.endsWith('.csv')) {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const matrix = lines.map((line) => {
      const cells = []
      let cur = ''
      let inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          inQ = !inQ
          continue
        }
        if (ch === ',' && !inQ) {
          cells.push(cur.trim())
          cur = ''
        } else {
          cur += ch
        }
      }
      cells.push(cur.trim())
      return cells
    })

    matrixSample.push(...matrix.slice(0, 50))
    // CSV assumed: [name, unit, price]
    for (const row of matrix) {
      if (isEmptyRow(row)) continue
      const name = normalizeCell(row[0])
      const unit = normalizeCell(row[1])
      const price = parsePrice(row[2])
      if (!name || scoreTextName(name) <= 0) continue
      if (!unit || /^[A-Z]$/.test(unit)) continue
      if (price === null) continue
      base.push({ name, unit, price, category: undefined })
    }

    base.__matrixSample = matrixSample
    return base
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })

    let parsedAny = false
    const allRows = []

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName]
      if (!ws) return
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
      if (!Array.isArray(matrix) || !matrix.length) return

      if (!matrixSample.length) {
        matrixSample.push(...matrix.slice(0, 60))
      }

      const cfg = detectAhspHeaderConfig(matrix)
      const startRow = cfg.headerRow + 1

      let currentCategory = 'material'

      for (let r = startRow; r < matrix.length; r++) {
        const row = matrix[r]
        if (isEmptyRow(row)) continue

        const cat = detectCategoryFromRow(row)
        if (cat) {
          currentCategory = cat
          continue
        }

        const name = normalizeCell(row[cfg.nameIdx])
        const unit = normalizeCell(row[cfg.unitIdx])
        const priceRawCandidates = cfg.priceIdxs.map((idx) => row[idx])
        let price = null
        for (const cand of priceRawCandidates) {
          const p = parsePrice(cand)
          if (p !== null) {
            price = p
            break
          }
        }

        if (!name || scoreTextName(name) <= 0) continue
        if (!unit || /^[A-Z]$/.test(unit)) continue
        if (price === null) continue

        allRows.push({ name, unit, price, category: currentCategory })
        parsedAny = true
      }
    })

    if (!parsedAny) return []
    const rows = allRows
    rows.__matrixSample = matrixSample
    return rows
  }

  throw new Error('Gunakan file .csv, .xlsx, atau .xls')
}

