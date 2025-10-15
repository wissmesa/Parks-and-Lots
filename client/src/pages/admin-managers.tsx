import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Trash2, UserPlus, Settings, Edit, MoreHorizontal, List, Grid3X3 } from "lucide-react";

interface Manager {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  assignedParks?: Array<{
    id: string;
    name: string;
  }>;
}

interface Park {
  id: string;
  name: string;
}

export default function AdminManagers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [editedName, setEditedName] = useState("");
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>([]);

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // RequireRole component now handles authentication/authorization

  const { data: managers, isLoading: managersLoading } = useQuery({
    queryKey: ["/api/admin/managers"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: parks } = useQuery({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: assignments } = useQuery({
    queryKey: ["/api/admin/manager-assignments"],
    enabled: user?.role === 'MHP_LORD',
  });

  const assignParksMutation = useMutation({
    mutationFn: async ({ managerId, parkIds }: { managerId: string; parkIds: string[] }) => {
      // First remove existing assignments
      await apiRequest("DELETE", `/api/admin/managers/${managerId}/assignments`);
      
      // Then add new assignments
      if (parkIds.length > 0) {
        await Promise.all(
          parkIds.map(parkId =>
            apiRequest("POST", "/api/admin/manager-assignments", {
              userId: managerId,
              parkId
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/manager-assignments"] });
      setIsAssignModalOpen(false);
      setSelectedManager(null);
      setSelectedParkIds([]);
      toast({
        title: "Success",
        description: "Manager park assignments updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update manager assignments",
        variant: "destructive",
      });
    },
  });

  const updateManagerMutation = useMutation({
    mutationFn: async ({ id, fullName }: { id: string; fullName: string }) => {
      return apiRequest("PATCH", `/api/admin/managers/${id}`, { fullName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managers"] });
      setIsEditModalOpen(false);
      setEditingManager(null);
      setEditedName("");
      toast({
        title: "Success",
        description: "Manager name updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update manager name",
        variant: "destructive",
      });
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/managers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/managers"] });
      toast({
        title: "Success",
        description: "Manager removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove manager",
        variant: "destructive",
      });
    },
  });

  const handleAssignParks = (manager: Manager) => {
    setSelectedManager(manager);
    const managerAssignments = Array.isArray(assignments) ? assignments.filter((a: any) => a.userId === manager.id) : [];
    setSelectedParkIds(managerAssignments.map((a: any) => a.parkId));
    setIsAssignModalOpen(true);
  };

  const handleEditManager = (manager: Manager) => {
    setEditingManager(manager);
    setEditedName(manager.fullName);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingManager && editedName.trim()) {
      updateManagerMutation.mutate({
        id: editingManager.id,
        fullName: editedName.trim()
      });
    }
  };

  const handleParkToggle = (parkId: string) => {
    setSelectedParkIds(prev =>
      prev.includes(parkId)
        ? prev.filter(id => id !== parkId)
        : [...prev, parkId]
    );
  };

  const managersList = Array.isArray(managers?.managers) ? managers.managers : Array.isArray(managers) ? managers : [];
  const parksList = Array.isArray(parks?.parks) ? parks.parks : Array.isArray(parks) ? parks : [];

  // Group assignments by manager
  const managerParkMap = Array.isArray(assignments) ? assignments.reduce((acc: any, assignment: any) => {
    if (!acc[assignment.userId]) {
      acc[assignment.userId] = [];
    }
    acc[assignment.userId].push({
      id: assignment.parkId,
      name: assignment.parkName
    });
    return acc;
  }, {}) : {};

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="w-8 h-8" />
                Managers
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage park managers and their assignments
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.href = '/admin/invites'}>
                <UserPlus className="w-4 h-4 mr-2" />
                Send Invites
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Managers</CardTitle>
              
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
            {managersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading managers...</p>
              </div>
            ) : managersList.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No managers found</p>
                <p className="text-sm text-muted-foreground">Send invites to add managers</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Parks</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managersList.map((manager: Manager) => {
                    const assignedParks = managerParkMap[manager.id] || [];
                    
                    return (
                      <TableRow key={manager.id}>
                        <TableCell>
                          <div className="font-medium">{manager.fullName}</div>
                          <Badge variant="secondary">{manager.role}</Badge>
                        </TableCell>
                        <TableCell>{manager.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assignedParks.length === 0 ? (
                              <Badge variant="outline">No assignments</Badge>
                            ) : (
                              assignedParks.map((park: any) => (
                                <Badge key={park.id} variant="default" className="text-xs">
                                  {park.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {new Date(manager.createdAt).toLocaleDateString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`manager-actions-${manager.id}`}
                              >
                                Actions
                                <MoreHorizontal className="w-4 h-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditManager(manager)}
                                data-testid={`button-edit-manager-${manager.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAssignParks(manager)}
                                data-testid={`button-assign-parks-${manager.id}`}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Assign Parks
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove ${manager.fullName}?`)) {
                                    deleteManagerMutation.mutate(manager.id);
                                  }
                                }}
                                data-testid={`button-delete-manager-${manager.id}`}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Manager
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              // Card View
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {managersList.map((manager: Manager) => {
                  const assignedParks = managerParkMap[manager.id] || [];
                  
                  return (
                    <Card key={manager.id} className="transition-all hover:shadow-md">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-1">{manager.fullName}</h3>
                            <Badge variant="secondary">{manager.role}</Badge>
                          </div>
                        </div>
                        
                        {/* Email */}
                        <div className="mb-3">
                          <p className="text-sm text-muted-foreground">📧 {manager.email}</p>
                        </div>
                        
                        {/* Assigned Parks */}
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-2">Assigned Parks:</p>
                          <div className="flex flex-wrap gap-1">
                            {assignedParks.length === 0 ? (
                              <Badge variant="outline">No assignments</Badge>
                            ) : (
                              assignedParks.map((park) => (
                                <Badge key={park.id} variant="secondary" className="text-xs">
                                  {park.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                        
                        {/* Joined date */}
                        <div>
                          <Badge variant="outline" className="text-xs">
                            Joined {new Date(manager.createdAt).toLocaleDateString()}
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedManager(manager);
                                setSelectedParkIds(assignedParks.map(p => p.id));
                                setIsAssignModalOpen(true);
                              }}
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Assign Parks
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingManager(manager);
                                setEditedName(manager.fullName);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Name
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove ${manager.fullName}?`)) {
                                  deleteManagerMutation.mutate(manager.id);
                                }
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Manager
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Parks Dialog */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Parks to {selectedManager?.fullName}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Select parks to assign to this manager. Current assignments for each park are shown below.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Parks</Label>
                <div className="mt-2 space-y-3 max-h-80 overflow-y-auto">
                  {parksList.map((park: Park) => {
                    // Find all managers currently assigned to this park
                    const currentAssignments = Array.isArray(assignments) 
                      ? assignments.filter((a: any) => a.parkId === park.id)
                      : [];
                    
                    const currentManagers = currentAssignments.map((assignment: any) => {
                      const manager = managersList.find((m: Manager) => m.id === assignment.userId);
                      return manager?.fullName || 'Unknown Manager';
                    });

                    return (
                      <div key={park.id} className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            id={`park-${park.id}`}
                            checked={selectedParkIds.includes(park.id)}
                            onChange={() => handleParkToggle(park.id)}
                            className="rounded mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`park-${park.id}`} className="text-sm font-medium cursor-pointer">
                              {park.name}
                            </Label>
                            <div className="mt-1">
                              {currentManagers.length === 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  No current assignments
                                </Badge>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-xs text-muted-foreground mr-1">Currently assigned to:</span>
                                  {currentManagers.map((managerName, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {managerName}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedManager) {
                      assignParksMutation.mutate({
                        managerId: selectedManager.id,
                        parkIds: selectedParkIds
                      });
                    }
                  }}
                  disabled={assignParksMutation.isPending}
                >
                  {assignParksMutation.isPending ? "Updating..." : "Update Assignments"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Manager Dialog */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Manager Name</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="manager-name">Full Name</Label>
                <Input
                  id="manager-name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter manager name"
                  data-testid="input-manager-name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateManagerMutation.isPending || !editedName.trim()}
                  data-testid="button-save-edit"
                >
                  {updateManagerMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}