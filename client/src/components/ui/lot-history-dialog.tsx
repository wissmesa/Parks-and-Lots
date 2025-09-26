import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, User, Phone, Mail, Clock, DollarSign, FileText, History } from "lucide-react";

interface Showing {
  id: string;
  lotId: string;
  managerId: string;
  startDt: string;
  endDt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: 'SCHEDULED' | 'CANCELED' | 'COMPLETED';
  calendarEventId?: string;
  calendarHtmlLink?: string;
  calendarSyncError?: boolean;
  createdAt: string;
  manager?: {
    fullName: string;
    email: string;
  };
}

interface LotHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lotId: string;
  lotName: string;
}

export function LotHistoryDialog({ isOpen, onClose, lotId, lotName }: LotHistoryDialogProps) {
  // Fetch showings/appointments for this lot
  const { data: showings, isLoading: showingsLoading } = useQuery({
    queryKey: ['lot-showings-full', lotId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/lots/${lotId}/showings/full`);
      const data = await response.json();
      return data.showings as Showing[];
    },
    enabled: isOpen && !!lotId,
  });

  // Fetch tenants for this lot
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['lot-tenants', lotId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tenants?lotId=${lotId}`);
      const data = await response.json();
      return data.tenants as any[];
    },
    enabled: isOpen && !!lotId,
  });

  // Fetch payments for this lot
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['lot-payments', lotId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payments?lotId=${lotId}`);
      const data = await response.json();
      return data.payments as any[];
    },
    enabled: isOpen && !!lotId,
  });

  // For now, we'll use showings as "OWNER_TENANT interactions" 
  // This can be extended later when actual OWNER_TENANT/payment tables are added
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default';
      case 'SCHEDULED':
        return 'secondary';
      case 'CANCELED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const completedShowings = showings?.filter(s => s.status === 'COMPLETED') || [];
  const allShowings = showings || [];
  const activeTenants = tenants?.filter(t => t.status === 'ACTIVE') || [];
  const currentTenant = activeTenants[0]; // Assuming one active OWNER_TENANT per lot
  const totalPayments = payments?.length || 0;
  const paidPayments = payments?.filter(p => p.status === 'PAID')?.length || 0;
  const overduePayments = payments?.filter(p => p.status === 'OVERDUE')?.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Lot History - {lotName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="showings">Showings</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Showings</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allShowings.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {completedShowings.length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Interested Clients</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(allShowings.map(s => s.clientEmail)).size}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique prospects
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {allShowings.length > 0 ? 
                      Math.ceil((Date.now() - new Date(allShowings[0]?.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24)) 
                      : 0
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days since last showing
                  </p>
                </CardContent>
              </Card>
            </div>

            {completedShowings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Completed Showings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {completedShowings.slice(0, 3).map((showing) => (
                      <div key={showing.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{showing.clientName}</span>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {showing.clientEmail}
                              <Phone className="h-3 w-3 ml-2" />
                              {showing.clientPhone}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatDateTime(showing.startDt)}
                          </div>
                          <Badge variant={getStatusBadgeVariant(showing.status)}>
                            {showing.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="showings" className="space-y-4">
            {showingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading showings...</div>
              </div>
            ) : allShowings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Showings Yet</h3>
                <p className="text-muted-foreground">This lot hasn't had any scheduled showings.</p>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>All Showings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allShowings.map((showing) => (
                        <TableRow key={showing.id}>
                          <TableCell>
                            <div className="font-medium">{showing.clientName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {showing.clientEmail}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {showing.clientPhone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{formatDateTime(showing.startDt)}</div>
                              <div className="text-muted-foreground">
                                to {new Date(showing.endDt).toLocaleTimeString()}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {showing.manager?.fullName || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(showing.status)}>
                              {showing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {formatDateTime(showing.createdAt)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Payment History</h3>
              <p className="text-muted-foreground mb-4">
                Payment tracking is not yet implemented in the system.
              </p>
              <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                <FileText className="inline h-4 w-4 mr-2" />
                This section will display historical OWNER_TENANT payments, lease information, 
                and financial transactions once the OWNER_TENANT management system is implemented.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
