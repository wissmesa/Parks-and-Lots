import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PhotoManagement } from "@/components/ui/photo-management";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Home, Plus, Edit, Trash2, DollarSign, Camera, Eye, EyeOff, Tag } from "lucide-react";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: 'FOR_RENT' | 'FOR_SALE' | 'RENT_SALE';
  price: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqFt: number | null;
  isActive: boolean;
  parkId: string;
  createdAt: string;
  specialStatusId?: string | null;
  park?: {
    name: string;
  };
  specialStatus?: {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
  } | null;
}

interface Park {
  id: string;
  name: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
}

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
}

export default function AdminLots() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [formData, setFormData] = useState({
    nameOrNumber: "",
    status: "FOR_RENT" as 'FOR_RENT' | 'FOR_SALE' | 'RENT_SALE',
    price: "",
    description: "",
    bedrooms: "",
    bathrooms: "",
    sqFt: "",
    parkId: ""
  });
  const [showPhotos, setShowPhotos] = useState<string | null>(null);
  const [assigningSpecialStatus, setAssigningSpecialStatus] = useState<Lot | null>(null);
  const [selectedSpecialStatusId, setSelectedSpecialStatusId] = useState<string>("");

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    window.location.href = '/';
    return null;
  }

  const { data: lots, isLoading } = useQuery<{ lots: Lot[] }>({
    queryKey: ["/api/lots", "includeInactive=true"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/lots?includeInactive=true");
      return response.json();
    },
    enabled: user?.role === 'ADMIN',
  });

  const { data: parks } = useQuery<{ parks: Park[] }>({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === 'ADMIN',
  });

  // Special statuses query for the selected park
  const { data: specialStatuses = [] } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", assigningSpecialStatus?.parkId, "special-statuses"],
    enabled: !!assigningSpecialStatus?.parkId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
        bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
        sqFt: data.sqFt ? parseInt(data.sqFt) : null,
        isActive: true
      };
      return apiRequest("POST", "/api/lots", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Lot created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create lot",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
        bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
        sqFt: data.sqFt ? parseInt(data.sqFt) : null,
      };
      return apiRequest("PATCH", `/api/lots/${editingLot?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      setEditingLot(null);
      resetForm();
      toast({
        title: "Success",
        description: "Lot updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lot",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      toast({
        title: "Success",
        description: "Lot deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lot",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/lots/${id}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      toast({
        title: "Success",
        description: "Lot visibility updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lot visibility",
        variant: "destructive",
      });
    },
  });

  const assignSpecialStatusMutation = useMutation({
    mutationFn: async ({ lotId, specialStatusId }: { lotId: string; specialStatusId: string | null }) => {
      return apiRequest("PUT", `/api/lots/${lotId}/special-status`, { specialStatusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
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

  const resetForm = () => {
    setFormData({
      nameOrNumber: "",
      status: "FOR_RENT",
      price: "",
      description: "",
      bedrooms: "",
      bathrooms: "",
      sqFt: "",
      parkId: ""
    });
  };

  const handleEdit = (lot: Lot) => {
    setEditingLot(lot);
    setFormData({
      nameOrNumber: lot.nameOrNumber,
      status: lot.status,
      price: lot.price,
      description: lot.description || "",
      bedrooms: lot.bedrooms?.toString() || "",
      bathrooms: lot.bathrooms?.toString() || "",
      sqFt: lot.sqFt?.toString() || "",
      parkId: lot.parkId
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLot) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
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

  const lotsList = lots?.lots ?? [];
  const parksList = parks?.parks ?? [];
  const companiesList = companies ?? [];
  
  // Create efficient lookup maps for relationships
  const parkById = new Map(parksList.map(p => [p.id, p]));
  const companyById = new Map(companiesList.map(c => [c.id, c]));

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Home className="w-8 h-8" />
                Lots
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage individual lots and properties
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lot
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Lot</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nameOrNumber">Lot Name/Number</Label>
                    <Input
                      id="nameOrNumber"
                      value={formData.nameOrNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="parkId">Park</Label>
                    <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        {parksList.map((park: Park) => (
                          <SelectItem key={park.id} value={park.id}>
                            {park.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <Input
                        id="bedrooms"
                        type="number"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <Input
                        id="bathrooms"
                        type="number"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sqFt">Sq Ft</Label>
                      <Input
                        id="sqFt"
                        type="number"
                        value={formData.sqFt}
                        onChange={(e) => setFormData(prev => ({ ...prev, sqFt: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Lots</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading lots...</p>
              </div>
            ) : lotsList.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No lots found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Park</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotsList.map((lot: Lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <div className="font-medium">{lot.nameOrNumber}</div>
                        <div className="text-sm text-muted-foreground">{lot.description}</div>
                        {lot.specialStatus && (
                          <div className="flex items-center gap-1 mt-1">
                            <div
                              className="w-2 h-2 rounded-full border"
                              style={{ backgroundColor: lot.specialStatus.color }}
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {lot.specialStatus.name}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {lot.park?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(() => {
                            const park = parkById.get(lot.parkId);
                            const company = park?.companyId ? companyById.get(park.companyId) : null;
                            return company?.name || 'Unknown';
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lot.status === 'FOR_RENT' ? 'default' : lot.status === 'RENT_SALE' ? 'secondary' : 'outline'}>
                          {lot.status === 'FOR_RENT' ? 'For Rent' : lot.status === 'FOR_SALE' ? 'For Sale' : 'Rent/Sale'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lot.isActive ? 'default' : 'secondary'}>
                          {lot.isActive ? 'Visible' : 'Hidden'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          <span>{parseInt(lot.price).toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lot.bedrooms && <span>{lot.bedrooms}br </span>}
                          {lot.bathrooms && <span>{lot.bathrooms}ba </span>}
                          {lot.sqFt && <span>{lot.sqFt}sqft</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(lot)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowPhotos(lot.id)}
                            title="Manage Photos"
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignSpecialStatus(lot)}
                            title="Assign Special Status"
                            data-testid={`assign-special-status-${lot.id}`}
                          >
                            <Tag className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleMutation.mutate(lot.id)}
                            disabled={toggleMutation.isPending}
                            title={lot.isActive ? "Hide lot" : "Show lot"}
                            data-testid={`toggle-lot-${lot.id}`}
                          >
                            {lot.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this lot?")) {
                                deleteMutation.mutate(lot.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingLot} onOpenChange={(open) => !open && setEditingLot(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Lot</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="edit-parkId">Park</Label>
                <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a park" />
                  </SelectTrigger>
                  <SelectContent>
                    {parksList.map((park: Park) => (
                      <SelectItem key={park.id} value={park.id}>
                        {park.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                  <Label htmlFor="edit-price">Price</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                  <Input
                    id="edit-bedrooms"
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                  <Input
                    id="edit-bathrooms"
                    type="number"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-sqFt">Sq Ft</Label>
                  <Input
                    id="edit-sqFt"
                    type="number"
                    value={formData.sqFt}
                    onChange={(e) => setFormData(prev => ({ ...prev, sqFt: e.target.value }))}
                  />
                </div>
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
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingLot(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Photo Management Dialog */}
        <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Photos - {lotsList.find(l => l.id === showPhotos)?.nameOrNumber}
              </DialogTitle>
            </DialogHeader>
            {showPhotos && (
              <PhotoManagement 
                entityType="LOT"
                entityId={showPhotos}
                entityName={lotsList.find(l => l.id === showPhotos)?.nameOrNumber || 'Lot'}
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
      </div>
    </div>
  );
}