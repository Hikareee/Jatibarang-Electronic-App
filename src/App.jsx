import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import Login from './pages/Login'
import Register from './pages/Register'
import AwaitApproval from './pages/AwaitApproval'
import Users from './pages/Users'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Penjualan from './pages/Penjualan'
import PenjualanOverview from './pages/PenjualanOverview'
import InvoiceAdd from './pages/InvoiceAdd'
import Tagihan from './pages/Tagihan'
import Pembelian from './pages/Pembelian'
import PembelianOverview from './pages/PembelianOverview'
import PurchaseInvoiceAdd from './pages/PurchaseInvoiceAdd'
import PurchaseInvoiceEdit from './pages/PurchaseInvoiceEdit'
import PesananPembelian from './pages/PesananPembelian'
import PurchaseInvoiceDetail from './pages/PurchaseInvoiceDetail'
import PengirimanPembelian from './pages/PengirimanPembelian'
import Kontak from './pages/Kontak'
import ContactDetail from './pages/ContactDetail'
import Produk from './pages/Produk'
import ProductAdd from './pages/ProductAdd'
import DebtAdd from './pages/DebtAdd'
import ReceivableAdd from './pages/ReceivableAdd'
import Akun from './pages/Akun'
import ApprovedRoute from './components/ApprovedRoute'

function PrivateRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/await-approval" element={<AwaitApproval />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Dashboard />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/users"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Users />
            </ApprovedRoute>
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
            <ApprovedRoute>
              <InvoiceAdd />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/pembelian/invoice/add"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <PurchaseInvoiceAdd />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/pembelian"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Pembelian />
            </ApprovedRoute>
          </PrivateRoute>
        }
      >
        <Route path="overview" element={<PembelianOverview />} />
        <Route path="tagihan" element={<div className="p-6"><h1 className="text-2xl font-bold">Tagihan Pembelian</h1></div>} />
        <Route path="pengiriman" element={<PengirimanPembelian />} />
        <Route path="pesanan" element={<PesananPembelian />} />
        <Route path="pesanan/:id" element={<PurchaseInvoiceDetail />} />
        <Route path="invoice/edit/:id" element={<PurchaseInvoiceEdit />} />
        <Route path="penawaran" element={<div className="p-6"><h1 className="text-2xl font-bold">Penawaran Pembelian</h1></div>} />
      </Route>
      <Route
        path="/kontak"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Kontak />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ContactDetail />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/produk"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Produk />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/produk/tambah"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ProductAdd />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/debt/add"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <DebtAdd />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/receivable/add"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ReceivableAdd />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/akun"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <Akun />
            </ApprovedRoute>
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

