import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/ui/navigation";
import { RequireRole } from "@/components/RequireRole";

// Import pages
import Properties from "@/pages/properties";
import ParkDetail from "@/pages/park-detail";
import LotDetail from "@/pages/lot-detail";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AcceptInvite from "@/pages/accept-invite";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminCompanies from "@/pages/admin-companies";
import AdminParks from "@/pages/admin-parks";
import AdminLots from "@/pages/admin-lots";
import AdminManagers from "@/pages/admin-managers";
import AdminBookings from "@/pages/admin-bookings";
import AdminInvites from "@/pages/admin-invites";
import ManagerDashboard from "@/pages/manager-dashboard";
import ManagerParks from "@/pages/manager-parks";
import ManagerLots from "@/pages/manager-lots";
import ManagerBookings from "@/pages/manager-bookings";
import ManagerOwnerTenants from "@/pages/manager-owner-tenants";
import OwnerTenantDashboard from "@/pages/owner-tenant-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Properties} />
        <Route path="/properties" component={() => { window.location.href = '/'; return null; }} />
        <Route path="/parks" component={() => { window.location.href = '/'; return null; }} />
        <Route path="/lots" component={() => { window.location.href = '/'; return null; }} />
        <Route path="/parks/:id" component={ParkDetail} />
        <Route path="/lots/:id" component={LotDetail} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/accept-invite" component={AcceptInvite} />
        
        {/* Protected admin routes */}
        <Route path="/admin" component={() => (
          <RequireRole role="ADMIN"><AdminDashboard /></RequireRole>
        )} />
        <Route path="/admin/companies" component={() => (
          <RequireRole role="ADMIN"><AdminCompanies /></RequireRole>
        )} />
        <Route path="/admin/parks" component={() => (
          <RequireRole role="ADMIN"><AdminParks /></RequireRole>
        )} />
        <Route path="/admin/lots" component={() => (
          <RequireRole role="ADMIN"><AdminLots /></RequireRole>
        )} />
        <Route path="/admin/managers" component={() => (
          <RequireRole role="ADMIN"><AdminManagers /></RequireRole>
        )} />
        <Route path="/admin/bookings" component={() => (
          <RequireRole role="ADMIN"><AdminBookings /></RequireRole>
        )} />
        <Route path="/admin/invites" component={() => (
          <RequireRole role="ADMIN"><AdminInvites /></RequireRole>
        )} />
        
        {/* Protected manager routes */}
        <Route path="/manager" component={() => (
          <RequireRole role="MANAGER"><ManagerDashboard /></RequireRole>
        )} />
        <Route path="/manager/parks" component={() => (
          <RequireRole role="MANAGER"><ManagerParks /></RequireRole>
        )} />
        <Route path="/manager/lots" component={() => (
          <RequireRole role="MANAGER"><ManagerLots /></RequireRole>
        )} />
        <Route path="/manager/bookings" component={() => (
          <RequireRole role="MANAGER"><ManagerBookings /></RequireRole>
        )} />
        <Route path="/manager/owner-tenants" component={() => (
          <RequireRole role="MANAGER"><ManagerOwnerTenants /></RequireRole>
        )} />
        
        {/* Protected owner/tenant routes */}
        <Route path="/owner-tenant" component={() => (
          <RequireRole role="OWNER_TENANT"><OwnerTenantDashboard /></RequireRole>
        )} />
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
