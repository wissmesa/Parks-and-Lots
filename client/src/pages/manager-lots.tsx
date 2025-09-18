import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PhotoManagement } from "@/components/ui/photo-management";
import { useToast } from "@/hooks/use-toast";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { 
  Home, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Bed, 
  Bath, 
  Ruler,
  Eye,
  EyeOff,
  Camera,
  Tag
} from "lucide-react";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: 'FOR_RENT' | 'FOR_SALE' | 'RENT_SALE';
  price: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  sqFt: number;
  parkId: string;
  isActive: boolean;
  specialStatusId?: string | null;
  park: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  specialStatus?: {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
  } | null;
}

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
}

export default function ManagerLots() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState<string | null>(null);
  const [assigningSpecialStatus, setAssigningSpecialStatus] = useState<Lot | null>(null);
  const [selectedSpecialStatusId, setSelectedSpecialStatusId] = useState<string>("");
  
  // Form state
  const [formData, setFormData] = useState({
    nameOrNumber: '',
    status: 'FOR_RENT' as 'FOR_RENT' | 'FOR_SALE' | 'RENT_SALE',
    price: '',
    description: '',
    bedrooms: 1,
    bathrooms: 1,
    sqFt: 0,
    parkId: ''
  });

  // Redirect if not manager
  useEffect(() => {
    if (user && user.role !== 'MANAGER') {
      window.location.href = '/';
    }
  }, [user]);

  // Fetch manager assignments (parks)
  const { data: assignments } = useQuery({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  // Fetch lots for assigned parks
  const { data: lots, isLoading } = useQuery<Lot[]>({
    queryKey: ["/api/manager/lots"],
    enabled: user?.role === 'MANAGER',
  });

  // Special statuses query for the selected park
  const { data: specialStatuses = [] } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", assigningSpecialStatus?.parkId, "special-statuses"],
    enabled: !!assigningSpecialStatus?.parkId,
  });

  // Create lot mutation
  const createLotMutation = useMutation({
    mutationFn: async (lotData: typeof formData) => {
      const response = await apiRequest("POST", "/api/manager/lots", lotData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lot Created",
        description: "New lot has been created successfully.",
      });
      setIsCreateModalOpen(false);
      setFormData({
        nameOrNumber: '',
        status: 'FOR_RENT',
        price: '',
        description: '',
        bedrooms: 1,
        bathrooms: 1,
        sqFt: 0,
        parkId: ''
      });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update lot mutation
  const updateLotMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<typeof formData>) => {
      const response = await apiRequest("PATCH", `/api/manager/lots/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lot Updated",
        description: "Lot has been updated successfully.",
      });
      setIsEditModalOpen(false);
      setEditingLot(null);
      queryClient.invalidateQueries({ queryKey: ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete lot mutation
  const deleteLotMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/manager/lots/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Lot Deleted",
        description: "Lot has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle lot active/inactive mutation
  const toggleLotActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/lots/${id}/toggle-active`);
      return response.json();
    },
    onSuccess: (updatedLot) => {
      toast({
        title: "Lot Updated",
        description: `Lot ${updatedLot.isActive ? 'enabled' : 'disabled'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/lots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignSpecialStatusMutation = useMutation({
    mutationFn: async ({ lotId, specialStatusId }: { lotId: string; specialStatusId: string | null }) => {
      return apiRequest("PUT", `/api/lots/${lotId}/special-status`, { specialStatusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/lots"] });
      setAssigningSpecialStatus(null);
      setSelectedSpecialStatusId("");
      toast({
        title: "Success",
        description: "Special status assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign special status",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLotMutation.mutateAsync(formData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLot) return;
    
    await updateLotMutation.mutateAsync({
      id: editingLot.id,
      ...formData
    });
  };

  const handleEdit = (lot: Lot) => {
    setEditingLot(lot);
    setFormData({
      nameOrNumber: lot.nameOrNumber,
      status: lot.status,
      price: lot.price,
      description: lot.description,
      bedrooms: lot.bedrooms,
      bathrooms: lot.bathrooms,
      sqFt: lot.sqFt,
      parkId: lot.parkId
    });
    setIsEditModalOpen(true);
  };

  const handleAssignSpecialStatus = (lot: Lot) => {
    setAssigningSpecialStatus(lot);
    setSelectedSpecialStatusId(lot.specialStatusId || "none");
  };

  const handleConfirmSpecialStatusAssignment = () => {
    if (assigningSpecialStatus) {
      const specialStatusId = selectedSpecialStatusId === "none" ? null : selectedSpecialStatusId;
      assignSpecialStatusMutation.mutate({
        lotId: assigningSpecialStatus.id,
        specialStatusId
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this lot?')) {
      await deleteLotMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string) => {
    await toggleLotActiveMutation.mutateAsync(id);
  };

  const assignedParks = assignments || [];
  
  if (user?.role !== 'MANAGER') {
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
        <ManagerSidebar />

        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Lots</h1>
              <p className="text-muted-foreground">Manage lots in your assigned parks</p>
            </div>
            
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-lot">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Lot
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Lot</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="parkId">Park</Label>
                    <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(assignedParks) && assignedParks.map((assignment: any) => (
                          <SelectItem key={assignment.parkId} value={assignment.parkId}>
                            {assignment.parkName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="nameOrNumber">Lot Name/Number</Label>
                    <Input
                      id="nameOrNumber"
                      value={formData.nameOrNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                      placeholder="e.g., Lot 12A"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="e.g., 150000"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <Input
                        id="bedrooms"
                        type="number"
                        min="1"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <Input
                        id="bathrooms"
                        type="number"
                        min="1"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="sqFt">Square Feet</Label>
                    <Input
                      id="sqFt"
                      type="number"
                      min="1"
                      value={formData.sqFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, sqFt: parseInt(e.target.value) }))}
                      placeholder="e.g., 1200"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOR_RENT">For Rent</SelectItem>
                        <SelectItem value="FOR_SALE">For Sale</SelectItem>
                        <SelectItem value="RENT_SALE">Rent/Sale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the lot features..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={createLotMutation.isPending}>
                      {createLotMutation.isPending ? "Creating..." : "Create Lot"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lots Grid */}
          {isLoading ? (
            <div className="text-center py-8">Loading lots...</div>
          ) : !lots || lots.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Home className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Lots Found</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't created any lots yet. Start by adding your first lot.
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Lot
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lots.map((lot) => (
                <Card key={lot.id} className={!lot.isActive ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{lot.nameOrNumber}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          lot.status === 'FOR_RENT' ? 'default' : lot.status === 'RENT_SALE' ? 'secondary' : 'outline'
                        }>
                          {lot.status === 'FOR_RENT' ? 'For Rent' : lot.status === 'FOR_SALE' ? 'For Sale' : 'Rent/Sale'}
                        </Badge>
                        <Badge variant={lot.isActive ? 'default' : 'destructive'}>
                          {lot.isActive ? 'Visible' : 'Hidden'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{lot.park.name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">${parseInt(lot.price).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Bed className="w-4 h-4" />
                          <span>{lot.bedrooms}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Bath className="w-4 h-4" />
                          <span>{lot.bathrooms}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Ruler className="w-4 h-4" />
                          <span>{lot.sqFt} ft²</span>
                        </div>
                      </div>
                      
                      {lot.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {lot.description}
                        </p>
                      )}
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(lot.id)}
                          className={`${lot.isActive ? 'text-accent' : 'text-muted-foreground'}`}
                          disabled={toggleLotActiveMutation.isPending}
                          data-testid={`button-toggle-lot-${lot.id}`}
                        >
                          {lot.isActive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                          {lot.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPhotos(lot.id)}
                          title="Manage Photos"
                          data-testid={`button-photos-lot-${lot.id}`}
                        >
                          <Camera className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignSpecialStatus(lot)}
                          title="Assign Special Status"
                          data-testid={`button-assign-special-status-${lot.id}`}
                        >
                          <Tag className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(lot)}
                          data-testid={`button-edit-lot-${lot.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(lot.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-lot-${lot.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Lot</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="edit-nameOrNumber">Lot Name/Number</Label>
                  <Input
                    id="edit-nameOrNumber"
                    value={formData.nameOrNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-price">Price ($)</Label>
                  <Input
                    id="edit-price"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                    <Input
                      id="edit-bedrooms"
                      type="number"
                      min="1"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                    <Input
                      id="edit-bathrooms"
                      type="number"
                      min="1"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="edit-sqFt">Square Feet</Label>
                  <Input
                    id="edit-sqFt"
                    type="number"
                    min="1"
                    value={formData.sqFt}
                    onChange={(e) => setFormData(prev => ({ ...prev, sqFt: parseInt(e.target.value) }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FOR_RENT">For Rent</SelectItem>
                      <SelectItem value="FOR_SALE">For Sale</SelectItem>
                      <SelectItem value="RENT_SALE">Rent/Sale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={updateLotMutation.isPending}>
                    {updateLotMutation.isPending ? "Updating..." : "Update Lot"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Photo Management Modal */}
          <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Manage Photos - {lots?.find(l => l.id === showPhotos)?.nameOrNumber}
                </DialogTitle>
              </DialogHeader>
              {showPhotos && (
                <PhotoManagement 
                  entityType="LOT"
                  entityId={showPhotos}
                  entityName={lots?.find(l => l.id === showPhotos)?.nameOrNumber || 'Lot'}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Special Status Assignment Dialog */}
          <Dialog open={!!assigningSpecialStatus} onOpenChange={(open) => !open && setAssigningSpecialStatus(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Assign Special Status - {assigningSpecialStatus?.nameOrNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="special-status-select">Special Status</Label>
                  <Select value={selectedSpecialStatusId} onValueChange={setSelectedSpecialStatusId}>
                    <SelectTrigger id="special-status-select">
                      <SelectValue placeholder="Select a special status or leave empty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Remove special status)</SelectItem>
                      {specialStatuses
                        .filter(status => status.isActive)
                        .map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: status.color }}
                              />
                              {status.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p><strong>Park:</strong> {assigningSpecialStatus?.park?.name || 'Unknown'}</p>
                  {assigningSpecialStatus?.specialStatus && (
                    <div className="flex items-center gap-2 mt-2">
                      <span>Current status:</span>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: assigningSpecialStatus.specialStatus.color }}
                        />
                        <span className="font-medium">{assigningSpecialStatus.specialStatus.name}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssigningSpecialStatus(null)}
                    data-testid="cancel-assign-special-status"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmSpecialStatusAssignment}
                    disabled={assignSpecialStatusMutation.isPending}
                    data-testid="confirm-assign-special-status"
                  >
                    {assignSpecialStatusMutation.isPending ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}