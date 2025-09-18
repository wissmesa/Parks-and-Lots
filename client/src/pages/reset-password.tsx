import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    // Extract token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (!tokenParam) {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid or missing the required token.",
        variant: "destructive",
      });
    } else {
      setToken(tokenParam);
    }
  }, [toast]);

  // Redirect to login after successful password reset
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        window.location.href = '/login';
      }, 3000); // Redirect after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast({
        title: "Invalid Token",
        description: "This password reset link is invalid.",
        variant: "destructive",
      });
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter and confirm your new password",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both password fields match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password,
        confirmPassword
      });
      
      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "Password Reset Successful",
          description: "Your password has been reset successfully. You can now sign in with your new password.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Reset Failed",
          description: errorData.message || "Failed to reset password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <MapPin className="text-primary-foreground h-6 w-6" />
              </div>
              <span className="text-2xl font-bold text-foreground">Parks & Lots</span>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Invalid Reset Link</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center mb-6">
                This password reset link is invalid or has expired.
              </p>
              
              <div className="text-center space-y-2">
                <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 block" data-testid="link-request-new-reset">
                  Request a new password reset
                </Link>
                <Link href="/login" className="text-sm text-primary hover:text-primary/80 block" data-testid="link-back-to-login">
                  Back to Sign In
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <MapPin className="text-primary-foreground h-6 w-6" />
            </div>
            <span className="text-2xl font-bold text-foreground">Parks & Lots</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Reset Your Password</CardTitle>
          </CardHeader>
          <CardContent>
            {!isSuccess ? (
              <>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Enter your new password below.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your new password"
                      data-testid="input-new-password"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm your new password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-6">
                  Your password has been reset successfully! You can now sign in with your new password.
                </p>
                
                <Button asChild className="w-full" data-testid="button-go-to-login">
                  <Link href="/login">
                    Go to Sign In
                  </Link>
                </Button>
              </div>
            )}

            {!isSuccess && (
              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-primary hover:text-primary/80" data-testid="link-back-to-login">
                  Back to Sign In
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}