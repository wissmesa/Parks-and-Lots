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
  MapPin,
  Home
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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

interface TimeSlot {
  hour: number;
  time: string;
  isBlocked: boolean;
  hasShowing: boolean;
  isAvailable: boolean;
}

interface DaySchedule {
  date: Date;
  dayName: string;
  dayNumber: number;
  slots: TimeSlot[];
}

export default function LotDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lot, isLoading: lotLoading } = useQuery<Lot>({
    queryKey: ["/api/lots", id],
    enabled: !!id,
  });

  const { data: park } = useQuery<Park>({
    queryKey: ["/api/parks", lot?.parkId],
    enabled: !!lot?.parkId,
  });

  const { data: photos = [] } = useQuery<any[]>({
    queryKey: ["/api/lots", id, "photos"],
    enabled: !!id,
  });

  const { data: availability } = useQuery({
    queryKey: ["/api/lots", id, "availability"],
    enabled: !!id,
  });

  const { data: showings = [] } = useQuery<Showing[]>({
    queryKey: ["/api/lots", id, "showings"],
    enabled: !!id,
  });

  if (lotLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading lot details...</p>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="flex items-center justify-center py-16">
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
  const availabilityRules = Array.isArray(availability) ? availability : [];
  const lotShowings = showings || [];

  // Generate weekly schedule from 9am to 7pm for this week
  const generateWeeklySchedule = (): DaySchedule[] => {
    const schedule: DaySchedule[] = [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
    
    const timeSlots = [];
    for (let hour = 9; hour <= 19; hour++) { // 9am to 7pm
      timeSlots.push(hour);
    }
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayOffset);
      
      const daySchedule: DaySchedule = {
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        slots: []
      };
      
      for (const hour of timeSlots) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(date);
        slotEnd.setHours(hour, 59, 59, 999);
        
        // Check if this time slot has any blockages or showings
        const hasBlockage = availabilityRules.some((rule: Availability) => 
          rule.ruleType === 'BLOCKED' && 
          new Date(rule.startDt) <= slotEnd && 
          new Date(rule.endDt) >= slotStart
        );
        
        const hasShowing = lotShowings.some((showing: Showing) =>
          showing.status === 'SCHEDULED' &&
          new Date(showing.startDt) <= slotEnd && 
          new Date(showing.endDt) >= slotStart
        );
        
        const slot: TimeSlot = {
          hour,
          time: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`,
          isBlocked: hasBlockage,
          hasShowing,
          isAvailable: !hasBlockage && !hasShowing
        };
        
        daySchedule.slots.push(slot);
      }
      
      schedule.push(daySchedule);
    }
    
    return schedule;
  };

  const weeklySchedule = generateWeeklySchedule();

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
            {/* Lot Photos Carousel */}
            <div className="mb-8">
              {photos.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {photos.map((photo: any, index: number) => (
                      <CarouselItem key={photo.id || index}>
                        <div className="relative">
                          <img 
                            src={photo.urlOrPath || photo.url} 
                            alt={photo.caption || `Lot photo ${index + 1}`}
                            className="w-full h-64 md:h-96 object-cover rounded-lg" 
                          />
                          {photo.caption && (
                            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                              {photo.caption}
                            </div>
                          )}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              ) : (
                <div className="h-64 bg-muted rounded-lg flex items-center justify-center relative">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted-foreground/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Home className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No photos available</p>
                    <p className="text-xs text-muted-foreground mt-1">Contact us for current photos</p>
                  </div>
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

            {/* Weekly Schedule Availability */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Showing Availability</h3>
                <div className="text-sm text-muted-foreground mb-4">
                  Weekly schedule from 9am to 7pm
                </div>
                
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-1 text-center text-xs mb-4 min-w-[600px]">
                    {/* Time column header */}
                    <div className="font-medium text-muted-foreground py-2">Time</div>
                    
                    {/* Day headers */}
                    {weeklySchedule.map(day => (
                      <div key={day.dayName} className="font-medium text-muted-foreground py-2">
                        <div>{day.dayName}</div>
                        <div className="text-xs opacity-70">{day.dayNumber}</div>
                      </div>
                    ))}
                    
                    {/* Time slots */}
                    {Array.from({length: 11}, (_, hourIndex) => {
                      const hour = 9 + hourIndex;
                      const timeDisplay = `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`;
                      
                      return [
                        <div key={`time-${hour}`} className="py-1 text-xs font-medium text-muted-foreground">
                          {timeDisplay}
                        </div>,
                        ...weeklySchedule.map(day => {
                          const slot = day.slots.find(s => s.hour === hour);
                          if (!slot) return null;
                          
                          return (
                            <div 
                              key={`${day.dayName}-${hour}`}
                              data-testid={`slot-${day.dayName}-${hour}`}
                              className={`py-1 px-1 rounded text-xs ${
                                slot.isBlocked 
                                  ? 'bg-destructive/20 text-destructive cursor-not-allowed' 
                                  : slot.hasShowing
                                  ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                                  : 'hover:bg-muted cursor-pointer bg-green-50 border border-green-200'
                              }`}
                              title={
                                slot.isBlocked 
                                  ? 'Blocked' 
                                  : slot.hasShowing 
                                  ? 'Has showing' 
                                  : 'Available'
                              }
                            >
                              {slot.isAvailable ? '✓' : slot.hasShowing ? '●' : '✗'}
                            </div>
                          );
                        })
                      ];
                    }).flat()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-50 border border-green-200 rounded mr-2"></div>
                    Available (✓)
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-100 rounded mr-2"></div>
                    Has Showing (●)
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-destructive/20 rounded mr-2"></div>
                    Blocked (✗)
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
