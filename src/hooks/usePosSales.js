import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { labelForPosFulfillmentId } from '../constants/posFulfillmentModes'
import { getNextInvoiceNumber } from './useInvoiceData'
import { normalizeSerialId } from '../utils/itemSerials'
import { updateAccountBalance } from '../utils/accountBalance'

/** @param {string} iso */
function addDaysIso(iso, days) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * Commit a POS sale with per-unit serial validation and warehouse stock decrement.
 *
 * @param {object} params
 * @param {string} params.warehouseId - outlet utama (cetak dokumen); stok bisa di lokasi lain jika eligibleWarehouseIds mencakup gudang serial.
 * @param {string} params.eligibleWarehouseIds - daftar warehouse ID tempat POS boleh menjual dari (mis. gudang + etalase). Default [warehouseId].
 * @param {boolean} [params.allowPartialCash] - jika true + tunai, terima pembayaran < total (DP/sisa lunas di Tagihan).
 * @param {Array<{ productId: string, serialNumber: string, unitPrice?: number, lineDiscountRp?: number, stockDocIdForDecrement?: string }>} params.lines
 * @param {object} params.stockDocIdByProductId - map productId → doc id pada **warehouseId** utama (fallback jika line tanpa doc)
 * @param {string} [params.fulfillmentMode] - id POS_FULFILLMENT_OPTIONS (mis. pickup_store, wrap, delivery, booking)
 * @param {number} [params.payLaterDueDays] - hari jatuh tempo dari transaksi jika paymentMethod pay_later (default 30)
 * @param {string} [params.customerId] - id kontak pelanggan (kosong untuk walk-in)
 * @param {string} [params.customerName] - nama pelanggan tampilan POS
 * @param {string} [params.customerPhone] - nomor telepon pelanggan
 * @param {string} [params.customerAddress] - alamat pelanggan (untuk antar)
 */
export async function commitPosSale(params) {
  const {
    warehouseId,
    eligibleWarehouseIds: eligibleParam,
    lines,
    salespersonUid,
    salespersonName,
    paymentMethod,
    accountId,
    cashierUid,
    cashTendered,
    allowPartialCash: allowPartialParam,
    orderDiscountRp,
    serviceChargeRp,
    vatRatePercent: vatRateParam,
    taxLabel: taxLabelParam,
    productById,
    stockDocIdByProductId,
    fulfillmentMode: fulfillmentModeParam,
    payLaterDueDays: payLaterDueDaysParam,
    customerId: customerIdParam,
    customerName: customerNameParam,
    customerPhone: customerPhoneParam,
    customerAddress: customerAddressParam,
  } = params

  const sanitizedMode =
    String(fulfillmentModeParam || '')
      .trim()
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 32) || ''
  const fulfillmentMode = sanitizedMode || 'pickup_store'
  /** Per-line mode when set on cart rows; fallback to cashier global mode. */
  const lineFulfillmentModes = lines.map((ln) => {
    const fromLine =
      String(ln?.fulfillmentMode || '')
        .trim()
        .replace(/[^a-z0-9_-]/gi, '')
        .slice(0, 32) || ''
    return fromLine || fulfillmentMode
  })
  const anyLineDelivery = lineFulfillmentModes.some((m) => m === 'delivery')
  const invoiceHeaderFulfillmentMode =
    lineFulfillmentModes.length &&
    lineFulfillmentModes.every((m) => m === lineFulfillmentModes[0])
      ? lineFulfillmentModes[0]
      : 'mixed'
  const invoiceHeaderFulfillmentLabel =
    invoiceHeaderFulfillmentMode === 'mixed'
      ? [...new Set(lineFulfillmentModes.map((m) => labelForPosFulfillmentId(m)))].join(' · ')
      : labelForPosFulfillmentId(invoiceHeaderFulfillmentMode)
  const fulfillSuffix = invoiceHeaderFulfillmentLabel ? ` — ${invoiceHeaderFulfillmentLabel}` : ''
  const customerId = String(customerIdParam || '').trim()
  const customerName = String(customerNameParam || '').trim() || 'POS Walk-in'
  const customerPhone = String(customerPhoneParam || '').trim()
  const customerAddress = String(customerAddressParam || '').trim()

  if (!warehouseId) throw new Error('Gudang wajib dipilih')
  if (!salespersonUid && !salespersonName?.trim()) {
    throw new Error('Nama salesperson wajib diisi')
  }
  if (!lines?.length) throw new Error('Keranjang kosong')

  const eligibleWarehouseIds =
    Array.isArray(eligibleParam) && eligibleParam.length > 0
      ? [...new Set(eligibleParam.filter(Boolean))]
      : [warehouseId]

  const pmNorm = String(paymentMethod || '')
  const isPayLater = pmNorm === 'pay_later' || pmNorm === 'bayar_nanti'

  const isCashMethod = paymentMethod === 'cash' || paymentMethod === 'tunai'
  const allowPartialCash = allowPartialParam === true && isCashMethod

  const payLaterDays = Math.min(
    365,
    Math.max(1, Math.round(Number(payLaterDueDaysParam) || 30))
  )

  const serialKeys = lines.map((l) => normalizeSerialId(l.serialNumber))
  const dupCheck = new Set()
  for (const k of serialKeys) {
    if (!k) throw new Error('Nomor serial tidak valid')
    if (dupCheck.has(k)) throw new Error('Serial duplikat di keranjang')
    dupCheck.add(k)
  }

  const number = await getNextInvoiceNumber()
  const nowIso = new Date().toISOString()
  let dueIsoForRemainder = nowIso.split('T')[0]

  return runTransaction(db, async (transaction) => {
    const invoiceRef = doc(collection(db, 'invoices'))
    const txRef = doc(collection(db, 'transactions'))
    const ledgerRef = doc(collection(db, 'posCashLedger'))

    /** @type {Array<object>} */
    const invoiceItems = []
    let subtotal = 0

    const serialRefs = lines.map((line) =>
      doc(db, 'itemSerials', normalizeSerialId(line.serialNumber))
    )
    const serialSnaps = await Promise.all(serialRefs.map((ref) => transaction.get(ref)))

    const orderDiscRaw = Math.max(0, Math.round(Number(orderDiscountRp) || 0))
    const svcRaw = Math.max(0, Math.round(Number(serviceChargeRp) || 0))
    const vatRatePercent =
      Number.isFinite(Number(vatRateParam)) && Number(vatRateParam) >= 0
        ? Number(vatRateParam)
        : 11
    const taxLabel = String(taxLabelParam || 'PPN').slice(0, 12)

    // Validate serials and build items
    lines.forEach((line, idx) => {
      const lineFm = lineFulfillmentModes[idx] || fulfillmentMode
      const lineIsDelivery = lineFm === 'delivery'
      const pid = line.productId
      const norm = normalizeSerialId(line.serialNumber)
      if (!norm) throw new Error('Nomor serial tidak valid')
      const p = productById[pid]
      if (!p) throw new Error('Produk tidak ditemukan')
      const baseListed = Number(p.hargaJual ?? p.harga_jual ?? 0) || 0
      let unitPxVal =
        line.unitPrice !== undefined && line.unitPrice !== null
          ? Number(line.unitPrice)
          : baseListed
      if (!Number.isFinite(unitPxVal) || unitPxVal < 0) unitPxVal = baseListed

      const lineDiscount = Math.max(
        0,
        Math.round(Number(line.lineDiscountRp) || 0)
      )
      const unitNet = Math.max(0, unitPxVal - lineDiscount)
      subtotal += unitNet

      const serialSnap = serialSnaps[idx]
      if (!serialSnap.exists()) {
        throw new Error(`Serial "${norm}" tidak terdaftar di sistem`)
      }
      const sd = serialSnap.data()
      if (sd.status !== 'in_stock') {
        throw new Error(`Serial "${norm}" sudah terjual atau tidak tersedia`)
      }
      if (sd.productId !== pid) {
        throw new Error(`Serial "${norm}" bukan untuk produk ini`)
      }
      if (!eligibleWarehouseIds.includes(sd.warehouseId)) {
        throw new Error(
          `Serial "${norm}" tidak berada di lokasi stok yang diizinkan POS (gudang/etalase).`
        )
      }

      invoiceItems.push({
        product: p.nama || '',
        productId: pid,
        sku: p.kode || p.sku || '',
        serialNumber: norm,
        serialRaw: String(line.serialNumber || '').trim(),
        serialWarehouseId: sd.warehouseId || '',
        quantity: 1,
        unit: p.satuan || 'Pcs',
        unitPriceListed: baseListed,
        price: unitPxVal,
        lineDiscountRp: lineDiscount,
        amount: unitNet,
        discount: lineDiscount,
        tax: 0,
        description: p.deskripsi || '',
        spek: '-',
        deliveryStatus: lineIsDelivery ? 'awaiting_dispatch' : '',
        deliveryStatusLabel: lineIsDelivery ? 'Menunggu dispatch' : '',
        posLineFulfillmentMode: lineFm,
        posLineFulfillmentLabel: labelForPosFulfillmentId(lineFm),
      })
    })

    const lineSubtotalSum = subtotal
    const orderDiscCapped = Math.min(orderDiscRaw, lineSubtotalSum)
    const afterOrderDiscount = Math.max(0, lineSubtotalSum - orderDiscCapped)
    const taxableBase = Math.max(0, afterOrderDiscount + svcRaw)
    const ppnAmount = Math.round((taxableBase * vatRatePercent) / 100)
    const total = taxableBase + ppnAmount
    const merchandiseSubtotal = lineSubtotalSum

    const isCash = isCashMethod
    let tenderedRounded = 0
    let changeRounded = 0
    let invoiceRemainingAmt = 0
    let amountAppliedToBill = total
    let paidInFull = !isCash

    if (isCash) {
      const ct = Math.round(Number(cashTendered))
      if (!Number.isFinite(ct) || ct <= 0) {
        throw new Error('Masukkan nominal tunai yang valid')
      }
      if (allowPartialCash) {
        if (ct < total) {
          amountAppliedToBill = Math.max(0, ct)
          invoiceRemainingAmt = Math.max(0, total - amountAppliedToBill)
          tenderedRounded = ct
          changeRounded = 0
          paidInFull = invoiceRemainingAmt < 1
          const due30 = addDaysIso(nowIso.split('T')[0], 30)
          dueIsoForRemainder = due30.split('T')[0]
        } else {
          amountAppliedToBill = total
          invoiceRemainingAmt = 0
          tenderedRounded = ct
          changeRounded = Math.max(0, ct - total)
          paidInFull = true
        }
      } else {
        if (ct < total) {
          throw new Error('Uang tunai kurang dari total tagihan — aktifkan mode DP di pengaturan kasir atau isi lebih banyak.')
        }
        amountAppliedToBill = total
        invoiceRemainingAmt = 0
        tenderedRounded = ct
        changeRounded = Math.max(0, ct - total)
        paidInFull = true
      }
    } else if (isPayLater) {
      invoiceRemainingAmt = total
      paidInFull = false
      const duePl = addDaysIso(nowIso.split('T')[0], payLaterDays)
      dueIsoForRemainder = duePl.split('T')[0]
    } else {
      invoiceRemainingAmt = total
      paidInFull = false
    }

    const storedPaymentMethod =
      isCashMethod ? 'cash' : isPayLater ? 'pay_later' : pmNorm

    serialRefs.forEach((serialRef, idx) => {
      const lineFm = lineFulfillmentModes[idx] || fulfillmentMode
      const lineIsDelivery = lineFm === 'delivery'
      transaction.update(serialRef, {
        status: 'sold',
        lastMovementType: 'pos_sale',
        lastInvoiceId: invoiceRef.id,
        soldAt: nowIso,
        updatedAt: nowIso,
        salespersonUid: salespersonUid || '',
        salespersonName: salespersonName || '',
        ...(lineIsDelivery
          ? {
              deliveryEnabled: true,
              deliveryInvoiceId: invoiceRef.id,
              deliveryInvoiceNumber: number,
              deliveryCustomerName: customerName,
              deliveryCustomerPhone: customerPhone || '',
              deliveryCustomerAddress: customerAddress || '',
              deliveryPaymentMethod: storedPaymentMethod,
              deliveryPaymentRemaining: invoiceRemainingAmt,
              deliveryPaidInFull: invoiceRemainingAmt < 1 && !isPayLater,
              deliveryStatus: 'awaiting_dispatch',
              deliveryStatusLabel: 'Menunggu dispatch',
              deliveryUpdatedAt: nowIso,
              deliveryTimeline: [
                {
                  status: 'awaiting_dispatch',
                  label: 'Menunggu dispatch',
                  at: nowIso,
                  byUid: cashierUid || salespersonUid || '',
                },
              ],
            }
          : {
              deliveryEnabled: false,
            }),
      })
    })

    /** @type Map<string, number> key warehouseId:::stockDocId */
    const decrementMap = new Map()
    /** @type Map<string, { sourceWarehouseId: string, destinationWarehouseId: string, items: Array<{productId: string, productName: string, sku: string, serialNumber: string, qty: number}> }> */
    const doBySourceWarehouse = new Map()
    lines.forEach((line, idx) => {
      const pid = line.productId
      const sd = serialSnaps[idx].data()
      const wid = sd.warehouseId
      const docId =
        line.stockDocIdForDecrement ||
        (wid === warehouseId ? stockDocIdByProductId[pid] : null)
      if (!docId) {
        throw new Error(
          `Baris stok tidak ditemukan untuk produk di lokasi serial. Pastikan stok etalase ter-load di POS atau terima serial ke gudang yang dipilih.`
        )
      }
      const mapKey = `${wid}:::${docId}`
      decrementMap.set(mapKey, (decrementMap.get(mapKey) || 0) + 1)

      const lineFm = lineFulfillmentModes[idx] || fulfillmentMode
      const lineIsDelivery = lineFm === 'delivery'
      // Auto-DO only for "send to store" cases (sold in POS, sourced from other warehouse, not customer delivery line).
      if (!lineIsDelivery && String(wid || '') && String(wid) !== String(warehouseId)) {
        const p = productById[pid] || {}
        const serialNumber = normalizeSerialId(line.serialNumber)
        const srcKey = String(wid)
        const cur =
          doBySourceWarehouse.get(srcKey) || {
            sourceWarehouseId: srcKey,
            destinationWarehouseId: String(warehouseId),
            items: [],
          }
        cur.items.push({
          productId: String(pid || ''),
          productName: String(p.nama || p.name || pid || ''),
          sku: String(p.kode || p.sku || ''),
          serialNumber,
          qty: 1,
        })
        doBySourceWarehouse.set(srcKey, cur)
      }
    })

    const uniqueOps = Array.from(decrementMap.entries()).map(([key, qty]) => {
      const [wid, docId] = key.split(':::')
      const ref = doc(db, 'warehouses', wid, 'stock', docId)
      return { key, wid, docId, qty, ref }
    })

    const stockSnapsDedup = await Promise.all(uniqueOps.map((o) => transaction.get(o.ref)))
    uniqueOps.forEach((op, i) => {
      const stSnap = stockSnapsDedup[i]
      if (!stSnap.exists()) throw new Error('Baris stok gudang tidak ditemukan')
      const cur = Number(stSnap.data().quantity) || 0
      if (cur < op.qty) {
        throw new Error('Stok fisik tidak mencukupi di salah satu lokasi')
      }
    })

    uniqueOps.forEach((op, i) => {
      const stSnap = stockSnapsDedup[i]
      const cur = Number(stSnap.data().quantity) || 0
      transaction.update(op.ref, {
        quantity: cur - op.qty,
        updatedAt: serverTimestamp(),
      })
    })

    const invoicePayload = {
      number,
      sourceType: 'pos',
      warehouseId,
      salespersonUid: salespersonUid || '',
      salespersonName: salespersonName || '',
      customer: customerName,
      customerId,
      customerName,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      paymentMethod: storedPaymentMethod,
      posPayLater: isPayLater,
      posPiutangDueDays: isPayLater ? payLaterDays : null,
      isCashSale: isCash,
      partialPaymentReceivedRp: allowPartialCash && invoiceRemainingAmt > 0 ? amountAppliedToBill : null,
      posEligibleWarehouseIds: eligibleWarehouseIds,
      posFulfillmentMode: invoiceHeaderFulfillmentMode,
      posFulfillmentLabel: invoiceHeaderFulfillmentLabel,
      deliveryStatus: anyLineDelivery ? 'awaiting_dispatch' : '',
      deliveryStatusLabel: anyLineDelivery
        ? lineFulfillmentModes.every((m) => m === 'delivery')
          ? 'Menunggu dispatch'
          : 'Campuran pengantaran — lihat per baris'
        : '',
      transactionDate: nowIso.split('T')[0],
      dueDate: invoiceRemainingAmt > 0 ? dueIsoForRemainder : nowIso.split('T')[0],
      items: invoiceItems,
      subtotal: merchandiseSubtotal,
      posTaxableAmount: taxableBase,
      orderDiscountRp: orderDiscCapped,
      serviceChargeRp: svcRaw,
      vatRatePercent,
      ppnAmount,
      taxLabel,
      total,
      remaining: invoiceRemainingAmt,
      paidInFullPos: paidInFull,
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(accountId ? { accountId } : {}),
      ...(isCash
        ? {
            cashTendered: tenderedRounded,
            cashChange: changeRounded,
            cashierUid: cashierUid || '',
            cashAppliedToBillRp: amountAppliedToBill,
          }
        : {}),
    }

    transaction.set(invoiceRef, invoicePayload)

    transaction.set(txRef, {
      type: 'pos_sale',
      contactId: customerId,
      contactName: customerName,
      penanggungJawabId: salespersonUid || '',
      penanggungJawab: salespersonName || '',
      number,
      reference: '',
      date: nowIso.split('T')[0],
      dueDate:
        invoiceRemainingAmt > 0 ? dueIsoForRemainder : nowIso.split('T')[0],
      total,
      remaining: invoiceRemainingAmt,
      paid: paidInFull,
      posPayLater: isPayLater,
      paymentMethod: storedPaymentMethod,
      items: invoiceItems,
      source: { collection: 'invoices', id: invoiceRef.id },
      warehouseId,
      salespersonUid: salespersonUid || '',
      salespersonName: salespersonName || '',
      serialCount: lines.length,
      subtotal: merchandiseSubtotal,
      posTaxableAmount: taxableBase,
      orderDiscountRp: orderDiscCapped,
      serviceChargeRp: svcRaw,
      vatRatePercent,
      ppnAmount,
      taxLabel,
      posFulfillmentMode: invoiceHeaderFulfillmentMode,
      posFulfillmentLabel: invoiceHeaderFulfillmentLabel,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(isCash
        ? {
            cashTendered: tenderedRounded,
            cashChange: changeRounded,
            cashierUid: cashierUid || '',
            accountId: accountId || '',
            cashAppliedToBillRp: amountAppliedToBill,
          }
        : {}),
    })

    if (isCash && amountAppliedToBill > 0 && accountId) {
      transaction.set(ledgerRef, {
        source: 'pos_sale',
        warehouseId,
        invoiceId: invoiceRef.id,
        transactionId: txRef.id,
        invoiceNumber: number,
        terima: amountAppliedToBill,
        kirim: 0,
        cashTendered: tenderedRounded,
        cashChange: changeRounded,
        invoiceTotal: total,
        invoiceRemainingRp: invoiceRemainingAmt,
        description:
          (invoiceRemainingAmt > 0
            ? `POS ${number} (DP / sebagian — sisa lunas lebih lanjut)`
            : `Penjualan POS ${number}`) + fulfillSuffix,
        userUid: cashierUid || salespersonUid || '',
        accountId: accountId || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }

    // Create warehouse DO requests for items that must be sent from non-store warehouse to outlet.
    Array.from(doBySourceWarehouse.values()).forEach((row) => {
      if (!row.items.length) return
      const doRef = doc(collection(db, 'warehouseTransferOrders'))
      const grouped = new Map()
      row.items.forEach((it) => {
        const key = `${it.productId}:::${it.serialNumber}`
        const prev = grouped.get(key)
        if (prev) {
          prev.qty += 1
        } else {
          grouped.set(key, { ...it })
        }
      })
      const items = Array.from(grouped.values())
      transaction.set(doRef, {
        number: `DO-${Date.now().toString(36).toUpperCase()}`,
        status: 'pending',
        statusLabel: 'Menunggu proses gudang',
        sourceWarehouseId: row.sourceWarehouseId,
        destinationWarehouseId: row.destinationWarehouseId,
        sourceType: 'pos_sale',
        sourceRef: {
          collection: 'invoices',
          id: invoiceRef.id,
          number,
        },
        customerName: customerName || '',
        requestedByUid: cashierUid || salespersonUid || '',
        requestedByName: salespersonName || '',
        requestReason: 'POS sale item sourced from warehouse (outlet stock unavailable).',
        items,
        itemCount: items.length,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    })

    return {
      invoiceId: invoiceRef.id,
      transactionId: txRef.id,
      number,
      total,
      cashCollected: amountAppliedToBill,
      remaining: invoiceRemainingAmt,
      paidInFull,
    }
  }).then(async (result) => {
    const collected = result.cashCollected ?? result.total ?? 0
    const isCash =
      paymentMethod === 'cash' || paymentMethod === 'tunai'
    if (accountId && collected > 0 && isCash) {
      await updateAccountBalance(accountId, collected, {
        type: 'pos_sale',
        transactionId: result.transactionId,
        number: result.number,
        date: new Date().toISOString().split('T')[0],
        description:
          result.remaining > 1
            ? `POS ${result.number} (tunai sebagian)`
            : `POS ${result.number} (Tunai)`,
      })
    }
    return result
  })
}
