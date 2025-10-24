import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CalendarPlus, AlertCircle } from "lucide-react";
import { validateEmail, validatePhone, validateRequired } from "@/lib/validation";

interface BookingFormProps {
  lotId: string;
  selectedSlot?: { date: string; time: string } | null;
  onSlotUsed?: () => void;
  onSuccess?: () => void;
  parkName?: string;
  parkAddress?: string;
  lotName?: string;
  onShowConfirmation?: (details: { date: string; time: string; parkName: string; parkAddress: string; lotNumber: string }) => void;
}

export function BookingForm({ lotId, selectedSlot, onSlotUsed, onSuccess, parkName, parkAddress, lotName, onShowConfirmation }: BookingFormProps) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState(selectedSlot?.date || "");
  const [selectedTime, setSelectedTime] = useState(selectedSlot?.time || "");
  const [reminderPreference, setReminderPreference] = useState<"SMS" | "EMAIL" | "BOTH">("BOTH");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dynamic showing duration (30 minutes)
  const SHOWING_DURATION_MINUTES = 30;

  // Validation functions
  const validateField = (field: string, value: string) => {
    let error: string | null = null;
    
    switch (field) {
      case 'clientName':
        error = validateRequired(value, 'Full name');
        break;
      case 'clientEmail':
        // Email is optional - only validate if provided
        error = value ? validateEmail(value) : '';
        break;
      case 'clientPhone':
        error = validatePhone(value);
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));
    
    return !error;
  };

  // Update form fields when a time slot is selected
  useEffect(() => {
    if (selectedSlot) {
      setSelectedDate(selectedSlot.date);
      setSelectedTime(selectedSlot.time);
    }
  }, [selectedSlot]);

  // Clear selected time when date changes to force reselection
  useEffect(() => {
    setSelectedTime("");
  }, [selectedDate]);

  // Query to get manager's busy slots for the next 7 days
  const { data: managerAvailability } = useQuery({
    queryKey: ["/api/lots", lotId, "manager-availability"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/lots/${lotId}/manager-availability`);
      return response.json();
    },
    enabled: !!lotId,
  });

  // NOTE: We no longer query existing showings from database
  // Available time slots are calculated ONLY from manager's Google Calendar availability

  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await apiRequest("POST", `/api/lots/${lotId}/book`, bookingData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Showing Booked Successfully",
        description: data.calendarHtmlLink 
          ? "Your showing has been scheduled and added to the manager's calendar."
          : "Your showing has been scheduled. Calendar sync may have failed.",
      });
      
      // Show confirmation dialog with booking details
      if (onShowConfirmation && parkName && parkAddress && lotName) {
        onShowConfirmation({
          date: selectedDate,
          time: selectedTime,
          parkName: parkName,
          parkAddress: parkAddress,
          lotNumber: lotName,
        });
      }
      
      // Reset form
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setSelectedDate("");
      setSelectedTime("");
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "showings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "availability"] });
      
      // Clear selection after successful booking
      onSlotUsed?.();
      onSuccess?.();
    },
    onError: (error) => {
      // Parse error message to extract meaningful content
      let errorMessage = error.message;
      
      // Handle API error format: "409: {"message":"..."}"
      const match = errorMessage.match(/^\d+:\s*\{.*"message"\s*:\s*"([^"]+)"/);
      if (match) {
        errorMessage = match[1];
      }
      
      // Check if this is a calendar conflict error - refresh all availability data
      if (errorMessage.includes('no longer available') || 
          errorMessage.includes('manager has scheduled another event') ||
          errorMessage.includes('manager has a calendar conflict') ||
          errorMessage.includes('not available')) {
        // Refresh all availability data to show updated slots
        queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "manager-availability"] });
        queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "availability"] });
        queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId] });
      }
      
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields (email is optional)
    const nameValid = validateField('clientName', clientName);
    const emailValid = validateField('clientEmail', clientEmail);
    const phoneValid = validateField('clientPhone', clientPhone);
    
    if (!nameValid || !phoneValid || (clientEmail && !emailValid)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select both date and time for your showing.",
        variant: "destructive",
      });
      return;
    }

    // Create datetime objects
    const startDt = new Date(`${selectedDate}T${selectedTime}:00`);
    const endDt = new Date(startDt);
    endDt.setMinutes(endDt.getMinutes() + SHOWING_DURATION_MINUTES);

    const bookingData = {
      clientName,
      clientEmail,
      clientPhone,
      reminderPreference,
      startDt: startDt.toISOString(),
      endDt: endDt.toISOString(),
    };

    bookingMutation.mutate(bookingData);
  };

  // Generate available time slots (8am to 7pm in 30-minute intervals, filtered by manager availability and existing showings)
  const getAvailableTimeSlots = () => {
    if (!selectedDate) {
      console.log('[BookingForm] No date selected, returning empty slots');
      return [];
    }
    
    console.log(`[BookingForm] Generating slots for date: ${selectedDate}`);
    
    const slots = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const isToday = selectedDate === today;
    const busySlots = managerAvailability?.busySlots || [];
    
    console.log(`[BookingForm] Manager busy slots:`, busySlots.length);
    console.log(`[BookingForm] Busy slot details:`, busySlots);
    
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 19 && minute > 0) break; // Don't add past 7:00pm
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStart = new Date(`${selectedDate}T${timeString}:00`);
        const slotEnd = new Date(slotStart.getTime());
        slotEnd.setMinutes(slotEnd.getMinutes() + SHOWING_DURATION_MINUTES);
        
        // Skip past times if today
        if (isToday && slotStart <= now) {
          continue;
        }
        
        // Check if this slot conflicts with any busy slot from manager's Google Calendar
        // This is the ONLY source of truth for availability
        let isAvailable = true;
        
        for (const busySlot of busySlots) {
          const busyStart = new Date(busySlot.start);
          const busyEnd = new Date(busySlot.end);
          
          // Use STRICT overlap logic: events that touch boundaries should NOT conflict
          // Only detect REAL overlaps where times actually intersect, not just touch
          const overlaps = (
            (busyStart > slotStart && busyStart < slotEnd) ||  // busy starts during slot (not at boundary)
            (busyEnd > slotStart && busyEnd < slotEnd) ||      // busy ends during slot (not at boundary)
            (busyStart <= slotStart && busyEnd >= slotEnd)     // busy wraps entire slot
          );
          
          if (overlaps) {
            console.log(`[BookingForm] ❌ Slot ${timeString} blocked by calendar event:`, {
              slotLocal: `${slotStart.toLocaleString()} - ${slotEnd.toLocaleString()}`,
              busyLocal: `${busyStart.toLocaleString()} - ${busyEnd.toLocaleString()}`,
              slotUTC: `${slotStart.toISOString()} - ${slotEnd.toISOString()}`,
              busyUTC: `${busyStart.toISOString()} - ${busyEnd.toISOString()}`
            });
            isAvailable = false;
            break;
          }
        }
        
        if (isAvailable) {
          slots.push(timeString);
        }
      }
    }
    
    console.log(`[BookingForm] ✅ Total available slots for ${selectedDate}: ${slots.length}`, slots);
    return slots;
  };

  const timeSlots = getAvailableTimeSlots();

  return (
    <Card data-testid="booking-form">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Book a Showing</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="clientName">Full Name</Label>
            <Input
              id="clientName"
              type="text"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                validateField('clientName', e.target.value);
              }}
              onBlur={(e) => validateField('clientName', e.target.value)}
              required
              placeholder="Enter your full name"
              data-testid="input-client-name"
              className={validationErrors.clientName ? 'border-red-500' : ''}
            />
            {validationErrors.clientName && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {validationErrors.clientName}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="clientPhone">Phone</Label>
            <Input
              id="clientPhone"
              type="tel"
              value={clientPhone}
              onChange={(e) => {
                setClientPhone(e.target.value);
                validateField('clientPhone', e.target.value);
              }}
              onBlur={(e) => validateField('clientPhone', e.target.value)}
              required
              placeholder="(555) 123-4567"
              data-testid="input-client-phone"
              className={validationErrors.clientPhone ? 'border-red-500' : ''}
            />
            {validationErrors.clientPhone && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {validationErrors.clientPhone}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="clientEmail">Email <span className="text-muted-foreground text-sm">(Optional)</span></Label>
            <Input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => {
                setClientEmail(e.target.value);
                validateField('clientEmail', e.target.value);
              }}
              onBlur={(e) => validateField('clientEmail', e.target.value)}
              placeholder="JohnDoe@email.com"
              data-testid="input-client-email"
              className={validationErrors.clientEmail ? 'border-red-500' : ''}
            />
            {validationErrors.clientEmail && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {validationErrors.clientEmail}
              </p>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger data-testid="select-booking-date">
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dateString = date.toISOString().split('T')[0];
                    const displayDate = date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                    return (
                      <SelectItem key={dateString} value={dateString}>
                        {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : displayDate}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger data-testid="select-booking-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label>Reminder Preference</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
            <Button
                type="button"
                variant={reminderPreference === "BOTH" ? "default" : "outline"}
                onClick={() => setReminderPreference("BOTH")}
                className="w-full"
              >
                Both
              </Button>
              <Button
                type="button"
                variant={reminderPreference === "SMS" ? "default" : "outline"}
                onClick={() => setReminderPreference("SMS")}
                className="w-full"
              >
                SMS
              </Button>
              <Button
                type="button"
                variant={reminderPreference === "EMAIL" ? "default" : "outline"}
                onClick={() => setReminderPreference("EMAIL")}
                className="w-full"
              >
                Email
              </Button>
            </div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Showing Duration</span>
              <span className="font-medium">
                {SHOWING_DURATION_MINUTES} minutes
              </span>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={bookingMutation.isPending}
            data-testid="button-request-showing"
          >
            <CalendarPlus className="w-4 h-4 mr-2" />
            {bookingMutation.isPending ? "Requesting..." : "Request Showing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
