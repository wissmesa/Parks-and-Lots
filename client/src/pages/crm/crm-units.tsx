import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, Bed, Bath, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { AuthManager } from "@/lib/auth";

interface Unit {
  id: string;
  nameOrNumber: string;
  status: string[] | null;
  priceForRent?: string | null;
  priceForSale?: string | null;
  priceRentToOwn?: string | null;
  priceContractForDeed?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqFt?: number | null;
  parkId?: string | null;
  parkName?: string | null;
  companyName?: string | null;
}

export default function CrmUnits() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const user = AuthManager.getUser();
  const isLord = user?.role === 'MHP_LORD';

  const { data: unitsData, isLoading } = useQuery({
    queryKey: ["/api/crm/units", currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());
      
      const res = await fetch(`/api/crm/units?${params.toString()}`, { 
        headers: AuthManager.getAuthHeaders(),
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const units: Unit[] = unitsData?.units || [];
  const totalCount = unitsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Filter units by search query
  const filteredUnits = units.filter((unit) =>
    unit.nameOrNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort units
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return a.nameOrNumber.localeCompare(b.nameOrNumber);
      case "name-desc":
        return b.nameOrNumber.localeCompare(a.nameOrNumber);
      case "price-high":
        const aPrice = parseFloat(a.priceForSale || a.priceForRent || "0");
        const bPrice = parseFloat(b.priceForSale || b.priceForRent || "0");
        return bPrice - aPrice;
      case "price-low":
        const aPriceLow = parseFloat(a.priceForSale || a.priceForRent || "0");
        const bPriceLow = parseFloat(b.priceForSale || b.priceForRent || "0");
        return aPriceLow - bPriceLow;
      default:
        return 0;
    }
  });

  const getStatusColor = (status: string) => {
    // Use a neutral color scheme for all statuses
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  const handleRowClick = (unitId: string) => {
    setLocation(`/crm/units/${unitId}`);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, and pages around current page
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Units / Lots</h1>
        <p className="text-muted-foreground">View all available units and lots</p>
      </div>

      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Unit Number (A-Z)</SelectItem>
            <SelectItem value="name-desc">Unit Number (Z-A)</SelectItem>
            <SelectItem value="price-high">Price (High to Low)</SelectItem>
            <SelectItem value="price-low">Price (Low to High)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Items per page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedUnits.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Number</TableHead>
                {isLord && <TableHead>Company</TableHead>}
                <TableHead>Park</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUnits.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(unit.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Unit {unit.nameOrNumber}</span>
                    </div>
                  </TableCell>
                  {isLord && (
                    <TableCell>
                      {unit.companyName || "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    {unit.parkName || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {unit.status && unit.status.length > 0 ? (
                        unit.status.map((s, i) => (
                          <Badge key={i} className={getStatusColor(s)}>
                            {s.replace(/_/g, " ")}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {unit.priceForRent && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {parseFloat(unit.priceForRent).toLocaleString()}/mo
                        </div>
                      )}
                      {unit.priceForSale && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {parseFloat(unit.priceForSale).toLocaleString()}
                        </div>
                      )}
                      {unit.priceRentToOwn && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {parseFloat(unit.priceRentToOwn).toLocaleString()} RTO
                        </div>
                      )}
                      {unit.priceContractForDeed && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {parseFloat(unit.priceContractForDeed).toLocaleString()} CFD
                        </div>
                      )}
                      {!unit.priceForRent && !unit.priceForSale && !unit.priceRentToOwn && !unit.priceContractForDeed && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      {unit.bedrooms && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4" />
                          {unit.bedrooms}
                        </div>
                      )}
                      {unit.bathrooms && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4" />
                          {unit.bathrooms}
                        </div>
                      )}
                      {unit.sqFt && (
                        <span>{unit.sqFt.toLocaleString()} sqft</span>
                      )}
                      {!unit.bedrooms && !unit.bathrooms && !unit.sqFt && (
                        <span>-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} units
              </div>
              
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    page === -1 ? (
                      <span key={`ellipsis-${index}`} className="px-2">...</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        className="min-w-[40px]"
                      >
                        {page}
                      </Button>
                    )
                  ))}
                </div>

                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No units found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? "Try adjusting your search query" : "Units will appear here once they are added to your parks"}
          </p>
        </div>
      )}
    </div>
  );
}

