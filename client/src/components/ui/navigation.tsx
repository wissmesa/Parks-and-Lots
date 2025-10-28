import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import NotificationCenter from "@/components/crm/notification-center";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  
  // Debug logging
  console.log('Navigation - user:', user);
  console.log('Navigation - isAuthenticated:', isAuthenticated);
  console.log('Navigation - user role:', user?.role);
  
  // Check if user is currently on admin/manager/tenant/crm pages
  const isOnAdminPage = location.startsWith('/admin');
  const isOnManagerPage = location.startsWith('/manager');
  const isOnTenantPage = location.startsWith('/tenant');
  const isOnCrmPage = location.startsWith('/crm');

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
            <Link href="/" className="flex items-center">
              <img 
                src="/logos/MHP.svg" 
                alt="MHP Sales Manager" 
                className="h-60 w-auto object-contain"
              />
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome, {user?.fullName}
                </span>
                {user?.role === 'MHP_LORD' && (
                  <Link href="/admin">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={isOnAdminPage ? "hidden md:inline-flex" : ""}
                    >
                      Lord Panel
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
                {user?.role === 'ADMIN' && (
                  <Link href="/manager">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={isOnManagerPage ? "hidden md:inline-flex" : ""}
                    >
                      Admin Panel
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
                {/* CRM Button - visible to all except ADMIN and MANAGER */}
                {user?.role !== 'ADMIN' && user?.role !== 'MANAGER' && !isOnCrmPage && (
                  <Link href="/crm">
                    <Button 
                      variant="outline" 
                      size="sm"
                    >
                      CRM
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
                {isOnCrmPage && <NotificationCenter />}
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
