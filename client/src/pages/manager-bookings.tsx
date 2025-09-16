import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, MapPin, User, Search, X, CheckCircle, XCircle, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Showing {
  id: string;
  startDt: string;
  endDt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED';
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  notes?: string;
  lot: {
    id: string;
    nameOrNumber: string;
    park: {
      id: string;
      name: string;
    };
  };
}

interface Assignment {
  id: string;
  userId: string;
  parkId: string;
  userName: string;
  userEmail: string;
  parkName: string;
}

interface ManagerStats {
  todayShowings: number;
  thisWeekShowings: number;
  scheduledCount: number;
  completedCount: number;
  cancelledCount: number;
  availableLots: number;
  parkCount: number;
  totalLots: number;
}

export default function ManagerBookings() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [parkFilter, setParkFilter] = useState<string>("all");
  const { toast } = useToast();

  // Redirect if not manager
  if (user?.role !== 'MANAGER') {
    window.location.href = '/';
    return null;
  }

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: todayShowings } = useQuery<Showing[]>({
    queryKey: ["/api/manager/showings/today"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: stats } = useQuery<ManagerStats>({
    queryKey: ["/api/manager/stats"],
    enabled: user?.role === 'MANAGER',
  });

  // Mutation to cancel a showing
  const cancelShowingMutation = useMutation({
    mutationFn: async (showingId: string) => {
      return apiRequest('PATCH', `/api/showings/${showingId}`, { status: 'CANCELED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/stats"] });
      toast({
        title: "Meeting Cancelled",
        description: "The showing has been successfully cancelled and removed from the calendar.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed", 
        description: error?.message || "Failed to cancel the showing. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Mutation to complete a showing
  const completeShowingMutation = useMutation({
    mutationFn: async (showingId: string) => {
      return apiRequest('PATCH', `/api/showings/${showingId}`, { status: 'COMPLETED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/stats"] });
      toast({
        title: "Meeting Completed",
        description: "The showing has been marked as completed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Completion Failed", 
        description: error?.message || "Failed to complete the showing. Please try again.",
        variant: "destructive",
      });
    }
  });

  // For this implementation, we'll show today's showings
  // In a real app, you might want to add an endpoint for all manager showings
  const showings = todayShowings || [];

  const filteredShowings = showings.filter(showing => {
    const matchesSearch = 
      showing.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      showing.lot?.nameOrNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      showing.lot?.park?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || showing.status === statusFilter;
    const matchesPark = parkFilter === "all" || showing.lot?.park?.id === parkFilter;
    
    return matchesSearch && matchesStatus && matchesPark;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'secondary';
      case 'CONFIRMED': return 'default';
      case 'COMPLETED': return 'outline';
      case 'CANCELED': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, 'MMM dd, yyyy'),
      time: format(date, 'h:mm a')
    };
  };

  return (
    <div className="flex min-h-screen bg-background">
      <ManagerSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
              <p className="text-muted-foreground">Manage showing appointments for your parks</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-scheduled-count">{stats?.scheduledCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Upcoming showings
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-completed-count">{stats?.completedCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Successfully completed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-cancelled-count">{stats?.cancelledCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Cancelled meetings
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-meetings-today">{stats?.todayShowings || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Meetings today
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <CalendarDays className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-meetings-week">{stats?.thisWeekShowings || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Meetings this week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by client name, lot, or park..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-bookings"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={parkFilter} onValueChange={setParkFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-park-filter">
                    <SelectValue placeholder="Filter by park" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parks</SelectItem>
                    {assignments?.map((assignment) => (
                      <SelectItem key={assignment.parkId} value={assignment.parkId}>
                        {assignment.parkName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bookings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Today's Showings ({filteredShowings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredShowings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Showings Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || parkFilter !== "all"
                      ? "No showings match your current filters."
                      : "No showings scheduled for today."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShowings.map((showing) => {
                      const startTime = formatDateTime(showing.startDt);
                      const endTime = formatDateTime(showing.endDt);
                      
                      return (
                        <TableRow key={showing.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{showing.clientName}</div>
                              <div className="text-sm text-muted-foreground">
                                {showing.clientEmail}
                              </div>
                              {showing.clientPhone && (
                                <div className="text-sm text-muted-foreground">
                                  {showing.clientPhone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{showing.lot?.nameOrNumber || 'Unknown Lot'}</div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {showing.lot?.park?.name || 'Unknown Park'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{startTime.date}</div>
                              <div className="text-sm text-muted-foreground">
                                {startTime.time} - {endTime.time}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(showing.status) as any}>
                              {showing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-view-showing-${showing.id}`}
                              >
                                View Details
                              </Button>
                              
                              {/* Complete Meeting Button - Only for past scheduled/confirmed meetings */}
                              {(showing.status === 'SCHEDULED' || showing.status === 'CONFIRMED') && new Date(showing.endDt) < new Date() && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to mark this meeting as completed?')) {
                                      completeShowingMutation.mutate(showing.id);
                                    }
                                  }}
                                  disabled={completeShowingMutation.isPending}
                                  data-testid={`button-complete-showing-${showing.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {completeShowingMutation.isPending ? 'Completing...' : 'Complete Meeting'}
                                </Button>
                              )}
                              
                              {/* Cancel Button - Only for scheduled/confirmed meetings */}
                              {(showing.status === 'SCHEDULED' || showing.status === 'CONFIRMED') && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to cancel this showing? This will remove it from your calendar and showing availability.')) {
                                      cancelShowingMutation.mutate(showing.id);
                                    }
                                  }}
                                  disabled={cancelShowingMutation.isPending}
                                  data-testid={`button-cancel-showing-${showing.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  {cancelShowingMutation.isPending ? 'Cancelling...' : 'Cancel'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}