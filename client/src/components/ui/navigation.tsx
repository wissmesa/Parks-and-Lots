import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  
  // Debug logging
  console.log('Navigation - user:', user);
  console.log('Navigation - isAuthenticated:', isAuthenticated);
  console.log('Navigation - user role:', user?.role);
  
  // Check if user is currently on admin/manager/tenant pages
  const isOnAdminPage = location.startsWith('/admin');
  const isOnManagerPage = location.startsWith('/manager');
  const isOnTenantPage = location.startsWith('/tenant');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };


  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MapPin className="text-primary-foreground h-4 w-4" />
              </div>
              <span className="text-xl font-bold text-foreground">Parks & Lots</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome, {user?.fullName}
                </span>
                {user?.role === 'ADMIN' && (
                  <Link href="/admin">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={isOnAdminPage ? "hidden md:inline-flex" : ""}
                    >
                      Admin Panel
                    </Button>
                  </Link>
                )}
                {user?.role === 'MANAGER' && (
                  <Link href="/manager">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={isOnManagerPage ? "hidden md:inline-flex" : ""}
                    >
                      Manager Panel
                    </Button>
                  </Link>
                )}
                {user?.role === 'COMPANY_MANAGER' && (
                  <Link href="/manager">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={isOnManagerPage ? "hidden md:inline-flex" : ""}
                    >
                      My Manager Panel
                    </Button>
                  </Link>
                )}
                {user?.role === 'TENANT' && !isOnTenantPage && (
                  <Link href="/tenant">
                    <Button 
                      variant="outline" 
                      size="sm"
                    >
                      Tenant Portal
                    </Button>
                  </Link>
                )}
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  size="sm" 
                  data-testid="button-sign-out"
                  className={(isOnAdminPage || isOnManagerPage || isOnTenantPage) ? "hidden md:inline-flex" : ""}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button data-testid="button-login">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
