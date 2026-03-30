/**
 * Parse material rows from CSV or Excel (.xlsx / .xls).
 * Expected columns somewhere in the sheet: Nama / Uraian, Satuan, Harga.
 * - First non-empty row MAY be a header (any column names order).
 * - For Excel we scan all sheets, not just the first.
 * Excel parsing loads `xlsx` only when an .xlsx/.xls file is chosen.
 */

function normalizeCell(v) {
  return String(v ?? '').trim()
  const bestUnit = finalUnitScores.indexOf(Math.max(...finalUnitScores))
  const bestPrice = finalPriceScores.indexOf(Math.max(...finalPriceScores))
  const s = normalizeCell(value)
  if (!s) return false
  // Reject pure numbers like "1" to avoid NO/Kode columns being treated as names
  if (/^\d+([.,]\d+)?$/.test(s)) return false
  return true
}

function detectHeaderConfig(matrix) {
  /**
   * Try to find a header row and which columns are name / unit / price based on keywords.
   */
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row || row.every((c) => !normalizeCell(c))) continue
    const lower = row.map((c) => normalizeCell(c).toLowerCase())

    const nameIdx = lower.findIndex((c) =>
      /(upah\s*-\s*material\s*-\s*alat|nama|uraian|deskripsi|pekerjaan|material|barang)/.test(c)
    )
    const unitIdx = lower.findIndex((c) => /(satuan|unit|uom)/.test(c))
    const priceCandidates = lower
      .map((c, idx) => ({ c, idx }))
      .filter((x) => /(harga|price|biaya|nilai|amount)/.test(x.c))
      .map((x) => x.idx)

    // Prefer PT. IBASA column when present, then other price columns
    const ibasaIdx = lower.findIndex((c) => /(harga).*ibasa/.test(c))
    const priceIdxs = ibasaIdx !== -1
      ? [ibasaIdx, ...priceCandidates.filter((idx) => idx !== ibasaIdx)]
      : priceCandidates

    if (nameIdx !== -1 && unitIdx !== -1 && priceIdxs.length > 0) {
      return {
        headerRow: i,
        nameIdx,
        unitIdx,
        priceIdxs,
      }
    }
  }

  // Fallback: assume columns [0]=name, [1]=unit, [2]=price with no explicit header row
  return null
}

function parsePrice(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v >= 0 ? v : null
  // Normalize strings like "Rp 100.000,00", "1.234.567", "1,234,567.89", etc.
  let s = String(v).trim()
  // If value contains alphabetic characters and doesn't look like a currency label, treat as non-price.
  // This prevents codes like "L.02" from being parsed as 0.02.
  if (/[A-Za-z]/.test(s) && !/rp|idr|rupiah/i.test(s)) return null
  // Remove currency symbols and spaces
  s = s.replace(/[^0-9,.-]/g, '')
  if (!s) return null

  // If both dot and comma present decide formatting
  const hasDot = s.indexOf('.') !== -1
  const hasComma = s.indexOf(',') !== -1

  if (hasDot && hasComma) {
    // If dot occurs before comma (e.g. "1.234,56") -> dots are thousand separators (ID), comma is decimal
    if (s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(/,/g, '.')
    } else {
      // comma before dot (e.g. "1,234.56") -> commas are thousand separators (US), remove commas
      s = s.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // Only comma present - could be decimal or thousand separator.
    // Heuristic: if comma repeated or the part after comma has length 3 treat as thousand separators, else decimal
    const commaCount = (s.match(/,/g) || []).length
    const after = s.split(',').pop() || ''
    if (commaCount > 1 || (after.length === 3 && commaCount === 1)) {
      s = s.replace(/,/g, '')
    } else {
      s = s.replace(/,/g, '.')
    }
  } else if (hasDot && !hasComma) {
    // Only dot present - could be decimal or thousand separator.
    const parts = s.split('.')
    const last = parts[parts.length - 1] || ''
    if (last.length === 3 && parts.length > 1) {
      // treat dots as thousand separators
      s = parts.join('')
    }
    // otherwise keep dot as decimal separator
  }

  const n = Number(s)
  if (Number.isNaN(n) || n < 0) return null
  return n
}

/**
 * @param {unknown[][]} matrix
 * @returns {{ name: string, unit: string, price: number }[]}
 */
export function parseMaterialRowsFromMatrix(matrix, options = {}) {
  if (!matrix?.length) return []

  const cfg = detectHeaderConfig(matrix)
  if (!cfg) {
    if (options.requireHeader) return []

    // First try: detect numbered rows (NO column starting at 1,2,3...) and infer columns from them
    const inferredFromNumbers = inferColumnsFromNumberedRows(matrix)
    if (inferredFromNumbers) return parseWithConfig(matrix, inferredFromNumbers)

    // Next try general inference by scanning content
    const inferred = inferColumnsFromMatrix(matrix)
    if (inferred) {
      return parseWithConfig(matrix, inferred)
    }

    // CSV fallback only: assume [name, unit, price]
    const fallback = {
      headerRow: -1,
      nameIdx: 0,
      unitIdx: 1,
      priceIdxs: [2],
    }
    return parseWithConfig(matrix, fallback)
  }

  return parseWithConfig(matrix, cfg)
}

function inferColumnsFromMatrix(matrix) {
  // Determine number of columns by longest row
  let maxCols = 0
  for (const r of matrix) if (Array.isArray(r)) maxCols = Math.max(maxCols, r.length)
  if (maxCols === 0) return null

  const nameScores = new Array(maxCols).fill(0)
  const unitScores = new Array(maxCols).fill(0)
  const priceScores = new Array(maxCols).fill(0)

  const commonUnits = new Set(['pcs', 'kg', 'm', 'l', 'oh', 'unit', 'buah', 'roll', 'set', 'ltr'])

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < maxCols; c++) {
      const val = normalizeCell(row[c])
      if (!val) continue
      if (isLikelyName(val)) nameScores[c]++
      const low = val.toLowerCase()
      if (commonUnits.has(low) || /^[a-z%]{1,4}$/.test(low)) unitScores[c]++
      if (parsePrice(val) !== null) priceScores[c]++
    }
  }

  // If top rows are header-like, ignore them: find first row index that looks like data
  let dataStart = 0
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    let hasNameLike = false
    let hasNumberLike = false
    let nonEmpty = 0
    for (let c = 0; c < maxCols; c++) {
      const v = normalizeCell(row[c])
      if (v) nonEmpty++
      if (isLikelyName(v)) hasNameLike = true
      if (parsePrice(v) !== null) hasNumberLike = true
    }
    if ((hasNameLike && nonEmpty >= 2) || hasNumberLike) {
      dataStart = i
      break
    }
  }

  // Re-score starting from dataStart to prioritize actual data rows
  const nameScores2 = new Array(maxCols).fill(0)
  const unitScores2 = new Array(maxCols).fill(0)
  const priceScores2 = new Array(maxCols).fill(0)
  for (let i = dataStart; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < maxCols; c++) {
      const val = normalizeCell(row[c])
      if (!val) continue
      if (isLikelyName(val)) nameScores2[c]++
      const low = val.toLowerCase()
      if (commonUnits.has(low) || /^[a-z%]{1,4}$/.test(low)) unitScores2[c]++
      if (parsePrice(val) !== null) priceScores2[c]++
    }
  }

  // Use the rescored arrays if they have any hits, otherwise fall back to original scores
  const finalNameScores = nameScores2.some(Boolean) ? nameScores2 : nameScores
  const finalUnitScores = unitScores2.some(Boolean) ? unitScores2 : unitScores
  const finalPriceScores = priceScores2.some(Boolean) ? priceScores2 : priceScores

  // Helper: detect if a column is mostly sequential integers (NO column)
  const isSequentialColumn = (colIdx) => {
    let vals = []
    for (let i = 0; i < matrix.length; i++) {
      const v = normalizeCell((matrix[i] || [])[colIdx])
      if (v) vals.push(v)
    }
    if (vals.length < 3) return false
    const nums = vals.map((v) => {
      const m = v.match(/^\d+$/)
      return m ? parseInt(m[0], 10) : null
    }).filter((n) => n !== null)
    if (nums.length < Math.max(3, Math.floor(vals.length * 0.5))) return false
    // check increasing or mostly distinct
    let increasing = 0
    for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i - 1] + 1) increasing++
    return increasing >= Math.max(1, Math.floor(nums.length * 0.4))
  }

  // Prefer a name column that is textual (not sequential numbers)
  let bestName = -1
  const maxNameScore = Math.max(...finalNameScores)
  if (maxNameScore > 0) {
    // pick highest-scoring column that is not sequential numbers
    const candidates = finalNameScores
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
    for (const c of candidates) {
      if (!isSequentialColumn(c.idx)) { bestName = c.idx; break }
    }
    if (bestName === -1) bestName = candidates[0].idx
  }
  
  const bestUnit = finalUnitScores.indexOf(Math.max(...finalUnitScores))
  const bestPrice = finalPriceScores.indexOf(Math.max(...finalPriceScores))

  if ((finalNameScores[bestName] || 0) === 0 || (finalPriceScores[bestPrice] || 0) === 0) return null

  return {
    headerRow: -1,
    nameIdx: bestName,
    unitIdx: bestUnit >= 0 ? bestUnit : Math.max(0, bestName + 1),
    priceIdxs: [bestPrice],
  }
}

function inferColumnsFromNumberedRows(matrix) {
  // Find a column where rows start 1,2,3,... contiguous (ignoring gaps)
  let maxCols = 0
  for (const r of matrix) if (Array.isArray(r)) maxCols = Math.max(maxCols, r.length)
  if (maxCols === 0) return null

  // Build column arrays of normalized values
  const cols = Array.from({ length: maxCols }, () => [])
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < maxCols; c++) cols[c].push(normalizeCell(row[c]))
  }

  // For each column, detect if values look like sequential numbers starting at 1
  for (let c = 0; c < maxCols; c++) {
    const vals = cols[c].map((v) => v).filter(Boolean)
    if (vals.length < 3) continue
    // try to parse first several as integers
    const nums = vals.slice(0, 10).map((v) => {
      const m = v.match(/^\d+$/)
      return m ? parseInt(m[0], 10) : null
    }).filter((n) => n !== null)
    if (nums.length < 3) continue
    // check if they form a sequence starting at 1 or close
    const startsAtOne = nums[0] === 1
    const increasing = nums.every((n, idx) => idx === 0 || n === nums[idx - 1] + 1)
    if (!(startsAtOne || increasing)) continue

    // We found a NO column at c. Now look at the same rows to find nearby name/unit/price columns
    // Scan matrix rows to collect candidate columns where that row has non-empty text
    const candidateCounts = {}
    for (let r = 0; r < matrix.length; r++) {
      const cell = normalizeCell(matrix[r][c])
      if (!cell) continue
      // consider neighboring columns within next 6 columns
      for (let nc = c + 1; nc < Math.min(maxCols, c + 7); nc++) {
        const v = normalizeCell(matrix[r][nc])
        if (!v) continue
        candidateCounts[nc] = (candidateCounts[nc] || 0) + 1
      }
    }
  const sortedCandidates = Object.keys(candidateCounts).sort((a, b) => candidateCounts[b] - candidateCounts[a]).map(Number)
    if (!sortedCandidates.length) continue

    // Choose bestName = first candidate with likely name, bestUnit = next candidate matching unit heuristics, bestPrice = first candidate with price parse
  let bestName = null
    let bestUnit = null
    let bestPrice = null
    for (const nc of sortedCandidates) {
      // sample a few rows under this column to see content
      const samples = []
      for (let r = 0; r < matrix.length && samples.length < 6; r++) {
        const v = normalizeCell(matrix[r][nc])
        if (v) samples.push(v)
      }
  // compute heuristics
  const sampleTextCount = samples.filter((s) => isLikelyName(s)).length
  const sampleHasSpace = samples.filter((s) => s.includes(' ')).length
  const sampleAvgLen = samples.reduce((a,b)=>a+b.length,0)/(samples.length||1)
  const sampleIsCodeLike = samples.every((s) => /^[A-Za-z0-9_.-]{1,8}$/.test(s))

  // prefer a name column that looks like descriptive text (contains spaces or longer average length)
  if (!bestName && sampleTextCount > 0 && (sampleHasSpace > 0 || sampleAvgLen > 6) && !sampleIsCodeLike) bestName = nc
  if (!bestUnit && samples.some((s) => ['pcs','kg','m','l','oh','unit','buah','roll','set','ltr'].includes(s.toLowerCase()))) bestUnit = nc
  if (!bestPrice && samples.some((s) => parsePrice(s) !== null)) bestPrice = nc
  // fallback: if we still don't have bestName, accept a textual column that's not pure numbers
  if (!bestName && samples.some((s) => isLikelyName(s) && !/^\d+$/.test(s))) bestName = nc
      if (bestName && bestPrice) break
    }

    if (bestName && bestPrice) {
      return {
        headerRow: -1,
        nameIdx: bestName,
        unitIdx: bestUnit !== null ? bestUnit : Math.max(bestName + 1, c + 2),
        priceIdxs: [bestPrice],
      }
    }
  }

  return null
}

function parseWithConfig(matrix, cfg) {
  const start = cfg.headerRow >= 0 ? cfg.headerRow + 1 : 0
  const out = []
  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row || row.every((c) => !normalizeCell(c))) continue

    const name = normalizeCell(row[cfg.nameIdx])
    if (!isLikelyName(name)) continue
    const unit = normalizeCell(row[cfg.unitIdx])
    let price = null
    for (const pIdx of cfg.priceIdxs) {
      price = parsePrice(row[pIdx])
      if (price !== null) break
    }
    if (price === null) continue
    out.push({ name, unit, price })
  }
  return out
}

/**
 * @param {File} file
 */
export async function parseMaterialsImportFile(file) {
  const lower = file.name.toLowerCase()

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
  // Try to locate the numbered rows (NO column starting at 1) and trim leading rows
  const startIdx = findNumberedStartIndex(matrix)
  const useMatrix = startIdx > 0 ? matrix.slice(startIdx - 1) : matrix
  // Pass requireHeader:false to allow headerless sheets
  return parseMaterialRowsFromMatrix(useMatrix, { requireHeader: false })
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const allRows = []

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName]
      if (!ws) return
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
      // Parse each sheet independently (header position can differ per sheet).
      if (Array.isArray(matrix) && matrix.some((r) => Array.isArray(r) && r.some((c) => normalizeCell(c)))) {
        // For Excel, allow sheets that may not have an explicit header row.
        allRows.push(...parseMaterialRowsFromMatrix(matrix, { requireHeader: false }))
      }
    })

    return allRows
  }

  throw new Error('Gunakan file .csv, .xlsx, atau .xls')
}

/**
 * Parse rows but allow missing price values (price may be null). Returns {name, unit, price, priceRaw}
 */
export function parseRowsAllowMissing(matrix, options = {}) {
  if (!matrix?.length) return []

  // Try to find column indices via same inference logic used before
  let cfg = detectHeaderConfig(matrix)
  if (!cfg) {
    // allow missing header
    cfg = inferColumnsFromNumberedRows(matrix) || inferColumnsFromMatrix(matrix) || {
      headerRow: -1,
      nameIdx: 0,
      unitIdx: 1,
      priceIdxs: [2],
    }
  }

  const start = cfg.headerRow >= 0 ? cfg.headerRow + 1 : 0
  const out = []
  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row || row.every((c) => !normalizeCell(c))) continue

    const name = normalizeCell(row[cfg.nameIdx])
    // keep rows even if name blank; caller/preview can filter
    const unit = normalizeCell(row[cfg.unitIdx])
    let price = null
    let priceRaw = ''
    for (const pIdx of cfg.priceIdxs) {
      priceRaw = normalizeCell(row[pIdx])
      const parsed = parsePrice(row[pIdx])
      if (parsed !== null) {
        price = parsed
        break
      }
    }
    out.push({ name, unit, price, priceRaw })
  }
  return out
}

/**
 * Universal import that tries to detect a category column (Category / Kategori)
 * and returns rows with { name, unit, price, category } where category is 'material'|'labor' if detected.
 */
export async function parseUniversalImportFile(file) {
  const lower = file.name.toLowerCase()

  // Helper to attach category detection to rows parsed by matrix parser
  const attachCategory = (matrix, rows) => {
    // Try to detect a category column in the header row if present
    const headerIdx = matrix.findIndex((r) => Array.isArray(r) && r.some((c) => /(kategori|category|type)/i.test(String(c || ''))))
    let catCol = -1
    if (headerIdx !== -1) {
      const header = matrix[headerIdx].map((c) => normalizeCell(c).toLowerCase())
      catCol = header.findIndex((h) => /(kategori|category|type)/.test(h))
    }

    if (catCol === -1) {
      // fallback: try to find any column containing the words 'material' or 'upah' in many rows
      const maxCols = Math.max(...matrix.map((r) => (Array.isArray(r) ? r.length : 0)))
      for (let c = 0; c < maxCols; c++) {
        let hits = 0
        for (let r = 0; r < Math.min(matrix.length, 30); r++) {
          const v = normalizeCell((matrix[r] || [])[c] || '') .toLowerCase()
          if (!v) continue
          if (/(material|bahan|upah|tenaga|labou?r|labor)/.test(v)) hits++
        }
        if (hits >= 2) { catCol = c; break }
      }
    }

    // If no category column found, return rows unchanged
    if (catCol === -1) return rows.map((r) => ({ ...r, category: undefined }))

    // Map each parsed row back to matrix rows to extract category value where possible.
    const out = []
    // find data start row index used by parse logic: scan until first data-like row
    let dataStart = 0
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i]
      if (!Array.isArray(row)) continue
      const nonEmpty = row.some((c) => normalizeCell(c))
      if (nonEmpty) { dataStart = i; break }
    }

    for (let i = 0, j = 0; i < rows.length && j + dataStart < matrix.length; i++, j++) {
      const mRow = matrix[dataStart + j] || []
      const catVal = normalizeCell(mRow[catCol] || '').toLowerCase()
      let cat = undefined
      if (/material|bahan/.test(catVal)) cat = 'material'
      else if (/upah|tenaga|labou?r|labor/.test(catVal)) cat = 'labor'
      out.push({ ...rows[i], category: cat })
    }
    return out
  }

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

  // Use permissive parser to get rows even when price is missing
  const rows = parseRowsAllowMissing(matrix, { requireHeader: false })
    return attachCategory(matrix, rows)
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const allRows = []

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName]
      if (!ws) return
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
      if (Array.isArray(matrix) && matrix.some((r) => Array.isArray(r) && r.some((c) => normalizeCell(c)))) {
  const rows = parseRowsAllowMissing(matrix, { requireHeader: false })
  const withCat = attachCategory(matrix, rows)
        allRows.push(...withCat)
      }
    })

    return allRows
  }

  throw new Error('Gunakan file .csv, .xlsx, atau .xls')
}

function findNumberedStartIndex(matrix) {
  // Find a row index where a column contains '1' and following rows have increasing integers
  if (!Array.isArray(matrix) || !matrix.length) return -1
  const maxCols = Math.max(...matrix.map((r) => (Array.isArray(r) ? r.length : 0)))
  for (let c = 0; c < maxCols; c++) {
    for (let r = 0; r < matrix.length; r++) {
      const cell = normalizeCell(matrix[r][c])
      if (cell === '1') {
        // check following rows for 2,3,... allowing some gaps
        let ok = true
        for (let k = 1; k <= 3; k++) {
          const next = normalizeCell((matrix[r + k] || [])[c])
          if (!next) { ok = false; break }
          if (String(Number(next)) !== next) { ok = false; break }
        }
        if (ok) return r
      }
    }
  }
  return -1
}
