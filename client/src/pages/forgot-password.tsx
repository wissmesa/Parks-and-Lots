import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", { email });
      
      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: "Email Sent",
          description: "If an account with that email exists, a password reset link has been sent.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to send password reset email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center">
            <img 
              src="/logos/MHP (1) short.png" 
              alt="MHP Sales Manager" 
              className="h-12 w-auto object-contain"
            />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Forgot Password?</CardTitle>
          </CardHeader>
          <CardContent>
            {!isSubmitted ? (
              <>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email address"
                      data-testid="input-email"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-send-reset-email"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-6">
                  If an account with that email exists, we've sent you a password reset link. 
                  Please check your email and follow the instructions to reset your password.
                </p>
                <p className="text-xs text-muted-foreground">
                  Didn't receive an email? Check your spam folder or try again with a different email address.
                </p>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Remember your password?
              </p>
              <Link href="/login" className="text-sm text-primary hover:text-primary/80" data-testid="link-back-to-login">
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}