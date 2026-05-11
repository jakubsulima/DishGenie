import { useLocation } from "react-router-dom";
import { useUser } from "../context/context";
import { renderRouteShell } from "../lib/routeShell";

export const RouteShell = () => {
  const location = useLocation();
  const { user, loading } = useUser();

  return renderRouteShell({
    pathname: location.pathname,
    routeState: location.state as Record<string, unknown> | null,
    authResolved: !loading,
    isAuthenticated: Boolean(user),
  });
};
