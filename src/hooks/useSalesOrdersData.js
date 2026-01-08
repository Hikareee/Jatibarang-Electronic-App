import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, updateDoc, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { saveInvoice } from './useInvoiceData'

export async function getNextOrderNumber() {
  try {
    const ordersRef = collection(db, 'salesOrders')
    const q = query(ordersRef, orderBy('number', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    
    let nextNumber = 'SO/00001'
    if (!snapshot.empty) {
      const lastOrder = snapshot.docs[0].data()
      const lastNumber = lastOrder.number || 'SO/00000'
      const numPart = parseInt(lastNumber.split('/')[1]) || 0
      nextNumber = `SO/${String(numPart + 1).padStart(5, '0')}`
    }
    return nextNumber
  } catch (error) {
    console.error('Error getting next order number:', error)
    return 'SO/00001'
  }
}

export async function saveSalesOrder(orderData) {
  try {
    const finalOrderData = {
      ...orderData,
      number: orderData.number || (await getNextOrderNumber()),
      status: orderData.status || 'draft',
      deliveryStatus: orderData.deliveryStatus || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'salesOrders'), finalOrderData)
    
    // Also write to unified transactions collection
    await addDoc(collection(db, 'transactions'), {
      type: 'order_sale',
      contactId: finalOrderData.customerId || finalOrderData.customer || '',
      contactName: finalOrderData.customerName || '',
      number: finalOrderData.number,
      reference: finalOrderData.reference || '',
      date: finalOrderData.orderDate || finalOrderData.createdAt,
      dueDate: finalOrderData.dueDate || '',
      total: finalOrderData.total || 0,
      remaining: finalOrderData.total || 0,
      paid: false,
      items: finalOrderData.items || [],
      source: { collection: 'salesOrders', id: docRef.id },
      createdAt: finalOrderData.createdAt,
      updatedAt: finalOrderData.updatedAt,
    })
    
    return docRef.id
  } catch (error) {
    console.error('Error saving sales order:', error)
    throw error
  }
}

export async function createInvoiceFromOrder(orderId) {
  try {
    const orderRef = doc(db, 'salesOrders', orderId)
    const orderSnap = await getDoc(orderRef)
    
    if (!orderSnap.exists()) {
      throw new Error('Order not found')
    }
    
    const orderData = orderSnap.data()
    
    // Create invoice from order data
    const invoiceData = {
      customer: orderData.customer || orderData.customerId,
      number: '', // Will be auto-generated
      transactionDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      dueDate: orderData.dueDate || '',
      term: orderData.term || 'Net 30',
      warehouse: orderData.warehouse || 'Unassigned',
      reference: orderData.reference || orderData.number,
      tag: orderData.tag || '',
      items: orderData.items || [],
      total: orderData.total || 0,
      subTotal: orderData.subTotal || orderData.total || 0,
      remaining: orderData.total || 0,
      additionalDiscount: orderData.additionalDiscount || { type: 'Rp', value: 0 },
      shippingCost: orderData.shippingCost || { type: 'Rp', value: 0 },
      transactionFee: orderData.transactionFee || { type: 'Rp', value: 0 },
      deductions: orderData.deductions || [],
      downPayments: orderData.downPayments || [],
      message: orderData.message || '',
      orderId: orderId, // Link back to order
      orderNumber: orderData.number,
    }
    
    const invoiceId = await saveInvoice(invoiceData)
    
    // Update order to link to invoice
    await updateDoc(orderRef, {
      invoiceId: invoiceId,
      updatedAt: new Date().toISOString()
    })
    
    return invoiceId
  } catch (error) {
    console.error('Error creating invoice from order:', error)
    throw error
  }
}

export function useSalesOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const ordersRef = collection(db, 'salesOrders')
      const q = query(ordersRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      
      const ordersData = await Promise.all(
        snapshot.docs.map(async (orderDoc) => {
          const data = orderDoc.data()
          let customerName = data.customer || 'N/A'
          
          // If customer is an ID, fetch the contact name
          if (data.customer && data.customer.length > 0 && !data.customer.includes(' ') && data.customer.length > 10) {
            try {
              const contactRef = doc(db, 'contacts', data.customer)
              const contactSnap = await getDoc(contactRef)
              if (contactSnap.exists()) {
                customerName = contactSnap.data().name || contactSnap.data().company || data.customer
              }
            } catch (err) {
              console.warn('Could not fetch customer name:', err)
            }
          }
          
          return {
            id: orderDoc.id,
            ...data,
            customer: customerName,
            deliveryStatus: data.deliveryStatus || 0
          }
        })
      )
      
      setOrders(ordersData)
    } catch (err) {
      console.error('Error fetching sales orders:', err)
      setError(err.message)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const updateOrderStatus = async (orderId, status) => {
    try {
      const orderRef = doc(db, 'salesOrders', orderId)
      await updateDoc(orderRef, {
        status: status,
        updatedAt: new Date().toISOString()
      })
      
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status: status }
            : order
        )
      )
      
      return true
    } catch (err) {
      console.error('Error updating order status:', err)
      throw err
    }
  }

  return { orders, loading, error, refetch: fetchOrders, updateOrderStatus }
}

