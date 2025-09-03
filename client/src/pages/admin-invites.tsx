import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
import { UserPlus, Plus, Copy, Trash2, Mail } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  createdByUser?: {
    fullName: string;
  };
}

export default function AdminInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // Redirect if not admin
  if (user?.role !== 'ADMIN') {
    window.location.href = '/';
    return null;
  }

  const { data: invites, isLoading } = useQuery({
    queryKey: ["/api/auth/invites"],
    enabled: user?.role === 'ADMIN',
  });

  const createInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/auth/invites", {
        email,
        role: "MANAGER"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invites"] });
      setIsCreateModalOpen(false);
      setInviteEmail("");
      toast({
        title: "Success",
        description: "Manager invite sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invite",
        variant: "destructive",
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/auth/invites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invites"] });
      toast({
        title: "Success",
        description: "Invite cancelled successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel invite",
        variant: "destructive",
      });
    },
  });

  const copyInviteLink = (token: string) => {
    const inviteLink = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      createInviteMutation.mutate(inviteEmail.trim());
    }
  };

  const getInviteStatus = (invite: Invite) => {
    if (invite.acceptedAt) {
      return { status: 'ACCEPTED', variant: 'default' as const };
    }
    if (new Date(invite.expiresAt) < new Date()) {
      return { status: 'EXPIRED', variant: 'destructive' as const };
    }
    return { status: 'PENDING', variant: 'secondary' as const };
  };

  const invitesList = invites?.invites || invites || [];

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <UserPlus className="w-8 h-8" />
                Invites
              </h1>
              <p className="text-muted-foreground mt-2">
                Send invitations to new managers
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Send Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite New Manager</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="manager@example.com"
                      required
                    />
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      An invitation email will be sent to this address with instructions to join as a park manager.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createInviteMutation.isPending}>
                      {createInviteMutation.isPending ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading invites...</p>
              </div>
            ) : invitesList.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No invites sent yet</p>
                <p className="text-sm text-muted-foreground">Send your first manager invitation</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitesList.map((invite: Invite) => {
                    const { status, variant } = getInviteStatus(invite);
                    
                    return (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <div className="font-medium">{invite.email}</div>
                          {invite.acceptedAt && (
                            <div className="text-xs text-muted-foreground">
                              Accepted {new Date(invite.acceptedAt).toLocaleDateString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{invite.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant}>{status}</Badge>
                        </TableCell>
                        <TableCell>
                          {invite.createdByUser?.fullName || 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {new Date(invite.createdAt).toLocaleDateString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyInviteLink(invite.token)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to cancel this invite?")) {
                                      deleteInviteMutation.mutate(invite.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {status === 'EXPIRED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => createInviteMutation.mutate(invite.email)}
                              >
                                Resend
                              </Button>
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
    </div>
  );
}