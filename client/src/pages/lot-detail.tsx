import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingForm } from "@/components/ui/booking-form";
import { BookingConfirmationDialog } from "@/components/ui/booking-confirmation-dialog";
import { LotCalculator } from "@/components/ui/lot-calculator";
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
  Home,
  Calculator,
  Info
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Lot {
  id: string;
  nameOrNumber: string;
  status: ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED')[] | ('FOR_RENT' | 'FOR_SALE' | 'RENT_TO_OWN' | 'CONTRACT_FOR_DEED') | null;
  price: string;
  priceForRent?: string | null;
  priceForSale?: string | null;
  priceRentToOwn?: string | null;
  priceContractForDeed?: string | null;
  lotRent?: string | null;
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
  minute: number;
  time: string;
  date: Date;
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
  
  // State for selected time slot to pass to booking form
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string} | null>(null);
  
  // Calculator states
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showCalculatorSelection, setShowCalculatorSelection] = useState<boolean>(false);
  
  // Booking dialog state
  const [showBookingDialog, setShowBookingDialog] = useState<boolean>(false);
  
  // Confirmation dialog state
  const [showConfirmationDialog, setShowConfirmationDialog] = useState<boolean>(false);
  const [confirmationDetails, setConfirmationDetails] = useState<{
    date: string;
    time: string;
    parkName: string;
    parkAddress: string;
    lotNumber: string;
  } | null>(null);
  
  // State to track open tooltips for clickable info icons
  const [openTooltips, setOpenTooltips] = useState<Record<string, boolean>>({});

  // Check URL parameters and automatically open booking dialog if requested
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('booking') === 'true') {
      setShowBookingDialog(true);
      // Clean up the URL by removing the booking parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: lot, isLoading: lotLoading, error: lotError } = useQuery<Lot>({
    queryKey: ["/api/lots", id],
    queryFn: async () => {
      if (!id) throw new Error('No lot ID provided');
      
      const response = await fetch(`/api/lots/${id}`);
      if (!response.ok) {
        console.error('Failed to fetch lot:', {
          url: `/api/lots/${id}`,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Failed to fetch lot: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!id,
    retry: 3,
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

  // REMOVED: No longer fetching database showings - Google Calendar is the single source of truth for bookings

  // Fetch manager calendar availability - ALWAYS fetch fresh data with 30-second polling
  const { data: managerAvailability } = useQuery<{
    busySlots: Array<{ start: string; end: string }>;
    managerConnected: boolean;
  }>({
    queryKey: ["/api/lots", id, "manager-availability"], // Stable key for proper invalidation
    queryFn: () => fetch(`/api/lots/${id}/manager-availability?ts=${Date.now()}`).then(res => res.json()), // Bypass server cache
    enabled: !!id,
    staleTime: 0, // Never use stale data
    gcTime: 0, // Don't cache at all
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch on network reconnect
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
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

  if (lotError) {
    console.error('Lot loading error:', lotError);
    return (
      <div className="flex items-center justify-center py-16">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Error loading lot</h2>
            <p className="text-muted-foreground mb-4">
              {lotError instanceof Error ? lotError.message : 'Failed to load lot details'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Lot ID: {id || 'Not provided'}
            </p>
            <div className="space-x-2">
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
              <Link href="/parks">
                <Button>Browse Parks</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
            <p className="text-xs text-muted-foreground mb-4">
              Lot ID: {id || 'Not provided'}
            </p>
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
  // REMOVED: No longer needed - Google Calendar is the source of truth for bookings
  const managerBusySlots = managerAvailability?.busySlots || [];

  // Generate weekly schedule from 9am to 7pm for this week
  const generateWeeklySchedule = (): DaySchedule[] => {
    const schedule: DaySchedule[] = [];
    const today = new Date();
    
    // Find the Monday of this week
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startOfWeek = new Date(today);
    
    // Calculate days back to Monday (0=Sunday needs 6 back, 1=Monday needs 0, 2=Tuesday needs 1, etc.)
    const daysToMonday = (currentDayOfWeek + 6) % 7;
    startOfWeek.setDate(today.getDate() - daysToMonday);
    
    // If it's Friday afternoon (after 5pm) or weekend, show next week
    if (currentDayOfWeek === 6 || (currentDayOfWeek === 5 && today.getHours() >= 17) || currentDayOfWeek === 0) {
      startOfWeek.setDate(startOfWeek.getDate() + 7);
    }
    
    // Show Monday through Friday (5 days)
    
    console.log(`[DEBUG] Generating memoized schedule with ${managerBusySlots.length} manager busy slots:`, managerBusySlots);
    console.log(`[DEBUG] Today is:`, today.toString(), `UTC:`, today.toISOString());
    console.log(`[DEBUG] Start of week:`, startOfWeek.toString(), `UTC:`, startOfWeek.toISOString());
    
    // Pre-normalize busy 30-minute slots for faster comparison - USE UTC to avoid timezone issues
    const busySlotSet = new Set<string>();
    
    // Helper function to generate consistent UTC-based slot keys
    const generateUTCSlotKey = (date: Date): string => {
      const isoDate = date.toISOString().slice(0, 10); // YYYY-MM-DD format
      const utcHour = date.getUTCHours();
      const utcMinute = date.getUTCMinutes();
      return `${isoDate}:${utcHour}:${utcMinute}`;
    };
    
    managerBusySlots.forEach(busySlot => {
      const busyStart = new Date(busySlot.start);
      const busyEnd = new Date(busySlot.end);
      
      // Work in UTC throughout to avoid timezone conversion issues
      const startTime = new Date(busyStart);
      const endTime = new Date(busyEnd);
      
      // Round down start time to nearest 30-minute boundary in UTC
      startTime.setUTCMinutes(Math.floor(startTime.getUTCMinutes() / 30) * 30, 0, 0);
      
      // Mark every 30-minute slot that overlaps with the busy period
      const current = new Date(startTime);
      while (current < endTime) {
        const slotKey = generateUTCSlotKey(current);
        busySlotSet.add(slotKey);
        current.setUTCMinutes(current.getUTCMinutes() + 30);
      }
    });
    
    console.log(`[DEBUG] Created busy 30-minute slot set with ${busySlotSet.size} entries:`, Array.from(busySlotSet));
    
    // Generate 30-minute time slots from 8am to 7pm
    const timeSlots: Array<{hour: number, minute: number}> = [];
    for (let hour = 8; hour <= 19; hour++) { // 8am to 7pm
      timeSlots.push({hour, minute: 0}); // Top of hour (8:00, 9:00, etc.)
      if (hour < 19) { // Don't add 7:30pm, end at 7:00pm
        timeSlots.push({hour, minute: 30}); // Half hour (8:30, 9:30, etc.)
      }
    }
    
    // Show Monday through Friday only (5 weekdays)
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + dayOffset);
      
      const daySchedule: DaySchedule = {
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        slots: []
      };
      
      for (const timeSlot of timeSlots) {
        const { hour, minute } = timeSlot;
        
        // Create 30-minute slot times in user's local timezone
        const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
        const slotEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute + 29, 59, 999);
        
        // Check if this time slot has any blockages (manual rules)
        const hasBlockage = availabilityRules.some((rule: Availability) => 
          rule.ruleType === 'BLOCKED' && 
          new Date(rule.startDt) <= slotEnd && 
          new Date(rule.endDt) >= slotStart
        );
        
        // Check if this time slot is in the past (for any day in the week)
        const now = new Date();
        const isPastHour = slotStart < now;
        
        // REMOVED: Database showing checks - Google Calendar is now the single source of truth for bookings
        
        // Check if manager is busy using UTC-based slot key to match Google Calendar busy slots  
        // Try both timezone approaches to handle potential timezone inconsistencies
        
        // Approach 1: Local time converted to UTC (for timezone-aware comparison)
        const localSlotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
        const localSlotKey = generateUTCSlotKey(localSlotTime);
        const isManagerBusyLocal = busySlotSet.has(localSlotKey);
        
        // Approach 2: Treat display time as UTC directly (for UTC-based comparison)
        const utcAsLocalTime = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute));
        const utcAsLocalKey = generateUTCSlotKey(utcAsLocalTime);
        const isManagerBusyUTCAsLocal = busySlotSet.has(utcAsLocalKey);
        
        // Use whichever approach finds busy slots (fallback strategy)
        const isManagerBusy = isManagerBusyLocal || isManagerBusyUTCAsLocal;
        
        // DEBUG: Logging for availability calculation
        console.log(`[AVAILABILITY] ${daySchedule.dayName} ${hour}:${minute.toString().padStart(2, '0')} slot check:`, {
          localSlotTime: localSlotTime.toString(),
          localSlotTimeISO: localSlotTime.toISOString(),
          localSlotKey,
          isManagerBusyLocal,
          utcAsLocalTime: utcAsLocalTime.toString(),
          utcAsLocalTimeISO: utcAsLocalTime.toISOString(),
          utcAsLocalKey,
          isManagerBusyUTCAsLocal,
          isManagerBusy: isManagerBusy,
          hasBlockage,
          isPastHour,
          slotStart: slotStart.toString(),
          now: now.toString(),
          finalAvailable: !hasBlockage && !isManagerBusy && !isPastHour,
          managerConnected: managerAvailability?.managerConnected,
          busySlotSetSize: busySlotSet.size,
          sampleBusySlotKeys: Array.from(busySlotSet).slice(0, 5) // Show first 5 for debugging
        });
        
        // Format time display (9:00am, 9:30am, 10:00am, etc.)
        const displayHour = hour > 12 ? hour - 12 : hour;
        const timeDisplay = `${displayHour}:${minute.toString().padStart(2, '0')}${hour >= 12 ? 'pm' : 'am'}`;
        
        const slot: TimeSlot = {
          hour,
          minute,
          time: timeDisplay,
          date: new Date(date),
          isAvailable: !hasBlockage && !isManagerBusy && !isPastHour
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
            <div className="mb-8 relative">
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
                            onError={(e) => {
                              console.error('Failed to load lot photo:', photo.urlOrPath || photo.url);
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.fallback-content');
                              if (fallback) {
                                (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                          <div className="fallback-content absolute inset-0 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground" style={{ display: 'none' }}>
                            <Home className="w-12 h-12 mb-2" />
                            <span className="text-sm">Photo unavailable</span>
                          </div>
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
              
              {/* Request Showing Button - Positioned over photo */}
              <div className="absolute bottom-4 right-4 z-10">
                <Button 
                  onClick={() => setShowBookingDialog(true)}
                  className="py-3 px-6 shadow-lg bg-blue-600/90 hover:bg-blue-600"
                  size="lg"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Request a Showing
                </Button>
              </div>
            </div>

            {/* Lot Details */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold">{lot.nameOrNumber}</h1>
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
                  {lot.lotRent && (
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <DollarSign className="w-6 h-6 text-primary mb-2 mx-auto" />
                      <div className="text-sm text-muted-foreground">Lot Rent</div>
                      <div className="font-semibold">${parseFloat(lot.lotRent).toLocaleString()}/mo</div>
                    </div>
                  )}
                  {(() => {
                    const statusArray = Array.isArray(lot.status) ? lot.status : (lot.status ? [lot.status] : []);
                    const prices = [];
                    
                    // Show pricing based on status and availability
                    if (statusArray.includes('FOR_RENT') && lot.priceForRent) {
                      prices.push({ label: 'Rent', value: lot.priceForRent, suffix: '/mo', showTooltip: !!lot.lotRent });
                    }
                    if (statusArray.includes('FOR_SALE') && lot.priceForSale) {
                      prices.push({ label: 'Sale Price', value: lot.priceForSale, suffix: '', showTooltip: false });
                    }
                    if (statusArray.includes('RENT_TO_OWN') && lot.priceRentToOwn) {
                      prices.push({ label: 'Rent to Own', value: lot.priceRentToOwn, suffix: '/mo', showTooltip: false });
                    }
                    if (statusArray.includes('CONTRACT_FOR_DEED') && lot.priceContractForDeed) {
                      prices.push({ label: 'Contract', value: lot.priceContractForDeed, suffix: '/mo', showTooltip: false });
                    }
                    
                    // Fallback to legacy price if no specific pricing is available
                    if (prices.length === 0 && lot.price) {
                      prices.push({ label: 'Price', value: lot.price, suffix: statusArray.includes('FOR_RENT') ? '/mo' : '', showTooltip: false });
                    }
                    
                    return prices.map((price, index) => (
                      <div key={index} className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                          {price.label}
                          {price.showTooltip && (
                            <TooltipProvider>
                              <Tooltip
                                open={openTooltips[`tooltip-${index}`]}
                                onOpenChange={(open) => {
                                  setOpenTooltips(prev => ({
                                    ...prev,
                                    [`tooltip-${index}`]: open
                                  }));
                                }}
                              >
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTooltips(prev => ({
                                        ...prev,
                                        [`tooltip-${index}`]: !prev[`tooltip-${index}`]
                                      }));
                                    }}
                                    className="inline-flex"
                                  >
                                    <Info className="w-3.5 h-3.5 cursor-pointer" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Lot rent included: ${parseFloat(lot.lotRent!).toLocaleString()}/mo</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="font-semibold">
                          ${parseFloat(price.value).toLocaleString()}{price.suffix}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <p className="text-muted-foreground">
                  {lot.description || "Contact us for more details about this property."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Booking Form Sidebar */}
          <div className="lg:col-span-1">
            <div id="booking-form-section" className="sticky top-24 space-y-4">
              {/* Calculator Card */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-center">Payment Calculator</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      Calculate payment terms for different purchase options
                    </p>
                    <Button 
                      onClick={() => setShowCalculatorSelection(true)}
                      className="w-full"
                      variant="outline"
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Calculate Payments
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <BookingForm 
                lotId={lot.id} 
                selectedSlot={selectedSlot}
                parkName={park?.name}
                parkAddress={park?.address}
                lotName={lot.nameOrNumber}
                onSlotUsed={() => setSelectedSlot(null)}
                onSuccess={() => {
                  toast({
                    title: "Showing Requested", 
                    description: "Your showing request has been submitted successfully.",
                  });
                  // REMOVED: No longer invalidating showings - Google Calendar is source of truth
                  setSelectedSlot(null);
                }}
                onShowConfirmation={(details) => {
                  setConfirmationDetails(details);
                  setShowConfirmationDialog(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Booking Request Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a Showing</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Fill out the form below to request a showing for {lot?.nameOrNumber || 'this property'}
            </p>
          </DialogHeader>
          <div className="py-4">
            <BookingForm 
              lotId={lot?.id || ''} 
              selectedSlot={selectedSlot}
              parkName={park?.name}
              parkAddress={park?.address}
              lotName={lot?.nameOrNumber}
              onSlotUsed={() => setSelectedSlot(null)}
              onSuccess={() => {
                toast({
                  title: "Showing Requested", 
                  description: "Your showing request has been submitted successfully.",
                });
                setSelectedSlot(null);
                setShowBookingDialog(false);
              }}
              onShowConfirmation={(details) => {
                setConfirmationDetails(details);
                setShowConfirmationDialog(true);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Selection Dialog */}
      <Dialog open={showCalculatorSelection} onOpenChange={setShowCalculatorSelection}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Calculation Type</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose which payment calculation you'd like to perform for {lot?.nameOrNumber || 'this lot'}
            </p>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              variant="outline"
              className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="text-left">
                <div className="font-medium text-muted-foreground">For Rent</div>
                <div className="text-sm text-muted-foreground">Calculate monthly rental payments</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="text-left">
                <div className="font-medium text-muted-foreground">For Sale</div>
                <div className="text-sm text-muted-foreground">Calculate purchase financing options</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 justify-start opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="text-left">
                <div className="font-medium text-muted-foreground">Rent to Own</div>
                <div className="text-sm text-muted-foreground">Calculate rent-to-own terms</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">Coming Soon</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={() => {
                // Open the actual calculator for Contract for Deed
                setShowCalculatorSelection(false);
                setShowCalculator(true);
              }}
            >
              <div className="text-left">
                <div className="font-medium">Contract for Deed</div>
                <div className="text-sm text-muted-foreground">Calculate contract payment terms</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Dialog */}
      {showCalculator && lot && (
        <LotCalculator
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
          lotPrice={parseFloat(lot.priceForSale || '0')}
          lotName={lot.nameOrNumber || 'Lot'}
        />
      )}

      {/* Booking Confirmation Dialog */}
      {confirmationDetails && (
        <BookingConfirmationDialog
          isOpen={showConfirmationDialog}
          onClose={() => setShowConfirmationDialog(false)}
          showingDetails={confirmationDetails}
        />
      )}
    </div>
  );
}
