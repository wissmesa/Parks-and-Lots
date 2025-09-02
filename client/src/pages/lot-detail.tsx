import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingForm } from "@/components/ui/booking-form";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronRight, 
  Bed, 
  Bath, 
  Ruler, 
  DollarSign,
  Calendar,
  Clock,
  MapPin
} from "lucide-react";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: 'FOR_RENT' | 'FOR_SALE';
  price: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqFt?: number;
  parkId: string;
}

interface Park {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface Showing {
  id: string;
  startDt: string;
  endDt: string;
  status: string;
  clientName: string;
}

interface Availability {
  id: string;
  ruleType: 'OPEN_SLOT' | 'BLOCKED';
  startDt: string;
  endDt: string;
  note?: string;
}

export default function LotDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lot, isLoading: lotLoading } = useQuery({
    queryKey: ["/api/lots", id],
    enabled: !!id,
  });

  const { data: park } = useQuery({
    queryKey: ["/api/parks", lot?.parkId],
    enabled: !!lot?.parkId,
  });

  const { data: photos } = useQuery({
    queryKey: ["/api/lots", id, "photos"],
    enabled: !!id,
  });

  const { data: availability } = useQuery({
    queryKey: ["/api/lots", id, "availability"],
    enabled: !!id,
  });

  const { data: showings } = useQuery({
    queryKey: ["/api/lots", id, "showings"],
    enabled: !!id,
  });

  if (lotLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading lot details...</p>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Lot not found</h2>
            <p className="text-muted-foreground mb-4">The lot you're looking for doesn't exist.</p>
            <Link href="/parks">
              <Button>Browse Parks</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lotPhotos = photos || [];
  const availabilityRules = availability || [];
  const lotShowings = showings || [];

  // Generate calendar days for simple availability display
  const generateCalendarDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Check if day has any blockages or showings
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const hasBlockage = availabilityRules.some((rule: Availability) => 
        rule.ruleType === 'BLOCKED' && 
        new Date(rule.startDt) <= dayEnd && 
        new Date(rule.endDt) >= dayStart
      );
      
      const hasShowing = lotShowings.some((showing: Showing) =>
        showing.status === 'SCHEDULED' &&
        new Date(showing.startDt) <= dayEnd && 
        new Date(showing.endDt) >= dayStart
      );

      days.push({
        date,
        number: date.getDate(),
        isBlocked: hasBlockage,
        hasShowing,
        isAvailable: !hasBlockage && !hasShowing
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

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
            {park && (
              <>
                <li><Link href={`/parks/${park.id}`} className="hover:text-foreground">{park.name}</Link></li>
                <li><ChevronRight className="w-4 h-4" /></li>
              </>
            )}
            <li className="text-foreground">{lot.nameOrNumber}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Lot Photos */}
            <div className="mb-8">
              {lotPhotos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lotPhotos.slice(0, 2).map((photo: any) => (
                    <img 
                      key={photo.id}
                      src={photo.urlOrPath} 
                      alt={photo.caption || "Lot photo"}
                      className="w-full h-64 object-cover rounded-lg" 
                    />
                  ))}
                </div>
              ) : (
                <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">No photos available</p>
                </div>
              )}
            </div>

            {/* Lot Details */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold">{lot.nameOrNumber}</h1>
                  <Badge variant={lot.status === 'FOR_RENT' ? 'default' : 'secondary'}>
                    {lot.status === 'FOR_RENT' ? 'For Rent' : 'For Sale'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {lot.bedrooms && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <Bed className="w-6 h-6 text-primary mb-2 mx-auto" />
                      <div className="text-sm text-muted-foreground">Bedrooms</div>
                      <div className="font-semibold">{lot.bedrooms}</div>
                    </div>
                  )}
                  {lot.bathrooms && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <Bath className="w-6 h-6 text-primary mb-2 mx-auto" />
                      <div className="text-sm text-muted-foreground">Bathrooms</div>
                      <div className="font-semibold">{lot.bathrooms}</div>
                    </div>
                  )}
                  {lot.sqFt && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <Ruler className="w-6 h-6 text-primary mb-2 mx-auto" />
                      <div className="text-sm text-muted-foreground">Square Feet</div>
                      <div className="font-semibold">{lot.sqFt.toLocaleString()}</div>
                    </div>
                  )}
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <DollarSign className="w-6 h-6 text-primary mb-2 mx-auto" />
                    <div className="text-sm text-muted-foreground">Price</div>
                    <div className="font-semibold">
                      ${parseFloat(lot.price).toLocaleString()}{lot.status === 'FOR_RENT' ? '/mo' : ''}
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground">
                  {lot.description || "Contact us for more details about this property."}
                </p>
              </CardContent>
            </Card>

            {/* Availability Calendar Preview */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Showing Availability</h3>
                <div className="text-sm text-muted-foreground mb-4">
                  Available time slots for the next two weeks
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-medium text-muted-foreground py-2">{day}</div>
                  ))}
                  
                  {calendarDays.map((day, index) => (
                    <div 
                      key={index}
                      className={`py-2 px-1 rounded text-sm ${
                        day.isBlocked 
                          ? 'bg-destructive/20 text-destructive cursor-not-allowed' 
                          : day.hasShowing
                          ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                          : 'hover:bg-muted cursor-pointer'
                      }`}
                      title={
                        day.isBlocked 
                          ? 'Blocked' 
                          : day.hasShowing 
                          ? 'Has showing' 
                          : 'Available'
                      }
                    >
                      {day.number}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-muted rounded mr-2"></div>
                    Available
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-100 rounded mr-2"></div>
                    Has Showing
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-destructive/20 rounded mr-2"></div>
                    Blocked
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Form Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <BookingForm lotId={lot.id} onSuccess={() => {
                toast({
                  title: "Showing Requested",
                  description: "Your showing request has been submitted successfully.",
                });
                queryClient.invalidateQueries({ queryKey: ["/api/lots", id, "showings"] });
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
