import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Check, ExternalLink, Unlink, Sheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SheetsStatus {
  connected: boolean;
  spreadsheetId: string | null;
}

export function SheetsConnection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [showSpreadsheetInput, setShowSpreadsheetInput] = useState(false);

  // Only show for managers, admins, and MHP lords
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN' && user?.role !== 'MHP_LORD') {
    return null;
  }

  const { data: status, isLoading } = useQuery<SheetsStatus>({
    queryKey: ["/api/auth/google-sheets/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/auth/google-sheets/connect');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        setIsConnecting(true);
        const popup = window.open(data.authUrl, 'google-sheets-auth', 'width=500,height=600');
        
        // Listen for postMessage from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_SHEETS_CONNECTED') {
            setIsConnecting(false);
            queryClient.invalidateQueries({ queryKey: ["/api/auth/google-sheets/status"] });
            
            if (event.data.success) {
              toast({
                title: "Google Sheets Connected",
                description: "Now provide your Google Sheet ID to link it.",
              });
              setShowSpreadsheetInput(true);
            } else {
              toast({
                title: "Connection Failed",
                description: "Failed to connect to Google Sheets. Please try again.",
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
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(false);
          }
        }, 500);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate Google Sheets connection.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/google-sheets/disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google-sheets/status"] });
      setShowSpreadsheetInput(false);
      setSpreadsheetId("");
      toast({
        title: "Disconnected",
        description: "Google Sheets has been disconnected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect Google Sheets.",
        variant: "destructive",
      });
    },
  });

  const setSpreadsheetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', '/api/auth/google-sheets/set-spreadsheet', {
        spreadsheetId: id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/google-sheets/status"] });
      setShowSpreadsheetInput(false);
      setSpreadsheetId("");
      toast({
        title: "Spreadsheet Linked",
        description: "Your Google Sheet has been linked successfully. You can now export lots to it.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to link spreadsheet. Please check the ID and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSetSpreadsheet = () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Invalid ID",
        description: "Please enter a valid Google Sheet ID.",
        variant: "destructive",
      });
      return;
    }
    setSpreadsheetMutation.mutate(spreadsheetId.trim());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-muted">
              <Sheet className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium">Google Sheets</h3>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isFullyConfigured = status?.connected && status?.spreadsheetId;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isFullyConfigured ? 'bg-green-100' : 'bg-muted'}`}>
                {isFullyConfigured ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Sheet className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-medium">Google Sheets Export</h3>
                <p className="text-sm text-muted-foreground">
                  {isFullyConfigured
                    ? 'Connected and linked'
                    : status?.connected
                    ? 'Connected - link your sheet'
                    : 'Export lot data to your Google Sheet'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {status?.connected ? (
                <>
                  {!status?.spreadsheetId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSpreadsheetInput(!showSpreadsheetInput)}
                    >
                      {showSpreadsheetInput ? 'Cancel' : 'Link Sheet'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || isConnecting}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>
          </div>

          {status?.spreadsheetId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Linked to: <code className="bg-muted px-1 py-0.5 rounded text-xs">{status.spreadsheetId}</code>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSpreadsheetId(status.spreadsheetId || "");
                      setShowSpreadsheetInput(true);
                    }}
                  >
                    Change
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(showSpreadsheetInput || (status?.connected && !status?.spreadsheetId)) && (
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label htmlFor="spreadsheet-id">Google Sheet ID</Label>
                <Input
                  id="spreadsheet-id"
                  placeholder="Enter your Google Sheet ID"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  disabled={setSpreadsheetMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your sheet's URL: docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit
                </p>
              </div>
              <Button
                onClick={handleSetSpreadsheet}
                disabled={setSpreadsheetMutation.isPending || !spreadsheetId.trim()}
                size="sm"
              >
                {setSpreadsheetMutation.isPending ? 'Linking...' : 'Link Spreadsheet'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

