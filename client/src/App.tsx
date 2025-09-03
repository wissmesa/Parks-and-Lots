import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/ui/navigation";
import { useAuth } from "@/hooks/use-auth";

// Import pages
import Properties from "@/pages/properties";
import ParkDetail from "@/pages/park-detail";
import LotDetail from "@/pages/lot-detail";
import Login from "@/pages/login";
import AcceptInvite from "@/pages/accept-invite";
import AdminDashboard from "@/pages/admin-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import ManagerLots from "@/pages/manager-lots";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, user } = useAuth();

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
        <Route path="/accept-invite" component={AcceptInvite} />
        
        {/* Protected admin routes */}
        {isAuthenticated && user?.role === 'ADMIN' && (
          <Route path="/admin" component={AdminDashboard} />
        )}
        
        {/* Protected manager routes */}
        {isAuthenticated && user?.role === 'MANAGER' && (
          <>
            <Route path="/manager" component={ManagerDashboard} />
            <Route path="/manager/lots" component={ManagerLots} />
          </>
        )}
        
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
