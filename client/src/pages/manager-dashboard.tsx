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
  Clock,
  Phone,
  Check,
  X,
  ExternalLink
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


  const managerStats = stats || {
    todayShowings: 0,
    availableLots: 0,
    pendingRequests: 0
  };

  const assignedParks = assignments || [];
  const showings = todayShowings || [];

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
        <main className="flex-1 p-8">
          {/* Manager Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user.fullName?.split(' ')[0] || 'Manager'}
              </h1>
              <p className="text-muted-foreground">
                Managing {assignedParks.length > 0 ? assignedParks.map((a: any) => a.parkName).join(', ') : 'No parks assigned'}
              </p>
            </div>
            
          </div>

          {/* Calendar Connection */}
          <div className="mb-8">
            <CalendarConnection />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Showings</p>
                    <p className="text-2xl font-bold text-foreground">{managerStats.todayShowings}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Lots</p>
                    <p className="text-2xl font-bold text-foreground">{managerStats.availableLots}</p>
                  </div>
                  <Home className="w-8 h-8 text-accent" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Requests</p>
                    <p className="text-2xl font-bold text-foreground">{managerStats.pendingRequests}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-500" />
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
              {showings.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No showings scheduled for today</p>
              ) : (
                <div className="space-y-4">
                  {showings.map((showing: any) => (
                    <div key={showing.id} className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground">
                          {new Date(showing.startDt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-muted-foreground">30 min</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{showing.clientName}</div>
                        <div className="text-xs text-muted-foreground">{showing.lotName || `Lot ${showing.lotId}`}</div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {showing.clientPhone}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="ghost" className="text-accent hover:text-accent/80" data-testid={`button-complete-showing-${showing.id}`}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/80" data-testid={`button-cancel-showing-${showing.id}`}>
                          <X className="w-4 h-4" />
                        </Button>
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
