import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, CheckCircle2, Circle, Clock, Building2, DollarSign, Trash2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthManager } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AssociationsSection } from "@/components/crm/associations-section";
import { MentionTextarea } from "@/components/crm/mention-textarea";
import { NoteItem } from "@/components/crm/note-item";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: string[] | null;
  price?: string | null;
  priceForRent?: string | null;
  priceForSale?: string | null;
  priceRentToOwn?: string | null;
  priceContractForDeed?: string | null;
  depositForRent?: string | null;
  depositForSale?: string | null;
  depositRentToOwn?: string | null;
  depositContractForDeed?: string | null;
  downPaymentContractForDeed?: string | null;
  lotRent?: string | null;
  promotionalPrice?: string | null;
  promotionalPriceActive?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqFt?: number | null;
  description?: string | null;
  mobileHomeYear?: number | null;
  mobileHomeSize?: string | null;
  showingLink?: string | null;
  availableDate?: string | null;
  parkId?: string | null;
  createdAt: string;
}

interface Park {
  id: string;
  name: string;
}

interface Note {
  id: string;
  content: string;
  createdBy: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

const LOT_STATUSES = [
  "FOR_RENT",
  "FOR_SALE",
  "RENT_TO_OWN",
  "CONTRACT_FOR_DEED",
  "OCCUPIED",
  "MAINTENANCE",
  "RESERVED"
];

export default function CrmUnitDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lot>>({});
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "", assignedTo: "" });
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [taskSortBy, setTaskSortBy] = useState("date-newest");

  // Fetch lot
  const { data: lot, isLoading } = useQuery<Lot>({
    queryKey: ["/api/lots", id],
    queryFn: async () => {
      const res = await fetch(`/api/lots/${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch unit");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch park info
  const { data: park } = useQuery<Park>({
    queryKey: ["/api/parks", lot?.parkId],
    queryFn: async () => {
      if (!lot?.parkId) return null;
      const res = await fetch(`/api/parks/${lot.parkId}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch park");
      return res.json();
    },
    enabled: !!lot?.parkId,
  });

  // Fetch company users
  const { data: usersData } = useQuery({
    queryKey: ["/api/crm/company-users"],
    queryFn: async () => {
      const res = await fetch("/api/crm/company-users", {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch notes
  const { data: notesData } = useQuery({
    queryKey: ["/api/crm/notes", "LOT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/notes?entityType=LOT&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ["/api/crm/tasks", "LOT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/tasks?entityType=LOT&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Fetch activities
  const { data: activitiesData } = useQuery({
    queryKey: ["/api/crm/activities", "LOT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/activities?entityType=LOT&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Update lot mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Lot>) => {
      const res = await fetch(`/api/lots/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update unit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/units"] });
      toast({ title: "Success", description: "Unit updated successfully" });
      setIsEditingInfo(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update unit", variant: "destructive" });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/crm/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          content,
          entityType: "LOT",
          entityId: id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Note added successfully" });
      setNewNote("");
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; assignedTo: string }) => {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          entityType: "LOT",
          entityId: id,
          status: "TODO",
          priority: "MEDIUM",
          assignedTo: data.assignedTo || user?.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Task created successfully" });
      setNewTask({ title: "", description: "", assignedTo: "" });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "DELETE",
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Task deleted successfully" });
      setDeleteTaskId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  // Toggle complete mutation
  const toggleCompleteTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === "COMPLETED" ? "TODO" : "COMPLETED";
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
    },
  });

  const notes: Note[] = notesData?.notes || [];
  const tasks: Task[] = tasksData?.tasks || [];
  const activities: Activity[] = activitiesData?.activities || [];
  const companyUsers: User[] = usersData?.users || [];

  // Sort tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    switch (taskSortBy) {
      case "priority-high":
        const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      case "priority-low":
        const priorityOrderLow = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (priorityOrderLow[a.priority as keyof typeof priorityOrderLow] || 0) - 
               (priorityOrderLow[b.priority as keyof typeof priorityOrderLow] || 0);
      case "due-nearest":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case "due-farthest":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      case "date-newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "date-oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });

  const handleSaveInfo = () => {
    if (editForm.nameOrNumber) {
      updateMutation.mutate(editForm);
    }
  };

  const startEditingInfo = () => {
    if (lot) {
      setEditForm({
        nameOrNumber: lot.nameOrNumber,
        status: lot.status || [],
        priceForRent: lot.priceForRent || "",
        priceForSale: lot.priceForSale || "",
        priceRentToOwn: lot.priceRentToOwn || "",
        priceContractForDeed: lot.priceContractForDeed || "",
        depositForRent: lot.depositForRent || "",
        depositForSale: lot.depositForSale || "",
        depositRentToOwn: lot.depositRentToOwn || "",
        depositContractForDeed: lot.depositContractForDeed || "",
        downPaymentContractForDeed: lot.downPaymentContractForDeed || "",
        lotRent: lot.lotRent || "",
        promotionalPrice: lot.promotionalPrice || "",
        promotionalPriceActive: lot.promotionalPriceActive || false,
        bedrooms: lot.bedrooms || 0,
        bathrooms: lot.bathrooms || 0,
        sqFt: lot.sqFt || 0,
        description: lot.description || "",
        mobileHomeYear: lot.mobileHomeYear || 0,
        mobileHomeSize: lot.mobileHomeSize || "",
        showingLink: lot.showingLink || "",
        availableDate: lot.availableDate || "",
      });
      setIsEditingInfo(true);
    }
  };

  const toggleStatus = (status: string) => {
    const currentStatuses = editForm.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    setEditForm({ ...editForm, status: newStatuses });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800";
      case "HIGH":
        return "bg-orange-100 text-orange-800";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    // Use a neutral color scheme for all statuses
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Unit not found</h3>
          <Button onClick={() => setLocation("/crm/units")}>Back to Units</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation("/crm/units")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Units
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Unit {lot.nameOrNumber}</h1>
            <p className="text-muted-foreground">{park ? `${park.name}` : "Unit Details"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lot.status && lot.status.map((s) => (
              <Badge key={s} className={getStatusColor(s)}>
                {s.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Information - Left Side (2/3 width) */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Unit Information</CardTitle>
                  {!isEditingInfo ? (
                    <Button onClick={startEditingInfo}>Edit</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button onClick={handleSaveInfo} disabled={updateMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingInfo(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
              {isEditingInfo ? (
                <>
                  <div>
                    <Label>Unit Name/Number</Label>
                    <Input
                      value={editForm.nameOrNumber || ""}
                      onChange={(e) => setEditForm({ ...editForm, nameOrNumber: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="mb-3 block">Status</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {LOT_STATUSES.map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={status}
                            checked={editForm.status?.includes(status)}
                            onCheckedChange={() => toggleStatus(status)}
                          />
                          <label htmlFor={status} className="text-sm cursor-pointer">
                            {status.replace(/_/g, " ")}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Pricing</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price for Rent</Label>
                        <Input
                          type="number"
                          value={editForm.priceForRent || ""}
                          onChange={(e) => setEditForm({ ...editForm, priceForRent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Price for Sale</Label>
                        <Input
                          type="number"
                          value={editForm.priceForSale || ""}
                          onChange={(e) => setEditForm({ ...editForm, priceForSale: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Rent to Own</Label>
                        <Input
                          type="number"
                          value={editForm.priceRentToOwn || ""}
                          onChange={(e) => setEditForm({ ...editForm, priceRentToOwn: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Contract for Deed</Label>
                        <Input
                          type="number"
                          value={editForm.priceContractForDeed || ""}
                          onChange={(e) => setEditForm({ ...editForm, priceContractForDeed: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Lot Rent</Label>
                        <Input
                          type="number"
                          value={editForm.lotRent || ""}
                          onChange={(e) => setEditForm({ ...editForm, lotRent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Promotional Price</Label>
                        <Input
                          type="number"
                          value={editForm.promotionalPrice || ""}
                          onChange={(e) => setEditForm({ ...editForm, promotionalPrice: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-3">
                      <Checkbox
                        id="promotionalActive"
                        checked={editForm.promotionalPriceActive}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, promotionalPriceActive: checked as boolean })}
                      />
                      <label htmlFor="promotionalActive" className="text-sm cursor-pointer">
                        Promotional Price Active
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Deposits</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Deposit for Rent</Label>
                        <Input
                          type="number"
                          value={editForm.depositForRent || ""}
                          onChange={(e) => setEditForm({ ...editForm, depositForRent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Deposit for Sale</Label>
                        <Input
                          type="number"
                          value={editForm.depositForSale || ""}
                          onChange={(e) => setEditForm({ ...editForm, depositForSale: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Deposit Rent to Own</Label>
                        <Input
                          type="number"
                          value={editForm.depositRentToOwn || ""}
                          onChange={(e) => setEditForm({ ...editForm, depositRentToOwn: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Deposit Contract for Deed</Label>
                        <Input
                          type="number"
                          value={editForm.depositContractForDeed || ""}
                          onChange={(e) => setEditForm({ ...editForm, depositContractForDeed: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Down Payment (Contract for Deed)</Label>
                        <Input
                          type="number"
                          value={editForm.downPaymentContractForDeed || ""}
                          onChange={(e) => setEditForm({ ...editForm, downPaymentContractForDeed: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Property Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Bedrooms</Label>
                        <Input
                          type="number"
                          value={editForm.bedrooms || ""}
                          onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Bathrooms</Label>
                        <Input
                          type="number"
                          value={editForm.bathrooms || ""}
                          onChange={(e) => setEditForm({ ...editForm, bathrooms: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Square Feet</Label>
                        <Input
                          type="number"
                          value={editForm.sqFt || ""}
                          onChange={(e) => setEditForm({ ...editForm, sqFt: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Mobile Home Year</Label>
                        <Input
                          type="number"
                          value={editForm.mobileHomeYear || ""}
                          onChange={(e) => setEditForm({ ...editForm, mobileHomeYear: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Mobile Home Size</Label>
                        <Input
                          value={editForm.mobileHomeSize || ""}
                          onChange={(e) => setEditForm({ ...editForm, mobileHomeSize: e.target.value })}
                          placeholder="e.g., 14x70"
                        />
                      </div>
                      <div>
                        <Label>Available Date</Label>
                        <Input
                          type="date"
                          value={
                            editForm.availableDate
                              ? new Date(editForm.availableDate).toISOString().split("T")[0]
                              : ""
                          }
                          onChange={(e) => setEditForm({ ...editForm, availableDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      placeholder="Enter unit description..."
                    />
                  </div>

                  <div>
                    <Label>Showing Link</Label>
                    <Input
                      value={editForm.showingLink || ""}
                      onChange={(e) => setEditForm({ ...editForm, showingLink: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Unit Name/Number:</span>
                        <p className="mt-1 font-medium">{lot.nameOrNumber}</p>
                      </div>
                      {park && (
                        <div>
                          <span className="text-sm text-muted-foreground">Park:</span>
                          <p className="mt-1 font-medium">{park.name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Pricing</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {lot.priceForRent && (
                        <div>
                          <span className="text-sm text-muted-foreground">Price for Rent:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold mt-1">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            {parseFloat(lot.priceForRent).toLocaleString()}/mo
                          </div>
                        </div>
                      )}
                      {lot.priceForSale && (
                        <div>
                          <span className="text-sm text-muted-foreground">Price for Sale:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold mt-1">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            {parseFloat(lot.priceForSale).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.priceRentToOwn && (
                        <div>
                          <span className="text-sm text-muted-foreground">Rent to Own:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold mt-1">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            {parseFloat(lot.priceRentToOwn).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.priceContractForDeed && (
                        <div>
                          <span className="text-sm text-muted-foreground">Contract for Deed:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold mt-1">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            {parseFloat(lot.priceContractForDeed).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.lotRent && (
                        <div>
                          <span className="text-sm text-muted-foreground">Lot Rent:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold mt-1">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            {parseFloat(lot.lotRent).toLocaleString()}/mo
                          </div>
                        </div>
                      )}
                      {lot.promotionalPrice && (
                        <div>
                          <span className="text-sm text-muted-foreground">Promotional Price:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-lg font-semibold">
                              <DollarSign className="h-5 w-5 text-muted-foreground" />
                              {parseFloat(lot.promotionalPrice).toLocaleString()}
                            </div>
                            {lot.promotionalPriceActive && (
                              <Badge className="bg-gray-100 text-gray-800 border border-gray-200">Active</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {(lot.depositForRent || lot.depositForSale || lot.depositRentToOwn || lot.depositContractForDeed || lot.downPaymentContractForDeed) && (
                    <div>
                      <h3 className="font-semibold mb-3">Deposits</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {lot.depositForRent && (
                          <div>
                            <span className="text-sm text-muted-foreground">Deposit for Rent:</span>
                            <p className="mt-1">${parseFloat(lot.depositForRent).toLocaleString()}</p>
                          </div>
                        )}
                        {lot.depositForSale && (
                          <div>
                            <span className="text-sm text-muted-foreground">Deposit for Sale:</span>
                            <p className="mt-1">${parseFloat(lot.depositForSale).toLocaleString()}</p>
                          </div>
                        )}
                        {lot.depositRentToOwn && (
                          <div>
                            <span className="text-sm text-muted-foreground">Deposit Rent to Own:</span>
                            <p className="mt-1">${parseFloat(lot.depositRentToOwn).toLocaleString()}</p>
                          </div>
                        )}
                        {lot.depositContractForDeed && (
                          <div>
                            <span className="text-sm text-muted-foreground">Deposit Contract for Deed:</span>
                            <p className="mt-1">${parseFloat(lot.depositContractForDeed).toLocaleString()}</p>
                          </div>
                        )}
                        {lot.downPaymentContractForDeed && (
                          <div>
                            <span className="text-sm text-muted-foreground">Down Payment:</span>
                            <p className="mt-1">${parseFloat(lot.downPaymentContractForDeed).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-3">Property Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {lot.bedrooms && (
                        <div>
                          <span className="text-sm text-muted-foreground">Bedrooms:</span>
                          <p className="mt-1">{lot.bedrooms}</p>
                        </div>
                      )}
                      {lot.bathrooms && (
                        <div>
                          <span className="text-sm text-muted-foreground">Bathrooms:</span>
                          <p className="mt-1">{lot.bathrooms}</p>
                        </div>
                      )}
                      {lot.sqFt && (
                        <div>
                          <span className="text-sm text-muted-foreground">Square Feet:</span>
                          <p className="mt-1">{lot.sqFt.toLocaleString()} sq ft</p>
                        </div>
                      )}
                      {lot.mobileHomeYear && (
                        <div>
                          <span className="text-sm text-muted-foreground">Mobile Home Year:</span>
                          <p className="mt-1">{lot.mobileHomeYear}</p>
                        </div>
                      )}
                      {lot.mobileHomeSize && (
                        <div>
                          <span className="text-sm text-muted-foreground">Mobile Home Size:</span>
                          <p className="mt-1">{lot.mobileHomeSize}</p>
                        </div>
                      )}
                      {lot.availableDate && (
                        <div>
                          <span className="text-sm text-muted-foreground">Available Date:</span>
                          <p className="mt-1">{new Date(lot.availableDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {lot.description && (
                    <div>
                      <span className="text-sm text-muted-foreground">Description:</span>
                      <p className="mt-1 whitespace-pre-wrap">{lot.description}</p>
                    </div>
                  )}

                  {lot.showingLink && (
                    <div>
                      <span className="text-sm text-muted-foreground">Showing Link:</span>
                      <p className="mt-1">
                        <a href={lot.showingLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {lot.showingLink}
                        </a>
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-muted-foreground">Created:</span>
                    <p className="mt-1">{new Date(lot.createdAt).toLocaleDateString()}</p>
                  </div>
                </>
              )}
                </CardContent>
              </Card>
            </div>

            {/* Related Items Section - Right Side (1/3 width) */}
            <div className="lg:col-span-1">
              {lot && <AssociationsSection entityType="LOT" entityId={lot.id} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <MentionTextarea
                    value={newNote}
                    onChange={setNewNote}
                    users={companyUsers}
                    placeholder="Add a note... (type @ to mention someone)"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() => createNoteMutation.mutate(newNote)}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {notes.map((note) => (
                  <NoteItem
                    key={note.id}
                    content={note.content}
                    authorName={note.authorName}
                    createdAt={note.createdAt}
                  />
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No notes yet. Add one above!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <Input
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
                <Textarea
                  placeholder="Task description..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={2}
                />
                <Select 
                  value={newTask.assignedTo} 
                  onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to me (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Assign to me (default)</SelectItem>
                    {companyUsers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} {u.id === user?.id ? "(me)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => createTaskMutation.mutate(newTask)}
                  disabled={!newTask.title.trim() || createTaskMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
              
              {/* Task Sort Dropdown */}
              {tasks.length > 0 && (
                <div className="flex justify-end">
                  <Select value={taskSortBy} onValueChange={setTaskSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-newest">Newest First</SelectItem>
                      <SelectItem value="date-oldest">Oldest First</SelectItem>
                      <SelectItem value="priority-high">Priority (Highest)</SelectItem>
                      <SelectItem value="priority-low">Priority (Lowest)</SelectItem>
                      <SelectItem value="due-nearest">Due Date (Nearest)</SelectItem>
                      <SelectItem value="due-farthest">Due Date (Farthest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                {sortedTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`border rounded-lg p-3 flex items-start gap-3 ${task.status === "COMPLETED" ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      checked={task.status === "COMPLETED"}
                      onCheckedChange={() => toggleCompleteTaskMutation.mutate({ 
                        taskId: task.id, 
                        currentStatus: task.status 
                      })}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${task.status === "COMPLETED" ? "line-through" : ""}`}>
                          {task.title}
                        </h4>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                      <div className="flex gap-3 flex-wrap mt-1">
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                        {task.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTaskId(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {sortedTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No tasks yet. Create one above!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 border-l-2 border-primary pl-4 pb-3">
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No activity recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteTaskMutation.mutate(deleteTaskId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

