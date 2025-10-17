import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Ruler, DollarSign } from "lucide-react";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
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
    <Link href={`/lots/${lot.id}`} className="block">
      <div className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-lot-${lot.id}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h4 className="font-semibold text-foreground">{lot.nameOrNumber}</h4>
              <div className="flex flex-wrap gap-1">
                {(() => {
                  // Handle both array and single status formats
                  const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                  return statusArray.length > 0 ? statusArray.map((s, index) => (
                    <Badge key={index} variant="secondary">
                      {s === 'FOR_RENT' ? 'For Rent' : s === 'FOR_SALE' ? 'For Sale' : s === 'RENT_TO_OWN' ? 'Rent to Own' : 'Contract for Deed'}
                    </Badge>
                  )) : (
                    <Badge variant="secondary">No Status</Badge>
                  );
                })()}
              </div>
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
                ${parseFloat(lot.price).toLocaleString()}{(() => {
                  const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                  return statusArray.includes('FOR_RENT') || statusArray.includes('RENT_TO_OWN') ? '/mo' : '';
                })()}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {lot.description || "Contact us for more details about this property."}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
