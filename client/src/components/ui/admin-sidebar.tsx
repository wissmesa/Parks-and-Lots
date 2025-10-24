import { Link, useLocation } from "wouter";
import { useState } from "react";
import { 
  LayoutDashboard,
  Building,
  TreePine,
  Home,
  Users,
  Calendar,
  UserPlus,
  Shield,
  Menu,
  X,
  LogOut,
  Activity,
  Briefcase,
  UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

export function AdminSidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const navigationItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/companies", icon: Building, label: "Companies" },
    { href: "/admin/parks", icon: TreePine, label: "Parks" },
    { href: "/admin/lots", icon: Home, label: "Lots" },
    { href: "/admin/tenants", icon: Users, label: "Tenants" },
    { href: "/admin/managers", icon: Shield, label: "Managers" },
    { href: "/admin/bookings", icon: Calendar, label: "Bookings" },
    { href: "/admin/invites", icon: UserPlus, label: "Invites" },
    { href: "/admin/login-activity", icon: Activity, label: "Login Activity" },
    { href: "/admin/my-info", icon: UserCircle, label: "My Info" },
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
        <img 
          src="/logos/icon.png" 
          alt="Icon" 
          className="w-12 h-12 object-contain"
        />
        <span className="font-bold text-foreground">Lord Panel</span>
      </div>
      
      <nav className="space-y-2 flex-1">
        {navigationItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`} 
                data-testid={`nav-admin-${item.label.toLowerCase()}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* CRM Section - Only for MHP_LORD */}
        {user?.role === 'MHP_LORD' && (
          <div className="pt-4 mt-4 border-t border-border">
            <Link href="/crm">
              <div
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                  location.startsWith('/crm')
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-purple-100 hover:shadow-md'
                }`}
                data-testid="nav-crm"
                onClick={() => setIsOpen(false)}
              >
                <Briefcase className="w-5 h-5" />
                <span className="font-semibold">CRM</span>
              </div>
            </Link>
          </div>
        )}
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
              <SheetTitle>Admin Navigation</SheetTitle>
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
