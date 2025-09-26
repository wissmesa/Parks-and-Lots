import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, Home, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface TenantInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  monthlyRent: string | null;
  securityDeposit: string | null;
  notes: string | null;
  lot: {
    id: string;
    nameOrNumber: string;
    bedrooms: number;
    bathrooms: number;
    sqFt: number;
    houseManufacturer: string | null;
    houseModel: string | null;
    description: string | null;
    park: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
  };
}

interface Payment {
  id: string;
  type: string;
  amount: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
  description: string | null;
  notes: string | null;
}

export default function TenantDashboard() {
  const { user } = useAuth();

  // Fetch tenant information
  const { data: tenantInfo, isLoading: tenantLoading } = useQuery<TenantInfo>({
    queryKey: ['/api/tenant/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tenant/me');
      return response.json();
    },
    enabled: user?.role === 'TENANT',
  });

  // Fetch recent payments for overview
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/tenant/payments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tenant/payments');
      const data = await response.json();
      return (data.payments || []).slice(0, 3); // Only show recent 3
    },
    enabled: user?.role === 'TENANT',
  });

  if (user?.role !== 'TENANT') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">This area is only accessible to tenant users.</p>
        </div>
      </div>
    );
  }

  if (tenantLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Tenant Information Found</h1>
          <p className="text-muted-foreground">Please contact your property manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {tenantInfo.firstName} {tenantInfo.lastName}
        </h1>
        <p className="text-muted-foreground">
          Your tenant dashboard overview
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                <p className="font-medium">{tenantInfo.firstName} {tenantInfo.lastName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <div>
                  <Badge variant={tenantInfo.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {tenantInfo.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Email</Label>
              <p className="font-medium">{tenantInfo.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
              <p className="font-medium">{tenantInfo.phone}</p>
            </div>
            {tenantInfo.leaseStartDate && tenantInfo.leaseEndDate && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Lease Start</Label>
                  <p className="font-medium">{format(new Date(tenantInfo.leaseStartDate), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Lease End</Label>
                  <p className="font-medium">{format(new Date(tenantInfo.leaseEndDate), 'MMM dd, yyyy')}</p>
                </div>
              </div>
            )}
            {tenantInfo.monthlyRent && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Monthly Rent</Label>
                <p className="font-medium text-lg">${tenantInfo.monthlyRent}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Your Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Lot</Label>
              <p className="font-medium text-lg">Lot {tenantInfo.lot.nameOrNumber}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Location</Label>
              <p className="font-medium">{tenantInfo.lot.park.name}</p>
              <p className="text-sm text-muted-foreground">
                {tenantInfo.lot.park.address}, {tenantInfo.lot.park.city}, {tenantInfo.lot.park.state} {tenantInfo.lot.park.zip}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Bedrooms</Label>
                <p className="font-medium">{tenantInfo.lot.bedrooms}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Bathrooms</Label>
                <p className="font-medium">{tenantInfo.lot.bathrooms}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Sq Ft</Label>
                <p className="font-medium">{tenantInfo.lot.sqFt}</p>
              </div>
            </div>
            {(tenantInfo.lot.houseManufacturer || tenantInfo.lot.houseModel) && (
              <div className="grid grid-cols-2 gap-4">
                {tenantInfo.lot.houseManufacturer && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Manufacturer</Label>
                    <p className="font-medium">{tenantInfo.lot.houseManufacturer}</p>
                  </div>
                )}
                {tenantInfo.lot.houseModel && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Model</Label>
                    <p className="font-medium">{tenantInfo.lot.houseModel}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent payments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{payment.type}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {format(new Date(payment.dueDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${payment.amount}</p>
                    <Badge variant={payment.status === 'PAID' ? 'default' : 'secondary'}>
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}