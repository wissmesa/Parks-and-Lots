import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  ChevronRight, 
  Home, 
 
  MapPin, 
  Bed, 
  Bath, 
  Ruler, 
  DollarSign,
  Waves,
  Dumbbell,
  TreePine,
  Car,
  Shield,
  Users,
  Phone,
  Mail,
  Edit,
  Plus,
  X,
  Save,
  Check
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFirstLotPhoto } from "@/hooks/use-lot-photos";
import type { Park } from "@shared/schema";

// Lot preview image component
function LotPreviewImage({ lotId }: { lotId: string }) {
  const { firstPhoto, hasPhotos, isLoading } = useFirstLotPhoto(lotId);
  
  if (isLoading) {
    return (
      <div className="w-48 h-32 bg-muted flex items-center justify-center flex-shrink-0">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (hasPhotos && firstPhoto) {
    return (
      <div className="w-48 h-32 flex-shrink-0 overflow-hidden">
        <img 
          src={firstPhoto.urlOrPath || firstPhoto.url}
          alt="Lot preview"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  
  // Fallback placeholder when no photos
  return (
    <div className="w-48 h-32 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center flex-shrink-0">
      <div className="text-center">
        <Home className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
        <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">Lot Preview</span>
      </div>
    </div>
  );
}


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

// Icon mapping for common amenities
const amenityIcons: Record<string, any> = {
  'Swimming Pool': Waves,
  'Fitness Center': Dumbbell,
  'Walking Trails': TreePine,
  'Playground': Home,
  'Parking': Car,
  'Security': Shield,
};

function AmenitiesCard({ park }: { park: Park | undefined }) {
  // Early return if park is not loaded
  if (!park || !park.id) {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Amenities</h3>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Amenities</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {park.amenities && park.amenities.length > 0 ? park.amenities.map((amenity, index) => {
            const IconComponent = amenityIcons[amenity] || Check;
            return (
              <div key={index} className="flex items-center text-sm" data-testid={`amenity-${index}`}>
                <IconComponent className="w-4 h-4 mr-2 text-primary" />
                {amenity}
              </div>
            );
          }) : (
            <div className="col-span-2 text-center text-muted-foreground py-4">
              No amenities listed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParkDetail() {
  const { id } = useParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");

  const { data: park, isLoading: parkLoading } = useQuery<Park>({
    queryKey: ["/api/parks", id],
    enabled: !!id,
  });

  const { data: lotsData, isLoading: lotsLoading } = useQuery({
    queryKey: ["/api/lots", id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (id) params.set('parkId', id);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      
      const url = `/api/lots${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    enabled: !!id,
  });

  const { data: photos } = useQuery({
    queryKey: ["/api/parks", id, "photos"],
    enabled: !!id,
  });

  const lots = (lotsData?.lots || []) as Lot[];
  const parkPhotos = (photos || []) as any[];

  if (parkLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading park details...</p>
        </div>
      </div>
    );
  }

  if (!park) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Park not found</h2>
            <p className="text-muted-foreground mb-4">The park you're looking for doesn't exist.</p>
            <Link href="/parks">
              <Button>Browse Parks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredLots = lots.filter((lot: Lot) => {
    if (sizeFilter === "small" && (lot.bedrooms || 0) > 2) return false;
    if (sizeFilter === "large" && (lot.bedrooms || 0) < 3) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-foreground">Home</Link></li>
            <li><ChevronRight className="w-4 h-4" /></li>
            <li><Link href="/parks" className="hover:text-foreground">Parks</Link></li>
            <li><ChevronRight className="w-4 h-4" /></li>
            <li className="text-foreground">{(park as Park)?.name || 'Unknown Park'}</li>
          </ol>
        </nav>

        {/* Park Header */}
        <div className="mb-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-foreground">{(park as Park)?.name || 'Unknown Park'}</h1>
          </div>
          <p className="text-muted-foreground flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            {(park as Park)?.address || ''}, {(park as Park)?.city || ''}, {(park as Park)?.state || ''} {(park as Park)?.zip || ''}
          </p>
        </div>

        {/* Photo Gallery */}
        {parkPhotos.length > 0 ? (
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-xl overflow-hidden">
              <div className="lg:row-span-2">
                <img 
                  src={parkPhotos[0]?.urlOrPath} 
                  alt="Park main view"
                  className="w-full h-64 lg:h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                {parkPhotos.slice(1, 5).map((photo, index) => (
                  <img 
                    key={photo.id}
                    src={photo.urlOrPath} 
                    alt={photo.caption || `Park view ${index + 2}`}
                    className="w-full h-32 object-cover"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 h-64 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <TreePine className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-green-700 dark:text-green-300 font-medium">Beautiful Park Community</p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">Photos coming soon</p>
            </div>
          </div>
        )}

        {/* Park Info and Available Lots */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Park Details */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">About This Park</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {(park as Park)?.description || "A premium residential community offering luxury living with modern amenities and beautiful surroundings."}
                </p>
              </CardContent>
            </Card>

            {/* Available Lots */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Available Lots</h3>
                  <div className="flex items-center space-x-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All Lots" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Lots</SelectItem>
                        <SelectItem value="FOR_RENT">For Rent</SelectItem>
                        <SelectItem value="FOR_SALE">For Sale</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sizeFilter} onValueChange={setSizeFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Any Size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Size</SelectItem>
                        <SelectItem value="small">1-2 BR</SelectItem>
                        <SelectItem value="large">3+ BR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {lotsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading lots...</p>
                  </div>
                ) : filteredLots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No lots available with current filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLots.map((lot: Lot) => (
                      <Link key={lot.id} href={`/lots/${lot.id}`} className="block" data-testid={`link-lot-${lot.id}`}>
                        <div className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-lot-${lot.id}`}>
                          <div className="flex">
                            {/* Preview Image */}
                            <LotPreviewImage lotId={lot.id} />
                            
                            {/* Lot Details */}
                            <div className="flex-1 p-4">
                              <div className="flex items-start justify-between h-full">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="font-semibold text-foreground">{lot.nameOrNumber}</h4>
                                    <Badge variant={lot.status === 'FOR_RENT' ? 'default' : lot.status === 'FOR_SALE' ? 'secondary' : 'outline'}>
                                      {lot.status === 'FOR_RENT' ? 'For Rent' : lot.status === 'FOR_SALE' ? 'For Sale' : 'Rent/Sale'}
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
                                    {lot.description || "Spacious unit with modern amenities"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Park Information Sidebar */}
          <div className="space-y-6">
            {/* Amenities */}
            <AmenitiesCard park={park} />

            {/* Contact Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Park Manager</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-3 text-muted-foreground" />
                    <span>Park Management</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
                    <span>manager@park.com</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
                    <span>(555) 123-4567</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Lots</span>
                    <span className="font-medium">{lots.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium text-accent">{lots.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price Range</span>
                    <span className="font-medium">
                      {lots.length > 0 ? 
                        `$${Math.min(...lots.map((l: Lot) => parseFloat(l.price))).toLocaleString()} - $${Math.max(...lots.map((l: Lot) => parseFloat(l.price))).toLocaleString()}` 
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
