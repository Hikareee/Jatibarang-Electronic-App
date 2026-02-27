import { useState, useRef, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  Sparkles,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  X,
  ChevronLeft
} from 'lucide-react'
import { extractData, createDataFromExtracted } from '../utils/aiDataExtraction'
import { db } from '../firebase/config'
import { 
  useAIChatHistory, 
  createNewChat, 
  saveMessageToChat, 
  deleteChat,
  getChatMessages,
  updateChatTitle
} from '../hooks/useAIChatHistory'

// List of available models in order of preference (best to worst)
const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-3-12b',
  'gemma-3-27b',
  'gemma-3-4b',
  'gemma-3-2b',
  'gemma-3-1b',
  'gemini-2.5-flash-tts',
]

const INITIAL_MESSAGE = {
  id: 1,
  role: 'assistant',
  content: 'Halo! Saya adalah Asisten AI Anda. Saya dapat membantu Anda:\n\n' +
    '💰 **Membuat tagihan pembelian** - "Saya beli perlengkapan kantor 50000 hari ini"\n' +
    '📄 **Membuat tagihan penjualan** - "Buat tagihan penjualan 200000 untuk customer ABC"\n' +
    '💸 **Mencatat biaya** - "Tambah biaya: 75000 untuk makan siang"\n' +
    '👤 **Menambah kontak** - "Tambah kontak baru: John, email john@example.com"\n' +
    '📦 **Menambah produk** - "Tambah produk: Laptop, harga 10000000"\n' +
    '🏦 **Menambah akun** - "Buat akun baru: Bank BCA, kategori Kas"\n' +
    '💬 **Menjawab pertanyaan** tentang bisnis dan data Anda\n\n' +
    'Bagaimana saya bisa membantu Anda hari ini?',
  timestamp: new Date()
}

// Employees may only add penjualan/pembelian drafts; owner/manager approve or decline
const INITIAL_MESSAGE_EMPLOYEE = {
  id: 1,
  role: 'assistant',
  content: 'Halo! Saya adalah Asisten AI Anda. Sebagai karyawan, Anda dapat:\n\n' +
    '💰 **Membuat draft tagihan pembelian** - "Saya beli perlengkapan kantor 50000 hari ini"\n' +
    '📄 **Membuat draft tagihan penjualan** - "Buat tagihan penjualan 200000 untuk customer ABC"\n' +
    '💬 **Bertanya** tentang bisnis dan data\n\n' +
    'Draft yang Anda buat akan ditinjau oleh owner/manager untuk disetujui atau ditolak. Membuat akun, biaya, kontak, produk, hutang, atau piutang hanya dapat dilakukan oleh owner/manager.\n\n' +
    'Bagaimana saya bisa membantu Anda hari ini?',
  timestamp: new Date()
}

export default function AIAssistant() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true)
  const { t } = useLanguage()
  const { currentUser } = useAuth()
  const { role: userRole, canApprove } = useUserApproval()
  const { chats, loading: chatsLoading, refetch: refetchChats } = useAIChatHistory()
  const [currentChatId, setCurrentChatId] = useState(null)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const [currentModel, setCurrentModel] = useState(AVAILABLE_MODELS[0])
  const [editingChatTitle, setEditingChatTitle] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const [loadingChat, setLoadingChat] = useState(false)

  const getInitialMessage = () => (userRole === 'employee' ? INITIAL_MESSAGE_EMPLOYEE : INITIAL_MESSAGE)

  const parseAnalyticsIntent = (text) => {
    if (!text) return null
    const lower = text.toLowerCase()

    const isSpendingQuestion =
      (lower.includes('pengeluaran') || lower.includes('biaya') || lower.includes('spending')) &&
      (lower.includes('berapa') || lower.includes('berapa total') || lower.includes('total'))

    if (!isSpendingQuestion) return null

    let period = 'all_time'
    let periodLabel = 'semua waktu'

    if (lower.includes('tahun ini') || lower.includes('this year')) {
      period = 'this_year'
      periodLabel = 'tahun ini'
    } else if (lower.includes('bulan ini') || lower.includes('this month')) {
      period = 'this_month'
      periodLabel = 'bulan ini'
    }

    let itemKeyword = null
    const itemMatch =
      lower.match(/untuk\s+(.+?)\?*$/) ||
      lower.match(/atas\s+(.+?)\?*$/) ||
      lower.match(/pada\s+(.+?)\?*$/)

    if (itemMatch && itemMatch[1]) {
      itemKeyword = itemMatch[1].trim()
    }

    return {
      type: 'spending',
      period,
      periodLabel,
      itemKeyword,
    }
  }

  const fetchSpendingAnalytics = async (intent) => {
    const now = new Date()
    let startDate = null

    if (intent.period === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else if (intent.period === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const expensesSnapshot = await getDocs(collection(db, 'expenses'))

    let total = 0
    let count = 0

    const matches = []

    expensesSnapshot.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const dateString = data.date || data.createdAt
      if (!dateString) return

      const expenseDate = new Date(dateString)
      if (Number.isNaN(expenseDate.getTime())) return

      if (startDate && expenseDate < startDate) return
      if (expenseDate > now) return

      const expenseTotal = parseFloat(data.total) || 0

      if (intent.itemKeyword) {
        const keyword = intent.itemKeyword.toLowerCase()
        const items = Array.isArray(data.items) ? data.items : []
        const hasMatchingItem = items.some((item) => {
          const text =
            `${item.product || ''} ${item.description || ''}`.toLowerCase()
          return text.includes(keyword)
        })

        if (!hasMatchingItem) {
          return
        }
      }

      total += expenseTotal
      count += 1
      matches.push({
        id: docSnap.id,
        number: data.number || '',
        date: data.date || data.createdAt || '',
        total: expenseTotal,
        description: data.description || '',
      })
    })

    return {
      kind: 'spending',
      period: intent.period,
      periodLabel: intent.periodLabel,
      itemKeyword: intent.itemKeyword,
      currency: 'IDR',
      total,
      count,
      sample: matches.slice(0, 10),
    }
  }

  const loadChatMessages = async (chatId) => {
    if (!chatId) {
      setMessages([getInitialMessage()])
      return
    }
    setLoadingChat(true)
    try {
      const chatMessages = await getChatMessages(chatId)
      if (Array.isArray(chatMessages) && chatMessages.length > 0) {
        setMessages(chatMessages)
      } else {
        setMessages([getInitialMessage()])
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
      setMessages([getInitialMessage()])
    } finally {
      setLoadingChat(false)
    }
  }

  // Load chat messages when chat is selected
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId)
    } else {
      setMessages([getInitialMessage()])
    }
  }, [currentChatId, userRole])

  const handleNewChat = async () => {
    try {
      if (!currentUser) return
      
      const newChatId = await createNewChat(currentUser.uid)
      setCurrentChatId(newChatId)
      setMessages([getInitialMessage()])
      await refetchChats()
    } catch (error) {
      console.error('Error creating new chat:', error)
      setError('Gagal membuat percakapan baru')
    }
  }

  const handleSelectChat = async (chatId) => {
    setCurrentChatId(chatId)
  }

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation()
    if (window.confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) {
      try {
        await deleteChat(chatId)
        if (currentChatId === chatId) {
          setCurrentChatId(null)
          setMessages([getInitialMessage()])
        }
        await refetchChats()
      } catch (error) {
        console.error('Error deleting chat:', error)
        setError('Gagal menghapus percakapan')
      }
    }
  }

  const saveMessage = async (message) => {
    if (!currentChatId || !currentUser) return
    
    try {
      await saveMessageToChat(currentChatId, {
        ...message,
        timestamp: message.timestamp || new Date()
      })
    } catch (error) {
      console.error('Error saving message:', error)
    }
  }

  // Check if error is a quota/quota exceeded error
  const isQuotaError = (errorMessage) => {
    if (!errorMessage) return false
    const lowerMessage = errorMessage.toLowerCase()
    return (
      lowerMessage.includes('quota') ||
      lowerMessage.includes('quota exceeded') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('limit: 0')
    )
  }

  // Try calling API with a specific model
  const tryModel = async (modelName, apiKey, userMessage, userRoleForPrompt) => {
    const role = userRoleForPrompt || 'employee'
    const permissionRules = role === 'employee'
      ? `ATURAN PENTING: User saat ini adalah karyawan (employee). Karyawan TIDAK BISA: menyetujui tagihan pembelian/penjualan, menandai tagihan lunas, atau mengubah progress pembayaran. Hanya owner/manager/admin yang bisa. Juga, TIDAK ADA user yang boleh menjadikan dirinya sendiri (atau siapa pun) admin, owner, atau manager lewat asisten ini. Jika user meminta hal-hal ini, tolak dengan sopan dalam Bahasa Indonesia dan jelaskan bahwa itu di luar wewenang peran mereka.`
      : `User saat ini memiliki peran ${role} dan dapat menyetujui tagihan. Namun, tidak ada user yang boleh mengubah role sendiri menjadi admin/owner/manager lewat asisten ini. Jika user minta itu, tolak dengan sopan.`
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
              parts: [
                {
                  text: `Anda adalah asisten AI untuk aplikasi manajemen bisnis IBASA (seperti Kledo).
${permissionRules}

Anda membantu user memasukkan data dan menjawab pertanyaan. Jawablah dengan ringkas, membantu, dan profesional. SELALU gunakan Bahasa Indonesia.

Pertanyaan user: ${userMessage.content}`
                }
              ]
            }
          ]
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `API error: ${response.status}`
      
      if (isQuotaError(errorMessage)) {
        throw { type: 'quota', message: errorMessage, model: modelName }
      }
      
      throw { type: 'other', message: errorMessage, model: modelName }
    }

    return await response.json()
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    await saveMessage(userMessage)
    
    const userInput = input.trim()
    setInput('')
    setLoading(true)
    setError(null)

    // Create new chat if none exists
    if (!currentChatId && currentUser) {
      try {
        const newChatId = await createNewChat(currentUser.uid)
        setCurrentChatId(newChatId)
        await refetchChats()
      } catch (error) {
        console.error('Error creating chat:', error)
      }
    }

    try {
      // Get API key
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key')
      
      if (!apiKey) {
        throw new Error('Gemini API key tidak ditemukan. Silakan tambahkan API key Anda.')
      }

      // Hard block: never allow role-change or self-promotion via AI
      const lower = userInput.toLowerCase()
      const roleChangePhrases = ['jadikan saya admin', 'make me admin', 'buat saya admin', 'jadikan saya owner', 'make me owner', 'ubah role saya', 'change my role', 'jadikan aku admin', 'promote me to admin', 'set role saya ke admin', 'my role to admin']
      if (roleChangePhrases.some(phrase => lower.includes(phrase))) {
        const blockMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: '⚠️ Mengubah peran (role) Anda sendiri tidak dapat dilakukan melalui asisten ini. Hanya pengguna dengan wewenang (misalnya owner) yang dapat mengubah peran di halaman Users.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, blockMsg])
        await saveMessage(blockMsg)
        setLoading(false)
        return
      }

      const analyticsIntent = parseAnalyticsIntent(userInput)

      if (analyticsIntent) {
        try {
          const analyticsData = await fetchSpendingAnalytics(analyticsIntent)
          const modelName = AVAILABLE_MODELS[currentModelIndex] || AVAILABLE_MODELS[0]

          const enrichedMessage = {
            ...userMessage,
            content: `Berikut ringkasan data aktual dari Firebase Firestore (jangan mengarang angka baru, gunakan data ini sebagai sumber utama):\n\n` +
              `${JSON.stringify(analyticsData, null, 2)}\n\n` +
              `Jawablah pertanyaan user di bawah ini dengan menjelaskan angka-angka di atas dalam Bahasa Indonesia yang mudah dipahami.\n\n` +
              `Pertanyaan asli user: ${userMessage.content}`,
          }

          const data = await tryModel(modelName, apiKey, enrichedMessage, userRole)

          setCurrentModelIndex(currentModelIndex)
          setCurrentModel(modelName)

          const assistantMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak dapat menghasilkan respons.',
            timestamp: new Date()
          }

          setMessages(prev => [...prev, assistantMessage])
          await saveMessage(assistantMessage)
          setLoading(false)
          return
        } catch (analyticsError) {
          console.error('Error handling analytics question:', analyticsError)
        }
      }

      // Check if user wants to create data or request forbidden actions
      const dataCreationKeywords = [
        'pembelian', 'beli', 'tagihan pembelian', 'purchase', 'invoice', 'tagihan',
        'penjualan', 'jual', 'sales', 'customer', 'pelanggan',
        'biaya', 'expense', 'pengeluaran', 'spent', 'spend',
        'kontak', 'contact', 'pelanggan baru', 'vendor baru', 'customer baru',
        'produk', 'product', 'barang', 'item baru',
        'akun', 'account', 'rekening baru',
        'hutang', 'debt', 'piutang', 'receivable'
      ]
      const forbiddenKeywords = [
        'setuju', 'approve', 'tolak', 'decline', 'lunas', 'paid', 'dibayar', 'mark as paid',
        'progress bayar', 'payment progress', 'ubah role', 'change role', 'jadikan admin',
        'make me admin', 'jadikan owner', 'make admin', 'buat saya admin', 'role saya',
        'tandai lunas', 'approve invoice', 'setujui tagihan', 'setujui pesanan'
      ]
      
      const mightBeDataCreation = dataCreationKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword)
      )
      const mightBeForbidden = forbiddenKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword)
      )

      // Run extraction for creation or forbidden intents
      if (mightBeDataCreation || mightBeForbidden) {
        try {
          const modelName = AVAILABLE_MODELS[currentModelIndex] || AVAILABLE_MODELS[0]
          const extractedData = await extractData(userInput, apiKey, modelName, userRole)
          
          // Refuse forbidden actions (approve, mark paid, change role, make admin)
          if (extractedData.intent === 'forbidden') {
            const refusalMsg = extractedData.description || 
              'Permintaan ini tidak dapat diproses. Karyawan tidak dapat menyetujui tagihan, menandai lunas, atau mengubah progress pembayaran. Mengubah peran (role) juga tidak dapat dilakukan lewat asisten ini.'
            const assistantMessage = {
              id: Date.now() + 1,
              role: 'assistant',
              content: `⚠️ ${refusalMsg}`,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])
            await saveMessage(assistantMessage)
            setLoading(false)
            return
          }

          // Employees may only create penjualan/pembelian drafts; block account, expense, contact, product, debt, receivable
          const EMPLOYEE_FORBIDDEN_INTENTS = ['create_account', 'create_expense', 'create_contact', 'create_product', 'create_debt', 'create_receivable']
          if (userRole === 'employee' && EMPLOYEE_FORBIDDEN_INTENTS.includes(extractedData.intent)) {
            const assistantMessage = {
              id: Date.now() + 1,
              role: 'assistant',
              content: '⚠️ Untuk peran karyawan, Anda hanya dapat membuat draft tagihan penjualan dan tagihan pembelian. Membuat akun, biaya, kontak, produk, hutang, atau piutang hanya tersedia untuk owner/manager. Draft yang Anda buat akan ditinjau oleh mereka.',
              timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])
            await saveMessage(assistantMessage)
            setLoading(false)
            return
          }
          
          // If intent is to create data, create it
          if (extractedData.intent && extractedData.intent !== 'other') {
            const result = await createDataFromExtracted(extractedData)
            
            // Generate success message based on type
            let successMessage = ''
            const typeNames = {
              'purchase_invoice': 'Tagihan Pembelian',
              'sales_invoice': 'Tagihan Penjualan',
              'expense': 'Biaya',
              'contact': 'Kontak',
              'product': 'Produk',
              'account': 'Akun',
              'debt': 'Hutang',
              'receivable': 'Piutang'
            }
            
            const typeName = typeNames[result.type] || 'Data'
            
            successMessage = `✅ ${typeName} berhasil dibuat!\n\n`
            
            if (result.data.total) {
              successMessage += `💰 Jumlah: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(result.data.total)}\n`
            }
            if (result.data.transactionDate || result.data.date) {
              successMessage += `📅 Tanggal: ${result.data.transactionDate || result.data.date}\n`
            }
            if (result.data.vendor || result.data.customer || result.data.contact || result.data.name) {
              successMessage += `👤 ${result.data.vendor ? 'Vendor' : result.data.customer ? 'Customer' : result.data.contact ? 'Kontak' : 'Nama'}: ${result.data.vendor || result.data.customer || result.data.contact || result.data.name}\n`
            }
            if (result.data.account) {
              successMessage += `🏦 Akun: ${result.data.account}\n`
            }
            if (result.data.reference) {
              successMessage += `📄 Referensi: ${result.data.reference}\n`
            }
            if (result.data.description) {
              successMessage += `📝 Deskripsi: ${result.data.description}\n`
            }
            
            successMessage += `\n${typeName} telah disimpan ke database Anda.`
            
            const assistantMessage = {
              id: Date.now() + 1,
              role: 'assistant',
              content: successMessage,
              timestamp: new Date()
            }
            
            setMessages(prev => [...prev, assistantMessage])
            await saveMessage(assistantMessage)
            setLoading(false)
            return
          }
        } catch (extractError) {
          console.error('Error extracting/creating data:', extractError)
          // Fall through to normal chat
        }
      }

      // Normal chat flow
      let lastError = null
      let triedModels = []
      
      for (let i = currentModelIndex; i < AVAILABLE_MODELS.length; i++) {
        const modelName = AVAILABLE_MODELS[i]
        triedModels.push(modelName)
        
        try {
          const data = await tryModel(modelName, apiKey, userMessage, userRole)
          
          setCurrentModelIndex(i)
          setCurrentModel(modelName)
          
          const assistantMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak dapat menghasilkan respons.',
            timestamp: new Date()
          }

          setMessages(prev => [...prev, assistantMessage])
          await saveMessage(assistantMessage)
          return
        } catch (err) {
          lastError = err
          
          if (err.type === 'quota') {
            continue
          }
          break
        }
      }

      // Handle errors
      if (lastError?.type === 'quota') {
        setCurrentModelIndex(0)
        setCurrentModel(AVAILABLE_MODELS[0])
        
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Semua model yang tersedia telah mencapai batas kuota. Silakan tunggu sebentar dan coba lagi. Model yang dicoba: ${triedModels.join(', ')}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        await saveMessage(errorMessage)
        setError('Semua model telah mencapai batas kuota.')
      } else {
        setError(lastError?.message || 'Terjadi kesalahan')
        const errorMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Maaf, terjadi kesalahan: ${lastError?.message || 'Kesalahan tidak diketahui'}. Silakan coba lagi.`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        await saveMessage(errorMessage)
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Maaf, terjadi kesalahan: ${err.message}. Silakan periksa konfigurasi API key Anda.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      await saveMessage(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date) => {
    try {
      const d = date == null ? new Date() : (typeof date?.toDate === 'function' ? date.toDate() : new Date(date))
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(d)
    } catch {
      return ''
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Chat History Sidebar */}
          <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
            chatSidebarOpen ? 'w-64' : 'w-0'
          } overflow-hidden flex flex-col`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Percakapan</h2>
                <button
                  onClick={() => setChatSidebarOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Percakapan Baru</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {chatsLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                </div>
              ) : chats.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Belum ada percakapan
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                        currentChatId === chat.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {chat.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(chat.updatedAt).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Show button to open chat sidebar if closed */}
          {!chatSidebarOpen && (
            <button
              onClick={() => setChatSidebarOpen(true)}
              className="absolute left-4 top-20 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {/* Main Chat Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Page Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      AI Assistant
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Powered by Google Gemini 
                    </p>
                  </div>
                </div>
                {!chatSidebarOpen && (
                  <button
                    onClick={() => setChatSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* API Key Notice */}
            {(!import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('gemini_api_key')) && (
              <div className="mx-6 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    API Key Diperlukan
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Untuk menggunakan AI Assistant, silakan tambahkan Gemini API key Anda. Dapatkan dari{' '}
                    <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-900 dark:hover:text-yellow-200"
                    >
                      Google AI Studio
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {loadingChat ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Memuat percakapan...</span>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const msg = message && typeof message === 'object' ? message : {}
                    const id = msg.id ?? index
                    const role = msg.role === 'user' ? 'user' : 'assistant'
                    const content = typeof msg.content === 'string' ? msg.content : String(msg?.content ?? '')
                    return (
                      <div
                        key={id}
                        className={`flex gap-3 ${
                          role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {role === 'assistant' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-3 ${
                            role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {content}
                          </p>
                          <p
                            className={`text-xs mt-2 ${
                              role === 'user'
                                ? 'text-blue-100'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>

                        {role === 'user' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {!loadingChat && loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ketik pesan Anda di sini... (Tekan Enter untuk mengirim, Shift+Enter untuk baris baru)"
                      rows={1}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none overflow-hidden"
                      style={{
                        minHeight: '48px',
                        maxHeight: '120px',
                      }}
                      onInput={(e) => {
                        e.target.style.height = 'auto'
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </main>
        </div>
        
        <Footer />
      </div>
    </div>
  )
}
