import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard,
  Building,
  TreePine,
  Home,
  Users,
  Calendar,
  UserPlus,
  Shield
} from "lucide-react";

export function AdminSidebar() {
  const [location] = useLocation();

  const navigationItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/companies", icon: Building, label: "Companies" },
    { href: "/admin/parks", icon: TreePine, label: "Parks" },
    { href: "/admin/lots", icon: Home, label: "Lots" },
    { href: "/admin/managers", icon: Users, label: "Managers" },
    { href: "/admin/bookings", icon: Calendar, label: "Bookings" },
    { href: "/admin/invites", icon: UserPlus, label: "Invites" },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="text-primary-foreground w-4 h-4" />
          </div>
          <span className="font-bold text-foreground">Admin Panel</span>
        </div>
        
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`} data-testid={`nav-admin-${item.label.toLowerCase()}`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
