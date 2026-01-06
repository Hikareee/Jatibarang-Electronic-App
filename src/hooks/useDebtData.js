import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateMultipleAccountBalances } from '../utils/accountBalance'

export async function getNextDebtNumber() {
  const debtsRef = collection(db, 'debts')
  const q = query(debtsRef, orderBy('number', 'desc'), limit(1))
  const snapshot = await getDocs(q)
  
  let nextNumber = 'CM/00001'
  if (!snapshot.empty) {
    const lastDebt = snapshot.docs[0].data()
    const lastNumber = lastDebt.number || 'CM/00000'
    const numPart = parseInt(lastNumber.split('/')[1]) || 0
    nextNumber = `CM/${String(numPart + 1).padStart(5, '0')}`
  }
  return nextNumber
}

export async function saveDebt(debtData) {
  try {
    const nextNumber = await getNextDebtNumber()

    // Use provided number or generate next
    const finalDebtData = {
      ...debtData,
      number: debtData.number || nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'debts'), finalDebtData)

    // Also write to unified transactions collection
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      type: 'debt',
      contactId: finalDebtData.contactId || '',
      contactName: finalDebtData.contactName || '',
      number: finalDebtData.number,
      reference: finalDebtData.reference || '',
      date: finalDebtData.transactionDate || finalDebtData.createdAt,
      dueDate: finalDebtData.dueDate || '',
      total: finalDebtData.total || 0,
      remaining: finalDebtData.total || 0,
      paid: false,
      accounts: finalDebtData.accounts || [],
      source: { collection: 'debts', id: docRef.id },
      createdAt: finalDebtData.createdAt,
      updatedAt: finalDebtData.updatedAt,
    })

    // Update account balances (increase - we owe money, so it's a liability increase)
    // For cash accounts, this typically decreases balance (money going out)
    await updateMultipleAccountBalances(
      finalDebtData.accounts || [],
      {
        type: 'debt',
        transactionId: transactionRef.id,
        number: finalDebtData.number,
        date: finalDebtData.transactionDate || finalDebtData.createdAt,
        description: `Debt ${finalDebtData.number}`
      },
      true // isDebit = true (decreases balance for cash accounts)
    )
    
    return docRef.id
  } catch (error) {
    console.error('Error saving debt:', error)
    throw error
  }
}
