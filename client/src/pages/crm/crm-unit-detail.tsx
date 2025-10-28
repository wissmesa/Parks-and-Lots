import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, CheckCircle2, Circle, Clock, Building2, DollarSign } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthManager } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AssociationsSection } from "@/components/crm/associations-section";

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
  createdAt: string;
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
  const { toast } = useToast();
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lot>>({});
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "" });

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
    mutationFn: async (data: { title: string; description: string }) => {
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
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Task created successfully" });
      setNewTask({ title: "", description: "" });
    },
  });

  const notes: Note[] = notesData?.notes || [];
  const tasks: Task[] = tasksData?.tasks || [];
  const activities: Activity[] = activitiesData?.activities || [];

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
    switch (status) {
      case "FOR_RENT":
        return "bg-blue-100 text-blue-800";
      case "FOR_SALE":
        return "bg-green-100 text-green-800";
      case "RENT_TO_OWN":
        return "bg-purple-100 text-purple-800";
      case "CONTRACT_FOR_DEED":
        return "bg-indigo-100 text-indigo-800";
      case "OCCUPIED":
        return "bg-gray-100 text-gray-800";
      case "MAINTENANCE":
        return "bg-orange-100 text-orange-800";
      case "RESERVED":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
                          <div className="flex items-center gap-1 text-lg font-semibold text-green-600 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {parseFloat(lot.priceForRent).toLocaleString()}/mo
                          </div>
                        </div>
                      )}
                      {lot.priceForSale && (
                        <div>
                          <span className="text-sm text-muted-foreground">Price for Sale:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold text-blue-600 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {parseFloat(lot.priceForSale).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.priceRentToOwn && (
                        <div>
                          <span className="text-sm text-muted-foreground">Rent to Own:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold text-purple-600 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {parseFloat(lot.priceRentToOwn).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.priceContractForDeed && (
                        <div>
                          <span className="text-sm text-muted-foreground">Contract for Deed:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold text-indigo-600 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {parseFloat(lot.priceContractForDeed).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {lot.lotRent && (
                        <div>
                          <span className="text-sm text-muted-foreground">Lot Rent:</span>
                          <div className="flex items-center gap-1 text-lg font-semibold text-gray-600 mt-1">
                            <DollarSign className="h-5 w-5" />
                            {parseFloat(lot.lotRent).toLocaleString()}/mo
                          </div>
                        </div>
                      )}
                      {lot.promotionalPrice && (
                        <div>
                          <span className="text-sm text-muted-foreground">Promotional Price:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-lg font-semibold text-red-600">
                              <DollarSign className="h-5 w-5" />
                              {parseFloat(lot.promotionalPrice).toLocaleString()}
                            </div>
                            {lot.promotionalPriceActive && (
                              <Badge className="bg-red-100 text-red-800">Active</Badge>
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

          {/* Related Items Section */}
          {lot && <AssociationsSection entityType="LOT" entityId={lot.id} />}
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={() => createNoteMutation.mutate(newNote)}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="border rounded-lg p-3">
                    <p className="text-sm">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
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
                <Button
                  onClick={() => createTaskMutation.mutate(newTask)}
                  disabled={!newTask.title.trim() || createTaskMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3 flex items-start gap-3">
                    {getStatusIcon(task.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
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
    </div>
  );
}

