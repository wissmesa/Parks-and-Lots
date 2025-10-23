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
import AdminTenants from "@/pages/admin-tenants";
import AdminManagers from "@/pages/admin-managers";
import AdminBookings from "@/pages/admin-bookings";
import AdminInvites from "@/pages/admin-invites";
import AdminLoginActivity from "@/pages/admin-login-activity";
import ManagerDashboard from "@/pages/manager-dashboard";
import ManagerParks from "@/pages/manager-parks";
import ManagerLots from "@/pages/manager-lots";
import ManagerTenants from "@/pages/manager-tenants";
import ManagerBookings from "@/pages/manager-bookings";
import ManagerInvites from "@/pages/manager-invites";
import TenantPanel from "@/pages/tenant-panel";
import CrmLayout from "@/pages/crm/crm-layout";
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
          <RequireRole role="MHP_LORD"><AdminDashboard /></RequireRole>
        )} />
        <Route path="/admin/companies" component={() => (
          <RequireRole role="MHP_LORD"><AdminCompanies /></RequireRole>
        )} />
        <Route path="/admin/parks" component={() => (
          <RequireRole role="MHP_LORD"><AdminParks /></RequireRole>
        )} />
        <Route path="/admin/lots" component={() => (
          <RequireRole role="MHP_LORD"><AdminLots /></RequireRole>
        )} />
        <Route path="/admin/tenants" component={() => (
          <RequireRole role="MHP_LORD"><AdminTenants /></RequireRole>
        )} />
        <Route path="/admin/managers" component={() => (
          <RequireRole role="MHP_LORD"><AdminManagers /></RequireRole>
        )} />
        <Route path="/admin/bookings" component={() => (
          <RequireRole role="MHP_LORD"><AdminBookings /></RequireRole>
        )} />
        <Route path="/admin/invites" component={() => (
          <RequireRole role="MHP_LORD"><AdminInvites /></RequireRole>
        )} />
        <Route path="/admin/login-activity" component={() => (
          <RequireRole role="MHP_LORD"><AdminLoginActivity /></RequireRole>
        )} />
        
        {/* Protected manager routes - accessible by MANAGER, ADMIN (company admin), and MHP_LORD */}
        <Route path="/manager" component={() => (
          <RequireRole role={['MANAGER', 'ADMIN', 'MHP_LORD'] as const}><ManagerDashboard /></RequireRole>
        )} />
        <Route path="/manager/parks" component={() => (
          <RequireRole role={['MANAGER', 'ADMIN', 'MHP_LORD'] as const}><ManagerParks /></RequireRole>
        )} />
        <Route path="/manager/lots" component={() => (
          <RequireRole role={['MANAGER', 'ADMIN', 'MHP_LORD'] as const}><ManagerLots /></RequireRole>
        )} />
        <Route path="/manager/tenants" component={() => (
          <RequireRole role={['MANAGER', 'ADMIN', 'MHP_LORD'] as const}><ManagerTenants /></RequireRole>
        )} />
        <Route path="/manager/bookings" component={() => (
          <RequireRole role={['MANAGER', 'ADMIN', 'MHP_LORD'] as const}><ManagerBookings /></RequireRole>
        )} />
        <Route path="/manager/invites" component={() => (
          <RequireRole role={['ADMIN', 'MHP_LORD'] as const}><ManagerInvites /></RequireRole>
        )} />
        
        {/* Protected CRM routes - Beta: MHP_LORD only */}
        <Route path="/crm" component={() => (
          <RequireRole role="MHP_LORD"><CrmLayout /></RequireRole>
        )} />
        <Route path="/crm/:section" component={() => (
          <RequireRole role="MHP_LORD"><CrmLayout /></RequireRole>
        )} />
        <Route path="/crm/:section/:id" component={() => (
          <RequireRole role="MHP_LORD"><CrmLayout /></RequireRole>
        )} />
        
        {/* Protected TENANT routes */}
        <Route path="/tenant" component={() => (
          <RequireRole role="TENANT"><TenantPanel /></RequireRole>
        )} />
        <Route path="/tenant/info" component={() => (
          <RequireRole role="TENANT"><TenantPanel /></RequireRole>
        )} />
        <Route path="/tenant/payments" component={() => (
          <RequireRole role="TENANT"><TenantPanel /></RequireRole>
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