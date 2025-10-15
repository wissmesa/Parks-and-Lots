import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Mail, Calendar, Trash2, Copy, CheckCircle, XCircle, Clock, Users } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  parkId?: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  createdByUserId: string;
  createdByUserName?: string;
  token?: string; // Include token for copy link functionality
}

interface Park {
  id: string;
  name: string;
}

export default function ManagerInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "ADMIN">("MANAGER");
  const [selectedParkId, setSelectedParkId] = useState("");

  // Redirect if not company manager
  if (user?.role !== 'ADMIN') {
    window.location.href = '/';
    return null;
  }

  const { data: invites, isLoading: invitesLoading } = useQuery<Invite[]>({
    queryKey: ["/api/company-manager/invites"],
    enabled: user?.role === 'ADMIN',
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const { data: companyParks } = useQuery<{parks: Park[]}>({
    queryKey: ["/api/company-manager/parks"],
    enabled: user?.role === 'ADMIN',
  });

  const { data: companyManagers, isLoading: managersLoading } = useQuery<{managers: any[]}>({
    queryKey: ["/api/company-manager/managers"],
    enabled: user?.role === 'ADMIN',
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });


  const createInviteMutation = useMutation({
    mutationFn: async ({ email, fullName, role, parkId }: { 
      email: string; 
      fullName: string; 
      role: "MANAGER" | "ADMIN";
      parkId?: string;
    }) => {
      return apiRequest("POST", "/api/company-manager/invites", {
        email,
        fullName,
        role,
        parkId: role === "MANAGER" ? parkId : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/managers"] });
      setIsCreateModalOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("MANAGER");
      setSelectedParkId("");
      toast({
        title: "Success",
        description: "Invite sent successfully",
      });
    },
    onError: (error: any) => {
      console.error('Invite creation error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send invite",
        variant: "destructive",
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/company-manager/invites/${id}`);
    },
    onSuccess: () => {
      // Real-time update: immediately invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-manager/managers"] });
      toast({
        title: "Success",
        description: "Invite cancelled successfully",
      });
    },
    onError: (error: any) => {
      console.error('Delete invite error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to cancel invite",
        variant: "destructive",
      });
    },
  });

  const copyInviteLink = (invite: Invite) => {
    if (invite.token) {
      const inviteLink = `${window.location.origin}/accept-invite?token=${invite.token}`;
      navigator.clipboard.writeText(inviteLink).then(() => {
        toast({
          title: "Copied!",
          description: "Invite link copied to clipboard",
        });
      });
    } else {
      toast({
        title: "Invite Sent",
        description: "The invite link has been sent to the manager's email address",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteFullName.trim()) return;
    
    // Validate park selection for MANAGER role
    if (inviteRole === 'MANAGER' && !selectedParkId) {
      toast({
        title: "Error",
        description: "Please select a park for Manager role",
        variant: "destructive",
      });
      return;
    }

    // Validate that selected park is not already assigned
    if (inviteRole === 'MANAGER' && selectedParkId && assignedParkIds.includes(selectedParkId)) {
      toast({
        title: "Error",
        description: "This park is already assigned to another manager",
        variant: "destructive",
      });
      return;
    }
    
    createInviteMutation.mutate({
      email: inviteEmail.trim(),
      fullName: inviteFullName.trim(),
      role: inviteRole,
      parkId: inviteRole === 'MANAGER' ? selectedParkId : undefined
    });
  };

  const getInviteStatus = (invite: Invite) => {
    if (invite.acceptedAt) {
      return { status: "accepted", label: "Accepted", icon: CheckCircle, color: "bg-green-100 text-green-800" };
    }
    if (new Date(invite.expiresAt) < new Date()) {
      return { status: "expired", label: "Expired", icon: XCircle, color: "bg-red-100 text-red-800" };
    }
    return { status: "pending", label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-800" };
  };

  const invitesList = Array.isArray(invites) ? invites : [];
  const managersList = Array.isArray(companyManagers?.managers) ? companyManagers.managers : [];

  // Get list of already assigned park IDs
  const assignedParkIds = managersList
    .filter(manager => manager.role === 'MANAGER' && manager.assignedParks)
    .flatMap(manager => manager.assignedParks.map((park: any) => park.id));

  // Clear selected park if it becomes assigned
  useEffect(() => {
    if (selectedParkId && assignedParkIds.includes(selectedParkId)) {
      setSelectedParkId("");
    }
  }, [selectedParkId, assignedParkIds]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <ManagerSidebar />
        <main className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Manager Invites</h1>
                <p className="text-muted-foreground">
                  Invite managers and company managers to join your company
                </p>
              </div>
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Manager
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Manager</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="manager@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRole} onValueChange={(value: "MANAGER" | "ADMIN") => {
                        setInviteRole(value);
                        setSelectedParkId(""); // Reset park selection when role changes
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {inviteRole === "MANAGER" && (
                      <div className="space-y-2">
                        <Label htmlFor="park">Assign to Park</Label>
                        <Select value={selectedParkId} onValueChange={setSelectedParkId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a park" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyParks?.parks?.map((park) => {
                              const isAssigned = assignedParkIds.includes(park.id);
                              return (
                                <SelectItem 
                                  key={park.id} 
                                  value={park.id}
                                  disabled={isAssigned}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span className={isAssigned ? "text-gray-400 line-through" : ""}>
                                      {park.name}
                                    </span>
                                    {isAssigned && (
                                      <span className="text-xs text-gray-400 ml-2">
                                        (Assigned)
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {assignedParkIds.length > 0 && (
                          <p className="text-sm text-gray-500">
                            Parks already assigned to managers are disabled
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateModalOpen(false);
                          setInviteEmail("");
                          setInviteFullName("");
                          setInviteRole("MANAGER");
                          setSelectedParkId("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createInviteMutation.isPending}
                      >
                        {createInviteMutation.isPending ? "Sending..." : "Send Invite"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Current Managers Section */}
            <Card>
              <CardHeader>
                <CardTitle>Current Managers</CardTitle>
              </CardHeader>
              <CardContent>
                {managersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading managers...</div>
                  </div>
                ) : managersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No managers yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Invite managers to join your company
                    </p>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Manager
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managersList.map((manager) => (
                        <TableRow key={manager.id}>
                          <TableCell className="font-medium">{manager.fullName}</TableCell>
                          <TableCell>{manager.email}</TableCell>
                          <TableCell>
                            <Badge variant={manager.role === "ADMIN" ? "default" : "secondary"}>
                              {manager.role === "ADMIN" ? "Admin" : "Manager"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {manager.role === "ADMIN" 
                              ? "Company Access" 
                              : manager.assignedParks?.length > 0 
                                ? (
                                  <div className="flex flex-wrap gap-1">
                                    {manager.assignedParks.map((park: any) => (
                                      <Badge key={park.id} variant="outline" className="text-xs">
                                        {park.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )
                                : "No Parks Assigned"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge className={manager.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {manager.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(manager.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites Section */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Invites</CardTitle>
              </CardHeader>
              <CardContent>
                {invitesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading invites...</div>
                  </div>
                ) : invitesList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No pending invites</h3>
                    <p className="text-muted-foreground mb-4">
                      All invites have been accepted or expired
                    </p>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Manager
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitesList.map((invite) => {
                        const statusInfo = getInviteStatus(invite);
                        const StatusIcon = statusInfo.icon;
                        
                        // Find park name for MANAGER role
                        const parkName = invite.role === "MANAGER" && invite.parkId 
                          ? companyParks?.parks?.find(p => p.id === invite.parkId)?.name || "Unknown Park"
                          : null;

                        return (
                          <TableRow key={invite.id}>
                            <TableCell className="font-medium">{invite.email}</TableCell>
                            <TableCell>{invite.createdByUserName || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant={invite.role === "ADMIN" ? "default" : "secondary"}>
                                {invite.role === "ADMIN" ? "Admin" : "Manager"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invite.role === "ADMIN" 
                                ? "Company Access" 
                                : parkName || "No Park Assigned"
                              }
                            </TableCell>
                            <TableCell>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(invite.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(invite.expiresAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {statusInfo.status === "pending" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyInviteLink(invite)}
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      Copy Link
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteInviteMutation.mutate(invite.id)}
                                      disabled={deleteInviteMutation.isPending}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Cancel
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
