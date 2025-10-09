import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar,
  Search,
  MapPin,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  parkId: string;
  parkName: string;
}

interface Showing {
  id: string;
  startDt: string;
  endDt: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  calendarEventId?: string;
  calendarHtmlLink?: string;
  lot?: {
    id: string;
    nameOrNumber: string;
    park?: {
      id: string;
      name: string;
    };
  };
}

interface ManagerStats {
  todayShowings: number;
  thisWeekShowings: number;
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
  const queryClient = useQueryClient();

  // Redirect if not manager or company manager
  if (user?.role !== 'MANAGER' && user?.role !== 'COMPANY_MANAGER') {
    window.location.href = '/';
    return null;
  }

  // Special restriction for Tammie - only allow Company Parks access
  if (user?.role === 'COMPANY_MANAGER' && user?.fullName === 'Tammie') {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="flex">
          <ManagerSidebar />
          <main className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
            <div className="flex items-center justify-center py-16">
              <Card>
                <CardContent className="p-8 text-center">
                  <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
                  <p className="text-muted-foreground">This feature is not yet available. Please use the Company Parks option from the menu.</p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isCompanyManager = user?.role === 'COMPANY_MANAGER';

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: todayShowings } = useQuery<Showing[]>({
    queryKey: isCompanyManager ? ["/api/company-manager/showings/today"] : ["/api/manager/showings/today"],
    enabled: user?.role === 'MANAGER' || user?.role === 'COMPANY_MANAGER',
  });

  const { data: thisWeekShowings } = useQuery<Showing[]>({
    queryKey: isCompanyManager ? ["/api/company-manager/showings/this-week"] : ["/api/manager/showings/this-week"],
    enabled: user?.role === 'MANAGER' || user?.role === 'COMPANY_MANAGER',
  });

  const { data: thisMonthShowings } = useQuery<Showing[]>({
    queryKey: isCompanyManager ? ["/api/company-manager/showings/this-month"] : ["/api/manager/showings/this-month"],
    enabled: user?.role === 'MANAGER' || user?.role === 'COMPANY_MANAGER',
  });

  const { data: stats } = useQuery<ManagerStats>({
    queryKey: isCompanyManager ? ["/api/company-manager/stats"] : ["/api/manager/stats"],
    enabled: user?.role === 'MANAGER' || user?.role === 'COMPANY_MANAGER',
  });

  // Mutation to cancel a showing - cancels directly in Google Calendar
  const cancelShowingMutation = useMutation({
    mutationFn: async (showing: Showing) => {
      // If there's a calendar event ID, cancel it in the calendar
      if (showing.calendarEventId) {
        return apiRequest('DELETE', `/api/calendar/events/${showing.calendarEventId}`, null);
      } else {
        // Fallback to database-only cancellation if no calendar event
        return apiRequest('PATCH', `/api/showings/${showing.id}`, { status: 'CANCELED' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/this-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/this-month"] });
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

  // Mutation to complete a showing - marks it as completed in Google Calendar
  const completeShowingMutation = useMutation({
    mutationFn: async (showing: Showing) => {
      // If there's a calendar event ID, mark it as completed in the calendar
      if (showing.calendarEventId) {
        return apiRequest('PATCH', `/api/calendar/events/${showing.calendarEventId}/complete`, null);
      } else {
        // Fallback to database-only completion if no calendar event
        return apiRequest('PATCH', `/api/showings/${showing.id}`, { status: 'COMPLETED' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/this-week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/showings/this-month"] });
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

  // Helper function to filter showings
  const filterShowings = (showings: Showing[]) => {
    return showings.filter(showing => {
      const matchesSearch = 
        showing.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        showing.lot?.nameOrNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        showing.lot?.park?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || showing.status === statusFilter;
      const matchesPark = parkFilter === "all" || showing.lot?.park?.id === parkFilter;
      
      return matchesSearch && matchesStatus && matchesPark;
    });
  };

  const filteredTodayShowings = filterShowings(todayShowings || []);
  console.log(filteredTodayShowings,"filteredTodayShowings");
  const filteredThisWeekShowings = filterShowings(thisWeekShowings || []);
  const filteredThisMonthShowings = filterShowings(thisMonthShowings || []);

  // Calculate completed and cancelled counts from all showings data
  const allShowings = [
    ...(todayShowings || []),
    ...(thisWeekShowings || []),
    ...(thisMonthShowings || [])
  ];
  
  // Remove duplicates based on showing ID
  const uniqueShowings = allShowings.filter((showing, index, self) => 
    index === self.findIndex(s => s.id === showing.id)
  );
  
  const completedCount = uniqueShowings.filter(showing => showing.status === 'COMPLETED').length;
  const cancelledCount = uniqueShowings.filter(showing => showing.status === 'CANCELED').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'secondary';
      case 'CONFIRMED': return 'default';
      case 'COMPLETED': return 'outline';
      case 'CANCELED': return 'destructive';
      default: return 'secondary';
    }
  };

  // Helper function to render showings table
  const renderShowingsTable = (showings: Showing[], title: string, count: number) => {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {title} ({count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Showings Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || parkFilter !== "all"
                  ? "No showings match your current filters."
                  : `No showings scheduled for ${title.toLowerCase()}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {showings.map((showing) => {
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
                            {showing.status === 'SCHEDULED' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelShowingMutation.mutate(showing)}
                                  disabled={cancelShowingMutation.isPending}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => completeShowingMutation.mutate(showing)}
                                  disabled={completeShowingMutation.isPending}
                                >
                                  Complete
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, 'MMM dd, yyyy'),
      time: format(date, 'h:mm a')
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <ManagerSidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Manage showing appointments for your parks</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-meetings-scheduled">{stats?.todayShowings || 0}</div>
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
                  <div className="text-2xl font-bold" data-testid="text-meetings-completed">{completedCount}</div>
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
                  <div className="text-2xl font-bold" data-testid="text-meetings-cancelled">{cancelledCount}</div>
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

            {/* Today's Showings */}
            {renderShowingsTable(filteredTodayShowings, "Today's Showings", filteredTodayShowings.length)}

            {/* This Week's Showings */}
            {renderShowingsTable(filteredThisWeekShowings, "This Week's Showings", filteredThisWeekShowings.length)}

            {/* This Month's Showings */}
            {renderShowingsTable(filteredThisMonthShowings, "This Month's Showings", filteredThisMonthShowings.length)}
          </div>
        </main>
      </div>
    </div>
  );
}
