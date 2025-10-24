import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { CheckCircle } from "lucide-react";
//exports
export default function AcceptInvite() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { acceptInvite, isAcceptInviteLoading } = useAuth();
  const { toast } = useToast();

  // Get token from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');
    if (inviteToken) {
      setToken(inviteToken);
    }
  }, []);

  // Validate invite token
  const { data: inviteData, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ["invite-validate", token],
    queryFn: async () => {
      const response = await fetch(`/api/auth/invites/validate/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to validate invite');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await acceptInvite({ token, password, fullName });
      toast({
        title: "Account Created",
        description: `Your ${inviteData?.role === 'TENANT' ? 'tenant' : 'manager'} account has been created successfully!`,
      });
      
      // Redirect based on role
      if (inviteData?.role === 'TENANT') {
        window.location.href = "/tenant";
      } else {
        window.location.href = "/manager";
      }
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
            <p className="text-muted-foreground mb-4">No invitation token provided.</p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (inviteError || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Invalid or Expired Invite</h2>
            <p className="text-muted-foreground mb-4">
              This invitation link is invalid or has expired.
            </p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <CardTitle className="text-center flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              <span>Setup Your Account</span>
            </CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              You've been invited as a {inviteData.role === 'TENANT' ? 'tenant' : 'park manager'} for <span className="font-medium">{inviteData.email}</span>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {inviteData.role !== 'TENANT' && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    data-testid="input-full-name"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create a password (min 8 characters)"
                  data-testid="input-password"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  data-testid="input-confirm-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isAcceptInviteLoading}
                data-testid="button-accept-invite"
              >
                {isAcceptInviteLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
