import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TreePine, MapPin } from "lucide-react";

interface Park {
  id: string;
  name: string;
  city?: string;
  state?: string;
  company?: {
    name: string;
  };
}

interface Assignment {
  id: string;
  parkId: string;
  parkName: string;
  parkCity?: string;
  parkState?: string;
  company?: {
    name: string;
  };
}

interface ManagedParksDisplayProps {
  parks: Park[] | Assignment[];
  title: string;
  emptyMessage: string;
  isAssignment?: boolean; // true if parks are from assignments, false if direct park objects
  className?: string;
}

export function ManagedParksDisplay({ 
  parks, 
  title, 
  emptyMessage, 
  isAssignment = false,
  className = ""
}: ManagedParksDisplayProps) {
  if (!parks || parks.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TreePine className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {parks.map((park) => {
            const parkData = isAssignment ? park as Assignment : park as Park;
            const parkName = isAssignment ? parkData.parkName : parkData.name;
            const parkCity = isAssignment ? parkData.parkCity : parkData.city;
            const parkState = isAssignment ? parkData.parkState : parkData.state;

            return (
              <div key={parkData.id} className="border border-border rounded-lg p-2 hover:bg-muted/50 transition-colors">
                <h4 className="font-medium text-sm line-clamp-1 mb-1">{parkName}</h4>
                {(parkCity || parkState) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {[parkCity, parkState].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
