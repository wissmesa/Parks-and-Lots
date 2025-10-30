import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Mail, Phone, Users, Edit2, Save, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthManager } from "@/lib/auth";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[] | null;
  createdAt: string;
  companyId?: string | null;
  companyName?: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function CrmContacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "",
    companyId: "",
  });

  const isLord = user?.role === 'MHP_LORD';

  // Fetch companies for MHP_LORD users
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: isLord,
  });

  // Fetch contacts
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["/api/crm/contacts", searchQuery],
    queryFn: async () => {
      const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";
      const res = await fetch(`/api/crm/contacts${params}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Create contact mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newContact) => {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Success", description: "Contact created successfully" });
      setIsCreateOpen(false);
      setNewContact({ firstName: "", lastName: "", email: "", phone: "", source: "", companyId: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    },
  });

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Success", description: "Contact updated successfully" });
      setEditingId(null);
      setEditForm({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
    },
  });

  const contacts: Contact[] = contactsData?.contacts || [];

  // Sort contacts
  const sortedContacts = [...contacts].sort((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case "name-desc":
        return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
      case "date-newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "date-oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });

  const handleRowClick = (contactId: string) => {
    if (editingId === null) {
      setLocation(`/crm/contacts/${contactId}`);
    }
  };

  const startEditing = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(contact.id);
    setEditForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      source: contact.source || "",
    });
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editForm.firstName && editForm.lastName) {
      updateMutation.mutate({
        id: editingId,
        data: editForm,
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Manage your CRM contacts</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLord && (
                <div>
                  <Label htmlFor="companyId">Company *</Label>
                  <Select
                    value={newContact.companyId}
                    onValueChange={(value) => setNewContact({ ...newContact, companyId: value })}
                  >
                    <SelectTrigger id="companyId">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newContact.firstName}
                  onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newContact.lastName}
                  onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={newContact.source}
                  onChange={(e) => setNewContact({ ...newContact, source: e.target.value })}
                  placeholder="Website, Referral, etc."
                />
              </div>
              <Button
                onClick={() => createMutation.mutate(newContact)}
                disabled={!newContact.firstName || !newContact.lastName || (isLord && !newContact.companyId) || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="date-newest">Newest First</SelectItem>
            <SelectItem value="date-oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedContacts.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                {isLord && <TableHead>Company</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={`cursor-pointer hover:bg-muted/50 ${editingId === contact.id ? 'bg-muted' : ''}`}
                  onClick={() => handleRowClick(contact.id)}
                >
                  <TableCell className="font-medium">
                    {editingId === contact.id ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editForm.firstName || ""}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          placeholder="First Name"
                          className="h-8"
                        />
                        <Input
                          value={editForm.lastName || ""}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          placeholder="Last Name"
                          className="h-8"
                        />
                      </div>
                    ) : (
                      `${contact.firstName} ${contact.lastName}`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === contact.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="email@example.com"
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {contact.email && (
                          <>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.email}</span>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === contact.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {contact.phone && (
                          <>
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === contact.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editForm.source || ""}
                          onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                          placeholder="Source"
                          className="h-8"
                        />
                      </div>
                    ) : (
                      contact.source
                    )}
                  </TableCell>
                  {isLord && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.companyName || 'N/A'}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {editingId === contact.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={saveEdit}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => startEditing(contact, e)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? "Try adjusting your search query" : "Get started by creating your first contact"}
          </p>
        </div>
      )}
    </div>
  );
}
