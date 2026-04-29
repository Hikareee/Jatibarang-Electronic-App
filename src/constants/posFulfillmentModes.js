/** Opsi layanan POS untuk jenis pengambilan / packing / antar / booking. */
export const POS_FULFILLMENT_OPTIONS = Object.freeze([
  {
    id: 'pickup_store',
    label: 'Ambil di Toko',
    hint: 'Pelanggan membawa barang di tempat',
  },
  {
    id: 'wrap',
    label: 'Bungkus',
    hint: 'Siapkan pembungkus untuk titip / bawa',
  },
  {
    id: 'delivery',
    label: 'Antar',
    hint: 'Siapkan untuk antar / kurir (pastikan alamat tercatat jika perlu)',
  },
  {
    id: 'booking',
    label: 'Booking',
    hint: 'Ambil di lain waktu — stok sudah terpakai di penjualan ini',
  },
])

/** @param {string | undefined} id */
export function labelForPosFulfillmentId(id) {
  const s = String(id || '').trim()
  if (!s) return POS_FULFILLMENT_OPTIONS[0].label
  return POS_FULFILLMENT_OPTIONS.find((o) => o.id === s)?.label ?? s
}
