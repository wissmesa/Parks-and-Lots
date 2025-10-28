import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, User, Briefcase, Home, Mail, Phone, DollarSign } from "lucide-react";
import { AuthManager } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAssociationDialog } from "./add-association-dialog";

interface Association {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType?: string | null;
  entityDetails?: any;
  createdAt: string;
}

interface AssociationsSectionProps {
  entityType: "CONTACT" | "DEAL" | "LOT";
  entityId: string;
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

export function AssociationsSection({ entityType, entityId }: AssociationsSectionProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteAssociationId, setDeleteAssociationId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch associations
  const { data: associationsData, isLoading } = useQuery({
    queryKey: ["/api/crm/associations", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/associations?sourceType=${entityType}&sourceId=${entityId}`, {
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch associations");
      return res.json();
    },
    enabled: !!entityId,
    refetchInterval: 30000, // Real-time updates every 30 seconds
  });

  // Delete association mutation
  const deleteAssociationMutation = useMutation({
    mutationFn: async (associationId: string) => {
      const res = await fetch(`/api/crm/associations/${associationId}`, {
        method: "DELETE",
        headers: AuthManager.getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete association");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/associations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Success", description: "Association removed successfully" });
      setDeleteAssociationId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove association", variant: "destructive" });
    },
  });

  const associations: Association[] = associationsData?.associations || [];

  // Group associations by type
  const contactAssociations = associations.filter((a) => a.targetType === "CONTACT");
  const dealAssociations = associations.filter((a) => a.targetType === "DEAL");
  const lotAssociations = associations.filter((a) => a.targetType === "LOT");

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "CLOSED_WON":
        return "bg-green-100 text-green-800";
      case "CLOSED_LOST":
        return "bg-red-100 text-red-800";
      case "DEPOSIT_PAID_CONTRACT_SIGNED":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FOR_RENT":
        return "bg-blue-100 text-blue-800";
      case "FOR_SALE":
        return "bg-green-100 text-green-800";
      case "RENT_TO_OWN":
        return "bg-purple-100 text-purple-800";
      case "CONTRACT_FOR_DEED":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const navigateToEntity = (type: string, id: string) => {
    if (type === "CONTACT") {
      setLocation(`/crm/contacts/${id}`);
    } else if (type === "DEAL") {
      setLocation(`/crm/deals/${id}`);
    } else if (type === "LOT") {
      setLocation(`/crm/units/${id}`);
    }
  };

  const getPrimaryPrice = (lot: any) => {
    if (lot.priceForRent) return { value: lot.priceForRent, label: "Rent" };
    if (lot.priceForSale) return { value: lot.priceForSale, label: "Sale" };
    if (lot.priceRentToOwn) return { value: lot.priceRentToOwn, label: "Rent to Own" };
    if (lot.priceContractForDeed) return { value: lot.priceContractForDeed, label: "Contract" };
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Related Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Related Items</CardTitle>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Association
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contacts Section */}
          {entityType !== "CONTACT" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Contacts ({contactAssociations.length})</h3>
              </div>
              <div className="space-y-2">
                {contactAssociations.map((assoc) => (
                  <div
                    key={assoc.id}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1"
                        onClick={() => navigateToEntity(assoc.targetType, assoc.targetId)}
                      >
                        <h4 className="font-medium hover:text-primary">
                          {assoc.entityDetails?.firstName} {assoc.entityDetails?.lastName}
                        </h4>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          {assoc.entityDetails?.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {assoc.entityDetails.email}
                            </div>
                          )}
                          {assoc.entityDetails?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {assoc.entityDetails.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteAssociationId(assoc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {contactAssociations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No associated contacts
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Deals Section */}
          {entityType !== "DEAL" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Deals ({dealAssociations.length})</h3>
              </div>
              <div className="space-y-2">
                {dealAssociations.map((assoc) => (
                  <div
                    key={assoc.id}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1"
                        onClick={() => navigateToEntity(assoc.targetType, assoc.targetId)}
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium hover:text-primary">
                            {assoc.entityDetails?.title}
                          </h4>
                          {assoc.entityDetails?.stage && (
                            <Badge className={getStageColor(assoc.entityDetails.stage)}>
                              {DEAL_STAGES.find((s) => s.value === assoc.entityDetails.stage)?.label}
                            </Badge>
                          )}
                        </div>
                        {assoc.entityDetails?.value && (
                          <div className="flex items-center gap-1 text-sm text-green-600 font-semibold mt-1">
                            <DollarSign className="h-3 w-3" />
                            {parseFloat(assoc.entityDetails.value).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteAssociationId(assoc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {dealAssociations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No associated deals
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Units/Lots Section */}
          {entityType !== "LOT" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Home className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Units ({lotAssociations.length})</h3>
              </div>
              <div className="space-y-2">
                {lotAssociations.map((assoc) => {
                  const primaryPrice = assoc.entityDetails ? getPrimaryPrice(assoc.entityDetails) : null;
                  return (
                    <div
                      key={assoc.id}
                      className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className="flex-1"
                          onClick={() => navigateToEntity(assoc.targetType, assoc.targetId)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium hover:text-primary">
                              Unit {assoc.entityDetails?.nameOrNumber}
                            </h4>
                            {assoc.entityDetails?.status && assoc.entityDetails.status.map((s: string) => (
                              <Badge key={s} className={getStatusColor(s)}>
                                {s.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                          {primaryPrice && (
                            <div className="flex items-center gap-1 text-sm text-blue-600 font-semibold mt-1">
                              <DollarSign className="h-3 w-3" />
                              {parseFloat(primaryPrice.value).toLocaleString()} ({primaryPrice.label})
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAssociationId(assoc.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {lotAssociations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No associated units
                  </p>
                )}
              </div>
            </div>
          )}

          {associations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No related items yet. Click "Add Association" to link contacts, deals, or units.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Association Dialog */}
      <AddAssociationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        sourceType={entityType}
        sourceId={entityId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAssociationId} onOpenChange={(open) => !open && setDeleteAssociationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Association</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this association? This will be removed from both entities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAssociationId && deleteAssociationMutation.mutate(deleteAssociationId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


