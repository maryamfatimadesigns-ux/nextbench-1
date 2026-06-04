import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import PageLoader from './PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireVerified?: boolean;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireVerified = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireVerified && (!userData || !userData.verified)) {
    return <Navigate to="/verification" replace />;
  }

  if (requireAdmin && (!userData || !userData.isAdmin)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
