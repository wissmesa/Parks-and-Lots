import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, Clock, MapPin, Home, Building2 } from "lucide-react";

interface BookingConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showingDetails: {
    date: string;
    time: string;
    parkName: string;
    parkAddress: string;
    lotNumber: string;
  };
}

export function BookingConfirmationDialog({
  isOpen,
  onClose,
  showingDetails,
}: BookingConfirmationDialogProps) {
  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format the time for display
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Showing Confirmed!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-center text-muted-foreground">
            Your showing has been successfully scheduled for:
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="text-base font-semibold">{formatDate(showingDetails.date)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time</p>
                <p className="text-base font-semibold">{formatTime(showingDetails.time)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Park</p>
                <p className="text-base font-semibold">{showingDetails.parkName}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="text-base font-semibold">{showingDetails.parkAddress}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lot</p>
                <p className="text-base font-semibold">{showingDetails.lotNumber}</p>
              </div>
            </div>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            You will receive a reminder based on your selected preference.
          </p>
        </div>
        
        <div className="flex justify-center pt-2">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

