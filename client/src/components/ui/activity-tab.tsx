import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, User, Calendar, Activity } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ActivityTabProps {
  entityType: 'COMPANY' | 'PARK' | 'LOT';
  entityId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  userName: string;
  userRole: string;
  createdAt: string;
}

function formatAuditEntry(log: AuditLog): string {
  if (log.action === 'CREATED') {
    return `Created ${log.entityType.toLowerCase()}`;
  }
  
  if (log.action === 'UPDATED' && log.fieldName) {
    // Special handling for status field
    if (log.fieldName === 'isActive' || log.fieldName === 'Status') {
      const newStatus = log.newValue === 'Yes' || log.newValue === 'true' ? 'Active' : 'Inactive';
      return `Changed status to ${newStatus}`;
    }
    
    return `Changed ${log.fieldName} from "${log.oldValue}" to "${log.newValue}"`;
  }
  
  return `${log.action}`;
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'MHP_LORD':
      return 'destructive';
    case 'ADMIN':
      return 'default';
    case 'MANAGER':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatRoleName(role: string): string {
  switch (role) {
    case 'MHP_LORD':
      return 'Lord';
    case 'ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Manager';
    case 'TENANT':
      return 'Tenant';
    default:
      return role;
  }
}

export function ActivityTab({ entityType, entityId, createdAt, updatedAt }: ActivityTabProps) {
  const { data: auditLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', entityType, entityId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/audit-logs/${entityType}/${entityId}`
      );
      return response.json();
    },
  });

  // Helper function to safely parse and format dates
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, 'PPp');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatRelativeTime = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Timestamps Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timestamps
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-medium">
              {formatDate(createdAt)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(createdAt)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="font-medium">
              {formatDate(updatedAt)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(updatedAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{log.userName}</span>
                      <Badge variant={getRoleBadgeVariant(log.userRole)} className="text-xs">
                        {formatRoleName(log.userRole)}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm">
                      {formatAuditEntry(log)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No activity history yet</p>
              <p className="text-sm mt-1">Changes will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

