import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, ExternalLink, AlertCircle, Sheet, Check } from 'lucide-react';

interface CreateLotFromFacebookDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parkId?: string;
  parkName: string;
  prefilledDescription: string;
  facebookPostId?: string;
  userId?: string;
}

interface SheetsStatus {
  connected: boolean;
  spreadsheetId: string | null;
}

export function CreateLotFromFacebookDialog({
  isOpen,
  onClose,
  parkId,
  parkName,
  prefilledDescription,
  facebookPostId,
  userId
}: CreateLotFromFacebookDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'create' | 'export'>('create');
  const [createdLotId, setCreatedLotId] = useState<string | null>(null);
  const [createdLotName, setCreatedLotName] = useState<string>('');
  const [formData, setFormData] = useState({
    nameOrNumber: '',
    status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
    priceForRent: '',
    priceForSale: '',
    priceRentToOwn: '',
    priceContractForDeed: '',
    lotRent: '',
    showingLink: '',
    description: prefilledDescription,
    bedrooms: 1,
    bathrooms: 1,
    sqFt: 0,
    houseManufacturer: '',
    houseModel: '',
    parkId: parkId || '',
    facebookPostId: facebookPostId || ''
  });

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    spreadsheetUrl?: string;
  } | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('create');
      setCreatedLotId(null);
      setCreatedLotName('');
      setExportResult(null);
      setSpreadsheetId('');
      setFormData({
        nameOrNumber: '',
        status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
        priceForRent: '',
        priceForSale: '',
        priceRentToOwn: '',
        priceContractForDeed: '',
        lotRent: '',
        showingLink: '',
        description: prefilledDescription,
        bedrooms: 1,
        bathrooms: 1,
        sqFt: 0,
        houseManufacturer: '',
        houseModel: '',
        parkId: parkId || '',
        facebookPostId: facebookPostId || ''
      });
    }
  }, [isOpen, parkId, prefilledDescription, facebookPostId]);

  // Google Sheets status query
  const { data: sheetsStatus, refetch: refetchSheetsStatus } = useQuery<SheetsStatus>({
    queryKey: ['/api/auth/google-sheets/status'],
    enabled: step === 'export',
  });

  // Create lot mutation
  const createLotMutation = useMutation({
    mutationFn: async (data: any) => {
      // Helper function to convert empty strings to null for numeric fields
      const toNumberOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };
      
      // Calculate a default price from the available price fields
      // Priority: priceForSale > priceForRent > priceRentToOwn > priceContractForDeed
      const priceForRentNum = toNumberOrNull(data.priceForRent);
      const priceForSaleNum = toNumberOrNull(data.priceForSale);
      const priceRentToOwnNum = toNumberOrNull(data.priceRentToOwn);
      const priceContractForDeedNum = toNumberOrNull(data.priceContractForDeed);
      const lotRentNum = toNumberOrNull(data.lotRent);
      
      let defaultPrice = '0';
      if (priceForSaleNum) {
        defaultPrice = priceForSaleNum.toString();
      } else if (priceForRentNum) {
        defaultPrice = priceForRentNum.toString();
      } else if (priceRentToOwnNum) {
        defaultPrice = priceRentToOwnNum.toString();
      } else if (priceContractForDeedNum) {
        defaultPrice = priceContractForDeedNum.toString();
      }
      
      const payload = {
        parkId: data.parkId,
        nameOrNumber: data.nameOrNumber,
        status: data.status,
        price: defaultPrice, // Legacy price field - required for backward compatibility
        priceForRent: priceForRentNum,
        priceForSale: priceForSaleNum,
        priceRentToOwn: priceRentToOwnNum,
        priceContractForDeed: priceContractForDeedNum,
        lotRent: lotRentNum,
        bedrooms: data.bedrooms ? parseInt(data.bedrooms) : null,
        bathrooms: data.bathrooms ? parseFloat(data.bathrooms) : null,
        sqFt: data.sqFt ? parseInt(data.sqFt) : null,
        showingLink: data.showingLink?.trim() || null,
        description: data.description?.trim() || null,
        houseManufacturer: data.houseManufacturer?.trim() || null,
        houseModel: data.houseModel?.trim() || null,
        facebookPostId: data.facebookPostId || null,
        isActive: true
      };
      
      // Use role-specific endpoints to avoid middleware issues
      let endpoint = '/api/lots';
      if (user?.role === 'MANAGER') {
        endpoint = '/api/manager/lots';
      } else if (user?.role === 'ADMIN') {
        endpoint = '/api/company-manager/lots';
      }
      
      const response = await apiRequest('POST', endpoint, payload);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/lots'] });
      setCreatedLotId(data.id);
      setCreatedLotName(formData.nameOrNumber);
      toast({
        title: 'Success',
        description: 'Lot created successfully',
      });
      setStep('export');
    },
    onError: (error: any) => {
      console.error('Create lot mutation error:', error);
      let errorMessage = 'Failed to create lot';
      
      // Try to extract the detailed error message
      if (error?.message) {
        try {
          // The error message might contain JSON from the server response
          const match = error.message.match(/\{.*\}/);
          if (match) {
            const serverError = JSON.parse(match[0]);
            errorMessage = serverError.error || serverError.message || errorMessage;
          } else {
            errorMessage = error.message;
          }
        } catch (e) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Connect to Google Sheets mutation
  const connectSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/auth/google-sheets/connect');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        setIsConnecting(true);
        const popup = window.open(data.authUrl, 'google-sheets-auth', 'width=500,height=600');
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_SHEETS_CONNECTED') {
            setIsConnecting(false);
            refetchSheetsStatus();
            
            if (event.data.success) {
              toast({
                title: 'Google Sheets Connected',
                description: 'Now provide your Google Sheet ID to link it.',
              });
            } else {
              toast({
                title: 'Connection Failed',
                description: 'Failed to connect to Google Sheets. Please try again.',
                variant: 'destructive',
              });
            }
            
            window.removeEventListener('message', handleMessage);
            if (popup && !popup.closed) {
              popup.close();
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
        
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
        title: 'Error',
        description: 'Failed to initiate Google Sheets connection.',
        variant: 'destructive',
      });
    },
  });

  // Set spreadsheet ID mutation
  const setSpreadsheetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', '/api/auth/google-sheets/set-spreadsheet', {
        spreadsheetId: id,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchSheetsStatus();
      setSpreadsheetId('');
      toast({
        title: 'Spreadsheet Linked',
        description: 'Your Google Sheet has been linked successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to link spreadsheet. Please check the ID and try again.',
        variant: 'destructive',
      });
    },
  });

  // Export to Google Sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async (lotId: string) => {
      const response = await apiRequest('POST', `/api/lots/${lotId}/export-to-sheets`);
      return response.json();
    },
    onSuccess: (data) => {
      setExportResult({
        success: true,
        spreadsheetUrl: data.spreadsheetUrl,
      });
      toast({
        title: 'Success!',
        description: 'Lot exported to Google Sheets successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export lot to Google Sheets.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateLot = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.parkId) {
      toast({
        title: 'Error',
        description: 'Park is required',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.nameOrNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Lot name/number is required',
        variant: 'destructive',
      });
      return;
    }
    
    createLotMutation.mutate(formData);
  };

  const handleSetSpreadsheet = () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: 'Invalid ID',
        description: 'Please enter a valid Google Sheet ID.',
        variant: 'destructive',
      });
      return;
    }
    setSpreadsheetMutation.mutate(spreadsheetId.trim());
  };

  const handleExport = () => {
    if (createdLotId) {
      exportToSheetsMutation.mutate(createdLotId);
    }
  };

  const handleSkipExport = () => {
    onClose();
  };

  const isFullyConfigured = sheetsStatus?.connected && sheetsStatus?.spreadsheetId;

  // Auto-export when sheets are fully configured
  useEffect(() => {
    if (step === 'export' && isFullyConfigured && createdLotId && !exportResult && !exportToSheetsMutation.isPending) {
      handleExport();
    }
  }, [step, isFullyConfigured, createdLotId, exportResult]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'create' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Lot from Facebook Post</DialogTitle>
              <DialogDescription>
                Fill in the lot details. Park and description are pre-filled from the Facebook post.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateLot} className="space-y-4">
              {/* Park - Pre-selected and read-only */}
              <div>
                <Label>Park</Label>
                <Input
                  value={parkName}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Lot Name/Number */}
              <div>
                <Label htmlFor="nameOrNumber">Lot Name/Number *</Label>
                <Input
                  id="nameOrNumber"
                  value={formData.nameOrNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                  placeholder="e.g., Lot 12A"
                  required
                />
              </div>

              {/* Status Checkboxes */}
              <div>
                <Label className="text-base font-medium">Status (Select at least one)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {[
                    { value: 'FOR_RENT', label: 'For Rent' },
                    { value: 'FOR_SALE', label: 'For Sale' },
                    { value: 'RENT_TO_OWN', label: 'Rent to Own' },
                    { value: 'CONTRACT_FOR_DEED', label: 'Contract for Deed' }
                  ].map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={formData.status.includes(status.value as any)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, status: [...prev.status, status.value as any] }));
                          } else {
                            setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== status.value) }));
                          }
                        }}
                      />
                      <Label htmlFor={`status-${status.value}`} className="text-sm cursor-pointer">
                        {status.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Fields */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Prices by Status</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="priceForRent">For Rent ($/month)</Label>
                    <Input
                      id="priceForRent"
                      type="text"
                      inputMode="decimal"
                      value={formData.priceForRent}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceForRent: e.target.value }))}
                      placeholder="Monthly rent amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priceForSale">For Sale ($)</Label>
                    <Input
                      id="priceForSale"
                      type="text"
                      inputMode="decimal"
                      value={formData.priceForSale}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceForSale: e.target.value }))}
                      placeholder="Sale price"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priceRentToOwn">Rent to Own ($/month)</Label>
                    <Input
                      id="priceRentToOwn"
                      type="text"
                      inputMode="decimal"
                      value={formData.priceRentToOwn}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceRentToOwn: e.target.value }))}
                      placeholder="Monthly rent-to-own amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priceContractForDeed">Contract for Deed ($/month)</Label>
                    <Input
                      id="priceContractForDeed"
                      type="text"
                      inputMode="decimal"
                      value={formData.priceContractForDeed}
                      onChange={(e) => setFormData(prev => ({ ...prev, priceContractForDeed: e.target.value }))}
                      placeholder="Monthly contract payment"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lotRent">Lot Rent ($/month)</Label>
                    <Input
                      id="lotRent"
                      type="text"
                      inputMode="decimal"
                      value={formData.lotRent}
                      onChange={(e) => setFormData(prev => ({ ...prev, lotRent: e.target.value }))}
                      placeholder="Monthly lot rent amount"
                    />
                  </div>
                </div>
              </div>

              {/* Property Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="text"
                    inputMode="numeric"
                    value={formData.bedrooms || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="text"
                    inputMode="decimal"
                    value={formData.bathrooms || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="sqFt">Square Feet</Label>
                  <Input
                    id="sqFt"
                    type="text"
                    inputMode="numeric"
                    value={formData.sqFt || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sqFt: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* House Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="houseManufacturer">House Manufacturer</Label>
                  <Input
                    id="houseManufacturer"
                    value={formData.houseManufacturer}
                    onChange={(e) => setFormData(prev => ({ ...prev, houseManufacturer: e.target.value }))}
                    placeholder="e.g., Clayton Homes"
                  />
                </div>
                <div>
                  <Label htmlFor="houseModel">House Model</Label>
                  <Input
                    id="houseModel"
                    value={formData.houseModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, houseModel: e.target.value }))}
                    placeholder="e.g., Heritage 3264A"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the lot features..."
                  rows={4}
                />
              </div>

              {/* Showing Link */}
              <div>
                <Label htmlFor="showingLink">Showing Link</Label>
                <Input
                  id="showingLink"
                  type="text"
                  value={formData.showingLink}
                  onChange={(e) => setFormData(prev => ({ ...prev, showingLink: e.target.value }))}
                  placeholder="https://example.com/showing-link"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createLotMutation.isPending}>
                  {createLotMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Lot'
                  )}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 'export' && (
          <>
            <DialogHeader>
              <DialogTitle>Export to Google Sheets</DialogTitle>
              <DialogDescription>
                Lot "{createdLotName}" has been created. Now export it to your Google Sheet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Success Message */}
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Lot created successfully! You can now export it to Google Sheets or skip this step.
                </AlertDescription>
              </Alert>

              {/* Export Result */}
              {exportResult && exportResult.success && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="flex items-center justify-between">
                      <span>Lot exported successfully!</span>
                      {exportResult.spreadsheetUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(exportResult.spreadsheetUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Sheet
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Google Sheets Connection Status */}
              {!exportResult && (
                <div className="border rounded-lg p-4 space-y-4">
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
                            ? 'Connected and linked - exporting...'
                            : sheetsStatus?.connected
                            ? 'Connected - link your sheet'
                            : 'Connect to export lot data'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {!sheetsStatus?.connected && (
                      <Button
                        onClick={() => connectSheetsMutation.mutate()}
                        disabled={connectSheetsMutation.isPending || isConnecting}
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>

                  {/* Spreadsheet ID Input */}
                  {sheetsStatus?.connected && !sheetsStatus?.spreadsheetId && (
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

                  {/* Show linked spreadsheet */}
                  {sheetsStatus?.spreadsheetId && (
                    <div className="pt-2 border-t">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <span className="text-sm">
                            Linked to: <code className="bg-muted px-1 py-0.5 rounded text-xs">{sheetsStatus.spreadsheetId}</code>
                          </span>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Export in progress */}
                  {exportToSheetsMutation.isPending && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-sm text-muted-foreground">Exporting to Google Sheets...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleSkipExport}
                  className="flex-1"
                  disabled={exportToSheetsMutation.isPending}
                >
                  {exportResult ? 'Close' : 'Skip Export'}
                </Button>
                {!exportResult && isFullyConfigured && !exportToSheetsMutation.isPending && (
                  <Button
                    onClick={handleExport}
                    className="flex-1"
                  >
                    Export Now
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

