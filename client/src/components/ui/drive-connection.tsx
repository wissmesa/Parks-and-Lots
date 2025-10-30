import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, ExternalLink, Unlink, HardDrive } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

interface DriveStatus {
  connected: boolean;
  hasToken: boolean;
}

export function DriveConnection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Only show Drive connection for MHP_LORD
  if (user?.role !== 'MHP_LORD') {
    return null;
  }

  const { data: status, isLoading } = useQuery<DriveStatus>({
    queryKey: ["/api/auth/google-drive/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/auth/google-drive/url');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        setIsConnecting(true);
        
        // Clear any previous auth result
        localStorage.removeItem('google_drive_auth_result');
        
        const popup = window.open(data.authUrl, '_blank', 'width=500,height=600');
        
        const handleAuthResult = (result: any) => {
          setIsConnecting(false);
          queryClient.invalidateQueries({ queryKey: ["/api/auth/google-drive/status"] });
          
          if (result.success) {
            toast({
              title: "Drive Connected",
              description: "Your Google Drive has been connected successfully. All lot photos will now be automatically backed up.",
            });
          } else {
            toast({
              title: "Connection Failed",
              description: "Failed to connect to Google Drive. Please try again.",
              variant: "destructive",
            });
          }
          
          if (popup && !popup.closed) {
            popup.close();
          }
        };
        
        // Listen for postMessage (fallback)
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_DRIVE_CONNECTED') {
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
            const resultStr = localStorage.getItem('google_drive_auth_result');
            if (resultStr) {
              const result = JSON.parse(resultStr);
              // Only process recent results (within last 10 seconds)
              if (Date.now() - result.timestamp < 10000) {
                localStorage.removeItem('google_drive_auth_result');
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
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(false);
            window.removeEventListener('message', handleMessage);
          }
        }, 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to initiate Google Drive connection",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/auth/google-drive/disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google-drive/status"] });
      toast({
        title: "Drive Disconnected",
        description: "Your Google Drive has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnection Error",
        description: error.message || "Failed to disconnect Google Drive",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-muted">
              <HardDrive className="w-5 h-5 text-muted-foreground animate-pulse" />
            </div>
            <div>
              <h3 className="font-medium">Google Drive</h3>
              <p className="text-sm text-muted-foreground">Loading...</p>
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
                <HardDrive className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-medium">Google Drive Backup</h3>
              <p className="text-sm text-muted-foreground">
                {status?.connected 
                  ? 'Connected - All lot photos are automatically backed up'
                  : 'Connect to automatically backup lot photos to your Drive'
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
                data-testid="button-disconnect-drive"
              >
                <Unlink className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || isConnecting}
                data-testid="button-connect-drive"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Drive'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


