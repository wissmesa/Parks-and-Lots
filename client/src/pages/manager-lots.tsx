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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Tag,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Loader2
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

  // Bulk upload mutation for managers
  const bulkUploadMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return await apiRequest('POST', '/api/manager/lots/bulk', { lots: data });
    },
    onSuccess: async (response) => {
      const results = await response.json();
      setImportResults(results);
      setImportProgress(100);
      
      // Refresh lots data
      queryClient.invalidateQueries({ queryKey: ['/api/manager/lots'] });
      
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
      // Handle specific error for multiple park assignments
      if (error.message && error.message.includes('400:')) {
        try {
          // Extract JSON from error message (format: "400: {json}")
          const colonIndex = error.message.indexOf(':');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 1).trim();
            // Only attempt to parse if it looks like JSON (starts with '{')
            if (jsonPart.startsWith('{')) {
              const errorData = JSON.parse(jsonPart);
              
              if (errorData?.code === 'MULTIPLE_PARKS') {
                toast({
                  title: "Multiple Parks Assigned",
                  description: "You are assigned to multiple parks. Please contact your administrator to specify which park should receive these lots.",
                  variant: "destructive"
                });
                return;
              }
            }
          }
        } catch (e) {
          // Fall through to generic error handling if JSON parsing fails
          console.warn('Failed to parse error response:', e);
        }
      }
      
      toast({
        title: "Bulk upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1).map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = (row as any[])[index] || '';
              });
              return obj;
            });
            
            setCsvHeaders(headers);
            setParsedData(rows);
            setBulkUploadStep('mapping');
          }
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Please check the file format",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
    }
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

  const isValidMapping = () => {
    return columnMapping['nameOrNumber'] && columnMapping['status'];
  };

  const handleProceedToPreview = () => {
    if (!isValidMapping()) return;
    
    const mapped = parsedData.map(row => {
      const mappedRow: any = {};
      Object.entries(columnMapping).forEach(([field, csvColumn]) => {
        if (csvColumn && csvColumn !== 'ignore') {
          mappedRow[field] = row[csvColumn];
        }
      });
      return mappedRow;
    }).filter(row => row.nameOrNumber && row.status); // Filter out incomplete rows
    
    setMappedData(mapped);
    setBulkUploadStep('preview');
  };

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
            
            <div className="flex gap-2">
              <Button
                onClick={() => setIsBulkUploadOpen(true)}
                variant="outline"
                data-testid="bulk-upload-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              
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

          {/* Bulk Upload Dialog */}
          <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Upload Lots</DialogTitle>
              </DialogHeader>
              
              {bulkUploadStep === 'upload' && (
                <div className="space-y-6">
                  <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload CSV or Excel File</h3>
                    <p className="text-gray-500 mb-4">
                      Upload lots data to your assigned park. No need to specify park ID - lots will be automatically assigned to your park.
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="bulk-upload-file-input"
                      data-testid="bulk-upload-file-input"
                    />
                    <label htmlFor="bulk-upload-file-input">
                      <Button variant="outline" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </Button>
                    </label>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-green-700">Required Columns</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Lot Name/Number</strong> - Unique identifier</li>
                        <li>• <strong>Status</strong> - FOR_RENT, FOR_SALE, or RENT_SALE</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 text-blue-700">Optional Columns</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Price</strong> - Rental or sale price</li>
                        <li>• <strong>Description</strong> - Lot description</li>
                        <li>• <strong>Bedrooms</strong> - Number of bedrooms</li>
                        <li>• <strong>Bathrooms</strong> - Number of bathrooms</li>
                        <li>• <strong>Sq Ft</strong> - Square footage</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {bulkUploadStep === 'mapping' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Map CSV Columns</h3>
                  <p className="text-sm text-gray-600">
                    Map your CSV columns to the required fields. Note: All lots will be assigned to your park automatically.
                  </p>
                  
                  <div className="grid gap-4">
                    {/* Required fields */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">Required Fields</h4>
                      
                      <div>
                        <Label htmlFor="nameOrNumber-mapping">Lot Name/Number *</Label>
                        <Select value={columnMapping['nameOrNumber'] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, nameOrNumber: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CSV column for Lot Name/Number" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">-- Ignore --</SelectItem>
                            {csvHeaders.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="status-mapping">Status *</Label>
                        <Select value={columnMapping['status'] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, status: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CSV column for Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">-- Ignore --</SelectItem>
                            {csvHeaders.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Optional fields */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-blue-700">Optional Fields</h4>
                      
                      {['price', 'description', 'bedrooms', 'bathrooms', 'sqFt'].map(field => (
                        <div key={field}>
                          <Label htmlFor={`${field}-mapping`}>{field.charAt(0).toUpperCase() + field.slice(1)}</Label>
                          <Select value={columnMapping[field] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select CSV column for ${field}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">-- Ignore --</SelectItem>
                              {csvHeaders.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBulkUploadStep('upload')}>
                      Back
                    </Button>
                    <Button onClick={handleProceedToPreview} disabled={!isValidMapping()} data-testid="proceed-mapping">
                      Proceed to Preview
                    </Button>
                  </div>
                </div>
              )}

              {bulkUploadStep === 'preview' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Preview Data</h3>
                  <p className="text-sm text-gray-600">
                    Review the mapped data before importing. Showing first 10 rows:
                  </p>
                  
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lot Name/Number</TableHead>
                          <TableHead>Status</TableHead>
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
                      Processing {mappedData.length} lots to your assigned park
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
                    {importResults?.assignedPark && (
                      <p className="text-sm text-muted-foreground">
                        All lots assigned to: <strong>{importResults.assignedPark}</strong>
                      </p>
                    )}
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
        </main>
      </div>
    </div>
  );
}