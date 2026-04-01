import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'ui.sidebarOpen'

export function useSidebarOpen(defaultOpen = true) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return defaultOpen
      return raw === 'true'
    } catch {
      return defaultOpen
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(sidebarOpen))
    } catch {
      // ignore
    }
  }, [sidebarOpen])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => !v)
  }, [])

  return { sidebarOpen, setSidebarOpen, toggleSidebar }
}

