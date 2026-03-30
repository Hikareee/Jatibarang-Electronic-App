import { useState } from 'react'
import { useAIChatHistory, createNewChat, saveMessageToChat, getChatMessages } from '../../hooks/useAIChatHistory'

export default function RABAIConsultant() {
  const { chats, loading } = useAIChatHistory()
  const [activeChatId, setActiveChatId] = useState(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])

  const startChat = async () => {
    const id = await createNewChat('anonymous')
    setActiveChatId(id)
    setMessages([])
  }

  const sendMessage = async () => {
    if (!activeChatId || !input.trim()) return
    const userMsg = { id: Date.now(), role: 'user', content: input, timestamp: new Date().toISOString() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    // Save to Firestore and let backend/worker process AI response (if any). Here we store the message.
    await saveMessageToChat(activeChatId, userMsg)
    // fetch updated (optimistic) messages
    const msgs = await getChatMessages(activeChatId)
    setMessages(msgs)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">AI Consultant</h2>
        <div>
          <button onClick={startChat} className="px-3 py-1 rounded bg-blue-600 text-white">New Chat</button>
        </div>
      </div>

      <div className="border rounded p-4 h-[60vh] overflow-auto bg-white dark:bg-gray-800">
        {loading && <p>Loading chats…</p>}
        {!loading && !activeChatId && (
          <div>
            <p>Pilih percakapan atau mulai baru untuk berkonsultasi dengan AI tentang RAB.</p>
            <ul className="mt-3 space-y-2">
              {chats.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <button onClick={() => setActiveChatId(c.id)} className="text-left w-full">
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeChatId && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
              {messages.map((m) => (
                <div key={m.id} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-3 py-2 rounded ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 px-3 py-2 rounded border" />
              <button onClick={sendMessage} className="px-3 py-2 rounded bg-blue-600 text-white">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
