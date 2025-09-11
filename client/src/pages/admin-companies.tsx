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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Building, Plus, Edit, Trash2, Camera } from "lucide-react";

interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  createdAt: string;
}

export default function AdminCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    email: ""
  });
  const [showPhotos, setShowPhotos] = useState<string | null>(null);

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    window.location.href = '/';
    return null;
  }

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: parks } = useQuery<{ parks: Park[] }>({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'ADMIN',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PATCH", `/api/companies/${editingCompany?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingCompany(null);
      resetForm();
      toast({
        title: "Success",
        description: "Company updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update company",
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

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      email: ""
    });
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      phone: company.phone,
      email: company.email
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const companiesList = companies ?? [];
  const parksList = parks?.parks ?? [];
  
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
      <div className="flex-1 p-8">
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
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
            <CardTitle>All Companies</CardTitle>
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
            ) : (
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
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(company)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowPhotos(company.id)}
                            title="Manage Photos"
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this company?")) {
                                deleteMutation.mutate(company.id);
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
        <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
            </DialogHeader>
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
                <Label htmlFor="edit-zipCode">Zip Code</Label>
                <Input
                  id="edit-zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
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
      </div>
    </div>
  );
}