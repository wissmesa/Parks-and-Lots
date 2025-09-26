import { useAuth } from "@/hooks/use-auth";
import { TenantSidebar } from "@/components/ui/tenant-sidebar";
import { useLocation } from "wouter";
import TenantDashboard from "./tenant-dashboard";
import TenantInfo from "@/pages/tenant-info";
import TenantPayments from "@/pages/tenant-payments";

export default function TenantPanel() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Redirect non-tenants
  if (user && user.role !== 'TENANT') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">This area is only accessible to tenant users.</p>
        </div>
      </div>
    );
  }

  // Show loading state while user data is loading
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Render the appropriate page based on location
  const renderContent = () => {
    switch (location) {
      case '/tenant/info':
        return <TenantInfo />;
      case '/tenant/payments':
        return <TenantPayments />;
      case '/tenant':
      default:
        return <TenantDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar */}
        <TenantSidebar />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content area */}
          <main className="flex-1 overflow-y-auto lg:ml-0">
            <div className="lg:pl-4 pt-16 lg:pt-0">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
