import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Penjualan from './pages/Penjualan'
import PenjualanOverview from './pages/PenjualanOverview'
import InvoiceAdd from './pages/InvoiceAdd'
import Tagihan from './pages/Tagihan'
import Pembelian from './pages/Pembelian'
import PembelianOverview from './pages/PembelianOverview'
import PurchaseInvoiceAdd from './pages/PurchaseInvoiceAdd'
import Kontak from './pages/Kontak'
import Produk from './pages/Produk'
import ProductAdd from './pages/ProductAdd'

function PrivateRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/penjualan"
        element={
          <PrivateRoute>
            <Penjualan />
          </PrivateRoute>
        }
      >
        <Route path="overview" element={<PenjualanOverview />} />
        <Route path="tagihan" element={<Tagihan />} />
        <Route path="pengiriman" element={<div className="p-6"><h1 className="text-2xl font-bold">Pengiriman</h1></div>} />
        <Route path="pemesanan" element={<div className="p-6"><h1 className="text-2xl font-bold">Pemesanan</h1></div>} />
        <Route path="penawaran" element={<div className="p-6"><h1 className="text-2xl font-bold">Penawaran</h1></div>} />
      </Route>
      <Route
        path="/sales/invoice/add"
        element={
          <PrivateRoute>
            <InvoiceAdd />
          </PrivateRoute>
        }
      />
      <Route
        path="/pembelian/invoice/add"
        element={
          <PrivateRoute>
            <PurchaseInvoiceAdd />
          </PrivateRoute>
        }
      />
      <Route
        path="/pembelian"
        element={
          <PrivateRoute>
            <Pembelian />
          </PrivateRoute>
        }
      >
        <Route path="overview" element={<PembelianOverview />} />
        <Route path="tagihan" element={<div className="p-6"><h1 className="text-2xl font-bold">Tagihan Pembelian</h1></div>} />
        <Route path="pengiriman" element={<div className="p-6"><h1 className="text-2xl font-bold">Pengiriman Pembelian</h1></div>} />
        <Route path="pesanan" element={<div className="p-6"><h1 className="text-2xl font-bold">Pesanan Pembelian</h1></div>} />
        <Route path="penawaran" element={<div className="p-6"><h1 className="text-2xl font-bold">Penawaran Pembelian</h1></div>} />
      </Route>
      <Route
        path="/kontak"
        element={
          <PrivateRoute>
            <Kontak />
          </PrivateRoute>
        }
      />
      <Route
        path="/produk"
        element={
          <PrivateRoute>
            <Produk />
          </PrivateRoute>
        }
      />
      <Route
        path="/produk/tambah"
        element={
          <PrivateRoute>
            <ProductAdd />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <AppRoutes />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App

