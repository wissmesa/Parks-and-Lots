import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DollarSign, Bed, Bath } from "lucide-react";
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Units / Lots</h1>
        <p className="text-muted-foreground">View all available units and lots</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <Card key={unit.id} className="hover:shadow-md transition-shadow cursor-pointer">
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

      {!isLoading && units.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No units found</h3>
          <p className="text-muted-foreground">Units will appear here once they are added to your parks</p>
        </div>
      )}
    </div>
  );
}

