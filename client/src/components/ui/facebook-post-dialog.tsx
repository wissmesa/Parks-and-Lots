import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Facebook, CheckCircle, XCircle, Copy, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { sendFacebookPostRequest } from '@/lib/facebook-service';
import { useToast } from '@/hooks/use-toast';
import { CreateLotFromFacebookDialog } from '@/components/ui/create-lot-from-facebook-dialog';

interface FacebookPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parkName: string;
  parkId?: string;
  userId?: string;
}

export function FacebookPostDialog({
  isOpen,
  onClose,
  parkName,
  parkId,
  userId
}: FacebookPostDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    webhookData?: any;
  } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [createLotDialog, setCreateLotDialog] = useState<{
    isOpen: boolean;
    postMessage: string;
    postId: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setResult(null);
      setIsLoading(true);
      
      // Automatically send the request when dialog opens
      const sendRequest = async () => {
        try {
          const response = await sendFacebookPostRequest(parkName, userId);
          
            if (response.success) {
              setResult({
                success: true,
                message: response.message,
                webhookData: response.data?.webhookResponse
              });
            } else {
              setResult({
                success: false,
                message: response.message,
                webhookData: null
              });
            }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          setResult({
            success: false,
            message: errorMessage,
            webhookData: null
          });
        } finally {
          setIsLoading(false);
        }
      };

      sendRequest();
    }
  }, [isOpen, parkName, userId]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: "Copied!",
      description: "ID copied to clipboard",
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const toggleItemExpansion = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Get Facebook Post
          </DialogTitle>
          <DialogDescription>
            Request Facebook post data for {parkName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto overflow-x-hidden flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-muted-foreground">Sending request...</span>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <div className="text-sm flex-1">
                  <p className={`font-medium ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.success ? 'Request Successful' : 'Request Failed'}
                  </p>
                  <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                    {result.message}
                  </p>
                  
                  {result.success && result.webhookData && (
                    <div className="mt-3">
                      {Array.isArray(result.webhookData) ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-700">Webhook Response ({result.webhookData.length} items):</p>
                          <div className="max-h-96 overflow-y-auto overflow-x-hidden space-y-2 pr-2">
                            {result.webhookData.map((item: any, index: number) => {
                              const isExpanded = expandedItems.has(index);
                              const isLatest = index === 0;
                              
                              return (
                                <div 
                                  key={index} 
                                  className={`rounded border ${
                                    isLatest 
                                      ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300' 
                                      : 'bg-white border-gray-200'
                                  }`}
                                >
                                  {/* Collapsed Header */}
                                  <div 
                                    className="p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
                                    onClick={() => toggleItemExpansion(index)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {isLatest && (
                                          <Badge variant="default" className="text-xs flex-shrink-0">Latest Post</Badge>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-mono text-sm font-medium truncate">
                                            {item.id || 'empty'}
                                          </p>
                                          <div className="flex items-center gap-3 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                              {item.type || 'empty'}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                              {item.created_time ? formatDate(item.created_time) : 'empty'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 ml-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyId(item.id || 'empty');
                                          }}
                                          className="flex-shrink-0"
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copy
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCreateLotDialog({
                                              isOpen: true,
                                              postMessage: item.message || '',
                                              postId: item.id || ''
                                            });
                                          }}
                                          className="flex-shrink-0"
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Create
                                        </Button>
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Expanded Content */}
                                  {isExpanded && (
                                    <div className="px-3 pb-3 border-t border-gray-200 bg-white bg-opacity-50">
                                      <div className="space-y-3 pt-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600 w-20">ID:</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-mono text-sm font-medium break-all">
                                              {item.id || 'empty'}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600 w-20">Type:</span>
                                          <Badge variant="secondary" className="text-xs">
                                            {item.type || 'empty'}
                                          </Badge>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-600 w-20">Created:</span>
                                          <span className="text-sm text-gray-700">
                                            {item.created_time ? formatDate(item.created_time) : 'empty'}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-start gap-2">
                                          <span className="text-xs text-gray-600 w-20 mt-1">Message:</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-700 break-words">
                                              {item.message || 'empty'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded border">
                          <p className="text-xs text-gray-600 mb-2">Webhook Response:</p>
                          {result.webhookData === "Accepted" || result.webhookData === '"Accepted"' ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                              <p className="text-red-800 text-sm font-medium">
                                ❌ Park not found
                              </p>
                              <p className="text-red-600 text-xs mt-1">
                                The webhook response indicates that the park "{parkName}" was not found in the system.
                              </p>
                            </div>
                          ) : (
                            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(result.webhookData, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {result.success && !result.webhookData && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-yellow-800 text-sm break-words">
                        ⚠️ No data received from webhook. The request was sent but no response data was returned.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {createLotDialog && (
        <CreateLotFromFacebookDialog
          isOpen={createLotDialog.isOpen}
          onClose={() => setCreateLotDialog(null)}
          parkId={parkId}
          parkName={parkName}
          prefilledDescription={createLotDialog.postMessage}
          facebookPostId={createLotDialog.postId}
          userId={userId}
        />
      )}
    </Dialog>
  );
}
