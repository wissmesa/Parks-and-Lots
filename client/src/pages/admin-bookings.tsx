import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "lucide-react";

interface Booking {
  id: string;
  startDt: string;
  endDt: string;
  status: 'SCHEDULED' | 'CANCELED' | 'COMPLETED';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string | null;
  createdAt: string;
  lot?: {
    nameOrNumber: string;
    park?: {
      name: string;
    };
  };
  manager?: {
    id: string;
    fullName: string;
  } | null;
}

export default function AdminBookings() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Redirect if not admin
  if (user?.role !== 'MHP_LORD') {
    window.location.href = '/';
    return null;
  }

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["/api/admin/bookings", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const url = `/api/admin/bookings${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    enabled: user?.role === 'MHP_LORD',
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'default';
      case 'COMPLETED':
        return 'outline';
      case 'CANCELED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const bookingsList = (bookings as any)?.bookings || bookings || [];

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Calendar className="w-8 h-8" />
                Bookings
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage all property showings and bookings
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading bookings...</p>
              </div>
            ) : bookingsList.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bookings found</p>
                <p className="text-sm text-muted-foreground">
                  {statusFilter !== "all" ? `No ${statusFilter.toLowerCase()} bookings` : "No bookings yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingsList.map((booking: Booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {booking.lot?.nameOrNumber || 'Unknown Lot'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {booking.lot?.park?.name || 'Unknown Park'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{booking.customerName}</div>
                          <div className="text-sm text-muted-foreground">{booking.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(booking.startDt).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(booking.startDt).toLocaleTimeString()} - {new Date(booking.endDt).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {booking.manager?.fullName || 'Unassigned'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(booking.status) as any}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}