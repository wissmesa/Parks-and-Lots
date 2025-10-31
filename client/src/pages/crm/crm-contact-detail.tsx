import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, Phone, Save, Plus, CheckCircle2, Circle, Clock, Trash2 } from "lucide-react";
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
  parkId?: string | null;
  parkName?: string | null;
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
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

export default function CrmContactDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteContactOpen, setDeleteContactOpen] = useState(false);
  const [taskSortBy, setTaskSortBy] = useState("date-newest");

  // Fetch contact
  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["/api/crm/contacts", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch contact");
      return res.json();
    },
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

  // Fetch parks
  const { data: parksData } = useQuery<{ parks: any[] }>({
    queryKey: ["/api/parks"],
  });

  const parks = parksData?.parks || [];

  // Fetch companies for MHP_LORD users
  const isLord = user?.role === 'MHP_LORD';
  const { data: companies } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: isLord,
  });

  // Fetch notes
  const { data: notesData } = useQuery({
    queryKey: ["/api/crm/notes", "CONTACT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/notes?entityType=CONTACT&entityId=${id}`, {
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
    queryKey: ["/api/crm/tasks", "CONTACT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/tasks?entityType=CONTACT&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds for real-time updates
  });

  // Fetch activities
  const { data: activitiesData } = useQuery({
    queryKey: ["/api/crm/activities", "CONTACT", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/activities?entityType=CONTACT&entityId=${id}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!id,
  });

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
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
      setIsEditingInfo(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "DELETE",
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete contact");
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contact deleted successfully" });
      setLocation("/crm/contacts");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
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
          entityType: "CONTACT",
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
          entityType: "CONTACT",
          entityId: id,
          status: "TODO",
          priority: "MEDIUM",
          assignedTo: user?.id,
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
    if (editForm.firstName && editForm.lastName) {
      updateMutation.mutate(editForm);
    }
  };

  const startEditingInfo = () => {
    if (contact) {
      setEditForm({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || "",
        phone: contact.phone || "",
        source: contact.source || "",
        parkId: contact.parkId || "",
        companyId: contact.companyId || "",
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Contact not found</h3>
          <Button onClick={() => setLocation("/crm/contacts")}>Back to Contacts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation("/crm/contacts")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contacts
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {contact.firstName} {contact.lastName}
            </h1>
            <p className="text-muted-foreground">Contact Details</p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setDeleteContactOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Contact
          </Button>
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
                  <CardTitle>Contact Information</CardTitle>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name</Label>
                          <Input
                            value={editForm.firstName || ""}
                            onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input
                            value={editForm.lastName || ""}
                            onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Source</Label>
                        <Input
                          value={editForm.source || ""}
                          onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                        />
                      </div>
                      {isLord && (
                        <div>
                          <Label>Company *</Label>
                          <Select
                            value={editForm.companyId || ""}
                            onValueChange={(value) => setEditForm({ ...editForm, companyId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies?.map((company: any) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Park (Optional)</Label>
                        <Select
                          value={editForm.parkId || "none"}
                          onValueChange={(value) => setEditForm({ ...editForm, parkId: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a park (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {parks.map((park: any) => (
                              <SelectItem key={park.id} value={park.id}>
                                {park.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      {contact.companyName && (
                        <div>
                          <span className="text-sm text-muted-foreground">Company:</span>{" "}
                          <span>{contact.companyName}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.source && (
                        <div>
                          <span className="text-sm text-muted-foreground">Source:</span>{" "}
                          <span>{contact.source}</span>
                        </div>
                      )}
                      {contact.parkName && (
                        <div>
                          <span className="text-sm text-muted-foreground">Park:</span>{" "}
                          <span>{contact.parkName}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-muted-foreground">Created:</span>{" "}
                        <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Related Items Section - Right Side (1/3 width) */}
            <div className="lg:col-span-1">
              {contact && <AssociationsSection entityType="CONTACT" entityId={contact.id} />}
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

      {/* Delete Contact Confirmation Dialog */}
      <AlertDialog open={deleteContactOpen} onOpenChange={setDeleteContactOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContactMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

