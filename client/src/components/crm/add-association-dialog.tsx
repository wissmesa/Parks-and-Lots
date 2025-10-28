import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AuthManager } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Search } from "lucide-react";

interface AddAssociationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: "CONTACT" | "DEAL" | "LOT";
  sourceId: string;
}

export function AddAssociationDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
}: AddAssociationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [targetType, setTargetType] = useState<"CONTACT" | "DEAL" | "LOT" | "">("");
  const [targetId, setTargetId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTargetType("");
      setTargetId("");
      setSearchTerm("");
    }
  }, [open]);

  // Fetch available contacts
  const { data: contactsData } = useQuery({
    queryKey: ["/api/crm/contacts", searchTerm],
    queryFn: async () => {
      const res = await fetch("/api/crm/contacts", {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: targetType === "CONTACT" && sourceType !== "CONTACT",
  });

  // Fetch available deals
  const { data: dealsData } = useQuery({
    queryKey: ["/api/crm/deals", searchTerm],
    queryFn: async () => {
      const res = await fetch("/api/crm/deals", {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
    enabled: targetType === "DEAL" && sourceType !== "DEAL",
  });

  // Fetch available units/lots
  const { data: lotsData } = useQuery({
    queryKey: ["/api/crm/units", searchTerm],
    queryFn: async () => {
      const res = await fetch("/api/lots", {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: targetType === "LOT" && sourceType !== "LOT",
  });

  // Create association mutation
  const createAssociationMutation = useMutation({
    mutationFn: async (data: { sourceType: string; sourceId: string; targetType: string; targetId: string }) => {
      const res = await fetch("/api/crm/associations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...AuthManager.getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create association");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/associations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Association created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create association", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetType || !targetId) {
      toast({ title: "Error", description: "Please select an entity to associate", variant: "destructive" });
      return;
    }

    createAssociationMutation.mutate({
      sourceType,
      sourceId,
      targetType,
      targetId,
    });
  };

  const getAvailableEntityTypes = () => {
    const types = [];
    if (sourceType !== "CONTACT") types.push({ value: "CONTACT", label: "Contact" });
    if (sourceType !== "DEAL") types.push({ value: "DEAL", label: "Deal" });
    if (sourceType !== "LOT") types.push({ value: "LOT", label: "Unit" });
    return types;
  };

  const getEntityList = () => {
    if (targetType === "CONTACT") {
      return contactsData?.contacts || [];
    } else if (targetType === "DEAL") {
      return dealsData?.deals || [];
    } else if (targetType === "LOT") {
      return lotsData || [];
    }
    return [];
  };

  const getFilteredEntities = () => {
    const entities = getEntityList();
    if (!searchTerm) return entities;

    const lowerSearch = searchTerm.toLowerCase();
    return entities.filter((entity: any) => {
      if (targetType === "CONTACT") {
        return (
          entity.firstName?.toLowerCase().includes(lowerSearch) ||
          entity.lastName?.toLowerCase().includes(lowerSearch) ||
          entity.email?.toLowerCase().includes(lowerSearch)
        );
      } else if (targetType === "DEAL") {
        return entity.title?.toLowerCase().includes(lowerSearch);
      } else if (targetType === "LOT") {
        return entity.nameOrNumber?.toLowerCase().includes(lowerSearch);
      }
      return false;
    });
  };

  const getEntityLabel = (entity: any) => {
    if (targetType === "CONTACT") {
      return `${entity.firstName} ${entity.lastName}${entity.email ? ` (${entity.email})` : ""}`;
    } else if (targetType === "DEAL") {
      return entity.title;
    } else if (targetType === "LOT") {
      return `Unit ${entity.nameOrNumber}`;
    }
    return "";
  };

  const availableTypes = getAvailableEntityTypes();
  const filteredEntities = getFilteredEntities();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Association</DialogTitle>
            <DialogDescription>
              Link this {sourceType.toLowerCase()} with another entity in your CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={targetType} onValueChange={(value) => {
                setTargetType(value as any);
                setTargetId("");
                setSearchTerm("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetType && (
              <>
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${targetType.toLowerCase()}s...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select {targetType === "LOT" ? "Unit" : targetType.charAt(0) + targetType.slice(1).toLowerCase()}</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select a ${targetType.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {filteredEntities.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No {targetType.toLowerCase()}s found
                        </div>
                      ) : (
                        filteredEntities.map((entity: any) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            {getEntityLabel(entity)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!targetId || createAssociationMutation.isPending}>
              {createAssociationMutation.isPending ? "Creating..." : "Create Association"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


