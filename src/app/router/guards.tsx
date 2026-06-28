import { Navigate, Outlet, useLocation } from "react-router-dom";
import { canAccessAdminPage } from "@/lib/permissions/policies";
import { useAppStore } from "@/lib/state/app-store";

export function AuthGuard() {
  const store = useAppStore();
  const location = useLocation();
  if (!store.initializing && !store.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function AdminGuard() {
  const store = useAppStore();
  if (!canAccessAdminPage(store.context)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
