import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from '@components/layout/AppShell'
import LoadingState from '@components/ui/LoadingState'
import SetupWizard from '@features/setup/SetupWizard'

import Login from '@features/auth/Login'
import { useAuthStore } from '@store/auth.store'

// Lazy load all feature pages for optimal startup
const Dashboard = lazy(() => import('@features/dashboard/Dashboard'))
const AdminDashboard = lazy(() => import('@features/admin/AdminDashboard'))
const InvoiceList = lazy(() => import('@features/invoices/InvoiceList'))
const InvoiceEditor = lazy(() => import('@features/invoices/InvoiceEditor'))
const ChallanList = lazy(() => import('@features/challans/ChallanList'))
const ChallanEditor = lazy(() => import('@features/challans/ChallanEditor'))
const Customers = lazy(() => import('@features/customers/Customers'))
const CustomerDetail = lazy(() => import('@features/customers/CustomerDetail'))
const CustomerEditor = lazy(() => import('@features/customers/CustomerEditor'))
const Suppliers = lazy(() => import('@features/suppliers/Suppliers'))
const SupplierDetail = lazy(() => import('@features/suppliers/SupplierDetail'))
const SupplierEditor = lazy(() => import('@features/suppliers/SupplierEditor'))
const Products = lazy(() => import('@features/products/Products'))
const ProductDetail = lazy(() => import('@features/products/ProductDetail'))
const ProductEditor = lazy(() => import('@features/products/ProductEditor'))
const Inventory = lazy(() => import('@features/inventory/Inventory'))
const StockMovements = lazy(() => import('@features/inventory/StockMovements'))
const PurchaseList = lazy(() => import('@features/purchases/PurchaseList'))
const PurchaseEditor = lazy(() => import('@features/purchases/PurchaseEditor'))
const ReturnsList = lazy(() => import('@features/returns/ReturnsList'))
const Payments = lazy(() => import('@features/payments/Payments'))
const CustomerLedger = lazy(() => import('@features/ledger/CustomerLedger'))
const SupplierLedger = lazy(() => import('@features/ledger/SupplierLedger'))
const Reports = lazy(() => import('@features/reports/Reports'))
const GSTFilingReport = lazy(() => import('@features/reports/GSTFilingReport'))
const MonthlyInventoryReport = lazy(() => import('@features/reports/MonthlyInventoryReport'))
const ProductAnalytics = lazy(() => import('@features/analytics/ProductAnalytics'))
const BusinessAnalytics = lazy(() => import('@features/analytics/BusinessAnalytics'))
const BusinessProfile = lazy(() => import('@features/settings/BusinessProfile'))
const InvoiceSettings = lazy(() => import('@features/settings/InvoiceSettings'))
const EditInvoiceDesigner = lazy(() => import('@features/settings/EditInvoiceDesigner'))
const BackupSettings = lazy(() => import('@features/settings/BackupSettings'))
const AppSettings = lazy(() => import('@features/settings/AppSettings'))
const AuditLog = lazy(() => import('@features/audit/AuditLog'))

function PageLoader() {
  return <LoadingState message="Loading..." fullScreen />
}

function wrap(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

const ActivateSoftware = lazy(() => import('@features/licensing/ActivateSoftware'))

export const router = createBrowserRouter([
  {
    path: '/activate',
    element: wrap(ActivateSoftware),
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        {wrap(AdminDashboard)}
      </AdminRoute>
    ),
  },
  {
    path: '/setup',
    element: <SetupWizard />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: wrap(Dashboard) },

      // Invoices
      { path: 'invoices', element: wrap(InvoiceList) },
      { path: 'invoices/new', element: wrap(InvoiceEditor) },
      { path: 'invoices/:id/edit', element: wrap(InvoiceEditor) },
      { path: 'invoices/:id', element: wrap(InvoiceEditor) },

      // Delivery Challans
      { path: 'challans', element: wrap(ChallanList) },
      { path: 'challans/new', element: wrap(ChallanEditor) },
      { path: 'challans/:id/edit', element: wrap(ChallanEditor) },
      { path: 'challans/:id', element: wrap(ChallanEditor) },

      // Customers
      { path: 'customers', element: wrap(Customers) },
      { path: 'customers/new', element: wrap(CustomerEditor) },
      { path: 'customers/:id/edit', element: wrap(CustomerEditor) },
      { path: 'customers/:id', element: wrap(CustomerDetail) },

      // Suppliers
      { path: 'suppliers', element: wrap(Suppliers) },
      { path: 'suppliers/new', element: wrap(SupplierEditor) },
      { path: 'suppliers/:id/edit', element: wrap(SupplierEditor) },
      { path: 'suppliers/:id', element: wrap(SupplierDetail) },

      // Products
      { path: 'products', element: wrap(Products) },
      { path: 'products/new', element: wrap(ProductEditor) },
      { path: 'products/:id/edit', element: wrap(ProductEditor) },
      { path: 'products/:id', element: wrap(ProductDetail) },

      // Inventory
      { path: 'inventory', element: wrap(Inventory) },
      { path: 'inventory/movements', element: wrap(StockMovements) },

      // Purchases
      { path: 'purchases', element: wrap(PurchaseList) },
      { path: 'purchases/new', element: wrap(PurchaseEditor) },
      { path: 'purchases/:id', element: wrap(PurchaseEditor) },

      // Returns & Notes
      { path: 'returns', element: wrap(ReturnsList) },

      // Accounts
      { path: 'payments', element: wrap(Payments) },
      { path: 'ledger/customers', element: wrap(CustomerLedger) },
      { path: 'ledger/suppliers', element: wrap(SupplierLedger) },

      // Analytics & Reports
      { path: 'reports', element: wrap(Reports) },
      { path: 'reports/gst-filing', element: wrap(GSTFilingReport) },
      { path: 'reports/monthly-inventory', element: wrap(MonthlyInventoryReport) },
      { path: 'analytics/products', element: wrap(ProductAnalytics) },
      { path: 'analytics/business', element: wrap(BusinessAnalytics) },

      // Settings
      { path: 'settings/profile', element: wrap(BusinessProfile) },
      { path: 'settings/edit-invoice', element: wrap(EditInvoiceDesigner) },
      { path: 'settings/invoice', element: wrap(InvoiceSettings) },
      { path: 'settings/backup', element: wrap(BackupSettings) },
      { path: 'settings/app', element: wrap(AppSettings) },
      { path: 'audit', element: wrap(AuditLog) },
    ],
  },
])
