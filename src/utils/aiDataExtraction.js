import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { savePurchaseInvoice } from '../hooks/usePurchaseInvoiceData'
import { saveInvoice } from '../hooks/useInvoiceData'
import { saveExpense } from '../hooks/useExpensesData'
import { saveContact } from '../hooks/useContactsData'
import { saveProduct } from '../hooks/useProductsData'
import { saveAccount } from '../hooks/useAccountsData'
import { saveDebt } from '../hooks/useDebtData'
import { saveReceivable } from '../hooks/useReceivableData'

// Fetch all contacts for matching
export async function fetchContacts() {
  try {
    const contactsRef = collection(db, 'contacts')
    const q = query(contactsRef, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      company: doc.data().company || '',
    }))
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return []
  }
}

// Fetch all accounts for matching
export async function fetchAccounts() {
  try {
    const accountsRef = collection(db, 'accounts')
    const q = query(accountsRef, orderBy('code', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      code: doc.data().code || '',
    }))
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return []
  }
}

// Match contact name to ID (fuzzy matching)
export function matchContact(contactName, contacts) {
  if (!contactName) return null
  
  const normalizedName = contactName.toLowerCase().trim()
  
  // Exact match
  let match = contacts.find(c => 
    c.name?.toLowerCase() === normalizedName || 
    c.company?.toLowerCase() === normalizedName
  )
  
  if (match) return match.id
  
  // Partial match
  match = contacts.find(c => 
    c.name?.toLowerCase().includes(normalizedName) || 
    normalizedName.includes(c.name?.toLowerCase()) ||
    c.company?.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(c.company?.toLowerCase())
  )
  
  if (match) return match.id
  
  return null
}

// Match account name to ID (fuzzy matching)
export function matchAccount(accountName, accounts) {
  if (!accountName) return null
  
  const normalizedName = accountName.toLowerCase().trim()
  
  // Exact match
  let match = accounts.find(a => 
    a.name?.toLowerCase() === normalizedName
  )
  
  if (match) return match.id
  
  // Partial match
  match = accounts.find(a => 
    a.name?.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(a.name?.toLowerCase())
  )
  
  if (match) return match.id
  
  return null
}

// Extract data from natural language (and optional receipt image) using Gemini
export async function extractData(
  userMessage,
  apiKey,
  modelName,
  userRole = 'employee',
  imageBase64 = null,
  imageMimeType = null
) {
  try {
    // Fetch contacts and accounts for context
    const [contacts, accounts] = await Promise.all([
      fetchContacts(),
      fetchAccounts()
    ])
    
    const contactsList = contacts.map(c => c.name || c.company).filter(Boolean).join(', ')
    const accountsList = accounts.map(a => a.name).filter(Boolean).join(', ')
    
    const prompt = `Anda adalah asisten AI yang mengekstrak data terstruktur dari bahasa natural untuk aplikasi manajemen bisnis.

Peran user saat ini: ${userRole}.

User ingin membuat atau menambahkan data. Ekstrak informasi berikut dari pesan mereka:

Kontak Tersedia: ${contactsList || 'Tidak ada'}
Akun Tersedia: ${accountsList || 'Tidak ada'}

Pesan user: "${userMessage}"

Ekstrak dan kembalikan HANYA objek JSON yang valid dengan struktur ini (gunakan null untuk field yang tidak ada):
{
  "intent": "create_purchase_invoice" | "create_sales_invoice" | "create_expense" | "create_contact" | "create_product" | "create_account" | "create_debt" | "create_receivable" | "forbidden" | "other",
  "transactionDate": "YYYY-MM-DD" atau null,
  "dueDate": "YYYY-MM-DD" atau null,
  "vendor": "nama kontak" atau null,
  "customer": "nama kontak" atau null,
  "contact": "nama kontak" atau null,
  "penanggungJawab": "nama kontak" atau null,
  "account": "nama akun" atau null,
  "total": number atau null,
  "reference": "string" atau null,
  "description": "string" atau null,
  "name": "string" atau null,
  "company": "string" atau null,
  "phone": "string" atau null,
  "email": "string" atau null,
  "productName": "string" atau null,
  "productCode": "string" atau null,
  "category": "string" atau null,
  "items": [{"product": "string", "description": "string", "quantity": number, "price": number, "unit": "string"}] atau null
}

Aturan untuk menentukan intent:
- "create_purchase_invoice": kata kunci: pembelian, beli, tagihan pembelian, purchase invoice, vendor, supplier
- "create_sales_invoice": kata kunci: penjualan, jual, tagihan, invoice, customer, pelanggan
- "create_expense": kata kunci: biaya, expense, pengeluaran, spent, spend
- "create_contact": kata kunci: kontak, contact, pelanggan baru, vendor baru, customer baru
- "create_product": kata kunci: produk, product, barang, item baru
- "create_account": kata kunci: akun, account, rekening baru
- "create_debt": kata kunci: hutang, debt, kita hutang
- "create_receivable": kata kunci: piutang, receivable, mereka hutang
- "forbidden": GUNAKAN ini jika user meminta: (1) menyetujui tagihan / approve invoice / setuju pesanan, (2) menandai lunas / mark as paid / tandai sudah dibayar, (3) mengubah progress pembayaran / update payment, (4) mengubah role seseorang / make admin / jadikan admin / jadikan saya owner atau manager. Untuk intent "forbidden", isi "description" dengan alasan penolakan singkat dalam Bahasa Indonesia.

Ekstrak semua field yang relevan berdasarkan intent. Kembalikan HANYA objek JSON, tidak ada teks lain.`

    const parts = [
      {
        text:
          prompt +
          '\n\nIMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, just the JSON object.',
      },
    ]

    if (imageBase64) {
      const cleaned = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
      parts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/png',
          data: cleaned,
        },
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    // Clean the response
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    let extractedData
    try {
      extractedData = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Failed to parse JSON:', cleanedText)
      throw new Error('Gagal memparse respons AI')
    }

    // Match contact names to IDs
    if (extractedData.vendor) {
      extractedData.vendorId = matchContact(extractedData.vendor, contacts)
    }
    if (extractedData.customer) {
      extractedData.customerId = matchContact(extractedData.customer, contacts)
    }
    if (extractedData.contact) {
      extractedData.contactId = matchContact(extractedData.contact, contacts)
    }
    if (extractedData.penanggungJawab) {
      extractedData.penanggungJawabId = matchContact(extractedData.penanggungJawab, contacts)
    }

    // Match account name to ID
    if (extractedData.account) {
      extractedData.accountId = matchAccount(extractedData.account, accounts)
    }

    return extractedData
  } catch (error) {
    console.error('Error extracting data:', error)
    throw error
  }
}

// Create data based on extracted intent
export async function createDataFromExtracted(extractedData) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    switch (extractedData.intent) {
      case 'create_purchase_invoice': {
        const invoiceData = {
          transactionDate: extractedData.transactionDate || today,
          dueDate: extractedData.dueDate || null,
          vendor: extractedData.vendor || '',
          vendorId: extractedData.vendorId || '',
          penanggungJawab: extractedData.penanggungJawab || '',
          penanggungJawabId: extractedData.penanggungJawabId || '',
          account: extractedData.account || '',
          accountId: extractedData.accountId || '',
          total: parseFloat(extractedData.total) || 0,
          subTotal: parseFloat(extractedData.total) || 0,
          reference: extractedData.reference || '',
          description: extractedData.description || '',
          items: extractedData.items || (extractedData.total ? [{
            product: extractedData.description || 'Item',
            description: extractedData.description || '',
            quantity: 1,
            unit: '',
            price: parseFloat(extractedData.total) || 0,
            discount: 0,
            tax: 0,
            amount: parseFloat(extractedData.total) || 0
          }] : []),
          remaining: parseFloat(extractedData.total) || 0,
          paid: false,
          status: 'draft',
        }
        
        if (!invoiceData.total || invoiceData.total <= 0) {
          throw new Error('Total jumlah wajib diisi dan harus lebih dari 0')
        }
        
        if (invoiceData.items && invoiceData.items.length > 0) {
          invoiceData.subTotal = invoiceData.items.reduce((sum, item) => {
            const quantity = parseFloat(item.quantity) || 0
            const price = parseFloat(item.price) || 0
            const discount = parseFloat(item.discount) || 0
            const tax = parseFloat(item.tax) || 0
            const amount = (quantity * price) * (1 - discount / 100) * (1 + tax / 100)
            return sum + amount
          }, 0)
          invoiceData.total = invoiceData.subTotal
          invoiceData.remaining = invoiceData.total
        }
        
        const invoiceId = await savePurchaseInvoice(invoiceData)
        return { success: true, id: invoiceId, type: 'purchase_invoice', data: invoiceData }
      }
      
      case 'create_sales_invoice': {
        const invoiceData = {
          transactionDate: extractedData.transactionDate || today,
          dueDate: extractedData.dueDate || null,
          customer: extractedData.customer || '',
          customerId: extractedData.customerId || '',
          account: extractedData.account || '',
          accountId: extractedData.accountId || '',
          total: parseFloat(extractedData.total) || 0,
          subTotal: parseFloat(extractedData.total) || 0,
          reference: extractedData.reference || '',
          items: extractedData.items || (extractedData.total ? [{
            product: extractedData.description || 'Item',
            description: extractedData.description || '',
            quantity: 1,
            unit: '',
            price: parseFloat(extractedData.total) || 0,
            discount: 0,
            tax: 0,
            amount: parseFloat(extractedData.total) || 0
          }] : []),
          remaining: parseFloat(extractedData.total) || 0,
          paid: false,
        }
        
        if (!invoiceData.total || invoiceData.total <= 0) {
          throw new Error('Total jumlah wajib diisi dan harus lebih dari 0')
        }
        
        const invoiceId = await saveInvoice(invoiceData)
        return { success: true, id: invoiceId, type: 'sales_invoice', data: invoiceData }
      }
      
      case 'create_expense': {
        const expenseData = {
          date: extractedData.transactionDate || today,
          recipient: extractedData.contact || extractedData.vendor || '',
          recipientId: extractedData.contactId || extractedData.vendorId || '',
          accountablePerson: extractedData.penanggungJawab || '',
          accountableContactId: extractedData.penanggungJawabId || '',
          account: extractedData.account || '',
          accountId: extractedData.accountId || '',
          total: parseFloat(extractedData.total) || 0,
          reference: extractedData.reference || '',
          description: extractedData.description || '',
          items: extractedData.items || [],
          remaining: parseFloat(extractedData.total) || 0,
          paid: false,
        }
        
        if (!expenseData.total || expenseData.total <= 0) {
          throw new Error('Total jumlah wajib diisi dan harus lebih dari 0')
        }
        
        const expenseId = await saveExpense(expenseData)
        return { success: true, id: expenseId, type: 'expense', data: expenseData }
      }
      
      case 'create_contact': {
        const contactData = {
          name: extractedData.name || '',
          company: extractedData.company || '',
          phone: extractedData.phone || '',
          email: extractedData.email || '',
          types: extractedData.types || [],
        }
        
        if (!contactData.name) {
          throw new Error('Nama kontak wajib diisi')
        }
        
        const contactId = await saveContact(contactData)
        return { success: true, id: contactId, type: 'contact', data: contactData }
      }
      
      case 'create_product': {
        const productData = {
          nama: extractedData.productName || extractedData.name || '',
          kode: extractedData.productCode || '',
          kategori: extractedData.category || '',
          harga: parseFloat(extractedData.total) || 0,
        }
        
        if (!productData.nama) {
          throw new Error('Nama produk wajib diisi')
        }
        
        const productId = await saveProduct(productData)
        return { success: true, id: productId, type: 'product', data: productData }
      }
      
      case 'create_account': {
        const accountData = {
          name: extractedData.name || '',
          category: extractedData.category || '',
          saldo: parseFloat(extractedData.total) || 0,
        }
        
        if (!accountData.name || !accountData.category) {
          throw new Error('Nama dan kategori akun wajib diisi')
        }
        
        const accountCode = await saveAccount(accountData)
        return { success: true, id: accountCode, type: 'account', data: accountData }
      }
      
      case 'create_debt': {
        const debtData = {
          contactId: extractedData.contactId || '',
          contact: extractedData.contact || '',
          total: parseFloat(extractedData.total) || 0,
          date: extractedData.transactionDate || today,
          reference: extractedData.reference || '',
          description: extractedData.description || '',
        }
        
        if (!debtData.total || debtData.total <= 0) {
          throw new Error('Total jumlah wajib diisi dan harus lebih dari 0')
        }
        
        const debtId = await saveDebt(debtData)
        return { success: true, id: debtId, type: 'debt', data: debtData }
      }
      
      case 'create_receivable': {
        const receivableData = {
          contactId: extractedData.contactId || '',
          contact: extractedData.contact || '',
          total: parseFloat(extractedData.total) || 0,
          date: extractedData.transactionDate || today,
          reference: extractedData.reference || '',
          description: extractedData.description || '',
        }
        
        if (!receivableData.total || receivableData.total <= 0) {
          throw new Error('Total jumlah wajib diisi dan harus lebih dari 0')
        }
        
        const receivableId = await saveReceivable(receivableData)
        return { success: true, id: receivableId, type: 'receivable', data: receivableData }
      }
      
      default:
        throw new Error('Intent tidak dikenali')
    }
  } catch (error) {
    console.error('Error creating data:', error)
    throw error
  }
}
