import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export function useLanguage() {
  return useContext(LanguageContext)
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language')
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const translations = {
    en: {
      sell: 'Sell',
      buy: 'Buy',
      fees: 'Fees',
      home: 'Home',
      sales: 'Sales',
      purchases: 'Purchases',
      expenses: 'Expenses',
      products: 'Products',
      inventory: 'Inventory',
      reports: 'Reports',
      cashBank: 'Cash & Bank',
      accounts: 'Accounts',
      fixedAssets: 'Fixed Assets',
      contacts: 'Contacts',
      payroll: 'Payroll',
      overview: 'Overview',
      invoices: 'Invoices',
      shipments: 'Shipments',
      orders: 'Orders',
      offers: 'Offers',
      addInvoice: 'Add Invoice',
      customer: 'Customer',
      number: 'Number',
      transactionDate: 'Transaction Date',
      dueDate: 'Due Date',
      term: 'Term',
      warehouse: 'Warehouse',
      reference: 'Reference',
      tag: 'Tag',
      showSalesPerson: 'Show Sales Person',
      showShippingInfo: 'Show Shipping Information',
      scanBarcode: 'Scan Barcode/SKU',
      priceIncludesTax: 'Price includes tax',
      product: 'Product',
      description: 'Description',
      quantity: 'Quantity',
      unit: 'Unit',
      discount: 'Discount',
      price: 'Price',
      tax: 'Tax',
      amount: 'Amount',
      addRow: 'Add Row',
      message: 'Message',
      attachment: 'Attachment',
      paymentConnect: 'Payment Connect',
      subTotal: 'Sub Total',
      additionalDiscount: 'Additional Discount',
      shippingCost: 'Shipping Cost',
      transactionFee: 'Transaction Fee',
      total: 'Total',
      deduction: 'Deduction',
      downPayment: 'Down Payment',
      remainingBill: 'Remaining Bill',
      save: 'Save',
      back: 'Back',
      guide: 'Guide',
      selectContact: 'Select contact',
      selectProduct: 'Select Product',
      selectTag: 'Select Tag',
    },
    id: {
      sell: 'Jual',
      buy: 'Beli',
      fees: 'Biaya',
      home: 'Beranda',
      sales: 'Penjualan',
      purchases: 'Pembelian',
      expenses: 'Biaya',
      products: 'Produk',
      inventory: 'Inventori',
      reports: 'Laporan',
      cashBank: 'Kas & Bank',
      accounts: 'Akun',
      fixedAssets: 'Aset Tetap',
      contacts: 'Kontak',
      payroll: 'Payroll',
      overview: 'Overview',
      invoices: 'Tagihan',
      shipments: 'Pengiriman',
      orders: 'Pemesanan',
      offers: 'Penawaran',
      addInvoice: 'Tambah Tagihan',
      customer: 'Pelanggan',
      number: 'Nomor',
      transactionDate: 'Tgl. Transaksi',
      dueDate: 'Tgl. Jatuh Tempo',
      term: 'Termin',
      warehouse: 'Gudang',
      reference: 'Referensi',
      tag: 'Tag',
      showSalesPerson: 'Tampilkan Sales Person',
      showShippingInfo: 'Tampilkan Informasi Pengiriman',
      scanBarcode: 'Scan Barcode/SKU',
      priceIncludesTax: 'Harga termasuk pajak',
      product: 'Produk',
      description: 'Deskripsi',
      quantity: 'Kuantitas',
      unit: 'Satuan',
      discount: 'Discount',
      price: 'Harga',
      tax: 'Pajak',
      amount: 'Jumlah',
      addRow: 'Tambah baris',
      message: 'Pesan',
      attachment: 'Attachment',
      paymentConnect: 'Payment Connect',
      subTotal: 'Sub Total',
      additionalDiscount: 'Tambahan Diskon',
      shippingCost: 'Biaya pengiriman',
      transactionFee: 'Biaya Transaksi',
      total: 'Total',
      deduction: 'Pemotongan',
      downPayment: 'Uang muka',
      remainingBill: 'Sisa Tagihan',
      save: 'Simpan',
      back: 'Kembali',
      guide: 'Panduan',
      selectContact: 'Pilih kontak',
      selectProduct: 'Pilih Produk',
      selectTag: 'Pilih Tag',
    }
  }

  const t = (key) => {
    return translations[language][key] || key
  }

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'id' : 'en')
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

