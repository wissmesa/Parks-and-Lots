import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Ruler, DollarSign } from "lucide-react";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: 'FOR_RENT' | 'FOR_SALE';
  price: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqFt?: number;
}

interface LotCardProps {
  lot: Lot;
  showBookButton?: boolean;
}

export function LotCard({ lot, showBookButton = true }: LotCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow" data-testid={`card-lot-${lot.id}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-semibold text-foreground">{lot.nameOrNumber}</h4>
            <Badge variant={lot.status === 'FOR_RENT' ? 'default' : 'secondary'}>
              {lot.status === 'FOR_RENT' ? 'For Rent' : 'For Sale'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-3">
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
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              ${parseFloat(lot.price).toLocaleString()}{lot.status === 'FOR_RENT' ? '/mo' : ''}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {lot.description || "Contact us for more details about this property."}
          </p>
        </div>
        {showBookButton && (
          <Link href={`/lots/${lot.id}`}>
            <Button className="ml-4" data-testid={`button-book-showing-${lot.id}`}>
              Book Showing
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
