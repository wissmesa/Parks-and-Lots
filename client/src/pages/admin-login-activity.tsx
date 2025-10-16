import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { apiRequest } from "@/lib/queryClient";
import { Activity, Search } from "lucide-react";
import { format } from "date-fns";

interface LoginLog {
  id: string;
  userId: string | null;
  email: string;
  success: boolean;
  ipAddress: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export default function AdminLoginActivity() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [daysFilter, setDaysFilter] = useState<string>("90");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Redirect if not MHP_LORD
  if (user?.role !== 'MHP_LORD') {
    window.location.href = '/';
    return null;
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [roleFilter, daysFilter, statusFilter]);

  // Fetch login logs with real-time updates
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["/api/admin/login-logs", roleFilter, daysFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }
      if (daysFilter !== "90") {
        params.set("days", daysFilter);
      }
      if (statusFilter !== "all") {
        params.set("success", statusFilter);
      }
      params.set("page", page.toString());
      params.set("limit", pageSize.toString());
      const url = `/api/admin/login-logs?${params.toString()}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    enabled: user?.role === 'MHP_LORD',
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000, // Poll every 60 seconds for real-time updates
  });

  const logs: LoginLog[] = logsData?.logs || [];
  const totalCount = logsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Filter logs by search term
  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.email.toLowerCase().includes(searchLower) ||
      log.user?.fullName?.toLowerCase().includes(searchLower) ||
      log.ipAddress?.toLowerCase().includes(searchLower) ||
      log.locationCity?.toLowerCase().includes(searchLower) ||
      log.locationCountry?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate stats
  const totalLogs = filteredLogs.length;
  const successfulLogins = filteredLogs.filter(l => l.success).length;
  const failedLogins = filteredLogs.filter(l => !l.success).length;
  const uniqueUsers = new Set(filteredLogs.filter(l => l.userId).map(l => l.userId)).size;
  
  // Calculate current page range
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const parseUserAgent = (userAgent: string | null): string => {
    if (!userAgent) return "Unknown";
    
    // Simple user agent parsing
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Opera")) return "Opera";
    
    return "Other";
  };

  const formatLocation = (log: LoginLog): string => {
    const parts = [];
    if (log.locationCity) parts.push(log.locationCity);
    if (log.locationRegion) parts.push(log.locationRegion);
    if (log.locationCountry) parts.push(log.locationCountry);
    
    return parts.length > 0 ? parts.join(", ") : "Unknown";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-4 md:p-8 pr-16 md:pr-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="w-8 h-8" />
                Login Activity
              </h1>
              <p className="text-muted-foreground mt-2">
                Track all login attempts across the system
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Attempts</div>
                <div className="text-2xl font-bold">{totalLogs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="text-2xl font-bold text-green-600">{successfulLogins}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Failed</div>
                <div className="text-2xl font-bold text-red-600">{failedLogins}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Unique Users</div>
                <div className="text-2xl font-bold">{uniqueUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by email, name, IP, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">User Type</option>
              <option value="MHP_LORD">MHP Lord</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="TENANT">Tenant</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Status</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading login logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No login logs found</p>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? "Try adjusting your search or filters" : "No login activity yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {log.user?.fullName || "Unknown User"}
                            </div>
                            <div className="text-sm text-muted-foreground">{log.email}</div>
                            {log.user?.role && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {log.user.role}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.success ? "default" : "destructive"}>
                            {log.success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {format(new Date(log.createdAt), "MMM d, yyyy")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(log.createdAt), "h:mm:ss a")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatLocation(log)}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.ipAddress || "Unknown"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{parseUserAgent(log.userAgent)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination */}
            {!isLoading && filteredLogs.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex}-{endIndex} of {totalCount} entries
                </div>
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage(Math.max(1, page - 1))}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={pageNum === page}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

