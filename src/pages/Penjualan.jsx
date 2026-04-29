import { useSidebarOpen } from '../hooks/useSidebarOpen'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'

export default function Penjualan() {
  const { sidebarOpen, toggleSidebar } = useSidebarOpen(true)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        
        <Footer />
      </div>
    </div>
  )
}

