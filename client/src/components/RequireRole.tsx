import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

interface RequireRoleProps {
  role: 'MHP_LORD' | 'MANAGER' | 'ADMIN' | 'TENANT' | ('MANAGER' | 'ADMIN')[];
  children: React.ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  // Show loading state while authentication is resolving
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  // Check if user has required role(s)
  const hasRequiredRole = Array.isArray(role) 
    ? role.includes(user.role as any)
    : user.role === role;

  // Show 404 if user doesn't have required role
  if (!hasRequiredRole) {
    return <NotFound />;
  }

  // Render the protected component
  return <>{children}</>;
}