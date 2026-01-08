import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateAccountBalance } from '../utils/accountBalance'

export async function getNextExpenseNumber() {
  try {
    const expensesRef = collection(db, 'expenses')
    const q = query(expensesRef, orderBy('number', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextNumber = 'EXP/00001'
    if (!snapshot.empty) {
      const lastExpense = snapshot.docs[0].data()
      const lastNumber = lastExpense.number || 'EXP/00000'
      const numPart = parseInt(lastNumber.split('/')[1]) || 0
      nextNumber = `EXP/${String(numPart + 1).padStart(5, '0')}`
    }
    return nextNumber
  } catch (error) {
    console.error('Error getting next expense number:', error)
    return 'EXP/00001'
  }
}

export async function saveExpense(expenseData) {
  try {
    const finalExpenseData = {
      ...expenseData,
      number: expenseData.number || (await getNextExpenseNumber()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      remaining: expenseData.total || 0, // Initialize remaining as total
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'expenses'), finalExpenseData)
    
    // Also write to unified transactions collection
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      type: 'expense',
      contactId: finalExpenseData.recipientId || finalExpenseData.contactId || '',
      contactName: finalExpenseData.recipient || '',
      number: finalExpenseData.number,
      reference: finalExpenseData.reference || '',
      date: finalExpenseData.date || finalExpenseData.createdAt,
      dueDate: finalExpenseData.dueDate || '',
      total: finalExpenseData.total || 0,
      remaining: finalExpenseData.remaining || finalExpenseData.total || 0,
      paid: finalExpenseData.remaining === 0,
      items: finalExpenseData.items || [],
      source: { collection: 'expenses', id: docRef.id },
      createdAt: finalExpenseData.createdAt,
      updatedAt: finalExpenseData.updatedAt,
    })

    // Update account balance (decrease for expense - money going out)
    const accountId = finalExpenseData.accountId || finalExpenseData.account
    const totalAmount = parseFloat(finalExpenseData.total) || 0
    
    if (accountId && totalAmount > 0) {
      // Only update balance if fully paid, otherwise update when payment is made
      if (finalExpenseData.remaining === 0 || finalExpenseData.paid) {
        await updateAccountBalance(accountId, -totalAmount, {
          type: 'expense',
          transactionId: transactionRef.id,
          number: finalExpenseData.number,
          date: finalExpenseData.date || finalExpenseData.createdAt,
          description: `Expense ${finalExpenseData.number}`
        })
      }
    }
    
    return docRef.id
  } catch (error) {
    console.error('Error saving expense:', error)
    throw error
  }
}

export function useExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const expensesRef = collection(db, 'expenses')
      const q = query(expensesRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const expensesData = await Promise.all(
        snapshot.docs.map(async (expenseDoc) => {
          const data = expenseDoc.data()
          let recipientName = data.recipient || 'N/A'
          
          // If recipient is an ID, fetch the contact name
          if (data.recipient && data.recipient.length > 0 && !data.recipient.includes(' ') && data.recipient.length > 10) {
            try {
              const contactRef = doc(db, 'contacts', data.recipient)
              const contactSnap = await getDoc(contactRef)
              if (contactSnap.exists()) {
                recipientName = contactSnap.data().name || contactSnap.data().company || data.recipient
              }
            } catch (err) {
              console.warn('Could not fetch recipient name:', err)
            }
          }
          
          return {
            id: expenseDoc.id,
            ...data,
            recipient: recipientName,
            remaining: data.remaining !== undefined ? data.remaining : (data.total || 0)
          }
        })
      )
      
      setExpenses(expensesData)
    } catch (err) {
      console.error('Error fetching expenses:', err)
      setError(err.message)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  return { expenses, loading, error, refetch: fetchExpenses }
}

