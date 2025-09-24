import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { CalendarConnection } from "@/components/ui/calendar-connection";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar,
  Home,
  Phone,
  ExternalLink,
  MapPin,
  Building
} from "lucide-react";
import { useEffect } from "react";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Redirect if not manager
  useEffect(() => {
    if (user && user.role !== 'MANAGER') {
      window.location.href = '/';
    }
  }, [user]);

  const { data: assignments } = useQuery({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: todayShowings } = useQuery({
    queryKey: ["/api/manager/showings/today"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/manager/stats"],
    enabled: user?.role === 'MANAGER',
  });


  const managerStats = stats as { todayShowings: number; availableLots: number; parkCount: number; totalLots: number } || {
    todayShowings: 0,
    availableLots: 0,
    parkCount: 0,
    totalLots: 0
  };
  
  // Type-safe access to arrays
  const assignedParksArray = Array.isArray(assignments) ? assignments : [];
  const showingsArray = Array.isArray(todayShowings) ? todayShowings : [];


  if (user?.role !== 'MANAGER') {
    return (
      <div className="flex items-center justify-center py-16">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <ManagerSidebar />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
          {/* Manager Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Welcome back, {user.fullName?.split(' ')[0] || 'Manager'}
              </h1>
              <p className="text-muted-foreground">
                Managing {assignedParksArray.length > 0 ? assignedParksArray.map((a: any) => a.parkName).join(', ') : 'No parks assigned'}
              </p>
            </div>
            
          </div>

          {/* Calendar Connection */}
          <div className="mb-8">
            <CalendarConnection />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Showings</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-todays-showings">{managerStats.todayShowings}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">My Parks</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-my-parks">{managerStats.parkCount}</p>
                  </div>
                  <MapPin className="w-8 h-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">My Lots</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-my-lots">{managerStats.totalLots}</p>
                  </div>
                  <Building className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Visible Lots</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-visible-lots">{managerStats.availableLots}</p>
                  </div>
                  <Home className="w-8 h-8 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Schedule */}
          <Card className="mb-8">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Today's Schedule</h3>
                <span className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            </div>
            <CardContent className="p-6">
              {showingsArray.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No showings scheduled for today</p>
              ) : (
                <div className="space-y-4">
                  {showingsArray.map((showing: any) => (
                    <div key={showing.id} className="grid grid-cols-12 gap-4 p-4 bg-muted rounded-lg">
                      {/* Time Section */}
                      <div className="col-span-3 text-center">
                        <div className="text-lg font-bold text-foreground">
                          {new Date(showing.startDt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-muted-foreground">30 min</div>
                      </div>
                      
                      {/* Client Info */}
                      <div className="col-span-4">
                        <div className="font-medium text-base">{showing.clientName}</div>
                        <div className="text-sm text-muted-foreground mt-1">{showing.lotName || `Lot ${showing.lotId}`}</div>
                      </div>
                      
                      {/* Contact Info */}
                      <div className="col-span-3 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{showing.clientPhone}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2 flex justify-end">
                        {showing.calendarHtmlLink && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={showing.calendarHtmlLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
