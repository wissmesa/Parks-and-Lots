import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Ruler, DollarSign, Search, Star, MapPin } from "lucide-react";

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

export default function Lots() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [priceRange, setPriceRange] = useState("");

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    setSearchQuery(params.get('q') || '');
    setSelectedState(params.get('state') || '');
    setSelectedStatus(params.get('status') || '');
    setPriceRange(params.get('price') || '');
  }, [location]);

  const { data: lotsData, isLoading } = useQuery({
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

  const lots = (lotsData?.lots || []) as Lot[];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedState) params.set('state', selectedState);
    if (selectedStatus) params.set('status', selectedStatus);
    if (priceRange) params.set('price', priceRange);
    
    const queryString = params.toString();
    window.location.href = `/lots${queryString ? `?${queryString}` : ''}`;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedState("");
    setSelectedStatus("");
    setPriceRange("");
    window.location.href = "/lots";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading lots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Find Lots</h1>
          <p className="text-lg text-muted-foreground">
            Browse all available lots across our park communities
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <Input
                  placeholder="Search lots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  data-testid="input-lot-search"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="FOR_RENT">For Rent</SelectItem>
                  <SelectItem value="FOR_SALE">For Sale</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger data-testid="select-state">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="WA">Washington</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1" data-testid="button-apply-filters">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {lots.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">No lots found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or browse all available lots.
              </p>
              <Button onClick={clearFilters} variant="outline">
                View All Lots
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                Found {lots.length} lot{lots.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-6">
              {lots.map((lot: Lot) => (
                <Card key={lot.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-lot-${lot.id}`}>
                  <div className="flex">
                    {/* Preview Image */}
                    <div className="w-64 h-48 bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-muted-foreground text-sm">No image</span>
                    </div>
                    
                    {/* Lot Details */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between h-full">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="text-xl font-semibold text-foreground">{lot.nameOrNumber}</h3>
                            <Badge variant={lot.status === 'FOR_RENT' ? 'default' : 'secondary'}>
                              {lot.status === 'FOR_RENT' ? 'For Rent' : 'For Sale'}
                            </Badge>
                          </div>
                          
                          {/* Park Info */}
                          {lot.park && (
                            <div className="flex items-center text-muted-foreground mb-3">
                              <MapPin className="w-4 h-4 mr-2" />
                              <Link href={`/parks/${lot.park.id}`} className="hover:text-foreground">
                                {lot.park.name} - {lot.park.city}, {lot.park.state}
                              </Link>
                            </div>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-4">
                            {lot.bedrooms && (
                              <div className="flex items-center">
                                <Bed className="w-4 h-4 mr-2" />
                                {lot.bedrooms} bed
                              </div>
                            )}
                            {lot.bathrooms && (
                              <div className="flex items-center">
                                <Bath className="w-4 h-4 mr-2" />
                                {lot.bathrooms} bath
                              </div>
                            )}
                            {lot.sqFt && (
                              <div className="flex items-center">
                                <Ruler className="w-4 h-4 mr-2" />
                                {lot.sqFt.toLocaleString()} sq ft
                              </div>
                            )}
                            <div className="flex items-center font-semibold text-foreground">
                              <DollarSign className="w-4 h-4 mr-2" />
                              ${parseFloat(lot.price).toLocaleString()}{lot.status === 'FOR_RENT' ? '/mo' : ''}
                            </div>
                          </div>
                          
                          <p className="text-muted-foreground">
                            {lot.description || "Spacious unit with modern amenities"}
                          </p>
                        </div>
                        
                        <Link href={`/lots/${lot.id}`}>
                          <Button className="ml-6" data-testid={`button-book-showing-${lot.id}`}>
                            Book Showing
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}