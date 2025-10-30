import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Check, ExternalLink, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface CalendarStatus {
  connected: boolean;
}

export function CalendarConnection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Only show calendar connection for regular managers
  if (user?.role !== 'MANAGER') {
    return null;
  }

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
        
        // Clear any previous auth result
        localStorage.removeItem('google_calendar_auth_result');
        
        const popup = window.open(data.authUrl, '_blank', 'width=500,height=600');
        
        const handleAuthResult = (result: any) => {
          setIsConnecting(false);
          queryClient.invalidateQueries({ queryKey: ["/api/auth/google/status"] });
          
          if (result.success) {
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
          
          if (popup && !popup.closed) {
            popup.close();
          }
        };
        
        // Listen for postMessage (fallback)
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
            handleAuthResult(event.data);
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
          }
        };
        window.addEventListener('message', handleMessage);
        
        // Poll for localStorage changes (works around COOP restrictions)
        const checkClosed = setInterval(() => {
          // Check localStorage for auth result
          try {
            const resultStr = localStorage.getItem('google_calendar_auth_result');
            if (resultStr) {
              const result = JSON.parse(resultStr);
              // Only process recent results (within last 10 seconds)
              if (Date.now() - result.timestamp < 10000) {
                localStorage.removeItem('google_calendar_auth_result');
                handleAuthResult(result);
                window.removeEventListener('message', handleMessage);
                clearInterval(checkClosed);
                return;
              }
            }
          } catch (e) {
            console.error('Error checking localStorage:', e);
          }
          
          // Check if popup was closed manually
          if (popup && popup.closed) {
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
          }
        }, 500);
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