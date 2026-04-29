import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useWarehouses } from '../hooks/useWarehouses'

const PosSettingsOutletCtx = createContext(null)

export function PosSettingsOutletProvider({ children }) {
  const { warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState('')

  useEffect(() => {
    if (warehouses?.length && !warehouseId) {
      setWarehouseId(warehouses[0].id)
    }
  }, [warehouses, warehouseId])

  const value = useMemo(
    () => ({
      warehouses: warehouses || [],
      settingsWarehouseId: warehouseId,
      setSettingsWarehouseId: setWarehouseId,
    }),
    [warehouses, warehouseId]
  )

  return (
    <PosSettingsOutletCtx.Provider value={value}>
      {children}
    </PosSettingsOutletCtx.Provider>
  )
}

export function usePosSettingsOutlet() {
  const v = useContext(PosSettingsOutletCtx)
  if (!v)
    throw new Error('usePosSettingsOutlet must be inside PosSettingsOutletProvider')
  return v
}
