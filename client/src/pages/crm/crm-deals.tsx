import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, DollarSign, Search } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthManager } from "@/lib/auth";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from "@dnd-kit/core";

interface Deal {
  id: string;
  title: string;
  value?: string | null;
  stage: string;
  probability?: number | null;
  contactId?: string | null;
  lotId?: string | null;
  createdAt: string;
  companyId?: string | null;
  companyName?: string | null;
}

interface Company {
  id: string;
  name: string;
}

const DEAL_STAGES = [
  { value: "QUALIFIED_LEAD", label: "Qualified Lead" },
  { value: "SHOWING_SCHEDULED", label: "Showing Scheduled" },
  { value: "SHOWING_COMPLETED", label: "Showing Completed" },
  { value: "APPLIED_TO_ALL", label: "Applied to All Applications" },
  { value: "FINANCING_APPROVED", label: "Financing Approved" },
  { value: "DEPOSIT_PAID_CONTRACT_SIGNED", label: "Deposit Paid & Contract Signed" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
];

// Draggable Deal Card Component
function DraggableDealCard({ deal, onClick, showCompany }: { deal: Deal; onClick: () => void; showCompany?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="w-full"
    >
      <Card 
        className="hover:shadow-md transition-shadow w-full group"
      >
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle 
            className="text-base truncate flex-1 cursor-pointer"
            onClick={onClick}
          >
            {deal.title}
          </CardTitle>
          <div 
            {...listeners} 
            {...attributes}
            className="cursor-move ml-2 p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-all"
            title="Drag to move"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-muted-foreground">
              <circle cx="4" cy="4" r="1.5"/>
              <circle cx="4" cy="8" r="1.5"/>
              <circle cx="4" cy="12" r="1.5"/>
              <circle cx="12" cy="4" r="1.5"/>
              <circle cx="12" cy="8" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
            </svg>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 cursor-pointer" onClick={onClick}>
          {deal.value && (
            <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{parseFloat(deal.value).toLocaleString()}</span>
            </div>
          )}
          {deal.probability !== null && (
            <div className="text-sm text-muted-foreground mt-2">
              {deal.probability}% probability
            </div>
          )}
          {showCompany && deal.companyName && (
            <div className="text-xs text-muted-foreground mt-2 truncate">
              {deal.companyName}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Droppable Stage Column Component
function DroppableStageColumn({
  stage,
  deals,
  onDealClick,
  showCompany,
}: {
  stage: { value: string; label: string };
  deals: Deal[];
  onDealClick: (dealId: string) => void;
  showCompany?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.value,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-80"
    >
      <div className={`border rounded-lg p-4 min-h-[200px] transition-all ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-background"
      }`}>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
          {stage.label} ({deals.length})
        </h3>
        <div className="space-y-3">
          {deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal.id)}
              showCompany={showCompany}
            />
          ))}
          {deals.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No deals
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CrmDeals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("title-asc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({
    title: "",
    value: "",
    stage: "QUALIFIED_LEAD",
    probability: "50",
    companyId: "",
  });

  const isLord = user?.role === 'MHP_LORD';

  // Fetch companies for MHP_LORD users
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: isLord,
  });

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ["/api/crm/deals"],
    queryFn: async () => {
      const res = await fetch("/api/crm/deals", { 
        headers: AuthManager.getAuthHeaders(),
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          assignedTo: data.assignedTo, // This should be set to current user
        }),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      toast({ title: "Success", description: "Deal created successfully" });
      setIsCreateOpen(false);
      setNewDeal({ title: "", value: "", stage: "QUALIFIED_LEAD", probability: "50", companyId: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create deal", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed to update deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      toast({ title: "Success", description: "Deal stage updated successfully" });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const deal = event.active.data.current?.deal;
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as string;
    const deal = deals.find((d) => d.id === dealId);

    if (deal && deal.stage !== newStage) {
      updateStageMutation.mutate({ id: dealId, stage: newStage });
    }
  };

  const handleDealClick = (dealId: string) => {
    setLocation(`/crm/deals/${dealId}`);
  };

  const deals: Deal[] = dealsData?.deals || [];

  // Filter deals by search query
  const filteredDeals = deals.filter((deal) =>
    deal.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort function
  const sortDeals = (dealsArray: Deal[]) => {
    return [...dealsArray].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "value-high":
          const aValue = a.value ? parseFloat(a.value) : 0;
          const bValue = b.value ? parseFloat(b.value) : 0;
          return bValue - aValue;
        case "value-low":
          const aValueLow = a.value ? parseFloat(a.value) : 0;
          const bValueLow = b.value ? parseFloat(b.value) : 0;
          return aValueLow - bValueLow;
        case "date-newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date-oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });
  };

  // Group deals by stage with filtering and sorting
  const dealsByStage = DEAL_STAGES.reduce((acc, stage) => {
    const stageDeals = filteredDeals.filter((deal) => deal.stage === stage.value);
    acc[stage.value] = sortDeals(stageDeals);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Deals Pipeline</h1>
          <p className="text-muted-foreground">Track your deals through the sales pipeline</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isLord && (
                <div>
                  <Label htmlFor="companyId">Company *</Label>
                  <Select
                    value={newDeal.companyId}
                    onValueChange={(value) => setNewDeal({ ...newDeal, companyId: value })}
                  >
                    <SelectTrigger id="companyId">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="title">Deal Title *</Label>
                <Input
                  id="title"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  placeholder="New lot sale opportunity"
                />
              </div>
              <div>
                <Label htmlFor="value">Deal Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="probability">Probability (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  value={newDeal.probability}
                  onChange={(e) => setNewDeal({ ...newDeal, probability: e.target.value })}
                  placeholder="50"
                  min="0"
                  max="100"
                />
              </div>
              <Button
                onClick={() => createMutation.mutate({
                  ...newDeal,
                  value: newDeal.value ? parseFloat(newDeal.value) : null,
                  probability: newDeal.probability ? parseInt(newDeal.probability) : 50,
                  assignedTo: user?.id,
                })}
                disabled={!newDeal.title || (isLord && !newDeal.companyId) || createMutation.isPending || !user?.id}
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
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
            <SelectItem value="title-asc">Title (A-Z)</SelectItem>
            <SelectItem value="title-desc">Title (Z-A)</SelectItem>
            <SelectItem value="value-high">Value (High to Low)</SelectItem>
            <SelectItem value="value-low">Value (Low to High)</SelectItem>
            <SelectItem value="date-newest">Newest First</SelectItem>
            <SelectItem value="date-oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stage) => (
              <DroppableStageColumn
                key={stage.value}
                stage={stage}
                deals={dealsByStage[stage.value] || []}
                onDealClick={handleDealClick}
                showCompany={isLord}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <Card className="w-80 opacity-90 shadow-lg cursor-move">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{activeDeal.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {activeDeal.value && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                      <DollarSign className="h-4 w-4" />
                      {parseFloat(activeDeal.value).toLocaleString()}
                    </div>
                  )}
                  {activeDeal.probability !== null && (
                    <div className="text-sm text-muted-foreground mt-2">
                      {activeDeal.probability}% probability
                    </div>
                  )}
                  {isLord && activeDeal.companyName && (
                    <div className="text-xs text-muted-foreground mt-2 truncate">
                      {activeDeal.companyName}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

