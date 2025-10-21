import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PhotoManagement } from "@/components/ui/photo-management";
import { LotCalculator } from "@/components/ui/lot-calculator";
import { LotHistoryDialog } from "@/components/ui/lot-history-dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { SheetsConnection } from "@/components/ui/sheets-connection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { Home, Plus, Edit, Trash2, DollarSign, Camera, Eye, EyeOff, Tag, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, ArrowUp, ArrowDown, Filter, X, MoreHorizontal, Calculator, List, Grid3X3 } from "lucide-react";
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
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqFt: number | null;
  houseManufacturer?: string | null;
  houseModel?: string | null;
  isActive: boolean;
  parkId: string;
  createdAt: string;
  specialStatusId?: string | null;
  park?: {
    name: string;
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

interface Park {
  id: string;
  name: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
}

interface SpecialStatus {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  parkId: string;
}

export default function AdminLots() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [formData, setFormData] = useState({
    nameOrNumber: "",
    status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
    price: "", // Legacy price field
    priceForRent: "",
    priceForSale: "",
    priceRentToOwn: "",
    priceContractForDeed: "",
    depositForRent: "",
    depositForSale: "",
    depositRentToOwn: "",
    depositContractForDeed: "",
    downPaymentContractForDeed: "",
    lotRent: "",
    promotionalPrice: "",
    promotionalPriceActive: false,
    estimatedPayment: "",
    availableDate: "",
    mobileHomeYear: "",
    mobileHomeSize: "",
    showingLink: "",
    description: "",
    bedrooms: 1,
    bathrooms: 1,
    sqFt: 0,
    houseManufacturer: "",
    houseModel: "",
    parkId: ""
  });
  const [showPhotos, setShowPhotos] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState<string | null>(null);
  const [showCalculatorSelection, setShowCalculatorSelection] = useState<string | null>(null);
  const [assigningSpecialStatus, setAssigningSpecialStatus] = useState<Lot | null>(null);
  const [selectedSpecialStatusId, setSelectedSpecialStatusId] = useState<string>("");
  const [showLotHistory, setShowLotHistory] = useState<{ lotId: string; lotName: string } | null>(null);
  const [showPromotionalPrice, setShowPromotionalPrice] = useState(false);
  const [showPromotionalPriceEdit, setShowPromotionalPriceEdit] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<string>("nameOrNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // View toggle state
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // Filtering state
  const [filters, setFilters] = useState({
    status: [] as string[],
    visibility: [] as string[],
    parkId: [] as string[],
    companyId: [] as string[],
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
    // Reset to first page when searching
    if (category === "searchText") {
      setCurrentPage(1);
    }
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      visibility: [],
      parkId: [],
      companyId: [],
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

  const hasActiveFilters = () => {
    return filters.status.length > 0 ||
           filters.visibility.length > 0 ||
           filters.parkId.length > 0 ||
           filters.companyId.length > 0 ||
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
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1);
            const formattedData = rows.map(row => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = (row as any[])[index] || '';
              });
              return obj;
            });
            
            setCsvHeaders(headers);
            setParsedData(formattedData);
            setBulkUploadStep('mapping');
          }
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Please check the file format and try again",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
    }
  };

  const handleColumnMapping = () => {
    const requiredFields = ['nameOrNumber'];
    const missingFields = requiredFields.filter(field => !columnMapping[field] || columnMapping[field] === 'skip');
    
    // Park name is required - park ID is only an optional fallback
    if (!columnMapping['parkName'] || columnMapping['parkName'] === 'skip') {
      missingFields.push('parkName (required - Park ID alone is not sufficient)');
    }
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing required mappings",
        description: `Please map: ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Transform data using column mapping
    const transformedData = parsedData.map(row => {
      const transformed: any = {};
      Object.entries(columnMapping).forEach(([lotField, csvField]) => {
        if (csvField && csvField !== 'skip') {
          transformed[lotField] = row[csvField];
        }
      });
      return transformed;
    });
    
    setMappedData(transformedData);
    setBulkUploadStep('preview');
  };

  const bulkUploadMutation = useMutation({
    mutationFn: async (data: any[]) => {
      return await apiRequest('POST', '/api/admin/lots/bulk', { lots: data });
    },
    onSuccess: async (response) => {
      const results = await response.json();
      setImportResults(results);
      setImportProgress(100);
      
      // Refresh lots data
      queryClient.invalidateQueries({ queryKey: ['/api/lots'] });
      
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
      toast({
        title: "Bulk upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleStartImport = () => {
    setBulkUploadStep('importing');
    setImportProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90; // Will be set to 100% in onSuccess
        }
        return prev + 10;
      });
    }, 300);

    bulkUploadMutation.mutate(mappedData);
  };

  const resetBulkUpload = () => {
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

  // Redirect if not admin
  if (user?.role !== 'MHP_LORD') {
    window.location.href = '/';
    return null;
  }

  const { data: lots, isLoading } = useQuery<Lot[]>({
    queryKey: ["/api/lots", "includeInactive=true", filters.searchText],
    queryFn: async () => {
      const params = new URLSearchParams({
        includeInactive: 'true',
        limit: '10000'
      });
      
      // Add search parameter if there's search text
      if (filters.searchText.trim()) {
        params.append('q', filters.searchText.trim());
      }
      
      const response = await apiRequest("GET", `/api/lots?${params.toString()}`);
      const data = await response.json();
      return data.lots || data; // Handle both formats
    },
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: parks } = useQuery<{ parks: Park[] }>({
    queryKey: ["/api/parks"],
    enabled: user?.role === 'MHP_LORD',
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === 'MHP_LORD',
  });

  // Special statuses query for the selected park
  const { data: specialStatuses = [] } = useQuery<SpecialStatus[]>({
    queryKey: ["/api/parks", assigningSpecialStatus?.parkId, "special-statuses"],
    enabled: !!assigningSpecialStatus?.parkId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
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
      
      const payload = {
        parkId: data.parkId,
        nameOrNumber: data.nameOrNumber,
        status: data.status,
        price: data.price || '0',
        priceForRent: toStringOrNull(data.priceForRent),
        priceForSale: toStringOrNull(data.priceForSale),
        priceRentToOwn: toStringOrNull(data.priceRentToOwn),
        priceContractForDeed: toStringOrNull(data.priceContractForDeed),
        depositForRent: toStringOrNull(data.depositForRent),
        depositForSale: toStringOrNull(data.depositForSale),
        depositRentToOwn: toStringOrNull(data.depositRentToOwn),
        depositContractForDeed: toStringOrNull(data.depositContractForDeed),
        downPaymentContractForDeed: toStringOrNull(data.downPaymentContractForDeed),
        lotRent: toStringOrNull(data.lotRent),
        promotionalPrice: toStringOrNull(data.promotionalPrice),
        promotionalPriceActive: data.promotionalPriceActive || false,
        estimatedPayment: toStringOrNull(data.estimatedPayment),
        availableDate: data.availableDate || null,
        mobileHomeYear: data.mobileHomeYear ? parseInt(data.mobileHomeYear) : null,
        mobileHomeSize: data.mobileHomeSize?.trim() || null,
        bedrooms: data.bedrooms || null,
        bathrooms: data.bathrooms || null,
        sqFt: data.sqFt || null,
        showingLink: data.showingLink?.trim() || null,
        houseManufacturer: data.houseManufacturer?.trim() || null,
        houseModel: data.houseModel?.trim() || null,
        description: data.description?.trim() || null,
        isActive: true
      };
      return apiRequest("POST", "/api/lots", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Lot created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create lot",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
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
      const payload: any = {};
      
      if (data.parkId !== undefined) payload.parkId = data.parkId;
      if (data.nameOrNumber !== undefined) payload.nameOrNumber = data.nameOrNumber;
      if (data.status !== undefined) payload.status = data.status;
      if (data.price !== undefined) payload.price = data.price || '0';
      if (data.priceForRent !== undefined) payload.priceForRent = toStringOrNull(data.priceForRent);
      if (data.priceForSale !== undefined) payload.priceForSale = toStringOrNull(data.priceForSale);
      if (data.priceRentToOwn !== undefined) payload.priceRentToOwn = toStringOrNull(data.priceRentToOwn);
      if (data.priceContractForDeed !== undefined) payload.priceContractForDeed = toStringOrNull(data.priceContractForDeed);
      if (data.depositForRent !== undefined) payload.depositForRent = toStringOrNull(data.depositForRent);
      if (data.depositForSale !== undefined) payload.depositForSale = toStringOrNull(data.depositForSale);
      if (data.depositRentToOwn !== undefined) payload.depositRentToOwn = toStringOrNull(data.depositRentToOwn);
      if (data.depositContractForDeed !== undefined) payload.depositContractForDeed = toStringOrNull(data.depositContractForDeed);
      if (data.downPaymentContractForDeed !== undefined) payload.downPaymentContractForDeed = toStringOrNull(data.downPaymentContractForDeed);
      if (data.lotRent !== undefined) payload.lotRent = toStringOrNull(data.lotRent);
      if (data.bedrooms !== undefined) payload.bedrooms = data.bedrooms || null;
      if (data.bathrooms !== undefined) payload.bathrooms = data.bathrooms || null;
      if (data.sqFt !== undefined) payload.sqFt = data.sqFt || null;
      if (data.showingLink !== undefined) payload.showingLink = data.showingLink?.trim() || null;
      if (data.houseManufacturer !== undefined) payload.houseManufacturer = data.houseManufacturer?.trim() || null;
      if (data.houseModel !== undefined) payload.houseModel = data.houseModel?.trim() || null;
      if (data.description !== undefined) payload.description = data.description?.trim() || null;
      if (data.promotionalPrice !== undefined) payload.promotionalPrice = toStringOrNull(data.promotionalPrice);
      if (data.promotionalPriceActive !== undefined) payload.promotionalPriceActive = data.promotionalPriceActive || false;
      if (data.estimatedPayment !== undefined) payload.estimatedPayment = toStringOrNull(data.estimatedPayment);
      if (data.availableDate !== undefined) payload.availableDate = data.availableDate || null;
      if (data.mobileHomeYear !== undefined) payload.mobileHomeYear = data.mobileHomeYear ? parseInt(data.mobileHomeYear) : null;
      if (data.mobileHomeSize !== undefined) payload.mobileHomeSize = data.mobileHomeSize?.trim() || null;
      const response = await apiRequest("PATCH", `/api/lots/${editingLot?.id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      setEditingLot(null);
      resetForm();
      toast({
        title: "Success",
        description: "Lot updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Update lot error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      
      let errorMessage = "Failed to update lot";
      
      // The error from apiRequest contains the server response in the message
      if (error?.message) {
        errorMessage = error.message;
        // Try to extract JSON from the error message if it contains server response
        const match = error.message.match(/\d+: (.+)/);
        if (match) {
          try {
            const serverResponse = JSON.parse(match[1]);
            if (serverResponse.message) {
              errorMessage = serverResponse.message;
            } else if (serverResponse.errors) {
              errorMessage = `Validation errors: ${JSON.stringify(serverResponse.errors)}`;
            }
          } catch (e) {
            // If not JSON, use the raw message
            errorMessage = match[1] || error.message;
          }
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      toast({
        title: "Success",
        description: "Lot deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lot",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/lots/${id}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      toast({
        title: "Success",
        description: "Lot visibility updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lot visibility",
        variant: "destructive",
      });
    },
  });

  const assignSpecialStatusMutation = useMutation({
    mutationFn: async ({ lotId, specialStatusId }: { lotId: string; specialStatusId: string | null }) => {
      return apiRequest("PUT", `/api/lots/${lotId}/special-status`, { specialStatusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
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

  const resetForm = () => {
    setFormData({
      nameOrNumber: "",
      status: [] as ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[],
      price: "",
      priceForRent: "",
      priceForSale: "",
      priceRentToOwn: "",
      priceContractForDeed: "",
      depositForRent: "",
      depositForSale: "",
      depositRentToOwn: "",
      depositContractForDeed: "",
      downPaymentContractForDeed: "",
      lotRent: "",
      promotionalPrice: "",
      promotionalPriceActive: false,
      estimatedPayment: "",
      availableDate: "",
      mobileHomeYear: "",
      mobileHomeSize: "",
      showingLink: "",
      description: "",
      bedrooms: 1,
      bathrooms: 1,
      sqFt: 0,
      houseManufacturer: "",
      houseModel: "",
      parkId: ""
    });
  };

  const handleEdit = (lot: Lot) => {
    setEditingLot(lot);
    setFormData({
      nameOrNumber: lot.nameOrNumber,
      status: Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []),
      price: lot.price,
      priceForRent: lot.priceForRent || "",
      priceForSale: lot.priceForSale || "",
      priceRentToOwn: lot.priceRentToOwn || "",
      priceContractForDeed: lot.priceContractForDeed || "",
      depositForRent: lot.depositForRent || "",
      depositForSale: lot.depositForSale || "",
      depositRentToOwn: lot.depositRentToOwn || "",
      depositContractForDeed: lot.depositContractForDeed || "",
      downPaymentContractForDeed: lot.downPaymentContractForDeed || "",
      lotRent: lot.lotRent || "",
      promotionalPrice: lot.promotionalPrice || "",
      promotionalPriceActive: lot.promotionalPriceActive || false,
      estimatedPayment: lot.estimatedPayment || "",
      availableDate: lot.availableDate ? lot.availableDate.split('T')[0] : "",
      mobileHomeYear: lot.mobileHomeYear?.toString() || "",
      mobileHomeSize: lot.mobileHomeSize || "",
      showingLink: lot.showingLink || "",
      description: lot.description || "",
      bedrooms: lot.bedrooms || 1,
      bathrooms: lot.bathrooms || 1,
      sqFt: lot.sqFt || 0,
      houseManufacturer: lot.houseManufacturer || "",
      houseModel: lot.houseModel || "",
      parkId: lot.parkId
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLot) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
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

  const toggleVisibility = (id: string, isActive: boolean) => {
    toggleMutation.mutate(id);
  };

  const deleteLot = (id: string) => {
    if (confirm("Are you sure you want to delete this lot?")) {
      deleteMutation.mutate(id);
    }
  };

  const rawLotsList = lots ?? [];
  const parksList = parks?.parks ?? [];
  const companiesList = companies ?? [];
  
  // Create efficient lookup maps for relationships
  const parkById = new Map(parksList.map(p => [p.id, p]));
  const companyById = new Map(companiesList.map(c => [c.id, c]));

  // Filtering function
  const filterLots = (lotsToFilter: Lot[]) => {
    return lotsToFilter.filter((lot) => {
      // Status filter
      if (filters.status.length > 0) {
        const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
        const hasMatchingStatus = filters.status.some(filterStatus => statusArray.includes(filterStatus as any));
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

      // Company filter
      if (filters.companyId.length > 0) {
        const park = parkById.get(lot.parkId);
        const companyId = park?.companyId;
        if (!companyId || !filters.companyId.includes(companyId)) {
          return false;
        }
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

      // Note: Search text filtering is now handled server-side via the 'q' parameter

      return true;
    });
  };

  // Sorting function
  const sortLots = (lotsToSort: Lot[]) => {
    return [...lotsToSort].sort((a, b) => {
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
          valueA = parkById.get(a.parkId)?.name?.toLowerCase() || "";
          valueB = parkById.get(b.parkId)?.name?.toLowerCase() || "";
          break;
        case "companyName":
          const parkA = parkById.get(a.parkId);
          const parkB = parkById.get(b.parkId);
          valueA = parkA?.companyId ? companyById.get(parkA.companyId)?.name?.toLowerCase() || "" : "";
          valueB = parkB?.companyId ? companyById.get(parkB.companyId)?.name?.toLowerCase() || "" : "";
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
  };

  // Apply filtering and sorting to lots list
  const filteredLots = filterLots(rawLotsList);
  const sortedLots = sortLots(filteredLots);
  
  
  // Client-side pagination
  const totalPages = Math.ceil(sortedLots.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const lotsList = sortedLots.slice(startIndex, endIndex);

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
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
              description: "Please go to your dashboard to link your Google Sheet, then try exporting again.",
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
          description: "Please go to your dashboard and link a Google Sheet first.",
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

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Home className="w-8 h-8" />
                Lots
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage individual lots and properties
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Lot
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Button
                variant="outline"
                onClick={() => setIsBulkUploadOpen(true)}
                data-testid="bulk-upload-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
              setIsCreateModalOpen(open);
              if (open) {
                resetForm();
                setEditingLot(null);
              }
            }}>
              <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Lot</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="parkId">Park</Label>
                    <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        {parksList.map((park: Park) => (
                          <SelectItem key={park.id} value={park.id}>
                            {park.name}
                          </SelectItem>
                        ))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 1 }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 1 }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="sqFt">Square Feet</Label>
                    <Input
                      id="sqFt"
                      type="number"
                      min="0"
                      value={formData.sqFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, sqFt: parseInt(e.target.value) || 0 }))}
                      placeholder="e.g., 1200"
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
                          {Array.from({ length: new Date().getFullYear() + 1 - 1969 }, (_, i) => new Date().getFullYear() + 1 - i).map((year) => (
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
                    <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Lot"}
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Lots ({lotsList.length} of {filteredLots.length} filtered, {rawLotsList.length} total)</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]" id="sortBy" data-testid="sort-by-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nameOrNumber">Lot Name/Number</SelectItem>
                      <SelectItem value="parkName">Park Name</SelectItem>
                      <SelectItem value="companyName">Company</SelectItem>
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
                  data-testid="sort-order-toggle"
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
                
                <div className="flex items-center gap-2">
                  <Label htmlFor="itemsPerPage" className="text-sm">Show:</Label>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}>
                    <SelectTrigger className="w-[80px]" id="itemsPerPage" data-testid="items-per-page-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
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
                    data-testid="search-filter"
                  />
                </div>

                {/* Status Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="status-filter-trigger">
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
                            id={`status-${status}`}
                            checked={filters.status.includes(status)}
                            onCheckedChange={() => toggleFilter("status", status)}
                            data-testid={`status-filter-${status}`}
                          />
                          <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
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
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="visibility-filter-trigger">
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
                            id={`visibility-${visibility}`}
                            checked={filters.visibility.includes(visibility)}
                            onCheckedChange={() => toggleFilter("visibility", visibility)}
                            data-testid={`visibility-filter-${visibility}`}
                          />
                          <Label htmlFor={`visibility-${visibility}`} className="text-sm cursor-pointer">
                            {visibility === "visible" ? "On Market" : "Out of Market"}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Park Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="park-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Park {filters.parkId.length > 0 && `(${filters.parkId.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">Parks</Label>
                      {parksList.map((park) => (
                        <div key={park.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`park-${park.id}`}
                            checked={filters.parkId.includes(park.id)}
                            onCheckedChange={() => toggleFilter("parkId", park.id)}
                            data-testid={`park-filter-${park.id}`}
                          />
                          <Label htmlFor={`park-${park.id}`} className="text-sm cursor-pointer">
                            {park.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Company Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="company-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Company {filters.companyId.length > 0 && `(${filters.companyId.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">Companies</Label>
                      {companiesList.map((company) => (
                        <div key={company.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`company-${company.id}`}
                            checked={filters.companyId.includes(company.id)}
                            onCheckedChange={() => toggleFilter("companyId", company.id)}
                            data-testid={`company-filter-${company.id}`}
                          />
                          <Label htmlFor={`company-${company.id}`} className="text-sm cursor-pointer">
                            {company.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Bedrooms Range Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="bedrooms-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Bedrooms {(filters.bedroomsMin || filters.bedroomsMax) && "✓"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bedrooms Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="bedroomsMin" className="text-xs">Min</Label>
                          <Input
                            id="bedroomsMin"
                            type="number"
                            placeholder="Min"
                            value={filters.bedroomsMin}
                            onChange={(e) => updateRangeFilter("bedroomsMin", e.target.value)}
                            data-testid="bedrooms-min-filter"
                          />
                        </div>
                        <div>
                          <Label htmlFor="bedroomsMax" className="text-xs">Max</Label>
                          <Input
                            id="bedroomsMax"
                            type="number"
                            placeholder="Max"
                            value={filters.bedroomsMax}
                            onChange={(e) => updateRangeFilter("bedroomsMax", e.target.value)}
                            data-testid="bedrooms-max-filter"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {/* House Manufacturer Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="admin-manufacturer-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Manufacturer {filters.houseManufacturer.length > 0 && `(${filters.houseManufacturer.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">House Manufacturer</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="admin-manufacturer-none"
                          checked={filters.houseManufacturer.includes("none")}
                          onCheckedChange={() => toggleFilter("houseManufacturer", "none")}
                          data-testid="admin-manufacturer-filter-none"
                        />
                        <Label htmlFor="admin-manufacturer-none" className="text-sm cursor-pointer">
                          No Manufacturer
                        </Label>
                      </div>
                      {Array.from(new Set(rawLotsList.map((lot: Lot) => lot.houseManufacturer).filter(Boolean))).sort().map((manufacturer) => (
                        <div key={manufacturer} className="flex items-center space-x-2">
                          <Checkbox
                            id={`admin-manufacturer-${manufacturer}`}
                            checked={filters.houseManufacturer.includes(manufacturer as string)}
                            onCheckedChange={() => toggleFilter("houseManufacturer", manufacturer as string)}
                            data-testid={`admin-manufacturer-filter-${manufacturer}`}
                          />
                          <Label htmlFor={`admin-manufacturer-${manufacturer}`} className="text-sm cursor-pointer">
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
                    <Button variant="outline" size="sm" className="flex items-center gap-1" data-testid="admin-model-filter-trigger">
                      <Filter className="w-4 h-4" />
                      Model {filters.houseModel.length > 0 && `(${filters.houseModel.length})`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="start">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <Label className="text-sm font-medium">House Model</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="admin-model-none"
                          checked={filters.houseModel.includes("none")}
                          onCheckedChange={() => toggleFilter("houseModel", "none")}
                          data-testid="admin-model-filter-none"
                        />
                        <Label htmlFor="admin-model-none" className="text-sm cursor-pointer">
                          No Model
                        </Label>
                      </div>
                      {Array.from(new Set(rawLotsList.map((lot: Lot) => lot.houseModel).filter(Boolean))).sort().map((model) => (
                        <div key={model} className="flex items-center space-x-2">
                          <Checkbox
                            id={`admin-model-${model}`}
                            checked={filters.houseModel.includes(model as string)}
                            onCheckedChange={() => toggleFilter("houseModel", model as string)}
                            data-testid={`admin-model-filter-${model}`}
                          />
                          <Label htmlFor={`admin-model-${model}`} className="text-sm cursor-pointer">
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
                  data-testid="clear-filters-button"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading lots...</p>
              </div>
            ) : lotsList.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No lots found</p>
              </div>
            ) : viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Park</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotsList.map((lot: Lot) => (
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
                          {lot.park?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(() => {
                            const park = parkById.get(lot.parkId);
                            const company = park?.companyId ? companyById.get(park.companyId) : null;
                            return company?.name || 'Unknown';
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            // Handle both array and single status formats
                            const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                            return statusArray.length > 0 ? statusArray.map((s, index) => (
                              <Badge key={index} variant="secondary">
                                {s === 'FOR_RENT' ? 'For Rent' : s === 'FOR_SALE' ? 'For Sale' : s === 'RENT_TO_OWN' ? 'Rent to Own' : 'Contract for Deed'}
                              </Badge>
                            )) : (
                              <Badge variant="secondary">No Status</Badge>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lot.tenantId && lot.tenantName ? (
                          <button
                            onClick={() => window.location.href = `/admin/tenants?tenant=${lot.tenantId}`}
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
                        <Badge variant={lot.isActive ? 'default' : 'secondary'}>
                          {lot.isActive ? 'On Market' : 'Out of Market'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>${parseInt(lot.price).toLocaleString()}</span>
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
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-edit-lot-${lot.id}`}
            >
              Actions
              <MoreHorizontal className="w-4 h-4 ml-2" />
            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEdit(lot)}
                              data-testid={`edit-details-lot-${lot.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowPhotos(lot.id)}
                              data-testid={`button-photos-lot-${lot.id}`}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Manage Photos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setShowCalculatorSelection(lot.id)}
                              data-testid={`button-calculator-lot-${lot.id}`}
                            >
                              <Calculator className="w-4 h-4 mr-2" />
                              Calculator
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignSpecialStatus(lot)}
                              data-testid={`assign-special-status-${lot.id}`}
                            >
                              <Tag className="w-4 h-4 mr-2" />
                              Assign Special Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportToGoogleSheets(lot)}
                              data-testid={`button-export-sheets-lot-${lot.id}`}
                            >
                              <FileSpreadsheet className="w-4 h-4 mr-2" />
                              Send to Google Sheet
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleMutation.mutate(lot.id)}
                              disabled={toggleMutation.isPending}
                              data-testid={`toggle-lot-${lot.id}`}
                            >
                              {lot.isActive ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                              {lot.isActive ? 'Take off Market' : 'Put on Market'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this lot?")) {
                                  deleteMutation.mutate(lot.id);
                                }
                              }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-lot-${lot.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Lot
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              // Card View
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {lotsList.map((lot: Lot) => (
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
                          <p className="text-sm text-muted-foreground">{lot.park?.name || 'Unknown Park'}</p>
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
                        <div className="flex items-center gap-1 mb-2">
                          <div
                            className="w-2 h-2 rounded-full border"
                            style={{ backgroundColor: lot.specialStatus.color }}
                          />
                          <span className="text-xs font-medium text-muted-foreground">
                            {lot.specialStatus.name}
                          </span>
                        </div>
                      )}
                      
                      {/* Company badge */}
                      <div className="mb-3">
                        <Badge variant="outline" className="text-xs">
                          {(() => {
                            const park = parkById.get(lot.parkId);
                            const company = park?.companyId ? companyById.get(park.companyId) : null;
                            return company?.name || 'Unknown Company';
                          })()}
                        </Badge>
                      </div>
                      
                      {/* Tenant information */}
                      <div className="mb-3">
                        {lot.tenantId && lot.tenantName ? (
                          <button
                            onClick={() => window.location.href = `/admin/tenants?tenant=${lot.tenantId}`}
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
                      
                      {/* Price and details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">
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
                        
                        <div className="text-sm text-muted-foreground">
                          {lot.bedrooms && <span>{lot.bedrooms}br </span>}
                          {lot.bathrooms && <span>{lot.bathrooms}ba </span>}
                          {lot.sqFt && <span>{lot.sqFt}sqft</span>}
                        </div>
                        
                        {lot.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{lot.description}</p>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full">
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
                          <DropdownMenuItem onClick={() => setShowCalculatorSelection(lot.id)}>
                            <Calculator className="w-4 h-4 mr-2" />
                            Calculator
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignSpecialStatus(lot)}>
                            <Tag className="w-4 h-4 mr-2" />
                            Special Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportToGoogleSheets(lot)}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Send to Google Sheet
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredLots.length} filtered lots)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm px-2">
                    {Math.max(1, currentPage - 2)} - {Math.min(totalPages, currentPage + 2)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingLot} onOpenChange={(open) => {
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-parkId">Park *</Label>
                    <Select value={formData.parkId} onValueChange={(value) => setFormData(prev => ({ ...prev, parkId: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a park" />
                      </SelectTrigger>
                      <SelectContent>
                        {parksList.map((park: Park) => (
                          <SelectItem key={park.id} value={park.id}>
                            {park.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                    <Input
                      id="edit-bedrooms"
                      type="number"
                      min="0"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value ? parseInt(e.target.value) : 0 }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                    <Input
                      id="edit-bathrooms"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value ? parseFloat(e.target.value) : 0 }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sqFt">Square Feet</Label>
                    <Input
                      id="edit-sqFt"
                      type="number"
                      min="0"
                      value={formData.sqFt}
                      onChange={(e) => setFormData(prev => ({ ...prev, sqFt: e.target.value ? parseInt(e.target.value) : 0 }))}
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
                        {Array.from({ length: new Date().getFullYear() + 1 - 1969 }, (_, i) => new Date().getFullYear() + 1 - i).map((year) => (
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
                <Button type="button" variant="outline" onClick={() => setEditingLot(null)} className="order-2 sm:order-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="order-1 sm:order-2">
                  {updateMutation.isPending ? "Updating..." : "Update Lot"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Photo Management Dialog */}
        <Dialog open={!!showPhotos} onOpenChange={(open) => !open && setShowPhotos(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Photos - {lotsList.find(l => l.id === showPhotos)?.nameOrNumber}
              </DialogTitle>
            </DialogHeader>
            {showPhotos && (
              <PhotoManagement 
                entityType="LOT"
                entityId={showPhotos}
                entityName={lotsList.find(l => l.id === showPhotos)?.nameOrNumber || 'Lot'}
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
                Choose which status calculation you'd like to perform for {lotsList.find(l => l.id === showCalculatorSelection)?.nameOrNumber || 'this lot'}
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
            lotPrice={parseFloat(lotsList.find(l => l.id === showCalculator)?.price || '0')}
            lotName={lotsList.find(l => l.id === showCalculator)?.nameOrNumber || 'Lot'}
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
              <DialogDescription>
                Upload multiple lots from a CSV or Excel file
              </DialogDescription>
            </DialogHeader>

            {bulkUploadStep === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Upload File</h3>
                  <p className="text-gray-500 mb-4">
                    Choose a CSV or Excel file containing lot data
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="bulk-upload-file"
                    data-testid="bulk-upload-file-input"
                  />
                  <label htmlFor="bulk-upload-file" className="cursor-pointer">
                    <Button asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </span>
                    </Button>
                  </label>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                  <h4 className="font-medium mb-2 text-green-700">Required Columns:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
                    <li>Lot Name/Number - Unique identifier</li>
                  </ul>
                  <p className="text-sm text-amber-700 mb-4">💡 <strong>Note:</strong> Lots without Park Name/ID will be created as unassigned. You can assign them to parks later.</p>
                  <h4 className="font-medium mb-2 text-blue-700">Optional Columns:</h4>
                  <div className="grid md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Basic Info:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Park ID (alternative to Park Name)</li>
                        <li>Special Status</li>
                        <li>Description</li>
                        <li>Available Date (YYYY-MM-DD)</li>
                        <li>Showing Link</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Property Details:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Bedrooms</li>
                        <li>Bathrooms</li>
                        <li>Sq Ft</li>
                        <li>House Manufacturer</li>
                        <li>House Model</li>
                        <li>Mobile Home Year</li>
                        <li>Mobile Home Size</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Pricing (Rent):</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Price For Rent</li>
                        <li>Deposit For Rent</li>
                        <li>Lot Rent</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Pricing (Sale):</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Price For Sale</li>
                        <li>Deposit For Sale</li>
                        <li>Price Rent To Own</li>
                        <li>Deposit Rent To Own</li>
                        <li>Price Contract For Deed</li>
                        <li>Deposit Contract For Deed</li>
                        <li>Down Payment Contract For Deed</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Additional:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Promotional Price</li>
                        <li>Promotional Price Active (true/false)</li>
                        <li>Estimated Payment</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bulkUploadStep === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Map Columns</h3>
                  <p className="text-sm text-gray-500">
                    {parsedData.length} rows found
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Lot Fields</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {[
                        { field: 'nameOrNumber', label: 'Lot Name/Number *', required: true },
                        { field: 'parkName', label: 'Park Name (Optional)', required: false },
                        { field: 'parkId', label: 'Park ID (alternative to Park Name)', required: false },
                        { field: 'status', label: 'Status', required: false },
                        { field: 'specialStatus', label: 'Special Status', required: false },
                        { field: 'description', label: 'Description', required: false },
                        { field: 'availableDate', label: 'Available Date', required: false },
                        { field: 'showingLink', label: 'Showing Link', required: false },
                        { field: 'bedrooms', label: 'Bedrooms', required: false },
                        { field: 'bathrooms', label: 'Bathrooms', required: false },
                        { field: 'sqFt', label: 'Square Feet', required: false },
                        { field: 'houseManufacturer', label: 'House Manufacturer', required: false },
                        { field: 'houseModel', label: 'House Model', required: false },
                        { field: 'mobileHomeYear', label: 'Mobile Home Year', required: false },
                        { field: 'mobileHomeSize', label: 'Mobile Home Size', required: false },
                        { field: 'priceForRent', label: 'Price For Rent', required: false },
                        { field: 'priceForSale', label: 'Price For Sale', required: false },
                        { field: 'priceRentToOwn', label: 'Price Rent To Own', required: false },
                        { field: 'priceContractForDeed', label: 'Price Contract For Deed', required: false },
                        { field: 'depositForRent', label: 'Deposit For Rent', required: false },
                        { field: 'depositForSale', label: 'Deposit For Sale', required: false },
                        { field: 'depositRentToOwn', label: 'Deposit Rent To Own', required: false },
                        { field: 'depositContractForDeed', label: 'Deposit Contract For Deed', required: false },
                        { field: 'downPaymentContractForDeed', label: 'Down Payment Contract For Deed', required: false },
                        { field: 'lotRent', label: 'Lot Rent', required: false },
                        { field: 'promotionalPrice', label: 'Promotional Price', required: false },
                        { field: 'promotionalPriceActive', label: 'Promotional Price Active', required: false },
                        { field: 'estimatedPayment', label: 'Estimated Payment', required: false }
                      ].map(({ field, label, required }) => (
                        <div key={field} className="flex items-center justify-between p-2 border rounded">
                          <span className={required ? 'font-medium' : ''}>{label}</span>
                          <Select 
                            value={columnMapping[field] || ''} 
                            onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Skip</SelectItem>
                              {csvHeaders.map(header => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Data Preview</h4>
                    <div className="border rounded p-2 bg-gray-50 max-h-64 overflow-y-auto">
                      {parsedData.slice(0, 3).map((row, index) => (
                        <div key={index} className="mb-2 text-sm">
                          <strong>Row {index + 1}:</strong>
                          <pre className="mt-1 text-xs bg-white p-2 rounded">
                            {JSON.stringify(row, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setBulkUploadStep('upload')}>
                    Back
                  </Button>
                  <Button onClick={handleColumnMapping} data-testid="proceed-mapping">
                    Next: Preview Data
                  </Button>
                </div>
              </div>
            )}

            {bulkUploadStep === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Preview & Import</h3>
                  <p className="text-sm text-gray-500">
                    {mappedData.length} lots ready for import
                  </p>
                </div>
                
                <div className="border rounded max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name/Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Park</TableHead>
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
                          <TableCell>{lot.parkId || 'N/A'}</TableCell>
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
                    Processing {mappedData.length} lots
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
      </div>
    </div>
  );
}