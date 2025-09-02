import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, ArrowRight, Search } from "lucide-react";
import { useState, useEffect } from "react";

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  companyId: string;
}


export default function Parks() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    setSearchQuery(params.get('q') || '');
    setSelectedState(params.get('state') || '');
    setSelectedCity(params.get('city') || '');
  }, [location]);

  const { data: parksData, isLoading } = useQuery({
    queryKey: ["/api/parks", searchQuery, selectedState, selectedCity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedState && selectedState !== 'all') params.set('state', selectedState);
      if (selectedCity && selectedCity !== 'all') params.set('city', selectedCity);
      
      const url = `/api/parks${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });


  const parks = parksData?.parks || [];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedState) params.set('state', selectedState);
    if (selectedCity) params.set('city', selectedCity);
    
    const queryString = params.toString();
    window.location.href = `/parks${queryString ? `?${queryString}` : ''}`;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedState("");
    setSelectedCity("");
    window.location.href = "/parks";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading parks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Browse Parks</h1>
          <p className="text-lg text-muted-foreground">
            Find the perfect park community for your needs
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Input
                  placeholder="Search parks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  data-testid="input-park-search"
                />
              </div>
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
        {parks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold mb-2">No parks found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or browse all available parks.
              </p>
              <Button onClick={clearFilters} variant="outline">
                View All Parks
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                Found {parks.length} park{parks.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {parks.map((park: Park) => (
                <Card key={park.id} className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-park-${park.id}`}>
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
                    <p className="text-muted-foreground text-sm mb-3">
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
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid={`link-park-details-${park.id}`}>
                          View Details <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
