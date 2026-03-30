import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../firebase/supabaseClient'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { formatCurrencyIDR } from '../../utils/rabFormatCurrency'
import { parseMaterialsImportFile, parseUniversalImportFile } from '../../utils/rabImportMaterials'
import { createNewChat, saveMessageToChat } from '../../hooks/useAIChatHistory'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'

function validateNumericPrice(v) {
  const n = Number(v)
  return !Number.isNaN(n) && n >= 0 ? n : null
}

export default function MaterialsTab() {
  const [materials, setMaterials] = useState([])
  const [labor, setLabor] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [previewRows, setPreviewRows] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [recentImports, setRecentImports] = useState([])
  const [activeImportId, setActiveImportId] = useState(null)
  const [rawMatrixSample, setRawMatrixSample] = useState(null)
  const [columnMap, setColumnMap] = useState({ name: 0, unit: 1, price: 2, category: -1 })
  const [showColumnMapModal, setShowColumnMapModal] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mRes, lRes] = await Promise.all([
        supabase.from('materials').select('*').order('name', { ascending: true }),
        supabase.from('labor').select('*').order('name', { ascending: true }),
      ])
      if (mRes.error) throw mRes.error
      if (lRes.error) throw lRes.error
      setMaterials(mRes.data || [])
      setLabor(lRes.data || [])
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Gagal memuat data Supabase. Pastikan tabel RAB sudah dibuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    loadRecentImports()
  }, [loadAll])

  const loadRecentImports = async () => {
    try {
      const { data, error } = await supabase.from('rab_imports').select('*').order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      setRecentImports(data || [])
    } catch (err) {
      console.error('loadRecentImports', err)
    }
  }

  const persistMaterial = useDebouncedCallback(async (row) => {
    const name = String(row.name || '').trim()
    if (!name) return
    const price = validateNumericPrice(row.price)
    if (price === null) return
    const { error: upErr } = await supabase
      .from('materials')
      .update({
        name,
        unit: String(row.unit || '').trim(),
        price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (upErr) {
      console.error(upErr)
      setError(upErr.message)
    }
  }, 500)

  const persistLabor = useDebouncedCallback(async (row) => {
    const name = String(row.name || '').trim()
    if (!name) return
    const price = validateNumericPrice(row.price)
    if (price === null) return
    const { error: upErr } = await supabase
      .from('labor')
      .update({
        name,
        unit: String(row.unit || '').trim(),
        price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (upErr) {
      console.error(upErr)
      setError(upErr.message)
    }
  }, 500)

  const updateMaterialLocal = (id, patch) => {
    setMaterials((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      const row = next.find((r) => r.id === id)
      if (row) persistMaterial(row)
      return next
    })
  }

  const updateLaborLocal = (id, patch) => {
    setLabor((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      const row = next.find((r) => r.id === id)
      if (row) persistLabor(row)
      return next
    })
  }

  const addMaterial = async () => {
    setError('')
    const { data, error: insErr } = await supabase
      .from('materials')
      .insert({
        name: 'Material baru',
        unit: '',
        price: 0,
      })
      .select()
      .single()
    if (insErr) {
      setError(insErr.message)
      return
    }
    setMaterials((prev) => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
  }

  const addLabor = async () => {
    setError('')
    const { data, error: insErr } = await supabase
      .from('labor')
      .insert({
        name: 'Upah baru',
        unit: 'OH',
        price: 0,
      })
      .select()
      .single()
    if (insErr) {
      setError(insErr.message)
      return
    }
    setLabor((prev) => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
  }

  const deleteMaterial = async (id) => {
    if (!confirm('Hapus material ini?')) return
    const { error: delErr } = await supabase.from('materials').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setMaterials((prev) => prev.filter((r) => r.id !== id))
  }

  const deleteAllMaterials = async () => {
    if (!materials.length) return
    if (!confirm(`Hapus semua material (${materials.length} item)?`)) return
    setError('')
    // Avoid oversized `id IN (...)` query strings on large datasets.
    // Delete all rows with a broad valid filter instead.
    let { error: delErr } = await supabase.from('materials').delete().not('id', 'is', null)
    if (delErr) {
      // Fallback: chunked delete by IDs when broad delete is rejected by API/policies.
      const chunkSize = 200
      for (let i = 0; i < materials.length; i += chunkSize) {
        const ids = materials.slice(i, i + chunkSize).map((m) => m.id)
        const { error: chunkErr } = await supabase.from('materials').delete().in('id', ids)
        if (chunkErr) {
          delErr = chunkErr
          break
        }
      }
    }
    if (delErr) {
      setError(`Gagal hapus semua: ${delErr.message}`)
      return
    }
    setMaterials([])
    setImportMsg('Semua material berhasil dihapus.')
  }

  const deleteLabor = async (id) => {
    if (!confirm('Hapus item upah ini?')) return
    const { error: delErr } = await supabase.from('labor').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setLabor((prev) => prev.filter((r) => r.id !== id))
  }

  const handleImportMaterials = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportMsg('')
    try {
      setPreviewError('')
      const parsed = await parseUniversalImportFile(file)
      console.debug('parseUniversalImportFile ->', parsed?.length)
      if (!parsed || !parsed.length) {
        // fallback to older parser in case universal failed
        console.debug('universal parser returned empty, trying legacy parser')
        const legacy = await parseMaterialsImportFile(file)
        console.debug('parseMaterialsImportFile ->', legacy?.length)
        if (legacy && legacy.length) {
          // convert legacy rows to permissive preview format
          const rows = legacy.map((r, idx) => ({
            _id: idx,
            name: String(r.name || '').trim(),
            unit: String(r.unit || '').trim(),
            price: r.price == null ? '' : Number(r.price),
            priceRaw: r.price == null ? '' : String(r.price),
            category: r.category || 'material',
            __original: r,
          }))
          setPreviewRows(rows)
          setShowPreview(true)
          return
        }

        // If parser couldn't find rows, create an AI chat with file snippet to ask for help
        await createImportChatForAI(file)
        setImportMsg('Parser gagal mendeteksi baris. Saya membuat chat AI untuk membantu — buka tab AI Consultant.')
        return
      }

      // Persist parsed rows to Supabase (store raw import for auditing/manual correction)
      const persistImportToSupabase = async (fileName, parsedRows) => {
        try {
          const { data: importRec, error: insErr } = await supabase
            .from('rab_imports')
            .insert({ file_name: fileName, row_count: parsedRows.length, created_at: new Date().toISOString() })
            .select()
            .single()
          if (insErr) throw insErr
          const importId = importRec.id

          // insert rows in chunks
          const chunkSize = 500
          for (let i = 0; i < parsedRows.length; i += chunkSize) {
            const chunk = parsedRows.slice(i, i + chunkSize).map((r, idx) => ({
              import_id: importId,
              original_index: r.__index ?? i + idx,
              name: String(r.name || '').trim(),
              unit: String(r.unit || '').trim(),
              price: r.price == null || r.price === '' ? null : Number(r.price),
              price_raw: r.priceRaw || '',
              category: r.category || null,
            }))
            const { error: rowsErr } = await supabase.from('rab_import_rows').insert(chunk)
            if (rowsErr) throw rowsErr
          }
          return importId
        } catch (err) {
          console.warn('Persist import to Supabase failed:', err?.message || err)
          // Return null to continue local preview flow
          return null
        }
      }

  // Prepare preview rows (limit to 200 shown but keep full array)
  // Also capture a small raw matrix sample so user can map columns manually if needed
  const sampleMatrix = parsed.__matrixSample || null
  setRawMatrixSample(sampleMatrix)
  const rows = parsed.map((r, idx) => ({
        _id: idx,
        name: String(r.name || '').trim(),
        unit: String(r.unit || '').trim(),
        price: r.price == null ? '' : Number(r.price),
        priceRaw: r.price == null ? '' : String(r.price),
        category: r.category || 'material',
        __original: r,
        __index: idx,
      }))
      // attempt to persist parsed import to Supabase asynchronously
      ;(async () => {
        const importId = await persistImportToSupabase(file.name, parsed.map((p, i) => ({ ...p, __index: i })))
        if (importId) {
          setImportMsg((m) => `Parsed ${parsed.length} rows — saved import id ${importId}.`)
        }
      })()
      setPreviewRows(rows)
      setShowPreview(true)
      // If many rows missing prices or mapping seems off, show column map modal
      const missingCount = rows.filter((r) => r.price === '' || r.price === null).length
      if (missingCount > Math.max(5, Math.floor(rows.length * 0.15))) {
        setShowColumnMapModal(true)
      }
    } catch (err) {
      console.error(err)
      setPreviewError(err?.message || 'Gagal mem-parse file')
    }
  }

  const createImportChatForAI = async (file) => {
    try {
      const text = await file.text()
      const snippet = text.slice(0, 3000)
      const chatId = await createNewChat('anonymous')
      const content = `Saya tidak bisa mem-parsing file import ini. Berikut cuplikan awal file (max 3000 chars). Tolong bantu deteksi struktur tabel, kolom Nama/Satuan/Harga, dan berikan JSON mapping atau daftar langkah untuk mengekstrak data.\n\n${snippet}`
      const msg = { id: Date.now(), role: 'user', content, timestamp: new Date().toISOString() }
      await saveMessageToChat(chatId, msg)
    } catch (err) {
      console.error('Gagal membuat chat import AI', err)
    }
  }

  const openImportPreview = async (importId) => {
    try {
      setImportMsg('Loading import rows...')
      const { data, error } = await supabase.from('rab_import_rows').select('*').eq('import_id', importId).order('original_index', { ascending: true })
      if (error) throw error
      if (!data || !data.length) {
        setImportMsg('Tidak ada baris pada import ini.')
        return
      }
  const rows = data.map((r, idx) => ({
        _id: idx,
        name: r.name || '',
        unit: r.unit || '',
        price: r.price == null ? '' : Number(r.price),
        priceRaw: r.price_raw || '',
        category: r.category || 'material',
        __original: r,
      }))
      setPreviewRows(rows)
      setActiveImportId(importId)
      setShowPreview(true)
  // offer column mapping when many rows missing price
  const missingCount = rows.filter((r) => r.price === '' || r.price === null).length
  if (missingCount > Math.max(5, Math.floor(rows.length * 0.15))) setShowColumnMapModal(true)
    } catch (err) {
      console.error(err)
      setImportMsg('Gagal memuat baris import')
    }
  }

  const applyImportToCatalog = async (importId) => {
    try {
      setImportMsg('Menerapkan import ke katalog...')
      const { data, error } = await supabase.from('rab_import_rows').select('*').eq('import_id', importId).order('original_index', { ascending: true })
      if (error) throw error
      if (!data || !data.length) {
        setImportMsg('Tidak ada baris untuk diterapkan.')
        return
      }

      // Partition
      const materialsRows = data.filter((r) => !r.category || r.category === 'material')
      const laborRows = data.filter((r) => r.category === 'labor')

      const upsertByName = async (rows, table) => {
        // split: check existence by name
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200)
          const names = chunk.map((r) => r.name).filter(Boolean)
          // fetch existing
          const { data: existing = [], error: eErr } = await supabase.from(table).select('id,name').in('name', names)
          if (eErr) throw eErr
          const existingMap = new Map(existing.map((r) => [r.name, r.id]))

          const toInsert = []
          const toUpdate = []
          for (const r of chunk) {
            const rec = {
              name: r.name || '',
              unit: r.unit || '',
              price: r.price == null || r.price === '' ? 0 : Number(r.price),
            }
            const existingId = existingMap.get(r.name)
            if (existingId) {
              toUpdate.push({ id: existingId, ...rec })
            } else {
              toInsert.push(rec)
            }
          }

          if (toInsert.length) {
            const { error: insErr } = await supabase.from(table).insert(toInsert)
            if (insErr) throw insErr
          }
          // update one-by-one to avoid upsert complexity
          for (const u of toUpdate) {
            const { error: upErr } = await supabase.from(table).update({ name: u.name, unit: u.unit, price: u.price }).eq('id', u.id)
            if (upErr) throw upErr
          }
        }
      }

      await upsertByName(materialsRows, 'materials')
      await upsertByName(laborRows, 'labor')

      setImportMsg(`Import ${importId} applied to catalog.`)
      loadAll()
      loadRecentImports()
    } catch (err) {
      console.error('applyImportToCatalog', err)
      setImportMsg('Gagal menerapkan import ke katalog: ' + (err?.message || ''))
    }
  }

  const updatePreviewRow = (id, patch) => {
    setPreviewRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)))
  }

  const applyColumnMapping = () => {
    if (!rawMatrixSample) return
    const mat = rawMatrixSample
    const rows = []
    // find data start (skip empty rows)
    for (let i = 0; i < mat.length; i++) {
      const row = mat[i]
      if (!Array.isArray(row)) continue
      const nonEmpty = row.some((c) => normalizeCellForUI(c))
      if (!nonEmpty) continue
      // map
      const name = String(row[columnMap.name] ?? '').trim()
      const unit = String(row[columnMap.unit] ?? '').trim()
      const priceRaw = String(row[columnMap.price] ?? '').trim()
      const price = parsePriceForUI(priceRaw)
      const cat = columnMap.category >= 0 ? String(row[columnMap.category] ?? '').toLowerCase() : null
      rows.push({ _id: rows.length, name, unit, price: price == null ? '' : price, priceRaw, category: cat })
      if (rows.length >= 2000) break
    }
    setPreviewRows(rows)
    setShowColumnMapModal(false)
    setShowPreview(true)
  }

  // small helpers reused from parser side (duplicate minimal logic here)
  function normalizeCellForUI(v) {
    return String(v ?? '').trim()
  }
  function parsePriceForUI(v) {
    if (!v) return null
    let s = String(v).trim()
    if (/[A-Za-z]/.test(s) && !/rp|idr|rupiah/i.test(s)) return null
    s = s.replace(/[^0-9,.-]/g, '')
    if (!s) return null
    const hasDot = s.indexOf('.') !== -1
    const hasComma = s.indexOf(',') !== -1
    if (hasDot && hasComma) {
      if (s.indexOf('.') < s.indexOf(',')) s = s.replace(/\./g, '').replace(/,/g, '.')
      else s = s.replace(/,/g, '')
    } else if (hasComma && !hasDot) {
      const commaCount = (s.match(/,/g) || []).length
      const after = s.split(',').pop() || ''
      if (commaCount > 1 || (after.length === 3 && commaCount === 1)) s = s.replace(/,/g, '')
      else s = s.replace(/,/g, '.')
    } else if (hasDot && !hasComma) {
      const parts = s.split('.')
      const last = parts[parts.length - 1] || ''
      if (last.length === 3 && parts.length > 1) s = parts.join('')
    }
    const n = Number(s)
    return Number.isNaN(n) ? null : n
  }

  const confirmImportFromPreview = async () => {
    if (!previewRows || !previewRows.length) {
      setImportMsg('Tidak ada data untuk diimpor.')
      setShowPreview(false)
      return
    }
    setImportMsg('Mengimpor...')
    try {
      const materialsRows = previewRows.filter((r) => !r.category || r.category === 'material')
      const laborRows = previewRows.filter((r) => r.category === 'labor')

      const insertChunks = async (rows, table) => {
        if (!rows.length) return 0
        const chunkSize = 300
        let inserted = 0
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize).map((r) => ({
            name: String(r.name || '').trim(),
            unit: String(r.unit || '').trim(),
            price: Number(r.price) || 0,
          }))
          const { error: insErr } = await supabase.from(table).insert(chunk)
          if (insErr) throw insErr
          inserted += chunk.length
        }
        return inserted
      }

      let inserted = 0
      inserted += await insertChunks(materialsRows, 'materials')
      inserted += await insertChunks(laborRows, 'labor')

      setImportMsg(`Berhasil mengimpor ${inserted} item.`)
      setShowPreview(false)
      setPreviewRows(null)
      loadAll()
    } catch (err) {
      console.error(err)
      setImportMsg(`Import gagal: ${err?.message || 'Bad Request'}`)
    }
  }

  const askAIForMissingPrices = async () => {
    if (!previewRows) return
    const missing = previewRows.filter((r) => r.price === '' || r.price === null || r.price === undefined)
    if (!missing.length) {
      setImportMsg('Tidak ada item yang memerlukan harga.')
      return
    }
    // Create a chat and post a message listing the missing items so user/AI can discuss
    try {
      const chatId = await createNewChat('anonymous')
      const content = `Tolong bantu berikan perkiraan atau minta data harga untuk item berikut:\n${missing
        .slice(0, 50)
        .map((m) => `- ${m.name} (satuan: ${m.unit || '-'})`)
        .join('\n')}`
      const msg = { id: Date.now(), role: 'user', content, timestamp: new Date().toISOString() }
      await saveMessageToChat(chatId, msg)
      setImportMsg(`Chat dibuat (id: ${chatId}). Buka tab AI Consultant untuk melanjutkan.`)
      setShowPreview(false)
      setPreviewRows(null)
    } catch (err) {
      console.error(err)
      setImportMsg('Gagal membuat chat AI.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-2" />
        Memuat harga…
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Material</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Edit langsung; penyimpanan otomatis dibengkokkan (~500ms). Import: file{' '}
          <strong className="font-medium text-gray-800 dark:text-gray-200">.csv / .xlsx / .xls</strong> dengan kolom{' '}
          <strong className="font-medium text-gray-800 dark:text-gray-200">Nama, Satuan, Harga</strong> (baris pertama boleh
          header).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Daftar material</h2>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <Upload className="h-4 w-4" />
              Import CSV / Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleImportMaterials}
              />
            </label>
            <button
              type="button"
              onClick={deleteAllMaterials}
              disabled={!materials.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Hapus Semua
            </button>
            <button
              type="button"
              onClick={addMaterial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          </div>
        </div>
        {importMsg && (
          <p className="text-sm text-gray-600 dark:text-gray-400 px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            {importMsg}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/80 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2 w-24">Satuan</th>
                <th className="px-4 py-2 w-36">Harga</th>
                <th className="px-4 py-2 w-32">Preview</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {materials.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-[12rem] bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.name}
                      onChange={(e) => updateMaterialLocal(row.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.unit ?? ''}
                      onChange={(e) => updateMaterialLocal(row.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.price}
                      onChange={(e) => updateMaterialLocal(row.id, { price: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatCurrencyIDR(row.price)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => deleteMaterial(row.id)}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {materials.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Belum ada material.</p>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Upah / tenaga kerja</h2>
          <button
            type="button"
            onClick={addLabor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/80 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2 w-24">Satuan</th>
                <th className="px-4 py-2 w-36">Harga</th>
                <th className="px-4 py-2 w-32">Preview</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {labor.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-[12rem] bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.name}
                      onChange={(e) => updateLaborLocal(row.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.unit ?? ''}
                      onChange={(e) => updateLaborLocal(row.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 dark:text-white"
                      value={row.price}
                      onChange={(e) => updateLaborLocal(row.id, { price: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {formatCurrencyIDR(row.price)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => deleteLabor(row.id)}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {labor.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Belum ada data upah.</p>
          )}
        </div>
      </section>
    </div>
  )
}

// Column mapping helpers (rendered as modal via state)
function ColumnMapModal({ sampleMatrix, columnMap, onChange, onClose, onApply }) {
  if (!sampleMatrix) return null
  const cols = Math.max(...sampleMatrix.map((r) => r.length))
  const indices = Array.from({ length: cols }, (_, i) => i)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded p-4 w-[80%] max-h-[80%] overflow-auto">
        <h3 className="text-lg font-semibold mb-2">Column mapping</h3>
        <p className="text-sm text-gray-600 mb-3">Pilih kolom untuk Nama, Satuan, Harga, dan Kategori (opsional).</p>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex gap-2 items-center">
            <label className="w-24">Nama</label>
            <select value={columnMap.name} onChange={(e) => onChange({ ...columnMap, name: Number(e.target.value) })} className="flex-1">
              {indices.map((i) => <option key={i} value={i}>Column {i}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-24">Satuan</label>
            <select value={columnMap.unit} onChange={(e) => onChange({ ...columnMap, unit: Number(e.target.value) })} className="flex-1">
              {indices.map((i) => <option key={i} value={i}>Column {i}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-24">Harga</label>
            <select value={columnMap.price} onChange={(e) => onChange({ ...columnMap, price: Number(e.target.value) })} className="flex-1">
              {indices.map((i) => <option key={i} value={i}>Column {i}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="w-24">Kategori</label>
            <select value={columnMap.category} onChange={(e) => onChange({ ...columnMap, category: Number(e.target.value) })} className="flex-1">
              <option value={-1}>(none)</option>
              {indices.map((i) => <option key={i} value={i}>Column {i}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-medium mb-2">Sample rows</h4>
          <div className="overflow-auto text-xs border rounded p-2 max-h-56 bg-gray-50 dark:bg-gray-900">
            <table className="w-full table-auto">
              <tbody>
                {sampleMatrix.slice(0,10).map((r, ri) => (
                  <tr key={ri} className="align-top">
                    {Array.from({ length: cols }).map((_, ci) => (
                      <td key={ci} className="px-2 py-1 align-top border-r last:border-r-0">{String((r[ci] ?? '')).slice(0,40)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={onApply} className="px-3 py-1 bg-blue-600 text-white rounded">Apply mapping</button>
        </div>
      </div>
    </div>
  )
}

