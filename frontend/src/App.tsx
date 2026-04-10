import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import OrganizerRoute from './components/OrganizerRoute';
import AdminRoute from './components/AdminRoute';
import OrganizerDashboard from './pages/OrganizerDashboard';
import OrganizerEventDetails from './pages/OrganizerEventDetails';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Admin Routes - Before other routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
        
        {/* Organizer Routes */}
        <Route 
          path="/organizer/dashboard" 
          element={
            <OrganizerRoute>
              <OrganizerDashboard />
            </OrganizerRoute>
          } 
        />
        <Route 
          path="/organizer/events/:id" 
          element={
            <OrganizerRoute>
              <OrganizerEventDetails />
            </OrganizerRoute>
          } 
        />
        
        {/* Protected Dashboard Routes */}
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all to Landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
