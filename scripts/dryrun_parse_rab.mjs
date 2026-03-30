#!/usr/bin/env node
import fs from 'fs'
import xlsx from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

function parsePrice(raw) {
  if (raw === undefined || raw === null) return null
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/[^0-9,.-]/g, '')
  if (!s) return null
  const hasDot = s.indexOf('.') !== -1
  const hasComma = s.indexOf(',') !== -1
  if (hasDot && hasComma) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '')
    else s = s.replace(/\./g, '').replace(/,/g, '.')
  } else if (hasComma && !hasDot) {
    if (/\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else s = s.replace(/,/g, '.')
  } else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isNaN(n) ? null : Math.round(n)
}

function csvToMatrix(text) {
  const lines = text.split(/\r?\n/)
  const matrix = lines.map((line) => {
    const cells = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; } else cur += ch
    }
    cells.push(cur.trim())
    return cells
  })
  return matrix
}

function normalizeCell(v) { return String(v ?? '').trim() }

function findNumberedStartIndex(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return -1
  const maxCols = Math.max(...matrix.map((r) => (Array.isArray(r) ? r.length : 0)))
  for (let c = 0; c < maxCols; c++) {
    for (let r = 0; r < matrix.length; r++) {
      const cell = normalizeCell((matrix[r] || [])[c])
      if (cell === '1') {
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

function extractFromMatrix(matrix) {
  const startIdx = findNumberedStartIndex(matrix)
  const use = startIdx > 0 ? matrix.slice(startIdx - 1) : matrix
  const rows = []
  // detect a section marker (e.g., "sewa peralatan") so subsequent rows are alat
  const lowerJoin = (arr) => String((arr || []).join(' ') || '').toLowerCase()
  let alatMarkerIdx = -1
  for (let i = 0; i < use.length; i++) {
    if (lowerJoin(use[i]).includes('sewa peralatan') || lowerJoin(use[i]).includes('sewa') && lowerJoin(use[i]).includes('peralatan')) { alatMarkerIdx = i; break }
  }

  for (let r = 0; r < use.length; r++) {
    const row = use[r]
    if (!Array.isArray(row)) continue
    const first = row.findIndex((c) => normalizeCell(c))
    if (first === -1) continue
    const val = normalizeCell(row[first])
    if (!/^\d+$/.test(val)) continue
    const code = normalizeCell(row[first + 1] || '')
    const name = normalizeCell(row[first + 2] || '')
    const unit = normalizeCell(row[first + 3] || '')
    const priceRaw = normalizeCell(row[first + 4] || '')
    const price = parsePrice(priceRaw)
    const section = alatMarkerIdx >= 0 && r > alatMarkerIdx ? 'alat' : undefined
    rows.push({ code, name, unit, priceRaw, price, section })
  }
  return rows
}

async function main() {
  const fp = process.argv[2] || '/Users/nick/Downloads/Untitled spreadsheet - Upah Bahan.csv'
  if (!fs.existsSync(fp)) { console.error('file not found', fp); process.exit(1) }
  const lower = fp.toLowerCase()
  let matrix = []
  if (lower.endsWith('.csv')) {
    const text = fs.readFileSync(fp, 'utf8')
    matrix = csvToMatrix(text)
  } else {
    const wb = xlsx.readFile(fp)
    const sheet = wb.SheetNames[0]
    matrix = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' })
  }
  const rows = extractFromMatrix(matrix)
  console.log('Total extracted rows:', rows.length)
  const groups = { upah: [], materials: [], alat: [] }
  for (const r of rows) {
    // heuristics: if unit or name contains OH or pekerjaan => labor
    const lowName = (r.name || '').toLowerCase()
    const lowUnit = (r.unit || '').toLowerCase()
    if (/(oh|pekerja|tukang|mandor|operator|sopir|kenek|driller|juru)/.test(lowName) || /^(oh|hari|shift)$/.test(lowUnit)) groups.upah.push(r)
    else if (r.section === 'alat') groups.alat.push(r)
    else groups.materials.push(r)
  }
  console.log('Groups:', Object.fromEntries(Object.keys(groups).map(k => [k, groups[k].length])))
  for (const k of Object.keys(groups)) {
    console.log('\n---', k, 'sample 10 ---')
    groups[k].slice(0, 10).forEach((s, i) => console.log(i + 1, s.code, s.name, s.unit, s.price))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
