import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, Home, MapPin, Calendar, DollarSign } from "lucide-react";
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

export default function TenantInfo() {
  const { user } = useAuth();

  // Fetch tenant information
  const { data: tenantInfo, isLoading } = useQuery<TenantInfo>({
    queryKey: ['/api/tenant/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tenant/me');
      return response.json();
    },
    enabled: user?.role === 'TENANT',
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your information...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Information Found</h1>
          <p className="text-muted-foreground">Please contact your property manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Information</h1>
        <p className="text-muted-foreground">
          Your personal and property information
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
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                <p className="font-medium text-lg">{tenantInfo.firstName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                <p className="font-medium text-lg">{tenantInfo.lastName}</p>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
              <p className="font-medium">{tenantInfo.email}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
              <p className="font-medium">{tenantInfo.phone}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={tenantInfo.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {tenantInfo.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lease Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Lease Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {tenantInfo.leaseStartDate && tenantInfo.leaseEndDate ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Lease Start Date</Label>
                    <p className="font-medium">{format(new Date(tenantInfo.leaseStartDate), 'MMMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Lease End Date</Label>
                    <p className="font-medium">{format(new Date(tenantInfo.leaseEndDate), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>
                
                {tenantInfo.monthlyRent && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Monthly Rent</Label>
                    <p className="font-medium text-2xl text-primary">${tenantInfo.monthlyRent}</p>
                  </div>
                )}
                
                {tenantInfo.securityDeposit && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Security Deposit</Label>
                    <p className="font-medium text-lg">${tenantInfo.securityDeposit}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No lease information available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Your Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Lot Number</Label>
                <p className="font-medium text-2xl">Lot {tenantInfo.lot.nameOrNumber}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{tenantInfo.lot.bedrooms}</p>
                  <p className="text-sm text-muted-foreground">Bedrooms</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{tenantInfo.lot.bathrooms}</p>
                  <p className="text-sm text-muted-foreground">Bathrooms</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{tenantInfo.lot.sqFt}</p>
                  <p className="text-sm text-muted-foreground">Sq Ft</p>
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

              {tenantInfo.lot.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm leading-relaxed mt-1">{tenantInfo.lot.description}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Park Location
                </Label>
                <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-lg">{tenantInfo.lot.park.name}</p>
                  <p className="text-muted-foreground">{tenantInfo.lot.park.address}</p>
                  <p className="text-muted-foreground">
                    {tenantInfo.lot.park.city}, {tenantInfo.lot.park.state} {tenantInfo.lot.park.zip}
                  </p>
                </div>
              </div>

              {tenantInfo.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Additional Notes</Label>
                  <p className="text-sm leading-relaxed mt-1 p-3 bg-muted/30 rounded-lg">
                    {tenantInfo.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
