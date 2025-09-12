import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PhotoManagement } from "@/components/ui/photo-management";
import { useToast } from "@/hooks/use-toast";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { TreePine, Edit, MapPin, Camera, X, Plus } from "lucide-react";

interface Park {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  companyId: string;
  createdAt: string;
  amenities?: string[];
  company?: {
    name: string;
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

export default function ManagerParks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPark, setEditingPark] = useState<Park | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    amenities: [] as string[]
  });
  const [newAmenity, setNewAmenity] = useState('');
  const [showPhotos, setShowPhotos] = useState<string | null>(null);

  // Redirect if not manager
  if (user?.role !== 'MANAGER') {
    window.location.href = '/';
    return null;
  }

  const { data: assignments, isLoading: assignmentsLoading, error } = useQuery<Assignment[]>({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  // Get park IDs from assignments and fetch full park details
  const parkIds = assignments?.map(a => a.parkId) || [];
  
  const { data: parksResponse, isLoading: parksLoading } = useQuery<{parks: Park[]}>({
    queryKey: ["/api/parks"],
    enabled: parkIds.length > 0,
  });

  const allParks = parksResponse?.parks || [];
  const isLoading = assignmentsLoading || parksLoading;

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PATCH", `/api/parks/${editingPark?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assignments"] });
      setEditingPark(null);
      resetForm();
      toast({
        title: "Success",
        description: "Park updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update park",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      amenities: []
    });
    setNewAmenity('');
  };

  const handleEdit = (park: Park) => {
    setEditingPark(park);
    setFormData({
      name: park.name,
      description: park.description,
      address: park.address,
      city: park.city,
      state: park.state,
      zipCode: park.zipCode,
      amenities: park.amenities || []
    });
    setNewAmenity('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPark) {
      updateMutation.mutate(formData);
    }
  };

  // Filter parks to only show assigned ones
  const parks = allParks?.filter(park => parkIds.includes(park.id)) || [];

  return (
    <div className="flex min-h-screen bg-background">
      <ManagerSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Parks</h1>
              <p className="text-muted-foreground">Manage parks assigned to you</p>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-8">
                <div className="animate-pulse text-center">Loading parks...</div>
              </CardContent>
            </Card>
          ) : parks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <TreePine className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Parks Assigned</h3>
                <p className="text-muted-foreground">
                  You don't have any parks assigned to you yet. Contact your administrator.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="w-5 h-5" />
                  Parks ({parks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parks.map((park) => (
                      <TableRow key={park?.id || Math.random()}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{park?.name || 'Unknown Park'}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {park?.description || 'No description available'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {park?.city || 'N/A'}, {park?.state || 'N/A'} {park?.zipCode || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {park?.company?.name || 'No Company'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => park && handleEdit(park)}
                              disabled={!park}
                              data-testid={`button-edit-park-${park?.id || 'unknown'}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => park?.id && setShowPhotos(park.id)}
                              disabled={!park?.id}
                              data-testid={`button-manage-photos-${park?.id || 'unknown'}`}
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Edit Park Dialog */}
          <Dialog open={!!editingPark} onOpenChange={(open) => !open && setEditingPark(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Park</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Park Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-park-name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    data-testid="input-park-description"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    data-testid="input-park-address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      data-testid="input-park-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                      data-testid="input-park-state"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      required
                      data-testid="input-park-zip"
                    />
                  </div>
                </div>
                
                {/* Amenities Section */}
                <div>
                  <Label>Amenities</Label>
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-1 gap-2">
                      {formData.amenities.map((amenity, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input 
                            value={amenity}
                            onChange={(e) => {
                              const newAmenities = [...formData.amenities];
                              newAmenities[index] = e.target.value;
                              setFormData({ ...formData, amenities: newAmenities });
                            }}
                            data-testid={`input-amenity-${index}`}
                          />
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const newAmenities = formData.amenities.filter((_, i) => i !== index);
                              setFormData({ ...formData, amenities: newAmenities });
                            }}
                            data-testid={`button-remove-amenity-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Add new amenity..."
                        value={newAmenity}
                        onChange={(e) => setNewAmenity(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newAmenity.trim()) {
                              setFormData({ 
                                ...formData, 
                                amenities: [...formData.amenities, newAmenity.trim()] 
                              });
                              setNewAmenity('');
                            }
                          }
                        }}
                        data-testid="input-new-amenity"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (newAmenity.trim()) {
                            setFormData({ 
                              ...formData, 
                              amenities: [...formData.amenities, newAmenity.trim()] 
                            });
                            setNewAmenity('');
                          }
                        }}
                        disabled={!newAmenity.trim()}
                        data-testid="button-add-amenity"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingPark(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    data-testid="button-save-park"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Park"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Photo Management Dialog */}
          <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Manage Photos</DialogTitle>
              </DialogHeader>
              {showPhotos && (
                <PhotoManagement
                  entityType="PARK"
                  entityId={showPhotos}
                  entityName={parks.find(p => p?.id === showPhotos)?.name || "Park"}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}