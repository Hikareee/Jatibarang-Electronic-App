import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../firebase/supabaseClient'
import { Loader2, Plus, Trash2 } from 'lucide-react'

function isPekerjaanRow(w) {
  // Heuristic: your catalog "alat" rows usually have unit+price filled.
  // We treat rows without unit/price as "pekerjaan".
  const unit = String(w?.unit ?? '').trim()
  const price = w?.price
  const priceNum = price === null || price === undefined ? 0 : Number(price)
  const hasUnit = unit.length > 0 && unit.toLowerCase() !== 'null'
  const hasPrice = !Number.isNaN(priceNum) && priceNum > 0
  return !hasUnit && !hasPrice
}

export default function WorkItemsTab() {
  const [materials, setMaterials] = useState([])
  const [labor, setLabor] = useState([])
  const [workItems, setWorkItems] = useState([])

  const pekerjaanList = useMemo(() => (workItems || []).filter(isPekerjaanRow), [workItems])
  const alatOptions = useMemo(() => (workItems || []).filter((w) => !isPekerjaanRow(w)), [workItems])

  const [selectedId, setSelectedId] = useState('')
  const [details, setDetails] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAddComponentModal, setShowAddComponentModal] = useState(false)
  const [newComponentType, setNewComponentType] = useState('material')
  const [newComponentRefId, setNewComponentRefId] = useState('')
  const [newComponentCoefficient, setNewComponentCoefficient] = useState('1')

  const [showAddPekerjaanModal, setShowAddPekerjaanModal] = useState(false)
  const [newPekerjaanName, setNewPekerjaanName] = useState('')

  const loadRefs = useCallback(async () => {
    setError('')
    const [mRes, lRes, wiRes] = await Promise.all([
      supabase.from('materials').select('id, name, unit, price').order('name'),
      supabase.from('labor').select('id, name, unit, price').order('name'),
      supabase.from('work_items').select('id, name, unit, price').order('name'),
    ])
    if (mRes.error) throw mRes.error
    if (lRes.error) throw lRes.error
    if (wiRes.error) throw wiRes.error
    const nextMaterials = mRes.data || []
    const nextLabor = lRes.data || []
    const nextWorkItems = wiRes.data || []
    setMaterials(nextMaterials)
    setLabor(nextLabor)
    setWorkItems(nextWorkItems)
    return { nextMaterials, nextLabor, nextWorkItems }
  }, [])

  const loadDetails = useCallback(async (workItemId) => {
    if (!workItemId) {
      setDetails([])
      return
    }
    const { data, error: dErr } = await supabase
      .from('work_item_details')
      .select('id, work_item_id, type, ref_id, coefficient')
      .eq('work_item_id', workItemId)
      // no ordering guarantee across existing DB variants

    if (dErr) throw dErr
    setDetails(data || [])
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { nextWorkItems } = await loadRefs()
      const pekerjaanNext = (nextWorkItems || []).filter(isPekerjaanRow)
      const first = pekerjaanNext[0]?.id || ''
      setSelectedId((prev) => {
        const stillExists = pekerjaanNext.some((p) => p.id === prev)
        return stillExists ? prev : first
      })
    } catch (e) {
      setError(e?.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [loadRefs])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    // If pekerjaan list changed (e.g. after creating a new one), auto-select first if empty.
    if (!selectedId && pekerjaanList.length) {
      setSelectedId(pekerjaanList[0].id)
    }
  }, [pekerjaanList, selectedId])

  useEffect(() => {
    if (!selectedId) return
    loadDetails(selectedId)
  }, [selectedId, loadDetails])

  const selectedPekerjaan = (pekerjaanList || []).find((p) => p.id === selectedId) || null

  const getRefItem = (d) => {
    if (d.type === 'material') return materials.find((m) => m.id === d.ref_id) || null
    if (d.type === 'labor') return labor.find((l) => l.id === d.ref_id) || null
    if (d.type === 'alat') return alatOptions.find((a) => a.id === d.ref_id) || null
    return null
  }

  const totalPerUnit = useMemo(() => {
    return (details || []).reduce((sum, d) => {
      const item = getRefItem(d)
      const coef = Number(d.coefficient) || 0
      const unitPrice = Number(item?.price) || 0
      return sum + coef * unitPrice
    }, 0)
  }, [details, materials, labor, alatOptions])

  const openAddComponent = (type) => {
    setNewComponentType(type)
    setShowAddComponentModal(true)
    if (type === 'material') {
      setNewComponentRefId(materials[0]?.id || '')
    } else if (type === 'labor') {
      setNewComponentRefId(labor[0]?.id || '')
    } else {
      setNewComponentRefId(alatOptions[0]?.id || '')
    }
    setNewComponentCoefficient('1')
  }

  const confirmAddComponent = async () => {
    if (!selectedId) return
    if (!newComponentRefId) return

    const coefNum = Number(newComponentCoefficient)
    if (Number.isNaN(coefNum) || coefNum < 0) {
      setError('Koefisien harus angka ≥ 0')
      return
    }

    try {
      setError('')
      const payload = {
        work_item_id: selectedId,
        type: newComponentType,
        ref_id: newComponentRefId,
        coefficient: coefNum,
      }
      const { error: insErr } = await supabase.from('work_item_details').insert(payload)
      if (insErr) throw insErr
      await loadDetails(selectedId)
      setShowAddComponentModal(false)
    } catch (e) {
      setError(e?.message || 'Gagal menambah komponen')
    }
  }

  const updateCoefficient = async (detailId, coef) => {
    const coefNum = Number(coef)
    if (Number.isNaN(coefNum) || coefNum < 0) return
    const { error: upErr } = await supabase
      .from('work_item_details')
      .update({ coefficient: coefNum })
      .eq('id', detailId)
    if (upErr) setError(upErr.message)
    await loadDetails(selectedId)
  }

  const deleteDetail = async (detailId) => {
    if (!confirm('Hapus komponen ini?')) return
    const { error: delErr } = await supabase.from('work_item_details').delete().eq('id', detailId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await loadDetails(selectedId)
  }

  const confirmAddPekerjaan = async () => {
    const name = String(newPekerjaanName || '').trim()
    if (!name) {
      setError('Nama pekerjaan wajib diisi')
      return
    }
    try {
      setError('')
      const { error: insErr } = await supabase.from('work_items').insert({
        name,
        unit: '',
        price: 0,
      })
      if (insErr) throw insErr
      setShowAddPekerjaanModal(false)
      setNewPekerjaanName('')
      // re-load everything
      await refresh()
    } catch (e) {
      setError(e?.message || 'Gagal menambah pekerjaan')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 min-h-[28rem]">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pekerjaan</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Buat pekerjaan, lalu tambahkan komponen (material / upah / alat) beserta koefisien.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddPekerjaanModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Pekerjaan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Daftar pekerjaan</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{pekerjaanList.length}</span>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
            {pekerjaanList.length === 0 && (
              <li className="p-3 text-sm text-gray-500 dark:text-gray-400">Belum ada pekerjaan.</li>
            )}
            {pekerjaanList.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedId === p.id
                      ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          {!selectedPekerjaan ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Pilih atau buat pekerjaan di panel kiri.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Dipilih</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selectedPekerjaan.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAddComponent('material')}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Tambah Material
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddComponent('labor')}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Tambah Upah
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddComponent('alat')}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Tambah Alat
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/70 text-left uppercase text-xs text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Komponen</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 w-28">Harga</th>
                      <th className="px-3 py-2 w-28">Koef.</th>
                      <th className="px-3 py-2 w-36">Subtotal</th>
                      <th className="px-3 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {details.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                          Belum ada komponen.
                        </td>
                      </tr>
                    )}
                    {details.map((d) => {
                      const item = getRefItem(d)
                      const coefNum = Number(d.coefficient) || 0
                      const unitPrice = Number(item?.price) || 0
                      const lineTotal = coefNum * unitPrice
                      return (
                        <tr key={d.id}>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                              {d.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">{item?.name || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">Rp {Math.round(unitPrice).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              defaultValue={String(coefNum)}
                              onBlur={(e) => updateCoefficient(d.id, e.target.value)}
                              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-2 py-1"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">Rp {Math.round(lineTotal).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => deleteDetail(d.id)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              aria-label="Hapus komponen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Total deterministik (per volume unit)
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  Rp {Math.round(totalPerUnit).toLocaleString('id-ID')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showAddComponentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Tambah Komponen</h3>

            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Jenis</label>
            <select
              value={newComponentType}
              onChange={(e) => {
                const t = e.target.value
                setNewComponentType(t)
                if (t === 'material') setNewComponentRefId(materials[0]?.id || '')
                if (t === 'labor') setNewComponentRefId(labor[0]?.id || '')
                if (t === 'alat') setNewComponentRefId(alatOptions[0]?.id || '')
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 mb-3"
            >
              <option value="material">Material</option>
              <option value="labor">Upah</option>
              <option value="alat">Alat</option>
            </select>

            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Item</label>
            <select
              value={newComponentRefId}
              onChange={(e) => setNewComponentRefId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 mb-3"
            >
              {newComponentType === 'material' &&
                materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              {newComponentType === 'labor' &&
                labor.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              {newComponentType === 'alat' &&
                alatOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>

            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Koefisien</label>
            <input
              type="number"
              min={0}
              step="any"
              value={newComponentCoefficient}
              onChange={(e) => setNewComponentCoefficient(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddComponentModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmAddComponent}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPekerjaanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Tambah Pekerjaan</h3>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nama pekerjaan</label>
            <input
              type="text"
              value={newPekerjaanName}
              onChange={(e) => setNewPekerjaanName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 mb-4"
              placeholder="Contoh: Pekerjaan Lantai, Perizinan, dst."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddPekerjaanModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmAddPekerjaan}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Buat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}