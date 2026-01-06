import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserApproval } from '../hooks/useUserApproval'
import { Loader2, CheckCircle, Clock } from 'lucide-react'

export default function AwaitApproval() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { userData, loading, isApproved } = useUserApproval()

  useEffect(() => {
    // If user is approved, redirect to dashboard
    if (!loading && isApproved) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, isApproved, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }

  if (isApproved) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Menunggu Persetujuan
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Akun Anda sedang menunggu persetujuan dari administrator.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                Status Akun
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Email: {currentUser?.email || 'N/A'}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Status: Belum Disetujui
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>Anda akan dapat mengakses platform setelah administrator menyetujui akun Anda.</p>
          <p className="mt-2">Silakan hubungi administrator untuk informasi lebih lanjut.</p>
        </div>
      </div>
    </div>
  )
}

