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
  status: 'FOR_RENT' | 'FOR_SALE' | 'RENT_SALE';
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
    queryKey: ["/api/parks", searchQuery, selectedState],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      
      const url = `/api/parks${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
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
      
      const url = `/api/lots${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
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
                    <SelectItem value="RENT_SALE">Rent/Sale</SelectItem>
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
                <Card key={park.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="h-48 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 flex items-center justify-center">
                    <div className="text-center">
                      <TreePine className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <span className="text-green-700 dark:text-green-300 font-medium text-sm">Park Community</span>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{park.name}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-3 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {park.city}, {park.state}
                    </p>
                    <p className="text-foreground text-sm mb-4 line-clamp-2">
                      {park.description || "Premium community with modern amenities"}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Available lots
                      </div>
                      <Link href={`/parks/${park.id}`}>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          View Details <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
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
                <Card key={lot.id} className="hover:shadow-lg transition-shadow">
                  <LotPreviewImageCard lotId={lot.id} />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold">{lot.nameOrNumber}</h3>
                      <Badge variant={lot.status === 'FOR_RENT' ? 'default' : 'secondary'}>
                        {lot.status === 'FOR_RENT' ? 'For Rent' : 'For Sale'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center text-muted-foreground text-sm mb-3">
                      <MapPin className="w-4 h-4 mr-1" />
                      {lot.park ? `${lot.park.name}, ${lot.park.city}` : 'Location not specified'}
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-3">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold text-lg">${parseInt(lot.price).toLocaleString()}</span>
                    </div>
                    
                    {(lot.bedrooms || lot.bathrooms || lot.sqFt) && (
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                        {lot.bedrooms && (
                          <div className="flex items-center space-x-1">
                            <Bed className="w-4 h-4" />
                            <span>{lot.bedrooms}</span>
                          </div>
                        )}
                        {lot.bathrooms && (
                          <div className="flex items-center space-x-1">
                            <Bath className="w-4 h-4" />
                            <span>{lot.bathrooms}</span>
                          </div>
                        )}
                        {lot.sqFt && (
                          <div className="flex items-center space-x-1">
                            <Ruler className="w-4 h-4" />
                            <span>{lot.sqFt} ft²</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {lot.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {lot.description}
                      </p>
                    )}
                    
                    <Link href={`/lots/${lot.id}`}>
                      <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
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