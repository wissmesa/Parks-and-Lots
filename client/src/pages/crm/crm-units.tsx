import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, DollarSign, Bed, Bath, Search } from "lucide-react";
import { AuthManager } from "@/lib/auth";

interface Unit {
  id: string;
  nameOrNumber: string;
  status: string[] | null;
  priceForRent?: string | null;
  priceForSale?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkId?: string | null;
}

export default function CrmUnits() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");

  const { data: unitsData, isLoading } = useQuery({
    queryKey: ["/api/crm/units"],
    queryFn: async () => {
      const res = await fetch("/api/crm/units", { 
        headers: AuthManager.getAuthHeaders(),
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const units: Unit[] = unitsData?.units || [];

  // Filter units by search query
  const filteredUnits = units.filter((unit) =>
    unit.nameOrNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort units
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return a.nameOrNumber.localeCompare(b.nameOrNumber);
      case "name-desc":
        return b.nameOrNumber.localeCompare(a.nameOrNumber);
      case "price-high":
        const aPrice = parseFloat(a.priceForSale || a.priceForRent || "0");
        const bPrice = parseFloat(b.priceForSale || b.priceForRent || "0");
        return bPrice - aPrice;
      case "price-low":
        const aPriceLow = parseFloat(a.priceForSale || a.priceForRent || "0");
        const bPriceLow = parseFloat(b.priceForSale || b.priceForRent || "0");
        return aPriceLow - bPriceLow;
      default:
        return 0;
    }
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Units / Lots</h1>
        <p className="text-muted-foreground">View all available units and lots</p>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Unit Number (A-Z)</SelectItem>
            <SelectItem value="name-desc">Unit Number (Z-A)</SelectItem>
            <SelectItem value="price-high">Price (High to Low)</SelectItem>
            <SelectItem value="price-low">Price (Low to High)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedUnits.map((unit) => (
            <Card 
              key={unit.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`/crm/units/${unit.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Unit {unit.nameOrNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {unit.status && unit.status.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unit.status.map((s, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary"
                      >
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {unit.priceForRent && (
                    <div className="flex items-center gap-1 text-green-600 font-semibold">
                      <DollarSign className="h-4 w-4" />
                      {parseFloat(unit.priceForRent).toLocaleString()}/mo
                    </div>
                  )}
                  {unit.priceForSale && (
                    <div className="flex items-center gap-1 text-blue-600 font-semibold">
                      <DollarSign className="h-4 w-4" />
                      {parseFloat(unit.priceForSale).toLocaleString()}
                    </div>
                  )}
                </div>

                {(unit.bedrooms || unit.bathrooms) && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {unit.bedrooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {unit.bedrooms} bed
                      </div>
                    )}
                    {unit.bathrooms && (
                      <div className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        {unit.bathrooms} bath
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && sortedUnits.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No units found</h3>
          <p className="text-muted-foreground">Units will appear here once they are added to your parks</p>
        </div>
      )}
    </div>
  );
}

