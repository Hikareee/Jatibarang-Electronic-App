import { doc, updateDoc, increment, getDoc, collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Update account balance and log the change
 * @param {string} accountId - The account ID to update
 * @param {number} amount - The amount to change (positive = increase, negative = decrease)
 * @param {object} transactionInfo - Information about the transaction causing this change
 * @param {string} transactionInfo.type - Transaction type (invoice_purchase, invoice_sale, receivable, debt, payment)
 * @param {string} transactionInfo.transactionId - The transaction document ID
 * @param {string} transactionInfo.number - Transaction number
 * @param {string} transactionInfo.date - Transaction date
 * @param {string} transactionInfo.description - Optional description
 */
export async function updateAccountBalance(accountId, amount, transactionInfo) {
  if (!accountId || amount === 0) return

  try {
    const accountRef = doc(db, 'accounts', accountId)
    const accountSnap = await getDoc(accountRef)
    
    if (!accountSnap.exists()) {
      console.warn(`Account ${accountId} does not exist`)
      return
    }

    const accountData = accountSnap.data()
    const oldBalance = parseFloat(accountData.saldo) || 0
    const newBalance = oldBalance + amount

    // Update account balance
    await updateDoc(accountRef, {
      saldo: increment(amount),
      updatedAt: new Date().toISOString()
    })

    // Log balance history
    await addDoc(collection(db, 'accounts', accountId, 'balanceHistory'), {
      oldBalance,
      newBalance,
      change: amount,
      transactionType: transactionInfo.type,
      transactionId: transactionInfo.transactionId,
      transactionNumber: transactionInfo.number,
      date: transactionInfo.date || new Date().toISOString(),
      description: transactionInfo.description || '',
      createdAt: new Date().toISOString()
    })

    console.log(`Updated account ${accountId}: ${oldBalance} → ${newBalance} (change: ${amount})`)
  } catch (error) {
    console.error('Error updating account balance:', error)
    throw error
  }
}

/**
 * Get balance history for an account
 * @param {string} accountId - The account ID
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of balance history records
 */
export async function getAccountBalanceHistory(accountId, limit = 100) {
  try {
    const historyRef = collection(db, 'accounts', accountId, 'balanceHistory')
    const q = query(historyRef, orderBy('createdAt', 'desc'), limit(limit))
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error fetching balance history:', error)
    return []
  }
}

/**
 * Update multiple account balances from a transaction
 * @param {Array} accountItems - Array of { account: accountId, amount: number, description?: string }
 * @param {object} transactionInfo - Transaction information
 * @param {boolean} isDebit - If true, amounts decrease balance; if false, amounts increase balance
 */
export async function updateMultipleAccountBalances(accountItems, transactionInfo, isDebit = false) {
  if (!Array.isArray(accountItems) || accountItems.length === 0) return

  await Promise.all(
    accountItems.map(async (item) => {
      const accountId = item.account
      const amountValue = parseFloat(item.amount) || 0
      if (!accountId || amountValue === 0) return

      // If debit, make amount negative; if credit, keep positive
      const changeAmount = isDebit ? -amountValue : amountValue

      await updateAccountBalance(accountId, changeAmount, {
        ...transactionInfo,
        description: item.description || transactionInfo.description
      })
    })
  )
}

