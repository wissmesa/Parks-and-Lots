import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MapPin } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoginLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await login({ email, password });
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      
      // Redirect based on user role
      const userData = response.user || response;
      if (userData.role === 'ADMIN') {
        window.location.href = "/admin";
      } else if (userData.role === 'MANAGER') {
        window.location.href = "/manager";
      } else if (userData.role === 'Tenant') {
        window.location.href = "/Tenant";
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    }
  };

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
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  data-testid="input-email"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  data-testid="input-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoginLoading}
                data-testid="button-submit-login"
              >
                {isLoginLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80" data-testid="link-forgot-password">
                Forgot Password?
              </Link>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account? Managers are invited by administrators.
              </p>
              <Link href="/" className="text-sm text-primary hover:text-primary/80">
                Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
