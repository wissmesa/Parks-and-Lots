import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Star, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
}

export default function Home() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  // Auto-redirect authenticated users to their respective panels
  if (user?.role === 'MHP_LORD') {
    window.location.href = '/admin';
    return null;
  }
  
  if (user?.role === 'ADMIN') {
    window.location.href = '/manager';
    return null;
  }
  
  if (user?.role === 'MANAGER') {
    window.location.href = '/manager';
    return null;
  }

  if (user?.role === 'TENANT') {
    window.location.href = '/tenant';
    return null;
  }

  const { data: parksData } = useQuery({
    queryKey: ["/api/parks", "limit-6"],
    queryFn: async () => {
      const response = await fetch('/api/parks?limit=6', { credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const featuredParks = parksData?.parks || [];

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setLocation(`/properties?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div 
          className="h-96 bg-cover bg-center relative"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080')"
          }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white max-w-4xl px-4">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Find Your Perfect Property</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">Discover premium parks and lots for rent or sale</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search by location, park name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full text-foreground bg-background border-input placeholder:text-muted-foreground"
                    data-testid="input-search"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 px-8"
                  data-testid="button-search"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Parks Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Featured Parks</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our carefully curated selection of premium parks and communities
            </p>
          </div>
          
          {featuredParks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No parks available at the moment.</p>
              <p className="text-muted-foreground">Check back soon for new listings!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredParks.map((park: Park) => (
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
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          View Details <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
