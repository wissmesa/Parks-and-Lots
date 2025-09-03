import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { MapPin, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigationItems: { href: string; label: string; public: boolean }[] = [];

  const NavLinks = ({ mobile = false, onClose = () => {} }) => (
    <>
      {navigationItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClose}
          className={`${
            mobile 
              ? "block px-3 py-2 text-base font-medium" 
              : "inline-flex"
          } text-muted-foreground hover:text-foreground transition-colors ${
            location === item.href ? "text-foreground" : ""
          }`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MapPin className="text-primary-foreground h-4 w-4" />
              </div>
              <span className="text-xl font-bold text-foreground">Parks & Lots</span>
            </Link>
            <nav className="hidden md:flex space-x-6">
              <NavLinks />
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">
                  Welcome, {user?.fullName}
                </span>
                {user?.role === 'ADMIN' && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm">
                      Admin Panel
                    </Button>
                  </Link>
                )}
                {user?.role === 'MANAGER' && (
                  <Link href="/manager">
                    <Button variant="outline" size="sm">
                      Manager Panel
                    </Button>
                  </Link>
                )}
                <Button onClick={handleLogout} variant="outline" size="sm">
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button data-testid="button-login">
                  Sign In
                </Button>
              </Link>
            )}
            
            <div className="md:hidden">
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <nav className="flex flex-col space-y-4 mt-8">
                    <NavLinks mobile onClose={() => setIsMenuOpen(false)} />
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
