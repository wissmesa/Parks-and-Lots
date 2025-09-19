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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { Home, Plus, Edit, Trash2, DollarSign, Camera, Eye, EyeOff, Tag, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

  // Sorting state
  const [sortBy, setSortBy] = useState<string>("nameOrNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtering state
  const [filters, setFilters] = useState({
    status: [] as string[],
    visibility: [] as string[],
    parkId: [] as string[],
    companyId: [] as string[],
    specialStatusId: [] as string[],
    priceMin: "",
    priceMax: "",
    bedroomsMin: "",
    bedroomsMax: "",
    bathroomsMin: "",
    bathroomsMax: "",
    sqFtMin: "",
    sqFtMax: "",
    searchText: ""
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

  const updateRangeFilter = (category: string, value: string) => {
    setFilters(prev => ({ ...prev, [category]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      visibility: [],
      parkId: [],
      companyId: [],
      specialStatusId: [],
      priceMin: "",
      priceMax: "",
      bedroomsMin: "",
      bedroomsMax: "",
      bathroomsMin: "",
      bathroomsMax: "",
      sqFtMin: "",
      sqFtMax: "",
      searchText: ""
    });
  };

  const hasActiveFilters = () => {
    return filters.status.length > 0 ||
           filters.visibility.length > 0 ||
           filters.parkId.length > 0 ||
           filters.companyId.length > 0 ||
           filters.specialStatusId.length > 0 ||
           filters.priceMin ||
           filters.priceMax ||
           filters.bedroomsMin ||
           filters.bedroomsMax ||
           filters.bathroomsMin ||
           filters.bathroomsMax ||
           filters.sqFtMin ||
           filters.sqFtMax ||
           filters.searchText;
  };

  // Bulk upload state
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadStep, setBulkUploadStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'results'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);

  // File upload and parsing functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || []);
          setParsedData(results.data);
          setBulkUploadStep('mapping');
        },
        error: (error) => {
          toast({
            title: "Error parsing CSV",
            description: error.message,
            variant: "destructive"
          });
        }
      });
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1);
            const formattedData = rows.map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = (row as any[])[index] || '';
              });
              return obj;
            });
            
            setCsvHeaders(headers);
            setParsedData(formattedData);
            setBulkUploadStep('mapping');
          }
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Please check the file format and try again",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
    }
  };

  const handleColumnMapping = () => {
    const requiredFields = ['nameOrNumber', 'status'];
    const missingFields = requiredFields.filter(field => !columnMapping[field] || columnMapping[field] === 'skip');
    
    // Park name is required - park ID is only an optional fallback
    if (!columnMapping['parkName'] || columnMapping['parkName'] === 'skip') {
      missingFields.push('parkName (required - Park ID alone is not sufficient)');
    }
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing required mappings",
        description: `Please map: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Transform data using column mapping
    const transformedData = parsedData.map(row => {
      const transformed: any = {};
      Object.entries(columnMapping).forEach(([lotField, csvField]) => {
        if (csvField && csvField !== 'skip') {
          transformed[lotField] = row[csvField];
        }
      });
      return transformed;
    });
    
    setMappedData(transformedData);
    setBulkUploadStep('preview');
  };

  const bulkUploadMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return await apiRequest('POST', '/api/admin/lots/bulk', { lots: data });
    },
    onSuccess: async (response) => {
      const results = await response.json();
      setImportResults(results);
      setImportProgress(100);
      
      // Refresh lots data
      queryClient.invalidateQueries({ queryKey: ['/api/lots'] });
      
      // Switch to results step after a brief delay
      setTimeout(() => {
        setBulkUploadStep('results');
      }, 500);
      
      toast({
        title: "Bulk upload completed",
        description: `Successfully processed ${results.successful?.length || 0} of ${mappedData.length} lots`,
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleStartImport = () => {
    setBulkUploadStep('importing');
    setImportProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90; // Will be set to 100% in onSuccess
        }
        return prev + 10;
      });
    }, 300);

    bulkUploadMutation.mutate(mappedData);
  };

  const resetBulkUpload = () => {
    setIsBulkUploadOpen(false);
    setBulkUploadStep('upload');
    setUploadedFile(null);
    setParsedData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setMappedData([]);
    setImportProgress(0);
    setImportResults(null);
  };

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

  const rawLotsList = lots?.lots ?? [];
  const parksList = parks?.parks ?? [];
  const companiesList = companies ?? [];
  
  // Create efficient lookup maps for relationships
  const parkById = new Map(parksList.map(p => [p.id, p]));
  const companyById = new Map(companiesList.map(c => [c.id, c]));

  // Filtering function
  const filterLots = (lotsToFilter: Lot[]) => {
    return lotsToFilter.filter((lot) => {
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(lot.status)) {
        return false;
      }

      // Visibility filter
      if (filters.visibility.length === 1) {
        const isVisible = lot.isActive;
        const wantsVisible = filters.visibility.includes("visible");
        if (isVisible !== wantsVisible) return false;
      }

      // Park filter
      if (filters.parkId.length > 0 && !filters.parkId.includes(lot.parkId)) {
        return false;
      }

      // Company filter
      if (filters.companyId.length > 0) {
        const park = parkById.get(lot.parkId);
        const companyId = park?.companyId;
        if (!companyId || !filters.companyId.includes(companyId)) {
          return false;
        }
      }

      // Special status filter
      if (filters.specialStatusId.length > 0) {
        const hasSpecialStatus = lot.specialStatusId && filters.specialStatusId.includes(lot.specialStatusId);
        const wantsNone = filters.specialStatusId.includes("none");
        if (!hasSpecialStatus && !wantsNone) return false;
        if (hasSpecialStatus && wantsNone && lot.specialStatusId) return false;
      }

      // Price range filter
      if (filters.priceMin || filters.priceMax) {
        const price = parseFloat((lot.price || '').toString().replace(/[^\d.-]/g, '')) || 0;
        if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
        if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
      }

      // Bedrooms range filter
      if (filters.bedroomsMin || filters.bedroomsMax) {
        const bedrooms = lot.bedrooms || 0;
        if (filters.bedroomsMin && bedrooms < parseInt(filters.bedroomsMin)) return false;
        if (filters.bedroomsMax && bedrooms > parseInt(filters.bedroomsMax)) return false;
      }

      // Bathrooms range filter
      if (filters.bathroomsMin || filters.bathroomsMax) {
        const bathrooms = lot.bathrooms || 0;
        if (filters.bathroomsMin && bathrooms < parseInt(filters.bathroomsMin)) return false;
        if (filters.bathroomsMax && bathrooms > parseInt(filters.bathroomsMax)) return false;
      }

      // Square footage range filter
      if (filters.sqFtMin || filters.sqFtMax) {
        const sqFt = lot.sqFt || 0;
        if (filters.sqFtMin && sqFt < parseInt(filters.sqFtMin)) return false;
        if (filters.sqFtMax && sqFt > parseInt(filters.sqFtMax)) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matches = [
          lot.nameOrNumber.toLowerCase(),
          lot.description?.toLowerCase() || "",
          parkById.get(lot.parkId)?.name?.toLowerCase() || "",
          lot.specialStatus?.name?.toLowerCase() || ""
        ].some(field => field.includes(searchLower));
        if (!matches) return false;
      }

      return true;
    });
  };

  // Sorting function
  const sortLots = (lotsToSort: Lot[]) => {
    return [...lotsToSort].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case "nameOrNumber":
          valueA = a.nameOrNumber.toLowerCase();
          valueB = b.nameOrNumber.toLowerCase();
          break;
        case "status":
          valueA = a.status;
          valueB = b.status;
          break;
        case "price":
          valueA = parseFloat((a.price || '').toString().replace(/[^\d.-]/g, '')) || 0;
          valueB = parseFloat((b.price || '').toString().replace(/[^\d.-]/g, '')) || 0;
          break;
        case "bedrooms":
          valueA = a.bedrooms || 0;
          valueB = b.bedrooms || 0;
          break;
        case "bathrooms":
          valueA = a.bathrooms || 0;
          valueB = b.bathrooms || 0;
          break;
        case "sqFt":
          valueA = a.sqFt || 0;
          valueB = b.sqFt || 0;
          break;
        case "parkName":
          valueA = parkById.get(a.parkId)?.name?.toLowerCase() || "";
          valueB = parkById.get(b.parkId)?.name?.toLowerCase() || "";
          break;
        case "companyName":
          const parkA = parkById.get(a.parkId);
          const parkB = parkById.get(b.parkId);
          valueA = parkA?.companyId ? companyById.get(parkA.companyId)?.name?.toLowerCase() || "" : "";
          valueB = parkB?.companyId ? companyById.get(parkB.companyId)?.name?.toLowerCase() || "" : "";
          break;
        case "visibility":
          valueA = a.isActive ? 1 : 0;
          valueB = b.isActive ? 1 : 0;
          break;
        case "specialStatus":
          valueA = a.specialStatus?.name?.toLowerCase() || "";
          valueB = b.specialStatus?.name?.toLowerCase() || "";
          break;
        default:
          valueA = a.nameOrNumber.toLowerCase();
          valueB = b.nameOrNumber.toLowerCase();
      }

      if (typeof valueA === "string" && typeof valueB === "string") {
        const comparison = valueA.localeCompare(valueB);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        const comparison = valueA - valueB;
        return sortOrder === "asc" ? comparison : -comparison;
      }
    });
  };

  // Apply filtering and sorting to lots list
  const filteredLots = filterLots(rawLotsList);
  const lotsList = sortLots(filteredLots);

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
            <div className="flex gap-2">
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Lot
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Button
                variant="outline"
                onClick={() => setIsBulkUploadOpen(true)}
                data-testid="bulk-upload-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
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
            <div className="flex items-center justify-between">
              <CardTitle>All Lots ({lotsList.length} {filteredLots.length !== rawLotsList.length ? `of ${rawLotsList.length}` : ''})</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]" id="sortBy" data-testid="sort-by-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nameOrNumber">Lot Name/Number</SelectItem>
                      <SelectItem value="parkName">Park Name</SelectItem>
                      <SelectItem value="companyName">Company</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="visibility">Visibility</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="bedrooms">Bedrooms</SelectItem>
                      <SelectItem value="bathrooms">Bathrooms</SelectItem>
                      <SelectItem value="sqFt">Square Feet</SelectItem>
                      <SelectItem value="specialStatus">Special Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1"
                  data-testid="sort-order-toggle"
                >
                  {sortOrder === "asc" ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  )}
                  {sortOrder === "asc" ? "Asc" : "Desc"}
                </Button>
              </div>
            </div>
            
            {/* Filter Controls */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search Filter */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search lots..."
                    value={filters.searchText}
                    onChange={(e) => updateRangeFilter("searchText", e.target.value)}
                    className="w-48"
                    data-testid="search-filter"
                  />
                </div>

                {/* Status Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="status-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Status {filters.status.length > 0 && `(${filters.status.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="start">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      {["FOR_RENT", "FOR_SALE", "RENT_SALE"].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={filters.status.includes(status)}
                            onCheckedChange={() => toggleFilter("status", status)}
                            data-testid={`status-filter-${status}`}
                          />
                          <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                            {status === "FOR_RENT" ? "For Rent" : status === "FOR_SALE" ? "For Sale" : "Rent/Sale"}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Visibility Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="visibility-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Visibility {filters.visibility.length > 0 && `(${filters.visibility.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="start">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Visibility</Label>
                      {["visible", "hidden"].map((visibility) => (
                        <div key={visibility} className="flex items-center space-x-2">
                          <Checkbox
                            id={`visibility-${visibility}`}
                            checked={filters.visibility.includes(visibility)}
                            onCheckedChange={() => toggleFilter("visibility", visibility)}
                            data-testid={`visibility-filter-${visibility}`}
                          />
                          <Label htmlFor={`visibility-${visibility}`} className="text-sm cursor-pointer">
                            {visibility === "visible" ? "Visible" : "Hidden"}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Park Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="park-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Park {filters.parkId.length > 0 && `(${filters.parkId.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">Parks</Label>
                      {parksList.map((park) => (
                        <div key={park.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`park-${park.id}`}
                            checked={filters.parkId.includes(park.id)}
                            onCheckedChange={() => toggleFilter("parkId", park.id)}
                            data-testid={`park-filter-${park.id}`}
                          />
                          <Label htmlFor={`park-${park.id}`} className="text-sm cursor-pointer">
                            {park.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Company Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="company-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Company {filters.companyId.length > 0 && `(${filters.companyId.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">Companies</Label>
                      {companiesList.map((company) => (
                        <div key={company.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`company-${company.id}`}
                            checked={filters.companyId.includes(company.id)}
                            onCheckedChange={() => toggleFilter("companyId", company.id)}
                            data-testid={`company-filter-${company.id}`}
                          />
                          <Label htmlFor={`company-${company.id}`} className="text-sm cursor-pointer">
                            {company.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Price Range Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="price-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Price {(filters.priceMin || filters.priceMax) && "✓"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Price Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="priceMin" className="text-xs">Min</Label>
                          <Input
                            id="priceMin"
                            type="number"
                            placeholder="Min price"
                            value={filters.priceMin}
                            onChange={(e) => updateRangeFilter("priceMin", e.target.value)}
                            data-testid="price-min-filter"
                          />
                        </div>
                        <div>
                          <Label htmlFor="priceMax" className="text-xs">Max</Label>
                          <Input
                            id="priceMax"
                            type="number"
                            placeholder="Max price"
                            value={filters.priceMax}
                            onChange={(e) => updateRangeFilter("priceMax", e.target.value)}
                            data-testid="price-max-filter"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Bedrooms Range Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="bedrooms-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Bedrooms {(filters.bedroomsMin || filters.bedroomsMax) && "✓"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bedrooms Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="bedroomsMin" className="text-xs">Min</Label>
                          <Input
                            id="bedroomsMin"
                            type="number"
                            placeholder="Min"
                            value={filters.bedroomsMin}
                            onChange={(e) => updateRangeFilter("bedroomsMin", e.target.value)}
                            data-testid="bedrooms-min-filter"
                          />
                        </div>
                        <div>
                          <Label htmlFor="bedroomsMax" className="text-xs">Max</Label>
                          <Input
                            id="bedroomsMax"
                            type="number"
                            placeholder="Max"
                            value={filters.bedroomsMax}
                            onChange={(e) => updateRangeFilter("bedroomsMax", e.target.value)}
                            data-testid="bedrooms-max-filter"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters() && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="flex items-center gap-1"
                  data-testid="clear-filters-button"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
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

        {/* Bulk Upload Dialog */}
        <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Upload Lots</DialogTitle>
              <DialogDescription>
                Upload multiple lots from a CSV or Excel file
              </DialogDescription>
            </DialogHeader>

            {bulkUploadStep === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Upload File</h3>
                  <p className="text-gray-500 mb-4">
                    Choose a CSV or Excel file containing lot data
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="bulk-upload-file"
                    data-testid="bulk-upload-file-input"
                  />
                  <label htmlFor="bulk-upload-file" className="cursor-pointer">
                    <Button asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </span>
                    </Button>
                  </label>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Required Columns:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Lot Name/Number</li>
                    <li>Status (FOR_RENT, FOR_SALE, or RENT_SALE)</li>
                    <li>Park Name (preferred - easier than Park ID)</li>
                  </ul>
                  <h4 className="font-medium mt-3 mb-2">Optional Columns:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Park ID (can be used instead of Park Name)</li>
                    <li>Price, Description, Bedrooms, Bathrooms, Square Feet</li>
                  </ul>
                </div>
              </div>
            )}

            {bulkUploadStep === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Map Columns</h3>
                  <p className="text-sm text-gray-500">
                    {parsedData.length} rows found
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Lot Fields</h4>
                    <div className="space-y-2">
                      {[
                        { field: 'nameOrNumber', label: 'Lot Name/Number *', required: true },
                        { field: 'status', label: 'Status *', required: true },
                        { field: 'parkName', label: 'Park Name * (Required)', required: true },
                        { field: 'parkId', label: 'Park ID (Optional)', required: false },
                        { field: 'price', label: 'Price', required: false },
                        { field: 'description', label: 'Description', required: false },
                        { field: 'bedrooms', label: 'Bedrooms', required: false },
                        { field: 'bathrooms', label: 'Bathrooms', required: false },
                        { field: 'sqFt', label: 'Square Feet', required: false }
                      ].map(({ field, label, required }) => (
                        <div key={field} className="flex items-center justify-between p-2 border rounded">
                          <span className={required ? 'font-medium' : ''}>{label}</span>
                          <Select 
                            value={columnMapping[field] || ''} 
                            onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Skip</SelectItem>
                              {csvHeaders.map(header => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Data Preview</h4>
                    <div className="border rounded p-2 bg-gray-50 max-h-64 overflow-y-auto">
                      {parsedData.slice(0, 3).map((row, index) => (
                        <div key={index} className="mb-2 text-sm">
                          <strong>Row {index + 1}:</strong>
                          <pre className="mt-1 text-xs bg-white p-2 rounded">
                            {JSON.stringify(row, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setBulkUploadStep('upload')}>
                    Back
                  </Button>
                  <Button onClick={handleColumnMapping} data-testid="proceed-mapping">
                    Next: Preview Data
                  </Button>
                </div>
              </div>
            )}

            {bulkUploadStep === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Preview & Import</h3>
                  <p className="text-sm text-gray-500">
                    {mappedData.length} lots ready for import
                  </p>
                </div>
                
                <div className="border rounded max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name/Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Park</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedData.slice(0, 10).map((lot, index) => (
                        <TableRow key={index}>
                          <TableCell>{lot.nameOrNumber || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={lot.status === 'FOR_RENT' ? 'default' : lot.status === 'FOR_SALE' ? 'secondary' : 'outline'}>
                              {lot.status || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{lot.parkId || 'N/A'}</TableCell>
                          <TableCell>{lot.price ? `$${lot.price}` : 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">{lot.description || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {mappedData.length > 10 && (
                    <div className="p-2 text-center text-sm text-gray-500 border-t">
                      ... and {mappedData.length - 10} more lots
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setBulkUploadStep('mapping')}>
                    Back to Mapping
                  </Button>
                  <Button onClick={handleStartImport} data-testid="start-import">
                    Start Import
                  </Button>
                </div>
              </div>
            )}

            {bulkUploadStep === 'importing' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-lg font-semibold">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing lots...
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Processing {mappedData.length} lots
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="w-full" />
                </div>
              </div>
            )}

            {bulkUploadStep === 'results' && (
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Import Completed</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {importResults?.successful?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {importResults?.failed?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {mappedData.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
                
                {importResults?.failed?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Failed rows:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResults.failed.map((failure: any, index: number) => (
                        <div key={index} className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          <strong>Row {failure.row}:</strong> {failure.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center">
                  <Button onClick={resetBulkUpload} data-testid="close-bulk-upload">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}