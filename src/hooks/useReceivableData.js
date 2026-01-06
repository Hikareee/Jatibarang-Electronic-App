import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateMultipleAccountBalances } from '../utils/accountBalance'

export async function getNextReceivableNumber() {
  const receivablesRef = collection(db, 'receivables')
  const q = query(receivablesRef, orderBy('number', 'desc'), limit(1))
  const snapshot = await getDocs(q)
  
  let nextNumber = 'DM/00001'
  if (!snapshot.empty) {
    const lastReceivable = snapshot.docs[0].data()
    const lastNumber = lastReceivable.number || 'DM/00000'
    const numPart = parseInt(lastNumber.split('/')[1]) || 0
    nextNumber = `DM/${String(numPart + 1).padStart(5, '0')}`
  }
  return nextNumber
}

export async function saveReceivable(receivableData) {
  try {
    const nextNumber = await getNextReceivableNumber()

    // Use provided number or generate next
    const finalReceivableData = {
      ...receivableData,
      number: receivableData.number || nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'receivables'), finalReceivableData)

    // Also write to unified transactions collection
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      type: 'receivable',
      contactId: finalReceivableData.contactId || '',
      contactName: finalReceivableData.contactName || '',
      number: finalReceivableData.number,
      reference: finalReceivableData.reference || '',
      date: finalReceivableData.transactionDate || finalReceivableData.createdAt,
      dueDate: finalReceivableData.dueDate || '',
      total: finalReceivableData.total || 0,
      remaining: finalReceivableData.total || 0,
      paid: false,
      accounts: finalReceivableData.accounts || [],
      source: { collection: 'receivables', id: docRef.id },
      createdAt: finalReceivableData.createdAt,
      updatedAt: finalReceivableData.updatedAt,
    })

    // Update account balances (increase - money coming in from client payment)
    await updateMultipleAccountBalances(
      finalReceivableData.accounts || [],
      {
        type: 'receivable',
        transactionId: transactionRef.id,
        number: finalReceivableData.number,
        date: finalReceivableData.transactionDate || finalReceivableData.createdAt,
        description: `Receivable ${finalReceivableData.number}`
      },
      false // isDebit = false (increases balance)
    )
    
    return docRef.id
  } catch (error) {
    console.error('Error saving receivable:', error)
    throw error
  }
}

