import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const role = localStorage.getItem('role');
  const adminToken = localStorage.getItem('token');

  // Only allow access if role is "admin" AND token exists
  if (role === 'admin' && adminToken === 'admin-token') {
    return <>{children}</>;
  }

  // Redirect to admin login
  return <Navigate to="/admin/login" replace />;
}
