import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { TenantDetailDialog } from "@/components/ui/tenant-detail-dialog";
import { TenantStepForm } from "@/components/ui/tenant-step-form";
import { useToast } from "@/hooks/use-toast";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Trash2,
  List,
  Grid3X3
} from "lucide-react";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'TERMINATED';
  leaseStartDate?: string;
  leaseEndDate?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  createdAt: string;
  lot?: {
    id: string;
    nameOrNumber: string;
    description?: string;
    parkId: string;
  };
  park?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
}

interface Lot {
  id: string;
  nameOrNumber: string;
  description?: string;
  parkId: string;
  park?: {
    name: string;
  };
}

export default function ManagerTenants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    parkId: "",
    lotId: "",
    status: "PENDING" as Tenant['status'],
  });

  // Fetch tenants (filtered by manager's assigned parks)
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('q', searchTerm);
      
      const response = await apiRequest('GET', `/api/tenants?${params}`);
      const data = await response.json();
      return data.tenants as Tenant[];
    },
  });

  // Fetch lots for Tenant creation (only manager's assigned parks)
  const { data: lots } = useQuery({
    queryKey: ['manager-lots-for-tenants'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/manager/lots');
      return response.json();
    },
    enabled: showCreateModal,
  });

  // Create Tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      const payload = {
        ...tenantData,
        leaseStartDate: tenantData.leaseStartDate ? new Date(tenantData.leaseStartDate).toISOString() : null,
        leaseEndDate: tenantData.leaseEndDate ? new Date(tenantData.leaseEndDate).toISOString() : null,
      };
      
      const response = await apiRequest('POST', '/api/tenants', payload);
      const data = await response.json();
      return data.Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      // Invalidate lot queries to update assignment status
      queryClient.invalidateQueries({ queryKey: ['lots-for-tenant-form'] });
      queryClient.invalidateQueries({ queryKey: ['manager-lots-for-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['all-lots-for-tenant-form'] });
      setShowCreateModal(false);
      resetForm();
      toast({
        title: "Tenant Created",
        description: "New Tenant has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Tenant",
        variant: "destructive",
      });
    },
  });

  // Delete Tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest('DELETE', `/api/tenants/${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      // Invalidate lot queries to update assignment status
      queryClient.invalidateQueries({ queryKey: ['lots-for-tenant-form'] });
      queryClient.invalidateQueries({ queryKey: ['manager-lots-for-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['all-lots-for-tenant-form'] });
      setTenantToDelete(null);
      toast({
        title: "Tenant Deleted",
        description: "Tenant has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete Tenant",
        variant: "destructive",
      });
    },
  });

  // Update Tenant status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: Tenant['status'] }) => {
      const response = await apiRequest('PATCH', `/api/tenants/${tenantId}`, { status });
      const data = await response.json();
      return data.Tenant;
    },
    onSuccess: (updatedTenant) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: "Status Updated",
        description: `Tenant status has been updated to ${updatedTenant.status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tenant status",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      parkId: "",
      lotId: "",
      status: "PENDING",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.lotId) {
      toast({
        title: "Validation Error",
        description: "Please select a lot for the Tenant.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast({
        title: "Validation Error", 
        description: "Please fill in all required fields (First Name, Last Name, Email, Phone, Lot).",
        variant: "destructive",
      });
      return;
    }
    
    createTenantMutation.mutate(formData);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'TERMINATED':
        return 'destructive';
      case 'INACTIVE':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'TERMINATED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleStatusChange = (tenantId: string, newStatus: Tenant['status']) => {
    updateStatusMutation.mutate({ tenantId, status: newStatus });
  };

  const filteredTenants = tenants || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <ManagerSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-8 w-8" />
                  Tenant Management
                </h1>
                <p className="text-gray-600 mt-2">Manage Tenant information, leases, and payments</p>
              </div>
              
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tenant
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <TenantStepForm
                    onSubmit={(data) => createTenantMutation.mutate(data)}
                    onCancel={() => setShowCreateModal(false)}
                    isLoading={createTenantMutation.isPending}
                    isManager={true}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search tenants by name, email, phone, lot, or park..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    {(searchTerm || statusFilter !== 'all') && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tenants Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    My Tenants ({filteredTenants.length})
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
              </CardHeader>
              <CardContent className="p-0">
                {tenantsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading tenants...</div>
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Tenants Found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'No tenants match your current filters.'
                        : 'Get started by adding your first Tenant to your assigned lots.'
                      }
                    </p>
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tenant
                    </Button>
                  </div>
                ) : viewMode === 'list' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Monthly Rent</TableHead>
                        <TableHead>Lease Period</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((Tenant) => (
                        <TableRow key={Tenant.id}>
                          <TableCell>
                            <button
                              onClick={() => setSelectedTenant(Tenant.id)}
                              className="font-medium text-left hover:text-primary hover:underline transition-colors"
                            >
                              {Tenant.firstName} {Tenant.lastName}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {Tenant.email}
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {Tenant.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {Tenant.lot?.nameOrNumber || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {Tenant.park ? `${Tenant.park.name}, ${Tenant.park.city}` : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={Tenant.status} 
                              onValueChange={(newStatus) => handleStatusChange(Tenant.id, newStatus as Tenant['status'])}
                            >
                              <SelectTrigger className="w-fit p-0 border-0 bg-transparent hover:bg-transparent">
                                <Badge 
                                  variant={getStatusBadgeVariant(Tenant.status)} 
                                  className="flex items-center gap-1 w-fit cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  {getStatusIcon(Tenant.status)}
                                  {Tenant.status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                <SelectItem value="TERMINATED">Terminated</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {Tenant.monthlyRent ? formatCurrency(Tenant.monthlyRent) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {Tenant.leaseStartDate && Tenant.leaseEndDate ? (
                              <div className="text-sm">
                                <div>{formatDate(Tenant.leaseStartDate)}</div>
                                <div className="text-muted-foreground">to {formatDate(Tenant.leaseEndDate)}</div>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedTenant(Tenant.id)}
                              >
                                <User className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTenantToDelete(Tenant)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  // Card View
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredTenants.map((tenant) => (
                        <Card key={tenant.id} className="transition-all hover:shadow-md">
                          <CardHeader className="pb-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <button
                                  onClick={() => setSelectedTenant(tenant.id)}
                                  className="text-xl font-bold mb-1 text-left hover:text-primary hover:underline transition-colors"
                                >
                                  {tenant.firstName} {tenant.lastName}
                                </button>
                              </div>
                              <Select 
                                value={tenant.status} 
                                onValueChange={(newStatus) => handleStatusChange(tenant.id, newStatus as Tenant['status'])}
                              >
                                <SelectTrigger className="w-fit p-0 border-0 bg-transparent hover:bg-transparent">
                                  <Badge 
                                    variant={getStatusBadgeVariant(tenant.status)} 
                                    className="flex items-center gap-1 w-fit cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    {getStatusIcon(tenant.status)}
                                    {tenant.status}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ACTIVE">Active</SelectItem>
                                  <SelectItem value="PENDING">Pending</SelectItem>
                                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Contact info */}
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                <span>{tenant.email}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                <span>{tenant.phone}</span>
                              </div>
                            </div>
                            
                            {/* Lot and location */}
                            {tenant.lot && (
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  <span className="font-medium">Lot {tenant.lot.nameOrNumber}</span>
                                </div>
                                {tenant.park && (
                                  <p className="text-sm text-muted-foreground">{tenant.park.name}</p>
                                )}
                                {tenant.park && (
                                  <p className="text-sm text-muted-foreground">{tenant.park.city}, {tenant.park.state}</p>
                                )}
                              </div>
                            )}
                            
                            {/* Lease info */}
                            <div className="space-y-2">
                              {tenant.monthlyRent && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4" />
                                  <span className="font-medium">${parseFloat(tenant.monthlyRent).toLocaleString()}/month</span>
                                </div>
                              )}
                              
                              {(tenant.leaseStartDate || tenant.leaseEndDate) && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {tenant.leaseStartDate && new Date(tenant.leaseStartDate).toLocaleDateString()}
                                    {tenant.leaseStartDate && tenant.leaseEndDate && ' - '}
                                    {tenant.leaseEndDate && new Date(tenant.leaseEndDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          
                          <CardContent className="pt-0">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedTenant(tenant.id)}
                                className="flex-1"
                              >
                                <User className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setTenantToDelete(tenant)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Tenant Detail Dialog */}
      {selectedTenant && (
        <TenantDetailDialog
          isOpen={!!selectedTenant}
          onClose={() => setSelectedTenant(null)}
          tenantId={selectedTenant}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tenantToDelete} onOpenChange={() => setTenantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete tenant {tenantToDelete?.firstName} {tenantToDelete?.lastName}? 
              This action cannot be undone and will remove all associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tenantToDelete && deleteTenantMutation.mutate(tenantToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTenantMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
