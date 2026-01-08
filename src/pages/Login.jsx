import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import TestimonialCarousel from '../components/Login/TestimonialCarousel'
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
    const email = formData.get('email')
    const password = formData.get('password')

    try {
      setError('')
      setLoading(true)
      await login(email, password)
      // Navigation will be handled by useEffect based on approval status
    } catch (err) {
      setError('Failed to log in: ' + err.message)
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
      let errorMessage = 'Failed to log in with Google'
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed. Please try again.'
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked by your browser. Please allow popups and try again.'
      } else if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in was cancelled. Please try again.'
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email. Please use email/password login.'
      } else {
        errorMessage = `Failed to log in with Google: ${err.message}`
      }
      setError(errorMessage)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Side - Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
          <div className="mb-8">
            <img 
              src="/logo-white.svg" 
              alt="IBASA" 
              className="h-12 mb-8"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <h1 className="text-4xl font-bold mb-2">IBASA</h1>
            <p className="text-blue-100">Accounting Software</p>
          </div>
          <TestimonialCarousel />
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to IBASA
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to your account
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

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Powered by</span>
              <Link to="https://ibasa.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                IBASA
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2025 IBASA. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

