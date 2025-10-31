import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  ChevronRight,
  ArrowRight,
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
  Check,
  Wifi,
  PawPrint,
  Bike,
  Bus,
  Flower2,
  Flame,
  Droplet,
  Recycle,
  Baby,
  Heart,
  ShoppingCart,
  Coffee,
  Utensils,
  Wind,
  Sun,
  Moon,
  Sparkles,
  Star,
  CircleParking,
  Calendar
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLotPhotos } from "@/hooks/use-lot-photos";
import type { Park } from "@shared/schema";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";

// Lot preview image component
function LotPreviewImage({ lotId }: { lotId: string }) {
  const { data: photos = [], isLoading } = useLotPhotos(lotId);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  
  if (isLoading) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center flex-shrink-0 relative">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  const validPhotos = photos.filter((_, index) => !imageErrors[index]);
  const hasPhotos = validPhotos.length > 0;
  
  if (hasPhotos) {
    return (
      <div className="w-full h-full flex-shrink-0 overflow-hidden relative group">
        <Carousel className="w-full h-full">
          <CarouselContent className="h-full m-0">
            {validPhotos.map((photo, index) => (
              <CarouselItem key={photo.id || index} className="p-0">
                <div className="w-full h-full relative">
                  <img 
                    src={photo.urlOrPath || photo.url}
                    alt={`Lot preview ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error('Failed to load lot image:', photo.urlOrPath || photo.url);
                      setImageErrors(prev => ({ ...prev, [index]: true }));
                    }}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {validPhotos.length > 1 && (
            <>
              <CarouselPrevious 
                type="button"
                className="bg-white/90 hover:bg-white border-2 border-gray-200 hover:border-primary transition-all shadow-lg hover:shadow-xl hover:scale-110 text-gray-800 hover:text-gray-800 z-30" 
              />
              <CarouselNext 
                type="button"
                className="bg-white/90 hover:bg-white border-2 border-gray-200 hover:border-primary transition-all shadow-lg hover:shadow-xl hover:scale-110 text-gray-800 hover:text-gray-800 z-30"
              />
            </>
          )}
        </Carousel>
        {/* Request Showing Button Overlay */}
        <div className="absolute bottom-3 right-3 z-20">
          <Link href={`/lots/${lotId}?booking=true`} onClick={(e) => e.stopPropagation()}>
            <Button 
              className="py-1.5 px-3 shadow-lg bg-blue-600/90 hover:bg-blue-600 text-xs h-auto"
              size="sm"
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Request a Showing
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // Fallback placeholder when no photos or all images failed to load
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center flex-shrink-0 relative">
      <div className="text-center">
        <Home className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
        <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Lot Preview</span>
      </div>
      {/* Request Showing Button Overlay */}
      <div className="absolute bottom-3 right-3 z-10">
        <Link href={`/lots/${lotId}?booking=true`} onClick={(e) => e.stopPropagation()}>
          <Button 
            className="py-1.5 px-3 shadow-lg bg-blue-600/90 hover:bg-blue-600 text-xs h-auto"
            size="sm"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Request a Showing
          </Button>
        </Link>
      </div>
    </div>
  );
}


interface Lot {
  id: string;
  nameOrNumber: string;
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
  price: string;
  priceForRent?: string;
  priceForSale?: string;
  priceRentToOwn?: string;
  priceContractForDeed?: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqFt?: number;
}

// Available amenity icons pool (20+ icons for users to choose from)
export const AMENITY_ICON_OPTIONS = [
  { value: 'waves', label: 'Pool/Water', icon: Waves },
  { value: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { value: 'treePine', label: 'Nature/Trees', icon: TreePine },
  { value: 'car', label: 'Parking', icon: Car },
  { value: 'circleParking', label: 'Parking Lot', icon: CircleParking },
  { value: 'shield', label: 'Security', icon: Shield },
  { value: 'wifi', label: 'WiFi', icon: Wifi },
  { value: 'pawPrint', label: 'Pet Friendly', icon: PawPrint },
  { value: 'bike', label: 'Biking', icon: Bike },
  { value: 'bus', label: 'Public Transit', icon: Bus },
  { value: 'flower2', label: 'Garden', icon: Flower2 },
  { value: 'flame', label: 'Heating', icon: Flame },
  { value: 'droplet', label: 'Water', icon: Droplet },
  { value: 'recycle', label: 'Recycling', icon: Recycle },
  { value: 'baby', label: 'Playground', icon: Baby },
  { value: 'heart', label: 'Healthcare', icon: Heart },
  { value: 'shoppingCart', label: 'Shopping', icon: ShoppingCart },
  { value: 'coffee', label: 'Cafe', icon: Coffee },
  { value: 'utensils', label: 'Dining', icon: Utensils },
  { value: 'wind', label: 'AC/Ventilation', icon: Wind },
  { value: 'sun', label: 'Solar Power', icon: Sun },
  { value: 'moon', label: 'Night Security', icon: Moon },
  { value: 'sparkles', label: 'Premium', icon: Sparkles },
  { value: 'star', label: 'Featured', icon: Star },
  { value: 'check', label: 'Default', icon: Check },
] as const;

// Helper to get icon component by value
export const getAmenityIcon = (iconValue?: string) => {
  const iconOption = AMENITY_ICON_OPTIONS.find(opt => opt.value === iconValue);
  return iconOption?.icon || Check; // Default icon if not found
};

// Type for amenity (supports both old string format and new object format)
export type AmenityType = string | { name: string; icon?: string };

function AvailableLotsCard({ totalLots, isLoading }: { totalLots: number; isLoading: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Available Homes</h3>
          <Home className="w-5 h-5 text-primary" />
        </div>
        
        <div className="text-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div>
              <div className="text-4xl font-bold text-primary mb-2">{totalLots}</div>
              <p className="text-sm text-muted-foreground">
                {totalLots === 1 ? 'home available' : 'homes available'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
          {park.amenities && park.amenities.length > 0 ? park.amenities.map((amenity: any, index) => {
            // Support both old format (string) and new format (object with icon)
            const amenityName = typeof amenity === 'string' ? amenity : amenity.name;
            const amenityIcon = typeof amenity === 'object' && amenity.icon ? amenity.icon : undefined;
            
            // Get the icon component (uses selected icon or default)
            const IconComponent = getAmenityIcon(amenityIcon);
            
            return (
              <div key={index} className="flex items-center text-sm" data-testid={`amenity-${index}`}>
                <IconComponent className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
                <span className="truncate">{amenityName}</span>
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
  const [bedroomFilter, setBedroomFilter] = useState<string>("all");
  const [bathroomFilter, setBathroomFilter] = useState<string>("all");

  const { data: park, isLoading: parkLoading } = useQuery<Park>({
    queryKey: ["/api/parks", id],
    enabled: !!id,
  });

  const { data: lotsData, isLoading: lotsLoading, error: lotsError } = useQuery({
    queryKey: ["/api/lots", id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (id) params.set('parkId', id);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      
      const url = `/api/public/lots${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Details:', {
          url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON Response:', {
          url,
          contentType,
          responseText: responseText.substring(0, 200) + '...'
        });
        throw new Error('Server returned non-JSON response. Please check server logs.');
      }
      
      return response.json();
    },
    enabled: !!id,
  });

  const { data: photos } = useQuery({
    queryKey: ["/api/parks", id, "photos"],
    enabled: !!id,
  });

  const lots = (lotsData?.lots || []) as Lot[];
  const totalLots = lotsData?.pagination?.total || 0;
  const parkPhotos = (photos || []) as any[];

  // Extract unique bedroom options from lots
  const availableBedrooms = useMemo(() => {
    const bedroomSet = new Set<number>();
    lots.forEach((lot: Lot) => {
      if (lot.bedrooms !== null && lot.bedrooms !== undefined) {
        bedroomSet.add(lot.bedrooms);
      }
    });
    return Array.from(bedroomSet).sort((a, b) => a - b);
  }, [lots]);

  // Extract unique bathroom options from lots
  const availableBathrooms = useMemo(() => {
    const bathroomSet = new Set<number>();
    lots.forEach((lot: Lot) => {
      if (lot.bathrooms !== null && lot.bathrooms !== undefined) {
        bathroomSet.add(lot.bathrooms);
      }
    });
    return Array.from(bathroomSet).sort((a, b) => a - b);
  }, [lots]);

  // Filter lots based on bedroom and bathroom selections
  const filteredLots = useMemo(() => {
    return lots.filter((lot: Lot) => {
      // Bedroom filter
      if (bedroomFilter !== "all") {
        const selectedBedrooms = parseInt(bedroomFilter);
        if (lot.bedrooms !== selectedBedrooms) {
          return false;
        }
      }
      
      // Bathroom filter
      if (bathroomFilter !== "all") {
        const selectedBathrooms = parseInt(bathroomFilter);
        if (lot.bathrooms !== selectedBathrooms) {
          return false;
        }
      }
      
      return true;
    });
  }, [lots, bedroomFilter, bathroomFilter]);

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
            {parkPhotos.length === 1 ? (
              /* Single photo takes full width */
              <div className="rounded-xl overflow-hidden">
                <img 
                  src={parkPhotos[0]?.urlOrPath} 
                  alt="Park main view"
                  className="w-full h-64 lg:h-96 object-cover"
                />
              </div>
            ) : (
              /* Multiple photos use grid layout */
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
            )}
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

            {/* Available Homes */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Available Homes</h3>
                  <div className="flex items-center space-x-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All Homes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Homes</SelectItem>
                        <SelectItem value="FOR_RENT">For Rent</SelectItem>
                        <SelectItem value="FOR_SALE">For Sale</SelectItem>
                        <SelectItem value="RENT_TO_OWN">Rent to Own</SelectItem>
                        <SelectItem value="CONTRACT_FOR_DEED">Contract for Deed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Bedrooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bedrooms</SelectItem>
                        {availableBedrooms.map((br) => (
                          <SelectItem key={br} value={br.toString()}>
                            {br} {br === 1 ? 'Bedroom' : 'Bedrooms'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={bathroomFilter} onValueChange={setBathroomFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Bathrooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bathrooms</SelectItem>
                        {availableBathrooms.map((ba) => (
                          <SelectItem key={ba} value={ba.toString()}>
                            {ba} {ba === 1 ? 'Bathroom' : 'Bathrooms'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {lotsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading lots...</p>
                  </div>
                ) : lotsError ? (
                  <div className="text-center py-8">
                    <p className="text-red-600">Error loading lots: {lotsError.message}</p>
                    <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
                  </div>
                ) : filteredLots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No lots available with current filters.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Found {lots.length} total lots for this park
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLots.map((lot: Lot) => (
                      <div key={lot.id} className="border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 bg-card" data-testid={`card-lot-${lot.id}`}>
                        <div className="flex flex-col sm:flex-row">
                          {/* Preview Image */}
                          <div className="w-full sm:w-96 h-80 sm:h-72 flex-shrink-0">
                            <LotPreviewImage lotId={lot.id} />
                          </div>
                          
                          {/* Lot Details */}
                          <div className="flex-1 p-4 sm:p-6">
                            <div className="flex flex-col h-full">
                              {/* Header Section - Lot Name */}
                              <div className="mb-3">
                                <h4 className="text-xl font-bold text-foreground mb-3">{lot.nameOrNumber}</h4>
                                
                                {/* Status badges - separate row for better spacing */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {(() => {
                                    // Handle both array and single status formats
                                    const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                                    return statusArray.length > 0 ? statusArray.map((s, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs font-medium px-3 py-1">
                                        {s === 'FOR_RENT' ? 'For Rent' : s === 'FOR_SALE' ? 'For Sale' : s === 'RENT_TO_OWN' ? 'Rent to Own' : 'Contract for Deed'}
                                      </Badge>
                                    )) : (
                                      <Badge variant="outline" className="text-xs px-3 py-1">No Status</Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                              
                              {/* Price - prominent display */}
                              <div className="mb-4">
                                <div className="flex items-center text-2xl font-bold text-primary">
                                  <span>
                                    {(() => {
                                      const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                                      
                                      // Show pricing based on status and availability
                                      if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                                        return `$${parseFloat(lot.priceForRent).toLocaleString()}/mo`;
                                      }
                                      if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                                        return `$${parseFloat(lot.priceForSale).toLocaleString()}`;
                                      }
                                      if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                                        return `$${parseFloat(lot.priceRentToOwn).toLocaleString()}/mo`;
                                      }
                                      if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                                        return `$${parseFloat(lot.priceContractForDeed).toLocaleString()}/mo`;
                                      }
                                      
                                      // Fallback to legacy price if no specific pricing is available
                                      if (lot.price) {
                                        const suffix = statusArray.includes('FOR_RENT') ? '/mo' : '';
                                        return `$${parseFloat(lot.price).toLocaleString()}${suffix}`;
                                      }
                                      
                                      return 'Price TBD';
                                    })()}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Property Details */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                                {lot.bedrooms && (
                                  <div className="flex items-center">
                                    <Bed className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span>{lot.bedrooms} bed{lot.bedrooms !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                                {lot.bathrooms && (
                                  <div className="flex items-center">
                                    <Bath className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span>{lot.bathrooms} bath{lot.bathrooms !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                                {lot.sqFt && (
                                  <div className="flex items-center">
                                    <Ruler className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span>{lot.sqFt.toLocaleString()} sq ft</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Description */}
                              <div className="flex-1 mb-4">
                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                                  {lot.description || "Spacious unit with modern amenities"}
                                </p>
                              </div>
                              
                              {/* View Details Button */}
                              <div className="mt-auto">
                                <Link href={`/lots/${lot.id}`} data-testid={`link-lot-${lot.id}`}>
                                  <Button className="w-full" variant="default">
                                    View Details
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Park Information Sidebar */}
          <div className="space-y-6">
            {/* Available Lots */}
            <AvailableLotsCard totalLots={totalLots} isLoading={lotsLoading} />

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

            
          </div>
        </div>
      </div>
    </div>
  );
}
