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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTab } from "@/components/ui/activity-tab";
import { apiRequest } from "@/lib/queryClient";
import { Building, Plus, Edit, Trash2, Camera, TreePine, MoreHorizontal, AlertCircle, List, Grid3X3, UserCheck, Sheet, Check, ExternalLink, Unlink } from "lucide-react";
import { validateEmail, validatePhone } from "@/lib/validation";

interface Company {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  googleSheetId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Park {
  id: string;
  name: string;
  companyId: string;
}

interface Manager {
  id: string;
  fullName: string;
  email: string;
  role: 'MANAGER' | 'ADMIN';
  companyId?: string;
}

export default function AdminCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    email: "",
    googleSheetId: ""
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPhotos, setShowPhotos] = useState<string | null>(null);

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [assigningParks, setAssigningParks] = useState<Company | null>(null);
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>([]);
  const [assigningManager, setAssigningManager] = useState<Company | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');

  // Validation functions
  const validateField = (field: string, value: string) => {
    let error: string | null = null;
    
    switch (field) {
      case 'email':
        if (value.trim()) {
          // Only validate if not empty
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            error = "Please enter a valid email address";
          }
        }
        break;
      case 'phone':
        if (value.trim()) {
          // Only validate if not empty - US phone numbers only
          if (!/^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(value)) {
            error = "Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)";
          }
        }
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));
    
    return !error;
  };

  // Redirect if not admin
  if (user?.role !== 'MHP_LORD') {
    window.location.href = '/';
    return null;
  }

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: parks } = useQuery<{ parks: Park[] }>({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: managersData } = useQuery<Manager[]>({
    queryKey: ["/api/admin/managers"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: sheetsStatus } = useQuery<{ connected: boolean; lordUserId?: string; lordUserName?: string }>({
    queryKey: ["/api/auth/google-sheets/system-status"],
    enabled: user?.role === 'MHP_LORD',
  });

  const [isConnectingSheets, setIsConnectingSheets] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any): Promise<Company> => {
      const response = await apiRequest("POST", "/api/companies", data);
      return await response.json();
    },
    onSuccess: (newCompany: Company) => {
      // Immediately add the new company to the cache for real-time updates
      queryClient.setQueryData(["/api/companies"], (oldData: Company[]) => {
        if (!oldData) return [newCompany];
        return [...oldData, newCompany];
      });
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      setIsCreateModalOpen(false);
      resetForm();
      setValidationErrors({});
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Create company error:', error);
      const errorMessage = error?.response?.data?.message || "Failed to create company";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any): Promise<Company> => {
      const response = await apiRequest("PATCH", `/api/companies/${editingCompany?.id}`, data);
      return await response.json();
    },
    onSuccess: (updatedCompany: Company) => {
      // Immediately update the cache with the new data for real-time updates
      queryClient.setQueryData(["/api/companies"], (oldData: Company[]) => {
        if (!oldData) return oldData;
        return oldData.map((company: Company) => 
          company.id === updatedCompany.id ? updatedCompany : company
        );
      });
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      // Invalidate audit logs for real-time updates
      if (editingCompany?.id) {
        queryClient.invalidateQueries({ queryKey: ['audit-logs', 'COMPANY', editingCompany.id] });
      }
      
      setEditingCompany(null);
      resetForm();
      setValidationErrors({});
      toast({
        title: "Success",
        description: "Company updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Update company error:', error);
      const errorMessage = error?.response?.data?.message || "Failed to update company";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const assignParksMutation = useMutation({
    mutationFn: async ({ companyId, parkIds }: { companyId: string; parkIds: string[] }) => {
      return Promise.all(
        parkIds.map(parkId => 
          apiRequest("PATCH", `/api/parks/${parkId}`, { companyId })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parks"] });
      setAssigningParks(null);
      setSelectedParkIds([]);
      toast({
        title: "Success",
        description: "Parks assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign parks",
        variant: "destructive",
      });
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ companyId, managerId }: { companyId: string; managerId: string }) => {
      return apiRequest("PATCH", `/api/admin/managers/${managerId}`, { companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managers"] });
      setAssigningManager(null);
      setSelectedManagerId('');
      toast({
        title: "Success",
        description: "Manager assigned to company successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign manager to company",
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
      phone: "",
      email: "",
      googleSheetId: ""
    });
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      description: company.description || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zipCode: company.zipCode || "",
      phone: company.phone || "",
      email: company.email || "",
      googleSheetId: company.googleSheetId || ""
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields before submission
    const emailValid = validateField('email', formData.email);
    const phoneValid = validateField('phone', formData.phone);
    
    // Check required fields
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }
    
    // Check if validation passed
    if (!emailValid || !phoneValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the validation errors before submitting",
        variant: "destructive",
      });
      return;
    }
    
    // Clean up empty strings to null for optional fields
    const cleanedData = {
      ...formData,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      city: formData.city.trim() || null,
      state: formData.state.trim() || null,
      zipCode: formData.zipCode.trim() || null,
      description: formData.description.trim() || null,
    };
    
    if (editingCompany) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleAssignParks = (company: Company) => {
    setAssigningParks(company);
    // Pre-select parks already assigned to this company
    const currentParks = parksByCompanyId.get(company.id) || [];
    setSelectedParkIds(currentParks.map(park => park.id));
  };

  const handleParkSelection = (parkId: string, isChecked: boolean) => {
    setSelectedParkIds(prev => 
      isChecked 
        ? [...prev, parkId]
        : prev.filter(id => id !== parkId)
    );
  };

  const handleConfirmAssignment = () => {
    if (assigningParks) {
      assignParksMutation.mutate({
        companyId: assigningParks.id,
        parkIds: selectedParkIds
      });
    }
  };

  const handleAssignManager = (company: Company) => {
    setAssigningManager(company);
    setSelectedManagerId('');
  };

  const handleManagerSelection = (managerId: string) => {
    setSelectedManagerId(managerId);
  };

  const handleConfirmManagerAssignment = () => {
    if (assigningManager && selectedManagerId) {
      assignManagerMutation.mutate({
        companyId: assigningManager.id,
        managerId: selectedManagerId
      });
    }
  };

  const companiesList = companies ?? [];
  const parksList = parks?.parks ?? [];
  const managersList = managersData ?? [];
  
  // Create efficient lookup maps for relationships
  const parksByCompanyId = new Map<string, Park[]>();
  parksList.forEach(park => {
    if (!parksByCompanyId.has(park.companyId)) {
      parksByCompanyId.set(park.companyId, []);
    }
    parksByCompanyId.get(park.companyId)!.push(park);
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Building className="w-8 h-8" />
                Companies
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage company profiles and information
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Company Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
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
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter company address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="State"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                      placeholder="Zip Code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, phone: e.target.value }));
                        validateField('phone', e.target.value);
                      }}
                      onBlur={(e) => validateField('phone', e.target.value)}
                      className={validationErrors.phone ? 'border-red-500' : ''}
                      placeholder="(555) 123-4567"
                    />
                    {validationErrors.phone && (
                      <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {validationErrors.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }));
                        validateField('email', e.target.value);
                      }}
                      onBlur={(e) => validateField('email', e.target.value)}
                      className={validationErrors.email ? 'border-red-500' : ''}
                      placeholder="company@example.com"
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="googleSheetId">Google Sheets ID</Label>
                    <Input
                      id="googleSheetId"
                      type="text"
                      value={formData.googleSheetId}
                      onChange={(e) => setFormData(prev => ({ ...prev, googleSheetId: e.target.value }))}
                      placeholder="Enter spreadsheet ID from URL"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Get the ID from your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
                    </p>
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

        {/* Google Sheets Connection for LORD */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${sheetsStatus?.connected ? 'bg-green-100' : 'bg-muted'}`}>
                    {sheetsStatus?.connected ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Sheet className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">Google Sheets Integration</h3>
                    <p className="text-sm text-muted-foreground">
                      {sheetsStatus?.connected 
                        ? 'Connected - Add Google Sheets IDs to companies below'
                        : 'Connect to enable automatic lot exports to Google Sheets'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {sheetsStatus?.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await apiRequest('POST', '/api/auth/google-sheets/disconnect');
                          queryClient.invalidateQueries({ queryKey: ["/api/auth/google-sheets/system-status"] });
                          toast({
                            title: "Disconnected",
                            description: "Google Sheets has been disconnected.",
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to disconnect Google Sheets.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest('GET', '/api/auth/google-sheets/connect');
                          const data = await response.json();
                          
                          if (data.authUrl) {
                            setIsConnectingSheets(true);
                            const popup = window.open(data.authUrl, 'google-sheets-auth', 'width=500,height=600');
                            
                            const handleMessage = (event: MessageEvent) => {
                              if (event.data?.type === 'GOOGLE_SHEETS_CONNECTED') {
                                setIsConnectingSheets(false);
                                
                                if (event.data.success) {
                                  queryClient.invalidateQueries({ queryKey: ["/api/auth/google-sheets/system-status"] });
                                  toast({
                                    title: "Google Sheets Connected",
                                    description: "You can now add Google Sheet IDs to companies below.",
                                  });
                                } else {
                                  toast({
                                    title: "Connection Failed",
                                    description: "Failed to connect to Google Sheets. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                                
                                window.removeEventListener('message', handleMessage);
                                if (popup && !popup.closed) {
                                  popup.close();
                                }
                              }
                            };
                            
                            window.addEventListener('message', handleMessage);
                            
                            const checkClosed = setInterval(() => {
                              if (popup?.closed) {
                                clearInterval(checkClosed);
                                setIsConnectingSheets(false);
                              }
                            }, 500);
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to initiate Google Sheets connection.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={isConnectingSheets}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {isConnectingSheets ? 'Connecting...' : 'Connect Google Sheets'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Companies</CardTitle>
              
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
                <p className="mt-2 text-muted-foreground">Loading companies...</p>
              </div>
            ) : companiesList.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No companies found</p>
              </div>
            ) : viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Parks</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesList.map((company: Company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-muted-foreground">{company.address}</div>
                      </TableCell>
                      <TableCell>
                        <div>{company.city}, {company.state}</div>
                        {company.zipCode && <div className="text-sm text-muted-foreground">{company.zipCode}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {parksByCompanyId.get(company.id)?.length || 0} Parks
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {parksByCompanyId.get(company.id)?.map(park => park.name).join(', ') || 'No parks'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{company.phone}</div>
                        <div className="text-sm text-muted-foreground">{company.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {new Date(company.createdAt).toLocaleDateString()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`company-actions-${company.id}`}
                            >
                              Actions
                              <MoreHorizontal className="w-4 h-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEdit(company)}
                              data-testid={`edit-company-${company.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Company
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignParks(company)}
                              data-testid={`assign-parks-${company.id}`}
                            >
                              <TreePine className="w-4 h-4 mr-2" />
                              Assign Parks
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignManager(company)}
                              data-testid={`assign-manager-${company.id}`}
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Assign Company to Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowPhotos(company.id)}
                              data-testid={`manage-photos-${company.id}`}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Manage Photos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this company?")) {
                                  deleteMutation.mutate(company.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`delete-company-${company.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Company
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
                {companiesList.map((company: Company) => (
                  <Card key={company.id} className="transition-all hover:shadow-md">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">{company.name}</h3>
                          {company.description && (
                            <p className="text-sm text-muted-foreground">{company.description}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Location */}
                      <div className="space-y-2 mb-3">
                        {company.address && (
                          <div className="text-sm">{company.address}</div>
                        )}
                        {(company.city || company.state) && (
                          <div className="font-medium">{company.city}, {company.state}</div>
                        )}
                        {company.zipCode && (
                          <div className="text-sm text-muted-foreground">ZIP: {company.zipCode}</div>
                        )}
                      </div>
                      
                      {/* Parks count */}
                      <div className="mb-3">
                        <Badge variant="outline">
                          {parksByCompanyId.get(company.id)?.length || 0} Parks
                        </Badge>
                      </div>
                      
                      {/* Contact info */}
                      <div className="space-y-1 mb-3">
                        {company.email && (
                          <div className="text-sm text-muted-foreground">📧 {company.email}</div>
                        )}
                        {company.phone && (
                          <div className="text-sm text-muted-foreground">📞 {company.phone}</div>
                        )}
                      </div>
                      
                      {/* Created date */}
                      <div>
                        <Badge variant="outline" className="text-xs">
                          Created {new Date(company.createdAt).toLocaleDateString()}
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
                          <DropdownMenuItem onClick={() => handleEdit(company)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Company
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignParks(company)}>
                            <TreePine className="w-4 h-4 mr-2" />
                            Assign Parks
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignManager(company)}>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Assign Company to Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowPhotos(company.id)}>
                            <Camera className="w-4 h-4 mr-2" />
                            Manage Photos
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this company?")) {
                                deleteMutation.mutate(company.id);
                              }
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Company
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
        <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="details" className="flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="overflow-y-auto max-h-[calc(90vh-12rem)]">
                <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Company Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
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
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter company address"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-zipCode">Zip Code</Label>
                <Input
                  id="edit-zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="Zip Code"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                    validateField('phone', e.target.value);
                  }}
                  onBlur={(e) => validateField('phone', e.target.value)}
                  className={validationErrors.phone ? 'border-red-500' : ''}
                  placeholder="(555) 123-4567"
                />
                {validationErrors.phone && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {validationErrors.phone}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, email: e.target.value }));
                    validateField('email', e.target.value);
                  }}
                  onBlur={(e) => validateField('email', e.target.value)}
                  className={validationErrors.email ? 'border-red-500' : ''}
                  placeholder="company@example.com"
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {validationErrors.email}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-googleSheetId">Google Sheets ID</Label>
                <Input
                  id="edit-googleSheetId"
                  type="text"
                  value={formData.googleSheetId}
                  onChange={(e) => setFormData(prev => ({ ...prev, googleSheetId: e.target.value }))}
                  placeholder="Enter spreadsheet ID from URL"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Get the ID from your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingCompany(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="activity" className="overflow-y-auto max-h-[calc(90vh-12rem)]">
            {editingCompany && (
              <ActivityTab
                entityType="COMPANY"
                entityId={editingCompany.id}
                createdAt={editingCompany.createdAt}
                updatedAt={editingCompany.updatedAt}
              />
            )}
          </TabsContent>
        </Tabs>
          </DialogContent>
        </Dialog>

        {/* Photo Management Dialog */}
        <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Photos - {companiesList.find(c => c.id === showPhotos)?.name}
              </DialogTitle>
            </DialogHeader>
            {showPhotos && (
              <PhotoManagement 
                entityType="COMPANY"
                entityId={showPhotos}
                entityName={companiesList.find(c => c.id === showPhotos)?.name || 'Company'}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Park Assignment Dialog */}
        <Dialog open={!!assigningParks} onOpenChange={(open) => !open && setAssigningParks(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Assign Parks to {assigningParks?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select parks to assign to this company:
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {parksList.map(park => (
                  <div key={park.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`park-${park.id}`}
                      checked={selectedParkIds.includes(park.id)}
                      onChange={(e) => handleParkSelection(park.id, e.target.checked)}
                      className="rounded border-gray-300"
                      data-testid={`checkbox-park-${park.id}`}
                    />
                    <Label htmlFor={`park-${park.id}`} className="text-sm cursor-pointer">
                      {park.name}
                      {park.companyId !== assigningParks?.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (Currently: {companiesList.find(c => c.id === park.companyId)?.name || 'Unassigned'})
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssigningParks(null)}
                  data-testid="cancel-assign-parks"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAssignment}
                  disabled={assignParksMutation.isPending}
                  data-testid="confirm-assign-parks"
                >
                  {assignParksMutation.isPending ? "Assigning..." : "Assign Parks"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manager Assignment Dialog */}
        <Dialog open={!!assigningManager} onOpenChange={(open) => !open && setAssigningManager(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Assign {assigningManager?.name} to Manager
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a manager or admin to assign this company to:
              </p>
              {managersList.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No managers or admins available
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {managersList.map(manager => {
                    const isAdmin = manager.role === 'ADMIN';
                    return (
                      <div key={manager.id} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`manager-${manager.id}`}
                          name="manager-selection"
                          checked={selectedManagerId === manager.id}
                          onChange={() => handleManagerSelection(manager.id)}
                          className="rounded border-gray-300"
                          data-testid={`radio-manager-${manager.id}`}
                        />
                        <Label htmlFor={`manager-${manager.id}`} className="text-sm cursor-pointer flex-1">
                          <div>
                            <div className="font-medium">{manager.fullName}</div>
                            <div className="text-xs text-muted-foreground">{manager.email}</div>
                            <div className="text-xs text-muted-foreground">
                              Role: {isAdmin ? 'Company Manager (Admin)' : 'Park Manager'}
                            </div>
                            {isAdmin && manager.companyId && (
                              <div className={`text-xs ${manager.companyId === assigningManager?.id ? 'text-green-600' : 'text-amber-600'}`}>
                                {manager.companyId === assigningManager?.id 
                                  ? '(Currently assigned to this company)' 
                                  : `(Currently assigned to: ${companiesList.find(c => c.id === manager.companyId)?.name || 'Another Company'})`
                                }
                              </div>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssigningManager(null)}
                  data-testid="cancel-assign-manager"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmManagerAssignment}
                  disabled={!selectedManagerId || assignManagerMutation.isPending}
                  data-testid="confirm-assign-manager"
                >
                  {assignManagerMutation.isPending ? "Assigning..." : "Assign Manager"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}