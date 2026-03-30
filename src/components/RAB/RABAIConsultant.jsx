import { useState, useEffect, useRef } from 'react'
import { useAIChatHistory, createNewChat, saveMessageToChat, getChatMessages } from '../../hooks/useAIChatHistory'
import { supabase } from '../../firebase/supabaseClient'
import { Bot, User, Send, Loader2, Plus, Trash2 } from 'lucide-react'

export default function RABAIConsultant() {
  const { chats, loading } = useAIChatHistory()
  const [activeChatId, setActiveChatId] = useState(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)
  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const AVAILABLE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-3-12b',
    'gemma-3-27b',
    'gemma-3-4b',
    'gemma-3-2b',
    'gemma-3-1b',
  ]

  function isQuotaError(errorMessage) {
    if (!errorMessage) return false
    const lower = errorMessage.toLowerCase()
    return lower.includes('quota') || lower.includes('quota exceeded') || lower.includes('rate limit') || lower.includes('limit: 0')
  }

  async function tryModel(modelName, apiKey, userMessage) {
    const permission = `Anda adalah asisten AI untuk aplikasi manajemen bisnis IBASA (RAB assistant). Jawablah dalam Bahasa Indonesia, singkat dan membantu.`
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [ { parts: [ { text: `${permission}\n\nPertanyaan: ${userMessage.content}` } ] } ]
        })
      }
    )
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      const msg = errJson.error?.message || `API error: ${res.status}`
      if (isQuotaError(msg)) throw { type: 'quota', message: msg, model: modelName }
      throw { type: 'other', message: msg, model: modelName }
    }
    return await res.json()
  }

  useEffect(() => {
    // load messages when activeChatId changes
    const load = async () => {
      if (!activeChatId) return
      const msgs = await getChatMessages(activeChatId)
      setMessages(msgs || [])
      // scroll to bottom after set
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    load()
  }, [activeChatId])

  const startChat = async () => {
    const id = await createNewChat('anonymous')
    setActiveChatId(id)
    setMessages([])
  }

  const sendMessage = async () => {
    if (!activeChatId || !input.trim()) return
    setSending(true)
    const userMsg = { id: Date.now(), role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    try {
      await saveMessageToChat(activeChatId, userMsg)
      // Fetch catalog (materials, labor, alat) and include in the prompt so model can calculate using current data
      const fetchCatalogForPrompt = async () => {
        try {
          const [{ data: materials = [] } = {}, { data: labor = [] } = {}, { data: workItems = [] } = {}] = await Promise.all([
            supabase.from('materials').select('id,name,unit,price').order('name', { ascending: true }),
            supabase.from('labor').select('id,name,unit,price').order('name', { ascending: true }),
            // In your current schema, "alat/peralatan" lives inside `work_items` with unit + price filled.
            supabase.from('work_items').select('id,name,unit,price').order('name', { ascending: true }),
          ])

          const alat = (workItems || []).filter((wi) => {
            const unit = String(wi?.unit ?? '').trim()
            const priceNum = wi?.price === null || wi?.price === undefined ? 0 : Number(wi?.price)
            const hasUnit = unit.length > 0 && unit.toLowerCase() !== 'null'
            const hasPrice = !Number.isNaN(priceNum) && priceNum > 0
            return hasUnit && hasPrice
          }).map((wi) => ({
            id: wi.id,
            name: wi.name,
            unit: String(wi.unit ?? ''),
            price: Number(wi.price ?? 0) || 0,
          }))

          return { materials: materials || [], labor: labor || [], alat }
        } catch (err) {
          console.warn('Failed fetch catalog for prompt', err)
          return { materials: [], labor: [], alat: [] }
        }
      }

      const catalog = await fetchCatalogForPrompt()

      // Build a compact summary string (limit to first 80 items each to avoid huge prompts)
      const summarize = (arr, label) => {
        const preview = (arr || []).slice(0, 80).map((r) => ({ name: r.name, unit: r.unit || '', price: Number(r.price) || 0 }))
        return `${label} (count=${(arr || []).length}): ${JSON.stringify(preview)}`
      }

      const catalogSummary = `CATALOG SUMMARY:\n${summarize(catalog.materials, 'MATERIALS')}\n${summarize(catalog.labor, 'LABOR')}\n${summarize(catalog.alat, 'ALAT')}`

      // Call Gemini models sequentially
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key')
      if (!apiKey) {
        console.warn('No Gemini API key configured for RABAIConsultant')
      } else {
        let lastError = null
        const tried = []
        for (let i = currentModelIndex; i < AVAILABLE_MODELS.length; i++) {
          const modelName = AVAILABLE_MODELS[i]
          tried.push(modelName)
          try {
            // enrich user message with catalog summary so the model computes with current catalog
            const enriched = { ...userMsg, content: `${catalogSummary}\n\nPertanyaan: ${userMsg.content}` }
            const data = await tryModel(modelName, apiKey, enriched)
            setCurrentModelIndex(i)
            const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak dapat menghasilkan respons.'
            const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: assistantText, timestamp: new Date().toISOString() }
            await saveMessageToChat(activeChatId, assistantMsg)
            const msgs = await getChatMessages(activeChatId)
            setMessages(msgs || [])
            lastError = null
            break
          } catch (err) {
            lastError = err
            if (err.type === 'quota') continue
            break
          }
        }
        if (lastError && lastError.type === 'quota') {
          console.warn('Gemini quota errors for models:', 'fallbacks tried')
        }
      }
      const msgs = await getChatMessages(activeChatId)
      setMessages(msgs || [])
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      console.error('sendMessage', e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[70vh] bg-transparent">
      {/* Chats list */}
      <div className="w-64 bg-white/5 dark:bg-gray-800 border-r border-gray-700 p-3 rounded-l-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Percakapan</h3>
          <button onClick={startChat} className="p-1.5 bg-blue-600 text-white rounded-md"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '54vh' }}>
          {!loading && chats.length === 0 && (
            <div className="text-sm text-gray-400">Belum ada percakapan</div>
          )}
          {chats.map((c) => (
            <div key={c.id} className={`p-3 rounded-lg cursor-pointer flex items-center justify-between ${activeChatId === c.id ? 'bg-blue-600/10' : 'hover:bg-white/5'}`} onClick={() => setActiveChatId(c.id)}>
              <div className="text-sm">
                <div className="font-medium text-gray-100 truncate" style={{ maxWidth: 160 }}>{c.title}</div>
                <div className="text-xs text-gray-400">{new Date(c.updatedAt).toLocaleDateString()}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); /* optional delete handled elsewhere */ }} className="p-1 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4 text-red-500" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat column */}
      <div className="flex-1 flex items-stretch">
        <div className="max-w-3xl mx-auto w-full p-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full"><Bot className="h-5 w-5 text-blue-600" /></div>
              <div>
                <h2 className="text-lg font-semibold">AI Consultant</h2>
                <div className="text-xs text-gray-400">Konsultasi RAB</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-4">
                {messages.map((m) => {
                  const role = m.role === 'user' ? 'user' : 'assistant'
                  const content = typeof m.content === 'string' ? m.content : String(m.content || '')
                  if (role === 'assistant') {
                    return (
                      <div key={m.id} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center"><Bot className="h-5 w-5 text-blue-600" /></div>
                        <div className="prose max-w-[70ch]">
                          <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl p-4 whitespace-pre-wrap break-words">{content}</div>
                          <div className="text-xs text-gray-400 mt-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={m.id} className="flex items-start gap-4 justify-end">
                      <div className="prose max-w-[70ch] text-right">
                        <div className="inline-block bg-blue-600 text-white rounded-xl p-4 whitespace-pre-wrap break-words">{content}</div>
                        <div className="text-xs text-blue-200 mt-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><User className="h-5 w-5 text-gray-600 dark:text-gray-400" /></div>
                    </div>
                  )
                })}
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 py-8">Pilih percakapan atau mulai baru untuk berkonsultasi tentang RAB.</div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex gap-3 items-end">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Ketik pesan Anda di sini... (Enter untuk kirim)" className="flex-1 px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} />
                <button onClick={sendMessage} disabled={sending || !input.trim()} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
