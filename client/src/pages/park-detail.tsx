import { useState } from "react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFirstLotPhoto } from "@/hooks/use-lot-photos";
import type { Park } from "@shared/schema";

// Lot preview image component
function LotPreviewImage({ lotId }: { lotId: string }) {
  const { firstPhoto, hasPhotos, isLoading } = useFirstLotPhoto(lotId);
  const [imageError, setImageError] = useState(false);
  
  if (isLoading) {
    return (
      <div className="w-48 h-32 bg-muted flex items-center justify-center flex-shrink-0">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (hasPhotos && firstPhoto && !imageError) {
    return (
      <div className="w-48 h-32 flex-shrink-0 overflow-hidden">
        <img 
          src={firstPhoto.urlOrPath || firstPhoto.url}
          alt="Lot preview"
          className="w-full h-full object-cover"
          onError={() => {
            console.error('Failed to load lot image:', firstPhoto.urlOrPath || firstPhoto.url);
            setImageError(true);
          }}
        />
      </div>
    );
  }
  
  // Fallback placeholder when no photos or image error
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
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
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
                      <Link key={lot.id} href={`/lots/${lot.id}`} className="block" data-testid={`link-lot-${lot.id}`}>
                        <div className="border border-border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer bg-card" data-testid={`card-lot-${lot.id}`}>
                          <div className="flex flex-col sm:flex-row">
                            {/* Preview Image */}
                            <div className="w-full sm:w-48 h-48 sm:h-auto flex-shrink-0">
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
                                    <DollarSign className="w-6 h-6 mr-1" />
                                    <span>{parseFloat(lot.price).toLocaleString()}</span>
                                    {(() => {
                                      const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                                      return statusArray.includes('FOR_RENT') ? <span className="text-lg ml-1">/mo</span> : null;
                                    })()}
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
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground leading-relaxed">
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
