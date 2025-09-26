import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Bed, 
  Bath, 
  Ruler, 
  DollarSign, 
  Search, 
 
  MapPin, 
  Home,
  ArrowRight,
  TreePine 
} from "lucide-react";
import { useFirstLotPhoto } from "@/hooks/use-lot-photos";
import { ParkCard } from "@/components/ui/park-card";

// Lot preview image component for card layout
function LotPreviewImageCard({ lotId }: { lotId: string }) {
  const { firstPhoto, hasPhotos, isLoading } = useFirstLotPhoto(lotId);
  
  if (isLoading) {
    return (
      <div className="h-48 bg-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (hasPhotos && firstPhoto) {
    return (
      <div className="h-48 overflow-hidden">
        <img 
          src={firstPhoto.urlOrPath || firstPhoto.url}
          alt="Lot preview"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  
  // Fallback placeholder when no photos
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
  const [priceRange, setPriceRange] = useState("");

  // Parse URL parameters and set search immediately
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const urlSearchQuery = params.get('q') || '';
    const urlState = params.get('state') || '';
    const urlStatus = params.get('status') || '';
    const urlPrice = params.get('price') || '';
    
    setSearchInput(urlSearchQuery);
    setSearchQuery(urlSearchQuery); // Set immediately for URL params
    setSelectedState(urlState);
    setSelectedStatus(urlStatus);
    setPriceRange(urlPrice);
  }, [location]);

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

  // Parks data
  const { data: parksData, isLoading: parksLoading } = useQuery({
    queryKey: ["/api/parks", searchQuery, selectedState, selectedStatus, priceRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      if (priceRange && priceRange !== 'all') params.set('price', priceRange);
      
      const url = `/api/parks${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Lots data
  const { data: lotsData, isLoading: lotsLoading } = useQuery({
    queryKey: ["/api/lots", searchQuery, selectedState, selectedStatus, priceRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      if (priceRange && priceRange !== 'all') params.set('price', priceRange);
      
      const url = `/api/public/lots${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const parks = parksData?.parks || [];
  const lots = (lotsData?.lots || []) as Lot[];

  const handleSearch = () => {
    // Update search query immediately to trigger API calls
    setSearchQuery(searchInput.trim());
    
    // Also update the URL for consistency
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('q', searchInput.trim());
    if (selectedState && selectedState !== 'all') params.set('state', selectedState);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    if (priceRange && priceRange !== 'all') params.set('price', priceRange);
    
    const queryString = params.toString();
    window.history.pushState(null, '', `/properties${queryString ? `?${queryString}` : ''}`);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedState("");
    setSelectedStatus("");
    setPriceRange("");
    window.history.pushState(null, '', `/properties`);
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
                <div className="lg:col-span-2">
                  <Input
                    placeholder="Search parks and lots..."
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
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                  </SelectContent>
                </Select>

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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="0-100000">Under $100k</SelectItem>
                    <SelectItem value="100000-200000">$100k - $200k</SelectItem>
                    <SelectItem value="200000-300000">$200k - $300k</SelectItem>
                    <SelectItem value="300000+">Over $300k</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parks Section */}
        {parks.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Home className="w-6 h-6 mr-2" />
              Parks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {parks.map((park: Park) => (
                <ParkCard key={park.id} park={park} />
              ))}
            </div>
          </div>
        )}

        {/* Lots Section */}
        {lots.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <MapPin className="w-6 h-6 mr-2" />
              Available Lots
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
                      <div className="flex items-center text-2xl font-bold text-primary">
                        <DollarSign className="w-6 h-6 mr-1" />
                        <span>{parseInt(lot.price).toLocaleString()}</span>
                        {(() => {
                          const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                          return statusArray.includes('FOR_RENT') ? <span className="text-lg ml-1">/mo</span> : null;
                        })()}
                      </div>
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
          </div>
        )}

        {/* No Results */}
        {parks.length === 0 && lots.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Home className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}