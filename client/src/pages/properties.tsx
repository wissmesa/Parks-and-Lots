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
  Star, 
  MapPin, 
  Home,
  ArrowRight 
} from "lucide-react";

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
  status: 'FOR_RENT' | 'FOR_SALE';
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

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const urlSearchQuery = params.get('q') || '';
    setSearchInput(urlSearchQuery);
    setSearchQuery(urlSearchQuery);
    setSelectedState(params.get('state') || '');
    setSelectedStatus(params.get('status') || '');
    setPriceRange(params.get('price') || '');
  }, [location]);

  // Debounced search function
  const debouncedSearch = useCallback(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Trigger debounced search when input changes
  useEffect(() => {
    const cleanup = debouncedSearch();
    return cleanup;
  }, [debouncedSearch]);

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
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('q', searchInput.trim());
    if (selectedState && selectedState !== 'all') params.set('state', selectedState);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    if (priceRange && priceRange !== 'all') params.set('price', priceRange);
    
    const queryString = params.toString();
    window.location.href = `/properties${queryString ? `?${queryString}` : ''}`;
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedState("");
    setSelectedStatus("");
    setPriceRange("");
    window.location.href = `/properties`;
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

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleSearch} 
                  className="flex-1 sm:flex-none bg-accent text-accent-foreground hover:bg-accent/90"
                  data-testid="button-search"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
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
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{park.name}</h3>
                      <div className="flex items-center text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="ml-1 text-sm text-muted-foreground">4.8</span>
                      </div>
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
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
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