import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Mail, Phone, User } from "lucide-react";

// Format phone number to US format (555) 123-4567
const formatPhoneNumber = (value: string): string => {
  // Remove all non-numeric characters
  const phoneNumber = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limitedNumber = phoneNumber.slice(0, 10);
  
  // Format based on length
  if (limitedNumber.length === 0) {
    return '';
  } else if (limitedNumber.length <= 3) {
    return `(${limitedNumber}`;
  } else if (limitedNumber.length <= 6) {
    return `(${limitedNumber.slice(0, 3)}) ${limitedNumber.slice(3)}`;
  } else {
    return `(${limitedNumber.slice(0, 3)}) ${limitedNumber.slice(3, 6)}-${limitedNumber.slice(6)}`;
  }
};

export default function MyInfo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || ""
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { fullName: string; email: string; phone: string }) => {
      const response = await apiRequest("PATCH", "/api/users/me/profile", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      // Update the user in the query cache immediately for real-time reflection
      queryClient.setQueryData(["/api/auth/me"], updatedUser);
      
      toast({
        title: "Profile Updated",
        description: "Your personal information has been successfully updated.",
      });
      
      setErrors({});
    },
    onError: (error: any) => {
      console.error('Profile update error:', error);
      
      // Handle validation errors
      if (error.errors) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err: any) => {
          const field = err.path?.[0];
          if (field) {
            newErrors[field] = err.message;
          }
        });
        setErrors(newErrors);
      }
      
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !/^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid US phone number (e.g., (555) 123-4567)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    // Format phone number as user types
    const formattedValue = field === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Info</h1>
        <p className="text-muted-foreground">
          Manage your personal information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your name, email, and phone number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Enter your full name"
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Enter your email address"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <Mail className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Changing your email address will affect your login credentials. You'll need to use the new email to sign in.
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number (US only) <span className="text-muted-foreground text-sm">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
                maxLength={14}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
              <p className="text-sm text-muted-foreground">
                US format only. Will auto-format as you type: (555) 123-4567
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Role Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your role and account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Role</Label>
            <p className="font-medium">
              {user.role === 'MHP_LORD' && 'MHP Lord (Admin)'}
              {user.role === 'ADMIN' && 'Company Manager'}
              {user.role === 'MANAGER' && 'Park Manager'}
              {user.role === 'TENANT' && 'Tenant'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

