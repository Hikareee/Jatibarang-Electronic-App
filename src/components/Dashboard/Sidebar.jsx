import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useUserApproval } from '../../hooks/useUserApproval'
import { 
  Home,
  ShoppingCart, 
  ShoppingBag,
  Receipt,
  Package,
  Warehouse,
  FileText,
  Wallet,
  BookOpen,
  Building2,
  Users,
  Briefcase,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles
} from 'lucide-react'

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation()
  const { t } = useLanguage()
  const { role } = useUserApproval()
  const isEmployee = role === 'employee'
  const [expandedMenus, setExpandedMenus] = useState({
    penjualan: location.pathname.startsWith('/penjualan'),
    pembelian: location.pathname.startsWith('/pembelian')
  })

  // Auto-expand menu when on sub-route
  useEffect(() => {
    if (location.pathname.startsWith('/penjualan')) {
      setExpandedMenus(prev => ({ ...prev, penjualan: true }))
    }
    if (location.pathname.startsWith('/pembelian')) {
      setExpandedMenus(prev => ({ ...prev, pembelian: true }))
    }
  }, [location.pathname])

  const allMenuItems = [
    { icon: Home, label: t('home'), path: '/dashboard' },
    { 
      icon: ShoppingCart, 
      label: t('sales'), 
      path: '/penjualan',
      subItems: [
        { label: t('overview'), path: '/penjualan/overview' },
        { label: t('invoices'), path: '/penjualan/tagihan' },
        { label: t('shipments'), path: '/penjualan/pengiriman' },
        { label: t('orders'), path: '/penjualan/pemesanan' },
        { label: t('offers'), path: '/penjualan/penawaran' },
      ]
    },
    { 
      icon: ShoppingBag, 
      label: t('purchases'), 
      path: '/pembelian',
      subItems: [
        { label: t('overview'), path: '/pembelian/overview' },
        { label: t('purchaseInvoices'), path: '/pembelian/tagihan' },
        { label: t('purchaseShipments'), path: '/pembelian/pengiriman' },
        { label: t('purchaseOrders'), path: '/pembelian/pesanan' },
        { label: t('purchaseOffers'), path: '/pembelian/penawaran' },
      ]
    },
    { icon: Receipt, label: t('expenses'), path: '/biaya', managerOnly: true },
    { icon: Package, label: t('products'), path: '/produk', managerOnly: true },
    { icon: Warehouse, label: t('inventory'), path: '/inventori', managerOnly: true },
    { icon: FileText, label: t('reports'), path: '/laporan', managerOnly: true },
    { icon: Wallet, label: t('cashBank'), path: '/kas-bank', managerOnly: true },
    { icon: BookOpen, label: t('accounts'), path: '/akun', managerOnly: true },
    { icon: Building2, label: t('fixedAssets'), path: '/aset-tetap', managerOnly: true },
    { icon: Users, label: t('contacts'), path: '/kontak', managerOnly: true },
    { icon: Briefcase, label: t('payroll'), path: '/payroll', managerOnly: true },
    { icon: Shield, label: t('users'), path: '/users', managerOnly: true },
    { icon: Sparkles, label: t('aiAssistant'), path: '/ai-assistant' },
  ]

  const menuItems = useMemo(() => 
    isEmployee ? allMenuItems.filter(item => !item.managerOnly) : allMenuItems,
    [isEmployee]
  )

  return (
    <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col ${
      isOpen ? 'w-64' : 'w-20'
    }`}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">IB</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">ASA</span>
            </div>
          </div>
        )}
        {!isOpen && (
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">I</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">B</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isOpen ? (
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path || (item.subItems && item.subItems.some(sub => location.pathname === sub.path))
          const isExpanded = expandedMenus[item.path.replace('/', '')] || false
          const hasSubItems = item.subItems && item.subItems.length > 0
          
          return (
            <div key={item.path}>
              {hasSubItems ? (
                <>
                  <button
                    onClick={() => {
                      if (isOpen) {
                        setExpandedMenus(prev => ({
                          ...prev,
                          [item.path.replace('/', '')]: !prev[item.path.replace('/', '')]
                        }))
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {isOpen && (
                      <>
                        <span className="font-medium flex-1 text-left">{item.label}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </button>
                  {isOpen && isExpanded && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.subItems.map((subItem) => {
                        const isSubActive = location.pathname === subItem.path
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            className={`block p-2 rounded-lg transition-colors text-sm ${
                              isSubActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={!isOpen ? item.label : ''}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom Navigation Arrows */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-2">
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </aside>
  )
}

