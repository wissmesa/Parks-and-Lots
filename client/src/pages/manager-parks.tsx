import { useState, useEffect, useMemo } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { TreePine, Edit, MapPin, Camera, X, Plus, Tag, MoreHorizontal, List, Grid3X3, Facebook, ArrowUp, ArrowDown, Filter, Search, Trash2, Home } from "lucide-react";
import { FacebookPostDialog } from "@/components/ui/facebook-post-dialog";
import { AMENITY_ICON_OPTIONS, getAmenityIcon, type AmenityType } from "@/pages/park-detail";

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
  lotRent?: string;
  createdAt: string;
  amenities?: AmenityType[];
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
    lotRent: "",
    amenities: [] as AmenityType[]
  });
  const [originalLotRent, setOriginalLotRent] = useState<string>("");
  const [showLotRentConfirm, setShowLotRentConfirm] = useState(false);
  const [newAmenity, setNewAmenity] = useState({ name: '', icon: 'check' });
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

  // Search and sort state
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtering state
  const [filters, setFilters] = useState({
    city: [] as string[],
    state: [] as string[],
  });

  // Filter helper functions
  const toggleFilter = (category: keyof typeof filters, value: string) => {
    if (Array.isArray(filters[category])) {
      const currentValues = filters[category] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setFilters(prev => ({ ...prev, [category]: newValues }));
    }
  };

  const clearAllFilters = () => {
    setFilters({
      city: [],
      state: [],
    });
    setSearchText("");
  };

  const hasActiveFilters = () => {
    return filters.city.length > 0 ||
           filters.state.length > 0 ||
           searchText.trim() !== "";
  };

  // Facebook post dialog state
  const [facebookPostDialog, setFacebookPostDialog] = useState<{
    isOpen: boolean;
    park: Park | null;
  }>({
    isOpen: false,
    park: null
  });

  // Redirect if not manager
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN' && user?.role !== 'MHP_LORD') {
    window.location.href = '/';
    return null;
  }

  const isCompanyManager = user?.role === 'ADMIN';
  
  console.log('Manager Parks - User role:', user?.role);
  console.log('Manager Parks - isCompanyManager:', isCompanyManager);

  const { data: assignments, isLoading: assignmentsLoading, error } = useQuery<Assignment[]>({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  const { data: companyParksResponse, isLoading: companyParksLoading } = useQuery<{parks: Park[]}>({
    queryKey: ["/api/company-manager/parks"],
    enabled: user?.role === 'ADMIN',
  });

  // Get park IDs from assignments or company parks
  const parkIds = isCompanyManager 
    ? (companyParksResponse?.parks?.map(p => p.id) || [])
    : (assignments?.map(a => a.parkId) || []);
  
  const { data: parksResponse, isLoading: parksLoading } = useQuery<{parks: Park[]}>({
    queryKey: ["/api/parks"],
    enabled: !isCompanyManager && parkIds.length > 0,
  });

  const allParks = isCompanyManager 
    ? (companyParksResponse?.parks || [])
    : (parksResponse?.parks || []);
  const isLoading = isCompanyManager 
    ? companyParksLoading 
    : (assignmentsLoading || parksLoading);

  // Filter parks to only show assigned ones
  const parks = allParks?.filter(park => parkIds.includes(park.id)) || [];

  // Fetch lots for company managers (for assign lots feature)
  const { data: lotsData } = useQuery<any[]>({
    queryKey: ["/api/company-manager/lots"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/company-manager/lots");
      const data = await response.json();
      console.log('Company Manager Lots Response:', data);
      return data;
    },
    enabled: isCompanyManager,
  });

  const lotsList = lotsData || [];
  
  console.log('Lots List for Assignment:', lotsList);
  console.log('Lots List Length:', lotsList.length);

  // Get unique values for filters
  const uniqueCities = useMemo(() => {
    const cities = new Set(parks.map(park => park.city).filter(Boolean));
    return Array.from(cities).sort();
  }, [parks]);

  const uniqueStates = useMemo(() => {
    const states = new Set(parks.map(park => park.state).filter(Boolean));
    return Array.from(states).sort();
  }, [parks]);

  // Apply filtering and sorting
  const filteredAndSortedParks = useMemo(() => {
    if (!parks) return [];

    // Apply filters
    let filtered = parks.filter((park) => {
      // Search text filter
      if (searchText.trim()) {
        const search = searchText.toLowerCase();
        const matchesName = park.name?.toLowerCase().includes(search);
        const matchesCity = park.city?.toLowerCase().includes(search);
        const matchesState = park.state?.toLowerCase().includes(search);
        const matchesAddress = park.address?.toLowerCase().includes(search);
        const matchesDescription = park.description?.toLowerCase().includes(search);
        
        if (!matchesName && !matchesCity && !matchesState && !matchesAddress && !matchesDescription) {
          return false;
        }
      }

      // City filter
      if (filters.city.length > 0 && !filters.city.includes(park.city)) {
        return false;
      }

      // State filter
      if (filters.state.length > 0 && !filters.state.includes(park.state)) {
        return false;
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        case "city":
          aValue = a.city?.toLowerCase() || "";
          bValue = b.city?.toLowerCase() || "";
          break;
        case "state":
          aValue = a.state?.toLowerCase() || "";
          bValue = b.state?.toLowerCase() || "";
          break;
        default:
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [parks, searchText, filters, sortBy, sortOrder]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/parks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/parks"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Park created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Create park error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create park. Please ensure all required fields are filled in.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Helper to convert empty strings to null for optional fields
      const toStringOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        return String(value);
      };
      
      // Clean up the data before sending
      const cleanedData = {
        ...data,
        description: toStringOrNull(data.description),
        meetingPlace: toStringOrNull(data.meetingPlace),
        lotRent: toStringOrNull(data.lotRent),
      };
      
      return apiRequest("PATCH", `/api/parks/${editingPark?.id}`, cleanedData);
    },
    onSuccess: async () => {
      // Force immediate refetch of queries before closing dialog
      await queryClient.refetchQueries({ queryKey: ["/api/manager/assignments"] });
      await queryClient.refetchQueries({ queryKey: ["/api/parks"] });
      await queryClient.refetchQueries({ queryKey: ["/api/company-manager/parks"] });
      // Invalidate lots queries for real-time updates when lot rent changes
      await queryClient.refetchQueries({ queryKey: ["/api/manager/lots"] });
      await queryClient.refetchQueries({ queryKey: ["/api/company-manager/lots"] });
      setEditingPark(null);
      resetForm();
      toast({
        title: "Success",
        description: "Park updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Park update error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update park",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (parkId: string) => {
      return apiRequest("DELETE", `/api/parks/${parkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/parks"] });
      toast({
        title: "Success",
        description: "Park deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Delete park error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete park. This park may have associated lots or other data.",
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
      lotRent: "",
      amenities: []
    });
    setOriginalLotRent("");
    setNewAmenity({ name: '', icon: 'check' });
  };

  const availableColors = [
    { color: '#EF4444', name: 'Red' },
    { color: '#F97316', name: 'Orange' },
    { color: '#F59E0B', name: 'Amber' },
    { color: '#EAB308', name: 'Yellow' },
    { color: '#84CC16', name: 'Lime' },
    { color: '#22C55E', name: 'Green' },
    { color: '#10B981', name: 'Emerald' },
    { color: '#14B8A6', name: 'Teal' },
    { color: '#06B6D4', name: 'Cyan' },
    { color: '#0EA5E9', name: 'Sky' },
    { color: '#3B82F6', name: 'Blue' },
    { color: '#6366F1', name: 'Indigo' },
    { color: '#8B5CF6', name: 'Violet' },
    { color: '#A855F7', name: 'Purple' },
    { color: '#D946EF', name: 'Fuchsia' },
    { color: '#EC4899', name: 'Pink' },
    { color: '#F43F5E', name: 'Rose' },
    { color: '#64748B', name: 'Slate' },
    { color: '#6B7280', name: 'Gray' },
    { color: '#78716C', name: 'Stone' }
  ];

  const getFirstAvailableColor = () => {
    const usedColors = specialStatuses.map(s => s.color);
    const availableColor = availableColors.find(c => !usedColors.includes(c.color));
    return availableColor ? availableColor.color : "#3B82F6";
  };

  const resetStatusForm = () => {
    setStatusFormData({
      name: "",
      color: getFirstAvailableColor(),
      isActive: true
    });
  };

  const handleEdit = (park: Park) => {
    setEditingPark(park);
    // Convert old string format amenities to new object format
    const convertedAmenities = (park.amenities || []).map(amenity => {
      if (typeof amenity === 'string') {
        return { name: amenity, icon: 'check' };
      }
      // If it's already an object, ensure it has name and icon properties
      if (typeof amenity === 'object' && amenity !== null) {
        return {
          name: amenity.name || '',
          icon: amenity.icon || 'check'
        };
      }
      // Fallback for unexpected types
      return { name: '', icon: 'check' };
    });
    
    // Ensure lotRent is properly converted to string
    const lotRentValue = park.lotRent ? String(park.lotRent) : "";
    
    setFormData({
      name: park.name,
      description: park.description,
      meetingPlace: park.meetingPlace || "",
      address: park.address,
      city: park.city,
      state: park.state,
      zip: park.zip,
      lotRent: lotRentValue,
      amenities: convertedAmenities
    });
    setOriginalLotRent(lotRentValue);
    setNewAmenity({ name: '', icon: 'check' });
  };

  const handleAssignLots = (park: Park) => {
    setAssigningLots(park);
    setLotSearchText("");
    // Pre-select lots already assigned to this park
    const currentLots = lotsList.filter(lot => lot.parkId === park.id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-add any pending amenity before saving
    let finalFormData = { ...formData };
    if (newAmenity?.name?.trim()) {
      finalFormData = {
        ...formData,
        amenities: [...formData.amenities, { name: newAmenity.name.trim(), icon: newAmenity.icon }]
      };
      // Update the form state to include the new amenity
      setFormData(finalFormData);
      setNewAmenity({ name: '', icon: 'check' }); // Clear the input
    }
    
    // Clean up empty string fields (convert to undefined so they're not sent)
    const cleanedData = Object.fromEntries(
      Object.entries(finalFormData).map(([key, value]) => [
        key,
        value === '' ? undefined : value
      ])
    );
    
    // Check if lot rent has changed and we're editing
    if (editingPark && finalFormData.lotRent !== originalLotRent) {
      setShowLotRentConfirm(true);
      return;
    }
    
    if (editingPark) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleConfirmLotRentUpdate = () => {
    setShowLotRentConfirm(false);
    updateMutation.mutate(formData);
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

  // Special status queries and mutations
  const { data: specialStatuses = [], isLoading: statusesLoading } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", manageSpecialStatuses?.id, "special-statuses"],
    enabled: !!manageSpecialStatuses?.id,
  });

  // Reset form with first available color when opening dialog for new status
  useEffect(() => {
    if (manageSpecialStatuses && !editingStatus) {
      resetStatusForm();
    }
  }, [manageSpecialStatuses, specialStatuses]);

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

  const assignLotsMutation = useMutation({
    mutationFn: async ({ parkId, lotIds }: { parkId: string; lotIds: string[] }) => {
      return Promise.all(
        lotIds.map(lotId => 
          apiRequest("PATCH", `/api/lots/${lotId}`, { parkId })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/parks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/lots"] });
      setAssigningLots(null);
      setSelectedLotIds([]);
      toast({
        title: "Success",
        description: "Lots assigned successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign lots",
        variant: "destructive",
      });
    },
  });

  // Filtered lots for assignment dialog
  const filteredLotsForAssignment = useMemo(() => {
    if (!lotSearchText.trim()) return lotsList;
    
    const searchLower = lotSearchText.toLowerCase();
    return lotsList.filter(lot => {
      const matchesName = lot.nameOrNumber?.toLowerCase().includes(searchLower);
      const matchesDescription = lot.description?.toLowerCase().includes(searchLower);
      const currentPark = parks.find(p => p.id === lot.parkId);
      const matchesPark = currentPark?.name?.toLowerCase().includes(searchLower);
      
      return matchesName || matchesDescription || matchesPark;
    });
  }, [lotsList, lotSearchText, parks]);

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
            {isCompanyManager && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Park
              </Button>
            )}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="w-5 h-5" />
                    Parks ({filteredAndSortedParks.length}{parks.length !== filteredAndSortedParks.length ? ` of ${parks.length}` : ''})
                  </CardTitle>
                  
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

                {/* Search and Filter Controls */}
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search parks..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Sort Controls */}
                    <div className="flex items-center gap-2">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="city">City</SelectItem>
                          <SelectItem value="state">State</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="flex items-center gap-1"
                      >
                        {sortOrder === "asc" ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : (
                          <ArrowDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Filter Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Filter className="w-4 h-4" />
                          Filter
                          {hasActiveFilters() && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                              {(filters.city.length + filters.state.length) || ''}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Filters</h4>
                            {hasActiveFilters() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAllFilters}
                                className="h-auto p-0 text-xs"
                              >
                                Clear all
                              </Button>
                            )}
                          </div>

                          {/* City Filter */}
                          {uniqueCities.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">City</Label>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {uniqueCities.map((city) => (
                                  <div key={city} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`city-${city}`}
                                      checked={filters.city.includes(city)}
                                      onCheckedChange={() => toggleFilter("city", city)}
                                    />
                                    <label
                                      htmlFor={`city-${city}`}
                                      className="text-sm cursor-pointer flex-1"
                                    >
                                      {city}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* State Filter */}
                          {uniqueStates.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">State</Label>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {uniqueStates.map((state) => (
                                  <div key={state} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`state-${state}`}
                                      checked={filters.state.includes(state)}
                                      onCheckedChange={() => toggleFilter("state", state)}
                                    />
                                    <label
                                      htmlFor={`state-${state}`}
                                      className="text-sm cursor-pointer flex-1"
                                    >
                                      {state}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'list' ? (
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
                    {filteredAndSortedParks.map((park) => (
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
                              {park?.city || 'N/A'}, {park?.state || 'N/A'} {park?.zip || ''}
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
                              {isCompanyManager && (
                                <DropdownMenuItem
                                  onClick={() => park && handleAssignLots(park)}
                                  data-testid={`assign-lots-${park?.id || 'unknown'}`}
                                >
                                  <Home className="w-4 h-4 mr-2" />
                                  Assign Lots
                                </DropdownMenuItem>
                              )}
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
                              {isCompanyManager && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (park?.id && confirm("Are you sure you want to delete this park?")) {
                                      deleteMutation.mutate(park.id);
                                    }
                                  }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`delete-park-${park?.id || 'unknown'}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Park
                                </DropdownMenuItem>
                              )}
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
                    {filteredAndSortedParks.map((park) => (
                      <Card key={park?.id || Math.random()} className="transition-all hover:shadow-md">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-1">{park?.name || 'Unknown Park'}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {park?.description || 'No description available'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Company badge */}
                          <div className="mb-3">
                            <Badge variant="outline">
                              {park?.company?.name || 'No Company'}
                            </Badge>
                          </div>
                          
                          {/* Location */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span className="font-medium">
                                {park?.city || 'N/A'}, {park?.state || 'N/A'}
                              </span>
                            </div>
                            {park?.address && (
                              <p className="text-sm text-muted-foreground">{park.address}</p>
                            )}
                            {park?.zip && (
                              <p className="text-sm text-muted-foreground">ZIP: {park.zip}</p>
                            )}
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="w-full" disabled={!park}>
                                Actions
                                <MoreHorizontal className="w-4 h-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => park && handleEdit(park)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Park
                              </DropdownMenuItem>
                              {isCompanyManager && (
                                <DropdownMenuItem onClick={() => park && handleAssignLots(park)}>
                                  <Home className="w-4 h-4 mr-2" />
                                  Assign Lots
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => park?.id && setShowPhotos(park.id)}>
                                <Camera className="w-4 h-4 mr-2" />
                                Manage Photos
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => park && setManageSpecialStatuses(park)}>
                                <Tag className="w-4 h-4 mr-2" />
                                Special Statuses
                              </DropdownMenuItem>
                              {isCompanyManager && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (park?.id && confirm("Are you sure you want to delete this park?")) {
                                      deleteMutation.mutate(park.id);
                                    }
                                  }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`delete-park-card-${park?.id || 'unknown'}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Park
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create Park Dialog (ADMIN only) */}
          {isCompanyManager && (
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogContent className="max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Park</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="create-name">Park Name</Label>
                    <Input
                      id="create-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="input-park-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-description">Description</Label>
                    <Textarea
                      id="create-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="input-park-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-meetingPlace">Meeting Place</Label>
                    <Textarea
                      id="create-meetingPlace"
                      value={formData.meetingPlace}
                      onChange={(e) => setFormData({ ...formData, meetingPlace: e.target.value })}
                      rows={2}
                      placeholder="Describe where to meet for showings (e.g., front office, clubhouse)"
                      data-testid="input-park-meeting-place"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-address">Address</Label>
                    <Input
                      id="create-address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      data-testid="input-park-address"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="create-city">City</Label>
                      <Input
                        id="create-city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        data-testid="input-park-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-state">State</Label>
                      <Input
                        id="create-state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        data-testid="input-park-state"
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-zip">ZIP Code</Label>
                      <Input
                        id="create-zip"
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        data-testid="input-park-zip"
                      />
                    </div>
                  </div>
                  
                  {/* Amenities Section */}
                  <div>
                    <Label>Amenities</Label>
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-1 gap-2">
                        {formData.amenities.map((amenity, index) => {
                          const amenityName = typeof amenity === 'string' ? amenity : (amenity?.name || '');
                          const amenityIcon = typeof amenity === 'object' && amenity?.icon ? amenity.icon : 'check';
                          const IconComponent = getAmenityIcon(amenityIcon);
                          
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <Select
                                value={amenityIcon}
                                onValueChange={(value) => {
                                  const newAmenities = [...formData.amenities];
                                  newAmenities[index] = typeof newAmenities[index] === 'string' 
                                    ? { name: newAmenities[index] as string, icon: value }
                                    : { ...(newAmenities[index] as any), icon: value };
                                  setFormData({ ...formData, amenities: newAmenities });
                                }}
                              >
                                <SelectTrigger className="w-[50px] px-2">
                                  <IconComponent className="w-4 h-4 mx-auto" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AMENITY_ICON_OPTIONS.map((option) => {
                                    const OptionIcon = option.icon;
                                    return (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <OptionIcon className="w-4 h-4" />
                                          <span>{option.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <Input 
                                value={amenityName}
                                onChange={(e) => {
                                  const newAmenities = [...formData.amenities];
                                  newAmenities[index] = typeof newAmenities[index] === 'string'
                                    ? { name: e.target.value, icon: 'check' }
                                    : { ...(newAmenities[index] as any), name: e.target.value };
                                  setFormData({ ...formData, amenities: newAmenities });
                                }}
                                placeholder="Amenity name"
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
                          );
                        })}
                      </div>
                      
                      <div className="flex gap-2">
                        <Select
                          value={newAmenity.icon}
                          onValueChange={(value) => setNewAmenity({ ...newAmenity, icon: value })}
                        >
                          <SelectTrigger className="w-[50px] px-2">
                            {(() => {
                              const IconComponent = getAmenityIcon(newAmenity.icon);
                              return <IconComponent className="w-4 h-4 mx-auto" />;
                            })()}
                          </SelectTrigger>
                          <SelectContent>
                            {AMENITY_ICON_OPTIONS.map((option) => {
                              const OptionIcon = option.icon;
                              return (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <OptionIcon className="w-4 h-4" />
                                    <span>{option.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Input 
                          placeholder="Add new amenity..."
                          value={newAmenity.name}
                          onChange={(e) => setNewAmenity({ ...newAmenity, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newAmenity?.name?.trim()) {
                                setFormData({ 
                                  ...formData, 
                                  amenities: [...formData.amenities, { name: newAmenity.name.trim(), icon: newAmenity.icon }] 
                                });
                                setNewAmenity({ name: '', icon: 'check' });
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
                            if (newAmenity?.name?.trim()) {
                              setFormData({ 
                                ...formData, 
                                amenities: [...formData.amenities, { name: newAmenity.name.trim(), icon: newAmenity.icon }] 
                              });
                              setNewAmenity({ name: '', icon: 'check' });
                            }
                          }}
                          disabled={!newAmenity?.name?.trim()}
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
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        resetForm();
                      }}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-submit-create">
                      Create Park
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit Park Dialog */}
          <Dialog open={!!editingPark} onOpenChange={(open) => !open && setEditingPark(null)}>
            <DialogContent className="max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
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
                  <Label htmlFor="meetingPlace">Meeting Place</Label>
                  <Textarea
                    id="meetingPlace"
                    value={formData.meetingPlace}
                    onChange={(e) => setFormData({ ...formData, meetingPlace: e.target.value })}
                    rows={2}
                    placeholder="Describe where to meet for showings (e.g., front office, clubhouse)"
                    data-testid="input-park-meeting-place"
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
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      required
                      data-testid="input-park-zip"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="lotRent">Default Lot Rent ($/month)</Label>
                  <MoneyInput
                    id="lotRent"
                    value={formData.lotRent}
                    onChange={(e) => setFormData({ ...formData, lotRent: e.target.value })}
                    placeholder="Monthly lot rent for all lots in this park"
                  />
                  {editingPark && formData.lotRent !== originalLotRent && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ⚠️ Changing this will update the lot rent for all lots in this park.
                    </p>
                  )}
                </div>
                
                {/* Amenities Section */}
                <div>
                  <Label>Amenities</Label>
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-1 gap-2">
                      {formData.amenities.map((amenity, index) => {
                        const amenityName = typeof amenity === 'string' ? amenity : (amenity?.name || '');
                        const amenityIcon = typeof amenity === 'object' && amenity?.icon ? amenity.icon : 'check';
                        const IconComponent = getAmenityIcon(amenityIcon);
                        
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <Select
                              value={amenityIcon}
                              onValueChange={(value) => {
                                const newAmenities = [...formData.amenities];
                                newAmenities[index] = typeof newAmenities[index] === 'string' 
                                  ? { name: newAmenities[index] as string, icon: value }
                                  : { ...(newAmenities[index] as any), icon: value };
                                setFormData({ ...formData, amenities: newAmenities });
                              }}
                            >
                              <SelectTrigger className="w-[50px] px-2">
                                <IconComponent className="w-4 h-4 mx-auto" />
                              </SelectTrigger>
                              <SelectContent>
                                {AMENITY_ICON_OPTIONS.map((option) => {
                                  const OptionIcon = option.icon;
                                  return (
                                    <SelectItem key={option.value} value={option.value}>
                                      <div className="flex items-center gap-2">
                                        <OptionIcon className="w-4 h-4" />
                                        <span>{option.label}</span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <Input 
                              value={amenityName}
                              onChange={(e) => {
                                const newAmenities = [...formData.amenities];
                                newAmenities[index] = typeof newAmenities[index] === 'string'
                                  ? { name: e.target.value, icon: 'check' }
                                  : { ...(newAmenities[index] as any), name: e.target.value };
                                setFormData({ ...formData, amenities: newAmenities });
                              }}
                              placeholder="Amenity name"
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
                        );
                      })}
                    </div>
                    
                    <div className="flex gap-2">
                      <Select
                        value={newAmenity.icon}
                        onValueChange={(value) => setNewAmenity({ ...newAmenity, icon: value })}
                      >
                        <SelectTrigger className="w-[50px] px-2">
                          {(() => {
                            const IconComponent = getAmenityIcon(newAmenity.icon);
                            return <IconComponent className="w-4 h-4 mx-auto" />;
                          })()}
                        </SelectTrigger>
                        <SelectContent>
                          {AMENITY_ICON_OPTIONS.map((option) => {
                            const OptionIcon = option.icon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <OptionIcon className="w-4 h-4" />
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Add new amenity..."
                        value={newAmenity.name}
                        onChange={(e) => setNewAmenity({ ...newAmenity, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newAmenity?.name?.trim()) {
                              setFormData({ 
                                ...formData, 
                                amenities: [...formData.amenities, { name: newAmenity.name.trim(), icon: newAmenity.icon }] 
                              });
                              setNewAmenity({ name: '', icon: 'check' });
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
                          if (newAmenity?.name?.trim()) {
                            setFormData({ 
                              ...formData, 
                              amenities: [...formData.amenities, { name: newAmenity.name.trim(), icon: newAmenity.icon }] 
                            });
                            setNewAmenity({ name: '', icon: 'check' });
                          }
                        }}
                        disabled={!newAmenity?.name?.trim()}
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

          {/* Assign Lots Dialog */}
          <Dialog open={!!assigningLots} onOpenChange={(open) => !open && setAssigningLots(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  Assign Lots to {assigningLots?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 overflow-hidden flex-1">
                <div className="flex-shrink-0">
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
                <div className="flex-1 overflow-y-auto space-y-2 border rounded-md p-3 min-h-0">
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
                              Currently assigned to: {parks.find(p => p.id === lot.parkId)?.name || 'Unassigned'}
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
                <div className="flex justify-between items-center pt-4 flex-shrink-0 border-t mt-4">
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
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleConfirmLotAssignment}
                      disabled={assignLotsMutation.isPending}
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
                        <Select
                          value={statusFormData.color}
                          onValueChange={(value) => setStatusFormData({ ...statusFormData, color: value })}
                        >
                          <SelectTrigger id="status-color" className="w-full" data-testid="select-status-color">
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded border"
                                  style={{ backgroundColor: statusFormData.color }}
                                />
                                <span className="font-mono">{statusFormData.color}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {availableColors.map(({ color, name }) => {
                              const existingStatus = specialStatuses.find(
                                s => s.color === color && s.id !== editingStatus?.id
                              );
                              const isDisabled = !!existingStatus;
                              
                              return (
                                <SelectItem key={color} value={color} disabled={isDisabled}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className={isDisabled ? 'text-muted-foreground' : ''}>{name}</span>
                                    <span className={`text-xs font-mono ml-auto ${isDisabled ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                      {color}
                                    </span>
                                    {isDisabled && (
                                      <span className="text-xs text-muted-foreground italic">
                                        (Used by {existingStatus.name})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
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

          {/* Facebook Post Dialog */}
          <FacebookPostDialog
            isOpen={facebookPostDialog.isOpen}
            onClose={() => setFacebookPostDialog({ isOpen: false, park: null })}
            parkName={facebookPostDialog.park?.name || ''}
            parkId={facebookPostDialog.park?.id}
            userId={user?.id}
          />

          {/* Lot Rent Confirmation Dialog */}
          <AlertDialog open={showLotRentConfirm} onOpenChange={setShowLotRentConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Update Lot Rent for All Lots?</AlertDialogTitle>
                <AlertDialogDescription>
                  Changing the lot rent of the park will change the lot rent of every lot in this park.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmLotRentUpdate}>
                  Update All Lots
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}