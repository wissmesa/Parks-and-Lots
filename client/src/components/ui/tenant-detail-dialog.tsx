import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Edit3
} from "lucide-react";

interface OWNER_TENANT {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'TERMINATED';
  leaseStartDate?: string;
  leaseEndDate?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

interface Payment {
  id: string;
  type: 'RENT' | 'DEPOSIT' | 'LATE_FEE' | 'MAINTENANCE' | 'UTILITY' | 'OTHER';
  amount: string;
  dueDate: string;
  paidDate?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
  description?: string;
  notes?: string;
  createdAt: string;
}

interface TenantDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export function TenantDetailDialog({ isOpen, onClose, tenantId }: TenantDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingTenant, setEditingTenant] = useState(false);

  // Fetch OWNER_TENANT details
  const { data: OWNER_TENANT, isLoading: tenantLoading } = useQuery({
    queryKey: ['OWNER_TENANT', tenantId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tenants/${tenantId}`);
      const data = await response.json();
      return data.OWNER_TENANT as OWNER_TENANT;
    },
    enabled: isOpen && !!tenantId,
  });

  // Fetch OWNER_TENANT payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['OWNER_TENANT-payments', tenantId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tenants/${tenantId}/payments`);
      const data = await response.json();
      return data.payments as Payment[];
    },
    enabled: isOpen && !!tenantId,
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    type: 'RENT' as Payment['type'],
    amount: '',
    dueDate: '',
    description: '',
    notes: '',
  });

  // OWNER_TENANT edit form state
  const [tenantForm, setTenantForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    status: 'ACTIVE' as OWNER_TENANT['status'],
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRent: '',
    securityDeposit: '',
    notes: '',
  });

  // Set form data when OWNER_TENANT loads
  useState(() => {
    if (OWNER_TENANT) {
      setTenantForm({
        firstName: OWNER_TENANT.firstName || '',
        lastName: OWNER_TENANT.lastName || '',
        email: OWNER_TENANT.email || '',
        phone: OWNER_TENANT.phone || '',
        emergencyContactName: OWNER_TENANT.emergencyContactName || '',
        emergencyContactPhone: OWNER_TENANT.emergencyContactPhone || '',
        status: OWNER_TENANT.status,
        leaseStartDate: OWNER_TENANT.leaseStartDate ? OWNER_TENANT.leaseStartDate.split('T')[0] : '',
        leaseEndDate: OWNER_TENANT.leaseEndDate ? OWNER_TENANT.leaseEndDate.split('T')[0] : '',
        monthlyRent: OWNER_TENANT.monthlyRent || '',
        securityDeposit: OWNER_TENANT.securityDeposit || '',
        notes: OWNER_TENANT.notes || '',
      });
    }
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest('POST', '/api/payments', {
        ...paymentData,
        tenantId,
        dueDate: new Date(paymentData.dueDate).toISOString(),
      });
      const data = await response.json();
      return data.payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['OWNER_TENANT-payments', tenantId] });
      setShowAddPayment(false);
      setPaymentForm({
        type: 'RENT',
        amount: '',
        dueDate: '',
        description: '',
        notes: '',
      });
      toast({
        title: "Payment Added",
        description: "Payment has been successfully added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add payment",
        variant: "destructive",
      });
    },
  });

  // Update OWNER_TENANT mutation
  const updateTenantMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest('PATCH', `/api/tenants/${tenantId}`, {
        ...updates,
        leaseStartDate: updates.leaseStartDate ? new Date(updates.leaseStartDate).toISOString() : null,
        leaseEndDate: updates.leaseEndDate ? new Date(updates.leaseEndDate).toISOString() : null,
      });
      const data = await response.json();
      return data.OWNER_TENANT;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['OWNER_TENANT', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setEditingTenant(false);
      toast({
        title: "OWNER_TENANT Updated",
        description: "OWNER_TENANT information has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update OWNER_TENANT",
        variant: "destructive",
      });
    },
  });

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    createPaymentMutation.mutate(paymentForm);
  };

  const handleUpdateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantMutation.mutate(tenantForm);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'OVERDUE':
      case 'TERMINATED':
        return 'destructive';
      case 'INACTIVE':
      case 'PARTIAL':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'OVERDUE':
      case 'TERMINATED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (!OWNER_TENANT && !tenantLoading) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {OWNER_TENANT ? `${OWNER_TENANT.firstName} ${OWNER_TENANT.lastName}` : 'Loading...'}
          </DialogTitle>
        </DialogHeader>

        {tenantLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading OWNER_TENANT details...</div>
          </div>
        ) : OWNER_TENANT ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="lot">Lot Info</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                    {getStatusIcon(OWNER_TENANT.status)}
                  </CardHeader>
                  <CardContent>
                    <Badge variant={getStatusBadgeVariant(OWNER_TENANT.status)}>
                      {OWNER_TENANT.status}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Rent</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {OWNER_TENANT.monthlyRent ? formatCurrency(OWNER_TENANT.monthlyRent) : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Deposit</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {OWNER_TENANT.securityDeposit ? formatCurrency(OWNER_TENANT.securityDeposit) : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Lease Period</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {OWNER_TENANT.leaseStartDate && OWNER_TENANT.leaseEndDate ? (
                        <>
                          <div>{formatDate(OWNER_TENANT.leaseStartDate)}</div>
                          <div className="text-muted-foreground">to {formatDate(OWNER_TENANT.leaseEndDate)}</div>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{OWNER_TENANT.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{OWNER_TENANT.phone}</span>
                    </div>
                    {OWNER_TENANT.emergencyContactName && (
                      <>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Emergency: {OWNER_TENANT.emergencyContactName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{OWNER_TENANT.emergencyContactPhone}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {OWNER_TENANT.notes && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{OWNER_TENANT.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">OWNER_TENANT Details</h3>
                <Button
                  onClick={() => setEditingTenant(!editingTenant)}
                  variant="outline"
                  size="sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {editingTenant ? 'Cancel' : 'Edit'}
                </Button>
              </div>

              {editingTenant ? (
                <form onSubmit={handleUpdateTenant} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={tenantForm.firstName}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={tenantForm.lastName}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={tenantForm.email}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={tenantForm.phone}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, phone: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={tenantForm.status} onValueChange={(value) => setTenantForm(prev => ({ ...prev, status: value as OWNER_TENANT['status'] }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="TERMINATED">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        value={tenantForm.emergencyContactName}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        value={tenantForm.emergencyContactPhone}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="leaseStartDate">Lease Start Date</Label>
                      <Input
                        id="leaseStartDate"
                        type="date"
                        value={tenantForm.leaseStartDate}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, leaseStartDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="leaseEndDate">Lease End Date</Label>
                      <Input
                        id="leaseEndDate"
                        type="date"
                        value={tenantForm.leaseEndDate}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, leaseEndDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyRent">Monthly Rent</Label>
                      <Input
                        id="monthlyRent"
                        type="number"
                        step="0.01"
                        value={tenantForm.monthlyRent}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, monthlyRent: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="securityDeposit">Security Deposit</Label>
                      <Input
                        id="securityDeposit"
                        type="number"
                        step="0.01"
                        value={tenantForm.securityDeposit}
                        onChange={(e) => setTenantForm(prev => ({ ...prev, securityDeposit: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={tenantForm.notes}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingTenant(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateTenantMutation.isPending}
                    >
                      {updateTenantMutation.isPending ? 'Updating...' : 'Update OWNER_TENANT'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <div className="p-2 bg-muted rounded">{OWNER_TENANT.firstName} {OWNER_TENANT.lastName}</div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <div className="p-2">
                        <Badge variant={getStatusBadgeVariant(OWNER_TENANT.status)}>
                          {OWNER_TENANT.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <div className="p-2 bg-muted rounded">{OWNER_TENANT.email}</div>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <div className="p-2 bg-muted rounded">{OWNER_TENANT.phone}</div>
                    </div>
                  </div>
                  {OWNER_TENANT.notes && (
                    <div>
                      <Label>Notes</Label>
                      <div className="p-2 bg-muted rounded">{OWNER_TENANT.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Payment History</h3>
                <Button
                  onClick={() => setShowAddPayment(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </div>

              {showAddPayment && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add New Payment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddPayment} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="paymentType">Type</Label>
                          <Select value={paymentForm.type} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, type: value as Payment['type'] }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RENT">Rent</SelectItem>
                              <SelectItem value="DEPOSIT">Deposit</SelectItem>
                              <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                              <SelectItem value="UTILITY">Utility</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="amount">Amount</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="dueDate">Due Date</Label>
                          <Input
                            id="dueDate"
                            type="date"
                            value={paymentForm.dueDate}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, dueDate: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            value={paymentForm.description}
                            onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="paymentNotes">Notes</Label>
                        <Textarea
                          id="paymentNotes"
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowAddPayment(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createPaymentMutation.isPending}
                        >
                          {createPaymentMutation.isPending ? 'Adding...' : 'Add Payment'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {paymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading payments...</div>
                </div>
              ) : payments && payments.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Paid Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {payment.type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{formatDate(payment.dueDate)}</TableCell>
                            <TableCell>
                              {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(payment.status)}>
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{payment.description || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Payments</h3>
                  <p className="text-muted-foreground">No payment records found for this OWNER_TENANT.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lot" className="space-y-4">
              {OWNER_TENANT.lot && OWNER_TENANT.park ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Lot Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Lot Name/Number</Label>
                        <div className="p-2 bg-muted rounded font-medium">{OWNER_TENANT.lot.nameOrNumber}</div>
                      </div>
                      <div>
                        <Label>Park</Label>
                        <div className="p-2 bg-muted rounded">{OWNER_TENANT.park.name}</div>
                      </div>
                      <div>
                        <Label>Location</Label>
                        <div className="p-2 bg-muted rounded">{OWNER_TENANT.park.city}, {OWNER_TENANT.park.state}</div>
                      </div>
                    </div>
                    {OWNER_TENANT.lot.description && (
                      <div>
                        <Label>Description</Label>
                        <div className="p-2 bg-muted rounded">{OWNER_TENANT.lot.description}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Lot Information</h3>
                  <p className="text-muted-foreground">Lot information is not available for this OWNER_TENANT.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">OWNER_TENANT Not Found</h3>
            <p className="text-muted-foreground">The requested OWNER_TENANT could not be found.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
