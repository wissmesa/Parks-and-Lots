import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Calendar, MapPin, DollarSign, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface OwnerTenantAssignment {
  id: string;
  userId: string;
  lotId: string;
  relationshipType: 'OWNER' | 'TENANT';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  userName: string;
  userEmail: string;
  lotName: string;
  parkName: string;
}

interface LotDetails {
  lot: {
    id: string;
    nameOrNumber: string;
    price: string;
    description?: string;
    bedrooms?: number;
    bathrooms?: number;
    sqFt?: number;
    houseManufacturer?: string;
    houseModel?: string;
    status: string[];
  };
  park: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    description?: string;
    amenities?: string[];
  };
  photos: Array<{
    id: string;
    urlOrPath: string;
    caption?: string;
  }>;
  showings: Array<{
    id: string;
    startDt: string;
    endDt: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    status: string;
  }>;
}

export default function OwnerTenantDashboard() {
  const { user } = useAuth();
  const [selectedLotId, setSelectedLotId] = useState<string>('');

  // Fetch user's assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<OwnerTenantAssignment[]>({
    queryKey: ['owner-tenant-assignments'],
    queryFn: async () => {
      const response = await fetch('/api/owner-tenant/assignments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    }
  });

  // Fetch lot details when a lot is selected
  const { data: lotDetails, isLoading: lotDetailsLoading } = useQuery<LotDetails>({
    queryKey: ['owner-tenant-lot', selectedLotId],
    queryFn: async () => {
      const response = await fetch(`/api/owner-tenant/lot/${selectedLotId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch lot details');
      return response.json();
    },
    enabled: !!selectedLotId
  });

  // Set the first lot as selected when assignments are loaded
  useEffect(() => {
    if (assignments.length > 0 && !selectedLotId) {
      setSelectedLotId(assignments[0].lotId);
    }
  }, [assignments, selectedLotId]);

  if (assignmentsLoading) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No lots assigned</h2>
            <p className="text-muted-foreground text-center">
              Contact your park administrator to get access to a lot.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedAssignment = assignments.find(a => a.lotId === selectedLotId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, {user?.fullName}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={selectedAssignment?.relationshipType === 'OWNER' ? 'default' : 'secondary'}>
            {selectedAssignment?.relationshipType === 'OWNER' ? 'Owner' : 'Tenant'}
          </Badge>
        </div>
      </div>

      {/* Lot Selection */}
      {assignments.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Lot</CardTitle>
            <CardDescription>
              You have access to multiple lots. Select one to view details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map((assignment) => (
                <Button
                  key={assignment.id}
                  variant={selectedLotId === assignment.lotId ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => setSelectedLotId(assignment.lotId)}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="font-semibold">{assignment.lotName}</span>
                    <Badge variant="outline" className="text-xs">
                      {assignment.relationshipType === 'OWNER' ? 'Owner' : 'Tenant'}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{assignment.parkName}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lot Details */}
      {selectedLotId && lotDetails && (
        <>
          {/* Property Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lot</CardTitle>
                <Home className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lotDetails.lot.nameOrNumber}</div>
                <p className="text-xs text-muted-foreground">
                  {lotDetails.lot.bedrooms && lotDetails.lot.bathrooms 
                    ? `${lotDetails.lot.bedrooms} bed, ${lotDetails.lot.bathrooms} bath`
                    : 'Details not available'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${lotDetails.lot.price}</div>
                <p className="text-xs text-muted-foreground">
                  {lotDetails.lot.status.join(', ')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Park</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lotDetails.park.name}</div>
                <p className="text-xs text-muted-foreground">
                  {lotDetails.park.city}, {lotDetails.park.state}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Showings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lotDetails.showings.length}</div>
                <p className="text-xs text-muted-foreground">
                  Scheduled showings
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Property Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lotDetails.lot.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-muted-foreground">{lotDetails.lot.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {lotDetails.lot.bedrooms && (
                    <div>
                      <h4 className="font-semibold">Bedrooms</h4>
                      <p className="text-muted-foreground">{lotDetails.lot.bedrooms}</p>
                    </div>
                  )}
                  {lotDetails.lot.bathrooms && (
                    <div>
                      <h4 className="font-semibold">Bathrooms</h4>
                      <p className="text-muted-foreground">{lotDetails.lot.bathrooms}</p>
                    </div>
                  )}
                  {lotDetails.lot.sqFt && (
                    <div>
                      <h4 className="font-semibold">Area</h4>
                      <p className="text-muted-foreground">{lotDetails.lot.sqFt} sq ft</p>
                    </div>
                  )}
                  {lotDetails.lot.houseManufacturer && (
                    <div>
                      <h4 className="font-semibold">Manufacturer</h4>
                      <p className="text-muted-foreground">{lotDetails.lot.houseManufacturer}</p>
                    </div>
                  )}
                </div>

                {lotDetails.lot.houseModel && (
                  <div>
                    <h4 className="font-semibold">Model</h4>
                    <p className="text-muted-foreground">{lotDetails.lot.houseModel}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Park Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Address</h4>
                  <p className="text-muted-foreground">
                    {lotDetails.park.address}<br />
                    {lotDetails.park.city}, {lotDetails.park.state} {lotDetails.park.zip}
                  </p>
                </div>

                {lotDetails.park.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-muted-foreground">{lotDetails.park.description}</p>
                  </div>
                )}

                {lotDetails.park.amenities && lotDetails.park.amenities.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {lotDetails.park.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Photos */}
          {lotDetails.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Property Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lotDetails.photos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={`/static/${photo.urlOrPath}`}
                        alt={photo.caption || 'Property photo'}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {photo.caption && (
                        <p className="text-sm text-muted-foreground mt-2">{photo.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Showings */}
          {lotDetails.showings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Showings</CardTitle>
                <CardDescription>
                  History of scheduled showings for this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lotDetails.showings.slice(0, 5).map((showing) => (
                    <div key={showing.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-semibold">{showing.clientName}</h4>
                        <p className="text-sm text-muted-foreground">{showing.clientEmail}</p>
                        <p className="text-sm text-muted-foreground">{showing.clientPhone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(showing.startDt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(showing.startDt).toLocaleTimeString()} - {new Date(showing.endDt).toLocaleTimeString()}
                        </p>
                        <Badge 
                          variant={showing.status === 'COMPLETED' ? 'default' : 
                                  showing.status === 'SCHEDULED' ? 'secondary' : 'destructive'}
                        >
                          {showing.status === 'COMPLETED' ? 'Completed' :
                           showing.status === 'SCHEDULED' ? 'Scheduled' : 'Canceled'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
