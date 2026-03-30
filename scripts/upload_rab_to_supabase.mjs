#!/usr/bin/env node
/*
  Upload RAB CSV/XLSX to Supabase

  Usage:
    SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
      node scripts/upload_rab_to_supabase.mjs "/path/to/Untitled spreadsheet - Upah Bahan.csv"

  The script will try to detect sections (UPAH, MATERIAL, ALAT) and insert rows into
  the corresponding Supabase tables named: "upah", "materials", "alat".

  It is intentionally permissive. Review the console output before trusting the results.
*/

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Try to load a local .env file if present so users who store creds there don't need to export manually
function loadDotEnv() {
  try {
    const p = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(p)) return
    const txt = fs.readFileSync(p, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      // remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch (e) {
    // ignore
  }
}

loadDotEnv()

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const filePath = process.argv[2] || '/Users/nick/Downloads/Untitled spreadsheet - Upah Bahan.csv';
const DRY_RUN = process.argv.includes('--dry')
const UPDATE_ONLY = process.argv.includes('--update-only')
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

function parsePrice(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // remove surrounding quotes and non-digit except separators
  s = s.replace(/["\s]/g, '');
  // some values like Rp 100,000.00 or Rp 100.000,00 etc
  // remove currency letters
  s = s.replace(/[^0-9.,-]/g, '');
  if (!s) return null;
  // If both . and , exist, assume that the one that appears on the rightmost is the decimal separator
  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;
  if (hasDot && hasComma) {
    // remove thousand separators (the one that is not the rightmost)
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      // dot is decimal, remove all commas
      s = s.replace(/,/g, '');
    } else {
      // comma is decimal, remove all dots and replace comma with dot
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (hasComma && !hasDot) {
    // ambiguous: treat comma as thousand separator if pattern matches, otherwise decimal
    // if comma appears with groups of three, remove them
    if (/\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
  } else {
    // only dots or only digits - remove any commas just in case
    s = s.replace(/,/g, '');
  }

  // strip anything not 0-9 or dot or minus
  s = s.replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  const num = Number(s);
  if (Number.isNaN(num)) return null;
  // round to integer rupiah
  return Math.round(num);
}

function matrixFromSheet(sheet) {
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function findNumberedStartIndex(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return -1
  const maxCols = Math.max(...matrix.map((r) => (Array.isArray(r) ? r.length : 0)))
  for (let c = 0; c < maxCols; c++) {
    for (let r = 0; r < matrix.length; r++) {
      const cell = String((matrix[r] || [])[c] ?? '').trim()
      if (cell === '1') {
        let ok = true
        for (let k = 1; k <= 3; k++) {
          const next = String((matrix[r + k] || [])[c] ?? '').trim()
          if (!next) { ok = false; break }
          if (String(Number(next)) !== next) { ok = false; break }
        }
        if (ok) return r
      }
    }
  }
  return -1
}

function extractRows(matrix) {
  const startIdx = findNumberedStartIndex(matrix)
  const useMatrix = startIdx > 0 ? matrix.slice(startIdx - 1) : matrix
  const rows = []
  for (let r = 0; r < useMatrix.length; r++) {
    const row = useMatrix[r]
    if (!Array.isArray(row)) continue
    const first = row.findIndex((c) => String(c ?? '').trim())
    if (first === -1) continue
    const val = String(row[first] ?? '').trim()
    if (!/^\d+$/.test(val)) continue
    const code = String(row[first + 1] ?? '').trim()
    const name = String(row[first + 2] ?? '').trim()
    const unit = String(row[first + 3] ?? '').trim()
    const priceRaw = String(row[first + 4] ?? '').trim()
    rows.push({ code, name, unit, priceRaw })
  }
  return rows
}

async function uploadToSupabase(groups, fileName) {
  // Map logical groups to actual DB tables in this project
  // existing DB uses `labor` for upah and `materials` for materials; there is no `alat` table so fall back to `materials`
  const mapping = { upah: 'labor', materials: 'materials', alat: 'materials' };
  // fetch existing materials to help infer prices for alat
  let existingMaterials = []
  try {
    const { data: em, error: emErr } = await supabase.from('materials').select('id,name,price')
    if (emErr) throw emErr
    existingMaterials = em || []
  } catch (e) {
    console.warn('Could not load existing materials for price inference:', e?.message || e)
  }
  const existingPriceByName = new Map((existingMaterials || []).map((m) => [String(m.name || '').trim().toLowerCase(), m.price]))

  function normalizeName(n) {
    if (!n) return ''
    return String(n).trim().toLowerCase().replace(/\s+/g, ' ')
  }

  // in-memory cache of existing rows per table to avoid duplicates (normalized name -> {id,name,price})
  const tableCache = {}
  async function ensureTableCache(table) {
    if (tableCache[table]) return tableCache[table]
    try {
      const { data = [], error } = await supabase.from(table).select('id,name,price')
      if (error) throw error
      const m = new Map()
      for (const r of data) {
        m.set(normalizeName(r.name), { id: r.id, name: r.name, price: r.price })
      }
      tableCache[table] = m
      return m
    } catch (e) {
      console.warn('Could not load table cache for', table, e?.message || e)
      const m = new Map()
      tableCache[table] = m
      return m
    }
  }

  function inferPrice(row) {
    // prefer row.price (already parsed)
    if (row.price != null) return row.price
    // try priceRaw
    const pFromRaw = parsePrice(row.priceRaw || '')
    if (pFromRaw != null) return pFromRaw
    // try exact name match against existing materials
    const n = String(row.name || '').trim().toLowerCase()
    if (existingPriceByName.has(n)) return existingPriceByName.get(n)
    // permissive: extract numeric tokens from name and try parse
    const tokens = String(row.name || '').match(/[0-9][0-9\.,]{1,}[0-9]/g) || []
    for (const t of tokens) {
      const p = parsePrice(t)
      if (p != null) return p
    }
    return null
  }
  const unresolvedAll = []
  for (const k of Object.keys(groups)) {
    const table = mapping[k];
    if (!table) continue;
  // Only include columns we expect to exist in the tables: name, unit, price
  // Attempt to infer missing prices for any group using inferPrice
  const rows = groups[k].map((r) => {
    const base = { name: (r.name || '').trim() || null, unit: (r.unit || '').trim(), price: r.price == null ? null : r.price, priceRaw: r.priceRaw }
    if (base.price == null) {
      const inferred = inferPrice(r)
      if (inferred != null) base.price = inferred
    }
    return base
  })
  // collect unresolved rows for this group
  const unresolvedThisGroup = rows.filter((r) => r.price == null).map((r) => ({ table, ...r }))
  if (unresolvedThisGroup.length) unresolvedAll.push(...unresolvedThisGroup)
    if (rows.length === 0) continue;
    console.log(`Uploading ${rows.length} rows into table '${table}'`);
  // chunk processing to avoid payload limits
  const chunkSize = 100;
    let skippedAlat = 0
    for (let i = 0; i < rows.length; i += chunkSize) {
      // Filter out unresolved rows (price == null). We do not insert rows with null price.
      const rawChunk = rows.slice(i, i + chunkSize).map((r) => ({ name: r.name, unit: r.unit === null ? '' : r.unit, price: r.price == null ? null : r.price }))
      const before = rawChunk.length
      const chunk = rawChunk.filter((r) => r.price != null)
      if (k === 'alat') skippedAlat += before - chunk.length
      const names = chunk.map((r) => r.name).filter(Boolean);
      try {
        const existingMap = await ensureTableCache(table)

        const toInsert = []
        const toUpdate = []
        for (const r of chunk) {
          if (!r.name) continue
          const nn = normalizeName(r.name)
          const ex = existingMap.get(nn)
          if (ex) {
            // update only if incoming price is valid and different (or existing is null/0)
            if (r.price != null && (ex.price == null || Number(ex.price) === 0 || Number(ex.price) !== Number(r.price))) {
              toUpdate.push({ id: ex.id, name: ex.name, unit: r.unit, price: r.price })
            }
          } else {
            toInsert.push(r)
          }
        }

        if (toInsert.length) {
          if (UPDATE_ONLY) {
            console.log(`(update-only) Skipping ${toInsert.length} inserts into ${table}.`)
          } else if (DRY_RUN) {
            console.log(`(dry) Would insert ${toInsert.length} rows into ${table}.`)
          } else {
            const { error: insErr } = await supabase.from(table).insert(toInsert)
            if (insErr) throw insErr
            console.log(`Inserted ${toInsert.length} rows into ${table}.`)
            // refresh cache for inserted names
            const { data: after = [] } = await supabase.from(table).select('id,name,price').in('name', toInsert.map((t) => t.name))
            for (const a of after) existingMap.set(normalizeName(a.name), { id: a.id, name: a.name, price: a.price })
          }
        }

        if (toUpdate.length) {
          if (DRY_RUN) {
            console.log(`(dry) Would update ${toUpdate.length} rows in ${table}.`)
          } else {
            for (const u of toUpdate) {
              const { error: upErr } = await supabase.from(table).update({ name: u.name, unit: u.unit, price: u.price }).eq('id', u.id)
              if (upErr) throw upErr
              // update cache
              const nn = normalizeName(u.name)
              const cached = existingMap.get(nn)
              if (cached) cached.price = u.price
            }
            console.log(`Updated ${toUpdate.length} rows in ${table}.`)
          }
        }
      } catch (err) {
        console.error(`Error uploading chunk to ${table}:`, err?.message || err)
      }
    }
    if (k === 'alat' && skippedAlat) {
      console.warn(`Skipped inserting ${skippedAlat} alat rows due to missing price—see unresolved file for details.`)
    }
  }
  // after processing each group loop continues
  // at the end we will write unresolvedAll to file
  if (unresolvedAll.length) {
    try {
      const out = path.resolve(process.cwd(), `unresolved_rows_${Date.now()}.json`)
      fs.writeFileSync(out, JSON.stringify(unresolvedAll, null, 2), 'utf8')
      console.warn(`Warning: ${unresolvedAll.length} rows across groups had unresolved prices. Saved to ${out}`)
    } catch (e) {
      console.warn('Failed to write unresolved rows file:', e?.message || e)
    }
  }
}

async function createWorkItemsFromAlat(alatRows) {
  if (!Array.isArray(alatRows) || alatRows.length === 0) return
  console.log(`Creating work_items for ${alatRows.length} alat rows ...`)
  // Ensure each alat exists in materials table (we used materials as storage for alat)
  const chunkSize = 100
  for (let i = 0; i < alatRows.length; i += chunkSize) {
    const chunkRows = alatRows.slice(i, i + chunkSize).map((r) => ({ name: (r.name || '').trim(), unit: (r.unit || '').trim(), price: r.price == null ? 0 : r.price }))
    const names = [...new Set(chunkRows.map((c) => c.name).filter(Boolean))]
    if (!names.length) continue

    // Fetch existing materials and insert missing ones in batch
  const { data: existingM = [], error: selErr } = await supabase.from('materials').select('id,name,price').in('name', names)
    if (selErr) throw selErr
  const existingMatMap = new Map(existingM.map((e) => [e.name, { id: e.id, price: e.price }]))

  // prefer row.price if provided; otherwise leave price 0 and rely on earlier inference
  const missingMaterials = chunkRows.filter((c) => c.name && !existingMatMap.has(c.name)).map((c) => ({ name: c.name, unit: c.unit || '', price: c.price }))
    if (missingMaterials.length) {
      const { error: insErr } = await supabase.from('materials').insert(missingMaterials)
      if (insErr) throw insErr
      const { data: after = [] } = await supabase.from('materials').select('id,name').in('name', names)
      for (const a of after) existingMatMap.set(a.name, a.id)
    }

    // Fetch existing work_items and insert missing ones in batch
    const { data: existingWI = [], error: wiSelErr } = await supabase.from('work_items').select('id,name').in('name', names)
    if (wiSelErr) throw wiSelErr
    const existingWIMap = new Map(existingWI.map((w) => [w.name, w.id]))

    const missingWIs = names.filter((n) => !existingWIMap.has(n)).map((n) => ({ name: n }))
    if (missingWIs.length) {
      const { error: wiInsErr } = await supabase.from('work_items').insert(missingWIs)
      if (wiInsErr) throw wiInsErr
      const { data: afterWI = [] } = await supabase.from('work_items').select('id,name').in('name', names)
      for (const w of afterWI) existingWIMap.set(w.name, w.id)
    }

    // Prepare work_item_details in batch; only include materials that have price
    const details = []
    for (const c of chunkRows) {
      const mat = existingMatMap.get(c.name)
      const wiId = existingWIMap.get(c.name)
      if (!mat || !wiId) continue
      // skip if material price is null or zero (we assume CSV had no free items)
      if (mat.price == null || Number(mat.price) === 0) {
        console.warn(`Skipping work_item detail for '${c.name}' because material price is missing or zero.`)
        continue
      }
      details.push({ work_item_id: wiId, type: 'material', ref_id: mat.id, coefficient: 1 })
    }
    // Insert details in sub-chunks
    for (let j = 0; j < details.length; j += chunkSize) {
      const sub = details.slice(j, j + chunkSize)
      const { error: detErr } = await supabase.from('work_item_details').insert(sub)
      if (detErr) console.warn('Failed insert work_item_details chunk', detErr.message || detErr)
    }
  }
}

async function main() {
  console.log('Reading file:', filePath);
  const workbook = xlsx.readFile(filePath, { raw: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = matrixFromSheet(sheet);
  const extracted = extractRows(matrix);
  console.log('Extracted rows:', extracted.length);

  // attach parsed price and group by section
  const groups = { upah: [], materials: [], alat: [] };
  // If sheet contains a 'sewa peralatan' marker we want all following rows to be alat
  let alatMarkerFound = false
  for (const row of extracted) {
    const price = parsePrice(row.priceRaw || row.price || '');
    const r = { ...row, price };
    const name = (row.name || '').toLowerCase()
    const unit = (row.unit || '').toLowerCase()
    if (!alatMarkerFound && (name.includes('sewa peralatan') || name.includes('sewa alat') || (name.includes('sewa') && (name.includes('peralatan') || name.includes('alat'))))) {
      alatMarkerFound = true
      continue
    }
    if (alatMarkerFound) { groups.alat.push(r); continue }
    // Only classify as 'upah' using labor heuristics; everything else becomes materials.
    if (/(oh|pekerja|tukang|mandor|operator|sopir|kenek|driller|juru)/.test(name) || /^(oh|hari|shift)$/.test(unit)) {
      groups.upah.push(r)
    } else {
      groups.materials.push(r)
    }
  }

  console.log('Groups sizes:', Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])));

  const fileName = path.basename(filePath);
  await uploadToSupabase(groups, fileName);
  // After initial upload, reconcile any DB rows that still have price 0 by using parsed CSV prices
  async function reconcileZeroPrices(groups) {
    // build a name -> price map from parsed groups (prefer materials, then alat, then upah)
    const parsed = {}
    for (const k of Object.keys(groups)) {
      for (const r of groups[k]) {
        const n = String(r.name || '').trim()
        if (!n) continue
        const p = r.price == null ? null : r.price
        if (p != null && p > 0) {
          // prefer first seen non-zero price
          if (!parsed[n]) parsed[n] = p
        }
      }
    }

    const tables = ['materials', 'labor']
    for (const table of tables) {
      const names = Object.keys(parsed)
      if (!names.length) continue
      // fetch DB rows with price = 0
      const chunkSize = 500
      for (let i = 0; i < names.length; i += chunkSize) {
        const batch = names.slice(i, i + chunkSize)
        const { data: rows = [], error: selErr } = await supabase.from(table).select('id,name,price').in('name', batch).eq('price', 0)
        if (selErr) {
          console.warn('reconcileZeroPrices select error', selErr.message || selErr)
          continue
        }
        const updates = []
        for (const r of rows) {
          const p = parsed[String(r.name || '').trim()]
          if (p && Number(p) > 0) updates.push({ id: r.id, price: p })
        }
        // perform updates individually to avoid needing unique constraints
        for (const u of updates) {
          const { error: upErr } = await supabase.from(table).update({ price: u.price }).eq('id', u.id)
          if (upErr) console.warn('reconcile update failed', upErr.message || upErr)
        }
        if (updates.length) console.log(`Reconciled ${updates.length} rows in ${table}`)
      }
    }
  }
  await reconcileZeroPrices(groups)
  // Create work_items for each alat row by linking to the material record
  try {
    await createWorkItemsFromAlat(groups.alat)
    console.log('Work items creation from alat completed.')
  } catch (e) {
    console.error('Creating work items from alat failed:', e?.message || e)
  }
  console.log('Done. Review Supabase logs for any errors.');
}

main().catch((err) => { console.error(err); process.exit(1); });
