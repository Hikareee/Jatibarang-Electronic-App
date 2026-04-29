import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Chrome, Key, Smartphone } from 'lucide-react'

export default function LoginForm({ onSubmit, onGoogleLogin, loading, googleLoading }) {
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState('')

  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  function handleEmailChange(e) {
    const email = e.target.value
    if (email && !validateEmail(email)) {
      setEmailError('Format email tidak valid.')
    } else {
      setEmailError('')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            onChange={handleEmailChange}
            className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              emailError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Masukkan email Anda"
          />
        </div>
        {emailError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{emailError}</p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Kata Sandi
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Masukkan kata sandi Anda"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Ingat saya</span>
        </label>
        <Link
          to="/forgot"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Lupa kata sandi?
        </Link>
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Sedang masuk...' : 'Masuk'}
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            Atau login dengan
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loading || googleLoading}
          className="flex flex-col items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-1"></div>
          ) : (
          <Chrome className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-1" />
          )}
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {googleLoading ? 'Sedang masuk...' : 'Google'}
          </span>
        </button>
        <button
          type="button"
          disabled
          className="flex flex-col items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Key className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-1" />
          <span className="text-xs text-gray-700 dark:text-gray-300">SSO</span>
        </button>
        <button
          type="button"
          disabled
          className="flex flex-col items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Smartphone className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-1" />
          <span className="text-xs text-gray-700 dark:text-gray-300">OTP</span>
        </button>
      </div>
    </form>
  )
}

