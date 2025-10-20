import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PhotoManagement } from "@/components/ui/photo-management";
import { LotCalculator } from "@/components/ui/lot-calculator";
import { LotHistoryDialog } from "@/components/ui/lot-history-dialog";
import { useToast } from "@/hooks/use-toast";
import { ManagerSidebar } from "@/components/ui/manager-sidebar";
import { SheetsConnection } from "@/components/ui/sheets-connection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { 
  Home, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  Bed, 
  Bath, 
  Ruler,
  Eye,
  EyeOff,
  Camera,
  Tag,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  MoreHorizontal,
  Calculator,
  List,
  Grid3X3
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
  price: string;
  priceForRent?: string | null;
  priceForSale?: string | null;
  priceRentToOwn?: string | null;
  priceContractForDeed?: string | null;
  depositForRent?: string | null;
  depositForSale?: string | null;
  depositRentToOwn?: string | null;
  depositContractForDeed?: string | null;
  downPaymentContractForDeed?: string | null;
  lotRent?: string | null;
  promotionalPrice?: string | null;
  promotionalPriceActive?: boolean;
  estimatedPayment?: string | null;
  availableDate?: string | null;
  mobileHomeYear?: number | null;
  mobileHomeSize?: string | null;
  showingLink?: string | null;
  description: string;
  bedrooms: number;
  bathrooms: number;
  sqFt: number;
  houseManufacturer?: string;
  houseModel?: string;
  parkId: string;
  isActive: boolean;
  specialStatusId?: string | null;
  park: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  specialStatus?: {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
  } | null;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantStatus?: string | null;
  isAssigned?: boolean;
}

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
}

export default function ManagerLots() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState<string | null>(null);
  const [showCalculatorSelection, setShowCalculatorSelection] = useState<string | null>(null);
  const [assigningSpecialStatus, setAssigningSpecialStatus] = useState<Lot | null>(null);
  const [selectedSpecialStatusId, setSelectedSpecialStatusId] = useState<string>("");
  const [showLotHistory, setShowLotHistory] = useState<{ lotId: string; lotName: string } | null>(null);
  const [showPromotionalPrice, setShowPromotionalPrice] = useState(false);
  const [showPromotionalPriceEdit, setShowPromotionalPriceEdit] = useState(false);

  // Bulk upload state
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadStep, setBulkUploadStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'results'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>("nameOrNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');

  // Filtering state
  const [filters, setFilters] = useState({
    status: [] as string[],
    visibility: [] as string[],
    parkId: [] as string[],
    specialStatusId: [] as string[],
    houseManufacturer: [] as string[],
    houseModel: [] as string[],
    bedroomsMin: "",
    bedroomsMax: "",
    bathroomsMin: "",
    bathroomsMax: "",
    sqFtMin: "",
    sqFtMax: "",
    searchText: ""
  });

  // Filter helper functions
  const toggleFilter = (category: keyof typeof filters, value: string) => {
    if (Array.isArray(filters[category])) {
      const currentValues = filters[category] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setFilters(prev => ({ ...prev, [category]: newValues }));
    }
  };

  const updateRangeFilter = (category: string, value: string) => {
    setFilters(prev => ({ ...prev, [category]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      visibility: [],
      parkId: [],
      specialStatusId: [],
      houseManufacturer: [],
      houseModel: [],
      bedroomsMin: "",
      bedroomsMax: "",
      bathroomsMin: "",
      bathroomsMax: "",
      sqFtMin: "",
      sqFtMax: "",
      searchText: ""
    });
  };

  const resetForm = () => {
    setFormData({
      nameOrNumber: '',
      status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
      price: '',
      priceForRent: '',
      priceForSale: '',
      priceRentToOwn: '',
      priceContractForDeed: '',
      depositForRent: '',
      depositForSale: '',
      depositRentToOwn: '',
      depositContractForDeed: '',
      downPaymentContractForDeed: '',
      lotRent: '',
      promotionalPrice: '',
      promotionalPriceActive: false,
      estimatedPayment: '',
      availableDate: '',
      mobileHomeYear: '',
      mobileHomeSize: '',
      showingLink: '',
      description: '',
      bedrooms: 1,
      bathrooms: 1,
      sqFt: 0,
      houseManufacturer: '',
      houseModel: '',
      parkId: ''
    });
  };

  const hasActiveFilters = () => {
    return filters.status.length > 0 ||
           filters.visibility.length > 0 ||
           filters.parkId.length > 0 ||
           filters.specialStatusId.length > 0 ||
           filters.houseManufacturer.length > 0 ||
           filters.houseModel.length > 0 ||
           filters.bedroomsMin ||
           filters.bedroomsMax ||
           filters.bathroomsMin ||
           filters.bathroomsMax ||
           filters.sqFtMin ||
           filters.sqFtMax ||
           filters.searchText;
  };
  
  // Form state
  const [formData, setFormData] = useState({
    nameOrNumber: '',
    status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
    price: '', // Legacy price field
    priceForRent: '',
    priceForSale: '',
    priceRentToOwn: '',
    priceContractForDeed: '',
    depositForRent: '',
    depositForSale: '',
    depositRentToOwn: '',
    depositContractForDeed: '',
    downPaymentContractForDeed: '',
    lotRent: '',
    promotionalPrice: '',
    promotionalPriceActive: false,
    estimatedPayment: '',
    availableDate: '',
    mobileHomeYear: '',
    mobileHomeSize: '',
    showingLink: '',
    description: '',
    bedrooms: 1,
    bathrooms: 1,
    sqFt: 0,
    houseManufacturer: '',
    houseModel: '',
    parkId: ''
  });

  // Redirect if not manager or company manager
  useEffect(() => {
    if (user && user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      window.location.href = '/';
    }
  }, [user]);

  const isCompanyManager = user?.role === 'ADMIN';

  // Fetch manager assignments (parks)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<{
    id: string;
    userId: string;
    parkId: string;
    userName: string;
    userEmail: string;
    parkName: string;
  }[]>({
    queryKey: ["/api/manager/assignments"],
    enabled: user?.role === 'MANAGER',
  });

  // Fetch company manager parks
  const { data: companyParks, isLoading: companyParksLoading } = useQuery<{
    parks: {
      id: string;
      name: string;
      city: string;
      state: string;
    }[];
  }>({
    queryKey: ["/api/company-manager/parks"],
    enabled: user?.role === 'ADMIN',
  });

  // Fetch lots for assigned parks or company lots
  const { data: lots, isLoading } = useQuery<Lot[]>({
    queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"],
    enabled: user?.role === 'MANAGER' || user?.role === 'ADMIN',
  });

  // Special statuses query for the selected park
  const { data: specialStatuses = [] } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", assigningSpecialStatus?.parkId, "special-statuses"],
    enabled: !!assigningSpecialStatus?.parkId,
  });

  // Create lot mutation
  const createLotMutation = useMutation({
    mutationFn: async (lotData: typeof formData) => {
      const endpoint = isCompanyManager ? "/api/company-manager/lots" : "/api/manager/lots";
      
      // Helper function to convert empty strings to null for numeric fields
      const toNumberOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };
      
      // Helper function to convert empty strings to null, keeping valid values as strings for decimal fields
      const toStringOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        return String(value);
      };
      
      const processedData = {
        parkId: lotData.parkId,
        nameOrNumber: lotData.nameOrNumber,
        status: lotData.status,
        price: '0', // Legacy price field - required by database (as string for decimal)
        priceForRent: toStringOrNull(lotData.priceForRent),
        priceForSale: toStringOrNull(lotData.priceForSale),
        priceRentToOwn: toStringOrNull(lotData.priceRentToOwn),
        priceContractForDeed: toStringOrNull(lotData.priceContractForDeed),
        depositForRent: toStringOrNull(lotData.depositForRent),
        depositForSale: toStringOrNull(lotData.depositForSale),
        depositRentToOwn: toStringOrNull(lotData.depositRentToOwn),
        depositContractForDeed: toStringOrNull(lotData.depositContractForDeed),
        downPaymentContractForDeed: toStringOrNull(lotData.downPaymentContractForDeed),
        lotRent: toStringOrNull(lotData.lotRent),
        promotionalPrice: toStringOrNull(lotData.promotionalPrice),
        promotionalPriceActive: lotData.promotionalPriceActive || false,
        estimatedPayment: toStringOrNull(lotData.estimatedPayment),
        availableDate: lotData.availableDate || null,
        mobileHomeYear: lotData.mobileHomeYear ? parseInt(lotData.mobileHomeYear) : null,
        mobileHomeSize: lotData.mobileHomeSize?.trim() || null,
        bedrooms: lotData.bedrooms || null,
        bathrooms: lotData.bathrooms || null,
        sqFt: lotData.sqFt || null,
        showingLink: lotData.showingLink?.trim() || null,
        houseManufacturer: lotData.houseManufacturer?.trim() || null,
        houseModel: lotData.houseModel?.trim() || null,
        description: lotData.description?.trim() || null,
      };
      
      const response = await apiRequest("POST", endpoint, processedData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lot Created",
        description: "New lot has been created successfully.",
      });
      setIsCreateModalOpen(false);
      setFormData({
        nameOrNumber: '',
        status: [],
        price: '',
        priceForRent: '',
        priceForSale: '',
        priceRentToOwn: '',
        priceContractForDeed: '',
        depositForRent: '',
        depositForSale: '',
        depositRentToOwn: '',
        depositContractForDeed: '',
        downPaymentContractForDeed: '',
        lotRent: '',
        promotionalPrice: '',
        promotionalPriceActive: false,
        estimatedPayment: '',
        availableDate: '',
        mobileHomeYear: '',
        mobileHomeSize: '',
        showingLink: '',
        description: '',
        bedrooms: 1,
        bathrooms: 1,
        sqFt: 0,
        houseManufacturer: '',
        houseModel: '',
        parkId: ''
      });
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update lot mutation
  const updateLotMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<typeof formData>) => {
      const endpoint = isCompanyManager ? `/api/company-manager/lots/${id}` : `/api/manager/lots/${id}`;
      
      // Helper function to convert empty strings to null for numeric fields
      const toNumberOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };
      
      // Helper function to convert empty strings to null, keeping valid values as strings for decimal fields
      const toStringOrNull = (value: any) => {
        if (value === '' || value === null || value === undefined) return null;
        return String(value);
      };
      
      // Build payload explicitly to avoid sending empty strings
      const processedUpdates: any = {};
      
      if (updates.parkId !== undefined) processedUpdates.parkId = updates.parkId;
      if (updates.nameOrNumber !== undefined) processedUpdates.nameOrNumber = updates.nameOrNumber;
      if (updates.status !== undefined) processedUpdates.status = updates.status;
      if (updates.price !== undefined) processedUpdates.price = updates.price || '0';
      if (updates.priceForRent !== undefined) processedUpdates.priceForRent = toStringOrNull(updates.priceForRent);
      if (updates.priceForSale !== undefined) processedUpdates.priceForSale = toStringOrNull(updates.priceForSale);
      if (updates.priceRentToOwn !== undefined) processedUpdates.priceRentToOwn = toStringOrNull(updates.priceRentToOwn);
      if (updates.priceContractForDeed !== undefined) processedUpdates.priceContractForDeed = toStringOrNull(updates.priceContractForDeed);
      if (updates.depositForRent !== undefined) processedUpdates.depositForRent = toStringOrNull(updates.depositForRent);
      if (updates.depositForSale !== undefined) processedUpdates.depositForSale = toStringOrNull(updates.depositForSale);
      if (updates.depositRentToOwn !== undefined) processedUpdates.depositRentToOwn = toStringOrNull(updates.depositRentToOwn);
      if (updates.depositContractForDeed !== undefined) processedUpdates.depositContractForDeed = toStringOrNull(updates.depositContractForDeed);
      if (updates.downPaymentContractForDeed !== undefined) processedUpdates.downPaymentContractForDeed = toStringOrNull(updates.downPaymentContractForDeed);
      if (updates.lotRent !== undefined) processedUpdates.lotRent = toStringOrNull(updates.lotRent);
      if (updates.bedrooms !== undefined) processedUpdates.bedrooms = updates.bedrooms || null;
      if (updates.bathrooms !== undefined) processedUpdates.bathrooms = updates.bathrooms || null;
      if (updates.sqFt !== undefined) processedUpdates.sqFt = updates.sqFt || null;
      if (updates.showingLink !== undefined) processedUpdates.showingLink = typeof updates.showingLink === 'string' ? (updates.showingLink.trim() || null) : null;
      if (updates.houseManufacturer !== undefined) processedUpdates.houseManufacturer = typeof updates.houseManufacturer === 'string' ? (updates.houseManufacturer.trim() || null) : null;
      if (updates.houseModel !== undefined) processedUpdates.houseModel = typeof updates.houseModel === 'string' ? (updates.houseModel.trim() || null) : null;
      if (updates.description !== undefined) processedUpdates.description = typeof updates.description === 'string' ? (updates.description.trim() || null) : null;
      if (updates.promotionalPrice !== undefined) processedUpdates.promotionalPrice = toStringOrNull(updates.promotionalPrice);
      if (updates.promotionalPriceActive !== undefined) processedUpdates.promotionalPriceActive = updates.promotionalPriceActive || false;
      if (updates.estimatedPayment !== undefined) processedUpdates.estimatedPayment = toStringOrNull(updates.estimatedPayment);
      if (updates.availableDate !== undefined) processedUpdates.availableDate = updates.availableDate || null;
      if (updates.mobileHomeYear !== undefined) processedUpdates.mobileHomeYear = updates.mobileHomeYear ? parseInt(updates.mobileHomeYear) : null;
      if (updates.mobileHomeSize !== undefined) processedUpdates.mobileHomeSize = typeof updates.mobileHomeSize === 'string' ? (updates.mobileHomeSize.trim() || null) : null;
      
      const response = await apiRequest("PATCH", endpoint, processedUpdates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lot Updated",
        description: "Lot has been updated successfully.",
      });
      setIsEditModalOpen(false);
      setEditingLot(null);
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete lot mutation
  const deleteLotMutation = useMutation({
    mutationFn: async (id: string) => {
      const endpoint = isCompanyManager ? `/api/company-manager/lots/${id}` : `/api/manager/lots/${id}`;
      await apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      toast({
        title: "Lot Deleted",
        description: "Lot has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle lot active/inactive mutation
  const toggleLotActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/lots/${id}/toggle-active`);
      return response.json();
    },
    onSuccess: (updatedLot) => {
      toast({
        title: "Lot Updated",
        description: `Lot ${updatedLot.isActive ? 'enabled' : 'disabled'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"] });
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/stats"] : ["/api/manager/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignSpecialStatusMutation = useMutation({
    mutationFn: async ({ lotId, specialStatusId }: { lotId: string; specialStatusId: string | null }) => {
      return apiRequest("PUT", `/api/lots/${lotId}/special-status`, { specialStatusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ["/api/company-manager/lots"] : ["/api/manager/lots"] });
      setAssigningSpecialStatus(null);
      setSelectedSpecialStatusId("");
      toast({
        title: "Success",
        description: "Special status assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign special status",
        variant: "destructive",
      });
    },
  });

  // Bulk upload mutation for managers
  const bulkUploadMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const endpoint = isCompanyManager ? '/api/company-manager/lots/bulk' : '/api/manager/lots/bulk';
      return await apiRequest('POST', endpoint, { lots: data });
    },
    onSuccess: async (response) => {
      const results = await response.json();
      setImportResults(results);
      setImportProgress(100);
      
      // Refresh lots data
      queryClient.invalidateQueries({ queryKey: isCompanyManager ? ['/api/company-manager/lots'] : ['/api/manager/lots'] });
      
      // Switch to results step after a brief delay
      setTimeout(() => {
        setBulkUploadStep('results');
      }, 500);
      
      toast({
        title: "Bulk upload completed",
        description: `Successfully processed ${results.successful?.length || 0} of ${mappedData.length} lots`,
      });
    },
    onError: (error) => {
      // Clear progress interval if running
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
      
      // Reset UI state
      setImportProgress(0);
      setBulkUploadStep('upload');
      
      // Handle specific error for multiple park assignments
      if (error.message && error.message.includes('400:')) {
        try {
          // Extract JSON from error message (format: "400: {json}")
          const colonIndex = error.message.indexOf(':');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 1).trim();
            // Only attempt to parse if it looks like JSON (starts with '{')
            if (jsonPart.startsWith('{')) {
              const errorData = JSON.parse(jsonPart);
              
              if (errorData?.code === 'MULTIPLE_PARKS') {
                toast({
                  title: "Multiple Parks Assigned",
                  description: "You are assigned to multiple parks. Please contact your administrator to specify which park should receive these lots.",
                  variant: "destructive"
                });
                return;
              }
            }
          }
        } catch (e) {
          // Fall through to generic error handling if JSON parsing fails
          console.warn('Failed to parse error response:', e);
        }
      }
      
      toast({
        title: "Bulk upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // File upload and parsing functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || []);
          setParsedData(results.data);
          setBulkUploadStep('mapping');
        },
        error: (error) => {
          toast({
            title: "Error parsing CSV",
            description: error.message,
            variant: "destructive"
          });
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1).map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = (row as any[])[index] || '';
              });
              return obj;
            });
            
            setCsvHeaders(headers);
            setParsedData(rows);
            setBulkUploadStep('mapping');
          }
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Please check the file format",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
    }
  };

  const resetBulkUpload = () => {
    // Clear any running progress interval
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    
    setIsBulkUploadOpen(false);
    setBulkUploadStep('upload');
    setUploadedFile(null);
    setParsedData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setMappedData([]);
    setImportProgress(0);
    setImportResults(null);
  };

  const isValidMapping = () => {
    const hasRequiredFields = columnMapping['nameOrNumber'] && columnMapping['nameOrNumber'] !== 'ignore';
    
    // Don't validate if assignments are still loading
    if (assignmentsLoading) {
      return false;
    }
    
    // For multi-park managers, park name is required
    if (assignments && assignments.length > 1) {
      return hasRequiredFields && columnMapping['parkName'] && columnMapping['parkName'] !== 'ignore';
    }
    
    return hasRequiredFields;
  };

  const handleProceedToPreview = () => {
    if (!isValidMapping()) return;
    
    const mapped = parsedData.map(row => {
      const mappedRow: any = {};
      Object.entries(columnMapping).forEach(([field, csvColumn]) => {
        if (csvColumn && csvColumn !== 'ignore') {
          mappedRow[field] = row[csvColumn];
        }
      });
      return mappedRow;
    }).filter(row => row.nameOrNumber); // Filter out incomplete rows (only nameOrNumber required)
    
    setMappedData(mapped);
    setBulkUploadStep('preview');
  };

  const handleStartImport = () => {
    setBulkUploadStep('importing');
    setImportProgress(0);
    
    // Clear any existing interval
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    
    // Simulate progress
    const newProgressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(newProgressInterval);
          setProgressInterval(null);
          return 90; // Will be set to 100% in onSuccess
        }
        return prev + 10;
      });
    }, 300);
    
    setProgressInterval(newProgressInterval);
    bulkUploadMutation.mutate(mappedData);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLotMutation.mutateAsync(formData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLot) return;
    
    await updateLotMutation.mutateAsync({
      id: editingLot.id,
      ...formData
    });
  };

  const handleEdit = (lot: Lot) => {
    setEditingLot(lot);
    setFormData({
      nameOrNumber: lot.nameOrNumber,
      status: Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []),
      price: lot.price,
      priceForRent: lot.priceForRent || '',
      priceForSale: lot.priceForSale || '',
      priceRentToOwn: lot.priceRentToOwn || '',
      priceContractForDeed: lot.priceContractForDeed || '',
      depositForRent: lot.depositForRent || '',
      depositForSale: lot.depositForSale || '',
      depositRentToOwn: lot.depositRentToOwn || '',
      depositContractForDeed: lot.depositContractForDeed || '',
      downPaymentContractForDeed: lot.downPaymentContractForDeed || '',
      lotRent: lot.lotRent || '',
      promotionalPrice: lot.promotionalPrice || '',
      promotionalPriceActive: lot.promotionalPriceActive || false,
      estimatedPayment: lot.estimatedPayment || '',
      availableDate: lot.availableDate ? lot.availableDate.split('T')[0] : '',
      mobileHomeYear: lot.mobileHomeYear?.toString() || '',
      mobileHomeSize: lot.mobileHomeSize || '',
      showingLink: lot.showingLink || '',
      description: lot.description,
      bedrooms: lot.bedrooms,
      bathrooms: lot.bathrooms,
      sqFt: lot.sqFt,
      houseManufacturer: lot.houseManufacturer || '',
      houseModel: lot.houseModel || '',
      parkId: lot.parkId
    });
    setIsEditModalOpen(true);
  };

  const handleAssignSpecialStatus = (lot: Lot) => {
    setAssigningSpecialStatus(lot);
    setSelectedSpecialStatusId(lot.specialStatusId || "none");
  };

  const handleConfirmSpecialStatusAssignment = () => {
    if (assigningSpecialStatus) {
      const specialStatusId = selectedSpecialStatusId === "none" ? null : selectedSpecialStatusId;
      assignSpecialStatusMutation.mutate({
        lotId: assigningSpecialStatus.id,
        specialStatusId
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this lot?')) {
      await deleteLotMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string) => {
    await toggleLotActiveMutation.mutateAsync(id);
  };

  const toggleVisibility = async (id: string, isActive: boolean) => {
    await toggleLotActiveMutation.mutateAsync(id);
  };

  const deleteLot = async (id: string) => {
    await deleteLotMutation.mutateAsync(id);
  };

  // Handle Google Sheets export
  const handleExportToGoogleSheets = async (lot: Lot) => {
    try {
      // Check if Google Sheets is connected
      const statusResponse = await apiRequest('GET', '/api/auth/google-sheets/status');
      const statusData = await statusResponse.json();
      
      if (!statusData.connected) {
        // Open Google Sheets connection in a popup
        const connectResponse = await apiRequest('GET', '/api/auth/google-sheets/connect');
        const connectData = await connectResponse.json();
        const popup = window.open(connectData.authUrl, 'google-sheets-auth', 'width=500,height=600');
        
        // Listen for the popup to close or send a message
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Don't retry automatically - user needs to set sheet ID first
          }
        }, 1000);

        // Listen for success message from popup
        const messageListener = (event: MessageEvent) => {
          if (event.data.type === 'GOOGLE_SHEETS_CONNECTED' && event.data.success) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            popup?.close();
            
            toast({
              title: "Connected!",
              description: "Please link your Google Sheet, then try exporting again.",
            });
          }
        };
        window.addEventListener('message', messageListener);
        return;
      }

      // Check if spreadsheet ID is set
      if (!statusData.spreadsheetId) {
        toast({
          title: "Sheet Not Linked",
          description: "Please link a Google Sheet first.",
          variant: "destructive",
        });
        return;
      }

      // Export the lot to Google Sheets
      const response = await apiRequest('POST', `/api/lots/${lot.id}/export-to-sheets`);
      const responseData = await response.json();

      toast({
        title: "Success!",
        description: "Lot exported to Google Sheets successfully. Opening spreadsheet...",
      });

      // Open the Google Sheets document
      window.open(responseData.spreadsheetUrl, '_blank');
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export lot to Google Sheets. Please try again.",
        variant: "destructive",
      });
    }
  };

  const assignedParks = isCompanyManager ? (companyParks?.parks || []) : (assignments || []);

  // Filter and sort lots using useMemo for performance
  const sortedLots = useMemo(() => {
    if (!lots) return [];
    
    // First apply filters
    const filteredLots = lots.filter((lot) => {
      // Status filter
      if (filters.status.length > 0) {
        const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
        const hasMatchingStatus = filters.status.some(filterStatus => 
          statusArray.includes(filterStatus as 'FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')
        );
        if (!hasMatchingStatus) {
          return false;
        }
      }

      // Visibility filter
      if (filters.visibility.length > 0) {
        const isVisible = lot.isActive;
        const wantsVisible = filters.visibility.includes("visible");
        const wantsHidden = filters.visibility.includes("hidden");
        
        // If both visible and hidden are selected, show all lots
        if (wantsVisible && wantsHidden) {
          // Show all lots
        } else if (wantsVisible && !isVisible) {
          // User wants visible lots but this lot is hidden
          return false;
        } else if (wantsHidden && isVisible) {
          // User wants hidden lots but this lot is visible
          return false;
        }
      }

      // Park filter
      if (filters.parkId.length > 0 && !filters.parkId.includes(lot.parkId)) {
        return false;
      }

      // Special status filter
      if (filters.specialStatusId.length > 0) {
        const hasSpecialStatus = lot.specialStatusId && filters.specialStatusId.includes(lot.specialStatusId);
        const wantsNone = filters.specialStatusId.includes("none");
        if (!hasSpecialStatus && !wantsNone) return false;
        if (hasSpecialStatus && wantsNone && lot.specialStatusId) return false;
      }

      // House manufacturer filter
      if (filters.houseManufacturer.length > 0) {
        const wantsNone = filters.houseManufacturer.includes("none");
        const hasManufacturer = lot.houseManufacturer && lot.houseManufacturer.trim() !== "";
        const manufacturerMatches = hasManufacturer && filters.houseManufacturer.includes(lot.houseManufacturer!);
        
        // Show lot if:
        // 1. "none" is selected AND lot has no manufacturer, OR
        // 2. lot has manufacturer AND that manufacturer is in the selected filters
        const shouldShow = (wantsNone && !hasManufacturer) || manufacturerMatches;
        
        if (!shouldShow) {
          return false;
        }
      }

      // House model filter
      if (filters.houseModel.length > 0) {
        const wantsNone = filters.houseModel.includes("none");
        const hasModel = lot.houseModel && lot.houseModel.trim() !== "";
        const modelMatches = hasModel && filters.houseModel.includes(lot.houseModel!);
        
        // Show lot if:
        // 1. "none" is selected AND lot has no model, OR
        // 2. lot has model AND that model is in the selected filters
        const shouldShow = (wantsNone && !hasModel) || modelMatches;
        
        if (!shouldShow) {
          return false;
        }
      }

      // Bedrooms range filter
      if (filters.bedroomsMin || filters.bedroomsMax) {
        const bedrooms = lot.bedrooms || 0;
        if (filters.bedroomsMin && bedrooms < parseInt(filters.bedroomsMin)) return false;
        if (filters.bedroomsMax && bedrooms > parseInt(filters.bedroomsMax)) return false;
      }

      // Bathrooms range filter
      if (filters.bathroomsMin || filters.bathroomsMax) {
        const bathrooms = lot.bathrooms || 0;
        if (filters.bathroomsMin && bathrooms < parseInt(filters.bathroomsMin)) return false;
        if (filters.bathroomsMax && bathrooms > parseInt(filters.bathroomsMax)) return false;
      }

      // Square footage range filter
      if (filters.sqFtMin || filters.sqFtMax) {
        const sqFt = lot.sqFt || 0;
        if (filters.sqFtMin && sqFt < parseInt(filters.sqFtMin)) return false;
        if (filters.sqFtMax && sqFt > parseInt(filters.sqFtMax)) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matches = [
          lot.nameOrNumber.toLowerCase(),
          lot.description?.toLowerCase() || "",
          lot.park?.name?.toLowerCase() || "",
          lot.specialStatus?.name?.toLowerCase() || "",
          lot.houseManufacturer?.toLowerCase() || "",
          lot.houseModel?.toLowerCase() || ""
        ].some(field => field.includes(searchLower));
        if (!matches) return false;
      }

      return true;
    });

    // Then apply sorting
    const sorted = [...filteredLots].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case "nameOrNumber":
          valueA = a.nameOrNumber.toLowerCase();
          valueB = b.nameOrNumber.toLowerCase();
          break;
        case "status":
          valueA = a.status;
          valueB = b.status;
          break;
        case "price":
          valueA = parseFloat((a.price || '').toString().replace(/[^\d.-]/g, '')) || 0;
          valueB = parseFloat((b.price || '').toString().replace(/[^\d.-]/g, '')) || 0;
          break;
        case "bedrooms":
          valueA = a.bedrooms || 0;
          valueB = b.bedrooms || 0;
          break;
        case "bathrooms":
          valueA = a.bathrooms || 0;
          valueB = b.bathrooms || 0;
          break;
        case "sqFt":
          valueA = a.sqFt || 0;
          valueB = b.sqFt || 0;
          break;
        case "parkName":
          valueA = a.park?.name?.toLowerCase() || "";
          valueB = b.park?.name?.toLowerCase() || "";
          break;
        case "visibility":
          valueA = a.isActive ? 1 : 0;
          valueB = b.isActive ? 1 : 0;
          break;
        case "specialStatus":
          valueA = a.specialStatus?.name?.toLowerCase() || "";
          valueB = b.specialStatus?.name?.toLowerCase() || "";
          break;
        default:
          valueA = a.nameOrNumber.toLowerCase();
          valueB = b.nameOrNumber.toLowerCase();
      }

      if (typeof valueA === "string" && typeof valueB === "string") {
        const comparison = valueA.localeCompare(valueB);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        const comparison = valueA - valueB;
        return sortOrder === "asc" ? comparison : -comparison;
      }
    });
    
    return sorted;
  }, [lots, sortBy, sortOrder, filters]);
  
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN' && user?.role !== 'MHP_LORD') {
    return (
      <div className="flex items-center justify-center py-16">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <ManagerSidebar />

        <main className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Lots</h1>
              <p className="text-muted-foreground">Manage lots in your assigned parks</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setIsBulkUploadOpen(true)}
                variant="outline"
                data-testid="bulk-upload-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              
              <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
                setIsCreateModalOpen(open);
                if (open) {
                  resetForm();
                  setEditingLot(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-lot">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Lot
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Lot</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="parkId">Park</Label>
                    <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(assignedParks) && assignedParks.map((park: any) => {
                          const parkId = isCompanyManager ? park.id : park.parkId;
                          const parkName = isCompanyManager ? park.name : park.parkName;
                          return (
                            <SelectItem key={parkId} value={parkId}>
                              {parkName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="nameOrNumber">Lot Name/Number</Label>
                    <Input
                      id="nameOrNumber"
                      value={formData.nameOrNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                      placeholder="e.g., Lot 12A"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="lotRent">Lot Rent</Label>
                    <MoneyInput
                      id="lotRent"
                      step="0.01"
                      value={formData.lotRent}
                      onChange={(e) => setFormData(prev => ({ ...prev, lotRent: e.target.value }))}
                      placeholder="Monthly lot rent amount"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Status & Pricing</Label>
                    
                    {/* For Rent */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="create-status-FOR_RENT"
                          checked={formData.status.includes('FOR_RENT')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, status: [...prev.status, 'FOR_RENT'] }));
                            } else {
                              setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'FOR_RENT') }));
                            }
                          }}
                        />
                        <Label htmlFor="create-status-FOR_RENT" className="text-sm cursor-pointer font-medium">
                          For Rent
                        </Label>
                      </div>
                      {formData.status.includes('FOR_RENT') && (
                        <div className="ml-6 space-y-3">
                          <div>
                            <Label htmlFor="priceForRent" className="text-sm">Price ($/month)</Label>
                            <MoneyInput
                              id="priceForRent"
                              step="0.01"
                              value={formData.priceForRent}
                              onChange={(e) => setFormData(prev => ({ ...prev, priceForRent: e.target.value }))}
                              placeholder="Monthly rent amount"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="depositForRent" className="text-sm">Deposit</Label>
                            <MoneyInput
                              id="depositForRent"
                              step="0.01"
                              value={formData.depositForRent}
                              onChange={(e) => setFormData(prev => ({ ...prev, depositForRent: e.target.value }))}
                              placeholder="Deposit amount"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* For Sale */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="create-status-FOR_SALE"
                          checked={formData.status.includes('FOR_SALE')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, status: [...prev.status, 'FOR_SALE'] }));
                            } else {
                              setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'FOR_SALE') }));
                            }
                          }}
                        />
                        <Label htmlFor="create-status-FOR_SALE" className="text-sm cursor-pointer font-medium">
                          For Sale
                        </Label>
                      </div>
                      {formData.status.includes('FOR_SALE') && (
                        <div className="ml-6 space-y-3">
                          <div>
                            <Label htmlFor="priceForSale" className="text-sm">Sale Price</Label>
                            <MoneyInput
                              id="priceForSale"
                              step="0.01"
                              value={formData.priceForSale}
                              onChange={(e) => setFormData(prev => ({ ...prev, priceForSale: e.target.value }))}
                              placeholder="Sale price"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="depositForSale" className="text-sm">Deposit</Label>
                            <MoneyInput
                              id="depositForSale"
                              step="0.01"
                              value={formData.depositForSale}
                              onChange={(e) => setFormData(prev => ({ ...prev, depositForSale: e.target.value }))}
                              placeholder="Deposit amount"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rent to Own */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="create-status-RENT_TO_OWN"
                          checked={formData.status.includes('RENT_TO_OWN')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, status: [...prev.status, 'RENT_TO_OWN'] }));
                            } else {
                              setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'RENT_TO_OWN') }));
                            }
                          }}
                        />
                        <Label htmlFor="create-status-RENT_TO_OWN" className="text-sm cursor-pointer font-medium">
                          Rent to Own
                        </Label>
                      </div>
                      {formData.status.includes('RENT_TO_OWN') && (
                        <div className="ml-6 space-y-3">
                          <div>
                            <Label htmlFor="priceRentToOwn" className="text-sm">Price ($/month)</Label>
                            <MoneyInput
                              id="priceRentToOwn"
                              step="0.01"
                              value={formData.priceRentToOwn}
                              onChange={(e) => setFormData(prev => ({ ...prev, priceRentToOwn: e.target.value }))}
                              placeholder="Monthly rent-to-own amount"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="depositRentToOwn" className="text-sm">Deposit</Label>
                            <MoneyInput
                              id="depositRentToOwn"
                              step="0.01"
                              value={formData.depositRentToOwn}
                              onChange={(e) => setFormData(prev => ({ ...prev, depositRentToOwn: e.target.value }))}
                              placeholder="Deposit amount"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contract for Deed */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="create-status-CONTRACT_FOR_DEED"
                          checked={formData.status.includes('CONTRACT_FOR_DEED')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, status: [...prev.status, 'CONTRACT_FOR_DEED'] }));
                            } else {
                              setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'CONTRACT_FOR_DEED') }));
                            }
                          }}
                        />
                        <Label htmlFor="create-status-CONTRACT_FOR_DEED" className="text-sm cursor-pointer font-medium">
                          Contract for Deed
                        </Label>
                      </div>
                      {formData.status.includes('CONTRACT_FOR_DEED') && (
                        <div className="ml-6 space-y-3">
                          <div>
                            <Label htmlFor="priceContractForDeed" className="text-sm">Price ($/month)</Label>
                            <MoneyInput
                              id="priceContractForDeed"
                              step="0.01"
                              value={formData.priceContractForDeed}
                              onChange={(e) => setFormData(prev => ({ ...prev, priceContractForDeed: e.target.value }))}
                              placeholder="Monthly contract payment"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="depositContractForDeed" className="text-sm">Deposit</Label>
                            <MoneyInput
                              id="depositContractForDeed"
                              step="0.01"
                              value={formData.depositContractForDeed}
                              onChange={(e) => setFormData(prev => ({ ...prev, depositContractForDeed: e.target.value }))}
                              placeholder="Deposit amount"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="downPaymentContractForDeed" className="text-sm">Down Payment</Label>
                            <MoneyInput
                              id="downPaymentContractForDeed"
                              step="0.01"
                              value={formData.downPaymentContractForDeed}
                              onChange={(e) => setFormData(prev => ({ ...prev, downPaymentContractForDeed: e.target.value }))}
                              placeholder="Down payment amount"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Promotional Price Toggle */}
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowPromotionalPrice(!showPromotionalPrice)}
                      className="w-full"
                    >
                      {showPromotionalPrice ? 'Hide' : 'Add'} Promotional Price
                    </Button>
                  </div>

                  {showPromotionalPrice && (
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="promotionalPrice">Promotional Price</Label>
                        <MoneyInput
                          id="promotionalPrice"
                          step="0.01"
                          value={formData.promotionalPrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotionalPrice: e.target.value }))}
                          placeholder="Special promotional price"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="promotionalPriceActive"
                          checked={formData.promotionalPriceActive}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, promotionalPriceActive: checked as boolean }))}
                        />
                        <Label htmlFor="promotionalPriceActive" className="text-sm cursor-pointer">
                          Promotional Price Active
                        </Label>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <Input
                        id="bedrooms"
                        type="number"
                        min="1"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value ? e.target.value ? parseInt(e.target.value) : 0 : 0 }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <Input
                        id="bathrooms"
                        type="number"
                        min="1"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value ? e.target.value ? parseInt(e.target.value) : 0 : 0 }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="sqFt">Square Feet</Label>
                    <Input
                      id="sqFt"
                      type="number"
                      min="1"
                      value={formData.sqFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, sqFt: e.target.value ? parseInt(e.target.value) : 0 }))}
                      placeholder="e.g., 1200"
                      required
                    />
                  </div>
                  
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="mobileHomeYear">Mobile Home Year</Label>
                      <Select value={formData.mobileHomeYear} onValueChange={(value) => setFormData(prev => ({ ...prev, mobileHomeYear: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="mobileHomeSize">Mobile Home Size</Label>
                      <Input
                        id="mobileHomeSize"
                        value={formData.mobileHomeSize}
                        onChange={(e) => setFormData(prev => ({ ...prev, mobileHomeSize: e.target.value }))}
                        placeholder="e.g., 14x70"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="estimatedPayment">Estimated Payment</Label>
                    <MoneyInput
                      id="estimatedPayment"
                      step="0.01"
                      value={formData.estimatedPayment}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedPayment: e.target.value }))}
                      placeholder="Estimated monthly payment"
                    />
                  </div>

                  <div>
                    <Label htmlFor="availableDate">Available Date</Label>
                    <Input
                      id="availableDate"
                      type="date"
                      value={formData.availableDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, availableDate: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the lot features..."
                      rows={3}
                    />
                  </div>
                  
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
                  
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={createLotMutation.isPending}>
                      {createLotMutation.isPending ? "Creating..." : "Create Lot"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Google Sheets Export */}
          <div className="mb-6">
            <SheetsConnection />
          </div>

          {/* Filter and Sort Controls */}
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">My Lots ({sortedLots.length} {(lots?.length && sortedLots.length !== lots.length) ? `of ${lots.length}` : ''})</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="manager-sortBy" className="text-sm">Sort by:</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[160px]" id="manager-sortBy" data-testid="manager-sort-by-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nameOrNumber">Lot Name/Number</SelectItem>
                        <SelectItem value="parkName">Park Name</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="visibility">Visibility</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="bedrooms">Bedrooms</SelectItem>
                        <SelectItem value="bathrooms">Bathrooms</SelectItem>
                        <SelectItem value="sqFt">Square Feet</SelectItem>
                        <SelectItem value="specialStatus">Special Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1"
                    data-testid="manager-sort-order-toggle"
                  >
                    {sortOrder === "asc" ? (
                      <ArrowUp className="w-4 h-4" />
                    ) : (
                      <ArrowDown className="w-4 h-4" />
                    )}
                    {sortOrder === "asc" ? "Asc" : "Desc"}
                  </Button>

                  {/* View Toggle */}
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-r-none border-r"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className="rounded-l-none"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Filter Controls */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search Filter */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search lots..."
                      value={filters.searchText}
                      onChange={(e) => updateRangeFilter("searchText", e.target.value)}
                      className="w-48"
                      data-testid="manager-search-filter"
                    />
                  </div>

                  {/* Status Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-status-filter-trigger">
                        <Filter className="w-4 h-4" />
                        Status {filters.status.length > 0 && `(${filters.status.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48" align="start">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status</Label>
                        {["FOR_RENT", "FOR_SALE", "RENT_TO_OWN", "CONTRACT_FOR_DEED"].map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`manager-status-${status}`}
                              checked={filters.status.includes(status)}
                              onCheckedChange={() => toggleFilter("status", status)}
                              data-testid={`manager-status-filter-${status}`}
                            />
                            <Label htmlFor={`manager-status-${status}`} className="text-sm cursor-pointer">
                              {status === "FOR_RENT" ? "For Rent" : status === "FOR_SALE" ? "For Sale" : status === "RENT_TO_OWN" ? "Rent to Own" : "Contract for Deed"}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Visibility Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-visibility-filter-trigger">
                        <Filter className="w-4 h-4" />
                        Visibility {filters.visibility.length > 0 && `(${filters.visibility.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48" align="start">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Visibility</Label>
                        {["visible", "hidden"].map((visibility) => (
                          <div key={visibility} className="flex items-center space-x-2">
                            <Checkbox
                              id={`manager-visibility-${visibility}`}
                              checked={filters.visibility.includes(visibility)}
                              onCheckedChange={() => toggleFilter("visibility", visibility)}
                              data-testid={`manager-visibility-filter-${visibility}`}
                            />
                            <Label htmlFor={`manager-visibility-${visibility}`} className="text-sm cursor-pointer">
                              {visibility === "visible" ? "On Market" : "Out of Market"}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Park Filter */}
                  {assignedParks.length > 1 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-park-filter-trigger">
                          <Filter className="w-4 h-4" />
                          Park {filters.parkId.length > 0 && `(${filters.parkId.length})`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="start">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          <Label className="text-sm font-medium">Parks</Label>
                          {assignedParks.map((park: any) => {
                            const parkId = isCompanyManager ? park.id : park.parkId;
                            const parkName = isCompanyManager ? park.name : park.parkName;
                            return (
                              <div key={parkId} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`manager-park-${parkId}`}
                                  checked={filters.parkId.includes(parkId)}
                                  onCheckedChange={() => toggleFilter("parkId", parkId)}
                                  data-testid={`manager-park-filter-${parkId}`}
                                />
                                <Label htmlFor={`manager-park-${parkId}`} className="text-sm cursor-pointer">
                                  {parkName}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Bedrooms Range Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-bedrooms-filter-trigger">
                        <Filter className="w-4 h-4" />
                        Bedrooms {(filters.bedroomsMin || filters.bedroomsMax) && "✓"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Bedrooms Range</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="manager-bedroomsMin" className="text-xs">Min</Label>
                            <Input
                              id="manager-bedroomsMin"
                              type="number"
                              placeholder="Min"
                              value={filters.bedroomsMin}
                              onChange={(e) => updateRangeFilter("bedroomsMin", e.target.value)}
                              data-testid="manager-bedrooms-min-filter"
                            />
                          </div>
                          <div>
                            <Label htmlFor="manager-bedroomsMax" className="text-xs">Max</Label>
                            <Input
                              id="manager-bedroomsMax"
                              type="number"
                              placeholder="Max"
                              value={filters.bedroomsMax}
                              onChange={(e) => updateRangeFilter("bedroomsMax", e.target.value)}
                              data-testid="manager-bedrooms-max-filter"
                            />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {/* House Manufacturer Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-manufacturer-filter-trigger">
                        <Filter className="w-4 h-4" />
                        Manufacturer {filters.houseManufacturer.length > 0 && `(${filters.houseManufacturer.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        <Label className="text-sm font-medium">House Manufacturer</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="manager-manufacturer-none"
                            checked={filters.houseManufacturer.includes("none")}
                            onCheckedChange={() => toggleFilter("houseManufacturer", "none")}
                            data-testid="manager-manufacturer-filter-none"
                          />
                          <Label htmlFor="manager-manufacturer-none" className="text-sm cursor-pointer">
                            No Manufacturer
                          </Label>
                        </div>
                        {Array.from(new Set(lots?.map(lot => lot.houseManufacturer).filter(Boolean) || [])).sort().map((manufacturer) => (
                          <div key={manufacturer} className="flex items-center space-x-2">
                            <Checkbox
                              id={`manager-manufacturer-${manufacturer}`}
                              checked={filters.houseManufacturer.includes(manufacturer!)}
                              onCheckedChange={() => toggleFilter("houseManufacturer", manufacturer!)}
                              data-testid={`manager-manufacturer-filter-${manufacturer}`}
                            />
                            <Label htmlFor={`manager-manufacturer-${manufacturer}`} className="text-sm cursor-pointer">
                              {manufacturer}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* House Model Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="manager-model-filter-trigger">
                        <Filter className="w-4 h-4" />
                        Model {filters.houseModel.length > 0 && `(${filters.houseModel.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        <Label className="text-sm font-medium">House Model</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="manager-model-none"
                            checked={filters.houseModel.includes("none")}
                            onCheckedChange={() => toggleFilter("houseModel", "none")}
                            data-testid="manager-model-filter-none"
                          />
                          <Label htmlFor="manager-model-none" className="text-sm cursor-pointer">
                            No Model
                          </Label>
                        </div>
                        {Array.from(new Set(lots?.map(lot => lot.houseModel).filter(Boolean) || [])).sort().map((model) => (
                          <div key={model} className="flex items-center space-x-2">
                            <Checkbox
                              id={`manager-model-${model}`}
                              checked={filters.houseModel.includes(model!)}
                              onCheckedChange={() => toggleFilter("houseModel", model!)}
                              data-testid={`manager-model-filter-${model}`}
                            />
                            <Label htmlFor={`manager-model-${model}`} className="text-sm cursor-pointer">
                              {model}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters() && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    className="flex items-center gap-1"
                    data-testid="manager-clear-filters-button"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>


          {/* Lots Grid */}
          {isLoading ? (
            <div className="text-center py-8">Loading lots...</div>
          ) : !sortedLots || sortedLots.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Home className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Lots Found</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't created any lots yet. Start by adding your first lot.
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Lot
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {sortedLots.map((lot) => (
                <Card key={lot.id} className={`transition-all hover:shadow-md ${!lot.isActive ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <button
                          onClick={() => setShowLotHistory({ lotId: lot.id, lotName: lot.nameOrNumber })}
                          className="text-xl font-bold mb-1 text-left hover:text-primary hover:underline transition-colors"
                        >
                          {lot.nameOrNumber}
                        </button>
                        <p className="text-sm text-muted-foreground">{lot.park.name}</p>
                      </div>
                      <Badge variant={lot.isActive ? 'default' : 'destructive'} className="ml-2">
                        {lot.isActive ? 'On Market' : 'Out of Market'}
                      </Badge>
                    </div>
                    
                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(() => {
                        const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                        return statusArray.length > 0 ? statusArray.map((status, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {status === 'FOR_RENT' ? 'For Rent' : status === 'FOR_SALE' ? 'For Sale' : status === 'RENT_TO_OWN' ? 'Rent to Own' : status === 'CONTRACT_FOR_DEED' ? 'Contract for Deed' : status}
                          </Badge>
                        )) : (
                          <Badge variant="outline" className="text-xs">No Status</Badge>
                        );
                      })()}
                    </div>
                    
                    {/* Special status */}
                    {lot.specialStatus && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md mb-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: lot.specialStatus.color }}
                        />
                        <span className="text-sm font-medium">
                          {lot.specialStatus.name}
                        </span>
                      </div>
                    )}
                    
                    {/* Tenant information */}
                    <div className="mb-2">
                      {lot.tenantId && lot.tenantName ? (
                        <button
                          onClick={() => window.location.href = `/manager/tenants?tenant=${lot.tenantId}`}
                          className="text-left hover:text-primary hover:underline transition-colors w-full"
                        >
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{lot.tenantName}</div>
                              <div className="text-xs text-muted-foreground">
                                Tenant • {lot.tenantStatus === 'ACTIVE' ? 'Active' : 
                                         lot.tenantStatus === 'PENDING' ? 'Pending' : 
                                         lot.tenantStatus === 'INACTIVE' ? 'Inactive' : 
                                         lot.tenantStatus === 'TERMINATED' ? 'Terminated' : lot.tenantStatus}
                              </div>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
                          No tenant assigned
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Price - most prominent */}
                      <div className="flex items-center justify-center p-3 bg-primary/10 rounded-lg">
                        <span className="text-2xl font-bold text-primary">
                          {(() => {
                            const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                            
                            // Show pricing based on status and availability
                            if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                              return `$${parseFloat(lot.priceForRent).toLocaleString()}/mo`;
                            }
                            if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                              return `$${parseFloat(lot.priceForSale).toLocaleString()}`;
                            }
                            if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                              return `$${parseFloat(lot.priceRentToOwn).toLocaleString()}/mo`;
                            }
                            if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                              return `$${parseFloat(lot.priceContractForDeed).toLocaleString()}/mo`;
                            }
                            
                            // Fallback to legacy price if no specific pricing is available
                            if (lot.price) {
                              const suffix = statusArray.includes('FOR_RENT') ? '/mo' : '';
                              return `$${parseFloat(lot.price).toLocaleString()}${suffix}`;
                            }
                            
                            return 'Price TBD';
                          })()}
                        </span>
                      </div>
                      
                      {/* Property details in a clean grid */}
                      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <Bed className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                          <div className="text-sm font-medium">{lot.bedrooms}</div>
                          <div className="text-xs text-muted-foreground">bed{lot.bedrooms !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="text-center">
                          <Bath className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                          <div className="text-sm font-medium">{lot.bathrooms}</div>
                          <div className="text-xs text-muted-foreground">bath{lot.bathrooms !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="text-center">
                          <Ruler className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                          <div className="text-sm font-medium">{lot.sqFt}</div>
                          <div className="text-xs text-muted-foreground">sq ft</div>
                        </div>
                      </div>
                      
                      {/* House details if available */}
                      {(lot.houseManufacturer || lot.houseModel) && (
                        <div className="text-sm text-muted-foreground">
                          {lot.houseManufacturer && (
                            <div><strong>Manufacturer:</strong> {lot.houseManufacturer}</div>
                          )}
                          {lot.houseModel && (
                            <div><strong>Model:</strong> {lot.houseModel}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Description */}
                      {lot.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {lot.description}
                        </p>
                      )}
                      
                      {/* Actions - cleaner button layout */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(lot)}
                          className="flex-1"
                          data-testid={`edit-details-lot-${lot.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-3"
                              data-testid={`button-more-actions-${lot.id}`}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setShowPhotos(lot.id)}
                              data-testid={`button-photos-lot-${lot.id}`}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Manage Photos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled
                              className="opacity-50"
                              data-testid={`button-calculator-lot-${lot.id}`}
                            >
                              <Calculator className="w-4 h-4 mr-2" />
                              Calculator <span className="text-xs ml-2">(Coming Soon)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignSpecialStatus(lot)}
                              data-testid={`button-assign-special-status-${lot.id}`}
                            >
                              <Tag className="w-4 h-4 mr-2" />
                              Special Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(lot.id)}
                              disabled={toggleLotActiveMutation.isPending}
                              data-testid={`button-toggle-lot-${lot.id}`}
                            >
                              {lot.isActive ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                              {lot.isActive ? 'Take off Market' : 'Put on Market'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(lot.id)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-lot-${lot.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Lot
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Park</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <button
                          onClick={() => setShowLotHistory({ lotId: lot.id, lotName: lot.nameOrNumber })}
                          className="font-medium text-left hover:text-primary hover:underline transition-colors"
                        >
                          {lot.nameOrNumber}
                        </button>
                        <div className="text-sm text-muted-foreground">{lot.description}</div>
                        {lot.specialStatus && (
                          <div className="flex items-center gap-1 mt-1">
                            <div
                              className="w-2 h-2 rounded-full border"
                              style={{ backgroundColor: lot.specialStatus.color }}
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {lot.specialStatus.name}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {lot.park.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                            return statusArray.length > 0 ? statusArray.map((status, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {status === 'FOR_RENT' ? 'For Rent' : status === 'FOR_SALE' ? 'For Sale' : status === 'RENT_TO_OWN' ? 'Rent to Own' : status === 'CONTRACT_FOR_DEED' ? 'Contract for Deed' : status}
                              </Badge>
                            )) : (
                              <Badge variant="outline" className="text-xs">No Status</Badge>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lot.tenantId && lot.tenantName ? (
                          <button
                            onClick={() => window.location.href = `/manager/tenants?tenant=${lot.tenantId}`}
                            className="text-left hover:text-primary hover:underline transition-colors"
                          >
                            <div className="font-medium">{lot.tenantName}</div>
                            <div className="text-xs text-muted-foreground">
                              {lot.tenantStatus === 'ACTIVE' ? 'Active' : 
                               lot.tenantStatus === 'PENDING' ? 'Pending' : 
                               lot.tenantStatus === 'INACTIVE' ? 'Inactive' : 
                               lot.tenantStatus === 'TERMINATED' ? 'Terminated' : lot.tenantStatus}
                            </div>
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No tenant</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lot.isActive ? 'default' : 'destructive'}>
                          {lot.isActive ? 'On Market' : 'Out of Market'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>$
                            {(() => {
                              const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                              
                              // Show pricing based on status and availability
                              if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                                return `${parseFloat(lot.priceForRent).toLocaleString()}/mo`;
                              }
                              if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                                return `${parseFloat(lot.priceForSale).toLocaleString()}`;
                              }
                              if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                                return `${parseFloat(lot.priceRentToOwn).toLocaleString()}/mo`;
                              }
                              if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                                return `${parseFloat(lot.priceContractForDeed).toLocaleString()}/mo`;
                              }
                              
                              // Fallback to legacy price if no specific pricing is available
                              if (lot.price) {
                                const suffix = statusArray.includes('FOR_RENT') ? '/mo' : '';
                                return `${parseFloat(lot.price).toLocaleString()}${suffix}`;
                              }
                              
                              return 'TBD';
                            })()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lot.bedrooms && <span>{lot.bedrooms}br </span>}
                          {lot.bathrooms && <span>{lot.bathrooms}ba </span>}
                          {lot.sqFt && <span>{lot.sqFt}sqft</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              Actions
                              <MoreHorizontal className="w-4 h-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(lot)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowPhotos(lot.id)}>
                              <Camera className="w-4 h-4 mr-2" />
                              Manage Photos
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="opacity-50">
                              <Calculator className="w-4 h-4 mr-2" />
                              Calculator <span className="text-xs ml-2">(Coming Soon)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAssignSpecialStatus(lot)}>
                              <Tag className="w-4 h-4 mr-2" />
                              Special Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleVisibility(lot.id, !lot.isActive)}>
                              {lot.isActive ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  Take off Market
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Put on Market
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteLot(lot.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Edit Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) {
              setEditingLot(null);
              resetForm();
            }
          }}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Edit Lot {editingLot?.nameOrNumber}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Update lot information and pricing details
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-6">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                  <div>
                    <Label htmlFor="edit-nameOrNumber">Lot Name/Number *</Label>
                    <Input
                      id="edit-nameOrNumber"
                      value={formData.nameOrNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameOrNumber: e.target.value }))}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-lotRent">Lot Rent ($/month)</Label>
                    <MoneyInput
                      id="edit-lotRent"
                      step="0.01"
                      value={formData.lotRent}
                      onChange={(e) => setFormData(prev => ({ ...prev, lotRent: e.target.value }))}
                      placeholder="Monthly lot rent amount"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Status and Pricing Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Status & Pricing</h3>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Status & Pricing</Label>
                  
                  {/* For Rent */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-status-FOR_RENT"
                        checked={formData.status.includes('FOR_RENT')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, status: [...prev.status, 'FOR_RENT'] }));
                          } else {
                            setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'FOR_RENT') }));
                          }
                        }}
                      />
                      <Label htmlFor="edit-status-FOR_RENT" className="text-sm cursor-pointer font-medium">
                        For Rent
                      </Label>
                    </div>
                    {formData.status.includes('FOR_RENT') && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <Label htmlFor="edit-priceForRent" className="text-sm">Price ($/month)</Label>
                          <MoneyInput
                            id="edit-priceForRent"
                            step="0.01"
                            value={formData.priceForRent}
                            onChange={(e) => setFormData(prev => ({ ...prev, priceForRent: e.target.value }))}
                            placeholder="Monthly rent amount"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-depositForRent" className="text-sm">Deposit</Label>
                          <MoneyInput
                            id="edit-depositForRent"
                            step="0.01"
                            value={formData.depositForRent}
                            onChange={(e) => setFormData(prev => ({ ...prev, depositForRent: e.target.value }))}
                            placeholder="Deposit amount"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* For Sale */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-status-FOR_SALE"
                        checked={formData.status.includes('FOR_SALE')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, status: [...prev.status, 'FOR_SALE'] }));
                          } else {
                            setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'FOR_SALE') }));
                          }
                        }}
                      />
                      <Label htmlFor="edit-status-FOR_SALE" className="text-sm cursor-pointer font-medium">
                        For Sale
                      </Label>
                    </div>
                    {formData.status.includes('FOR_SALE') && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <Label htmlFor="edit-priceForSale" className="text-sm">Sale Price</Label>
                          <MoneyInput
                            id="edit-priceForSale"
                            step="0.01"
                            value={formData.priceForSale}
                            onChange={(e) => setFormData(prev => ({ ...prev, priceForSale: e.target.value }))}
                            placeholder="Sale price"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-depositForSale" className="text-sm">Deposit</Label>
                          <MoneyInput
                            id="edit-depositForSale"
                            step="0.01"
                            value={formData.depositForSale}
                            onChange={(e) => setFormData(prev => ({ ...prev, depositForSale: e.target.value }))}
                            placeholder="Deposit amount"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rent to Own */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-status-RENT_TO_OWN"
                        checked={formData.status.includes('RENT_TO_OWN')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, status: [...prev.status, 'RENT_TO_OWN'] }));
                          } else {
                            setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'RENT_TO_OWN') }));
                          }
                        }}
                      />
                      <Label htmlFor="edit-status-RENT_TO_OWN" className="text-sm cursor-pointer font-medium">
                        Rent to Own
                      </Label>
                    </div>
                    {formData.status.includes('RENT_TO_OWN') && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <Label htmlFor="edit-priceRentToOwn" className="text-sm">Price ($/month)</Label>
                          <MoneyInput
                            id="edit-priceRentToOwn"
                            step="0.01"
                            value={formData.priceRentToOwn}
                            onChange={(e) => setFormData(prev => ({ ...prev, priceRentToOwn: e.target.value }))}
                            placeholder="Monthly rent-to-own amount"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-depositRentToOwn" className="text-sm">Deposit</Label>
                          <MoneyInput
                            id="edit-depositRentToOwn"
                            step="0.01"
                            value={formData.depositRentToOwn}
                            onChange={(e) => setFormData(prev => ({ ...prev, depositRentToOwn: e.target.value }))}
                            placeholder="Deposit amount"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contract for Deed */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-status-CONTRACT_FOR_DEED"
                        checked={formData.status.includes('CONTRACT_FOR_DEED')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, status: [...prev.status, 'CONTRACT_FOR_DEED'] }));
                          } else {
                            setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== 'CONTRACT_FOR_DEED') }));
                          }
                        }}
                      />
                      <Label htmlFor="edit-status-CONTRACT_FOR_DEED" className="text-sm cursor-pointer font-medium">
                        Contract for Deed
                      </Label>
                    </div>
                    {formData.status.includes('CONTRACT_FOR_DEED') && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <Label htmlFor="edit-priceContractForDeed" className="text-sm">Price ($/month)</Label>
                          <MoneyInput
                            id="edit-priceContractForDeed"
                            step="0.01"
                            value={formData.priceContractForDeed}
                            onChange={(e) => setFormData(prev => ({ ...prev, priceContractForDeed: e.target.value }))}
                            placeholder="Monthly contract payment"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-depositContractForDeed" className="text-sm">Deposit</Label>
                          <MoneyInput
                            id="edit-depositContractForDeed"
                            step="0.01"
                            value={formData.depositContractForDeed}
                            onChange={(e) => setFormData(prev => ({ ...prev, depositContractForDeed: e.target.value }))}
                            placeholder="Deposit amount"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-downPaymentContractForDeed" className="text-sm">Down Payment</Label>
                          <MoneyInput
                            id="edit-downPaymentContractForDeed"
                            step="0.01"
                            value={formData.downPaymentContractForDeed}
                            onChange={(e) => setFormData(prev => ({ ...prev, downPaymentContractForDeed: e.target.value }))}
                            placeholder="Down payment amount"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Promotional Price Toggle */}
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowPromotionalPriceEdit(!showPromotionalPriceEdit)}
                      className="w-full"
                    >
                      {showPromotionalPriceEdit ? 'Hide' : 'Add'} Promotional Price
                    </Button>
                  </div>

                  {showPromotionalPriceEdit && (
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="edit-promotionalPrice">Promotional Price</Label>
                        <MoneyInput
                          id="edit-promotionalPrice"
                          step="0.01"
                          value={formData.promotionalPrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotionalPrice: e.target.value }))}
                          placeholder="Special promotional price"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-promotionalPriceActive"
                          checked={formData.promotionalPriceActive}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, promotionalPriceActive: checked as boolean }))}
                        />
                        <Label htmlFor="edit-promotionalPriceActive" className="text-sm cursor-pointer">
                          Promotional Price Active
                        </Label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Property Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Property Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-bedrooms">Bedrooms *</Label>
                      <Input
                        id="edit-bedrooms"
                        type="number"
                        min="1"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value ? parseInt(e.target.value) : 0 }))}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-bathrooms">Bathrooms *</Label>
                      <Input
                        id="edit-bathrooms"
                        type="number"
                        min="1"
                        step="0.5"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value ? parseInt(e.target.value) : 0 }))}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-sqFt">Square Feet *</Label>
                      <Input
                        id="edit-sqFt"
                        type="number"
                        min="1"
                        value={formData.sqFt}
                        onChange={(e) => setFormData(prev => ({ ...prev, sqFt: e.target.value ? parseInt(e.target.value) : 0 }))}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-houseManufacturer">House Manufacturer</Label>
                      <Input
                        id="edit-houseManufacturer"
                        value={formData.houseManufacturer}
                        onChange={(e) => setFormData(prev => ({ ...prev, houseManufacturer: e.target.value }))}
                        placeholder="e.g., Clayton Homes"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-houseModel">House Model</Label>
                      <Input
                        id="edit-houseModel"
                        value={formData.houseModel}
                        onChange={(e) => setFormData(prev => ({ ...prev, houseModel: e.target.value }))}
                        placeholder="e.g., Heritage 3264A"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-mobileHomeYear">Mobile Home Year</Label>
                      <Select value={formData.mobileHomeYear} onValueChange={(value) => setFormData(prev => ({ ...prev, mobileHomeYear: value }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-mobileHomeSize">Mobile Home Size</Label>
                      <Input
                        id="edit-mobileHomeSize"
                        value={formData.mobileHomeSize}
                        onChange={(e) => setFormData(prev => ({ ...prev, mobileHomeSize: e.target.value }))}
                        placeholder="e.g., 14x70"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-estimatedPayment">Estimated Payment</Label>
                    <MoneyInput
                      id="edit-estimatedPayment"
                      step="0.01"
                      value={formData.estimatedPayment}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedPayment: e.target.value }))}
                      placeholder="Estimated monthly payment"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-availableDate">Available Date</Label>
                    <Input
                      id="edit-availableDate"
                      type="date"
                      value={formData.availableDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, availableDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Additional details about the lot..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-showingLink">Showing Link</Label>
                    <Input
                      id="edit-showingLink"
                      type="text"
                      value={formData.showingLink}
                      onChange={(e) => setFormData(prev => ({ ...prev, showingLink: e.target.value }))}
                      placeholder="https://example.com/showing-link"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="order-2 sm:order-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateLotMutation.isPending} className="order-1 sm:order-2">
                    {updateLotMutation.isPending ? "Updating..." : "Update Lot"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Photo Management Modal */}
          <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Manage Photos - {lots?.find(l => l.id === showPhotos)?.nameOrNumber}
                </DialogTitle>
              </DialogHeader>
              {showPhotos && (
                <PhotoManagement 
                  entityType="LOT"
                  entityId={showPhotos}
                  entityName={lots?.find(l => l.id === showPhotos)?.nameOrNumber || 'Lot'}
                />
              )}

            </DialogContent>
          </Dialog>

          {/* Calculator Selection Dialog */}
          <Dialog open={!!showCalculatorSelection} onOpenChange={(open) => !open && setShowCalculatorSelection(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Select Calculation Type</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Choose which status calculation you'd like to perform for {lots?.find(l => l.id === showCalculatorSelection)?.nameOrNumber || 'this lot'}
                </p>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="text-left">
                    <div className="font-medium text-muted-foreground">For Rent</div>
                    <div className="text-sm text-muted-foreground">Calculate monthly rental payments</div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="text-left">
                    <div className="font-medium text-muted-foreground">For Sale</div>
                    <div className="text-sm text-muted-foreground">Calculate purchase financing options</div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="text-left">
                    <div className="font-medium text-muted-foreground">Rent to Own</div>
                    <div className="text-sm text-muted-foreground">Calculate rent-to-own terms</div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start"
                  onClick={() => {
                    // Open the actual calculator for Contract for Deed
                    const lotId = showCalculatorSelection;
                    setShowCalculatorSelection(null);
                    setShowCalculator(lotId);
                  }}
                >
                  <div className="text-left">
                    <div className="font-medium">Contract for Deed</div>
                    <div className="text-sm text-muted-foreground">Calculate contract payment terms</div>
                  </div>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Calculator Dialog */}
          {showCalculator && (
            <LotCalculator
              isOpen={!!showCalculator}
              onClose={() => setShowCalculator(null)}
              lotPrice={parseFloat(lots?.find(l => l.id === showCalculator)?.price || '0')}
              lotName={lots?.find(l => l.id === showCalculator)?.nameOrNumber || 'Lot'}
            />
          )}

          {/* Special Status Assignment Dialog */}
          <Dialog open={!!assigningSpecialStatus} onOpenChange={(open) => !open && setAssigningSpecialStatus(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Assign Special Status - {assigningSpecialStatus?.nameOrNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="special-status-select">Special Status</Label>
                  <Select value={selectedSpecialStatusId} onValueChange={setSelectedSpecialStatusId}>
                    <SelectTrigger id="special-status-select">
                      <SelectValue placeholder="Select a special status or leave empty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Remove special status)</SelectItem>
                      {specialStatuses
                        .filter(status => status.isActive)
                        .map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: status.color }}
                              />
                              {status.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p><strong>Park:</strong> {assigningSpecialStatus?.park?.name || 'Unknown'}</p>
                  {assigningSpecialStatus?.specialStatus && (
                    <div className="flex items-center gap-2 mt-2">
                      <span>Current status:</span>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: assigningSpecialStatus.specialStatus.color }}
                        />
                        <span className="font-medium">{assigningSpecialStatus.specialStatus.name}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssigningSpecialStatus(null)}
                    data-testid="cancel-assign-special-status"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmSpecialStatusAssignment}
                    disabled={assignSpecialStatusMutation.isPending}
                    data-testid="confirm-assign-special-status"
                  >
                    {assignSpecialStatusMutation.isPending ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Upload Dialog */}
          <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Upload Lots</DialogTitle>
              </DialogHeader>
              
              {bulkUploadStep === 'upload' && (
                <div className="space-y-6">
                  <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload CSV or Excel File</h3>
                    <p className="text-gray-500 mb-4">
                      Upload lots data to your assigned park(s). If you manage only one park, lots will be automatically assigned. If you manage multiple parks, you must include a Park Name column in your file (required, preferred over Park ID).
                    </p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="bulk-upload-file-input"
                      data-testid="bulk-upload-file-input"
                      ref={(el) => {
                        if (el) {
                          (window as any).bulkUploadFileInput = el;
                        }
                      }}
                    />
                    <Button 
                      variant="outline" 
                      className="cursor-pointer"
                      onClick={() => {
                        const fileInput = document.getElementById('bulk-upload-file-input') as HTMLInputElement;
                        fileInput?.click();
                      }}
                      data-testid="choose-file-button"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-3 text-green-700">Required Columns</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Lot Name/Number</strong> - Unique identifier</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 text-blue-700">Optional Columns</h4>
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-1">
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-gray-700 mb-2">Basic Info:</p>
                          <li>• <strong>Status</strong> - FOR_RENT, FOR_SALE, RENT_TO_OWN, CONTRACT_FOR_DEED</li>
                          <li>• <strong>Special Status</strong> - Creates new status if doesn't exist</li>
                          <li>• <strong>Description</strong> - Lot description</li>
                          <li>• <strong>Available Date</strong> - When lot is available (YYYY-MM-DD)</li>
                          <li>• <strong>Showing Link</strong> - URL for scheduling showings</li>
                          <li>• <strong>Park ID</strong> - Required for multi-park managers</li>
                          <li>• <strong>Park Name</strong> - Alternative to Park ID</li>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-gray-700 mb-2">Property Details:</p>
                          <li>• <strong>Bedrooms</strong> - Number of bedrooms</li>
                          <li>• <strong>Bathrooms</strong> - Number of bathrooms</li>
                          <li>• <strong>Sq Ft</strong> - Square footage</li>
                          <li>• <strong>House Manufacturer</strong> - Mobile home manufacturer</li>
                          <li>• <strong>House Model</strong> - Mobile home model</li>
                          <li>• <strong>Mobile Home Year</strong> - Year of mobile home</li>
                          <li>• <strong>Mobile Home Size</strong> - Size/dimensions</li>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-gray-700 mb-2">Pricing (Rent):</p>
                          <li>• <strong>Price For Rent</strong> - Monthly rent price</li>
                          <li>• <strong>Deposit For Rent</strong> - Security deposit for rent</li>
                          <li>• <strong>Lot Rent</strong> - Lot rent amount</li>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-gray-700 mb-2">Pricing (Sale):</p>
                          <li>• <strong>Price For Sale</strong> - Sale price</li>
                          <li>• <strong>Deposit For Sale</strong> - Security deposit for sale</li>
                          <li>• <strong>Price Rent To Own</strong> - Rent to own monthly price</li>
                          <li>• <strong>Deposit Rent To Own</strong> - Rent to own deposit</li>
                          <li>• <strong>Price Contract For Deed</strong> - Contract for deed monthly price</li>
                          <li>• <strong>Deposit Contract For Deed</strong> - Contract for deed deposit</li>
                          <li>• <strong>Down Payment Contract For Deed</strong> - Down payment amount</li>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-gray-700 mb-2">Additional:</p>
                          <li>• <strong>Promotional Price</strong> - Special promotional price</li>
                          <li>• <strong>Promotional Price Active</strong> - true/false</li>
                          <li>• <strong>Estimated Payment</strong> - Estimated monthly payment</li>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {bulkUploadStep === 'mapping' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Map CSV Columns</h3>
                  <p className="text-sm text-gray-600">
                    Map your CSV columns to the required fields. {
                      assignmentsLoading ? 'Loading park assignments...' :
                      assignments && assignments.length > 1 
                        ? 'Since you manage multiple parks, you must specify the park name for each lot.'
                        : 'Lots will be automatically assigned to your park.'
                    }
                  </p>
                  
                  <div className="grid gap-4">
                    {/* Required fields */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-green-700">Required Fields</h4>
                      
                      <div>
                        <Label htmlFor="nameOrNumber-mapping">Lot Name/Number *</Label>
                        <Select value={columnMapping['nameOrNumber'] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, nameOrNumber: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CSV column for Lot Name/Number" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">-- Ignore --</SelectItem>
                            {csvHeaders.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Show park name as required field for multi-park managers */}
                      {!assignmentsLoading && assignments && assignments.length > 1 && (
                        <div>
                          <Label htmlFor="parkName-mapping">Park Name *</Label>
                          <Select value={columnMapping['parkName'] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, parkName: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select CSV column for Park Name" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">-- Ignore --</SelectItem>
                              {csvHeaders.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Optional fields */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-blue-700">Optional Fields</h4>
                      
                      {[
                        'status', 'specialStatus', 'description', 'availableDate', 'showingLink',
                        'bedrooms', 'bathrooms', 'sqFt', 'houseManufacturer', 'houseModel', 'mobileHomeYear', 'mobileHomeSize',
                        'priceForRent', 'priceForSale', 'priceRentToOwn', 'priceContractForDeed',
                        'depositForRent', 'depositForSale', 'depositRentToOwn', 'depositContractForDeed',
                        'downPaymentContractForDeed', 'lotRent', 'promotionalPrice', 'promotionalPriceActive', 'estimatedPayment',
                        'parkId', 'parkName'
                      ].filter(field => {
                        // Don't filter during loading
                        if (assignmentsLoading) {
                          return true;
                        }
                        // Hide park fields for single-park managers (auto-assigned)
                        if (assignments && assignments.length === 1 && (field === 'parkId' || field === 'parkName')) {
                          return false;
                        }
                        // Hide park name for multi-park managers (it's now in required section)
                        if (assignments && assignments.length > 1 && field === 'parkName') {
                          return false;
                        }
                        return true;
                      }).map(field => {
                        const fieldLabels: Record<string, string> = {
                          'status': 'Status',
                          'specialStatus': 'Special Status',
                          'description': 'Description',
                          'availableDate': 'Available Date',
                          'showingLink': 'Showing Link',
                          'bedrooms': 'Bedrooms',
                          'bathrooms': 'Bathrooms',
                          'sqFt': 'Sq Ft',
                          'houseManufacturer': 'House Manufacturer',
                          'houseModel': 'House Model',
                          'mobileHomeYear': 'Mobile Home Year',
                          'mobileHomeSize': 'Mobile Home Size',
                          'priceForRent': 'Price For Rent',
                          'priceForSale': 'Price For Sale',
                          'priceRentToOwn': 'Price Rent To Own',
                          'priceContractForDeed': 'Price Contract For Deed',
                          'depositForRent': 'Deposit For Rent',
                          'depositForSale': 'Deposit For Sale',
                          'depositRentToOwn': 'Deposit Rent To Own',
                          'depositContractForDeed': 'Deposit Contract For Deed',
                          'downPaymentContractForDeed': 'Down Payment Contract For Deed',
                          'lotRent': 'Lot Rent',
                          'promotionalPrice': 'Promotional Price',
                          'promotionalPriceActive': 'Promotional Price Active',
                          'estimatedPayment': 'Estimated Payment',
                          'parkId': 'Park ID (Optional)',
                          'parkName': 'Park Name (Required for multi-park)'
                        };
                        return (
                          <div key={field}>
                            <Label htmlFor={`${field}-mapping`}>{fieldLabels[field]}</Label>
                            <Select value={columnMapping[field] || ''} onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}>
                              <SelectTrigger>
                                <SelectValue placeholder={`Select CSV column for ${fieldLabels[field]}`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignore">-- Ignore --</SelectItem>
                                {csvHeaders.map(header => (
                                  <SelectItem key={header} value={header}>{header}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBulkUploadStep('upload')}>
                      Back
                    </Button>
                    <Button onClick={handleProceedToPreview} disabled={!isValidMapping()} data-testid="proceed-mapping">
                      Proceed to Preview
                    </Button>
                  </div>
                </div>
              )}

              {bulkUploadStep === 'preview' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Preview Data</h3>
                  <p className="text-sm text-gray-600">
                    Review the mapped data before importing. Showing first 10 rows:
                  </p>
                  
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lot Name/Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedData.slice(0, 10).map((lot, index) => (
                          <TableRow key={index}>
                            <TableCell>{lot.nameOrNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {lot.status || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                                
                                // Show pricing based on status and availability
                                if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                                  return `$${parseFloat(lot.priceForRent).toLocaleString()}/mo`;
                                }
                                if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                                  return `$${parseFloat(lot.priceForSale).toLocaleString()}`;
                                }
                                if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                                  return `$${parseFloat(lot.priceRentToOwn).toLocaleString()}/mo`;
                                }
                                if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                                  return `$${parseFloat(lot.priceContractForDeed).toLocaleString()}/mo`;
                                }
                                
                                // Fallback to legacy price if no specific pricing is available
                                if (lot.price) {
                                  const suffix = statusArray.includes('FOR_RENT') ? '/mo' : '';
                                  return `$${parseFloat(lot.price).toLocaleString()}${suffix}`;
                                }
                                
                                return 'N/A';
                              })()}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{lot.description || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {mappedData.length > 10 && (
                      <div className="p-2 text-center text-sm text-gray-500 border-t">
                        ... and {mappedData.length - 10} more lots
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setBulkUploadStep('mapping')}>
                      Back to Mapping
                    </Button>
                    <Button onClick={handleStartImport} data-testid="start-import">
                      Start Import
                    </Button>
                  </div>
                </div>
              )}

              {bulkUploadStep === 'importing' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 text-lg font-semibold">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Importing lots...
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Processing {mappedData.length} lots to your assigned park
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="w-full" />
                  </div>
                </div>
              )}

              {bulkUploadStep === 'results' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">Import Completed</h3>
                    {importResults?.assignedPark && (
                      <p className="text-sm text-muted-foreground">
                        All lots assigned to: <strong>{importResults.assignedPark}</strong>
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {importResults?.successful?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Successful</div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {importResults?.failed?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {mappedData.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                  
                  {importResults?.warnings?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-amber-700">⚠️ Warnings:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResults.warnings.map((warning: any, index: number) => (
                          <div key={index} className="text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200">
                            <strong>Row {warning.row}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {importResults?.failed?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Failed rows:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResults.failed.map((failure: any, index: number) => (
                          <div key={index} className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <strong>Row {failure.row}:</strong> {failure.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-center">
                    <Button onClick={resetBulkUpload} data-testid="close-bulk-upload">
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Lot History Dialog */}
          {showLotHistory && (
            <LotHistoryDialog
              isOpen={!!showLotHistory}
              onClose={() => setShowLotHistory(null)}
              lotId={showLotHistory.lotId}
              lotName={showLotHistory.lotName}
            />
          )}
        </main>
      </div>
    </div>
  );
}