import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../firebase/supabaseClient'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export default function WorkItemsTab() {
  const [workItems, setWorkItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [labor, setLabor] = useState([])
  const [detailsByWork, setDetailsByWork] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRefs = useCallback(async () => {
    const [mRes, lRes] = await Promise.all([
      supabase.from('materials').select('id, name, unit, price').order('name'),
      supabase.from('labor').select('id, name, unit, price').order('name'),
    ])
    if (mRes.error) throw mRes.error
    if (lRes.error) throw lRes.error
    setMaterials(mRes.data || [])
    setLabor(lRes.data || [])
  }, [])

  const loadDetails = useCallback(async (workItemIds) => {
    if (!workItemIds.length) {
      setDetailsByWork({})
      return
    }
    const { data, error: dErr } = await supabase
      .from('work_item_details')
      .select('*')
      .in('work_item_id', workItemIds)
      .order('created_at', { ascending: true })
    if (dErr) throw dErr
    const map = {}
    for (const row of data || []) {
      if (!map[row.work_item_id]) map[row.work_item_id] = []
      map[row.work_item_id].push(row)
    }
    setDetailsByWork(map)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await loadRefs()
      const { data: items, error: wErr } = await supabase
        .from('work_items')
        .select('*')
        .order('name', { ascending: true })
      if (wErr) throw wErr
      setWorkItems(items || [])
      const ids = (items || []).map((i) => i.id)
      await loadDetails(ids)
      setSelectedId((prev) => {
        if (prev && ids.includes(prev)) return prev
        return ids[0] || null
      })
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Gagal memuat pekerjaan')
    } finally {
      setLoading(false)
    }
  }, [loadDetails, loadRefs])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selected = workItems.find((w) => w.id === selectedId)
  const details = selectedId ? detailsByWork[selectedId] || [] : []

  const addWorkItem = async () => {
    setError('')
    const { data, error: insErr } = await supabase
      .from('work_items')
      .insert({ name: 'Pekerjaan baru' })
      .select()
      .single()
    if (insErr) {
      setError(insErr.message)
      return
    }
    await refresh()
    setSelectedId(data.id)
  }

  const updateWorkName = async (id, name) => {
    const n = String(name || '').trim()
    if (!n) return
    const { error: upErr } = await supabase.from('work_items').update({ name: n }).eq('id', id)
    if (upErr) setError(upErr.message)
    else setWorkItems((prev) => prev.map((w) => (w.id === id ? { ...w, name: n } : w)))
  }

  const deleteWorkItem = async (id) => {
    if (!confirm('Hapus pekerjaan dan semua komponennya?')) return
    const { error: delErr } = await supabase.from('work_items').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    if (selectedId === id) setSelectedId(null)
    await refresh()
  }

  const addDetail = async () => {
    if (!selectedId) return
    const defaultMat = materials[0]
    if (!defaultMat) {
      setError('Tambah minimal satu material atau upah di tab Material terlebih dahulu.')
      return
    }
    setError('')
    const { error: insErr } = await supabase.from('work_item_details').insert({
      work_item_id: selectedId,
      type: 'material',
      ref_id: defaultMat.id,
      coefficient: 1,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    await loadDetails(workItems.map((w) => w.id))
  }

  const updateDetail = async (detailId, patch) => {
    const coef =
      patch.coefficient !== undefined ? Number(patch.coefficient) : undefined
    if (coef !== undefined && (Number.isNaN(coef) || coef < 0)) {
      setError('Koefisien harus angka ≥ 0')
      return
    }
    const payload = { ...patch }
    if (coef !== undefined) payload.coefficient = coef
    const { error: upErr } = await supabase.from('work_item_details').update(payload).eq('id', detailId)
    if (upErr) {
      setError(upErr.message)
      return
    }
    await loadDetails(workItems.map((w) => w.id))
  }

  const deleteDetail = async (detailId) => {
    const { error: delErr } = await supabase.from('work_item_details').delete().eq('id', detailId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await loadDetails(workItems.map((w) => w.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-2" />
        Memuat…
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 min-h-[32rem]">
      <div className="lg:w-72 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow flex flex-col max-h-[70vh] lg:max-h-none">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Daftar pekerjaan</h2>
          <button
            type="button"
            onClick={addWorkItem}
            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            title="Tambah"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="overflow-y-auto flex-1 p-2 space-y-1">
          {workItems.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setSelectedId(w.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === w.id
                    ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {!selected ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Pilih atau buat pekerjaan di panel kiri.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div className="flex-1 min-w-[12rem]">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Nama pekerjaan</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                  defaultValue={selected.name}
                  key={selected.id}
                  onBlur={(e) => updateWorkName(selected.id, e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => deleteWorkItem(selected.id)}
                className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline mt-6"
              >
                <Trash2 className="h-4 w-4" />
                Hapus pekerjaan
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Komponen (material / upah)</h3>
              <button
                type="button"
                onClick={addDetail}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Tambah komponen
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/80 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 w-28">Koef.</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {details.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1"
                          value={d.type}
                          onChange={(e) => {
                            const type = e.target.value
                            const refId =
                              type === 'material' ? materials[0]?.id : labor[0]?.id
                            if (!refId) {
                              setError(`Tambah daftar ${type === 'material' ? 'material' : 'upah'} terlebih dahulu.`)
                              return
                            }
                            updateDetail(d.id, { type, ref_id: refId })
                          }}
                        >
                          <option value="material">Material</option>
                          <option value="labor">Upah</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full min-w-[10rem] rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1"
                          value={d.ref_id}
                          onChange={(e) => updateDetail(d.id, { ref_id: e.target.value })}
                        >
                          {(d.type === 'material' ? materials : labor).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name} ({formatRefLabel(opt)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1"
                          value={d.coefficient}
                          onBlur={(e) => updateDetail(d.id, { coefficient: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => deleteDetail(d.id)}
                          className="p-1.5 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {details.length === 0 && (
                <p className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Belum ada komponen. Gunakan &quot;Tambah komponen&quot;.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatRefLabel(row) {
  const p = Number(row.price)
  const price = Number.isNaN(p) ? '-' : `Rp${Math.round(p).toLocaleString('id-ID')}`
  return `${row.unit || '-'} @ ${price}`
}
