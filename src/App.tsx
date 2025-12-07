// Navy & Sea Blue Professional Design System
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import CustomerCarePage from './pages/CustomerCarePage';
import CustomerDashboard from './pages/CustomerDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminManagement from './pages/AdminManagement';
import AdminSettings from './pages/AdminSettings';
import TicketDetailPage from './pages/TicketDetailPage';
import ServiceHistoryPage from './pages/ServiceHistoryPage';
import TechnicianServiceHistoryPage from './pages/TechnicianServiceHistoryPage';
import InventoryPage from './pages/InventoryPage';
import CustomerManagement from './pages/CustomerManagement';
import SubscriptionManagement from './pages/SubscriptionManagement';
import SubscriptionVisitsPage from './pages/SubscriptionVisitsPage';
import CustomerSubscriptionVisitsPage from './pages/CustomerSubscriptionVisitsPage';
import AdminVisitsPage from './pages/AdminVisitsPage';
import DeleteAllCustomers from './pages/DeleteAllCustomers';
import AppDownloadPage from './pages/AppDownloadPage';
import QRCodePage from './pages/QRCodePage';

const queryClient = new QueryClient();

// Initialize background notifications on app start
function AppInitializer() {
  useEffect(() => {
    // Load and initialize background notifications dynamically
    // This prevents build errors if the plugin isn't installed
    import('./utils/backgroundNotifications')
      .then(module => {
        if (module.initializeBackgroundNotifications) {
          module.initializeBackgroundNotifications().catch(err => {
            console.warn('Background notifications not available:', err);
          });
        }
      })
      .catch(err => {
        // Module not available or has errors - this is OK
        console.warn('Background notifications module not available');
      });
  }, []);

  return null;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">Setting up your account...</h2>
          <p className="text-slate-400 text-sm mb-4">
            We're creating your profile. This usually takes just a moment.
          </p>
          <p className="text-slate-500 text-xs">
            If this takes too long, please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (user && profile) {
    if (profile.role === 'customer') {
      return (
        <Routes>
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer" element={<CustomerDashboard />} />
          <Route path="/ticket/:id" element={<TicketDetailPage />} />
          <Route path="/service-history" element={<ServiceHistoryPage />} />
          <Route path="/subscription-visits" element={<CustomerSubscriptionVisitsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      );
    } else if (profile.role === 'technician') {
      return (
        <Routes>
          <Route path="/dashboard" element={<TechnicianDashboard />} />
          <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
          <Route path="/subscription-visits" element={<SubscriptionVisitsPage />} />
          <Route path="/ticket/:id" element={<TicketDetailPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/service-history" element={<ServiceHistoryPage />} />
          <Route path="/technician-service-history" element={<TechnicianServiceHistoryPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      );
    } else if (profile.role === 'admin') {
      return (
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/management" element={<AdminManagement />} />
          <Route path="/admin/customers" element={<CustomerManagement />} />
          <Route path="/admin/subscriptions" element={<SubscriptionManagement />} />
          <Route path="/admin/visits" element={<AdminVisitsPage />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/delete-all-customers" element={<DeleteAllCustomers />} />
          <Route path="/ticket/:id" element={<TicketDetailPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/service-history" element={<ServiceHistoryPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      );
    }
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/customer-care" element={<CustomerCarePage />} />
      <Route path="/download-app" element={<AppDownloadPage />} />
      <Route path="/qr-code" element={<QRCodePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AppInitializer />
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
