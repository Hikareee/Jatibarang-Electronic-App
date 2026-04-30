import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import LoginForm from '../components/Login/LoginForm'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { login, loginWithGoogle, currentUser } = useAuth()
  const { isApproved, loading: approvalLoading } = useUserApproval()
  const navigate = useNavigate()

  // Redirect based on approval status
  useEffect(() => {
    if (currentUser && !approvalLoading) {
      if (!isApproved) {
        navigate('/await-approval', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [currentUser, isApproved, approvalLoading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    let email = String(formData.get('email') || '').trim()
    const password = formData.get('password')

    // Support employee "username" login by appending a fixed domain.
    if (email && !email.includes('@')) {
      const domain = String(import.meta.env.VITE_EMPLOYEE_EMAIL_DOMAIN || 'pos.local').trim() || 'pos.local'
      email = `${email}@${domain}`
    }

    try {
      setError('')
      setLoading(true)
      await login(email, password)
      // Navigation will be handled by useEffect based on approval status
    } catch (err) {
      setError('Gagal masuk: ' + err.message)
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    try {
      setError('')
      setGoogleLoading(true)
      await loginWithGoogle()
      // Navigation will be handled by useEffect based on approval status
    } catch (err) {
      // Handle specific Firebase errors
      let errorMessage = 'Gagal masuk dengan Google'
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Popup login ditutup. Silakan coba lagi.'
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup diblokir browser. Izinkan popup lalu coba lagi.'
      } else if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Login dibatalkan. Silakan coba lagi.'
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Akun dengan email ini sudah ada. Gunakan login email/kata sandi.'
      } else {
        errorMessage = `Gagal masuk dengan Google: ${err.message}`
      }
      setError(errorMessage)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Side - Register prompt */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white text-center">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-2">IBASA</h1>
            <p className="text-blue-100">Perangkat Lunak Akuntansi</p>
          </div>
          <p className="text-xl text-white/95 mb-6 max-w-sm">
            Belum punya akun?
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
          >
            Daftar sekarang
          </Link>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Selamat datang di IBASA Accounting Software
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Masuk ke akun Anda
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <LoginForm 
            onSubmit={handleSubmit} 
            onGoogleLogin={handleGoogleLogin}
            loading={loading}
            googleLoading={googleLoading}
          />

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Belum punya akun?{' '}
            <Link to="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
              Daftar sekarang
            </Link>
          </p>

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Didukung oleh</span>
              <Link to="https://ibasa.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                IBASA
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2025 IBASA. Semua hak dilindungi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

