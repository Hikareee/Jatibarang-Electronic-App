import { Navigate } from 'react-router-dom'
import { useUserApproval } from '../hooks/useUserApproval'

/**
 * Renders children only for owner, manager, or admin.
 * Employees are redirected to dashboard (they are limited to adding penjualan/pembelian drafts).
 */
export default function ManagerRoute({ children }) {
  const { role, loading } = useUserApproval()
  const canAccess = role === 'owner' || role === 'manager' || role === 'admin'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
      </div>
    )
  }

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
