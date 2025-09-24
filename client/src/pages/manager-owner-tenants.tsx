import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface OwnerTenantAssignment {
  id: string;
  userId: string;
  lotId: string;
  relationshipType: 'OWNER' | 'TENANT';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  userName: string;
  userEmail: string;
  lotName: string;
  parkName: string;
}

interface Lot {
  id: string;
  nameOrNumber: string;
  parkId: string;
  park: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
}

interface CreateUserData {
  email: string;
  fullName: string;
  password: string;
  lotId: string;
  relationshipType: 'OWNER' | 'TENANT';
}

export default function ManagerOwnerTenants() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    email: '',
    fullName: '',
    password: '',
    lotId: '',
    relationshipType: 'OWNER'
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Debug: Log user info and auth state
  console.log('Current user:', user);
  console.log('Access token:', localStorage.getItem('access_token') ? 'Exists' : 'Missing');
  console.log('Refresh token:', localStorage.getItem('refresh_token') ? 'Exists' : 'Missing');
  console.log('User data:', localStorage.getItem('user'));

  // Fetch owner/tenant assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<OwnerTenantAssignment[]>({
    queryKey: ['manager-owner-tenants'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch('/api/manager/owner-tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Authentication expired. Please log in again.');
      }
      
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    },
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('Authentication expired') || error.message.includes('Invalid token')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Fetch lots for the manager
  const { data: lots = [], isLoading: lotsLoading, error: lotsError } = useQuery<Lot[]>({
    queryKey: ['manager-lots'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      console.log('Fetching lots with token:', token ? 'Token exists' : 'No token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch('/api/manager/lots', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
      if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Authentication expired. Please log in again.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch lots: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Fetched lots:', data);
      return data;
    },
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('Authentication expired') || error.message.includes('Invalid token')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch('/api/manager/owner-tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-owner-tenants'] });
      setIsCreateDialogOpen(false);
      setCreateUserData({
        email: '',
        fullName: '',
        password: '',
        lotId: '',
        relationshipType: 'OWNER'
      });
      toast({
        title: 'User created successfully',
        description: 'The owner/tenant user has been created and assigned to the lot.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating user',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ userId, lotId }: { userId: string; lotId: string }) => {
      const response = await fetch(`/api/manager/owner-tenants/${userId}/${lotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove assignment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-owner-tenants'] });
      toast({
        title: 'Assignment removed',
        description: 'The user assignment to the lot has been removed.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error removing assignment',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleCreateUser = () => {
    if (!createUserData.email || !createUserData.fullName || !createUserData.password || !createUserData.lotId || 
        createUserData.lotId === 'loading' || createUserData.lotId === 'error' || createUserData.lotId === 'no-lots') {
      toast({
        title: 'Required fields',
        description: 'Please complete all required fields and select a valid lot.',
        variant: 'destructive'
      });
      return;
    }
    createUserMutation.mutate(createUserData);
  };

  const handleRemoveAssignment = (userId: string, lotId: string) => {
    removeAssignmentMutation.mutate({ userId, lotId });
  };

  if (assignmentsLoading) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Owners & Tenants</h1>
          <p className="text-muted-foreground">
            Manage owner and tenant users for your lots
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Owner/Tenant User</DialogTitle>
              <DialogDescription>
                Create a new user and assign them to a specific lot.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={createUserData.fullName}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lotId">Lot</Label>
                <Select
                  value={createUserData.lotId}
                  onValueChange={(value) => setCreateUserData(prev => ({ ...prev, lotId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={lotsLoading ? "Loading lots..." : lotsError ? "Error loading lots" : "Select a lot"} />
                  </SelectTrigger>
                  <SelectContent>
                    {lotsLoading ? (
                      <SelectItem value="loading" disabled>Loading lots...</SelectItem>
                    ) : lotsError ? (
                      <SelectItem value="error" disabled>Error loading lots</SelectItem>
                    ) : lots.length === 0 ? (
                      <SelectItem value="no-lots" disabled>No lots available</SelectItem>
                    ) : (
                      lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {lot.nameOrNumber} - {lot.park.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {lotsError && (
                  <p className="text-sm text-destructive">Error loading lots: {lotsError.message}</p>
                )}
                {!lotsLoading && !lotsError && lots.length === 0 && (
                  <p className="text-sm text-muted-foreground">No lots available for this manager</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="relationshipType">Relationship Type</Label>
                <Select
                  value={createUserData.relationshipType}
                  onValueChange={(value: 'OWNER' | 'TENANT') => setCreateUserData(prev => ({ ...prev, relationshipType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Owner</SelectItem>
                    <SelectItem value="TENANT">Tenant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
          <CardDescription>
            List of all owner and tenant users assigned to your lots
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assignments</h3>
              <p className="text-muted-foreground mb-4">
                You haven't created any owner or tenant users yet.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First User
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Park</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.userName}</TableCell>
                    <TableCell>{assignment.userEmail}</TableCell>
                    <TableCell>{assignment.lotName}</TableCell>
                    <TableCell>{assignment.parkName}</TableCell>
                    <TableCell>
                      <Badge variant={assignment.relationshipType === 'OWNER' ? 'default' : 'secondary'}>
                        {assignment.relationshipType === 'OWNER' ? 'Owner' : 'Tenant'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.isActive ? 'default' : 'destructive'}>
                        {assignment.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will remove the assignment of user {assignment.userName} to lot {assignment.lotName}. 
                              The user will still exist but will no longer have access to this lot.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveAssignment(assignment.userId, assignment.lotId)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
