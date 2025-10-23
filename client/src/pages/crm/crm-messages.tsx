import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { io, Socket } from "socket.io-client";

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

export default function CrmMessages() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Socket.IO
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("token"); // Assuming token is stored here
      const newSocket = io("/", {
        auth: { token }
      });

      newSocket.on("connect", () => {
        console.log("Connected to WebSocket");
      });

      newSocket.on("new_message", (message: Message) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/messages"] });
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  // Fetch company users
  const { data: usersData } = useQuery({
    queryKey: ["/api/crm/company-users"],
    queryFn: async () => {
      const res = await fetch("/api/crm/company-users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["/api/crm/messages", selectedUserId],
    queryFn: async () => {
      const params = selectedUserId ? `?otherUserId=${selectedUserId}` : "";
      const res = await fetch(`/api/crm/messages${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedUserId,
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });

  const users: User[] = usersData?.users || [];
  const messages: Message[] = messagesData?.messages || [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!messageInput.trim() || !selectedUserId || !socket) return;

    socket.emit("send_message", {
      receiverId: selectedUserId,
      content: messageInput,
    });

    setMessageInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Chat with your team members</p>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100%-8rem)]">
        {/* Users List */}
        <Card className="col-span-4 p-4">
          <h3 className="font-semibold mb-4">Team Members</h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-2">
              {users.filter(u => u.id !== user?.id).map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUserId === u.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold">{u.fullName}</div>
                  <div className="text-xs opacity-75">{u.email}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Messages Area */}
        <Card className="col-span-8 flex flex-col">
          {selectedUserId ? (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">
                  {users.find(u => u.id === selectedUserId)?.fullName}
                </h3>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <div>{msg.content}</div>
                          <div className={`text-xs mt-1 ${isOwn ? "opacity-75" : "text-muted-foreground"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                <p>Select a team member to start chatting</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

