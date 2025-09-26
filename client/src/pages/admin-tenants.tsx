import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { TenantDetailDialog } from "@/components/ui/tenant-detail-dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  X
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

export default function AdminTenants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    status: "PENDING" as Tenant['status'],
    lotId: "",
    leaseStartDate: "",
    leaseEndDate: "",
    monthlyRent: "",
    securityDeposit: "",
    notes: "",
  });

  // Fetch tenants
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

  // Fetch lots for tenant creation
  const { data: lots } = useQuery({
    queryKey: ['lots-for-tenants'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/lots');
      const data = await response.json();
      return data.lots as Lot[];
    },
    enabled: showCreateModal,
  });

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      const payload = {
        ...tenantData,
        leaseStartDate: tenantData.leaseStartDate ? new Date(tenantData.leaseStartDate).toISOString() : null,
        leaseEndDate: tenantData.leaseEndDate ? new Date(tenantData.leaseEndDate).toISOString() : null,
      };
      
      const response = await apiRequest('POST', '/api/tenants', payload);
      const data = await response.json();
      return data.tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setShowCreateModal(false);
      resetForm();
      toast({
        title: "Tenant Created",
        description: "New tenant has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tenant",
        variant: "destructive",
      });
    },
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest('DELETE', `/api/tenants/${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: "Tenant Deleted",
        description: "Tenant has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tenant",
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
      emergencyContactName: "",
      emergencyContactPhone: "",
      status: "PENDING",
      lotId: "",
      leaseStartDate: "",
      leaseEndDate: "",
      monthlyRent: "",
      securityDeposit: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.lotId) {
      toast({
        title: "Validation Error",
        description: "Please select a lot for the tenant.",
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

  const handleDeleteTenant = (tenantId: string, tenantName: string) => {
    if (window.confirm(`Are you sure you want to delete ${tenantName}? This action cannot be undone.`)) {
      deleteTenantMutation.mutate(tenantId);
    }
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

  const filteredTenants = tenants || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-8 w-8" />
                  Tenant Management
                </h1>
                <p className="text-gray-600 mt-2">Manage tenant information, leases, and payments</p>
              </div>
              
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tenant
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Tenant</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as Tenant['status'] }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="TERMINATED">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="lotId">Lot *</Label>
                        <Select value={formData.lotId} onValueChange={(value) => setFormData(prev => ({ ...prev, lotId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a lot" />
                          </SelectTrigger>
                          <SelectContent>
                            {lots?.map((lot) => (
                              <SelectItem key={lot.id} value={lot.id}>
                                {lot.nameOrNumber} - {lot.park?.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Emergency Contact</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="emergencyContactName">Name</Label>
                          <Input
                            id="emergencyContactName"
                            value={formData.emergencyContactName}
                            onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="emergencyContactPhone">Phone</Label>
                          <Input
                            id="emergencyContactPhone"
                            value={formData.emergencyContactPhone}
                            onChange={(e) => setFormData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Lease Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leaseStartDate">Lease Start Date</Label>
                          <Input
                            id="leaseStartDate"
                            type="date"
                            value={formData.leaseStartDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, leaseStartDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="leaseEndDate">Lease End Date</Label>
                          <Input
                            id="leaseEndDate"
                            type="date"
                            value={formData.leaseEndDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, leaseEndDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="monthlyRent">Monthly Rent</Label>
                          <Input
                            id="monthlyRent"
                            type="number"
                            step="0.01"
                            value={formData.monthlyRent}
                            onChange={(e) => setFormData(prev => ({ ...prev, monthlyRent: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="securityDeposit">Security Deposit</Label>
                          <Input
                            id="securityDeposit"
                            type="number"
                            step="0.01"
                            value={formData.securityDeposit}
                            onChange={(e) => setFormData(prev => ({ ...prev, securityDeposit: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createTenantMutation.isPending}
                      >
                        {createTenantMutation.isPending ? 'Creating...' : 'Create Tenant'}
                      </Button>
                    </div>
                  </form>
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
                <CardTitle>
                  Tenants ({filteredTenants.length})
                </CardTitle>
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
                        : 'Get started by adding your first tenant.'
                      }
                    </p>
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tenant
                    </Button>
                  </div>
                ) : (
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
                      {filteredTenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <button
                              onClick={() => setSelectedTenant(tenant.id)}
                              className="font-medium text-left hover:text-primary hover:underline transition-colors"
                            >
                              {tenant.firstName} {tenant.lastName}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {tenant.email}
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {tenant.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {tenant.lot?.nameOrNumber || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              {tenant.park ? `${tenant.park.name}, ${tenant.park.city}` : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(tenant.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(tenant.status)}
                              {tenant.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {tenant.monthlyRent ? formatCurrency(tenant.monthlyRent) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {tenant.leaseStartDate && tenant.leaseEndDate ? (
                              <div className="text-sm">
                                <div>{formatDate(tenant.leaseStartDate)}</div>
                                <div className="text-muted-foreground">to {formatDate(tenant.leaseEndDate)}</div>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedTenant(tenant.id)}
                              >
                                <User className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTenant(tenant.id, `${tenant.firstName} ${tenant.lastName}`)}
                                disabled={deleteTenantMutation.isPending}
                              >
                                Delete
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
    </div>
  );
}
