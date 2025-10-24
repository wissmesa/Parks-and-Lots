import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TreePine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  availableLotsCount?: number;
}

interface ParkCardProps {
  park: Park;
  showBookingLink?: boolean;
}

export function ParkCard({ park, showBookingLink = true }: ParkCardProps) {
  const { data: photos } = useQuery({
    queryKey: ["/api/parks", park.id, "photos"],
  });
  const [imageError, setImageError] = useState(false);

  const parkPhotos = Array.isArray(photos) ? photos : [];
  const hasPhotos = parkPhotos.length > 0 && !imageError;

  // Debug logging
  if (parkPhotos.length > 0) {
    console.log(`Park ${park.name} (${park.id}) has ${parkPhotos.length} photos:`, parkPhotos.map(p => p.urlOrPath));
  }

  const handleImageError = () => {
    console.error('Failed to load park image:', parkPhotos[0]?.urlOrPath);
    console.error('Park ID:', park.id, 'Park name:', park.name);
    setImageError(true);
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-park-${park.id}`}>
      <div className="h-48 relative overflow-hidden">
        {hasPhotos ? (
          <img 
            src={parkPhotos[0].urlOrPath} 
            alt={`${park.name} preview`}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 flex items-center justify-center">
            <div className="text-center">
              <TreePine className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <span className="text-green-700 dark:text-green-300 font-medium text-sm">Park Community</span>
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-6">
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-foreground">{park.name}</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-3">
          {park.city}, {park.state}
        </p>
        <p className="text-foreground text-sm mb-4 line-clamp-2">
          {park.description || "Premium community with modern amenities"}
        </p>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Available Homes {park.availableLotsCount !== undefined ? `(${park.availableLotsCount})` : ''}
          </div>
          {showBookingLink && (
            <Link href={`/parks/${park.id}`}>
              <Button variant="ghost" size="sm" className="text-primary hover:bg-accent hover:text-accent-foreground" data-testid={`link-park-details-${park.id}`}>
                View Details <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
