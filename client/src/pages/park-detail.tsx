import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronRight, 
  Home, 
  Star, 
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
  Mail
} from "lucide-react";
import { useState } from "react";

interface Park {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description?: string;
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

export default function ParkDetail() {
  const { id } = useParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");

  const { data: park, isLoading: parkLoading } = useQuery({
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading park details...</p>
        </div>
      </div>
    );
  }

  if (!park) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground">{(park as Park)?.name || 'Unknown Park'}</h1>
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-yellow-500">
                <Star className="w-5 h-5 fill-current" />
                <span className="ml-1 font-medium">4.8</span>
              </div>
              <span className="text-muted-foreground">(24 reviews)</span>
            </div>
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
          <div className="mb-8 h-64 bg-muted rounded-xl flex items-center justify-center">
            <p className="text-muted-foreground">No photos available</p>
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
                      <div key={lot.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow" data-testid={`card-lot-${lot.id}`}>
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
                              {lot.description || "Spacious unit with modern amenities"}
                            </p>
                          </div>
                          <Link href={`/lots/${lot.id}`}>
                            <Button className="ml-4" data-testid={`button-book-showing-${lot.id}`}>
                              Book Showing
                            </Button>
                          </Link>
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
            {/* Amenities */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Amenities</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center text-sm">
                    <Waves className="w-4 h-4 mr-2 text-primary" />
                    Swimming Pool
                  </div>
                  <div className="flex items-center text-sm">
                    <Dumbbell className="w-4 h-4 mr-2 text-primary" />
                    Fitness Center
                  </div>
                  <div className="flex items-center text-sm">
                    <TreePine className="w-4 h-4 mr-2 text-primary" />
                    Walking Trails
                  </div>
                  <div className="flex items-center text-sm">
                    <Home className="w-4 h-4 mr-2 text-primary" />
                    Playground
                  </div>
                  <div className="flex items-center text-sm">
                    <Car className="w-4 h-4 mr-2 text-primary" />
                    Parking
                  </div>
                  <div className="flex items-center text-sm">
                    <Shield className="w-4 h-4 mr-2 text-primary" />
                    Security
                  </div>
                </div>
              </CardContent>
            </Card>

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
