import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, query, orderBy, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'

export function useAIChatHistory() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { currentUser } = useAuth()

  const fetchChats = async () => {
    if (!currentUser) {
      setChats([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const chatsRef = collection(db, 'aiChats')
      // Query server-side for only this user's chats (prevents missing items due to rules)
      let snapshot
      try {
        const q = query(chatsRef, where('userId', '==', currentUser.uid), orderBy('updatedAt', 'desc'))
        snapshot = await getDocs(q)
      } catch (err) {
        // Fallback if composite index/orderBy isn't available yet
        const q = query(chatsRef, where('userId', '==', currentUser.uid))
        snapshot = await getDocs(q)
      }

      const chatsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      // If we fell back without ordering, sort client-side
      chatsData.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      
      setChats(chatsData)
    } catch (err) {
      console.error('Error fetching chats:', err)
      setError(err.message)
      setChats([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChats()
  }, [currentUser])

  return { chats, loading, error, refetch: fetchChats }
}

export async function createNewChat(userId) {
  try {
    const chatData = {
      userId,
      title: 'Percakapan Baru',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    const docRef = await addDoc(collection(db, 'aiChats'), chatData)
    return docRef.id
  } catch (error) {
    console.error('Error creating chat:', error)
    throw error
  }
}

export async function saveMessageToChat(chatId, message) {
  try {
    const chatRef = doc(db, 'aiChats', chatId)
    const chatSnap = await getDoc(chatRef)
    
    if (!chatSnap.exists()) {
      throw new Error('Chat tidak ditemukan')
    }
    
    const chatData = chatSnap.data()
    const messages = chatData.messages || []
    
    // Update title from first user message if it's still default
    let title = chatData.title
    if (title === 'Percakapan Baru' && message.role === 'user' && message.content) {
      // Use first 50 chars of first message as title
      title = message.content.substring(0, 50).trim()
      if (message.content.length > 50) title += '...'
    }
    
    const updatedMessages = [...messages, message]
    
    await updateDoc(chatRef, {
      messages: updatedMessages,
      title,
      updatedAt: new Date().toISOString(),
    })
    
    return chatId
  } catch (error) {
    console.error('Error saving message:', error)
    throw error
  }
}

export async function updateChatTitle(chatId, title) {
  try {
    const chatRef = doc(db, 'aiChats', chatId)
    await updateDoc(chatRef, {
      title,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating chat title:', error)
    throw error
  }
}

export async function deleteChat(chatId) {
  try {
    const chatRef = doc(db, 'aiChats', chatId)
    await deleteDoc(chatRef)
  } catch (error) {
    console.error('Error deleting chat:', error)
    throw error
  }
}

/** Normalize a timestamp from Firestore (Timestamp), Date, or ISO string to a Date-like value for display */
function normalizeTimestamp(value) {
  if (!value) return new Date()
  if (typeof value.toDate === 'function') return value.toDate() // Firestore Timestamp
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  return new Date()
}

export async function getChatMessages(chatId) {
  try {
    const chatRef = doc(db, 'aiChats', chatId)
    const chatSnap = await getDoc(chatRef)
    
    if (!chatSnap.exists()) {
      return []
    }
    
    const raw = chatSnap.data().messages || []
    if (!Array.isArray(raw) || raw.length === 0) return []

    return raw.map((msg, index) => {
      if (!msg || typeof msg !== 'object') {
        return { id: index, role: 'assistant', content: '', timestamp: new Date() }
      }
      return {
        id: msg.id ?? index,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: typeof msg.content === 'string' ? msg.content : String(msg.content ?? ''),
        timestamp: normalizeTimestamp(msg.timestamp)
      }
    })
  } catch (error) {
    console.error('Error getting chat messages:', error)
    return []
  }
}
