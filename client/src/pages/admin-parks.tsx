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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { TreePine, Plus, Edit, Trash2, MapPin, Camera, X, Home, Tag, MoreHorizontal, List, Grid3X3, Facebook } from "lucide-react";
import { FacebookPostDialog } from "@/components/ui/facebook-post-dialog";

interface Park {
  id: string;
  name: string;
  description: string;
  meetingPlace?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  companyId: string;
  createdAt: string;
  amenities?: string[];
  company?: {
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

interface Lot {
  id: string;
  nameOrNumber: string;
  parkId: string;
  park?: {
    name: string;
  };
}

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
}

export default function AdminParks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPark, setEditingPark] = useState<Park | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    meetingPlace: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    companyId: "",
    amenities: [] as string[]
  });
  const [newAmenity, setNewAmenity] = useState('');
  const [showPhotos, setShowPhotos] = useState<string | null>(null);
  const [assigningLots, setAssigningLots] = useState<Park | null>(null);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [lotSearchText, setLotSearchText] = useState("");
  const [manageSpecialStatuses, setManageSpecialStatuses] = useState<Park | null>(null);
  const [editingStatus, setEditingStatus] = useState<SpecialStatus | null>(null);
  const [statusFormData, setStatusFormData] = useState({
    name: "",
    color: "#3B82F6",
    isActive: true
  });

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // Facebook post dialog state
  const [facebookPostDialog, setFacebookPostDialog] = useState<{
    isOpen: boolean;
    park: Park | null;
  }>({
    isOpen: false,
    park: null
  });

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    window.location.href = '/';
    return null;
  }

  const { data: parks, isLoading } = useQuery<{ parks: Park[] }>({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: lots } = useQuery<{ lots: Lot[] }>({
    queryKey: ["/api/lots", "includeInactive=true", "limit=10000"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/lots?includeInactive=true&limit=10000");
      return response.json();
    },
    enabled: user?.role === 'ADMIN',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/parks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Park created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create park",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PATCH", `/api/parks/${editingPark?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/parks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      toast({
        title: "Success",
        description: "Park deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete park",
        variant: "destructive",
      });
    },
  });

  const assignLotsMutation = useMutation({
    mutationFn: async ({ parkId, lotIds }: { parkId: string; lotIds: string[] }) => {
      return Promise.all(
        lotIds.map(lotId => 
          apiRequest("PATCH", `/api/lots/${lotId}`, { parkId })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      setAssigningLots(null);
      setSelectedLotIds([]);
      toast({
        title: "Success",
        description: "Lots assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign lots",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      meetingPlace: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      companyId: "",
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
      meetingPlace: park.meetingPlace || "",
      address: park.address,
      city: park.city,
      state: park.state,
      zip: park.zip,
      companyId: park.companyId,
      amenities: park.amenities || []
    });
    setNewAmenity('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-add any pending amenity before saving
    let finalFormData = { ...formData };
    if (newAmenity.trim()) {
      finalFormData = {
        ...formData,
        amenities: [...formData.amenities, newAmenity.trim()]
      };
      // Update the form state to include the new amenity
      setFormData(finalFormData);
      setNewAmenity(''); // Clear the input
    }
    
    if (editingPark) {
      updateMutation.mutate(finalFormData);
    } else {
      createMutation.mutate(finalFormData);
    }
  };

  const handleAssignLots = (park: Park) => {
    setAssigningLots(park);
    setLotSearchText(""); // Reset search when opening dialog
    // Pre-select lots already assigned to this park
    const currentLots = lotsByParkId.get(park.id) || [];
    setSelectedLotIds(currentLots.map(lot => lot.id));
  };

  const handleLotSelection = (lotId: string, isChecked: boolean) => {
    setSelectedLotIds(prev => 
      isChecked 
        ? [...prev, lotId]
        : prev.filter(id => id !== lotId)
    );
  };

  const handleConfirmLotAssignment = () => {
    if (assigningLots) {
      assignLotsMutation.mutate({
        parkId: assigningLots.id,
        lotIds: selectedLotIds
      });
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
      name: status.name,
      color: status.color,
      isActive: status.isActive
    });
  };

  const handleDeleteStatus = (statusId: string) => {
    deleteStatusMutation.mutate(statusId);
  };

  const parksList = parks?.parks ?? [];
  const companiesList = companies ?? [];
  const lotsList = lots?.lots ?? [];
  
  // Filter lots for assignment dialog
  const filteredLotsForAssignment = lotsList.filter(lot => {
    if (!lotSearchText) return true;
    const searchLower = lotSearchText.toLowerCase();
    return (
      lot.nameOrNumber.toLowerCase().includes(searchLower) ||
      lot.description?.toLowerCase().includes(searchLower) ||
      parksList.find(p => p.id === lot.parkId)?.name.toLowerCase().includes(searchLower)
    );
  });

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
  
  // Create efficient lookup maps for relationships
  const companyById = new Map<string, Company>();
  companiesList.forEach(company => {
    companyById.set(company.id, company);
  });
  
  const lotsByParkId = new Map<string, Lot[]>();
  lotsList.forEach(lot => {
    if (!lotsByParkId.has(lot.parkId)) {
      lotsByParkId.set(lot.parkId, []);
    }
    lotsByParkId.get(lot.parkId)!.push(lot);
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <TreePine className="w-8 h-8" />
                Parks
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage park communities and locations
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Park
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Park</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Park Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyId">Company</Label>
                    <Select value={formData.companyId} onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companiesList.map((company: any) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div>
                    <Label htmlFor="meetingPlace">Meeting Place</Label>
                    <Textarea
                      id="meetingPlace"
                      value={formData.meetingPlace}
                      onChange={(e) => setFormData(prev => ({ ...prev, meetingPlace: e.target.value }))}
                      rows={2}
                      placeholder="Describe where to meet for showings (e.g., front office, clubhouse)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="zip">Zip Code</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))}
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
            <div className="flex items-center justify-between">
              <CardTitle>All Parks</CardTitle>
              
              {/* View Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-r-none border-r"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="rounded-l-none"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading parks...</p>
              </div>
            ) : parksList.length === 0 ? (
              <div className="text-center py-8">
                <TreePine className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No parks found</p>
              </div>
            ) : viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parksList.map((park: Park) => (
                    <TableRow key={park.id}>
                      <TableCell>
                        <div className="font-medium">{park.name}</div>
                        <div className="text-sm text-muted-foreground">{park.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {companyById.get(park.companyId)?.name ?? park.company?.name ?? 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{park.city}, {park.state}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{park.address}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {new Date(park.createdAt).toLocaleDateString()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`park-actions-${park.id}`}
                            >
                              Actions
                              <MoreHorizontal className="w-4 h-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEdit(park)}
                              data-testid={`edit-park-${park.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Park
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignLots(park)}
                              data-testid={`assign-lots-${park.id}`}
                            >
                              <Home className="w-4 h-4 mr-2" />
                              Assign Lots
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowPhotos(park.id)}
                              data-testid={`manage-photos-${park.id}`}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Manage Photos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setManageSpecialStatuses(park)}
                              data-testid={`manage-special-statuses-${park.id}`}
                            >
                              <Tag className="w-4 h-4 mr-2" />
                              Manage Special Statuses
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setFacebookPostDialog({ isOpen: true, park })}
                              data-testid={`facebook-post-${park.id}`}
                            >
                              <Facebook className="w-4 h-4 mr-2" />
                              Get Facebook Post
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this park?")) {
                                  deleteMutation.mutate(park.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-park-${park.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Park
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              // Card View
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {parksList.map((park: Park) => (
                  <Card key={park.id} className="transition-all hover:shadow-md">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">{park.name}</h3>
                          <p className="text-sm text-muted-foreground">{park.description}</p>
                        </div>
                      </div>
                      
                      {/* Company badge */}
                      <div className="mb-3">
                        <Badge variant="secondary">
                          {companyById.get(park.companyId)?.name ?? park.company?.name ?? 'Unknown'}
                        </Badge>
                      </div>
                      
                      {/* Location */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span className="font-medium">{park.city}, {park.state}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{park.address}</p>
                        {park.zip && (
                          <p className="text-sm text-muted-foreground">ZIP: {park.zip}</p>
                        )}
                      </div>
                      
                      {/* Created date */}
                      <div className="mt-3">
                        <Badge variant="outline" className="text-xs">
                          Created {new Date(park.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full">
                            Actions
                            <MoreHorizontal className="w-4 h-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(park)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowPhotos(park.id)}>
                            <Camera className="w-4 h-4 mr-2" />
                            Manage Photos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAssigningLots(park)}>
                            <Home className="w-4 h-4 mr-2" />
                            Assign Lots
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setManageSpecialStatuses(park)}>
                            <Tag className="w-4 h-4 mr-2" />
                            Special Statuses
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFacebookPostDialog({ isOpen: true, park })}>
                            <Facebook className="w-4 h-4 mr-2" />
                            Get Facebook Post
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deletePark(park.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Park
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingPark} onOpenChange={(open) => !open && setEditingPark(null)}>
          <DialogContent className="max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Park</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Park Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-companyId">Company</Label>
                <Select value={formData.companyId} onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesList.map((company: Company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
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
              <div>
                <Label htmlFor="edit-meetingPlace">Meeting Place</Label>
                <Textarea
                  id="edit-meetingPlace"
                  value={formData.meetingPlace}
                  onChange={(e) => setFormData(prev => ({ ...prev, meetingPlace: e.target.value }))}
                  rows={2}
                  placeholder="Describe where to meet for showings (e.g., front office, clubhouse)"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-zip">Zip Code</Label>
                <Input
                  id="edit-zip"
                  value={formData.zip}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                />
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
                <Button type="button" variant="outline" onClick={() => setEditingPark(null)}>
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
                Manage Photos - {parksList.find(p => p.id === showPhotos)?.name}
              </DialogTitle>
            </DialogHeader>
            {showPhotos && (
              <PhotoManagement 
                entityType="PARK"
                entityId={showPhotos}
                entityName={parksList.find(p => p.id === showPhotos)?.name || 'Park'}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Lot Assignment Dialog */}
        <Dialog open={!!assigningLots} onOpenChange={(open) => !open && setAssigningLots(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                Assign Lots to {assigningLots?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Select lots to assign to this park. You can search to find specific lots.
                </p>
                
                {/* Search Input */}
                <div className="relative">
                  <Input
                    placeholder="Search lots by name, description, or current park..."
                    value={lotSearchText}
                    onChange={(e) => setLotSearchText(e.target.value)}
                    className="mb-3"
                  />
                  <div className="text-xs text-muted-foreground mb-2">
                    Showing {filteredLotsForAssignment.length} of {lotsList.length} lots
                    {selectedLotIds.length > 0 && ` • ${selectedLotIds.length} selected`}
                  </div>
                </div>
              </div>
              
              {/* Lots List */}
              <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-3">
                {filteredLotsForAssignment.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {lotSearchText ? 'No lots found matching your search.' : 'No lots available.'}
                  </div>
                ) : (
                  filteredLotsForAssignment.map(lot => (
                    <div key={lot.id} className="flex items-start space-x-2 p-2 hover:bg-muted/50 rounded">
                      <input
                        type="checkbox"
                        id={`lot-${lot.id}`}
                        checked={selectedLotIds.includes(lot.id)}
                        onChange={(e) => handleLotSelection(lot.id, e.target.checked)}
                        className="rounded border-gray-300 mt-1"
                        data-testid={`checkbox-lot-${lot.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`lot-${lot.id}`} className="text-sm font-medium cursor-pointer block">
                          {lot.nameOrNumber}
                        </Label>
                        {lot.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {lot.description}
                          </p>
                        )}
                        {lot.parkId !== assigningLots?.id && (
                          <p className="text-xs text-amber-600 mt-1">
                            Currently assigned to: {parksList.find(p => p.id === lot.parkId)?.name || 'Unassigned'}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {lot.bedrooms} bed • {lot.bathrooms} bath • {lot.sqFt} sq ft
                          {lot.price && ` • $${parseInt(lot.price).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentlyAssigned = lotsList.filter(lot => lot.parkId === assigningLots?.id).map(lot => lot.id);
                      setSelectedLotIds(currentlyAssigned);
                    }}
                  >
                    Reset to Current
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedLotIds([])}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssigningLots(null)}
                    data-testid="cancel-assign-lots"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmLotAssignment}
                    disabled={assignLotsMutation.isPending}
                    data-testid="confirm-assign-lots"
                  >
                    {assignLotsMutation.isPending ? "Assigning..." : "Assign Lots"}
                  </Button>
                </div>
              </div>
            </div>
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
              <Card>
                <CardHeader>
                  <CardTitle>{editingStatus ? "Edit" : "Create"} Special Status</CardTitle>
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
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createStatusMutation.isPending || updateStatusMutation.isPending}
                        data-testid="button-save-status"
                      >
                        {createStatusMutation.isPending || updateStatusMutation.isPending 
                          ? "Saving..." 
                          : editingStatus ? "Update" : "Create"}
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
                      {specialStatuses.map((status) => (
                        <div
                          key={status.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: status.color }}
                            />
                            <div>
                              <div className="font-medium">{status.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {status.isActive ? "Active" : "Inactive"} • {status.color}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditStatus(status)}
                              data-testid={`button-edit-status-${status.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteStatus(status.id)}
                              disabled={deleteStatusMutation.isPending}
                              data-testid={`button-delete-status-${status.id}`}
                            >
                              {deleteStatusMutation.isPending ? "..." : <X className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        {/* Facebook Post Dialog */}
        <FacebookPostDialog
          isOpen={facebookPostDialog.isOpen}
          onClose={() => setFacebookPostDialog({ isOpen: false, park: null })}
          parkName={facebookPostDialog.park?.name || ''}
          parkId={facebookPostDialog.park?.id}
          userId={user?.id}
        />
      </div>
    </div>
  );
}