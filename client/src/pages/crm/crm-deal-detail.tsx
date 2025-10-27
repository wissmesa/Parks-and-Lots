import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, CheckCircle2, Circle, Clock, DollarSign } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuthManager } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Deal {
  id: string;
  title: string;
  value?: string | null;
  stage: string;
  probability?: number | null;
  expectedCloseDate?: string | null;
  contactId?: string | null;
  lotId?: string | null;
  createdAt: string;
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

const DEAL_STAGES = [
  { value: "QUALIFIED_LEAD", label: "Qualified Lead" },
  { value: "SHOWING_SCHEDULED", label: "Showing Scheduled" },
  { value: "SHOWING_COMPLETED", label: "Showing Completed" },
  { value: "APPLIED_TO_ALL", label: "Applied to All" },
  { value: "FINANCING_APPROVED", label: "Financing Approved" },
  { value: "DEPOSIT_PAID_CONTRACT_SIGNED", label: "Deposit Paid & Contract Signed" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
];

export default function CrmDealDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal>>({});
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "" });

  // Fetch deal
  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: ["/api/crm/deals", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/deals/${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch deal");
      return res.json();
    },
  });

  // Fetch notes
  const { data: notesData } = useQuery({
    queryKey: ["/api/crm/notes", "DEAL", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/notes?entityType=DEAL&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ["/api/crm/tasks", "DEAL", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/tasks?entityType=DEAL&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch activities
  const { data: activitiesData } = useQuery({
    queryKey: ["/api/crm/activities", "DEAL", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/activities?entityType=DEAL&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!id,
  });

  // Update deal mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      toast({ title: "Success", description: "Deal updated successfully" });
      setIsEditingInfo(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update deal", variant: "destructive" });
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
          entityType: "DEAL",
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
          entityType: "DEAL",
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
    if (editForm.title) {
      updateMutation.mutate(editForm);
    }
  };

  const startEditingInfo = () => {
    if (deal) {
      setEditForm({
        title: deal.title,
        value: deal.value || "",
        stage: deal.stage,
        probability: deal.probability || 50,
        expectedCloseDate: deal.expectedCloseDate || "",
      });
      setIsEditingInfo(true);
    }
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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "CLOSED_WON":
        return "bg-green-100 text-green-800";
      case "CLOSED_LOST":
        return "bg-red-100 text-red-800";
      case "DEPOSIT_PAID_CONTRACT_SIGNED":
        return "bg-blue-100 text-blue-800";
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

  if (!deal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Deal not found</h3>
          <Button onClick={() => setLocation("/crm/deals")}>Back to Deals</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation("/crm/deals")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deals
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{deal.title}</h1>
            <p className="text-muted-foreground">Deal Details</p>
          </div>
          <div className="flex items-center gap-4">
            {deal.value && (
              <div className="flex items-center gap-1 text-2xl font-bold text-green-600">
                <DollarSign className="h-6 w-6" />
                {parseFloat(deal.value).toLocaleString()}
              </div>
            )}
            <Badge className={getStageColor(deal.stage)}>
              {DEAL_STAGES.find((s) => s.value === deal.stage)?.label}
            </Badge>
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
              <CardTitle>Deal Information</CardTitle>
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
            <CardContent className="space-y-4">
              {isEditingInfo ? (
                <>
                  <div>
                    <Label>Deal Title</Label>
                    <Input
                      value={editForm.title || ""}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Deal Value</Label>
                      <Input
                        type="number"
                        value={editForm.value || ""}
                        onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Probability (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editForm.probability || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, probability: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Stage</Label>
                    <Select
                      value={editForm.stage}
                      onValueChange={(value) => setEditForm({ ...editForm, stage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expected Close Date</Label>
                    <Input
                      type="date"
                      value={
                        editForm.expectedCloseDate
                          ? new Date(editForm.expectedCloseDate).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setEditForm({ ...editForm, expectedCloseDate: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Deal Value:</span>
                      {deal.value ? (
                        <div className="flex items-center gap-1 text-lg font-semibold text-green-600 mt-1">
                          <DollarSign className="h-5 w-5" />
                          {parseFloat(deal.value).toLocaleString()}
                        </div>
                      ) : (
                        <p className="mt-1">Not set</p>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Probability:</span>
                      <p className="mt-1">{deal.probability}%</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Stage:</span>
                    <div className="mt-1">
                      <Badge className={getStageColor(deal.stage)}>
                        {DEAL_STAGES.find((s) => s.value === deal.stage)?.label}
                      </Badge>
                    </div>
                  </div>
                  {deal.expectedCloseDate && (
                    <div>
                      <span className="text-sm text-muted-foreground">Expected Close Date:</span>
                      <p className="mt-1">
                        {new Date(deal.expectedCloseDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-muted-foreground">Created:</span>
                    <p className="mt-1">{new Date(deal.createdAt).toLocaleDateString()}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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

