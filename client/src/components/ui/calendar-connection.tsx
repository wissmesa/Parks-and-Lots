import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Check, ExternalLink, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CalendarStatus {
  connected: boolean;
}

export function CalendarConnection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, isLoading } = useQuery<CalendarStatus>({
    queryKey: ["/api/auth/google/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/auth/google/connect');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        setIsConnecting(true);
        const popup = window.open(data.authUrl, '_blank', 'width=500,height=600');
        
        // Listen for postMessage from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
            setIsConnecting(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/google/status"] });
            
            if (event.data.success) {
              toast({
                title: "Calendar Connected",
                description: "Your Google Calendar has been connected successfully.",
              });
            } else {
              toast({
                title: "Connection Failed",
                description: "Failed to connect to Google Calendar. Please try again.",
                variant: "destructive",
              });
            }
            
            // Cleanup
            window.removeEventListener('message', handleMessage);
            if (popup && !popup.closed) {
              popup.close();
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Check if popup was closed manually (fallback)
        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
          }
        }, 1000);
      }
    },
    onError: (error) => {
      console.error('Connect calendar error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/auth/google/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google/status"] });
      toast({
        title: "Calendar Disconnected",
        description: "Your Google Calendar has been disconnected.",
      });
    },
    onError: (error) => {
      console.error('Disconnect calendar error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Google Calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Google Calendar</h3>
              <p className="text-sm text-muted-foreground">Loading connection status...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${status?.connected ? 'bg-green-100' : 'bg-muted'}`}>
              {status?.connected ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Calendar className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-medium">Google Calendar</h3>
              <p className="text-sm text-muted-foreground">
                {status?.connected 
                  ? 'Connected'
                  : 'Connect your calendar to sync availability'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {status?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-calendar"
              >
                <Unlink className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || isConnecting}
                data-testid="button-connect-calendar"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Calendar'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}