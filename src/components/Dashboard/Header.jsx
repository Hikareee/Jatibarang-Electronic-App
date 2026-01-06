import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { 
  ShoppingCart, 
  ShoppingBag,
  CreditCard,
  Moon, 
  Sun, 
  Globe, 
  User, 
  LogOut,
  Menu,
  Bell,
  ChevronDown
} from 'lucide-react'

export default function Header({ onMenuClick }) {
  const [darkMode, setDarkMode] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const { currentUser, logout } = useAuth()
  const { language, toggleLanguage, t } = useLanguage()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }

  function toggleDarkMode() {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left Side - Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button 
            onClick={() => navigate('/sales/invoice/add')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            <ShoppingCart className="h-5 w-5 text-gray-900 dark:text-white" />
            <span className="text-gray-900 dark:text-white font-medium">{t('sell')}</span>
          </button>

          <button 
            onClick={() => navigate('/pembelian/invoice/add')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            <ShoppingBag className="h-5 w-5 text-gray-900 dark:text-white" />
            <span className="text-gray-900 dark:text-white font-medium">{t('buy')}</span>
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm">
            <CreditCard className="h-5 w-5 text-gray-900 dark:text-white" />
            <span className="text-gray-900 dark:text-white font-medium">{t('fees')}</span>
          </button>
        </div>

        {/* Right Side - Company, Language, Notifications, Theme, User */}
        <div className="flex items-center gap-2">
          {/* Company Selector */}
          <button className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">IBASA</span>
            <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Language/Region Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="text-sm font-medium text-white">{language === 'en' ? 'EN' : 'ID'}</span>
              <ChevronDown className="h-4 w-4 text-white" />
            </button>
            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <button
                  onClick={() => {
                    if (language !== 'en') {
                      toggleLanguage()
                    }
                    setShowLanguageMenu(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    language === 'en' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  English (EN)
                </button>
                <button
                  onClick={() => {
                    if (language !== 'id') {
                      toggleLanguage()
                    }
                    setShowLanguageMenu(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    language === 'id' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Indonesia (ID)
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button className="flex items-center gap-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors relative">
              <Bell className="h-5 w-5 text-white" />
              <ChevronDown className="h-4 w-4 text-white" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            <div className="relative w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                darkMode ? 'translate-x-4' : 'translate-x-0'
              }`}></div>
              {!darkMode && (
                <Sun className="absolute top-1 right-1 h-4 w-4 text-gray-600" />
            )}
            </div>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
            >
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {currentUser?.email || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

