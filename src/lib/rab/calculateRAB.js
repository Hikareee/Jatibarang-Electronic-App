/**
 * Deterministic RAB: sum of (coefficient × unit price × volume) per work_item_detail row.
 * Uses batched Supabase reads (no N+1 per row).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} workItemId
 * @param {number|string} volume
 * @returns {Promise<{ breakdown: Array<Record<string, unknown>>, total: number, workItemId: string, volume: number }>}
 */
export async function calculateRAB(supabase, workItemId, volume) {
  const vol = Number(volume)
  if (!workItemId || typeof workItemId !== 'string') {
    throw new Error('Pekerjaan tidak valid')
  }
  if (Number.isNaN(vol) || vol < 0) {
    throw new Error('Volume harus angka ≥ 0')
  }

  const { data: details, error: detailsError } = await supabase
    .from('work_item_details')
    .select('id, type, ref_id, coefficient')
    .eq('work_item_id', workItemId)

  if (detailsError) throw detailsError

  if (!details?.length) {
    return {
      breakdown: [],
      total: 0,
      workItemId,
      volume: vol,
    }
  }

  const materialIds = [...new Set(details.filter((d) => d.type === 'material').map((d) => d.ref_id))]
  const laborIds = [...new Set(details.filter((d) => d.type === 'labor').map((d) => d.ref_id))]
  const alatIds = [...new Set(details.filter((d) => d.type === 'alat').map((d) => d.ref_id))]

  const [materialsRes, laborRes, alatRes] = await Promise.all([
    materialIds.length
      ? supabase.from('materials').select('id, name, unit, price').in('id', materialIds)
      : Promise.resolve({ data: [], error: null }),
    laborIds.length
      ? supabase.from('labor').select('id, name, unit, price').in('id', laborIds)
      : Promise.resolve({ data: [], error: null }),
    alatIds.length
      ? supabase.from('work_items').select('id, name, unit, price').in('id', alatIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (materialsRes.error) throw materialsRes.error
  if (laborRes.error) throw laborRes.error
  if (alatRes.error) throw alatRes.error

  const materialMap = Object.fromEntries((materialsRes.data || []).map((m) => [m.id, m]))
  const laborMap = Object.fromEntries((laborRes.data || []).map((l) => [l.id, l]))
  const alatMap = Object.fromEntries((alatRes.data || []).map((a) => [a.id, a]))

  const breakdown = []
  let total = 0

  for (const row of details) {
    const coef = Number(row.coefficient)
    if (Number.isNaN(coef) || coef < 0) {
      throw new Error('Koefisien tidak valid pada salah satu komponen')
    }

    let ref = null
    if (row.type === 'material') ref = materialMap[row.ref_id]
    else if (row.type === 'labor') ref = laborMap[row.ref_id]
    else if (row.type === 'alat') ref = alatMap[row.ref_id]
    else ref = null
    if (!ref) {
      breakdown.push({
        detailId: row.id,
        type: row.type,
        refId: row.ref_id,
        name: '(referensi tidak ditemukan)',
        unit: '',
        coefficient: coef,
        unitPrice: 0,
        lineTotal: 0,
      })
      continue
    }

    const unitPrice = Number(ref.price)
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new Error(`Harga tidak valid untuk: ${ref.name}`)
    }

    const lineTotal = coef * unitPrice * vol
    total += lineTotal

    breakdown.push({
      detailId: row.id,
      type: row.type,
      refId: row.ref_id,
      name: ref.name,
      unit: ref.unit,
      coefficient: coef,
      unitPrice,
      lineItemSubtotal: coef * unitPrice,
      lineTotal,
    })
  }

  return {
    breakdown,
    total,
    workItemId,
    volume: vol,
  }
}
