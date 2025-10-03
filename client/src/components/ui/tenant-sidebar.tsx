import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { 
  Home, 
  CreditCard, 
  User, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

interface TenantSidebarProps {
  className?: string;
}

export function TenantSidebar({ className = "" }: TenantSidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/tenant",
      icon: Home,
      current: location === "/tenant"
    },
    {
      name: "My Information",
      href: "/tenant/info", 
      icon: User,
      current: location === "/tenant/info"
    },
    // {
    //   name: "Payments",
    //   href: "/tenant/payments",
    //   icon: CreditCard,
    //   current: location === "/tenant/payments"
    // }
  ];

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bg-primary rounded-lg p-2">
            <Home className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tenant Portal</h2>
            <p className="text-sm text-muted-foreground">Welcome, {user?.fullName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={item.current ? "default" : "ghost"}
                className="w-full justify-start h-12 px-4"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Card>
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Need Help?</p>
              <p className="text-xs text-muted-foreground">
                Contact your property manager for assistance
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Button 
          onClick={handleLogout}
          variant="outline" 
          className="w-full mt-4 justify-start"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed left-0 top-0 z-50 h-full w-80 bg-background border-r border-border transform transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col h-full">
          <SidebarContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-col lg:w-80 lg:bg-background lg:border-r lg:border-border ${className}`}>
        <SidebarContent />
      </div>
    </>
  );
}
