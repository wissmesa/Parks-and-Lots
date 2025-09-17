import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { 
  UserPlus,
  Building,
  TreePine,
  Home,
  Users,
  CalendarCheck,
  Calendar
} from "lucide-react";
import { useState, useEffect } from "react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedParkForInvite, setSelectedParkForInvite] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      window.location.href = '/';
    }
  }, [user]);

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: parksData } = useQuery({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: recentBookings } = useQuery({
    queryKey: ["/api/admin/recent-bookings"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: managers } = useQuery({
    queryKey: ["/api/admin/managers"],
    enabled: user?.role === 'ADMIN',
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; parkId?: string }) => {
      const response = await apiRequest("POST", "/api/auth/invites", {
        email: data.email,
        role: "MANAGER"
      });
      
      // If park selected, assign manager after invite creation
      if (data.parkId) {
        // This would need to be handled in the accept-invite flow
        // For now, we'll just create the invite
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invite Sent",
        description: "Manager invitation has been sent successfully.",
      });
      setInviteEmail("");
      setSelectedParkForInvite("");
      setIsInviteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managers"] });
    },
    onError: (error) => {
      toast({
        title: "Invite Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    await inviteMutation.mutateAsync({
      email: inviteEmail,
      parkId: selectedParkForInvite || undefined
    });
  };

  const parks = Array.isArray(parksData?.parks) ? parksData.parks : Array.isArray(parksData) ? parksData : [];
  const dashboardStats = {
    totalParks: stats?.totalParks ?? parks.length,
    activeLots: stats?.activeLots ?? 0,
    monthlyBookings: stats?.monthlyBookings ?? 0,
    activeManagers: stats?.activeManagers ?? 0
  };

  if (user?.role !== 'ADMIN') {
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
        <AdminSidebar />

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Manage your parks and lots platform</p>
            </div>
            
            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-invite-manager">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Manager
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New Manager</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="manager@email.com"
                      required
                      data-testid="input-invite-email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="park">Assign to Park (Optional)</Label>
                    <Select value={selectedParkForInvite} onValueChange={setSelectedParkForInvite}>
                      <SelectTrigger data-testid="select-invite-park">
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No assignment</SelectItem>
                        {parks.map((park: any) => (
                          <SelectItem key={park.id} value={park.id}>
                            {park.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      An invitation email will be sent with setup instructions
                    </p>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                      {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Parks</p>
                    <p className="text-2xl font-bold text-foreground">{dashboardStats.totalParks}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TreePine className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Lots</p>
                    <p className="text-2xl font-bold text-foreground">{dashboardStats.activeLots}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Home className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">This Month's Bookings</p>
                    <p className="text-2xl font-bold text-foreground">{dashboardStats.monthlyBookings}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CalendarCheck className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Managers</p>
                    <p className="text-2xl font-bold text-foreground">{dashboardStats.activeManagers}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Bookings */}
            <Card>
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Recent Bookings</h3>
                  <Button variant="ghost" size="sm" onClick={() => setLocation('/admin/bookings')} data-testid="button-view-all-bookings">
                    View All
                  </Button>
                </div>
              </div>
              <CardContent className="p-6">
                {!recentBookings || !Array.isArray(recentBookings) || recentBookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent bookings</p>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(recentBookings) && recentBookings.map((booking: any) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{booking.clientName}</div>
                          <div className="text-xs text-muted-foreground">{booking.lotName}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(booking.startDt).toLocaleDateString()} at {new Date(booking.startDt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <Badge variant={
                          booking.status === 'SCHEDULED' ? 'default' :
                          booking.status === 'COMPLETED' ? 'secondary' : 'destructive'
                        }>
                          {booking.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manager Overview */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Manager Overview</h3>
              </div>
              <CardContent className="p-6">
                {!managers || !Array.isArray(managers) || managers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No managers assigned</p>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(managers) && managers.map((manager: any) => (
                      <div key={manager.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-primary-foreground text-sm font-medium">
                              {manager.fullName?.charAt(0) || 'M'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{manager.fullName}</div>
                            <div className="text-xs text-muted-foreground">{manager.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-accent">0</div>
                          <div className="text-xs text-muted-foreground">showings</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
