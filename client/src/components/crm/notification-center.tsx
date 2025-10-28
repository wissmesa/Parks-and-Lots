import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Bell, CheckSquare, MessageSquare, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AuthManager } from "@/lib/auth";
import { Link } from "wouter";
import { io, Socket } from "socket.io-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  dueDate?: string | null;
  priority: string;
  status: string;
  entityType?: string | null;
  entityName?: string | null;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  senderName: string;
}

interface NotificationData {
  tasks: {
    count: number;
    items: Task[];
  };
  messages: {
    count: number;
    items: Message[];
  };
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { toast } = useToast();

  const { data: notificationData, refetch } = useQuery({
    queryKey: ["/api/crm/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/crm/notifications", {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<NotificationData>;
    },
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds for more real-time updates
  });

  // Setup WebSocket for real-time notification updates
  useEffect(() => {
    if (user) {
      const token = AuthManager.getToken();
      const newSocket = io("/", {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on("connect", () => {
        console.log("NotificationCenter: Connected to WebSocket");
      });

      newSocket.on("new_message", () => {
        // Immediately refetch notifications when a new message arrives
        queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      });

      newSocket.on("task_updated", () => {
        // Immediately refetch notifications when a task is updated
        queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  const totalCount = (notificationData?.tasks.count || 0) + (notificationData?.messages.count || 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600";
      case "HIGH":
        return "text-orange-600";
      case "MEDIUM":
        return "text-yellow-600";
      case "LOW":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInMs = now.getTime() - then.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMins < 1) return "Just now";
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  const clearMessagesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/messages/mark-all-read", {
        method: "POST",
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark messages as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/messages"] });
      toast({
        title: "Messages cleared",
        description: "All messages have been marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear messages",
        variant: "destructive",
      });
    },
  });

  const handleClearMessages = () => {
    clearMessagesMutation.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => {
            setOpen(true);
            refetch();
          }}
        >
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs px-1"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {totalCount === 0 ? "You're all caught up!" : `${totalCount} notification${totalCount > 1 ? "s" : ""}`}
          </p>
        </div>

        <ScrollArea className="h-[400px]">
          {/* Tasks Section */}
          {notificationData && notificationData.tasks.count > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Tasks ({notificationData.tasks.count})</h4>
              </div>
              <div className="space-y-2">
                {notificationData.tasks.items.map((task) => (
                  <Link key={task.id} href="/crm/tasks" onClick={() => setOpen(false)}>
                    <div className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.entityName && (
                            <p className="text-xs text-primary font-semibold mt-1">
                              {task.entityType}: {task.entityName}
                            </p>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {notificationData && notificationData.tasks.count > 0 && notificationData.messages.count > 0 && (
            <Separator />
          )}

          {/* Messages Section */}
          {notificationData && notificationData.messages.count > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Messages ({notificationData.messages.count})</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMessages}
                  disabled={clearMessagesMutation.isPending}
                  className="h-7 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="space-y-2">
                {notificationData.messages.items.map((message) => (
                  <Link key={message.id} href="/crm/messages" onClick={() => setOpen(false)}>
                    <div className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors">
                      <p className="text-xs font-semibold text-primary mb-1">
                        {message.senderName}
                      </p>
                      <p className="text-sm line-clamp-2">{message.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(message.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {notificationData && totalCount === 0 && (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No new notifications</p>
            </div>
          )}
        </ScrollArea>

        {totalCount > 0 && (
          <>
            <Separator />
            <div className="p-2 flex gap-2">
              <Link href="/crm/tasks" onClick={() => setOpen(false)} className="flex-1">
                <Button variant="ghost" size="sm" className="w-full">
                  View All Tasks
                </Button>
              </Link>
              <Link href="/crm/messages" onClick={() => setOpen(false)} className="flex-1">
                <Button variant="ghost" size="sm" className="w-full">
                  View All Messages
                </Button>
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

