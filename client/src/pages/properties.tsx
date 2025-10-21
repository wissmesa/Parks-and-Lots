import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Bed, 
  Bath, 
  Ruler, 
  DollarSign, 
  Search, 
  
  MapPin, 
  Home,
  ArrowRight,
  TreePine,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info
} from "lucide-react";
import { useFirstLotPhoto } from "@/hooks/use-lot-photos";
import { ParkCard } from "@/components/ui/park-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Lot preview image component for card layout
function LotPreviewImageCard({ lotId }: { lotId: string }) {
  const { firstPhoto, hasPhotos, isLoading } = useFirstLotPhoto(lotId);
  const [imageError, setImageError] = useState(false);
  
  if (isLoading) {
    return (
      <div className="h-48 bg-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (hasPhotos && firstPhoto && !imageError) {
    return (
      <div className="h-48 overflow-hidden">
        <img 
          src={firstPhoto.urlOrPath || firstPhoto.url}
          alt="Lot preview"
          className="w-full h-full object-cover"
          onError={() => {
            console.error('Failed to load lot image:', firstPhoto.urlOrPath || firstPhoto.url);
            setImageError(true);
          }}
        />
      </div>
    );
  }
  
  // Fallback placeholder when no photos or image error
  return (
    <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center">
      <div className="text-center">
        <Home className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
        <span className="text-blue-700 dark:text-blue-300 font-medium text-sm">Lot Details</span>
      </div>
    </div>
  );
}

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  companyId: string;
}

interface Lot {
  id: string;
  nameOrNumber: string;
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
  price: string;
  priceForRent?: string | null;
  priceForSale?: string | null;
  priceRentToOwn?: string | null;
  priceContractForDeed?: string | null;
  lotRent?: string | null;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqFt: number | null;
  isActive: boolean;
  parkId: string;
  park?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
}

export default function Properties() {
  const [location] = useLocation();
  const [searchInput, setSearchInput] = useState(""); // Input field state
  const [searchQuery, setSearchQuery] = useState(""); // Actual search query for API
  const [selectedState, setSelectedState] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [activeTab, setActiveTab] = useState("parks");
  
  // Pagination state for lots
  const [lotsCurrentPage, setLotsCurrentPage] = useState(1);
  const [lotsItemsPerPage, setLotsItemsPerPage] = useState(20);
  
  // Pagination state for parks
  const [parksCurrentPage, setParksCurrentPage] = useState(1);
  const [parksItemsPerPage, setParksItemsPerPage] = useState(20);

  // Parse URL parameters and set search immediately (only on initial load)
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const urlSearchQuery = params.get('q') || '';
    const urlState = params.get('state') || '';
    const urlStatus = params.get('status') || '';
    const urlTab = params.get('tab') || 'parks';
    const urlPage = params.get('page') || '1';
    
    setSearchInput(urlSearchQuery);
    setSearchQuery(urlSearchQuery); // Set immediately for URL params
    setSelectedState(urlState);
    setSelectedStatus(urlStatus);
    setActiveTab(urlTab);
    
    if (urlTab === 'parks') {
      setParksCurrentPage(parseInt(urlPage));
    } else {
      setLotsCurrentPage(parseInt(urlPage));
    }
  }, []); // Only run once on mount, not on every location change

  // Debounced search function - only for manual input changes
  const debouncedSearch = useCallback(() => {
    // If search input is empty, clear immediately (no delay)
    if (searchInput.trim() === '') {
      setSearchQuery('');
      return () => {};
    }
    
    // Otherwise, debounce the search
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Trigger debounced search when input changes
  useEffect(() => {
    const cleanup = debouncedSearch();
    return cleanup;
  }, [searchInput, debouncedSearch]);

  // Get all parks and lots for state filtering (without pagination)
  const { data: allParksData } = useQuery({
    queryKey: ["/api/parks/all"],
    queryFn: async () => {
      const response = await fetch('/api/parks?limit=1000');
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: allLotsData } = useQuery({
    queryKey: ["/api/public/lots/all"],
    queryFn: async () => {
      const response = await fetch('/api/public/lots?limit=1000');
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Parks data with pagination (status and price filters only apply to homes/lots)
  const { data: parksData, isLoading: parksLoading } = useQuery({
    queryKey: ["/api/parks", searchQuery, selectedState, parksCurrentPage, parksItemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      // Note: status and price filters are NOT applied to parks, only to homes/lots
      params.set('page', parksCurrentPage.toString());
      params.set('limit', parksItemsPerPage.toString());
      
      const url = `/api/parks?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Lots data with pagination
  const { data: lotsData, isLoading: lotsLoading } = useQuery({
    queryKey: ["/api/public/lots", searchQuery, selectedState, selectedStatus, lotsCurrentPage, lotsItemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      params.set('page', lotsCurrentPage.toString());
      params.set('limit', lotsItemsPerPage.toString());
      
      const url = `/api/public/lots?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const parks = parksData?.parks || [];
  const lots = (lotsData?.lots || []) as Lot[];
  const lotsPagination = lotsData?.pagination;
  const parksPagination = parksData?.pagination;

  // Get unique states from all parks and lots (not just paginated data)
  const allParks = allParksData?.parks || [];
  const allLots = allLotsData?.lots || [];
  const availableStates = Array.from(
    new Set([
      ...allParks.map((park: Park) => park.state),
      ...allLots.map((lot: Lot) => lot.park?.state).filter(Boolean)
    ])
  ).sort();

  // Reset to first page when filters change
  useEffect(() => {
    setLotsCurrentPage(1);
    setParksCurrentPage(1);
  }, [searchQuery, selectedState, selectedStatus]);

  // Clear search when switching tabs
  useEffect(() => {
    setSearchInput("");
    setSearchQuery("");
  }, [activeTab]);

  const handleSearch = () => {
    // Update search query immediately to trigger API calls
    setSearchQuery(searchInput.trim());
    
    // Also update the URL for consistency
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('q', searchInput.trim());
    if (selectedState && selectedState !== 'all') params.set('state', selectedState);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    params.set('tab', activeTab);
    params.set('page', '1'); // Reset to first page on search
    
    const queryString = params.toString();
    window.history.pushState(null, '', `/properties?${queryString}`);
  };

  const handleLotsPageChange = (newPage: number) => {
    setLotsCurrentPage(newPage);
  };

  const handleParksPageChange = (newPage: number) => {
    setParksCurrentPage(newPage);
  };

  const isLoading = parksLoading || lotsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Browse Properties</h1>
          <p className="text-lg text-muted-foreground">
            Find the perfect park community or individual lot for your needs
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={activeTab === 'parks' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                  <Input
                    placeholder="Search parks and homes..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    data-testid="input-properties-search"
                  />
                </div>
                
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {availableStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Only show Type filter for Homes tab */}
                {activeTab === 'lots' && (
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="FOR_RENT">For Rent</SelectItem>
                      <SelectItem value="FOR_SALE">For Sale</SelectItem>
                      <SelectItem value="RENT_TO_OWN">Rent to Own</SelectItem>
                      <SelectItem value="CONTRACT_FOR_DEED">Contract for Deed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Parks and Lots */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
         
            <TabsTrigger value="parks"  className="flex items-center gap-2 bg-white text-gray-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
>
              <TreePine className="w-4 h-4" />
              Parks
              {parksPagination?.total && <Badge variant="secondary" className="ml-2">{parksPagination.total}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="lots"  className="flex items-center gap-2 bg-white text-gray-900 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
>
              <MapPin className="w-4 h-4" />
              Homes
              {lotsPagination?.total && <Badge variant="secondary" className="ml-2">{lotsPagination.total}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Lots Tab Content */}
          <TabsContent value="lots">
            {lots.length > 0 ? (
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <MapPin className="w-6 h-6 mr-2" />
                  Available Homes
                </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lots.map((lot) => (
                <Card key={lot.id} className="hover:shadow-lg transition-all duration-200 bg-card">
                  <LotPreviewImageCard lotId={lot.id} />
                  <CardContent className="p-6">
                    {/* Header Section - Lot Name */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-foreground mb-3">{lot.nameOrNumber}</h3>
                      
                      {/* Status badges - separate row for better mobile layout */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(() => {
                          // Handle both array and single status formats
                          const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                          return statusArray.length > 0 ? statusArray.map((s, index) => (
                            <Badge key={index} variant="secondary" className="text-xs font-medium px-3 py-1">
                              {s === 'FOR_RENT' ? 'For Rent' : s === 'FOR_SALE' ? 'For Sale' : s === 'RENT_TO_OWN' ? 'Rent to Own' : 'Contract for Deed'}
                            </Badge>
                          )) : (
                            <Badge variant="outline" className="text-xs px-3 py-1">No Status</Badge>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center text-muted-foreground text-sm mb-4">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{lot.park ? `${lot.park.name}, ${lot.park.city}` : 'Location not specified'}</span>
                    </div>
                    
                    {/* Price - prominent display */}
                    <div className="mb-4">
                      {(() => {
                        const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                        const prices = [];
                        
                        // Show pricing based on status and availability
                        if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                          prices.push({ label: 'Rent', value: lot.priceForRent, suffix: '/mo', showTooltip: !!lot.lotRent });
                        }
                        if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                          prices.push({ label: 'Sale', value: lot.priceForSale, suffix: '', showTooltip: false });
                        }
                        if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                          prices.push({ label: 'Rent to Own', value: lot.priceRentToOwn, suffix: '/mo', showTooltip: false });
                        }
                        if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                          prices.push({ label: 'Contract', value: lot.priceContractForDeed, suffix: '/mo', showTooltip: false });
                        }
                        
                        // Fallback to legacy price if no specific pricing is available
                        if (prices.length === 0 && lot.price) {
                          prices.push({ label: 'Price', value: lot.price, suffix: statusArray.includes('FOR_RENT') ? '/mo' : '', showTooltip: false });
                        }
                        
                        return (
                          <div className="space-y-2">
                            {prices.map((price, index) => (
                              <div key={index} className="flex items-center text-xl font-bold text-primary">
                                <span>${parseInt(price.value).toLocaleString()}</span>
                                <span className="text-lg ml-1">{price.suffix}</span>
                                {prices.length > 1 && (
                                  <span className="text-sm ml-2 text-muted-foreground">({price.label})</span>
                                )}
                                {price.showTooltip && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="w-4 h-4 ml-2 cursor-help text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Lot rent included: ${parseFloat(lot.lotRent!).toLocaleString()}/mo</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            ))}
                            {lot.lotRent && (
                              <div className="text-sm text-muted-foreground">
                                Lot Rent: ${parseFloat(lot.lotRent).toLocaleString()}/mo
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Property Details */}
                    {(lot.bedrooms || lot.bathrooms || lot.sqFt) && (
                      <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                        {lot.bedrooms && (
                          <div className="flex items-center">
                            <Bed className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span>{lot.bedrooms} bed{lot.bedrooms !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {lot.bathrooms && (
                          <div className="flex items-center">
                            <Bath className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span>{lot.bathrooms} bath{lot.bathrooms !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {lot.sqFt && (
                          <div className="flex items-center">
                            <Ruler className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span>{lot.sqFt.toLocaleString()} sq ft</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Description */}
                    {lot.description && (
                      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed">
                        {lot.description}
                      </p>
                    )}
                    
                    {/* View Details Button */}
                    <Link href={`/lots/${lot.id}`}>
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2.5">
                        View Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
            
                {/* Pagination Controls for Lots */}
                {lotsPagination && (
                  <div className="mt-8 p-6 bg-muted/50 rounded-lg">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Page info with items per page selector */}
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Page {lotsPagination.currentPage} of {lotsPagination.totalPages} • Showing {lotsPagination.startItem}-{lotsPagination.endItem} of {lotsPagination.total} homes
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="lotsPerPage" className="text-sm text-muted-foreground whitespace-nowrap">Items per page:</Label>
                          <Select 
                            value={lotsItemsPerPage.toString()} 
                            onValueChange={(value) => {
                              setLotsItemsPerPage(Number(value));
                              setLotsCurrentPage(1); // Reset to first page when changing items per page
                            }}
                          >
                            <SelectTrigger id="lotsPerPage" className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Pagination buttons */}
                      <div className="flex items-center gap-2">
                        {/* First page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLotsPageChange(1)}
                          disabled={lotsCurrentPage <= 1}
                          className="hidden sm:flex"
                          type="button"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        
                        {/* Previous page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLotsPageChange(lotsCurrentPage - 1)}
                          disabled={lotsCurrentPage <= 1}
                          type="button"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        
                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {lotsPagination.pageNumbers?.map((pageNum: number) => (
                            <Button
                              key={pageNum}
                              variant={pageNum === lotsCurrentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLotsPageChange(pageNum)}
                              className="w-10 h-10"
                              type="button"
                            >
                              {pageNum}
                            </Button>
                          ))}
                        </div>
                        
                        {/* Next page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLotsPageChange(lotsCurrentPage + 1)}
                          disabled={lotsCurrentPage >= lotsPagination.totalPages}
                          type="button"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        
                        {/* Last page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLotsPageChange(lotsPagination.totalPages)}
                          disabled={lotsCurrentPage >= lotsPagination.totalPages}
                          className="hidden sm:flex"
                          type="button"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <MapPin className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Lots Found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            )}
          </TabsContent>

          {/* Parks Tab Content */}
          <TabsContent value="parks">
            {parks.length > 0 ? (
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <TreePine className="w-6 h-6 mr-2" />
                  Parks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {parks.map((park: Park) => (
                    <ParkCard key={park.id} park={park} />
                  ))}
                </div>

                {/* Pagination Controls for Parks */}
                {parksPagination && (
                  <div className="mt-8 p-6 bg-muted/50 rounded-lg">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Page info with items per page selector */}
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Page {parksPagination.currentPage} of {parksPagination.totalPages} • Showing {parksPagination.startItem}-{parksPagination.endItem} of {parksPagination.total} parks
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="parksPerPage" className="text-sm text-muted-foreground whitespace-nowrap">Items per page:</Label>
                          <Select 
                            value={parksItemsPerPage.toString()} 
                            onValueChange={(value) => {
                              setParksItemsPerPage(Number(value));
                              setParksCurrentPage(1); // Reset to first page when changing items per page
                            }}
                          >
                            <SelectTrigger id="parksPerPage" className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Pagination buttons */}
                      <div className="flex items-center gap-2">
                        {/* First page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleParksPageChange(1)}
                          disabled={parksCurrentPage <= 1}
                          className="hidden sm:flex"
                          type="button"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        
                        {/* Previous page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleParksPageChange(parksCurrentPage - 1)}
                          disabled={parksCurrentPage <= 1}
                          type="button"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        
                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {parksPagination.pageNumbers?.map((pageNum: number) => (
                            <Button
                              key={pageNum}
                              variant={pageNum === parksCurrentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleParksPageChange(pageNum)}
                              className="w-10 h-10"
                              type="button"
                            >
                              {pageNum}
                            </Button>
                          ))}
                        </div>
                        
                        {/* Next page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleParksPageChange(parksCurrentPage + 1)}
                          disabled={parksCurrentPage >= parksPagination.totalPages}
                          type="button"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        
                        {/* Last page */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleParksPageChange(parksPagination.totalPages)}
                          disabled={parksCurrentPage >= parksPagination.totalPages}
                          className="hidden sm:flex"
                          type="button"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <TreePine className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Parks Found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}