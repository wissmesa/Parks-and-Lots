import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard,
  Home,
  Calendar,
  TreePine,
  UserCog
} from "lucide-react";

export function ManagerSidebar() {
  const [location] = useLocation();

  const navigationItems = [
    { href: "/manager", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/manager/parks", icon: TreePine, label: "My Parks" },
    { href: "/manager/lots", icon: Home, label: "My Lots" },
    { href: "/manager/bookings", icon: Calendar, label: "Bookings" },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <UserCog className="text-primary-foreground w-4 h-4" />
          </div>
          <span className="font-bold text-foreground">Manager Panel</span>
        </div>
        
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/manager" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`} data-testid={`nav-manager-${item.label.toLowerCase().replace(' ', '-')}`}>
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
