import { useState, useEffect } from 'react'
import { doc, getDoc, collection, addDoc, updateDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getAccountBalanceHistory } from '../utils/accountBalance'

export function useAccountDetail(accountId) {
  const [account, setAccount] = useState(null)
  const [balanceHistory, setBalanceHistory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [accountLogs, setAccountLogs] = useState([])
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

        // Fetch transactions related to this account
        // Transactions are stored in balanceHistory, so we'll use that for now
        // In the future, if transactions collection has accountId, we can query it
        try {
          // For now, use balanceHistory entries that have transaction info
          const transactionEntries = history.filter(h => 
            h.transactionType && h.transactionType !== 'manual_adjustment'
          ).map(h => ({
            id: h.id || h.transactionId || '',
            type: h.transactionType,
            amount: h.change || 0,
            date: h.date || h.createdAt,
            number: h.transactionNumber || '',
            reference: h.description || '',
            description: h.description || ''
          }))
          setTransactions(transactionEntries)
        } catch (err) {
          console.warn('Error processing transactions:', err)
          setTransactions([])
        }

        // Fetch account logs (edits and changes)
        try {
          const logsRef = collection(db, 'accounts', accountId, 'logs')
          const logsQ = query(logsRef, orderBy('createdAt', 'desc'), limit(100))
          const logsSnapshot = await getDocs(logsQ)
          const logsData = logsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setAccountLogs(logsData)
        } catch (err) {
          console.warn('Error fetching account logs:', err)
          setAccountLogs([])
        }
      } catch (err) {
        console.error('Error fetching account detail:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAccountDetail()
  }, [accountId])

  const updateBalance = async (newBalance, reason, userId, userName) => {
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
        createdAt: new Date().toISOString(),
        userId: userId || '',
        userName: userName || ''
      })

      // Log account edit
      await addDoc(collection(db, 'accounts', accountId, 'logs'), {
        type: 'balance_edit',
        oldValue: oldBalance,
        newValue: newBalance,
        change: balanceChange,
        description: reason || 'Manual balance adjustment',
        userId: userId || '',
        userName: userName || '',
        createdAt: new Date().toISOString()
      })

      // Update local state
      setAccount(prev => ({ ...prev, saldo: newBalance }))
      
      // Refresh balance history and logs
      const history = await getAccountBalanceHistory(accountId, 100)
      setBalanceHistory(history.reverse())
      
      const logsRef = collection(db, 'accounts', accountId, 'logs')
      const logsQ = query(logsRef, orderBy('createdAt', 'desc'), limit(100))
      const logsSnapshot = await getDocs(logsQ)
      const logsData = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAccountLogs(logsData)

      return true
    } catch (err) {
      console.error('Error updating balance:', err)
      throw err
    }
  }

  const updateAccount = async (accountData, userId, userName, description) => {
    if (!accountId || !account) return

    try {
      const oldData = { ...account }
      
      // Update account
      await updateDoc(doc(db, 'accounts', accountId), {
        ...accountData,
        updatedAt: new Date().toISOString()
      })

      // Log account edit
      await addDoc(collection(db, 'accounts', accountId, 'logs'), {
        type: 'account_edit',
        oldValue: oldData,
        newValue: accountData,
        description: description || 'Account details updated',
        userId: userId || '',
        userName: userName || '',
        createdAt: new Date().toISOString()
      })

      // Update local state
      setAccount(prev => ({ ...prev, ...accountData }))
      
      // Refresh logs
      const logsRef = collection(db, 'accounts', accountId, 'logs')
      const logsQ = query(logsRef, orderBy('createdAt', 'desc'), limit(100))
      const logsSnapshot = await getDocs(logsQ)
      const logsData = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAccountLogs(logsData)

      return true
    } catch (err) {
      console.error('Error updating account:', err)
      throw err
    }
  }

  const addTransaction = async (transactionData, userId, userName) => {
    if (!accountId) return

    try {
      // Add transaction to transactions collection
      const transactionRef = await addDoc(collection(db, 'transactions'), {
        ...transactionData,
        accountId: accountId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Update account balance if amount is provided
      if (transactionData.amount) {
        const amount = parseFloat(transactionData.amount) || 0
        const oldBalance = parseFloat(account.saldo) || 0
        const newBalance = oldBalance + amount

        await updateDoc(doc(db, 'accounts', accountId), {
          saldo: newBalance,
          updatedAt: new Date().toISOString()
        })

        // Log balance history
        await addDoc(collection(db, 'accounts', accountId, 'balanceHistory'), {
          oldBalance,
          newBalance,
          change: amount,
          transactionType: transactionData.type || 'manual_transaction',
          transactionId: transactionRef.id,
          transactionNumber: transactionData.number || '',
          date: transactionData.date || new Date().toISOString(),
          description: transactionData.description || '',
          createdAt: new Date().toISOString(),
          userId: userId || '',
          userName: userName || ''
        })

        setAccount(prev => ({ ...prev, saldo: newBalance }))
      }

      // Log transaction
      await addDoc(collection(db, 'accounts', accountId, 'logs'), {
        type: 'transaction',
        transactionId: transactionRef.id,
        transactionNumber: transactionData.number || '',
        amount: transactionData.amount || 0,
        description: transactionData.description || '',
        userId: userId || '',
        userName: userName || '',
        createdAt: new Date().toISOString()
      })

      // Refresh balance history and transactions
      const history = await getAccountBalanceHistory(accountId, 100)
      setBalanceHistory(history.reverse())
      
      const transactionEntries = history.filter(h => 
        h.transactionType && h.transactionType !== 'manual_adjustment'
      ).map(h => ({
        id: h.id || h.transactionId || '',
        type: h.transactionType,
        amount: h.change || 0,
        date: h.date || h.createdAt,
        number: h.transactionNumber || '',
        reference: h.description || '',
        description: h.description || ''
      }))
      setTransactions(transactionEntries)

      const logsRef = collection(db, 'accounts', accountId, 'logs')
      const logsQ = query(logsRef, orderBy('createdAt', 'desc'), limit(100))
      const logsSnapshot = await getDocs(logsQ)
      const logsData = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setAccountLogs(logsData)

      return transactionRef.id
    } catch (err) {
      console.error('Error adding transaction:', err)
      throw err
    }
  }

  return { account, balanceHistory, transactions, accountLogs, loading, error, updateBalance, updateAccount, addTransaction }
}
