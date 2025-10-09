import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { validateEmail, validatePhone, validateRequired } from "@/lib/validation";

interface Park {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface Lot {
  id: string;
  nameOrNumber: string;
  parkId: string;
  park?: {
    name: string;
  };
  status: string[];
  isAssigned?: boolean;
  tenantId?: string;
  tenantName?: string;
  tenantStatus?: string;
}

interface TenantFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parkId: string;
  lotId: string;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
}

interface TenantStepFormProps {
  onSubmit: (data: TenantFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isManager?: boolean; // If true, only show lots from manager's assigned parks
  isCompanyManager?: boolean; // If true, show lots from company manager's parks
}

export function TenantStepForm({ onSubmit, onCancel, isLoading = false, isManager = false, isCompanyManager = false }: TenantStepFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TenantFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    parkId: "",
    lotId: "",
    status: "PENDING"
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [parkOpen, setParkOpen] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [parkSearch, setParkSearch] = useState("");
  const [lotSearch, setLotSearch] = useState("");

  // Fetch parks (filtered for managers and company managers)
  const { data: parksData, isLoading: parksLoading } = useQuery({
    queryKey: ['parks-for-tenant-form', isManager, isCompanyManager],
    queryFn: async () => {
      let endpoint = '/api/parks';
      if (isManager) {
        endpoint = '/api/manager/parks';
      } else if (isCompanyManager) {
        endpoint = '/api/company-manager/parks';
      }
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
  });

  // Fetch lots based on selected park
  const { data: lotsData, isLoading: lotsLoading } = useQuery({
    queryKey: ['lots-for-tenant-form', formData.parkId],
    queryFn: async () => {
      if (!formData.parkId) return { lots: [] };
      const response = await apiRequest('GET', `/api/lots?parkId=${formData.parkId}`);
      return response.json();
    },
    enabled: !!formData.parkId,
  });

  const parks = parksData?.parks || [];
  const lots = lotsData?.lots || [];

  // Filter parks based on search - use all parks since Command component handles filtering
  const filteredParks = parks;

  // Filter lots based on selected park - Command component handles search filtering
  const filteredLots = lots.filter((lot: Lot) => {
    // For managers, ensure lot belongs to selected park
    const matchesPark = isManager ? lot.parkId === formData.parkId : true;
    
    return matchesPark;
  });

  const selectedPark = parks.find((park: Park) => park.id === formData.parkId);
  const selectedLot = lots.find((lot: Lot) => lot.id === formData.lotId);

  // Validation functions
  const validateField = (field: string, value: string) => {
    let error: string | null = null;
    
    switch (field) {
      case 'firstName':
        error = validateRequired(value, 'First name');
        break;
      case 'lastName':
        error = validateRequired(value, 'Last name');
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'phone':
        error = validatePhone(value);
        break;
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));
    
    return !error;
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isStep1Valid = formData.firstName && formData.lastName && formData.email && formData.phone &&
    !validationErrors.firstName && !validationErrors.lastName && !validationErrors.email && !validationErrors.phone;
  const isStep2Valid = formData.parkId;
  const isStep3Valid = formData.lotId;

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, firstName: e.target.value }));
              validateField('firstName', e.target.value);
            }}
            onBlur={(e) => validateField('firstName', e.target.value)}
            required
            placeholder="Enter first name"
            className={validationErrors.firstName ? 'border-red-500' : ''}
          />
          {validationErrors.firstName && (
            <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.firstName}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, lastName: e.target.value }));
              validateField('lastName', e.target.value);
            }}
            onBlur={(e) => validateField('lastName', e.target.value)}
            required
            placeholder="Enter last name"
            className={validationErrors.lastName ? 'border-red-500' : ''}
          />
          {validationErrors.lastName && (
            <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.lastName}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, email: e.target.value }));
              validateField('email', e.target.value);
            }}
            onBlur={(e) => validateField('email', e.target.value)}
            required
            placeholder="Enter email address"
            className={validationErrors.email ? 'border-red-500' : ''}
          />
          {validationErrors.email && (
            <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.email}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, phone: e.target.value }));
              validateField('phone', e.target.value);
            }}
            onBlur={(e) => validateField('phone', e.target.value)}
            required
            placeholder="Enter phone number"
            className={validationErrors.phone ? 'border-red-500' : ''}
          />
          {validationErrors.phone && (
            <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.phone}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <Label>Select Park *</Label>
        <Popover open={parkOpen} onOpenChange={setParkOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={parkOpen}
              className="w-full justify-between"
            >
              {selectedPark ? `${selectedPark.name} - ${selectedPark.city}, ${selectedPark.state}` : "Select a park..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput
                placeholder="Search parks..."
              />
              <CommandList>
                <CommandEmpty>No parks found.</CommandEmpty>
                <CommandGroup>
                  {parks.map((park: Park) => (
                    <CommandItem
                      key={park.id}
                      value={`${park.name} ${park.city} ${park.state}`}
                      onSelect={() => {
                        setFormData(prev => ({ ...prev, parkId: park.id, lotId: "" }));
                        setParkOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.parkId === park.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{park.name}</span>
                        <span className="text-sm text-muted-foreground">{park.city}, {park.state}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <Label>Select Lot *</Label>
        <Popover open={lotOpen} onOpenChange={setLotOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={lotOpen}
              className="w-full justify-between"
            >
              {selectedLot ? `${selectedLot.nameOrNumber}${selectedLot.park ? ` - ${selectedLot.park.name}` : ''}` : "Select a lot..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput
                placeholder="Search lots..."
                value={lotSearch}
                onValueChange={setLotSearch}
              />
              <CommandList>
                <CommandEmpty>No lots found.</CommandEmpty>
                <CommandGroup>
                  {filteredLots.map((lot: Lot) => {
                    const isAssigned = lot.isAssigned || lot.tenantId;
                    const assignedTenant = lot.tenantName;
                    
                    return (
                      <CommandItem
                        key={lot.id}
                        value={lot.id}
                        onSelect={() => {
                          if (!isAssigned) {
                            setFormData(prev => ({ ...prev, lotId: lot.id }));
                            setLotOpen(false);
                            setLotSearch("");
                          }
                        }}
                        disabled={isAssigned}
                        className={cn(
                          isAssigned && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.lotId === lot.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lot.nameOrNumber}</span>
                            {isAssigned && (
                              <div className="flex items-center gap-1 text-xs text-orange-600">
                                <AlertCircle className="h-3 w-3" />
                                <span>Assigned to {assignedTenant}</span>
                              </div>
                            )}
                          </div>
                          {lot.park && (
                            <span className="text-sm text-muted-foreground">{lot.park.name}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Tenant</CardTitle>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <div className={cn("flex items-center space-x-1", currentStep >= 1 ? "text-primary" : "")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", 
              currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              1
            </div>
            <span>Personal Info</span>
          </div>
          <div className="w-8 h-px bg-border"></div>
          <div className={cn("flex items-center space-x-1", currentStep >= 2 ? "text-primary" : "")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", 
              currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              2
            </div>
            <span>Select Park</span>
          </div>
          <div className="w-8 h-px bg-border"></div>
          <div className={cn("flex items-center space-x-1", currentStep >= 3 ? "text-primary" : "")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", 
              currentStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              3
            </div>
            <span>Select Lot</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          <div className="flex justify-between mt-6">
            <div>
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {currentStep < 3 ? (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && !isStep1Valid) ||
                    (currentStep === 2 && !isStep2Valid)
                  }
                >
                  Next
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={!isStep3Valid || isLoading}
                >
                  {isLoading ? "Creating..." : "Create Tenant"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
