import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CalendarPlus } from "lucide-react";

interface BookingFormProps {
  lotId: string;
  onSuccess?: () => void;
}

export function BookingForm({ lotId, onSuccess }: BookingFormProps) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      
      // Reset form
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setSelectedDate("");
      setSelectedTime("");
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "showings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId, "availability"] });
      
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    endDt.setMinutes(endDt.getMinutes() + 30); // 30-minute showings

    const bookingData = {
      clientName,
      clientEmail,
      clientPhone,
      startDt: startDt.toISOString(),
      endDt: endDt.toISOString(),
    };

    await bookingMutation.mutateAsync(bookingData);
  };

  // Generate available time slots
  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
  ];

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
              onChange={(e) => setClientName(e.target.value)}
              required
              placeholder="Enter your full name"
              data-testid="input-client-name"
            />
          </div>
          
          <div>
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
              placeholder="your@email.com"
              data-testid="input-client-email"
            />
          </div>
          
          <div>
            <Label htmlFor="clientPhone">Phone</Label>
            <Input
              id="clientPhone"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
              placeholder="(555) 123-4567"
              data-testid="input-client-phone"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                data-testid="input-booking-date"
              />
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
          
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Showing Duration</span>
              <span className="font-medium">30 minutes</span>
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
