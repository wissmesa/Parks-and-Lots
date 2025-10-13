import { Link, useLocation } from "wouter";
import { useState } from "react";
import { 
  LayoutDashboard,
  Home,
  Calendar,
  TreePine,
  UserCog,
  Menu,
  X,
  LogOut,
  Shield,
  Users,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

export function ManagerSidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const isCompanyManager = user?.role === 'COMPANY_MANAGER';
  const isTammie = user?.role === 'COMPANY_MANAGER' && user?.fullName === 'Tammie';
  const basePath = '/manager';
  
  const navigationItems = [
    { href: basePath, icon: LayoutDashboard, label: "Dashboard" },
    { href: `${basePath}/parks`, icon: TreePine, label: isCompanyManager ? "My Parks" : "My Parks" },
    { href: `${basePath}/lots`, icon: Home, label: isCompanyManager ? "My Lots" : "My Lots" },
    { href: `${basePath}/tenants`, icon: Users, label: isCompanyManager ? "My Tenants" : "My Tenants" },
    { href: `${basePath}/bookings`, icon: Calendar, label: "Bookings" },
    ...(isCompanyManager ? [{ href: `${basePath}/invites`, icon: UserPlus, label: "Manager Invites" }] : []),
  ];

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-8">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <UserCog className="text-primary-foreground w-4 h-4" />
        </div>
        <span className="font-bold text-foreground">
          {isCompanyManager ? "Company Manager Panel" : "Manager Panel"}
        </span>
      </div>
      
      <nav className="space-y-2 flex-1">
        {navigationItems.map((item) => {
          const isActive = location === item.href || (item.href !== basePath && location.startsWith(item.href));
          const Icon = item.icon;
          const isParksOption = item.href === `${basePath}/parks`;
          
          // For Tammie, only show My Parks option, others show "Coming Soon"
          if (isTammie && !isParksOption) {
            return (
              <div key={item.href} className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground cursor-not-allowed">
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground/60 ml-auto font-light">Coming Soon</span>
              </div>
            );
          }
          
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`} 
                data-testid={`nav-manager-${item.label.toLowerCase().replace(' ', '-')}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Mobile-only user actions */}
      {isMobile && (
        <div className="border-t pt-4 mt-4 space-y-2">
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Welcome, {user?.fullName}
          </div>
          <Link href="/">
            <div 
              className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <Shield className="w-5 h-5" />
              <span>Public Site</span>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button - positioned on right */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Manager Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 bg-card border-r border-border min-h-screen">
        <SidebarContent isMobile={false} />
      </aside>
    </>
  );
}
