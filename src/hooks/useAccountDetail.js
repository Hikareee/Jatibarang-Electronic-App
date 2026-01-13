import { useState, useEffect } from 'react'
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getAccountBalanceHistory } from '../utils/accountBalance'

export function useAccountDetail(accountId) {
  const [account, setAccount] = useState(null)
  const [balanceHistory, setBalanceHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAccountDetail() {
      if (!accountId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch account data
        const accountRef = doc(db, 'accounts', accountId)
        const accountSnap = await getDoc(accountRef)

        if (!accountSnap.exists()) {
          setError('Account not found')
          setLoading(false)
          return
        }

        const accountData = {
          id: accountSnap.id,
          ...accountSnap.data()
        }
        setAccount(accountData)

        // Fetch balance history
        const history = await getAccountBalanceHistory(accountId, 100)
        setBalanceHistory(history.reverse()) // Reverse to show oldest first for graph
      } catch (err) {
        console.error('Error fetching account detail:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAccountDetail()
  }, [accountId])

  const updateBalance = async (newBalance, reason) => {
    if (!accountId || !account) return

    try {
      const oldBalance = parseFloat(account.saldo) || 0
      const balanceChange = newBalance - oldBalance

      // Update account balance
      await updateDoc(doc(db, 'accounts', accountId), {
        saldo: newBalance,
        updatedAt: new Date().toISOString()
      })

      // Log balance history
      await addDoc(collection(db, 'accounts', accountId, 'balanceHistory'), {
        oldBalance,
        newBalance,
        change: balanceChange,
        transactionType: 'manual_adjustment',
        transactionId: '',
        transactionNumber: '',
        date: new Date().toISOString(),
        description: reason || 'Manual balance adjustment',
        createdAt: new Date().toISOString()
      })

      // Update local state
      setAccount(prev => ({ ...prev, saldo: newBalance }))
      
      // Refresh balance history
      const history = await getAccountBalanceHistory(accountId, 100)
      setBalanceHistory(history.reverse())

      return true
    } catch (err) {
      console.error('Error updating balance:', err)
      throw err
    }
  }

  return { account, balanceHistory, loading, error, updateBalance }
}
