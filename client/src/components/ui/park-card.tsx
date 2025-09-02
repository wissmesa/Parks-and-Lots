import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ArrowRight } from "lucide-react";

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
}

interface ParkCardProps {
  park: Park;
  showBookingLink?: boolean;
}

export function ParkCard({ park, showBookingLink = true }: ParkCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-park-${park.id}`}>
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
          {showBookingLink && (
            <Link href={`/parks/${park.id}`}>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" data-testid={`link-park-details-${park.id}`}>
                View Details <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
