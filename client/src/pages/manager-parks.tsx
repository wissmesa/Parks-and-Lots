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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { TreePine, Edit, MapPin, Camera, X, Plus, Tag, MoreHorizontal } from "lucide-react";

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

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
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
  const [manageSpecialStatuses, setManageSpecialStatuses] = useState<Park | null>(null);
  const [editingStatus, setEditingStatus] = useState<SpecialStatus | null>(null);
  const [statusFormData, setStatusFormData] = useState({
    name: "",
    color: "#3B82F6",
    isActive: true
  });

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

  const resetStatusForm = () => {
    setStatusFormData({
      name: "",
      color: "#3B82F6",
      isActive: true
    });
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

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStatus) {
      updateStatusMutation.mutate(statusFormData);
    } else {
      createStatusMutation.mutate(statusFormData);
    }
  };

  const handleEditStatus = (status: SpecialStatus) => {
    setEditingStatus(status);
    setStatusFormData({
      name: status.name || "",
      color: status.color || "#3B82F6",
      isActive: status.isActive
    });
  };

  const handleDeleteStatus = (statusId: string) => {
    deleteStatusMutation.mutate(statusId);
  };

  // Filter parks to only show assigned ones
  const parks = allParks?.filter(park => parkIds.includes(park.id)) || [];

  // Special status queries and mutations
  const { data: specialStatuses = [], isLoading: statusesLoading } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", manageSpecialStatuses?.id, "special-statuses"],
    enabled: !!manageSpecialStatuses?.id,
  });

  const createStatusMutation = useMutation({
    mutationFn: async (data: typeof statusFormData) => {
      return apiRequest("POST", `/api/parks/${manageSpecialStatuses?.id}/special-statuses`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks", manageSpecialStatuses?.id, "special-statuses"] });
      // Invalidate all lots-related queries across the application
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key.some(k => 
            typeof k === 'string' && (
              k.includes('/lots') || 
              k === 'lots' ||
              k.endsWith('/lots')
            )
          );
        },
        refetchType: 'active'
      });
      setEditingStatus(null);
      resetStatusForm();
      toast({
        title: "Success",
        description: "Special status created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create special status",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: typeof statusFormData) => {
      return apiRequest("PUT", `/api/special-statuses/${editingStatus?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks", manageSpecialStatuses?.id, "special-statuses"] });
      // Invalidate all lots-related queries across the application
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key.some(k => 
            typeof k === 'string' && (
              k.includes('/lots') || 
              k === 'lots' ||
              k.endsWith('/lots')
            )
          );
        },
        refetchType: 'active'
      });
      setEditingStatus(null);
      resetStatusForm();
      toast({
        title: "Success",
        description: "Special status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update special status",
        variant: "destructive",
      });
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (statusId: string) => {
      return apiRequest("DELETE", `/api/special-statuses/${statusId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks", manageSpecialStatuses?.id, "special-statuses"] });
      // Invalidate all lots-related queries across the application
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key.some(k => 
            typeof k === 'string' && (
              k.includes('/lots') || 
              k === 'lots' ||
              k.endsWith('/lots')
            )
          );
        },
        refetchType: 'active'
      });
      toast({
        title: "Success",
        description: "Special status deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete special status",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex min-h-screen bg-background">
      <ManagerSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!park}
                                data-testid={`park-actions-${park?.id || 'unknown'}`}
                              >
                                Actions
                                <MoreHorizontal className="w-4 h-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => park && handleEdit(park)}
                                data-testid={`edit-park-${park?.id || 'unknown'}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Park
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => park?.id && setShowPhotos(park.id)}
                                data-testid={`manage-photos-${park?.id || 'unknown'}`}
                              >
                                <Camera className="w-4 h-4 mr-2" />
                                Manage Photos
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => park && setManageSpecialStatuses(park)}
                                data-testid={`manage-special-statuses-${park?.id || 'unknown'}`}
                              >
                                <Tag className="w-4 h-4 mr-2" />
                                Manage Special Statuses
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

          {/* Special Status Management Dialog */}
          <Dialog open={!!manageSpecialStatuses} onOpenChange={(open) => !open && setManageSpecialStatuses(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Manage Special Statuses - {manageSpecialStatuses?.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Create/Edit Form */}
                <Card className={editingStatus ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {editingStatus ? (
                        <>
                          <Edit className="w-5 h-5 text-orange-600" />
                          <span className="text-orange-700 dark:text-orange-300">
                            Editing: "{editingStatus.name}"
                          </span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5 text-blue-600" />
                          Create New Special Status
                        </>
                      )}
                    </CardTitle>
                    {editingStatus && (
                      <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-md p-3 mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: editingStatus.color || '#3B82F6' }}
                            />
                            <span className="font-medium text-orange-800 dark:text-orange-200">
                              Current: {editingStatus.name}
                            </span>
                            <Badge variant={editingStatus.isActive ? "default" : "secondary"} className="text-xs">
                              {editingStatus.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleStatusSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="status-name">Status Name</Label>
                        <Input
                          id="status-name"
                          value={statusFormData.name}
                          onChange={(e) => setStatusFormData({ ...statusFormData, name: e.target.value })}
                          placeholder="e.g. Premium, Luxury, Under Renovation"
                          required
                          data-testid="input-status-name"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="status-color">Status Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="status-color"
                            value={statusFormData.color}
                            onChange={(e) => setStatusFormData({ ...statusFormData, color: e.target.value })}
                            className="w-12 h-8 rounded border"
                            data-testid="input-status-color"
                          />
                          <Input
                            value={statusFormData.color}
                            onChange={(e) => setStatusFormData({ ...statusFormData, color: e.target.value })}
                            placeholder="#3B82F6"
                            className="font-mono"
                            data-testid="input-status-color-text"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="status-active"
                          checked={statusFormData.isActive}
                          onChange={(e) => setStatusFormData({ ...statusFormData, isActive: e.target.checked })}
                          data-testid="checkbox-status-active"
                        />
                        <Label htmlFor="status-active">Active Status</Label>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingStatus(null);
                            resetStatusForm();
                          }}
                          data-testid="button-cancel-status"
                          className={editingStatus ? "border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300" : ""}
                        >
                          {editingStatus ? "Cancel Edit" : "Cancel"}
                        </Button>
                        <Button
                          type="submit"
                          disabled={createStatusMutation.isPending || updateStatusMutation.isPending}
                          data-testid="button-save-status"
                          className={editingStatus ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
                        >
                          {createStatusMutation.isPending || updateStatusMutation.isPending 
                            ? "Saving..." 
                            : editingStatus ? "Update Status" : "Create Status"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Existing Special Statuses */}
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Special Statuses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusesLoading ? (
                      <div className="text-center py-4">Loading statuses...</div>
                    ) : specialStatuses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No special statuses created yet</p>
                        <p className="text-sm">Create your first special status above</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {specialStatuses.map((status) => {
                          const isBeingEdited = editingStatus?.id === status.id;
                          return (
                            <div
                              key={status.id}
                              className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                                isBeingEdited 
                                  ? "border-orange-300 bg-orange-50 shadow-md ring-2 ring-orange-200 dark:bg-orange-950/30 dark:border-orange-600 dark:ring-orange-800" 
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full border"
                                  style={{ backgroundColor: status.color }}
                                />
                                <div>
                                  <div className={`font-medium ${isBeingEdited ? "text-orange-900 dark:text-orange-100" : ""}`}>
                                    {status.name}
                                    {isBeingEdited && (
                                      <Badge className="ml-2 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                        Editing
                                      </Badge>
                                    )}
                                  </div>
                                  <div className={`text-sm ${isBeingEdited ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}`}>
                                    {status.isActive ? "Active" : "Inactive"} • {status.color}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={isBeingEdited ? "default" : "outline"}
                                  onClick={() => handleEditStatus(status)}
                                  data-testid={`button-edit-status-${status.id}`}
                                  className={isBeingEdited ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
                                  disabled={isBeingEdited}
                                >
                                  <Edit className="w-4 h-4" />
                                  {isBeingEdited && <span className="ml-1 text-xs">Editing</span>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteStatus(status.id)}
                                  disabled={deleteStatusMutation.isPending || isBeingEdited}
                                  data-testid={`button-delete-status-${status.id}`}
                                  className={isBeingEdited ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  {deleteStatusMutation.isPending ? "..." : <X className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}