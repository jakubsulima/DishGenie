import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { renderRouteShell } from "../lib/routeShell";
import { useUser } from "../context/context";

interface RouteGuardProps {
  children: ReactNode;
}

interface ProtectedRouteProps extends RouteGuardProps {
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return renderRouteShell({
      pathname: location.pathname,
      routeState: location.state as Record<string, unknown> | null,
    });
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAdmin && user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const GuestRoute = ({ children }: RouteGuardProps) => {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return renderRouteShell({
      pathname: location.pathname,
      routeState: location.state as Record<string, unknown> | null,
    });
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
