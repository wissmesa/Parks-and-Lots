import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, DollarSign } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Deal {
  id: string;
  title: string;
  value?: string | null;
  stage: string;
  probability?: number | null;
  contactId?: string | null;
  lotId?: string | null;
  createdAt: string;
}

const DEAL_STAGES = [
  { value: "QUALIFIED_LEAD", label: "Qualified Lead" },
  { value: "SHOWING_SCHEDULED", label: "Showing Scheduled" },
  { value: "SHOWING_COMPLETED", label: "Showing Completed" },
  { value: "APPLIED_TO_ALL", label: "Applied to All" },
  { value: "FINANCING_APPROVED", label: "Financing Approved" },
  { value: "DEPOSIT_PAID_CONTRACT_SIGNED", label: "Deposit Paid & Contract Signed" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
];

export default function CrmDeals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({
    title: "",
    value: "",
    stage: "QUALIFIED_LEAD",
    probability: "50",
  });

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ["/api/crm/deals"],
    queryFn: async () => {
      const res = await fetch("/api/crm/deals", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setNewDeal({ title: "", value: "", stage: "QUALIFIED_LEAD", probability: "50" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create deal", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed to update deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      toast({ title: "Success", description: "Deal updated successfully" });
    },
  });

  const deals: Deal[] = dealsData?.deals || [];

  // Group deals by stage
  const dealsByStage = DEAL_STAGES.reduce((acc, stage) => {
    acc[stage.value] = deals.filter((deal) => deal.stage === stage.value);
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
                disabled={!newDeal.title || createMutation.isPending || !user?.id}
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => (
            <div key={stage.value} className="flex-shrink-0 w-80">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-4">
                  {stage.label} ({dealsByStage[stage.value]?.length || 0})
                </h3>
                <div className="space-y-3">
                  {dealsByStage[stage.value]?.map((deal) => (
                    <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{deal.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        {deal.value && (
                          <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                            <DollarSign className="h-4 w-4" />
                            {parseFloat(deal.value).toLocaleString()}
                          </div>
                        )}
                        {deal.probability !== null && (
                          <div className="text-sm text-muted-foreground mt-2">
                            {deal.probability}% probability
                          </div>
                        )}
                        <div className="mt-3">
                          <Select
                            value={deal.stage}
                            onValueChange={(newStage) =>
                              updateStageMutation.mutate({ id: deal.id, stage: newStage })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEAL_STAGES.map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!dealsByStage[stage.value] || dealsByStage[stage.value].length === 0) && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

