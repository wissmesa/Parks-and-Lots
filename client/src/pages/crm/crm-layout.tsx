import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, Building2, MessageSquare, CheckSquare } from "lucide-react";

import CrmContacts from "./crm-contacts";
import CrmContactDetail from "./crm-contact-detail";
import CrmDeals from "./crm-deals";
import CrmDealDetail from "./crm-deal-detail";
import CrmUnits from "./crm-units";
import CrmUnitDetail from "./crm-unit-detail";
import CrmMessages from "./crm-messages";
import CrmTasks from "./crm-tasks";

export default function CrmLayout() {
  const [location] = useLocation();

  const navItems = [
    { path: "/crm", exact: true, label: "Contacts", icon: Users },
    { path: "/crm/deals", label: "Deals", icon: Briefcase },
    { path: "/crm/units", label: "Units", icon: Building2 },
    { path: "/crm/messages", label: "Messages", icon: MessageSquare },
    { path: "/crm/tasks", label: "Tasks", icon: CheckSquare },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location === path;
    }
    return location.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">
      {/* Secondary Navigation Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r bg-card overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-foreground">CRM</h2>
          <p className="text-sm text-muted-foreground">Customer Relationship Management</p>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto min-w-0">
        {location === '/crm' && <CrmContacts />}
        {location.startsWith('/crm/contacts/') && <CrmContactDetail />}
        {location.startsWith('/crm/deals/') && location !== '/crm/deals' && <CrmDealDetail />}
        {location === '/crm/deals' && <CrmDeals />}
        {location.startsWith('/crm/units/') && location !== '/crm/units' && <CrmUnitDetail />}
        {location === '/crm/units' && <CrmUnits />}
        {location === '/crm/messages' && <CrmMessages />}
        {location === '/crm/tasks' && <CrmTasks />}
      </main>
    </div>
  );
}

