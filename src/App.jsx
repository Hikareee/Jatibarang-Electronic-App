import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
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
import TagihanPembelian from './pages/TagihanPembelian'
import Pengiriman from './pages/Pengiriman'
import InvoiceDetail from './pages/InvoiceDetail'
import Kontak from './pages/Kontak'
import ContactDetail from './pages/ContactDetail'
import Produk from './pages/Produk'
import ProductAdd from './pages/ProductAdd'
import ProductEdit from './pages/ProductEdit'
import DebtAdd from './pages/DebtAdd'
import ReceivableAdd from './pages/ReceivableAdd'
import Akun from './pages/Akun'
import Biaya from './pages/Biaya'
import BiayaAdd from './pages/BiayaAdd'
import BiayaDetail from './pages/BiayaDetail'
import UserProfile from './pages/UserProfile'
import AsetTetap from './pages/AsetTetap'
import Pemesanan from './pages/Pemesanan'
import PemesananAdd from './pages/PemesananAdd'
import Penawaran from './pages/Penawaran'
import AccountDetail from './pages/AccountDetail'
import AIAssistant from './pages/AIAssistant'
import Inventori from './pages/Inventori'
import GudangDetail from './pages/GudangDetail'
import Laporan from './pages/Laporan'
import Proyek from './pages/Proyek'
import ProyekDetail from './pages/ProyekDetail'
import RABCalculator from './pages/RABCalculator'
import Payroll from './pages/Payroll'
import PayrollEmployeeDetail from './pages/PayrollEmployeeDetail'
import Attendance from './pages/Attendance'
import EmployeeRequests from './pages/EmployeeRequests'
import EmployeeExpenseReportForm from './pages/EmployeeExpenseReportForm'
import EmployeeFundRequestForm from './pages/EmployeeFundRequestForm'
import UangKas from './pages/UangKas'
import ApprovedRoute from './components/ApprovedRoute'
import AdminOwnerRoute from './components/AdminOwnerRoute'
import ManagerRoute from './components/ManagerRoute'
import OwnerRoute from './components/OwnerRoute'

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
        path="/inventori"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Inventori />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventori/gudang/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <GudangDetail />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/users"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Users />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/absensi"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Attendance />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/permintaan"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <EmployeeRequests />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/permintaan/lapor-biaya"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <EmployeeExpenseReportForm />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/permintaan/dana"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <EmployeeFundRequestForm />
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/uang-kas"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <AdminOwnerRoute>
                <UangKas />
              </AdminOwnerRoute>
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
        <Route path="tagihan/:id" element={<InvoiceDetail />} />
        <Route path="pengiriman" element={<Pengiriman />} />
        <Route path="pemesanan" element={<Pemesanan />} />
        <Route 
          path="pemesanan/tambah" 
          element={
            <ApprovedRoute>
              <PemesananAdd />
            </ApprovedRoute>
          } 
        />
        <Route path="penawaran" element={<Penawaran />} />
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
        <Route path="tagihan" element={<TagihanPembelian />} />
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
              <ManagerRoute>
                <Kontak />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <ContactDetail />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/produk"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Produk />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/produk/tambah"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <ProductAdd />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/produk/:id/edit"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <ProductEdit />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/debt/add"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <DebtAdd />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/kontak/receivable/add"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <ReceivableAdd />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/akun"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Akun />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/biaya"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Biaya />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/biaya/tambah"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <BiayaAdd />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/biaya/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <BiayaDetail />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/proyek"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Proyek />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/proyek/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <ProyekDetail />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/laporan"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <Laporan />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/profil"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <UserProfile />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/rab-calculator"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <RABCalculator />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/aset-tetap"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <AsetTetap />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/account/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <ManagerRoute>
                <AccountDetail />
              </ManagerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/ai-assistant"
        element={
          <PrivateRoute>
            <AIAssistant />
          </PrivateRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <OwnerRoute>
                <Payroll />
              </OwnerRoute>
            </ApprovedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/payroll/pegawai/:id"
        element={
          <PrivateRoute>
            <ApprovedRoute>
              <OwnerRoute>
                <PayrollEmployeeDetail />
              </OwnerRoute>
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
      <DarkModeProvider>
        <LanguageProvider>
          <Router>
            <AppRoutes />
          </Router>
        </LanguageProvider>
      </DarkModeProvider>
    </AuthProvider>
  )
}

export default App

