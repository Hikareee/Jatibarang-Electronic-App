import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, query, orderBy, addDoc, limit, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const accountsRef = collection(db, 'accounts')
      const q = query(accountsRef, orderBy('code', 'asc'))
      const snapshot = await getDocs(q)
      
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      setAccounts(accountsData)
    } catch (err) {
      console.error('Error fetching accounts:', err)
      if (err.code === 'failed-precondition' || err.code === 'not-found') {
        setAccounts([])
      } else {
        setError(err.message)
        setAccounts([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  return { accounts, loading, error, refetch: fetchAccounts }
}

export async function saveAccount(accountData) {
  try {
    if (!accountData.name || !accountData.category) {
      throw new Error('Nama dan Kategori harus diisi')
    }

    // Auto-generate code: find the highest code and increment
    const accountsRef = collection(db, 'accounts')
    const q = query(accountsRef, orderBy('code', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextCode = '1001' // Default starting code
    if (!snapshot.empty) {
      const lastAccount = snapshot.docs[0].data()
      const lastCode = lastAccount.code || '1000'
      // Extract number from code (e.g., "1001" from "1-10001" or "1001")
      const codeMatch = lastCode.match(/(\d+)$/)
      if (codeMatch) {
        const lastNumber = parseInt(codeMatch[1]) || 1000
        nextCode = String(lastNumber + 1)
      }
    }

    const cleanedData = {
      name: accountData.name,
      code: nextCode,
      category: accountData.category || '',
      subAccountOf: accountData.subAccountOf || '',
      saldo: Number(accountData.saldo) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await addDoc(collection(db, 'accounts'), cleanedData)
    return nextCode
  } catch (error) {
    console.error('Error saving account:', error)
    throw error
  }
}

export async function deleteAccount(accountId) {
  try {
    const accountRef = doc(db, 'accounts', accountId)
    await deleteDoc(accountRef)
  } catch (error) {
    console.error('Error deleting account:', error)
    throw error
  }
}

export async function deleteAccounts(accountIds) {
  try {
    const deletePromises = accountIds.map(accountId => {
      const accountRef = doc(db, 'accounts', accountId)
      return deleteDoc(accountRef)
    })
    await Promise.all(deletePromises)
  } catch (error) {
    console.error('Error deleting accounts:', error)
    throw error
  }
}

