import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const OrganizerRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Prioritize localStorage role (for intent-based organizer setup)
  if (role === 'organizer') {
    return <>{children}</>;
  }

  // Fallback to JWT role
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.role === 'organizer' || decoded.role === 'admin') {
      return <>{children}</>;
    }
  } catch (err) {
    console.error('Invalid token');
  }

  // Not an organizer, redirect to dashboard
  return <Navigate to="/dashboard" replace />;
};

export default OrganizerRoute;
