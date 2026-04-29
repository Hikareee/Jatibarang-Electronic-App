/** Default struktur penyimpanan dokumen Firestore `posWarehouseSettings/{warehouseId}` */

export function defaultPosWarehouseSettings() {
  return {
    /** Wajib isi nominal kas pembuka ketika membuka shift (modal tidak boleh kosong). */
    bukaKasirModal: false,
    /** Minta nominal saat tutup shift (belum diimplementasi di POS — tetap menyimpan preferensi). */
    tutupKasirModal: false,
    /** Jika aktif, kas keluar (manual di Transaksi) tidak boleh lebih dari kasKeluarMaxRp. */
    kasKeluarBatas: false,
    kasKeluarMaxRp: 5_000_000,
    serviceChargeEnabled: false,
    /** Dipakai menghitung nominal service charge atas subtotal − diskon. */
    serviceChargePercent: 5,
    tambahanDiskonEnabled: false,
    hargaProdukManualEnabled: false,
    /** Refund besar perlu PIN manajemen (cek di masa depan). */
    approvalAuthorizationEnabled: false,
    /** Ditulis ke invoice/struk sebagai preferensi cetak detail harga per baris. */
    tampilkanHargaProdukStruk: true,
    receiptPrintPreviewMode: false,
    /** 'ppn' | 'pph' */
    selectedTax: 'ppn',
    /** Persen pajak atas dasar pengenaan (nilai bisa diubah lewat pajak atau default). */
    ppnPercent: 11,
    pphPercent: 10,
    /**
     * Izinkan pembayaran tunai lebih kecil dari total (DP — sisa jatuh tempo di Tagihan).
     */
    allowPartialCashPayment: false,
    /**
     * Gudang/lokasi kedua (mis. etalase toko); stok bisa dijual jika ada di salah satu lokasi ini.
     * Serial harus cocok lokasi penyimpanan fisiknya.
     */
    secondaryWarehouseIdForPos: '',
    updatedAt: null,
    updatedByUid: '',
  }
}
