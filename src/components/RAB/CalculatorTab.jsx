import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../firebase/supabaseClient'
import { calculateRAB } from '../../lib/rab/calculateRAB'
import { fetchAiRabEnhancement } from '../../lib/rab/aiRabClient'
import { formatCurrencyIDR } from '../../utils/rabFormatCurrency'
import { Loader2, Sparkles, History } from 'lucide-react'

export default function CalculatorTab({ visible = true }) {
  const [workItems, setWorkItems] = useState([])
  const [workItemId, setWorkItemId] = useState('')
  const [volume, setVolume] = useState('1')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [saveHistory, setSaveHistory] = useState(true)

  // Deterministic "real-world" factors (optional). AI remains second opinion.
  const [includeWaste, setIncludeWaste] = useState(true)
  const [wastePercent, setWastePercent] = useState(5)
  const [includeOverhead, setIncludeOverhead] = useState(true)
  const [overheadPercent, setOverheadPercent] = useState(10)
  const [includeTransport, setIncludeTransport] = useState(false)
  const [transportFixed, setTransportFixed] = useState(0)
  const [roundingMode, setRoundingMode] = useState('none') // none|thousand|hundred

  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [baseResult, setBaseResult] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [aiError, setAiError] = useState('')
  const [calcError, setCalcError] = useState('')
  const [deterministicAdjustedTotal, setDeterministicAdjustedTotal] = useState(null)

  const [history, setHistory] = useState([])

  const applyRounding = (value, mode) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    if (mode === 'thousand') return Math.round(n / 1000) * 1000
    if (mode === 'hundred') return Math.round(n / 100) * 100
    return n
  }

  const loadWorkItems = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase.from('work_items').select('id, name, unit, price').order('name')
    if (!error && data) {
      // Heuristic: pekerjaan rows have unit empty and price ~0; alat rows have unit+price.
      const nextPekerjaan = data.filter((w) => {
        const unit = String(w?.unit ?? '').trim()
        const priceNum = w?.price === null || w?.price === undefined ? 0 : Number(w?.price)
        const hasUnit = unit.length > 0 && unit.toLowerCase() !== 'null'
        const hasPrice = !Number.isNaN(priceNum) && priceNum > 0
        return !hasUnit && !hasPrice
      })
      setWorkItems(nextPekerjaan)
      setWorkItemId((prev) =>
        prev && nextPekerjaan.some((d) => d.id === prev) ? prev : nextPekerjaan[0]?.id || ''
      )
    }
    setLoadingList(false)
  }, [])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('rab_calculation_history')
      .select('id, volume, base_result, ai_result, ai_enabled, created_at, work_item_id')
      .order('created_at', { ascending: false })
      .limit(15)
    setHistory(data || [])
  }, [])

  useEffect(() => {
    if (!visible) return
    loadWorkItems()
    loadHistory()
  }, [visible, loadHistory, loadWorkItems])

  const handleCalculate = async () => {
    setCalcError('')
    setAiError('')
    setBaseResult(null)
    setAiResult(null)
    setDeterministicAdjustedTotal(null)

    const volNum = Number(volume)
    if (!workItemId) {
      setCalcError('Pilih jenis pekerjaan.')
      return
    }
    if (Number.isNaN(volNum) || volNum < 0) {
      setCalcError('Volume harus angka ≥ 0.')
      return
    }

    setLoading(true)
    try {
      const base = await calculateRAB(supabase, workItemId, volNum)
      setBaseResult(base)

      const wastePctNum = includeWaste ? Math.max(0, Number(wastePercent) || 0) : 0
      const overheadPctNum = includeOverhead ? Math.max(0, Number(overheadPercent) || 0) : 0
      const transportNum = includeTransport ? Math.max(0, Number(transportFixed) || 0) : 0
      const wasteMult = 1 + wastePctNum / 100
      const overheadMult = 1 + overheadPctNum / 100

      const rawAdjusted = base.total * wasteMult * overheadMult + transportNum
      const adjustedTotal = applyRounding(rawAdjusted, roundingMode)
      setDeterministicAdjustedTotal(adjustedTotal)

      const baseForAI = {
        ...base,
        deterministic_adjustments: {
          wastePercent: wastePctNum,
          overheadPercent: overheadPctNum,
          transportFixed: transportNum,
          roundingMode,
        },
        deterministic_adjusted_total: adjustedTotal,
      }

      let aiPayload = null
      if (aiEnabled) {
        const wrapName =
          workItems.find((w) => w.id === workItemId)?.name || ''
        const enriched = { ...baseForAI, workItemName: wrapName }
        const aiRes = await fetchAiRabEnhancement(enriched)
        if (aiRes.ok) {
          aiPayload = aiRes.data
          setAiResult(aiPayload)
        } else {
          setAiError(aiRes.error || 'Estimasi AI gagal')
        }
      }

      if (saveHistory) {
        const { error: hErr } = await supabase.from('rab_calculation_history').insert({
          work_item_id: workItemId,
          volume: volNum,
          base_result: baseForAI,
          ai_result: aiPayload,
          ai_enabled: aiEnabled,
        })
        if (hErr) console.warn('Riwayat tidak tersimpan:', hErr.message)
        loadHistory()
      }
    } catch (e) {
      console.error(e)
      setCalcError(e?.message || 'Perhitungan gagal')
    } finally {
      setLoading(false)
    }
  }

  const diff =
    baseResult && aiResult && typeof aiResult.adjusted_total === 'number'
      ? aiResult.adjusted_total - (deterministicAdjustedTotal ?? baseResult.total)
      : null

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kalkulator RAB</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Mesin deterministik = sumber kebenaran angka. AI = lapisan saran (harga pasar, waste, risiko) — selalu
          ditampilkan terpisah.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pekerjaan</label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2"
              value={workItemId}
              onChange={(e) => setWorkItemId(e.target.value)}
              disabled={loadingList}
            >
              {loadingList ? (
                <option>Memuat…</option>
              ) : workItems.length === 0 ? (
                <option value="">Buat pekerjaan di tab Pekerjaan</option>
              ) : (
                workItems.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volume</label>
            <input
              type="number"
              min={0}
              step="any"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Faktor deterministik (opsional)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWaste}
                onChange={(e) => setIncludeWaste(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Waste (%)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              disabled={!includeWaste}
              value={wastePercent}
              onChange={(e) => setWastePercent(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 disabled:opacity-50"
            />

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeOverhead}
                onChange={(e) => setIncludeOverhead(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Overhead (%)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              disabled={!includeOverhead}
              value={overheadPercent}
              onChange={(e) => setOverheadPercent(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 disabled:opacity-50"
            />

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTransport}
                onChange={(e) => setIncludeTransport(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Transport (Rp)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              disabled={!includeTransport}
              value={transportFixed}
              onChange={(e) => setTransportFixed(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2 disabled:opacity-50"
            />

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">Pembulatan</label>
              <select
                value={roundingMode}
                onChange={(e) => setRoundingMode(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white px-3 py-2"
              >
                <option value="none">None</option>
                <option value="hundred">Ke ratusan</option>
                <option value="thousand">Ke ribuan</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Sertakan estimasi AI (Gemini)
            </span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={saveHistory}
              onChange={(e) => setSaveHistory(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Simpan ke riwayat
          </label>
        </div>

        <button
          type="button"
          onClick={handleCalculate}
          disabled={loading || !workItemId}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Hitung
        </button>

        {calcError && (
          <p className="text-sm text-red-600 dark:text-red-400">{calcError}</p>
        )}
        {aiError && (
          <p className="text-sm text-amber-700 dark:text-amber-300">AI: {aiError}</p>
        )}
      </div>

      {baseResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="font-semibold text-gray-900 dark:text-white">Perhitungan dasar (deterministik)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Koefisien × harga satuan × volume</p>
            </div>
            <div className="p-4">
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                Total: {formatCurrencyIDR(baseResult.total)}
              </p>
              {deterministicAdjustedTotal !== null &&
                deterministicAdjustedTotal !== baseResult.total && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Total + faktor:{" "}
                    <span className="font-semibold">
                      {formatCurrencyIDR(deterministicAdjustedTotal)}
                    </span>
                  </p>
                )}
              <ul className="mt-3 space-y-2 text-sm max-h-56 overflow-y-auto">
                {baseResult.breakdown.map((row, i) => (
                  <li
                    key={row.detailId || i}
                    className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2"
                  >
                    <span className="text-gray-800 dark:text-gray-200">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase mr-1">{row.type}</span>
                      {row.name}
                    </span>
                    <span className="text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrencyIDR(row.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200/80 dark:border-amber-900/40 shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/80 dark:bg-amber-900/20">
              <h2 className="font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Estimasi AI (saran)
              </h2>
              {!aiEnabled && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI dimatikan untuk perhitungan ini.</p>
              )}
            </div>
            <div className="p-4">
              {aiResult ? (
                <>
                  <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
                    Total disesuaikan: {formatCurrencyIDR(aiResult.adjusted_total)}
                  </p>
                  {diff !== null && (
                    <p
                      className={`text-sm mt-1 font-medium ${
                        diff > 0
                          ? 'text-orange-600 dark:text-orange-400'
                          : diff < 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500'
                      }`}
                    >
                      Selisih vs deterministik (faktor): {diff > 0 ? '+' : ''}
                      {formatCurrencyIDR(diff)}
                    </p>
                  )}
                  <ul className="mt-3 space-y-2 text-sm max-h-40 overflow-y-auto">
                    {(aiResult.breakdown || []).map((row, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2"
                      >
                        <span className="text-gray-800 dark:text-gray-200">{row.name}</span>
                        <span className="whitespace-nowrap">{formatCurrencyIDR(row.estimated_cost)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {aiEnabled
                    ? aiError || 'Jalankan hitung dengan AI aktif untuk melihat saran.'
                    : 'Aktifkan opsi AI untuk lapisan kedua.'}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {aiResult?.notes && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Catatan AI</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{aiResult.notes}</p>
        </section>
      )}

      {history.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Riwayat terbaru</h3>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto text-sm">
            {history.map((h) => {
              const base = h.base_result
              const total = base?.total
              const aiT = h.ai_result?.adjusted_total
              return (
                <li key={h.id} className="px-4 py-2 flex flex-wrap justify-between gap-2 text-gray-700 dark:text-gray-300">
                  <span>
                    vol {h.volume} ·{' '}
                    {new Date(h.created_at).toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {h.ai_enabled ? '' : ' · tanpa AI'}
                  </span>
                  <span>
                    dasar {formatCurrencyIDR(total)}
                    {typeof aiT === 'number' ? ` → AI ${formatCurrencyIDR(aiT)}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
